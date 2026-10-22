import type { DatePrecision } from "@/lib/timeline/interval";

/** Данные художника, нужные для расчёта исторического положения. */
export interface AnchorInput {
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  eraLabel: string | null;
  birthPrecision?: DatePrecision;
  deathPrecision?: DatePrecision;
}

export interface Anchor {
  /** год, по которому художник размещается на вертикали; null — оценить нечем */
  year: number | null;
  /** положение оценено косвенно (нет года рождения или нет дат вовсе); показывается пунктирной рамкой */
  approx: boolean;
}

const START_AGE = 20; // начало творческой деятельности, если период не задан
const DEFAULT_SPAN = 40;
const PEAK_OFFSET = 25;

/**
 * Исторический «якорь» художника — год, около которого он активно работал.
 * Только для раскладки; в интерфейс не выводится и в базу не пишется.
 * Период активности (activeFrom/activeTo) имеет приоритет; без него берутся годы жизни.
 */
export function estimateAnchor(a: AnchorInput): Anchor {
  let start: number | null = a.activeFrom;
  let approx = false;
  if (start === null) {
    if (a.birthYear !== null) start = a.birthYear + START_AGE;
    else if (a.deathYear !== null) {
      start = a.deathYear - 45;
      approx = true;
    }
  }
  if (start === null) return { year: null, approx: true };
  const end = a.activeTo ?? a.deathYear ?? start + DEFAULT_SPAN;
  const span = Math.max(0, end - start);
  return { year: Math.round(start + Math.min(PEAK_OFFSET, span / 2)), approx };
}

function median(xs: number[]): number {
  const s = [...xs].sort((p, q) => p - q);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] as number) : Math.round(((s[m - 1] as number) + (s[m] as number)) / 2);
}

/**
 * Размещение художников без дат: по медиане якорей тех, у кого есть тот же ярлык эпохи (eraLabel из базы).
 * Дат не придумывается: положение помечено как приблизительное. Без ярлыка или без датированных «соседей» — null.
 */
export function resolveAnchors<T extends AnchorInput & { id: string }>(artists: T[]): Map<string, Anchor> {
  const own = new Map(artists.map((a) => [a.id, estimateAnchor(a)]));
  const byEra = new Map<string, number[]>();
  for (const a of artists) {
    const y = own.get(a.id)?.year;
    if (y != null && a.eraLabel) byEra.set(a.eraLabel, [...(byEra.get(a.eraLabel) ?? []), y]);
  }
  const out = new Map<string, Anchor>();
  for (const a of artists) {
    const mine = own.get(a.id) as Anchor;
    if (mine.year !== null) out.set(a.id, mine);
    else {
      const peers = a.eraLabel ? byEra.get(a.eraLabel) : undefined;
      out.set(a.id, peers?.length ? { year: median(peers), approx: true } : { year: null, approx: true });
    }
  }
  return out;
}

/** Подпись лет: «1844–1930», «ок. 1535–1599», «р. 1949» (год смерти не указан), «даты неизвестны». */
export function formatYears(a: Pick<AnchorInput, "birthYear" | "deathYear" | "birthPrecision" | "deathPrecision">): string {
  const y = (n: number, p?: DatePrecision) => (p === "circa" ? `ок. ${n}` : String(n));
  if (a.birthYear !== null && a.deathYear !== null) {
    // «ок. 1360–1430», если приблизительны обе даты: короче и читается так же
    if (a.birthPrecision === "circa" && a.deathPrecision === "circa") return `ок. ${a.birthYear}–${a.deathYear}`;
    return `${y(a.birthYear, a.birthPrecision)}–${y(a.deathYear, a.deathPrecision)}`;
  }
  if (a.birthYear !== null) return `р. ${y(a.birthYear, a.birthPrecision)}`;
  if (a.deathYear !== null) return `ум. ${y(a.deathYear, a.deathPrecision)}`;
  return "даты неизвестны";
}
