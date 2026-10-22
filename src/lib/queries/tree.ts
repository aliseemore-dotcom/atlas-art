import { prisma } from "@/lib/db";
import { buildTree, type TreeArtist, type TreeRelationship } from "@/lib/tree/build";

const select = {
  id: true, slug: true, nameRu: true, birthYear: true, deathYear: true, activeFrom: true, activeTo: true,
  birthPrecision: true, deathPrecision: true, eraLabel: true,
  portraitUrl: true, portraitRights: true, portraitCredit: true, portraitSourceUrl: true,
} as const;

/** Все художники региона и их связи (кроме draft). Данные отделены от представления: раскладка считается заново на каждый запрос. */
export async function getTree(regionSlug: string, opts: { includeUnverified?: boolean } = {}) {
  const inRegion = { regions: { some: { region: { slug: regionSlug } } } };
  const [artists, rels] = await Promise.all([
    prisma.artist.findMany({ where: inRegion, select }),
    prisma.relationship.findMany({
      where: { verificationStatus: { in: ["needs_review", "verified"] }, from: inRegion, to: inRegion },
      select: { id: true, fromArtistId: true, toArtistId: true, type: true, verificationStatus: true },
    }),
  ]);
  const relationships: TreeRelationship[] = rels.map((r) => ({ id: r.id, fromId: r.fromArtistId, toId: r.toArtistId, type: r.type, status: r.verificationStatus }));
  return buildTree(artists as TreeArtist[], relationships, opts);
}
