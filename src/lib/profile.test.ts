import { describe, expect, it } from "vitest";
import { buildProfile, type ProfileInput, type SourceRef } from "./profile";

const S: SourceRef = { title: "Источник", authorOrInstitution: null, url: "https://example.org", publicationYear: null, page: null };
const base = (over: Partial<ProfileInput> = {}): ProfileInput => ({
  artist: { id: "1", slug: "ilya-repin", nameRu: "Илья Репин", birthYear: 1844, deathYear: 1930, birthPrecision: "exact", deathPrecision: "exact", bio: null, bioSource: null, portraitUrl: null, portraitRights: "unknown", portraitCredit: null, portraitSourceUrl: null },
  facts: [], works: [], groups: [], relations: [], ...over,
});
const work = (over: Partial<ProfileInput["works"][number]> = {}): ProfileInput["works"][number] => ({
  slug: "w", titleRu: "Работа", yearFrom: 1880, yearTo: null, yearPrecision: "exact", medium: null, currentCollection: null, sortOrder: 0, verificationStatus: "needs_review",
  imageUrl: null, imageRights: "unknown", imageCredit: null, imageSourceUrl: null, source: null, ...over,
});

describe("buildProfile", () => {
  it("пустая карточка: ничего не выдумывается", () => {
    const p = buildProfile(base());
    expect(p).toMatchObject({ years: "1844–1930", summary: null, portrait: null, facts: [], works: [], groups: [] });
  });
  it("сводка показывается только вместе с источником", () => {
    const a = base().artist;
    expect(buildProfile(base({ artist: { ...a, bio: "Текст сводки.", bioSource: null } })).summary).toBeNull();
    expect(buildProfile(base({ artist: { ...a, bio: "Текст сводки.", bioSource: S } })).summary?.source.title).toBe("Источник");
  });
  it("факты без источника отбрасываются, остальные по порядку", () => {
    const p = buildProfile(base({ facts: [{ text: "Б", sortOrder: 2, source: S }, { text: "без источника", sortOrder: 0, source: null }, { text: "А", sortOrder: 1, source: S }] }));
    expect(p.facts.map((f) => f.text)).toEqual(["А", "Б"]);
  });
  it("картины: draft скрыт, изображение только с правами, автором и источником", () => {
    const p = buildProfile(base({
      works: [
        work({ slug: "a", sortOrder: 1, imageUrl: "/a.jpg", imageRights: "public_domain", imageCredit: "Музей", imageSourceUrl: "https://x.org" }),
        work({ slug: "b", sortOrder: 0, imageUrl: "/b.jpg", imageRights: "unknown", imageCredit: "Музей", imageSourceUrl: "https://x.org" }),
        work({ slug: "c", sortOrder: 2, imageUrl: "/c.jpg", imageRights: "licensed", imageCredit: null, imageSourceUrl: "https://x.org" }),
        work({ slug: "d", verificationStatus: "draft" }),
        work({ slug: "e", sortOrder: 3, verificationStatus: "verified", source: S }),
      ],
    }));
    expect(p.works.map((w) => w.slug)).toEqual(["b", "a", "c", "e"]);
    expect(p.works.map((w) => w.image !== null)).toEqual([false, true, false, false]);
    expect(p.works.find((w) => w.slug === "e")?.needsReview).toBe(false);
    expect(p.works[0]?.needsReview).toBe(true);
  });
  it("годы картины и объединения", () => {
    const p = buildProfile(base({
      works: [work({ yearFrom: 1870, yearTo: 1873 }), work({ slug: "x", sortOrder: 1, yearFrom: null, yearTo: null })],
      groups: [{ nameRu: "Передвижники", slug: "peredvizhniki", type: "association", fromYear: 1878, toYear: null, verificationStatus: "needs_review", source: null }, { nameRu: "Скрытое", slug: "x", type: "association", fromYear: null, toYear: null, verificationStatus: "draft", source: null }],
    }));
    expect(p.works.map((w) => w.years)).toEqual(["1870–1873", null]);
    expect(p.groups).toHaveLength(1);
    expect(p.groups[0]?.years).toBe("1878");
  });
  it("связи делятся на учителей, учеников и прочие; draft скрыт", () => {
    const r = (type: "teacher_of" | "influenced" | "collaborated", direction: "in" | "out", slug: string, status: "draft" | "needs_review" | "verified" = "needs_review") => ({ type, direction, other: { slug, nameRu: slug }, status, sources: [] });
    const p = buildProfile(base({ relations: [r("teacher_of", "in", "kramskoy"), r("teacher_of", "out", "serov"), r("collaborated", "out", "x"), r("teacher_of", "in", "hidden", "draft")] }));
    expect(p.teachers.map((t) => t.other.slug)).toEqual(["kramskoy"]);
    expect(p.pupils.map((t) => t.other.slug)).toEqual(["serov"]);
    expect(p.others).toHaveLength(1);
  });
});
