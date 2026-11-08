import { describe, expect, it } from "vitest";
import { parseArtworksCsv, parseFactsCsv, parseGroupsCsv, parseMembershipsCsv, parseSummariesCsv, type Ctx } from "./content";

const ctx: Ctx = {
  artists: new Map([
    ["ilya-repin", { birthYear: 1844, deathYear: 1930 }],
    ["valentin-serov", { birthYear: 1865, deathYear: 1911 }],
  ]),
  sourceIds: new Set(["s1"]),
};
const AW = "id,artist_slugs,title_ru,year_from,year_to,year_precision,medium,collection,image_url,image_rights,image_credit,image_source_url,verification_status,source_id,sort_order\n";

describe("сводки и факты", () => {
  it("сводка: нужен источник и разумная длина", () => {
    const H = "artist_slug,summary,source_id\n";
    const ok = "Русский художник, мастер портрета и исторической картины, преподавал в Академии художеств.";
    expect(parseSummariesCsv(H + `ilya-repin,"${ok}",s1\n`, ctx).records).toHaveLength(1);
    expect(parseSummariesCsv(H + `ilya-repin,"${ok}",\n`, ctx).issues[0]?.message).toMatch(/источник/);
    expect(parseSummariesCsv(H + `ilya-repin,"${ok}",zz\n`, ctx).issues).toHaveLength(1);
    expect(parseSummariesCsv(H + `ilya-repin,"${"я".repeat(701)}",s1\n`, ctx).issues).toHaveLength(1);
    expect(parseSummariesCsv(H + `nobody,"${ok}",s1\n`, ctx).issues).toHaveLength(1);
  });
  it("факт без источника не принимается; порядок сохраняется", () => {
    const H = "id,artist_slug,text,source_id,sort_order\n";
    const t = "Работал над картиной три года и многократно переписывал её.";
    expect(parseFactsCsv(H + `f1,ilya-repin,"${t}",,\n`, ctx).issues[0]?.message).toMatch(/источник/);
    const r = parseFactsCsv(H + `f1,ilya-repin,"${t}",s1,\nf2,ilya-repin,"${t} Ещё.",s1,\n`, ctx);
    expect(r.records.map((x) => x.sortOrder)).toEqual([0, 1]);
    expect(parseFactsCsv(H + `f1,ilya-repin,"${t}",s1,\nf1,ilya-repin,"${t}",s1,\n`, ctx).issues).toHaveLength(1);
  });
});

describe("картины", () => {
  it("картина без изображения принимается", () => {
    expect(parseArtworksCsv(AW + "w1,ilya-repin,Бурлаки на Волге,1870,1873,exact,холст,масло,,,,,needs_review,,\n", ctx).records).toHaveLength(1);
  });
  it("изображение только с правами, автором и источником", () => {
    const row = (rights: string, credit: string, src: string) => `w1,ilya-repin,Работа,1880,,exact,,,/img/w.jpg,${rights},${credit},${src},needs_review,,\n`;
    expect(parseArtworksCsv(AW + row("public_domain", "Музей", "https://commons.wikimedia.org/x"), ctx).records).toHaveLength(1);
    expect(parseArtworksCsv(AW + row("unknown", "Музей", "https://x.org"), ctx).issues[0]?.message).toMatch(/права/);
    expect(parseArtworksCsv(AW + row("licensed", "", "https://x.org"), ctx).issues[0]?.message).toMatch(/автор/);
    expect(parseArtworksCsv(AW + row("licensed", "Музей", ""), ctx).issues[0]?.message).toMatch(/источник/);
  });
  it("verified требует источник; несколько авторов; неизвестный автор; годы", () => {
    expect(parseArtworksCsv(AW + "w1,ilya-repin,A,1880,,exact,,,,,,,verified,,\n", ctx).issues).toHaveLength(1);
    expect(parseArtworksCsv(AW + "w1,ilya-repin;valentin-serov,A,1880,,exact,,,,,,,verified,s1,\n", ctx).records[0]?.artistSlugs).toHaveLength(2);
    expect(parseArtworksCsv(AW + "w1,nobody,A,1880,,exact,,,,,,,needs_review,,\n", ctx).issues).toHaveLength(1);
    expect(parseArtworksCsv(AW + "w1,ilya-repin,A,1900,1890,exact,,,,,,,needs_review,,\n", ctx).issues).toHaveLength(1);
  });
  it("аномальные годы дают предупреждение, одинаковые названия — разные slug", () => {
    const r = parseArtworksCsv(AW + "w1,ilya-repin,Портрет,1800,,exact,,,,,,,needs_review,,\nw2,valentin-serov,Портрет,1890,,exact,,,,,,,needs_review,,\n", ctx);
    expect(r.warnings).toHaveLength(1);
    expect(new Set(r.records.map((x) => x.slug)).size).toBe(2);
  });
});

describe("объединения", () => {
  const GH = "id,name_ru,type,from_year,to_year,description,verification_status\n";
  const MH = "artist_slug,group_slug,from_year,to_year,verification_status,source_id\n";
  it("объединение — отдельная сущность с типом", () => {
    const r = parseGroupsCsv(GH + "g1,Передвижники,association,1870,1923,,needs_review\n");
    expect(r.records[0]).toMatchObject({ slug: "peredvizhniki", type: "association" });
    expect(parseGroupsCsv(GH + "g1,X,movement,,,,needs_review\n").issues).toHaveLength(1); // направление — не объединение
  });
  it("участие: нужны художник и группа, verified — с источником, дубли отклоняются", () => {
    const groups = new Map([["peredvizhniki", { fromYear: 1870, toYear: 1923 }]]);
    expect(parseMembershipsCsv(MH + "ilya-repin,peredvizhniki,1878,,needs_review,\n", ctx, groups).records).toHaveLength(1);
    expect(parseMembershipsCsv(MH + "ilya-repin,peredvizhniki,,,verified,\n", ctx, groups).issues).toHaveLength(1);
    expect(parseMembershipsCsv(MH + "ilya-repin,nope,,,needs_review,\n", ctx, groups).issues).toHaveLength(1);
    expect(parseMembershipsCsv(MH + "ilya-repin,peredvizhniki,,,needs_review,\nilya-repin,peredvizhniki,,,needs_review,\n", ctx, groups).issues).toHaveLength(1);
    expect(parseMembershipsCsv(MH + "ilya-repin,peredvizhniki,1930,,needs_review,\n", ctx, groups).warnings).toHaveLength(1);
  });
});
