/**
 * Автоматическая раскладка древа по времени.
 *
 * Вертикаль = историческое время: художники делятся на горизонтальные уровни по «якорю» (году активной
 * работы), ранние сверху. Связи НЕ влияют на уровень: историческая последовательность важнее структуры связей.
 * Горизонталь = порядок по барицентрам связей (чтобы связанные оказывались рядом, а линии пересекались реже),
 * затем выравнивание без наложений. Линии рисуются только для переданных связей; современники без связей
 * просто стоят рядом, без линий. Всё пересчитывается из входных данных: новые художники встают на своё место сами.
 */

export type EdgeType = "teacher_of" | "influenced" | "collaborated";

export interface CardInput {
  id: string;
  /** год для размещения; null — оценить нечем (уходит в нижний уровень) */
  anchor: number | null;
  /** для стабильного порядка при равных годах */
  sortKey: number;
}

export interface EdgeInput {
  id: string;
  from: string;
  to: string;
  type: EdgeType;
}

export const SIZES = {
  cardW: 112,
  cardH: 196,
  gapX: 20,
  gapY: 56,
  dummyW: 16,
  margin: 48,
  bucketYears: 25, // якоря в одном 25-летнем окне (поколение) — один уровень
  maxPerRow: 12, // переполненное окно делится на соседние уровни по порядку времени
} as const;

export interface CardPos {
  id: string;
  row: number;
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
}

export interface EdgeOut {
  id: string;
  type: EdgeType;
  fromId: string;
  toId: string;
  points: [number, number][];
  path: string;
}

export interface TimeLayout {
  cards: CardPos[];
  edges: EdgeOut[];
  width: number;
  height: number;
  rows: number;
}

// ---------- вспомогательное ----------

/** Изотонная регрессия (PAV): ближайшие к желаемым x при x[i+1]-x[i] >= gap[i]. */
function placeWithMinGaps(desired: number[], gaps: number[]): number[] {
  const n = desired.length;
  const off: number[] = [0];
  for (let i = 0; i < n - 1; i++) off.push((off[i] as number) + (gaps[i] as number));
  const blocks: { sum: number; count: number }[] = [];
  desired.forEach((d, i) => {
    blocks.push({ sum: d - (off[i] as number), count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1] as { sum: number; count: number };
      const a = blocks[blocks.length - 2] as { sum: number; count: number };
      if (a.sum / a.count <= b.sum / b.count) break;
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, count: a.count + b.count });
    }
  });
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.count; k++) out.push(b.sum / b.count);
  return out.map((y, i) => y + (off[i] as number));
}

const push = <K, V>(m: Map<K, V[]>, k: K, v: V) => m.set(k, [...(m.get(k) ?? []), v]);

/** Уровни по времени: окна по bucketYears, переполненные окна делятся на соседние уровни. */
export function assignRows(cards: CardInput[]): Map<string, number> {
  const sorted = [...cards].sort((a, b) => {
    if (a.anchor === null && b.anchor === null) return a.sortKey - b.sortKey || a.id.localeCompare(b.id);
    if (a.anchor === null) return 1;
    if (b.anchor === null) return -1;
    return a.anchor - b.anchor || a.sortKey - b.sortKey || a.id.localeCompare(b.id);
  });
  const buckets = new Map<number, CardInput[]>();
  for (const c of sorted) {
    const key = c.anchor === null ? Number.POSITIVE_INFINITY : Math.floor(c.anchor / SIZES.bucketYears);
    push(buckets, key, c);
  }
  const rowOf = new Map<string, number>();
  let row = 0;
  for (const key of [...buckets.keys()].sort((a, b) => a - b)) {
    const group = buckets.get(key) as CardInput[];
    const parts = Math.ceil(group.length / SIZES.maxPerRow);
    const size = Math.ceil(group.length / parts);
    for (let i = 0; i < group.length; i += size) {
      group.slice(i, i + size).forEach((c) => rowOf.set(c.id, row));
      row++;
    }
  }
  return rowOf;
}

// ---------- основная функция ----------

export function layoutTimeTree(cardsIn: CardInput[], edgesIn: EdgeInput[]): TimeLayout {
  if (cardsIn.length === 0) return { cards: [], edges: [], width: 0, height: 0, rows: 0 };
  const { cardW, cardH, gapX, gapY, dummyW, margin } = SIZES;

  const rowOf = assignRows(cardsIn);
  const R = Math.max(...rowOf.values()) + 1;
  const edges = edgesIn.filter((e) => rowOf.has(e.from) && rowOf.has(e.to) && e.from !== e.to);

  // цепочки: связь между рядами r1<r2 проходит через пустые колонки в промежуточных рядах
  interface Chain {
    edge: EdgeInput;
    upper: string;
    lower: string;
    dummies: string[];
    sameRow: boolean;
  }
  const chains: Chain[] = edges.map((e) => {
    const ra = rowOf.get(e.from) as number;
    const rb = rowOf.get(e.to) as number;
    const [upper, lower] = ra <= rb ? [e.from, e.to] : [e.to, e.from];
    const r1 = Math.min(ra, rb);
    const r2 = Math.max(ra, rb);
    const dummies: string[] = [];
    for (let r = r1 + 1; r < r2; r++) dummies.push(`~${e.id}#${r}`);
    return { edge: e, upper, lower, dummies, sameRow: ra === rb };
  });

  // ряды
  const sortKey = new Map(cardsIn.map((c) => [c.id, c]));
  const rows: string[][] = Array.from({ length: R }, () => []);
  const order = [...cardsIn].sort(
    (a, b) => (rowOf.get(a.id) as number) - (rowOf.get(b.id) as number) || (a.anchor ?? 1e9) - (b.anchor ?? 1e9) || a.sortKey - b.sortKey || a.id.localeCompare(b.id),
  );
  order.forEach((c) => rows[rowOf.get(c.id) as number]?.push(c.id));
  const dummyRow = new Map<string, number>();
  for (const ch of chains) {
    const r1 = rowOf.get(ch.upper) as number;
    ch.dummies.forEach((d, k) => {
      rows[r1 + 1 + k]?.push(d);
      dummyRow.set(d, r1 + 1 + k);
    });
  }
  const isDummy = (id: string) => id.startsWith("~");
  const widthOf = (id: string) => (isDummy(id) ? dummyW : cardW);

  // соседи по соседним рядам и «пары» в одном ряду
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  const peers = new Map<string, string[]>();
  for (const ch of chains) {
    if (ch.sameRow) {
      push(peers, ch.upper, ch.lower);
      push(peers, ch.lower, ch.upper);
      continue;
    }
    const path = [ch.upper, ...ch.dummies, ch.lower];
    for (let i = 0; i < path.length - 1; i++) {
      push(down, path[i] as string, path[i + 1] as string);
      push(up, path[i + 1] as string, path[i] as string);
    }
  }

  // порядок в рядах: барицентры по нормированным позициям, без смены ряда
  const pos = new Map<string, number>();
  const norm = (row: string[], i: number) => (i + 0.5) / row.length;
  const reindex = (r: number) => rows[r]?.forEach((id, i) => pos.set(id, norm(rows[r] as string[], i)));
  rows.forEach((_, r) => reindex(r));
  const sweep = (r: number, nb: Map<string, string[]>) => {
    const row = rows[r] as string[];
    const keyed = row.map((id, i) => {
      const ns = [...(nb.get(id) ?? []), ...(peers.get(id) ?? [])];
      const bc = ns.length ? ns.reduce((s, n) => s + (pos.get(n) ?? 0.5), 0) / ns.length : (pos.get(id) as number);
      return { id, bc, i };
    });
    keyed.sort((a, b) => a.bc - b.bc || a.i - b.i);
    rows[r] = keyed.map((k) => k.id);
    reindex(r);
  };
  for (let it = 0; it < 8; it++) {
    for (let r = 1; r < R; r++) sweep(r, up);
    for (let r = R - 2; r >= 0; r--) sweep(r, down);
  }

  // координаты X: старт — ряд по центру, дальше сближаем связанных без наложений
  const cx = new Map<string, number>();
  rows.forEach((row) => {
    const total = row.reduce((s, id) => s + widthOf(id), 0) + (row.length - 1) * gapX;
    let x = -total / 2;
    row.forEach((id) => {
      cx.set(id, x + widthOf(id) / 2);
      x += widthOf(id) + gapX;
    });
  });
  const relax = (r: number, sources: Map<string, string[]>[]) => {
    const row = rows[r] as string[];
    if (row.length === 0) return;
    const desired = row.map((id) => {
      const ns = sources.flatMap((m) => m.get(id) ?? []);
      return ns.length ? ns.reduce((s, n) => s + (cx.get(n) as number), 0) / ns.length : (cx.get(id) as number);
    });
    const gaps = row.slice(0, -1).map((id, i) => (widthOf(id) + widthOf(row[i + 1] as string)) / 2 + gapX);
    placeWithMinGaps(desired, gaps).forEach((x, i) => cx.set(row[i] as string, x));
  };
  for (let it = 0; it < 12; it++) {
    for (let r = 1; r < R; r++) relax(r, [up, peers]);
    for (let r = R - 2; r >= 0; r--) relax(r, [down, peers]);
    for (let r = 0; r < R; r++) relax(r, [up, down, peers]);
  }
  const minLeft = Math.min(...[...cx].map(([id, x]) => x - widthOf(id) / 2));
  const shift = margin - minLeft;

  // карточки
  const rowTop = (r: number) => margin + r * (cardH + gapY);
  const cards: CardPos[] = [];
  const posOf = new Map<string, CardPos>();
  rows.forEach((row, r) =>
    row.forEach((id) => {
      if (isDummy(id)) return;
      const c = (cx.get(id) as number) + shift;
      const p: CardPos = { id, row: r, left: c - cardW / 2, top: rowTop(r), width: cardW, height: cardH, cx: c };
      cards.push(p);
      posOf.set(id, p);
    }),
  );
  void sortKey;

  // линии: шины в промежутках между рядами (g = -1 — над первым рядом)
  const gapTop = (g: number) => (g < 0 ? rowTop(0) - gapY : rowTop(g) + cardH);
  const gapBottom = (g: number) => rowTop(g + 1);
  const lanes = new Map<number, string[]>();
  const srcKey = (ch: Chain) => (ch.sameRow ? `s:${ch.edge.id}` : `p:${ch.upper}`);
  const addLane = (g: number, key: string) => {
    const arr = lanes.get(g) ?? [];
    if (!arr.includes(key)) arr.push(key);
    lanes.set(g, arr);
  };
  for (const ch of chains) {
    const r1 = rowOf.get(ch.upper) as number;
    const r2 = rowOf.get(ch.lower) as number;
    if (ch.sameRow) {
      const a = rows[r1] as string[];
      if (Math.abs(a.indexOf(ch.upper) - a.indexOf(ch.lower)) > 1) addLane(r1 - 1, srcKey(ch));
    } else for (let g = r1; g < r2; g++) addLane(g, srcKey(ch));
  }
  const laneY = (g: number, key: string) => {
    const arr = (lanes.get(g) ?? []).slice().sort();
    const top = gapTop(g);
    const room = gapBottom(g) - top - 24;
    const step = Math.max(3, Math.min(8, room / Math.max(1, arr.length)));
    return top + 12 + arr.indexOf(key) * step;
  };

  const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`).join(" ");
  const dedupe = (pts: [number, number][]) => pts.filter((p, i) => i === 0 || p[0] !== (pts[i - 1] as [number, number])[0] || p[1] !== (pts[i - 1] as [number, number])[1]);
  const out: EdgeOut[] = [];
  for (const ch of chains) {
    const A = posOf.get(ch.upper) as CardPos;
    const B = posOf.get(ch.lower) as CardPos;
    let pts: [number, number][];
    if (ch.sameRow) {
      const row = rows[A.row] as string[];
      const [L, Rr] = A.cx <= B.cx ? [A, B] : [B, A];
      if (Math.abs(row.indexOf(ch.upper) - row.indexOf(ch.lower)) <= 1) {
        const y = L.top + 60; // на уровне портрета
        pts = [[L.left + L.width, y], [Rr.left, y]];
      } else {
        const y = laneY(A.row - 1, srcKey(ch));
        pts = [[L.cx, L.top], [L.cx, y], [Rr.cx, y], [Rr.cx, Rr.top]];
      }
    } else {
      const k = srcKey(ch);
      pts = [[A.cx, A.top + A.height]];
      let curX = A.cx;
      let g = A.row;
      for (const wx of [...ch.dummies.map((d) => (cx.get(d) as number) + shift), B.cx]) {
        const y = laneY(g, k);
        pts.push([curX, y], [wx, y]);
        curX = wx;
        g++;
      }
      pts.push([B.cx, B.top]);
    }
    const clean = dedupe(pts);
    out.push({ id: ch.edge.id, type: ch.edge.type, fromId: ch.edge.from, toId: ch.edge.to, points: clean, path: toPath(clean) });
  }

  const width = Math.max(...cards.map((c) => c.left + c.width)) + margin;
  const height = rowTop(R - 1) + cardH + margin;
  return { cards, edges: out, width, height, rows: R };
}
