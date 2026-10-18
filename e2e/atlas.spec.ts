import { expect, test } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("console", (m) => {
    // 404-ответ на сам запрошенный документ браузер тоже пишет в консоль — это не ошибка приложения
    if (m.type() === "error" && !m.text().includes("status of 404")) throw new Error(`console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    throw e;
  });
});

test("главная → Россия → найти художника → карточка → назад", async ({ page, isMobile }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Хронология/ }).last().click();
  await expect(page).toHaveURL(/\/regions\/russia/);

  await page.getByLabel("Поиск по имени").fill("шишкин");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/q=/);
  await expect(page.getByText("Найдено:")).toContainText("1");

  const link = isMobile
    ? page.getByRole("link", { name: "Иван Шишкин" })
    : page.getByRole("link", { name: /Иван Шишкин/ }).first();
  await link.click();
  await expect(page.getByRole("heading", { name: "Иван Шишкин" })).toBeVisible();
  await expect(page.getByText("Требует проверки").first()).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/q=/);
});

test("поиск не зависит от регистра и ё/е", async ({ page }) => {
  await page.goto("/regions/russia?view=list&q=РУБЛЕВ");
  await expect(page.getByRole("link", { name: "Андрей Рублёв" })).toBeVisible();
});

test("диапазон → жанр → сброс фильтров", async ({ page }) => {
  await page.goto("/regions/russia?view=list");
  const total = async () => Number(await page.locator("p[aria-live] strong").textContent());
  const all = await total();

  await page.getByLabel("Год от").fill("1880");
  await page.getByLabel("Год до").fill("1890");
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/from=1880/);
  const ranged = await total();
  expect(ranged).toBeGreaterThan(0);
  expect(ranged).toBeLessThan(all);
  await expect(page.getByRole("link", { name: "Андрей Рублёв" })).toHaveCount(0);

  await page.locator("select[name=genre]").selectOption({ label: "Пейзаж" });
  await page.getByRole("button", { name: "Применить" }).click();
  await expect(page).toHaveURL(/genre=/);
  expect(await total()).toBeLessThan(ranged);

  await page.getByRole("link", { name: "Сбросить фильтры" }).click();
  await expect(page.locator("p[aria-live] strong")).toHaveText(String(all));
});

test("пустой результат объяснён и есть сброс", async ({ page }) => {
  await page.goto("/regions/russia?q=несуществующийхудожник");
  await expect(page.getByText("Ничего не найдено")).toBeVisible();
  await page.getByRole("link", { name: "Сбросить фильтры" }).first().click();
  await expect(page.getByText(/Найдено:/)).toBeVisible();
});

test("художник без дат: карточка открывается, шкала не ломается", async ({ page }) => {
  await page.goto("/artists/daniil-chernyy");
  await expect(page.getByRole("heading", { name: "Даниил Чёрный" })).toBeVisible();
  await expect(page.getByText("даты неизвестны").first()).toBeVisible();
  await page.goto("/regions/russia?view=timeline");
  await expect(page.getByText("Даты неизвестны, на шкале не показаны")).toBeVisible();
});

test("шкала: полосы являются ссылками, есть легенда", async ({ page }) => {
  await page.goto("/regions/russia?view=timeline");
  await expect(page.getByRole("list", { name: "Легенда" })).toBeVisible();
  await expect(page.locator("svg a").first()).toBeVisible();
  const count = await page.locator("svg a").count();
  expect(count).toBeGreaterThan(50);
});

test("мобильный: по умолчанию список, без горизонтальной прокрутки", async ({ page, isMobile }) => {
  test.skip(!isMobile, "только мобильный проект");
  await page.goto("/regions/russia");
  await expect(page.getByRole("list", { name: "Список художников" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Хронология" })).toBeHidden();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

test("404 для неизвестного художника", async ({ page }) => {
  const res = await page.goto("/artists/net-takogo", { waitUntil: "domcontentloaded" }).catch(() => null);
  expect(res?.status()).toBe(404);
});

test.describe("древо художников", () => {
  test("древо открывается, показаны ветви, линии и предупреждение о непроверенных связях", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "на мобильном по умолчанию список");
    await page.goto("/regions/russia/tree");
    await expect(page.getByRole("heading", { name: /Древо художников/ })).toBeVisible();
    await expect(page.getByTestId("unverified-note")).toContainText("не подтверждённые факты");
    await expect(page.locator("[data-testid^=node-]").first()).toBeVisible();
    expect(await page.locator("[data-testid^=node-]").count()).toBeGreaterThanOrEqual(10);
    await expect(page.getByRole("heading", { name: "КАК ЧИТАТЬ ДРЕВО" })).toBeVisible();
    await expect(page.getByTestId("branch-label")).toContainText("ВЕТВЬ I");
  });

  test("клик по медальону показывает связи со статусом, а не как факт", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "на мобильном по умолчанию список");
    await page.goto("/regions/russia/tree");
    await page.getByTestId("node-ilya-repin").click();
    const panel = page.getByTestId("tree-detail");
    await expect(panel.getByRole("heading", { name: "Илья Репин" })).toBeVisible();
    await expect(panel).toContainText("Валентин Серов");
    await expect(panel).toContainText("НЕ СВЕРЕНО");
    await expect(panel.getByRole("link", { name: /Карточка художника/ })).toHaveAttribute("href", "/artists/ilya-repin");
    await page.keyboard.press("Escape");
    await expect(panel).toContainText("ВЫБЕРИТЕ ХУДОЖНИКА");
  });

  test("скрытие неподтверждённых связей даёт понятное пустое состояние", async ({ page }) => {
    await page.goto("/regions/russia/tree?unverified=0");
    await expect(page.getByText("Подтверждённых связей пока нет.")).toBeVisible();
    await expect(page.getByRole("link", { name: /Показать связи, ожидающие проверки/ })).toBeVisible();
  });

  test("переключение ветви через боковую ленту", async ({ page, isMobile }) => {
    test.skip(isMobile === true, "на мобильном по умолчанию список");
    await page.goto("/regions/russia/tree");
    await page.getByRole("navigation", { name: "Ветви древа" }).getByRole("link").nth(1).click();
    await expect(page).toHaveURL(/branch=/);
    await expect(page.getByTestId("branch-label")).toContainText("ВЕТВЬ II");
  });

  test("список — запасной вид: поколения, учителя и ученики", async ({ page }) => {
    await page.goto("/regions/russia/tree?view=list");
    await expect(page.getByText("ПОКОЛЕНИЕ 1")).toBeVisible();
    await expect(page.getByText("Учителя:").first()).toBeVisible();
  });

  test("мобильный: по умолчанию список, без горизонтальной прокрутки", async ({ page, isMobile }) => {
    test.skip(!isMobile, "только мобильный проект");
    await page.goto("/regions/russia/tree");
    await expect(page.getByText("ПОКОЛЕНИЕ 1")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  });

  test("карточка художника показывает связи с пометкой", async ({ page }) => {
    await page.goto("/artists/ilya-repin");
    await expect(page.getByText("Валентин Серов").first()).toBeVisible();
    await expect(page.getByText("НЕ СВЕРЕНО").first()).toBeVisible();
  });
});
