import { parse } from "csv-parse/sync";
import { z } from "zod";
import type { SeedIssue } from "./seed";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const yearField = z.preprocess(emptyToNull, z.coerce.number().int().min(-3000).max(2100).nullable());
const textOrNull = z.preprocess(emptyToNull, z.string().trim().nullable());

function readCsv(text: string): Record<string, string>[] {
  return parse(text.replace(/^﻿/, ""), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
}

// ---------- Источники ----------

const sourceRow = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  author_or_institution: textOrNull,
  url: z.preprocess(emptyToNull, z.url().nullable()),
  publication_year: yearField,
  page: textOrNull,
  notes: textOrNull,
  source_type: z.enum(["museum", "catalogue", "scholarly", "book", "other"]).default("other"),
});

export interface SourceRecord {
  seedId: string;
  title: string;
  authorOrInstitution: string | null;
  url: string | null;
  publicationYear: number | null;
  page: string | null;
  notes: string | null;
  sourceType: "museum" | "catalogue" | "scholarly" | "book" | "other";
}

export function parseSourcesCsv(text: string): { records: SourceRecord[]; issues: SeedIssue[] } {
  const records: SourceRecord[] = [];
  const issues: SeedIssue[] = [];
  const seen = new Set<string>();
  readCsv(text).forEach((raw, i) => {
    const res = sourceRow.safeParse(raw);
    if (!res.success) {
      issues.push({ line: i + 2, id: raw.id ?? null, message: res.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
      return;
    }
    const r = res.data;
    if (seen.has(r.id)) {
      issues.push({ line: i + 2, id: r.id, message: "повторяющийся id источника" });
      return;
    }
    seen.add(r.id);
    records.push({
      seedId: r.id,
      title: r.title,
      authorOrInstitution: r.author_or_institution,
      url: r.url,
      publicationYear: r.publication_year,
      page: r.page,
      notes: r.notes,
      sourceType: r.source_type,
    });
  });
  return { records, issues };
}

// ---------- Связи ----------

const relRow = z.object({
  id: z.string().trim().min(1),
  from_seed_id: z.string().trim().min(1),
  to_seed_id: z.string().trim().min(1),
  type: z.enum(["teacher_of", "influenced", "collaborated"]),
  from_year: yearField,
  to_year: yearField,
  verification_status: z.enum(["draft", "needs_review", "verified"]),
  evidence_note: textOrNull,
  source_ids: z.string().default(""),
});

export interface RelationshipRecord {
  seedId: string;
  fromSeedId: string;
  toSeedId: string;
  type: "teacher_of" | "influenced" | "collaborated";
  fromYear: number | null;
  toYear: number | null;
  verificationStatus: "draft" | "needs_review" | "verified";
  evidenceNote: string | null;
  sourceSeedIds: string[];
}

export interface ArtistRef {
  slug: string;
  birthYear: number | null;
}

/** Находит цикл в ориентированном графе учитель→ученик / влияние. Возвращает путь или null. */
export function findCycle(edges: [string, string][]): string[] | null {
  const adj = new Map<string, string[]>();
  for (const [a, b] of edges) adj.set(a, [...(adj.get(a) ?? []), b]);
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (n: string): string[] | null => {
    state.set(n, 1);
    stack.push(n);
    for (const m of adj.get(n) ?? []) {
      if (state.get(m) === 1) return [...stack.slice(stack.indexOf(m)), m];
      if (!state.has(m)) {
        const c = visit(m);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(n, 2);
    return null;
  };
  for (const n of adj.keys()) if (!state.has(n)) {
    const c = visit(n);
    if (c) return c;
  }
  return null;
}

export interface ParsedRelationships {
  records: RelationshipRecord[];
  issues: SeedIssue[];
  warnings: SeedIssue[];
}

/**
 * Проверки: художники существуют; не связь с самим собой; нет дублей;
 * verified требует источника; источники существуют; нет циклов; учитель не моложе ученика (предупреждение).
 * Связи не выводятся из совпадения дат.
 */
export function parseRelationshipsCsv(
  text: string,
  artists: Map<string, ArtistRef>,
  sourceIds: Set<string>,
): ParsedRelationships {
  const records: RelationshipRecord[] = [];
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];
  const seenId = new Set<string>();
  const seenPair = new Set<string>();

  readCsv(text).forEach((raw, i) => {
    const line = i + 2;
    const fail = (message: string) => issues.push({ line, id: raw.id ?? null, message });
    const res = relRow.safeParse(raw);
    if (!res.success) return fail(res.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "));
    const r = res.data;
    if (seenId.has(r.id)) return fail("повторяющийся id связи");
    const a = artists.get(r.from_seed_id);
    const b = artists.get(r.to_seed_id);
    if (!a) return fail(`неизвестный художник from: ${r.from_seed_id}`);
    if (!b) return fail(`неизвестный художник to: ${r.to_seed_id}`);
    if (r.from_seed_id === r.to_seed_id) return fail("связь художника с самим собой");
    const srcs = r.source_ids.split(";").map((s) => s.trim()).filter(Boolean);
    const missing = srcs.filter((s) => !sourceIds.has(s));
    if (missing.length) return fail(`неизвестные источники: ${missing.join(", ")}`);
    if (r.verification_status === "verified" && srcs.length === 0) return fail("verified требует хотя бы один источник");
    if (r.from_year !== null && r.to_year !== null && r.from_year > r.to_year) return fail("from_year позже to_year");

    // collaborated симметрична: канонический порядок, чтобы не было дублей A–B и B–A
    let from = r.from_seed_id;
    let to = r.to_seed_id;
    if (r.type === "collaborated" && a.slug > b.slug) [from, to] = [to, from];
    const key = `${r.type}|${from}|${to}`;
    if (seenPair.has(key)) return fail("повторяющаяся связь");
    seenPair.add(key);
    seenId.add(r.id);

    if (r.type === "teacher_of" && a.birthYear !== null && b.birthYear !== null && a.birthYear >= b.birthYear) {
      warnings.push({ line, id: r.id, message: `учитель (${a.slug}, ${a.birthYear}) не старше ученика (${b.slug}, ${b.birthYear})` });
    }

    records.push({
      seedId: r.id,
      fromSeedId: from,
      toSeedId: to,
      type: r.type,
      fromYear: r.from_year,
      toYear: r.to_year,
      verificationStatus: r.verification_status,
      evidenceNote: r.evidence_note,
      sourceSeedIds: srcs,
    });
  });

  const directed = records.filter((r) => r.type !== "collaborated").map((r) => [r.fromSeedId, r.toSeedId] as [string, string]);
  const cycle = findCycle(directed);
  if (cycle) {
    issues.push({ line: 0, id: null, message: `цикл в связях учитель/влияние: ${cycle.join(" → ")}` });
  }
  return { records, issues, warnings };
}

// ---------- Портреты ----------

const portraitRow = z.object({
  artist_slug: z.string().trim().min(1),
  image_url: z.string().trim().refine((u) => /^https?:\/\//.test(u) || u.startsWith("/"), "нужен http(s)-адрес или путь, начинающийся с /"),
  rights_status: z.enum(["public_domain", "licensed"]),
  credit: z.string().trim().min(1, "укажите автора/правообладателя"),
  source_url: z.url("укажите ссылку на источник изображения"),
});

export interface PortraitRecord {
  slug: string;
  url: string;
  rights: "public_domain" | "licensed";
  credit: string;
  sourceUrl: string;
}

/** Портрет принимается только с подтверждёнными правами, автором и источником. */
export function parsePortraitsCsv(text: string, slugs: Set<string>): { records: PortraitRecord[]; issues: SeedIssue[] } {
  const records: PortraitRecord[] = [];
  const issues: SeedIssue[] = [];
  readCsv(text).forEach((raw, i) => {
    const res = portraitRow.safeParse(raw);
    if (!res.success) {
      issues.push({ line: i + 2, id: raw.artist_slug ?? null, message: res.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ") });
      return;
    }
    const r = res.data;
    if (!slugs.has(r.artist_slug)) {
      issues.push({ line: i + 2, id: r.artist_slug, message: "неизвестный художник" });
      return;
    }
    records.push({ slug: r.artist_slug, url: r.image_url, rights: r.rights_status, credit: r.credit, sourceUrl: r.source_url });
  });
  return { records, issues };
}
