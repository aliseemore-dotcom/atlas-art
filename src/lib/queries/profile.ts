import { prisma } from "@/lib/db";
import { buildProfile, type SourceRef } from "@/lib/profile";

const src = (s: { title: string; authorOrInstitution: string | null; url: string | null; publicationYear: number | null; page: string | null } | null): SourceRef | null =>
  s ? { title: s.title, authorOrInstitution: s.authorOrInstitution, url: s.url, publicationYear: s.publicationYear, page: s.page } : null;

/** Карточка художника для интерфейса: сводка, факты, картины, объединения, связи — каждое со своим источником и статусом. */
export async function getArtistProfile(slug: string) {
  const a = await prisma.artist.findUnique({
    where: { slug },
    include: {
      bioSource: true,
      facts: { include: { source: true } },
      works: { include: { artwork: { include: { source: true } } } },
      groups: { include: { group: true, source: true } },
      relationsFrom: { include: { to: { select: { slug: true, nameRu: true } }, sources: { include: { source: true } } } },
      relationsTo: { include: { from: { select: { slug: true, nameRu: true } }, sources: { include: { source: true } } } },
    },
  });
  if (!a) return null;
  return buildProfile({
    artist: { ...a, bioSource: src(a.bioSource) },
    facts: a.facts.map((f) => ({ text: f.text, sortOrder: f.sortOrder, source: src(f.source) })),
    works: a.works.map((w) => ({ ...w.artwork, source: src(w.artwork.source) })),
    groups: a.groups.map((g) => ({ nameRu: g.group.nameRu, slug: g.group.slug, type: g.group.type, fromYear: g.fromYear, toYear: g.toYear, verificationStatus: g.verificationStatus, source: src(g.source) })),
    relations: [
      ...a.relationsFrom.map((r) => ({ type: r.type, direction: "out" as const, other: r.to, status: r.verificationStatus, sources: r.sources.map((x) => ({ ...(src(x.source) as SourceRef), page: x.note ?? x.source.page })) })),
      ...a.relationsTo.map((r) => ({ type: r.type, direction: "in" as const, other: r.from, status: r.verificationStatus, sources: r.sources.map((x) => ({ ...(src(x.source) as SourceRef), page: x.note ?? x.source.page })) })),
    ],
  });
}
