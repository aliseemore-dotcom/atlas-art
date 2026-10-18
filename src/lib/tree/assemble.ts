import { initials, surnameCaps, toRoman } from "@/lib/text";
import { formatLifespan, type DatePrecision } from "@/lib/timeline/interval";
import { findBranches, layoutTree, type LayoutEdge, type LayoutNode, type TreeEdgeInput, type TreeLayout, type TreeNodeInput } from "./layout";

export interface TreeArtist {
  id: string;
  slug: string;
  nameRu: string;
  birthYear: number | null;
  deathYear: number | null;
  birthPrecision: DatePrecision;
  deathPrecision: DatePrecision;
  portraitUrl: string | null;
  portraitRights: "unknown" | "public_domain" | "licensed";
  portraitCredit: string | null;
  portraitSourceUrl: string | null;
}

export interface TreeSource {
  title: string;
  authorOrInstitution: string | null;
  url: string | null;
  publicationYear: number | null;
  page: string | null;
}

export interface TreeRelationship {
  id: string;
  fromId: string;
  toId: string;
  type: "teacher_of" | "influenced" | "collaborated";
  status: "draft" | "needs_review" | "verified";
  evidenceNote: string | null;
  sources: TreeSource[];
}

export interface TreeNodeView extends LayoutNode {
  slug: string;
  nameRu: string;
  years: string;
  initials: string;
  /** только при подтверждённых правах и указанных авторе и источнике */
  portrait: { url: string; credit: string; sourceUrl: string } | null;
}

export interface BranchSummary {
  key: string; // slug первого мастера — стабильный ключ в URL
  roman: string;
  label: string; // ВЕТВЬ I / САВРАСОВ · ПОЛЕНОВ
  count: number;
  masters: { slug: string; nameRu: string; initials: string; portraitUrl: string | null }[];
}

export interface TreeView {
  branches: BranchSummary[];
  current: BranchSummary | null;
  layout: TreeLayout;
  nodes: TreeNodeView[];
  edges: LayoutEdge[];
  relationships: Record<string, TreeRelationship & { fromSlug: string; toSlug: string }>;
  unverifiedCount: number;
}

/** Портрет допускается только с подтверждёнными правами, автором и источником (правило 8 проекта). */
export function usablePortrait(a: TreeArtist): TreeNodeView["portrait"] {
  if (!a.portraitUrl || !a.portraitCredit || !a.portraitSourceUrl) return null;
  if (a.portraitRights !== "public_domain" && a.portraitRights !== "licensed") return null;
  return { url: a.portraitUrl, credit: a.portraitCredit, sourceUrl: a.portraitSourceUrl };
}

export function assembleTree(
  artists: TreeArtist[],
  relationships: TreeRelationship[],
  opts: { branch?: string; showUnverified: boolean },
): TreeView {
  // draft никогда не показывается; needs_review — только если включено и с пометкой
  const visible = relationships.filter((r) => r.status === "verified" || (opts.showUnverified && r.status === "needs_review"));
  const unverifiedCount = relationships.filter((r) => r.status === "needs_review").length;
  const byId = new Map(artists.map((a) => [a.id, a]));
  const sortKey = (a: TreeArtist) => (a.birthYear ?? a.deathYear ?? 9999) * 1000 + [...a.slug].reduce((s, c) => (s + c.charCodeAt(0)) % 1000, 0) / 1000;

  const nodesIn: TreeNodeInput[] = artists.map((a) => ({ id: a.id, sortKey: sortKey(a), nameRu: a.nameRu }));
  const edgesIn: TreeEdgeInput[] = visible
    .filter((r) => byId.has(r.fromId) && byId.has(r.toId))
    .map((r) => ({ id: r.id, from: r.fromId, to: r.toId, type: r.type, verified: r.status === "verified" }));

  const branchesRaw = findBranches(nodesIn, edgesIn);
  const summaries: BranchSummary[] = branchesRaw.map((b, i) => {
    const masters = b.masterIds.map((id) => byId.get(id) as TreeArtist);
    const shown = masters.slice(0, 3).map((m) => surnameCaps(m.nameRu));
    return {
      key: (masters[0] as TreeArtist).slug,
      roman: toRoman(i + 1),
      label: `ВЕТВЬ ${toRoman(i + 1)} / ${shown.join(" · ")}${masters.length > 3 ? " …" : ""}`,
      count: b.nodeIds.length,
      masters: masters.slice(0, 3).map((m) => ({ slug: m.slug, nameRu: m.nameRu, initials: initials(m.nameRu), portraitUrl: usablePortrait(m)?.url ?? null })),
    };
  });

  let idx = 0;
  if (opts.branch) {
    const found = branchesRaw.findIndex((b) => b.nodeIds.some((id) => byId.get(id)?.slug === opts.branch));
    if (found >= 0) idx = found;
  }
  const chosen = branchesRaw[idx];
  if (!chosen) {
    return { branches: [], current: null, layout: { nodes: [], edges: [], width: 0, height: 0, ranks: 0 }, nodes: [], edges: [], relationships: {}, unverifiedCount };
  }
  const inBranch = new Set(chosen.nodeIds);
  const layout = layoutTree(
    nodesIn.filter((n) => inBranch.has(n.id)),
    edgesIn.filter((e) => inBranch.has(e.from) && inBranch.has(e.to)),
  );
  const nodes: TreeNodeView[] = layout.nodes.map((n) => {
    const a = byId.get(n.id) as TreeArtist;
    return {
      ...n,
      slug: a.slug,
      nameRu: a.nameRu,
      years: formatLifespan({ birthYear: a.birthYear, deathYear: a.deathYear, activeFrom: null, activeTo: null, birthPrecision: a.birthPrecision, deathPrecision: a.deathPrecision }),
      initials: initials(a.nameRu),
      portrait: usablePortrait(a),
    };
  });
  const relMap: TreeView["relationships"] = {};
  for (const r of visible) {
    if (!inBranch.has(r.fromId) || !inBranch.has(r.toId)) continue;
    relMap[r.id] = { ...r, fromSlug: (byId.get(r.fromId) as TreeArtist).slug, toSlug: (byId.get(r.toId) as TreeArtist).slug };
  }
  return { branches: summaries, current: summaries[idx] as BranchSummary, layout, nodes, edges: layout.edges, relationships: relMap, unverifiedCount };
}
