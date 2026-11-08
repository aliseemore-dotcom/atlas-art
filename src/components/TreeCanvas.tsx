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
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArtistPanel } from "./ArtistPanel";
import type { TreeCard, TreeData } from "@/lib/tree/build";

type EdgeData = { path: string; type: "teacher_of" | "influenced" | "collaborated"; label: string };

/** Карточка: портрет (прямоугольник), имя и годы. Больше ничего. */
type CardData = { card: TreeCard; selected: boolean; onOpen: (slug: string) => void; onReveal: (slug: string) => void };

const CardNode = memo(function CardNode({ data }: NodeProps<Node<CardData>>) {
  const { card: c, selected, onOpen, onReveal } = data;
  const down = useRef<{ x: number; y: number } | null>(null);
  return (
    <div
      className="card"
      data-approx={c.approx}
      data-selected={selected}
      data-testid={`card-${c.slug}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${c.nameRu}, ${c.years}. Открыть карточку`}
      onFocus={() => onReveal(c.slug)}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onClick={(e) => {
        // перетаскивание древа за карточку не открывает её
        const d = down.current;
        if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 5) return;
        onOpen(c.slug);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(c.slug);
        }
      }}
    >
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

  const [selected, setSelected] = useState<string | null>(null);
  const bySlug = useMemo(() => new Map(tree.cards.map((c) => [c.slug, c])), [tree.cards]);

  // Выбор художника: открывает окно и сдвигает древо так, чтобы карточка осталась видимой слева от окна
  const open = useCallback(
    (slug: string) => {
      const c = bySlug.get(slug);
      if (!c) return;
      setSelected(slug);
      history.replaceState(null, "", `#${slug}`);
      const panelW = window.innerWidth >= 720 ? 440 : 0;
      const z = Math.max(rf.getZoom(), 0.5);
      rf.setCenter(c.left + c.width / 2 + panelW / 2 / z, c.top + c.height / 2 + (panelW ? 0 : window.innerHeight * 0.31 / z), { zoom: z, duration: 250 });
    },
    [bySlug, rf],
  );
  // Клавиатурный фокус на карточке вне экрана: подвести её в поле зрения (окно, если открыто, закрывает правую часть)
  const reveal = useCallback(
    (slug: string) => {
      const c = bySlug.get(slug);
      if (!c) return;
      const tl = rf.flowToScreenPosition({ x: c.left, y: c.top });
      const z = rf.getZoom();
      const right = window.innerWidth - (window.innerWidth >= 720 && selected ? 440 : 0);
      const visible = tl.x >= 0 && tl.y >= 0 && tl.x + c.width * z <= right && tl.y + c.height * z <= window.innerHeight;
      if (!visible) rf.setCenter(c.left + c.width / 2, c.top + c.height / 2, { zoom: Math.max(z, READABLE), duration: 200 });
    },
    [bySlug, rf, selected],
  );
  const close = useCallback(() => {
    setSelected(null);
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  const nodes: Node<CardData>[] = useMemo(
    () => tree.cards.map((c) => ({ id: c.id, type: "card", position: { x: c.left, y: c.top }, width: c.width, height: c.height, draggable: false, data: { card: c, selected: selected === c.slug, onOpen: open, onReveal: reveal } })),
    [tree.cards, selected, open, reveal],
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
    const t = setTimeout(() => {
      const slug = decodeURIComponent(window.location.hash.slice(1));
      if (slug && bySlug.has(slug)) open(slug); // ссылка на карточку: #ilya-repin
      else initialView();
    }, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

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
        onPaneClick={close}
        aria-label="Древо художников"
      />
      {selected && <ArtistPanel key={selected} slug={selected} onClose={close} onOpen={open} />}
      <div className="controls" data-shifted={selected !== null} role="group" aria-label="Управление древом">
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
