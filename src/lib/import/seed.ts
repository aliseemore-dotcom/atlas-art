import { parse } from "csv-parse/sync";
import { z } from "zod";
import { canonicalLabel, normalizeText, slugify } from "@/lib/text";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const yearField = z.preprocess(emptyToNull, z.coerce.number().int().min(-3000).max(2100).nullable());

export const seedRowSchema = z
  .object({
    id: z.string().trim().min(1),
    name_ru: z.string().trim().min(1),
    birth_year: yearField,
    death_year: yearField,
    era_label: z.string().trim().default(""),
    movement_labels: z.string().default(""),
    genre_labels: z.string().default(""),
    date_precision: z.enum(["exact", "circa", "range", "unknown"]),
    verification_status: z.enum(["draft", "needs_review", "verified"]),
    importance: z.enum(["core", "extended"]),
  })
  .superRefine((row, ctx) => {
    if (row.birth_year !== null && row.death_year !== null && row.birth_year > row.death_year) {
      ctx.addIssue({ code: "custom", message: "birth_year позже death_year", path: ["birth_year"] });
    }
  });

export type SeedRow = z.infer<typeof seedRowSchema>;

export interface ArtistRecord {
  seedId: string;
  slug: string;
  nameRu: string;
  nameSearch: string;
  birthYear: number | null;
  deathYear: number | null;
  birthPrecision: "exact" | "circa" | "range" | "unknown";
  deathPrecision: "exact" | "circa" | "range" | "unknown";
  eraLabel: string | null;
  verificationStatus: "draft" | "needs_review" | "verified";
  importance: "core" | "extended";
  movements: string[]; // канонические ярлыки
  genres: string[];
}

export interface SeedIssue {
  line: number; // номер строки в файле (с заголовком = 1)
  id: string | null;
  message: string;
}

export interface ParsedSeed {
  records: ArtistRecord[];
  issues: SeedIssue[];
}

export function splitLabels(value: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of value.split(",")) {
    const label = canonicalLabel(raw);
    if (!label) continue;
    const key = normalizeText(label);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(label);
  }
  return out;
}

/** CSV -> валидированные записи. Некорректные строки не импортируются, а попадают в журнал. */
export function parseSeedCsv(text: string): ParsedSeed {
  const rows = parse(text.replace(/^﻿/, ""), {
    columns: true,
    skip_empty_lines: true,
    trim: false,
  }) as Record<string, string>[];

  const records: ArtistRecord[] = [];
  const issues: SeedIssue[] = [];
  const seenIds = new Set<string>();
  const slugs = new Set<string>();

  rows.forEach((raw, i) => {
    const line = i + 2;
    const res = seedRowSchema.safeParse(raw);
    if (!res.success) {
      issues.push({
        line,
        id: raw.id ?? null,
        message: res.error.issues.map((e) => `${e.path.join(".") || "row"}: ${e.message}`).join("; "),
      });
      return;
    }
    const row = res.data;
    if (seenIds.has(row.id)) {
      issues.push({ line, id: row.id, message: "повторяющийся id" });
      return;
    }
    seenIds.add(row.id);

    let slug = slugify(row.name_ru);
    if (slugs.has(slug)) {
      let n = 2;
      while (slugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
    }
    slugs.add(slug);

    // Точность относится к известным годам; отсутствующий год всегда unknown.
    const precisionFor = (year: number | null) => (year === null ? "unknown" : row.date_precision);

    records.push({
      seedId: row.id,
      slug,
      nameRu: row.name_ru,
      nameSearch: normalizeText(row.name_ru),
      birthYear: row.birth_year,
      deathYear: row.death_year,
      birthPrecision: precisionFor(row.birth_year),
      deathPrecision: precisionFor(row.death_year),
      eraLabel: row.era_label || null,
      verificationStatus: row.verification_status,
      importance: row.importance,
      movements: splitLabels(row.movement_labels),
      genres: splitLabels(row.genre_labels),
    });
  });

  return { records, issues };
}
