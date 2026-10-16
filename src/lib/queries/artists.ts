import type { Prisma } from "@prisma/client";
import type { Filters } from "@/lib/filters";
import { prisma } from "@/lib/db";
import { queryTokens } from "@/lib/text";
import {
  intervalFor,
  isContemporary,
  overlapWithRange,
  type DatedArtist,
  type Overlap,
} from "@/lib/timeline/interval";

const PAGE_SIZE = 50;

const listSelect = {
  id: true,
  slug: true,
  nameRu: true,
  birthYear: true,
  deathYear: true,
  activeFrom: true,
  activeTo: true,
  birthPrecision: true,
  deathPrecision: true,
  eraLabel: true,
  verificationStatus: true,
  importance: true,
  movements: { select: { movement: { select: { slug: true, nameRu: true } } } },
  genres: { select: { genre: { select: { slug: true, nameRu: true } } } },
} satisfies Prisma.ArtistSelect;

export type ArtistRow = Prisma.ArtistGetPayload<{ select: typeof listSelect }>;

export interface ArtistListItem {
  id: string;
  slug: string;
  nameRu: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  birthPrecision: DatedArtist["birthPrecision"];
  deathPrecision: DatedArtist["deathPrecision"];
  eraLabel: string | null;
  verificationStatus: ArtistRow["verificationStatus"];
  movements: { slug: string; nameRu: string }[];
  genres: { slug: string; nameRu: string }[];
  start: number | null;
  end: number | null;
  overlap: Overlap | null; // null — диапазон не задан
}

function baseWhere(regionSlug: string, f: Filters): Prisma.ArtistWhereInput {
  const and: Prisma.ArtistWhereInput[] = [{ regions: { some: { region: { slug: regionSlug } } } }];
  for (const token of queryTokens(f.q ?? "")) and.push({ nameSearch: { contains: token } });
  if (f.genre) and.push({ genres: { some: { genre: { slug: f.genre } } } });
  if (f.movement) and.push({ movements: { some: { movement: { slug: f.movement } } } });
  return { AND: and };
}

function toItem(row: ArtistRow, f: Filters): ArtistListItem {
  const iv = intervalFor(row, f.mode);
  const hasRange = f.from !== undefined || f.to !== undefined;
  const from = f.from ?? f.to ?? 0;
  const to = f.to ?? f.from ?? 0;
  return {
    id: row.id,
    slug: row.slug,
    nameRu: row.nameRu,
    birthYear: row.birthYear,
    deathYear: row.deathYear,
    activeFrom: row.activeFrom,
    activeTo: row.activeTo,
    birthPrecision: row.birthPrecision,
    deathPrecision: row.deathPrecision,
    eraLabel: row.eraLabel,
    verificationStatus: row.verificationStatus,
    movements: row.movements.map((m) => m.movement),
    genres: row.genres.map((g) => g.genre),
    start: iv.start,
    end: iv.end,
    overlap: hasRange ? overlapWithRange(iv, from, to) : null,
  };
}

const byStart = (a: ArtistListItem, b: ArtistListItem) => {
  // известные даты по порядку, без дат — в конце; при равенстве — по имени
  if (a.start === null && b.start === null) return a.nameRu.localeCompare(b.nameRu, "ru");
  if (a.start === null) return 1;
  if (b.start === null) return -1;
  return a.start - b.start || a.nameRu.localeCompare(b.nameRu, "ru");
};

export interface ArtistQueryResult {
  items: ArtistListItem[];
  /** без дат — не участвуют в фильтре по диапазону */
  excludedUndated: number;
  total: number;
}

/** Все художники региона, подходящие под фильтры (без пагинации): для оси. Фильтрация выполняется на сервере. */
export async function queryArtists(regionSlug: string, f: Filters): Promise<ArtistQueryResult> {
  const rows = await prisma.artist.findMany({ where: baseWhere(regionSlug, f), select: listSelect });
  const hasRange = f.from !== undefined || f.to !== undefined;
  let items = rows.map((r) => toItem(r, f));
  let excludedUndated = 0;
  if (hasRange) {
    excludedUndated = items.filter((i) => i.overlap === "unknown").length;
    items = items.filter((i) => i.overlap === "yes" || i.overlap === "maybe");
  }
  items.sort(byStart);
  return { items, excludedUndated, total: items.length };
}

export async function listArtistsPage(regionSlug: string, f: Filters) {
  const all = await queryArtists(regionSlug, f);
  const pageCount = Math.max(1, Math.ceil(all.total / PAGE_SIZE));
  const page = Math.min(f.page, pageCount);
  return {
    items: all.items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: all.total,
    page,
    pageCount,
    pageSize: PAGE_SIZE,
    excludedUndated: all.excludedUndated,
  };
}

export async function getFilterOptions(regionSlug: string) {
  const where = { artists: { some: { artist: { regions: { some: { region: { slug: regionSlug } } } } } } };
  const [genres, movements] = await Promise.all([
    prisma.genre.findMany({ where, orderBy: { nameRu: "asc" }, select: { slug: true, nameRu: true } }),
    prisma.movement.findMany({ where, orderBy: { nameRu: "asc" }, select: { slug: true, nameRu: true } }),
  ]);
  return { genres, movements };
}

export async function getRegion(slug: string) {
  return prisma.region.findUnique({ where: { slug } });
}

export async function listRegions() {
  return prisma.region.findMany({
    orderBy: { nameRu: "asc" },
    select: { slug: true, nameRu: true, _count: { select: { artists: true } } },
  });
}

export async function getArtistBySlug(slug: string) {
  return prisma.artist.findUnique({
    where: { slug },
    include: {
      movements: { include: { movement: true } },
      genres: { include: { genre: true } },
      regions: { include: { region: true } },
    },
  });
}

/** Современники вычисляются, а не хранятся; совпадение лет не означает знакомства. */
export async function getContemporaries(artist: DatedArtist & { id: string }) {
  const iv = intervalFor(artist, "life");
  if (iv.start === null || iv.end === null) return [];
  const rows = await prisma.artist.findMany({
    where: { id: { not: artist.id }, birthYear: { lte: iv.end }, deathYear: { gte: iv.start } },
    select: { slug: true, nameRu: true, birthYear: true, deathYear: true, birthPrecision: true, deathPrecision: true, activeFrom: true, activeTo: true },
    orderBy: { birthYear: "asc" },
  });
  return rows.filter((r) => isContemporary(iv, intervalFor(r, "life")));
}
