import { expect, test, type Page } from "@playwright/test";

test.beforeEach(({ page }) => {
  page.on("console", (m) => {
    if (m.type() === "error") throw new Error(`console error: ${m.text()}`);
  });
  page.on("pageerror", (e) => {
    throw e;
  });
});

const transform = (page: Page) => page.locator(".react-flow__viewport").evaluate((el) => (el as HTMLElement).style.transform);
const cards = (page: Page) => page.locator("[data-testid^=card-]");
// у React Flow карточка лежит в обёртке узла; её позиция — позиция карточки на экране
const top = (page: Page, slug: string) => page.getByTestId(`card-${slug}`).evaluate((e) => (e.parentElement as HTMLElement).getBoundingClientRect().top);

test("на странице только древо: все 114 художников, без шапки, меню и блоков", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  expect(await cards(page).count()).toBe(114);
  await expect(page.locator("header, nav, footer, aside, h1, h2")).toHaveCount(0);
  expect(await page.getByRole("group", { name: "Управление древом" }).getByRole("button").count()).toBe(3); // только управление древом
  await expect(page.getByTestId("artist-panel")).toHaveCount(0); // окно появляется только по клику
});

test("белый фон, только Manrope, портреты прямоугольные", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe("rgb(255, 255, 255)");
  const fonts = await page.evaluate(() => {
    const set = new Set<string>();
    document.querySelectorAll("body *").forEach((el) => set.add(getComputedStyle(el).fontFamily.split(",")[0]?.trim() ?? ""));
    return [...set];
  });
  expect(fonts).toEqual(["Manrope"]);
  const weights = await page.evaluate(() => [...new Set([...document.querySelectorAll(".card .name, .card .years, .card .portrait")].map((e) => getComputedStyle(e).fontWeight))]);
  expect(weights.every((w) => w === "400" || w === "700")).toBe(true);
  const radius = await page.locator(".card .portrait").first().evaluate((e) => getComputedStyle(e).borderRadius);
  expect(radius).toBe("0px");
});

test("карточка содержит только портрет, имя и годы", async ({ page }) => {
  await page.goto("/");
  const card = page.getByTestId("card-ilya-repin");
  await expect(card).toBeAttached();
  await expect(card.locator(".name")).toHaveText("Илья Репин");
  await expect(card.locator(".years")).toHaveText("1844–1930");
  expect(await card.locator(".portrait").count()).toBe(1);
  expect(await card.locator("a, button, p, h3").count()).toBe(0);
});

test("историческая последовательность: ранние сверху, современные снизу, современники рядом", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  const feofan = await top(page, "feofan-grek");
  const repin = await top(page, "ilya-repin");
  const polenov = await top(page, "vasiliy-polenov");
  const lampas = await top(page, "pokras-lampas");
  expect(feofan).toBeLessThan(repin);
  expect(repin).toBeLessThan(lampas);
  expect(Math.abs(repin - polenov)).toBeLessThan(Math.abs(repin - feofan) / 5); // современники (оба 1844) на одном или соседнем уровне
});

test("линий нет, пока нет подтверждённых связей; предпросмотр рисует связи из базы", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  expect(await page.locator("g[data-type]").count()).toBe(0);
  await page.goto("/?draft=1");
  await expect(cards(page).first()).toBeVisible();
  expect(await page.locator("g[data-type]").count()).toBeGreaterThan(20);
});

test("карточки не перекрываются", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  const overlaps = await page.evaluate(() => {
    const r = [...document.querySelectorAll("[data-testid^=card-]")].map((e) => e.getBoundingClientRect());
    let n = 0;
    for (let i = 0; i < r.length; i++)
      for (let j = i + 1; j < r.length; j++) {
        const a = r[i] as DOMRect;
        const b = r[j] as DOMRect;
        if (a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5) n++;
      }
    return n;
  });
  expect(overlaps).toBe(0);
});

test("масштаб, перемещение и «всё древо» работают", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  await page.waitForTimeout(300);
  const t0 = await transform(page);
  await page.getByRole("button", { name: "Приблизить" }).click();
  await page.waitForTimeout(300);
  const t1 = await transform(page);
  expect(t1).not.toBe(t0);
  await page.getByRole("button", { name: "Отдалить" }).click();
  await page.getByRole("button", { name: "Отдалить" }).click();
  await page.waitForTimeout(300);
  const t2 = await transform(page);
  expect(t2).not.toBe(t1);
  const box = (await page.locator(".react-flow__pane").boundingBox()) as { x: number; y: number };
  await page.mouse.move(box.x + 300, box.y + 300);
  await page.mouse.down();
  await page.mouse.move(box.x + 420, box.y + 380, { steps: 5 });
  await page.mouse.up();
  expect(await transform(page)).not.toBe(t2);
  await page.getByRole("button", { name: "Всё древо целиком" }).click();
  await page.waitForTimeout(500);
  const outside = await page.evaluate(() => {
    const w = innerWidth;
    const h = innerHeight;
    return [...document.querySelectorAll("[data-testid^=card-]")].filter((e) => {
      const r = e.getBoundingClientRect();
      return r.left < -2 || r.top < -2 || r.right > w + 2 || r.bottom > h + 2;
    }).length;
  });
  expect(outside).toBe(0);
});

test("узкий экран: страница не прокручивается вбок, управление доступно", async ({ page }) => {
  await page.goto("/");
  await expect(cards(page).first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await expect(page.getByRole("button", { name: "Всё древо целиком" })).toBeVisible();
});

test.describe("боковое окно карточки", () => {
  test("клик по карточке открывает окно; пустые разделы честно пусты", async ({ page }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible();
    await page.getByRole("button", { name: "Всё древо целиком" }).click();
    await page.waitForTimeout(500);
    await page.getByTestId("card-ilya-repin").click(); // настоящий клик мышью по карточке
    const panel = page.getByTestId("artist-panel");
    await expect(panel.getByRole("heading", { name: "Илья Репин" })).toBeVisible();
    await expect(panel).toContainText("1844–1930");
    await expect(panel).toContainText("Сводка пока не добавлена.");
    await expect(panel).toContainText("Фактов пока нет.");
    await expect(panel).toContainText("Картины пока не добавлены.");
    await expect(page).toHaveURL(/#ilya-repin$/);
  });

  test("в окне видны связи с источником и статусом; клик по имени открывает другого художника", async ({ page }) => {
    await page.goto("/#ilya-repin");
    const panel = page.getByTestId("artist-panel");
    await expect(panel.getByRole("heading", { name: "Илья Репин" })).toBeVisible();
    await expect(panel).toContainText("Учителя:");
    await expect(panel.locator(".tag").first()).toHaveText("ждёт подтверждения"); // Крамской → Репин: страница книги указана
    await expect(panel).toContainText("Тайны русского искусства, Маркус Ф. Ф., с. 520");
    await panel.getByRole("button", { name: "Иван Крамской" }).click();
    await expect(panel.getByRole("heading", { name: "Иван Крамской" })).toBeVisible();
    await expect(page).toHaveURL(/#ivan-kramskoy$/);
  });

  test("закрытие: кнопка, Escape и клик по полю древа", async ({ page }) => {
    await page.goto("/#ilya-repin");
    const panel = page.getByTestId("artist-panel");
    await expect(panel).toBeVisible();
    await panel.getByRole("button", { name: "Закрыть карточку" }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole("button", { name: "Всё древо целиком" }).click();
    await page.waitForTimeout(500);
    await page.getByTestId("card-ilya-repin").click();
    await expect(panel).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(panel).toHaveCount(0);
  });

  test("открытая карточка остаётся видимой рядом с окном", async ({ page, isMobile }) => {
    await page.goto("/#ilya-repin");
    await expect(page.getByTestId("artist-panel")).toBeVisible();
    await page.waitForTimeout(600);
    const box = (await page.getByTestId("card-ilya-repin").boundingBox()) as { x: number; y: number; width: number; height: number };
    const vp = page.viewportSize() as { width: number; height: number };
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.y).toBeGreaterThanOrEqual(0);
    if (isMobile) expect(box.y + box.height).toBeLessThanOrEqual(vp.height * 0.4 + 1);
    else expect(box.x + box.width).toBeLessThanOrEqual(vp.width - 440 + 1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  });

  test("перетаскивание древа за карточку окно не открывает", async ({ page }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible();
    const b = (await cards(page).first().boundingBox()) as { x: number; y: number; width: number; height: number };
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2 + 60, b.y + b.height / 2 + 40, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByTestId("artist-panel")).toHaveCount(0);
  });

  test("клавиатура: Enter на карточке открывает окно", async ({ page }) => {
    await page.goto("/");
    await expect(cards(page).first()).toBeVisible();
    await page.getByTestId("card-ilya-repin").focus();
    await page.waitForTimeout(500);
    // фокус подвёл карточку в поле зрения
    const box = (await page.getByTestId("card-ilya-repin").boundingBox()) as { x: number; y: number; width: number; height: number };
    const vp = page.viewportSize() as { width: number; height: number };
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 1);
    await page.keyboard.press("Enter");
    await expect(page.getByTestId("artist-panel").getByRole("heading", { name: "Илья Репин" })).toBeVisible();
  });
});
