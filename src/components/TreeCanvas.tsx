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
import { memo, useCallback, useEffect, useMemo } from "react";
import type { TreeCard, TreeData } from "@/lib/tree/build";

type EdgeData = { path: string; type: "teacher_of" | "influenced" | "collaborated"; label: string };

/** Карточка: портрет (прямоугольник), имя и годы. Больше ничего. */
const CardNode = memo(function CardNode({ data }: NodeProps<Node<{ card: TreeCard }>>) {
  const c = data.card;
  return (
    <div className="card" data-approx={c.approx} data-testid={`card-${c.slug}`} role="group" aria-label={`${c.nameRu}, ${c.years}`}>
      <Handle type="target" position={Position.Top} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
      <div className="portrait">
        {c.portraitUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={c.portraitUrl} alt="" draggable={false} />
        ) : (
          <span aria-hidden>{c.initials}</span>
        )}
      </div>
      <div className="name">{c.nameRu}</div>
      <div className="years">{c.years}</div>
      <Handle type="source" position={Position.Bottom} isConnectable={false} style={{ opacity: 0, pointerEvents: "none" }} />
    </div>
  );
});

/** Тонкие ортогональные линии: сплошная — учитель→ученик, пунктир — влияние, голубая — совместная работа. */
const LineEdge = memo(function LineEdge({ data }: EdgeProps<Edge<EdgeData>>) {
  if (!data) return null;
  const stroke = data.type === "collaborated" ? "var(--heavenly-ink)" : "var(--wine)";
  return (
    <g data-type={data.type}>
      <path d={data.path} fill="none" stroke={stroke} strokeWidth={1.25} strokeDasharray={data.type === "influenced" ? "5 4" : undefined} strokeLinejoin="miter" />
      <path d={data.path} fill="none" stroke="transparent" strokeWidth={10}>
        <title>{data.label}</title>
      </path>
    </g>
  );
});

const nodeTypes = { card: CardNode };
const edgeTypes = { line: LineEdge };

const ICON = { fill: "none", stroke: "currentColor", strokeWidth: 1.5 } as const;
const READABLE = 0.4; // масштаб, при котором имена ещё читаются
const MIN_FIT = 0.3; // если всё древо целиком мельче, открываем читаемую часть

function Inner({ tree }: { tree: TreeData }) {
  const rf = useReactFlow();

  const nodes: Node<{ card: TreeCard }>[] = useMemo(
    () => tree.cards.map((c) => ({ id: c.id, type: "card", position: { x: c.left, y: c.top }, width: c.width, height: c.height, draggable: false, data: { card: c } })),
    [tree.cards],
  );
  const edges: Edge<EdgeData>[] = useMemo(
    () => tree.edges.map((e) => ({ id: e.id, source: e.fromId, target: e.toId, type: "line", selectable: false, focusable: false, data: { path: e.path, type: e.type, label: e.label } })),
    [tree.edges],
  );

  // Начальный вид: всё древо, а если оно получается слишком мелким — читаемый масштаб от самых ранних художников
  const initialView = useCallback(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const fit = Math.min(w / tree.width, h / tree.height) * 0.96;
    if (fit >= MIN_FIT) {
      rf.setViewport({ zoom: fit, x: (w - tree.width * fit) / 2, y: (h - tree.height * fit) / 2 }, { duration: 0 });
    } else {
      rf.setViewport({ zoom: READABLE, x: w / 2 - (READABLE * tree.width) / 2, y: 16 }, { duration: 0 });
    }
  }, [rf, tree.width, tree.height]);
  useEffect(() => {
    const t = setTimeout(initialView, 60);
    return () => clearTimeout(t);
  }, [initialView]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        edgesFocusable={false}
        nodesFocusable={false}
        minZoom={0.05}
        maxZoom={2}
        panOnDrag
        panOnScroll
        zoomOnScroll={false}
        zoomOnPinch
        zoomActivationKeyCode={["Control", "Meta"]}
        preventScrolling
        proOptions={{ hideAttribution: true }}
        aria-label="Древо художников"
      />
      <div className="controls" role="group" aria-label="Управление древом">
        <button type="button" aria-label="Приблизить" onClick={() => rf.zoomIn({ duration: 150 })}>
          <svg width="20" height="20" viewBox="0 0 20 20" {...ICON}><path d="M10 4v12M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Отдалить" onClick={() => rf.zoomOut({ duration: 150 })}>
          <svg width="20" height="20" viewBox="0 0 20 20" {...ICON}><path d="M4 10h12" /></svg>
        </button>
        <button type="button" aria-label="Всё древо целиком" onClick={() => rf.fitView({ padding: 0.04, duration: 200 })}>
          <svg width="20" height="20" viewBox="0 0 20 20" {...ICON}><path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" /></svg>
        </button>
      </div>
    </>
  );
}

export function TreeCanvas({ tree }: { tree: TreeData }) {
  return (
    <ReactFlowProvider>
      <Inner tree={tree} />
    </ReactFlowProvider>
  );
}
