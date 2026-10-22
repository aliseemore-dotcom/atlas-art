import { estimateAnchor, formatYears, resolveAnchors } from "./anchor";
import type { DatePrecision } from "@/lib/timeline/interval";
import { layoutTimeTree, type CardInput, type EdgeInput, type EdgeOut } from "./timeLayout";

export interface TreeArtist {
  id: string;
  slug: string;
  nameRu: string;
  birthYear: number | null;
  deathYear: number | null;
  activeFrom: number | null;
  activeTo: number | null;
  birthPrecision: DatePrecision;
  deathPrecision: DatePrecision;
  eraLabel: string | null;
  portraitUrl: string | null;
  portraitRights: "unknown" | "public_domain" | "licensed";
  portraitCredit: string | null;
  portraitSourceUrl: string | null;
}

export interface TreeRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: "teacher_of" | "influenced" | "collaborated";
  status: "draft" | "needs_review" | "verified";
}

export interface TreeCard {
  id: string;
  slug: string;
  nameRu: string;
  years: string;
  initials: string;
  portraitUrl: string | null;
  /** положение оценено косвенно (даты неизвестны или неполны) — рамка пунктиром */
  approx: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface TreeData {
  cards: TreeCard[];
  edges: (EdgeOut & { label: string })[];
  width: number;
  height: number;
  rows: number;
}

export const EDGE_LABEL = { teacher_of: "Учитель → ученик", influenced: "Влияние", collaborated: "Совместная работа" } as const;

/** Портрет допускается только с подтверждёнными правами, автором и источником (правило 8 проекта). */
export function usablePortrait(a: Pick<TreeArtist, "portraitUrl" | "portraitRights" | "portraitCredit" | "portraitSourceUrl">): string | null {
  if (!a.portraitUrl || !a.portraitCredit || !a.portraitSourceUrl) return null;
  return a.portraitRights === "public_domain" || a.portraitRights === "licensed" ? a.portraitUrl : null;
}

/** Инициалы для заглушки портрета: первые буквы первых двух слов с заглавной. */
export function initials(name: string): string {
  const words = name.split(/\s+/).filter((w) => /^\p{Lu}/u.test(w));
  return words.slice(0, 2).map((w) => w.charAt(0)).join("") || name.charAt(0).toUpperCase();
}

/**
 * Данные -> готовое древо. Линии строятся только по подтверждённым (verified) связям;
 * includeUnverified добавляет needs_review — только для предпросмотра. draft не рисуется никогда.
 */
export function buildTree(artists: TreeArtist[], relationships: TreeRelationship[], opts: { includeUnverified?: boolean } = {}): TreeData {
  const anchors = resolveAnchors(artists);
  const sortKey = (a: TreeArtist) => [...a.slug].reduce((s, c) => (s * 31 + c.charCodeAt(0)) % 100003, 7);
  const inputs: CardInput[] = artists.map((a) => ({ id: a.id, anchor: anchors.get(a.id)?.year ?? null, sortKey: sortKey(a) }));
  const ids = new Set(artists.map((a) => a.id));
  const shown = relationships.filter((r) => r.status === "verified" || (opts.includeUnverified && r.status === "needs_review"));
  const edges: EdgeInput[] = shown.filter((r) => ids.has(r.fromId) && ids.has(r.toId)).map((r) => ({ id: r.id, from: r.fromId, to: r.toId, type: r.type }));
  const layout = layoutTimeTree(inputs, edges);
  const byId = new Map(artists.map((a) => [a.id, a]));
  const cards: TreeCard[] = layout.cards.map((c) => {
    const a = byId.get(c.id) as TreeArtist;
    const own = estimateAnchor(a);
    return {
      id: a.id,
      slug: a.slug,
      nameRu: a.nameRu,
      years: formatYears(a),
      initials: initials(a.nameRu),
      portraitUrl: usablePortrait(a),
      approx: own.approx || own.year === null,
      left: c.left,
      top: c.top,
      width: c.width,
      height: c.height,
    };
  });
  const typeOf = new Map(shown.map((r) => [r.id, r.type]));
  return {
    cards,
    edges: layout.edges.map((e) => ({ ...e, label: EDGE_LABEL[typeOf.get(e.id) ?? e.type] })),
    width: layout.width,
    height: layout.height,
    rows: layout.rows,
  };
}
