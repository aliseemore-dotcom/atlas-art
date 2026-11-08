import { parse } from "csv-parse/sync";
import { z } from "zod";
import { slugify } from "@/lib/text";
import type { SeedIssue } from "./seed";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const yearField = z.preprocess(emptyToNull, z.coerce.number().int().min(-3000).max(2100).nullable());
const textOrNull = z.preprocess(emptyToNull, z.string().trim().nullable());
const status = z.enum(["draft", "needs_review", "verified"]);
const precision = z.preprocess((v) => (v === "" || v === undefined ? "unknown" : v), z.enum(["exact", "circa", "range", "unknown"]));

const read = (text: string) => parse(text.replace(/^﻿/, ""), { columns: true, skip_empty_lines: true }) as Record<string, string>[];
const fmt = (e: z.ZodError) => e.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`).join("; ");

export interface Ctx {
  /** slug -> {birth, death} */
  artists: Map<string, { birthYear: number | null; deathYear: number | null }>;
  sourceIds: Set<string>;
}
export interface Parsed<T> {
  records: T[];
  issues: SeedIssue[];
  warnings: SeedIssue[];
}

function run<T>(text: string, handle: (raw: Record<string, string>, line: number, fail: (m: string) => null, warn: (m: string) => void) => T | null): Parsed<T> {
  const records: T[] = [];
  const issues: SeedIssue[] = [];
  const warnings: SeedIssue[] = [];
  read(text).forEach((raw, i) => {
    const line = i + 2;
    const id = raw.id ?? raw.artist_slug ?? null;
    const rec = handle(
      raw,
      line,
      (message) => {
        issues.push({ line, id, message });
        return null;
      },
      (message) => warnings.push({ line, id, message }),
    );
    if (rec) records.push(rec);
  });
  return { records, issues, warnings };
}

// ---------- краткая сводка ----------
export const SUMMARY_MAX = 700;
const summaryRow = z.object({
  artist_slug: z.string().trim().min(1),
  summary: z.string().trim().min(20, "сводка слишком короткая").max(SUMMARY_MAX, `сводка длиннее ${SUMMARY_MAX} знаков`),
  source_id: z.string().trim().min(1, "источник обязателен"),
});
export interface SummaryRecord { artistSlug: string; summary: string; sourceSeedId: string }
export function parseSummariesCsv(text: string, ctx: Ctx): Parsed<SummaryRecord> {
  const seen = new Set<string>();
  return run(text, (raw, _l, fail) => {
    const r = summaryRow.safeParse(raw);
    if (!r.success) return fail(fmt(r.error));
    const d = r.data;
    if (!ctx.artists.has(d.artist_slug)) return fail("неизвестный художник");
    if (!ctx.sourceIds.has(d.source_id)) return fail(`неизвестный источник: ${d.source_id}`);
    if (seen.has(d.artist_slug)) return fail("у художника уже есть сводка");
    seen.add(d.artist_slug);
    return { artistSlug: d.artist_slug, summary: d.summary, sourceSeedId: d.source_id };
  });
}

// ---------- интересные факты ----------
export const FACT_MAX = 400;
const factRow = z.object({
  id: z.string().trim().min(1),
  artist_slug: z.string().trim().min(1),
  text: z.string().trim().min(10, "факт слишком короткий").max(FACT_MAX, `факт длиннее ${FACT_MAX} знаков`),
  source_id: z.string().trim().min(1, "источник обязателен"),
  sort_order: z.preprocess(emptyToNull, z.coerce.number().int().nullable()),
});
export interface FactRecord { seedId: string; artistSlug: string; text: string; sourceSeedId: string; sortOrder: number }
export function parseFactsCsv(text: string, ctx: Ctx): Parsed<FactRecord> {
  const seen = new Set<string>();
  let n = 0;
  return run(text, (raw, _l, fail) => {
    const r = factRow.safeParse(raw);
    if (!r.success) return fail(fmt(r.error));
    const d = r.data;
    if (seen.has(d.id)) return fail("повторяющийся id");
    if (!ctx.artists.has(d.artist_slug)) return fail("неизвестный художник");
    if (!ctx.sourceIds.has(d.source_id)) return fail(`неизвестный источник: ${d.source_id}`);
    seen.add(d.id);
    return { seedId: d.id, artistSlug: d.artist_slug, text: d.text, sourceSeedId: d.source_id, sortOrder: d.sort_order ?? n++ };
  });
}

// ---------- картины ----------
const artworkRow = z.object({
  id: z.string().trim().min(1),
  artist_slugs: z.string().trim().min(1, "укажите художника"),
  title_ru: z.string().trim().min(1),
  year_from: yearField,
  year_to: yearField,
  year_precision: precision,
  medium: textOrNull,
  collection: textOrNull,
  image_url: z.preprocess(emptyToNull, z.string().trim().refine((u) => /^https?:\/\//.test(u) || u.startsWith("/"), "нужен http(s)-адрес или путь, начинающийся с /").nullable()),
  image_rights: z.preprocess((v) => (v === "" || v === undefined ? "unknown" : v), z.enum(["unknown", "public_domain", "licensed"])),
  image_credit: textOrNull,
  image_source_url: z.preprocess(emptyToNull, z.url().nullable()),
  verification_status: status,
  source_id: textOrNull,
  sort_order: z.preprocess(emptyToNull, z.coerce.number().int().nullable()),
});
export interface ArtworkRecord {
  seedId: string;
  slug: string;
  artistSlugs: string[];
  titleRu: string;
  yearFrom: number | null;
  yearTo: number | null;
  yearPrecision: "exact" | "circa" | "range" | "unknown";
  medium: string | null;
  currentCollection: string | null;
  imageUrl: string | null;
  imageRights: "unknown" | "public_domain" | "licensed";
  imageCredit: string | null;
  imageSourceUrl: string | null;
  verificationStatus: "draft" | "needs_review" | "verified";
  sourceSeedId: string | null;
  sortOrder: number;
}
/**
 * Изображение принимается только с правами public_domain/licensed, автором и ссылкой на источник;
 * иначе строка отклоняется (картина без изображения вносится без image_*). verified требует источник.
 */
export function parseArtworksCsv(text: string, ctx: Ctx): Parsed<ArtworkRecord> {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  let n = 0;
  return run(text, (raw, _l, fail, warn) => {
    const r = artworkRow.safeParse(raw);
    if (!r.success) return fail(fmt(r.error));
    const d = r.data;
    if (ids.has(d.id)) return fail("повторяющийся id");
    const artistSlugs = d.artist_slugs.split(";").map((s) => s.trim()).filter(Boolean);
    const unknown = artistSlugs.filter((s) => !ctx.artists.has(s));
    if (unknown.length) return fail(`неизвестные художники: ${unknown.join(", ")}`);
    if (d.source_id && !ctx.sourceIds.has(d.source_id)) return fail(`неизвестный источник: ${d.source_id}`);
    if (d.verification_status === "verified" && !d.source_id) return fail("verified требует источник");
    if (d.year_from !== null && d.year_to !== null && d.year_from > d.year_to) return fail("year_from позже year_to");
    if (d.image_url) {
      if (d.image_rights === "unknown") return fail("у изображения не подтверждены права (image_rights): не публикуем");
      if (!d.image_credit) return fail("у изображения не указан автор/правообладатель (image_credit)");
      if (!d.image_source_url) return fail("у изображения не указан источник (image_source_url)");
    }
    // картина не может быть написана до рождения автора или сильно после смерти (предупреждение: даты могут быть спорными)
    const y = d.year_from ?? d.year_to;
    for (const s of artistSlugs) {
      const a = ctx.artists.get(s);
      if (y !== null && a?.birthYear != null && y < a.birthYear) warn(`год картины (${y}) раньше рождения автора ${s} (${a.birthYear})`);
      if (y !== null && a?.deathYear != null && y > a.deathYear) warn(`год картины (${y}) позже смерти автора ${s} (${a.deathYear})`);
    }
    ids.add(d.id);
    let slug = slugify(d.title_ru);
    if (slugs.has(slug)) slug = `${slug}-${slugify(artistSlugs[0] as string)}`;
    for (let k = 2; slugs.has(slug); k++) slug = `${slug.replace(/-\d+$/, "")}-${k}`;
    slugs.add(slug);
    return {
      seedId: d.id,
      slug,
      artistSlugs,
      titleRu: d.title_ru,
      yearFrom: d.year_from,
      yearTo: d.year_to,
      yearPrecision: d.year_precision,
      medium: d.medium,
      currentCollection: d.collection,
      imageUrl: d.image_url,
      imageRights: d.image_rights,
      imageCredit: d.image_credit,
      imageSourceUrl: d.image_source_url,
      verificationStatus: d.verification_status,
      sourceSeedId: d.source_id,
      sortOrder: d.sort_order ?? n++,
    };
  });
}

// ---------- объединения и участие ----------
const groupRow = z.object({
  id: z.string().trim().min(1),
  name_ru: z.string().trim().min(1),
  type: z.enum(["artist_collective", "association", "school", "workshop"]),
  from_year: yearField,
  to_year: yearField,
  description: textOrNull,
  verification_status: status,
});
export interface GroupRecord {
  seedId: string;
  slug: string;
  nameRu: string;
  type: "artist_collective" | "association" | "school" | "workshop";
  fromYear: number | null;
  toYear: number | null;
  description: string | null;
  verificationStatus: "draft" | "needs_review" | "verified";
}
export function parseGroupsCsv(text: string): Parsed<GroupRecord> {
  const ids = new Set<string>();
  const slugs = new Set<string>();
  return run(text, (raw, _l, fail) => {
    const r = groupRow.safeParse(raw);
    if (!r.success) return fail(fmt(r.error));
    const d = r.data;
    if (ids.has(d.id)) return fail("повторяющийся id");
    if (d.from_year !== null && d.to_year !== null && d.from_year > d.to_year) return fail("from_year позже to_year");
    const slug = slugify(d.name_ru);
    if (slugs.has(slug)) return fail("объединение с таким названием уже есть");
    ids.add(d.id);
    slugs.add(slug);
    return { seedId: d.id, slug, nameRu: d.name_ru, type: d.type, fromYear: d.from_year, toYear: d.to_year, description: d.description, verificationStatus: d.verification_status };
  });
}

const membershipRow = z.object({
  artist_slug: z.string().trim().min(1),
  group_slug: z.string().trim().min(1),
  from_year: yearField,
  to_year: yearField,
  verification_status: status,
  source_id: textOrNull,
});
export interface MembershipRecord {
  artistSlug: string;
  groupSlug: string;
  fromYear: number | null;
  toYear: number | null;
  verificationStatus: "draft" | "needs_review" | "verified";
  sourceSeedId: string | null;
}
/** Участие: verified требует источник; группа и художник должны существовать; годы участия в разумных пределах. */
export function parseMembershipsCsv(text: string, ctx: Ctx, groups: Map<string, { fromYear: number | null; toYear: number | null }>): Parsed<MembershipRecord> {
  const seen = new Set<string>();
  return run(text, (raw, _l, fail, warn) => {
    const r = membershipRow.safeParse(raw);
    if (!r.success) return fail(fmt(r.error));
    const d = r.data;
    if (!ctx.artists.has(d.artist_slug)) return fail("неизвестный художник");
    const g = groups.get(d.group_slug);
    if (!g) return fail(`неизвестное объединение: ${d.group_slug}`);
    if (d.source_id && !ctx.sourceIds.has(d.source_id)) return fail(`неизвестный источник: ${d.source_id}`);
    if (d.verification_status === "verified" && !d.source_id) return fail("verified требует источник");
    if (d.from_year !== null && d.to_year !== null && d.from_year > d.to_year) return fail("from_year позже to_year");
    const key = `${d.artist_slug}|${d.group_slug}`;
    if (seen.has(key)) return fail("повторяющееся участие");
    seen.add(key);
    if (d.from_year !== null && g.toYear !== null && d.from_year > g.toYear) warn(`участие начинается (${d.from_year}) после распада объединения (${g.toYear})`);
    if (d.to_year !== null && g.fromYear !== null && d.to_year < g.fromYear) warn(`участие заканчивается (${d.to_year}) до основания объединения (${g.fromYear})`);
    return { artistSlug: d.artist_slug, groupSlug: d.group_slug, fromYear: d.from_year, toYear: d.to_year, verificationStatus: d.verification_status, sourceSeedId: d.source_id };
  });
}
