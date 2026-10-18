"use client";

import {
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TreeNodeView, TreeView } from "@/lib/tree/assemble";
import type { LayoutEdge } from "@/lib/tree/layout";
import { Medallion } from "./Medallion";

type ArtistData = { view: TreeNodeView; dim: boolean; selected: boolean };
type TreeEdgeData = { edge: LayoutEdge; dim: boolean; label?: string };

// ---------- узел: медальон + подпись (имя, годы) ----------
const ArtistNode = memo(function ArtistNode({ data }: NodeProps<Node<ArtistData>>) {
  const { view: n, dim, selected } = data;
  const master = n.role === "master";
  return (
    <div style={{ width: n.width, opacity: dim ? 0.28 : 1, transition: "opacity .15s" }} className="flex flex-col items-center">
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <button
        type="button"
        data-testid={`node-${n.slug}`}
        aria-pressed={selected}
        aria-label={`${n.nameRu}, ${n.years}. Показать связи`}
        className="nodrag flex cursor-pointer flex-col items-center bg-transparent p-0 text-center"
        style={{ width: n.width }}
      >
        <Medallion role={n.role} initials={n.initials} portraitUrl={n.portrait?.url} active={selected} />
        <span className="mt-3 block" style={{ width: n.width, height: 64 }}>
          <span
            className="block font-semibold text-ink"
            style={{ fontSize: master ? 22 : 18, lineHeight: master ? "24px" : "22px", letterSpacing: master ? "-0.02em" : undefined, maxHeight: 48, overflow: "hidden" }}
          >
            {n.nameRu}
          </span>
          <span className="index block text-rose-dust">{n.years}</span>
        </span>
      </button>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
});

// ---------- линии: сплошная — учитель→ученик, пунктир — влияние, небесная — два учителя ----------
const TreeEdge = memo(function TreeEdge({ data }: EdgeProps<Edge<TreeEdgeData>>) {
  if (!data) return null;
  const { edge, dim, label } = data;
  const common = { fill: "none", strokeLinejoin: "miter" as const, opacity: dim ? 0.2 : 1 };
  if (edge.kind === "bond") {
    return (
      <g {...common} data-kind="bond">
        <path d={edge.bondPath} stroke="var(--color-heavenly)" strokeWidth={4} fill="none" />
        <path d={edge.path} stroke="var(--color-heavenly)" strokeWidth={4} fill="none" strokeLinecap="butt" />
      </g>
    );
  }
  if (edge.kind === "collab") {
    const [a, b] = edge.points as [[number, number], [number, number]];
    return (
      <g {...common} data-kind="collab">
        <path d={edge.path} stroke="var(--color-rose-dust)" strokeWidth={1} fill="none" />
        {edge.points.length === 2 && (
          <text x={(a[0] + b[0]) / 2} y={a[1] - 8} textAnchor="middle" className="label" fill="var(--color-rose-dust)" fontSize={10}>
            {label ?? "ВМЕСТЕ"}
          </text>
        )}
      </g>
    );
  }
  const dashed = edge.kind === "influence";
  return (
    <g {...common} data-kind={edge.kind}>
      <path d={edge.path} stroke="var(--color-wine)" strokeWidth={2} fill="none" strokeDasharray={dashed ? "6 6" : undefined} />
    </g>
  );
});

const nodeTypes = { artist: ArtistNode };
const edgeTypes = { tree: TreeEdge };

const REL_LABEL = { teacher_of: "Учитель", influenced: "Повлиял", collaborated: "Работали вместе" } as const;

function Inner({ tree }: { tree: TreeView }) {
  const [selected, setSelected] = useState<string | null>(null);
  const rf = useReactFlow();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // окружение выделенного: предки, потомки, соавторы
  const related = useMemo(() => {
    if (!selected) return null;
    const set = new Set<string>([selected]);
    const parentsOf = new Map<string, string[]>();
    const childrenOf = new Map<string, string[]>();
    for (const e of tree.edges) {
      if (e.kind === "collab") {
        const [a, b] = e.parentIds as [string, string];
        if (a === selected || b === selected) set.add(a).add(b);
        continue;
      }
      for (const p of e.parentIds) {
        childrenOf.set(p, [...(childrenOf.get(p) ?? []), e.childId as string]);
        parentsOf.set(e.childId as string, [...(parentsOf.get(e.childId as string) ?? []), p]);
      }
    }
    const walk = (start: string, map: Map<string, string[]>) => {
      const stack = [start];
      while (stack.length) for (const n of map.get(stack.pop() as string) ?? []) if (!set.has(n)) { set.add(n); stack.push(n); }
    };
    walk(selected, parentsOf);
    walk(selected, childrenOf);
    return set;
  }, [selected, tree.edges]);

  const nodes: Node<ArtistData>[] = useMemo(
    () =>
      tree.nodes.map((n) => ({
        id: n.id,
        type: "artist",
        position: { x: n.left, y: n.top },
        width: n.width,
        height: n.height,
        draggable: false,
        data: { view: n, dim: related ? !related.has(n.id) : false, selected: selected === n.id },
      })),
    [tree.nodes, related, selected],
  );
  const edges: Edge<TreeEdgeData>[] = useMemo(
    () =>
      tree.edges.map((e) => {
        const src = e.parentIds[0] as string;
        const tgt = (e.childId ?? e.parentIds[1] ?? e.parentIds[0]) as string;
        const touches = !related || e.parentIds.some((p) => related.has(p)) && (e.childId === null || related.has(e.childId));
        return { id: e.id, source: src, target: tgt, type: "tree", data: { edge: e, dim: !touches }, selectable: false, focusable: false };
      }),
    [tree.edges, related],
  );

  const onNodeClick = useCallback((_: unknown, node: Node) => setSelected((s) => (s === node.id ? null : node.id)), []);
  const detail = selected ? tree.nodes.find((n) => n.id === selected) : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setSelected(null); setFullscreen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  // Начальный вид: всё древо; если оно слишком мелкое — читаемый масштаб от верхних мастеров
  const MIN_READABLE = 0.55;
  const initialView = useCallback(() => {
    rf.fitView({ padding: 0.08, duration: 0 });
    const w = wrapRef.current?.clientWidth ?? 0;
    if (w && rf.getZoom() < MIN_READABLE) {
      rf.setViewport({ zoom: MIN_READABLE, x: w / 2 - (MIN_READABLE * tree.layout.width) / 2, y: 16 }, { duration: 0 });
    }
  }, [rf, tree.layout.width]);
  useEffect(() => {
    const t = setTimeout(initialView, 50);
    return () => clearTimeout(t);
  }, [fullscreen, initialView, tree]);

  const weight = (r: TreeView["relationships"][string]) =>
    r.type === "teacher_of" ? (r.toId === detail?.id ? 0 : 1) : 2;
  const relsOfDetail = detail
    ? Object.values(tree.relationships)
        .filter((r) => r.fromId === detail.id || r.toId === detail.id)
        .sort((a, b) => weight(a) - weight(b))
    : [];
  const notes = [...new Set(relsOfDetail.filter((r) => r.sources.length === 0).map((r) => r.evidenceNote ?? "Источник не указан."))];
  const nameOf = (id: string) => tree.nodes.find((n) => n.id === id)?.nameRu ?? id;

  return (
    <div className={fullscreen ? "fixed inset-0 z-40 flex flex-col bg-milk p-4" : "space-y-4"}>
      <div className={`grid gap-4 ${fullscreen ? "min-h-0 flex-1" : ""} lg:grid-cols-[1fr_320px]`}>
        <div ref={wrapRef} className={`relative border border-line bg-milk ${fullscreen ? "min-h-0" : "h-[80vh] min-h-[560px]"}`} data-testid="tree-canvas">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeClick={onNodeClick}
            onPaneClick={() => setSelected(null)}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            fitView
            fitViewOptions={{ padding: 0.08 }}
            minZoom={0.15}
            maxZoom={1.8}
            zoomOnScroll={false}
            preventScrolling={false}
            zoomActivationKeyCode={["Control", "Meta"]}
            proOptions={{ hideAttribution: true }}
            aria-label="Древо художников. Медальоны — кнопки: выберите художника, чтобы выделить его линии."
          />
          <div className="absolute right-3 top-3 flex flex-col gap-2">
            <button type="button" className="btn-icon" aria-label="Приблизить" onClick={() => rf.zoomIn({ duration: 150 })}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M10 4v12M4 10h12" /></svg>
            </button>
            <button type="button" className="btn-icon" aria-label="Отдалить" onClick={() => rf.zoomOut({ duration: 150 })}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 10h12" /></svg>
            </button>
            <button type="button" className="btn-icon" aria-label="Показать всё древо" onClick={() => rf.fitView({ padding: 0.08, duration: 150 })}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></svg>
            </button>
            <button type="button" className="btn-icon" aria-label={fullscreen ? "Свернуть" : "На весь экран"} aria-pressed={fullscreen} onClick={() => setFullscreen((v) => !v)}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3.5" y="3.5" width="13" height="13" /></svg>
            </button>
          </div>
          <p className="label pointer-events-none absolute bottom-3 left-3 bg-milk/90 px-2 py-1 text-rose-dust">
            ПЕРЕТАСКИВАНИЕ — СДВИГ · CTRL + КОЛЕСО — МАСШТАБ
          </p>
        </div>

        <aside aria-live="polite" className="border border-line bg-cream p-4" data-testid="tree-detail">
          {detail ? (
            <div className="space-y-3">
              <p className="label text-wine">{detail.role === "master" ? "МАСТЕР ВЕТВИ" : detail.role === "teacher" ? "УЧИТЕЛЬ" : "УЧЕНИК / ПОСЛЕДОВАТЕЛЬ"}</p>
              <h3 className="text-2xl">{detail.nameRu}</h3>
              <p className="index text-rose-dust">{detail.years}</p>
              {relsOfDetail.length === 0 ? (
                <p className="text-sm text-muted">Для этого художника связей в древе нет.</p>
              ) : (
                <ul className="space-y-3 text-sm">
                  {relsOfDetail.map((r, i) => {
                    const other = r.fromId === detail.id ? r.toId : r.fromId;
                    const role = r.type === "teacher_of" ? (r.fromId === detail.id ? "Ученик" : "Учитель") : REL_LABEL[r.type];
                    return (
                      <li key={r.id} className="border-t border-line pt-2">
                        <span className="index text-wine">({String(i + 1).padStart(2, "0")})</span>{" "}
                        <span className="text-muted">{role}:</span> <strong>{nameOf(other)}</strong>
                        <p className="mt-1">
                          {r.status === "verified" ? (
                            <span className="label text-heavenly-ink">ПОДТВЕРЖДЕНО</span>
                          ) : (
                            <span className="label text-rose-dust">НЕ СВЕРЕНО · ТРЕБУЕТ ИСТОЧНИКА</span>
                          )}
                        </p>
                        {r.sources.length > 0 ? (
                          <ul className="mt-1 text-xs">
                            {r.sources.map((s) => (
                              <li key={s.title}>
                                {s.url ? <a href={s.url} rel="noopener noreferrer" target="_blank">{s.title}</a> : s.title}
                                {s.authorOrInstitution ? `, ${s.authorOrInstitution}` : ""}{s.publicationYear ? `, ${s.publicationYear}` : ""}{s.page ? `, ${s.page}` : ""}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {notes.map((n) => (
                <p key={n} className="text-xs text-muted">{n}</p>
              ))}
              <Link href={`/artists/${detail.slug}`} className="btn-pill w-full no-underline">
                <span>Карточка художника</span><span aria-hidden>→</span>
              </Link>
              {detail.portrait && (
                <p className="text-xs text-muted">
                  Портрет: {detail.portrait.credit}. <a href={detail.portrait.sourceUrl} rel="noopener noreferrer" target="_blank">Источник</a>
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <p className="label text-wine">ВЫБЕРИТЕ ХУДОЖНИКА</p>
              <p className="text-muted">Нажмите на медальон: линии учителей и учеников выделятся, остальное станет бледнее. Здесь появятся связи и источники.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

export function TreeCanvas({ tree }: { tree: TreeView }) {
  return (
    <ReactFlowProvider>
      <Inner tree={tree} />
    </ReactFlowProvider>
  );
}
