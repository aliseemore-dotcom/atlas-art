export type DatePrecision = "exact" | "circa" | "range" | "unknown";

export interface DatedArtist {
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  birthPrecision: DatePrecision;
  deathPrecision: DatePrecision;
}

export type TimelineMode = "life" | "active";

/** Интервал на оси: null на краю = неизвестно (не 0 и не выдуманная дата). */
export interface Interval {
  start: number | null;
  end: number | null;
}

/**
 * Интервал художника. life — годы жизни; active — период работы
 * (при его отсутствии берутся годы жизни). Даты смерти и окончания работы — разные значения.
 */
export function intervalFor(a: DatedArtist, mode: TimelineMode = "life"): Interval {
  if (mode === "active") {
    return {
      start: a.activeFrom ?? a.birthYear,
      end: a.activeTo ?? a.deathYear,
    };
  }
  return { start: a.birthYear, end: a.deathYear };
}

/**
 * yes     — оба края известны и интервалы пересекаются;
 * maybe   — часть дат неизвестна, но пересечение не исключено (не показывать как установленный факт);
 * no      — пересечения нет;
 * unknown — дат нет совсем, судить нельзя.
 */
export type Overlap = "yes" | "maybe" | "no" | "unknown";

export function overlapWithRange(iv: Interval, from: number, to: number): Overlap {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const { start, end } = iv;
  if (start === null && end === null) return "unknown";
  if (start !== null && start > hi) return "no";
  if (end !== null && end < lo) return "no";
  if (start !== null && end !== null) return "yes";
  return "maybe";
}

/** Совпадение лет жизни — не знакомство и не влияние; возвращает true только при известных обоих интервалах. */
export function isContemporary(a: Interval, b: Interval): boolean {
  if (a.start === null || a.end === null || b.start === null || b.end === null) return false;
  return a.start <= b.end && b.start <= a.end;
}

export function formatYear(year: number | null, precision: DatePrecision): string {
  if (year === null) return "неизвестно";
  return precision === "circa" ? `ок. ${year}` : String(year);
}

/** "1860–1930", "1949 – н. в. / дата смерти неизвестна", "даты неизвестны". */
export function formatLifespan(a: DatedArtist): string {
  const { birthYear: b, deathYear: d } = a;
  if (b === null && d === null) return "даты неизвестны";
  const left = b === null ? "?" : formatYear(b, a.birthPrecision);
  const right = d === null ? "?" : formatYear(d, a.deathPrecision);
  return `${left} – ${right}`;
}
