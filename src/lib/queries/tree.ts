import { prisma } from "@/lib/db";
import { assembleTree, type TreeArtist, type TreeRelationship } from "@/lib/tree/assemble";

const artistSelect = {
  id: true, slug: true, nameRu: true, birthYear: true, deathYear: true, birthPrecision: true, deathPrecision: true,
  portraitUrl: true, portraitRights: true, portraitCredit: true, portraitSourceUrl: true,
} as const;

/** Данные древа региона: все связи региона (кроме draft) собираются, показ unverified решает showUnverified. */
export async function getTree(regionSlug: string, opts: { branch?: string; showUnverified: boolean }) {
  const regionFilter = { regions: { some: { region: { slug: regionSlug } } } };
  const [artists, rels] = await Promise.all([
    prisma.artist.findMany({ where: regionFilter, select: artistSelect }),
    prisma.relationship.findMany({
      where: { verificationStatus: { in: ["needs_review", "verified"] }, from: regionFilter, to: regionFilter },
      include: { sources: { include: { source: true } } },
    }),
  ]);
  const relationships: TreeRelationship[] = rels.map((r) => ({
    id: r.id,
    fromId: r.fromArtistId,
    toId: r.toArtistId,
    type: r.type,
    status: r.verificationStatus,
    evidenceNote: r.evidenceNote,
    sources: r.sources.map((s) => ({
      title: s.source.title,
      authorOrInstitution: s.source.authorOrInstitution,
      url: s.source.url,
      publicationYear: s.source.publicationYear,
      page: s.source.page,
    })),
  }));
  return assembleTree(artists as TreeArtist[], relationships, opts);
}

/** Подтверждённые связи и связи с источником конкретного художника (для карточки). */
export async function getArtistRelationships(artistId: string) {
  const rels = await prisma.relationship.findMany({
    where: { verificationStatus: { in: ["needs_review", "verified"] }, OR: [{ fromArtistId: artistId }, { toArtistId: artistId }] },
    include: { from: { select: { slug: true, nameRu: true } }, to: { select: { slug: true, nameRu: true } }, sources: { include: { source: true } } },
  });
  return rels;
}
