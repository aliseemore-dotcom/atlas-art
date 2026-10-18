import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findCycle, parsePortraitsCsv, parseRelationshipsCsv, parseSourcesCsv } from "./relationships";
import { parseSeedCsv } from "./seed";

const read = (f: string) => readFileSync(path.resolve(__dirname, "../../../data", f), "utf8");
const HEAD = "id,from_seed_id,to_seed_id,type,from_year,to_year,verification_status,evidence_note,source_ids\n";
const artists = new Map([
  ["a", { slug: "a", birthYear: 1800 }],
  ["b", { slug: "b", birthYear: 1830 }],
  ["c", { slug: "c", birthYear: 1860 }],
]);

describe("настоящий набор связей", () => {
  it("валиден, без циклов и аномалий лет, все needs_review", () => {
    const seed = parseSeedCsv(read("artists_seed.csv"));
    const map = new Map(seed.records.map((r) => [r.seedId, { slug: r.slug, birthYear: r.birthYear }]));
    const src = parseSourcesCsv(read("sources_seed.csv"));
    const res = parseRelationshipsCsv(read("relationships_seed.csv"), map, new Set(src.records.map((s) => s.seedId)));
    expect(res.issues).toEqual([]);
    expect(res.warnings).toEqual([]);
    expect(res.records.length).toBeGreaterThan(20);
    expect(res.records.every((r) => r.verificationStatus === "needs_review")).toBe(true);
  });
});

describe("parseRelationshipsCsv", () => {
  const parse = (rows: string) => parseRelationshipsCsv(HEAD + rows, artists, new Set(["s1"]));
  it("verified без источника отклоняется, с источником принимается", () => {
    expect(parse("r1,a,b,teacher_of,,,verified,,\n").issues[0]?.message).toMatch(/источник/);
    expect(parse("r1,a,b,teacher_of,,,verified,,s1\n").records).toHaveLength(1);
  });
  it("неизвестный источник, связь с самим собой, неизвестный художник", () => {
    expect(parse("r1,a,b,teacher_of,,,needs_review,,zz\n").issues).toHaveLength(1);
    expect(parse("r1,a,a,teacher_of,,,needs_review,,\n").issues[0]?.message).toMatch(/самим собой/);
    expect(parse("r1,a,x,teacher_of,,,needs_review,,\n").issues[0]?.message).toMatch(/неизвестный/);
  });
  it("дубль и симметричный дубль collaborated отклоняются", () => {
    expect(parse("r1,a,b,teacher_of,,,needs_review,,\nr2,a,b,teacher_of,,,needs_review,,\n").issues).toHaveLength(1);
    expect(parse("r1,a,b,collaborated,,,needs_review,,\nr2,b,a,collaborated,,,needs_review,,\n").issues).toHaveLength(1);
  });
  it("цикл отклоняется", () => {
    const res = parse("r1,a,b,teacher_of,,,needs_review,,\nr2,b,c,teacher_of,,,needs_review,,\nr3,c,a,teacher_of,,,needs_review,,\n");
    expect(res.issues.some((i) => /цикл/.test(i.message))).toBe(true);
  });
  it("учитель моложе ученика даёт предупреждение", () => {
    expect(parse("r1,b,a,teacher_of,,,needs_review,,\n").warnings).toHaveLength(1);
  });
});

describe("findCycle", () => {
  it("находит и не находит", () => {
    expect(findCycle([["a", "b"], ["b", "a"]])).not.toBeNull();
    expect(findCycle([["a", "b"], ["a", "c"], ["b", "c"]])).toBeNull();
  });
});

describe("parsePortraitsCsv", () => {
  const H = "artist_slug,image_url,rights_status,credit,source_url\n";
  const slugs = new Set(["ilya-repin"]);
  it("принимает только с правами, автором и источником", () => {
    expect(parsePortraitsCsv(H + "ilya-repin,/portraits/r.jpg,public_domain,Автор,https://commons.wikimedia.org/x\n", slugs).records).toHaveLength(1);
    expect(parsePortraitsCsv(H + "ilya-repin,/portraits/r.jpg,unknown,Автор,https://x.org/\n", slugs).issues).toHaveLength(1);
    expect(parsePortraitsCsv(H + "ilya-repin,/portraits/r.jpg,public_domain,,https://x.org/\n", slugs).issues).toHaveLength(1);
    expect(parsePortraitsCsv(H + "ilya-repin,javascript:alert(1),public_domain,Автор,https://x.org/\n", slugs).issues).toHaveLength(1);
  });
});
