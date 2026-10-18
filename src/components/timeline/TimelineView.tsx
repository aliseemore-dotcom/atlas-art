"use client";

import { select } from "d3-selection";
import { zoom, zoomIdentity, type ZoomBehavior } from "d3-zoom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { centuryLabel, IDENTITY, ticksFor, zoomedScale, type ZoomTransform } from "@/lib/timeline/scale";
import { formatLifespan, type DatePrecision } from "@/lib/timeline/interval";

export interface TimelineItem {
  slug: string;
  nameRu: string;
  start: number | null;
  end: number | null;
  birthPrecision: DatePrecision;
  deathPrecision: DatePrecision;
  overlap: "yes" | "maybe" | "no" | "unknown" | null;
}

const ROW = 26;
const AXIS = 44;
const OPEN_EDGE_PX = 48; // длина «плавного» края для неизвестной даты

/** Домен оси: по данным, с запасом, округлённый до 50 лет. */
export function domainFor(items: TimelineItem[]): [number, number] {
  const years = items.flatMap((i) => [i.start, i.end]).filter((y): y is number => y !== null);
  if (years.length === 0) return [1300, 2030];
  const lo = Math.floor((Math.min(...years) - 20) / 50) * 50;
  const hi = Math.max(2030, Math.ceil((Math.max(...years) + 10) / 50) * 50);
  return [lo, hi];
}

export function TimelineView({
  items,
  focusRange,
}: {
  items: TimelineItem[];
  focusRange?: [number, number] | null;
}) {
  const dated = useMemo(() => items.filter((i) => i.start !== null || i.end !== null), [items]);
  const undated = useMemo(() => items.filter((i) => i.start === null && i.end === null), [items]);
  const domain = useMemo(() => domainFor(dated), [dated]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const [width, setWidth] = useState(0);
  const [t, setT] = useState<ZoomTransform>(IDENTITY);

  const height = AXIS + Math.max(1, dated.length) * ROW + 8;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.max(320, Math.floor(el.clientWidth))));
    ro.observe(el);
    setWidth(Math.max(320, Math.floor(el.clientWidth)));
    return () => ro.disconnect();
  }, []);

  const focusTransform = useCallback(
    (w: number): ZoomTransform => {
      if (!focusRange) return IDENTITY;
      const [a, b] = focusRange;
      const lo = Math.min(a, b) - 10;
      const hi = Math.max(a, b) + 10;
      const [d0, d1] = domain;
      const k = Math.min(40, Math.max(1, (d1 - d0) / (hi - lo)));
      const px = ((lo - d0) / (d1 - d0)) * w;
      return { k, x: -k * px };
    },
    [focusRange, domain],
  );

  useEffect(() => {
    if (!svgRef.current || width === 0) return;
    const svg = select(svgRef.current);
    const z = zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 40])
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]])
      // колесо без Ctrl прокручивает страницу; перетаскивание и жесты работают всегда
      .filter((e: Event) => {
        const ev = e as WheelEvent & MouseEvent;
        if (e.type === "wheel") return ev.ctrlKey || ev.metaKey;
        return !ev.button;
      })
      .on("zoom", (e) => setT({ k: e.transform.k, x: e.transform.x }));
    zoomRef.current = z;
    svg.call(z);
    const init = focusTransform(width);
    svg.call(z.transform, zoomIdentity.translate(init.x, 0).scale(init.k));
    return () => {
      svg.on(".zoom", null);
    };
  }, [width, height, focusTransform]);

  const act = (fn: (z: ZoomBehavior<SVGSVGElement, unknown>, s: ReturnType<typeof select<SVGSVGElement, unknown>>) => void) => {
    if (!svgRef.current || !zoomRef.current) return;
    fn(zoomRef.current, select(svgRef.current));
  };
  const zoomIn = () => act((z, s) => s.call(z.scaleBy, 1.6));
  const zoomOut = () => act((z, s) => s.call(z.scaleBy, 1 / 1.6));
  const reset = () =>
    act((z, s) => {
      const init = focusTransform(width);
      s.call(z.transform, zoomIdentity.translate(init.x, 0).scale(init.k));
    });
  const resetFull = () => act((z, s) => s.call(z.transform, zoomIdentity));
  const pan = (dx: number) => act((z, s) => s.call(z.translateBy, dx / t.k, 0));

  const onKey = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return; // стрелки внутри ссылок не перехватываем
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomIn(); }
    else if (e.key === "-") { e.preventDefault(); zoomOut(); }
    else if (e.key === "0") { e.preventDefault(); resetFull(); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); pan(80); }
    else if (e.key === "ArrowRight") { e.preventDefault(); pan(-80); }
  };

  const scale = width ? zoomedScale(domain, width, t) : null;
  const visible: [number, number] | null = scale ? [scale.domain()[0] ?? domain[0], scale.domain()[1] ?? domain[1]] : null;
  const ticks = visible ? ticksFor(visible) : [];

  if (dated.length === 0 && undated.length === 0) return null;

  
  return (
    <section aria-label="Хронология" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={zoomIn} className="btn-pill btn-sm" aria-label="Приблизить">+</button>
        <button type="button" onClick={zoomOut} className="btn-pill btn-sm" aria-label="Отдалить">−</button>
        <button type="button" onClick={reset} className="btn-pill btn-sm">Сброс</button>
        <span className="text-xs text-muted">
          Перетаскивание — сдвиг, Ctrl + колесо — масштаб; с клавиатуры: фокус на шкале, затем + − 0 и стрелки.
        </span>
      </div>

      <div
        ref={wrapRef}
        tabIndex={0}
        role="group"
        aria-label="Шкала времени. Полосы художников — ссылки на карточки."
        onKeyDown={onKey}
        className="max-h-[70vh] overflow-y-auto overflow-x-hidden  border border-line bg-card"
      >
        {!scale ? (
          <p className="p-6 text-sm text-muted">Загрузка хронологии…</p>
        ) : (
          <svg ref={svgRef} width={width} height={height} className="block touch-pan-y select-none" role="presentation">

            {/* сетка и подписи оси */}
            {ticks.map((tk) => {
              const x = scale(tk.year);
              return (
                <g key={`${tk.kind}-${tk.year}`}>
                  <line x1={x} x2={x} y1={AXIS - 6} y2={height} stroke="#ebd8c4" strokeWidth={tk.kind === "century" ? 1.5 : 1} />
                  <text x={x + 4} y={tk.kind === "century" ? 16 : 30} fontSize={tk.kind === "century" ? 12 : 11} fill="#7a4a44">
                    {tk.year}
                  </text>
                  {tk.kind === "century" && tk.year > 0 && (
                    <text x={x + 4} y={32} fontSize={10} fill="#7a4a44">{centuryLabel(tk.year + 1)}</text>
                  )}
                </g>
              );
            })}

            {/* выбранный диапазон */}
            {focusRange && (
              <rect
                x={scale(Math.min(...focusRange))}
                width={Math.max(2, scale(Math.max(...focusRange)) - scale(Math.min(...focusRange)))}
                y={AXIS - 6}
                height={height}
                fill="#930400"
                opacity={0.12}
              />
            )}

            {/* полосы */}
            {dated.map((it, idx) => {
              const y = AXIS + idx * ROW;
              const hasStart = it.start !== null;
              const hasEnd = it.end !== null;
              const xs = hasStart ? scale(it.start as number) : null;
              const xe = hasEnd ? scale(it.end as number) : null;
              let x0: number;
              let x1: number;
              if (xs !== null && xe !== null) { x0 = xs; x1 = xe; }
              else if (xs !== null) { x0 = xs; x1 = xs + OPEN_EDGE_PX; }
              else { x1 = xe as number; x0 = x1 - OPEN_EDGE_PX; }
              const w = Math.max(3, x1 - x0);
              const open = xs === null || xe === null;
              const fill = open ? "#fff7e6" : "#930400";
              const circa = it.birthPrecision === "circa" || it.deathPrecision === "circa";
              // подпись всегда в видимой области: справа от полосы, иначе поверх неё у видимого края
              const visX0 = Math.max(x0, 0);
              const labelRight = x1 + 6 + 140 < width;
              const labelLeft = !labelRight && x0 - 6 > 140;
              const labelX = labelRight ? x1 + 6 : labelLeft ? x0 - 6 : visX0 + 6;
              const labelEnd = labelLeft;
              const life = formatLifespan({
                birthYear: it.start, deathYear: it.end, activeFrom: null, activeTo: null,
                birthPrecision: it.birthPrecision, deathPrecision: it.deathPrecision,
              });
              return (
                <a key={it.slug} href={`/artists/${it.slug}`} aria-label={`${it.nameRu}, ${life}`}>
                  <title>{`${it.nameRu} — ${life}`}</title>
                  <rect x={Math.min(x0, labelEnd ? labelX - 140 : x0)} y={y} width={Math.max(w, 1) + (labelRight ? 150 : 0)} height={ROW} fill="transparent" />
                  <rect
                    className="bar"
                    x={x0}
                    y={y + 5}
                    width={w}
                    height={ROW - 12}
                    rx={3}
                    fill={fill}
                    opacity={it.overlap === "maybe" ? 0.6 : 1}
                    stroke="#930400"
                    strokeWidth={circa || open ? 1.5 : 0.75}
                    strokeDasharray={circa || open ? "4 3" : undefined}
                  />
                  <text
                    x={labelX}
                    y={y + ROW / 2 + 4}
                    fontSize={12}
                    fill="#3a0a07"
                    textAnchor={labelEnd ? "end" : "start"}
                    paintOrder="stroke"
                    stroke="#fff7e6"
                    strokeWidth={3}
                  >
                    {it.nameRu}
                  </text>
                </a>
              );
            })}
          </svg>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted" aria-label="Легенда">
        <li><span className="mr-1 inline-block h-2.5 w-6 border border-wine bg-wine align-middle" />известны оба края (годы жизни)</li>
        <li><span className="mr-1 inline-block h-2.5 w-6 border border-dashed border-wine bg-wine align-middle" />пунктирный контур — даты приблизительны («ок.»)</li>
        <li><span className="mr-1 inline-block h-2.5 w-6 border border-dashed border-wine bg-milk align-middle" />светлая полоса — один край неизвестен (это не «жив»)</li>
        <li>Совпадение лет жизни не означает знакомства или влияния.</li>
      </ul>

      {undated.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Даты неизвестны, на шкале не показаны:</span>{" "}
          {undated.map((u, i) => (
            <span key={u.slug}>
              {i > 0 && ", "}
              <a href={`/artists/${u.slug}`}>{u.nameRu}</a>
            </span>
          ))}
        </p>
      )}
    </section>
  );
}
