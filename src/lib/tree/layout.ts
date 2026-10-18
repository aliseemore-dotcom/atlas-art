/**
 * Раскладка древа художников: слои (поколения) + порядок по барицентрам + ортогональные линии.
 * Размеры и зазоры берутся из дизайн-системы «Древо художников» (tokens.json).
 */

export type RelType = "teacher_of" | "influenced" | "collaborated";
export type NodeRole = "master" | "teacher" | "follower";

export interface TreeNodeInput {
  id: string;
  /** для стабильного порядка до оптимизации */
  sortKey: number;
  nameRu: string;
}

export interface TreeEdgeInput {
  id: string;
  from: string; // учитель / влияющий; для collaborated — любая сторона
  to: string;
  type: RelType;
  verified: boolean;
}

export const SIZES = {
  masterW: 132,
  masterH: 168,
  medW: 96,
  medH: 124,
  captionGap: 12, // подпись через 12px ниже медальона
  captionH: 64, // имя до двух строк + годы
  captionW: 176,
  captionMasterW: 220,
  nodeGap: 24, // space-3: минимум между подписями в ряду
  bondGap: 56, // между подписями учителей, соединённых небесной линией
  dummyW: 24, // колонка для длинной линии, проходящей через ряд
  rankPitch: 360,
  lineStartGap: 8, // линия начинается на 8px ниже подписи родителя
  margin: 64,
} as const;

export interface LayoutNode {
  id: string;
  role: NodeRole;
  rank: number;
  /** центр медальона по X */
  cx: number;
  /** центр медальона по Y */
  cy: number;
  medW: number;
  medH: number;
  /** рамка узла (медальон + подпись) */
  left: number;
  top: number;
  width: number;
  height: number;
}

export type EdgeKind = "lineage" | "influence" | "bond" | "collab";

export interface LayoutEdge {
  id: string;
  kind: EdgeKind;
  points: [number, number][];
  path: string;
  /** id исходных связей (для источников и подсветки) */
  relIds: string[];
  parentIds: string[];
  childId: string | null;
  verified: boolean;
  /** только bond: горизонталь между учителями (небесная, stroke-bond) */
  bondPath?: string;
}

export interface TreeLayout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  ranks: number;
}

// ---------- вспомогательное ----------

class UnionFind {
  private p = new Map<string, string>();
  find(a: string): string {
    if (!this.p.has(a)) this.p.set(a, a);
    let r = a;
    while (this.p.get(r) !== r) r = this.p.get(r) as string;
    let c = a;
    while (this.p.get(c) !== r) {
      const n = this.p.get(c) as string;
      this.p.set(c, r);
      c = n;
    }
    return r;
  }
  union(a: string, b: string) {
    this.p.set(this.find(a), this.find(b));
  }
}

/** Ранги по самому длинному пути; группы выравниваются на один ранг. Возвращает null при цикле. */
function rankGroups(ids: string[], directed: [string, string][], uf: UnionFind): Map<string, number> | null {
  const gid = (n: string) => uf.find(n);
  const groups = [...new Set(ids.map(gid))];
  const succ = new Map<string, Set<string>>();
  const indeg = new Map<string, number>(groups.map((g) => [g, 0]));
  for (const [a, b] of directed) {
    const ga = gid(a);
    const gb = gid(b);
    if (ga === gb) return null;
    if (!succ.has(ga)) succ.set(ga, new Set());
    if (!succ.get(ga)?.has(gb)) {
      succ.get(ga)?.add(gb);
      indeg.set(gb, (indeg.get(gb) ?? 0) + 1);
    }
  }
  const rank = new Map<string, number>(groups.map((g) => [g, 0]));
  const queue = groups.filter((g) => (indeg.get(g) ?? 0) === 0);
  let seen = 0;
  while (queue.length) {
    const g = queue.shift() as string;
    seen++;
    for (const h of succ.get(g) ?? []) {
      rank.set(h, Math.max(rank.get(h) ?? 0, (rank.get(g) ?? 0) + 1));
      indeg.set(h, (indeg.get(h) ?? 0) - 1);
      if (indeg.get(h) === 0) queue.push(h);
    }
  }
  if (seen !== groups.length) return null;
  return new Map(ids.map((n) => [n, rank.get(gid(n)) as number]));
}

/** Изотонная регрессия (PAV): ближайшие к желаемым x при ограничении x[i+1]-x[i] >= gap[i]. */
function placeWithMinGaps(desired: number[], gaps: number[]): number[] {
  const n = desired.length;
  const off: number[] = [0];
  for (let i = 0; i < n - 1; i++) off.push((off[i] as number) + (gaps[i] as number));
  const target = desired.map((d, i) => d - (off[i] as number));
  const blocks: { sum: number; count: number }[] = [];
  for (const t of target) {
    blocks.push({ sum: t, count: 1 });
    while (blocks.length > 1) {
      const b = blocks[blocks.length - 1] as { sum: number; count: number };
      const a = blocks[blocks.length - 2] as { sum: number; count: number };
      if (a.sum / a.count <= b.sum / b.count) break;
      blocks.splice(blocks.length - 2, 2, { sum: a.sum + b.sum, count: a.count + b.count });
    }
  }
  const out: number[] = [];
  for (const b of blocks) for (let k = 0; k < b.count; k++) out.push(b.sum / b.count);
  return out.map((y, i) => y + (off[i] as number));
}

interface Block {
  id: string;
  members: string[]; // id узлов; у пустышки — один id вида "~..."
  rank: number;
  width: number;
  dummy: boolean;
}

// ---------- основная функция ----------

export function layoutTree(nodesIn: TreeNodeInput[], edgesIn: TreeEdgeInput[]): TreeLayout {
  const nodeMap = new Map(nodesIn.map((n) => [n.id, n]));
  const edges = edgesIn.filter((e) => nodeMap.has(e.from) && nodeMap.has(e.to) && e.from !== e.to);
  const ids = [...new Set(edges.flatMap((e) => [e.from, e.to]))].sort(
    (a, b) => (nodeMap.get(a)?.sortKey ?? 0) - (nodeMap.get(b)?.sortKey ?? 0) || a.localeCompare(b),
  );
  if (ids.length === 0) return { nodes: [], edges: [], width: 0, height: 0, ranks: 0 };

  const directed = edges.filter((e) => e.type !== "collaborated");
  const collabs = edges.filter((e) => e.type === "collaborated");
  const dirPairs = directed.map((e) => [e.from, e.to] as [string, string]);

  // 1. Выравнивание: соавторы и учителя одного ученика — на одном ранге, рядом.
  const uf = new UnionFind();
  ids.forEach((i) => uf.find(i));
  const tryMerge = (a: string, b: string): boolean => {
    if (uf.find(a) === uf.find(b)) return true;
    const trial = new UnionFind();
    ids.forEach((i) => trial.find(i));
    // повторяем текущие объединения
    const byRoot = new Map<string, string[]>();
    for (const i of ids) byRoot.set(uf.find(i), [...(byRoot.get(uf.find(i)) ?? []), i]);
    for (const m of byRoot.values()) m.slice(1).forEach((x) => trial.union(m[0] as string, x));
    trial.union(a, b);
    if (!rankGroups(ids, dirPairs, trial)) return false;
    uf.union(a, b);
    return true;
  };
  for (const c of collabs) tryMerge(c.from, c.to);
  const teachersOf = new Map<string, string[]>();
  for (const e of directed.filter((x) => x.type === "teacher_of")) {
    teachersOf.set(e.to, [...(teachersOf.get(e.to) ?? []), e.from]);
  }
  for (const [, ts] of teachersOf) {
    for (let i = 1; i < ts.length; i++) tryMerge(ts[0] as string, ts[i] as string);
  }
  const rankMap = rankGroups(ids, dirPairs, uf) ?? new Map(ids.map((i) => [i, 0]));
  const rankOf = (n: string) => rankMap.get(n) ?? 0;
  const maxRank = Math.max(...ids.map(rankOf));

  // 2. Роли
  const hasIn = new Set(directed.map((e) => e.to));
  const hasOut = new Set(directed.map((e) => e.from));
  const roleOf = (n: string): NodeRole => (hasIn.has(n) ? "follower" : hasOut.has(n) ? "master" : "teacher");
  const roleFinal = (n: string): NodeRole => {
    const r = roleOf(n);
    return r === "follower" && hasOut.has(n) ? "teacher" : r;
  };
  const isMaster = (n: string) => roleFinal(n) === "master";
  const capW = (n: string) => (isMaster(n) ? SIZES.captionMasterW : SIZES.captionW);

  // 3. Рёбра для рисования: bond (общие учителя) и обычные, с цепочками пустышек для длинных
  interface Chain {
    id: string;
    kind: EdgeKind;
    parents: string[]; // у bond — несколько
    child: string;
    relIds: string[];
    verified: boolean;
    dummies: string[]; // по одному на каждый промежуточный ранг
    startRank: number;
  }
  const chains: Chain[] = [];
  const bondUsed = new Set<string>(); // id связей teacher_of, поглощённых bond
  const unitOf = (n: string) => uf.find(n);
  const byChild = new Map<string, TreeEdgeInput[]>();
  for (const e of directed.filter((x) => x.type === "teacher_of")) byChild.set(e.to, [...(byChild.get(e.to) ?? []), e]);
  for (const [child, es] of byChild) {
    const byUnit = new Map<string, TreeEdgeInput[]>();
    for (const e of es) byUnit.set(unitOf(e.from), [...(byUnit.get(unitOf(e.from)) ?? []), e]);
    for (const [, grp] of byUnit) {
      if (grp.length < 2) continue;
      grp.forEach((e) => bondUsed.add(e.id));
      chains.push({
        id: `bond:${grp.map((e) => e.from).sort().join("+")}>${child}`,
        kind: "bond",
        parents: grp.map((e) => e.from),
        child,
        relIds: grp.map((e) => e.id),
        verified: grp.every((e) => e.verified),
        dummies: [],
        startRank: rankOf(grp[0]?.from as string),
      });
    }
  }
  for (const e of directed) {
    if (bondUsed.has(e.id)) continue;
    chains.push({
      id: e.id,
      kind: e.type === "influenced" ? "influence" : "lineage",
      parents: [e.from],
      child: e.to,
      relIds: [e.id],
      verified: e.verified,
      dummies: [],
      startRank: rankOf(e.from),
    });
  }
  for (const ch of chains) {
    const span = rankOf(ch.child) - ch.startRank;
    for (let k = 1; k < span; k++) ch.dummies.push(`~${ch.id}#${k}`);
  }

  // 4. Блоки (юниты и пустышки) по рангам
  const blocks = new Map<string, Block>();
  const blockOf = new Map<string, string>(); // узел/пустышка -> id блока
  const memberOrder = (a: string, b: string) =>
    (nodeMap.get(a)?.sortKey ?? 0) - (nodeMap.get(b)?.sortKey ?? 0) || a.localeCompare(b);
  const unitMembers = new Map<string, string[]>();
  for (const i of ids) unitMembers.set(unitOf(i), [...(unitMembers.get(unitOf(i)) ?? []), i]);
  for (const [u, ms] of unitMembers) {
    ms.sort(memberOrder);
    const width = ms.reduce((s, m) => s + capW(m), 0) + (ms.length - 1) * SIZES.bondGap;
    blocks.set(u, { id: u, members: ms, rank: rankOf(ms[0] as string), width, dummy: false });
    ms.forEach((m) => blockOf.set(m, u));
  }
  for (const ch of chains) {
    ch.dummies.forEach((d, k) => {
      blocks.set(d, { id: d, members: [d], rank: ch.startRank + 1 + k, width: SIZES.dummyW, dummy: true });
      blockOf.set(d, d);
    });
  }

  // связи между соседними рангами (блок-блок), с учётом цепочек
  const links: [string, string][] = []; // [верхний блок, нижний блок]
  for (const ch of chains) {
    const path = [...ch.parents.map((p) => blockOf.get(p) as string).slice(0, 1), ...ch.dummies, blockOf.get(ch.child) as string];
    for (let i = 0; i < path.length - 1; i++) links.push([path[i] as string, path[i + 1] as string]);
  }
  const up = new Map<string, string[]>();
  const down = new Map<string, string[]>();
  for (const [a, b] of links) {
    if (a === b) continue;
    down.set(a, [...(down.get(a) ?? []), b]);
    up.set(b, [...(up.get(b) ?? []), a]);
  }

  // 5. Порядок в рядах: барицентры
  const rows: string[][] = Array.from({ length: maxRank + 1 }, () => []);
  const firstMember = (b: Block) => nodeMap.get(b.members[0] as string)?.sortKey ?? 0;
  [...blocks.values()]
    .sort((a, b) => a.rank - b.rank || firstMember(a) - firstMember(b) || a.id.localeCompare(b.id))
    .forEach((b) => rows[b.rank]?.push(b.id));
  const pos = new Map<string, number>();
  const reindex = () => rows.forEach((row) => row.forEach((id, i) => pos.set(id, i)));
  reindex();
  const sweep = (r: number, neighbors: Map<string, string[]>) => {
    const row = rows[r] as string[];
    const keyed = row.map((id, i) => {
      const ns = neighbors.get(id) ?? [];
      const bc = ns.length ? ns.reduce((s, n) => s + (pos.get(n) ?? 0), 0) / ns.length : i;
      return { id, bc, i };
    });
    keyed.sort((a, b) => a.bc - b.bc || a.i - b.i);
    rows[r] = keyed.map((k) => k.id);
    rows[r]?.forEach((id, i) => pos.set(id, i));
  };
  for (let it = 0; it < 8; it++) {
    for (let r = 1; r <= maxRank; r++) sweep(r, up);
    for (let r = maxRank - 1; r >= 0; r--) sweep(r, down);
  }

  // 6. Координаты X
  const blockX = new Map<string, number>();
  rows.forEach((row) => {
    let x = 0;
    row.forEach((id) => {
      const b = blocks.get(id) as Block;
      blockX.set(id, x + b.width / 2);
      x += b.width + SIZES.nodeGap;
    });
  });
  const gapsFor = (row: string[]) =>
    row.slice(0, -1).map((id, i) => {
      const a = blocks.get(id) as Block;
      const b = blocks.get(row[i + 1] as string) as Block;
      return (a.width + b.width) / 2 + SIZES.nodeGap;
    });
  const relax = (r: number, neighbors: Map<string, string[]>[]) => {
    const row = rows[r] as string[];
    if (row.length === 0) return;
    const desired = row.map((id) => {
      const ns = neighbors.flatMap((m) => m.get(id) ?? []);
      return ns.length ? ns.reduce((s, n) => s + (blockX.get(n) ?? 0), 0) / ns.length : (blockX.get(id) as number);
    });
    placeWithMinGaps(desired, gapsFor(row)).forEach((x, i) => blockX.set(row[i] as string, x));
  };
  for (let it = 0; it < 10; it++) {
    for (let r = 1; r <= maxRank; r++) relax(r, [up]);
    for (let r = maxRank - 1; r >= 0; r--) relax(r, [down]);
    for (let r = 0; r <= maxRank; r++) relax(r, [up, down]);
  }
  const minLeft = Math.min(...[...blocks.values()].map((b) => (blockX.get(b.id) as number) - b.width / 2));
  const shiftX = SIZES.margin - minLeft;

  // координаты узлов
  const nodes: LayoutNode[] = [];
  const nodeById = new Map<string, LayoutNode>();
  const dummyX = new Map<string, number>();
  for (const b of blocks.values()) {
    const center = (blockX.get(b.id) as number) + shiftX;
    if (b.dummy) {
      dummyX.set(b.id, center);
      continue;
    }
    let x = center - b.width / 2;
    for (const m of b.members) {
      const w = capW(m);
      const mc = x + w / 2;
      x += w + SIZES.bondGap;
      const master = isMaster(m);
      const medW = master ? SIZES.masterW : SIZES.medW;
      const medH = master ? SIZES.masterH : SIZES.medH;
      const cy = SIZES.margin + b.rank * SIZES.rankPitch + SIZES.masterH / 2;
      const ln: LayoutNode = {
        id: m,
        role: roleFinal(m),
        rank: b.rank,
        cx: mc,
        cy,
        medW,
        medH,
        left: mc - w / 2,
        top: cy - medH / 2,
        width: w,
        height: medH + SIZES.captionGap + SIZES.captionH,
      };
      nodes.push(ln);
      nodeById.set(m, ln);
    }
  }

  // 7. Линии
  const rankBottom = (r: number) =>
    Math.max(...nodes.filter((n) => n.rank === r).map((n) => n.top + n.height), SIZES.margin) + SIZES.lineStartGap;
  const rankTop = (r: number) => Math.min(...nodes.filter((n) => n.rank === r).map((n) => n.top), Infinity);

  // шины по зазорам: источник -> полоса
  type Src = string;
  const laneSources = new Map<number, Src[]>();
  const srcKey = (ch: Chain): Src => (ch.kind === "bond" ? `b:${ch.parents.slice().sort().join("+")}` : `p:${ch.parents[0]}`);
  for (const ch of chains) {
    const last = rankOf(ch.child);
    for (let g = ch.startRank; g < last; g++) {
      const arr = laneSources.get(g) ?? [];
      const k = srcKey(ch);
      if (!arr.includes(k)) arr.push(k);
      laneSources.set(g, arr);
    }
  }
  const srcX = (k: Src): number => {
    const parts = k.slice(2).split("+");
    return parts.reduce((s, p) => s + (nodeById.get(p)?.cx ?? 0), 0) / parts.length;
  };
  const laneY = (g: number, k: Src): number => {
    const arr = (laneSources.get(g) ?? []).slice().sort((a, b) => srcX(a) - srcX(b));
    const start = rankBottom(g);
    const end = rankTop(g + 1);
    const room = Math.max(24, end - start - 28);
    const step = Math.min(14, room / Math.max(1, arr.length));
    return start + 14 + arr.indexOf(k) * step;
  };

  const outEdges: LayoutEdge[] = [];
  const toPath = (pts: [number, number][]) => pts.map((p, i) => `${i ? "L" : "M"}${Math.round(p[0] * 10) / 10} ${Math.round(p[1] * 10) / 10}`).join(" ");
  const dedupe = (pts: [number, number][]) => pts.filter((p, i) => i === 0 || p[0] !== (pts[i - 1] as [number, number])[0] || p[1] !== (pts[i - 1] as [number, number])[1]);

  for (const ch of chains) {
    const child = nodeById.get(ch.child) as LayoutNode;
    const k = srcKey(ch);
    let startX: number;
    let startY: number;
    if (ch.kind === "bond") {
      const ps = ch.parents.map((p) => nodeById.get(p) as LayoutNode);
      startX = (Math.min(...ps.map((p) => p.cx)) + Math.max(...ps.map((p) => p.cx))) / 2;
      startY = ps[0]?.cy as number;
    } else {
      const p = nodeById.get(ch.parents[0] as string) as LayoutNode;
      startX = p.cx;
      startY = p.top + p.height + SIZES.lineStartGap;
    }
    const pts: [number, number][] = [[startX, startY]];
    let curX = startX;
    let g = ch.startRank;
    const waypoints = [...ch.dummies.map((d) => dummyX.get(d) as number), child.cx];
    for (const wx of waypoints) {
      const y = laneY(g, k);
      pts.push([curX, y], [wx, y]);
      curX = wx;
      g++;
    }
    pts.push([child.cx, child.top]);
    const clean = dedupe(pts);
    outEdges.push({
      id: ch.id,
      kind: ch.kind,
      points: clean,
      path: toPath(clean),
      relIds: ch.relIds,
      parentIds: ch.parents,
      childId: ch.child,
      verified: ch.verified,
    });
  }
  for (const c of collabs) {
    const a = nodeById.get(c.from) as LayoutNode;
    const b = nodeById.get(c.to) as LayoutNode;
    const [l, r] = a.cx <= b.cx ? [a, b] : [b, a];
    let pts: [number, number][];
    if (l.rank === r.rank) {
      pts = [[l.cx + l.medW / 2, l.cy], [r.cx - r.medW / 2, r.cy]];
    } else {
      // соавторы на разных рангах (выравнивание невозможно): ломаная по шине между рангами
      const y = rankBottom(Math.min(l.rank, r.rank)) + 6;
      pts = [[l.cx, l.top + l.height + SIZES.lineStartGap], [l.cx, y], [r.cx, y], [r.cx, r.top]];
    }
    outEdges.push({ id: c.id, kind: "collab", points: pts, path: toPath(pts), relIds: [c.id], parentIds: [c.from, c.to], childId: null, verified: c.verified });
  }
  // небесная линия между учителями bond: горизонталь на уровне центров медальонов, отдельным сегментом
  for (const e of outEdges.filter((x) => x.kind === "bond")) {
    const ps = e.parentIds.map((p) => nodeById.get(p) as LayoutNode).sort((x, y) => x.cx - y.cx);
    const first = ps[0] as LayoutNode;
    const last = ps[ps.length - 1] as LayoutNode;
    e.bondPath = toPath([[first.cx + first.medW / 2, first.cy], [last.cx - last.medW / 2, last.cy]]);
  }

  const width = Math.max(...nodes.map((n) => n.left + n.width), ...dummyX.values()) + SIZES.margin;
  const height = SIZES.margin * 2 + maxRank * SIZES.rankPitch + SIZES.masterH + SIZES.captionGap + SIZES.captionH;
  return { nodes, edges: outEdges, width, height, ranks: maxRank + 1 };
}

// ---------- ветви (компоненты связности) ----------

export interface Branch {
  nodeIds: string[];
  masterIds: string[];
}

export function findBranches(nodesIn: TreeNodeInput[], edges: TreeEdgeInput[]): Branch[] {
  const uf = new UnionFind();
  const ids = new Set<string>();
  for (const e of edges) {
    ids.add(e.from);
    ids.add(e.to);
    uf.union(e.from, e.to);
  }
  const key = new Map(nodesIn.map((n) => [n.id, n.sortKey]));
  const groups = new Map<string, string[]>();
  for (const i of ids) groups.set(uf.find(i), [...(groups.get(uf.find(i)) ?? []), i]);
  const hasIn = new Set(edges.filter((e) => e.type !== "collaborated").map((e) => e.to));
  const hasOut = new Set(edges.filter((e) => e.type !== "collaborated").map((e) => e.from));
  return [...groups.values()]
    .map((g) => {
      const nodeIds = g.sort((a, b) => (key.get(a) ?? 0) - (key.get(b) ?? 0));
      const masterIds = nodeIds.filter((n) => hasOut.has(n) && !hasIn.has(n));
      return { nodeIds, masterIds: masterIds.length ? masterIds : nodeIds.slice(0, 1) };
    })
    .sort((a, b) => b.nodeIds.length - a.nodeIds.length || (key.get(a.nodeIds[0] as string) ?? 0) - (key.get(b.nodeIds[0] as string) ?? 0));
}
