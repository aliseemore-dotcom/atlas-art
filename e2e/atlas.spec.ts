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
  await page.getByRole("link", { name: "Россия" }).last().click();
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
