import { scaleLinear, type ScaleLinear } from "d3-scale";
import { toRoman } from "@/lib/text";

export interface ZoomTransform {
  k: number;
  x: number;
}

export const IDENTITY: ZoomTransform = { k: 1, x: 0 };

/** Базовая линейная шкала: год -> пиксель X. Позиция зависит от года, а не от порядка в списке. */
export function createYearScale(domain: [number, number], width: number): ScaleLinear<number, number> {
  return scaleLinear().domain(domain).range([0, width]);
}

/** Шкала с учётом масштабирования/сдвига (как в d3-zoom: x' = k*x + tx). */
export function zoomedScale(
  domain: [number, number],
  width: number,
  t: ZoomTransform,
): ScaleLinear<number, number> {
  const [d0, d1] = domain;
  const inv = (px: number) => d0 + ((px - t.x) / t.k / width) * (d1 - d0);
  return scaleLinear()
    .domain([inv(0), inv(width)])
    .range([0, width]);
}

export function yearToX(year: number, domain: [number, number], width: number, t: ZoomTransform = IDENTITY): number {
  return zoomedScale(domain, width, t)(year);
}

export type TickKind = "century" | "decade" | "year";
export interface Tick {
  year: number;
  kind: TickKind;
}

/** Метки оси: при отдалении — века, при приближении — десятилетия, ещё ближе — годы. */
export function ticksFor(visible: [number, number]): Tick[] {
  const [a, b] = visible;
  const span = Math.abs(b - a);
  const step = span > 240 ? 100 : span > 60 ? 10 : 1;
  const kind: TickKind = step === 100 ? "century" : step === 10 ? "decade" : "year";
  const first = Math.ceil(Math.min(a, b) / step) * step;
  const out: Tick[] = [];
  for (let y = first; y <= Math.max(a, b); y += step) out.push({ year: y, kind });
  return out;
}

/** Век, в который входит год (1900 -> «XIX в.», 1901 -> «XX в.»). */
export function centuryLabel(year: number): string {
  const c = Math.floor((year - 1) / 100) + 1;
  return `${toRoman(c)} в.`;
}
