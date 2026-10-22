import { describe, expect, it } from "vitest";
import { estimateAnchor, formatYears, resolveAnchors } from "./anchor";
import { assignRows, layoutTimeTree, SIZES, type CardInput, type CardPos, type EdgeInput } from "./timeLayout";

const C = (id: string, anchor: number | null, sortKey = 0): CardInput => ({ id, anchor, sortKey });
const E = (from: string, to: string, type: EdgeInput["type"] = "teacher_of"): EdgeInput => ({ id: `${type}:${from}>${to}`, from, to, type });

function check(l: ReturnType<typeof layoutTimeTree>) {
  const overlap = (a: CardPos, b: CardPos) => a.left < b.left + b.width && b.left < a.left + a.width && a.top < b.top + b.height && b.top < a.top + a.height;
  for (let i = 0; i < l.cards.length; i++) for (let j = i + 1; j < l.cards.length; j++) expect(overlap(l.cards[i] as CardPos, l.cards[j] as CardPos)).toBe(false);
  for (const e of l.edges) {
    for (let i = 1; i < e.points.length; i++) {
      const [x0, y0] = e.points[i - 1] as [number, number];
      const [x1, y1] = e.points[i] as [number, number];
      expect(x0 === x1 || y0 === y1).toBe(true);
      if (x0 !== x1) continue;
      const [ya, yb] = y0 < y1 ? [y0, y1] : [y1, y0];
      for (const c of l.cards) {
        if (c.id === e.fromId || c.id === e.toId) continue;
        expect(x0 > c.left && x0 < c.left + c.width && yb > c.top && ya < c.top + c.height, `${e.id} через ${c.id}`).toBe(false);
      }
    }
  }
}

describe("anchor", () => {
  it("период активности приоритетнее лет жизни", () => {
    const base = { birthYear: 1800, deathYear: 1870, eraLabel: null };
    expect(estimateAnchor({ ...base, activeFrom: null, activeTo: null }).year).toBe(1845); // 1820 + min(25, 50/2)
    expect(estimateAnchor({ ...base, activeFrom: 1850, activeTo: 1852 }).year).toBe(1851);
  });
  it("только год рождения (ныне живущий) и только год смерти — приблизительность", () => {
    expect(estimateAnchor({ birthYear: 1961, deathYear: null, activeFrom: null, activeTo: null, eraLabel: null })).toEqual({ year: 1981 + 20, approx: false });
    expect(estimateAnchor({ birthYear: null, deathYear: 1500, activeFrom: null, activeTo: null, eraLabel: null }).approx).toBe(true);
  });
  it("без дат: по медиане той же эпохи, без выдуманных дат, иначе null", () => {
    const a = (id: string, b: number | null, d: number | null, era: string | null) => ({ id, birthYear: b, deathYear: d, activeFrom: null, activeTo: null, eraLabel: era });
    const r = resolveAnchors([a("1", 1340, 1405, "Э"), a("2", 1440, 1508, "Э"), a("3", null, null, "Э"), a("4", null, null, null), a("5", null, null, "Нет")]);
    expect(r.get("3")?.approx).toBe(true);
    expect(r.get("3")?.year).toBeGreaterThan(1350);
    expect(r.get("4")?.year).toBeNull();
    expect(r.get("5")?.year).toBeNull();
  });
  it("подпись лет", () => {
    const p = { birthPrecision: "exact" as const, deathPrecision: "exact" as const };
    expect(formatYears({ birthYear: 1844, deathYear: 1930, ...p })).toBe("1844–1930");
    expect(formatYears({ birthYear: 1949, deathYear: null, ...p })).toBe("р. 1949");
    expect(formatYears({ birthYear: 1360, deathYear: 1430, birthPrecision: "circa", deathPrecision: "circa" })).toBe("ок. 1360–1430");
    expect(formatYears({ birthYear: null, deathYear: null, ...p })).toBe("даты неизвестны");
  });
});

describe("assignRows", () => {
  it("ранние выше, современники в одном ряду, неизвестные — в конце", () => {
    const r = assignRows([C("late", 1990), C("a", 1860), C("b", 1862), C("early", 1400), C("none", null)]);
    expect(r.get("early")).toBeLessThan(r.get("a") as number);
    expect(r.get("a")).toBe(r.get("b"));
    expect(r.get("a")).toBeLessThan(r.get("late") as number);
    expect(r.get("none")).toBeGreaterThan(r.get("late") as number);
  });
  it("переполненное окно делится на соседние ряды в порядке времени", () => {
    const cards = Array.from({ length: SIZES.maxPerRow * 2 }, (_, i) => C(`c${i}`, 1900 + (i % 5), i));
    const r = assignRows(cards);
    expect(new Set(r.values()).size).toBe(2);
    const max0 = Math.max(...cards.filter((c) => r.get(c.id) === 0).map((c) => c.anchor as number));
    const min1 = Math.min(...cards.filter((c) => r.get(c.id) === 1).map((c) => c.anchor as number));
    expect(max0).toBeLessThanOrEqual(min1);
  });
  it("добавление художника не меняет порядок рядов остальных", () => {
    const base = [C("a", 1500), C("b", 1700), C("c", 1900)];
    const before = assignRows(base);
    const after = assignRows([...base, C("n", 1800)]);
    const rank = (m: Map<string, number>) => ["a", "b", "c"].sort((x, y) => (m.get(x) as number) - (m.get(y) as number));
    expect(rank(after)).toEqual(rank(before));
    expect(after.get("n")).toBeGreaterThan(after.get("b") as number);
    expect(after.get("n")).toBeLessThan(after.get("c") as number);
  });
});

describe("layoutTimeTree", () => {
  it("пустой вход и без связей: карточки не пересекаются, линий нет", () => {
    expect(layoutTimeTree([], []).cards).toEqual([]);
    const l = layoutTimeTree([C("a", 1500), C("b", 1501), C("c", 1700), C("d", 1990)], []);
    expect(l.edges).toEqual([]);
    expect(l.rows).toBe(3);
    check(l);
  });
  it("вертикаль отражает время, связи не меняют уровень", () => {
    // «ученик» исторически раньше «учителя» в данных: уровень определяется временем, а не связью
    const l = layoutTimeTree([C("teacher", 1900), C("pupil", 1800)], [E("teacher", "pupil")]);
    const by = Object.fromEntries(l.cards.map((c) => [c.id, c]));
    expect((by.pupil?.top ?? 0) < (by.teacher?.top ?? 0)).toBe(true);
    check(l);
  });
  it("связь через несколько рядов обходит чужие карточки", () => {
    const cards = [C("t", 1500), C("m1", 1600), C("m2", 1601), C("m3", 1602), C("p", 1800)];
    const l = layoutTimeTree(cards, [E("t", "p"), E("m1", "p", "influenced")]);
    expect(l.edges).toHaveLength(2);
    check(l);
  });
  it("связь в одном ряду: рядом — прямая, далеко — по шине над рядом", () => {
    const l = layoutTimeTree([C("a", 1880), C("b", 1881), C("c", 1882), C("d", 1883)], [E("a", "b", "collaborated"), E("a", "d", "collaborated")]);
    expect(l.edges).toHaveLength(2);
    check(l);
  });
  it("много художников: ряды не шире maxPerRow, без наложений", () => {
    const cards = Array.from({ length: 120 }, (_, i) => C(`c${i}`, 1340 + Math.floor(i * 5.5), i));
    const edges = [E("c1", "c9"), E("c1", "c30"), E("c10", "c60"), E("c60", "c100"), E("c61", "c100", "influenced"), E("c40", "c41", "collaborated")];
    const l = layoutTimeTree(cards, edges);
    const perRow = new Map<number, number>();
    l.cards.forEach((c) => perRow.set(c.row, (perRow.get(c.row) ?? 0) + 1));
    expect(Math.max(...perRow.values())).toBeLessThanOrEqual(SIZES.maxPerRow);
    expect(l.cards).toHaveLength(120);
    check(l);
  });
  it("детерминирован", () => {
    const cards = [C("a", 1500), C("b", 1600), C("c", 1601)];
    const edges = [E("a", "b"), E("a", "c")];
    expect(layoutTimeTree(cards, edges)).toEqual(layoutTimeTree(cards, edges));
  });
  it("связанные современники оказываются ближе, чем несвязанные", () => {
    const cards = [C("x", 1900, 0), C("y", 1900, 1), C("z", 1900, 2), C("w", 1900, 3), C("t1", 1850), C("t2", 1850, 1)];
    const l = layoutTimeTree(cards, [E("t1", "x"), E("t2", "w")]);
    const by = Object.fromEntries(l.cards.map((c) => [c.id, c]));
    expect(Math.abs((by.x?.cx ?? 0) - (by.t1?.cx ?? 0))).toBeLessThanOrEqual(Math.abs((by.w?.cx ?? 0) - (by.t1?.cx ?? 0)));
    check(l);
  });
});
