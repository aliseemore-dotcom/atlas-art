import { describe, expect, it } from "vitest";
import { buildTree, initials, usablePortrait, type TreeArtist, type TreeRelationship } from "./build";

const A = (id: string, name: string, birth: number | null, death: number | null, extra: Partial<TreeArtist> = {}): TreeArtist => ({
  id, slug: id, nameRu: name, birthYear: birth, deathYear: death, activeFrom: null, activeTo: null,
  birthPrecision: birth === null ? "unknown" : "exact", deathPrecision: death === null ? "unknown" : "exact",
  eraLabel: null, portraitUrl: null, portraitRights: "unknown", portraitCredit: null, portraitSourceUrl: null, ...extra,
});
const R = (id: string, from: string, to: string, status: TreeRelationship["status"], type: TreeRelationship["type"] = "teacher_of"): TreeRelationship => ({ id, fromId: from, toId: to, type, status });

const artists = [A("a", "Иван Крамской", 1837, 1887), A("b", "Илья Репин", 1844, 1930), A("c", "Покрас Лампас", 1991, null), A("d", "Даниил Чёрный", null, null)];

describe("buildTree", () => {
  it("показывает всех художников, даже без дат и связей; даты не придумываются", () => {
    const t = buildTree(artists, []);
    expect(t.cards).toHaveLength(4);
    const d = t.cards.find((c) => c.id === "d");
    expect(d?.years).toBe("даты неизвестны");
    expect(d?.approx).toBe(true);
    expect(t.cards.find((c) => c.id === "c")?.years).toBe("р. 1991");
  });
  it("ранние выше поздних", () => {
    const t = buildTree(artists, []);
    const top = (id: string) => t.cards.find((c) => c.id === id)?.top ?? 0;
    expect(top("a")).toBeLessThanOrEqual(top("b"));
    expect(top("b")).toBeLessThan(top("c"));
    expect(top("c")).toBeLessThan(top("d")); // без оценки — в конце, не выдавая себя за позднего
  });
  it("линии только по подтверждённым связям; draft не рисуется никогда", () => {
    const rels = [R("1", "a", "b", "verified"), R("2", "b", "c", "needs_review"), R("3", "a", "c", "draft")];
    expect(buildTree(artists, rels).edges.map((e) => e.id)).toEqual(["1"]);
    expect(buildTree(artists, rels, { includeUnverified: true }).edges.map((e) => e.id).sort()).toEqual(["1", "2"]);
  });
  it("совпадение лет жизни линий не создаёт", () => {
    expect(buildTree(artists, []).edges).toEqual([]);
  });
  it("новый художник встаёт на своё историческое место, остальные сохраняют порядок", () => {
    const before = buildTree(artists, []);
    const after = buildTree([...artists, A("n", "Валентин Серов", 1865, 1911)], []);
    const order = (t: typeof before) => [...t.cards].sort((x, y) => x.top - y.top || x.left - y.left).map((c) => c.id).filter((id) => id !== "n");
    expect(order(after)).toEqual(order(before));
    const top = (id: string) => after.cards.find((c) => c.id === id)?.top ?? 0;
    expect(top("n")).toBeGreaterThan(top("a"));
    expect(top("n")).toBeLessThan(top("c"));
  });
});

describe("портрет и инициалы", () => {
  it("портрет только с правами, автором и источником", () => {
    const ok = { portraitUrl: "/p.jpg", portraitRights: "public_domain" as const, portraitCredit: "Автор", portraitSourceUrl: "https://x.org" };
    expect(usablePortrait(ok)).toBe("/p.jpg");
    expect(usablePortrait({ ...ok, portraitRights: "unknown" })).toBeNull();
    expect(usablePortrait({ ...ok, portraitCredit: null })).toBeNull();
    expect(usablePortrait({ ...ok, portraitSourceUrl: null })).toBeNull();
  });
  it("инициалы", () => {
    expect(initials("Илья Репин")).toBe("ИР");
    expect(initials("Дионисий")).toBe("Д");
  });
});
