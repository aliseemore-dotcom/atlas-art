import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePortraitsCsv, parseRelationshipsCsv, parseSourcesCsv } from "../src/lib/import/relationships";
import { parseSeedCsv } from "../src/lib/import/seed";
import { slugify } from "../src/lib/text";

const prisma = new PrismaClient();
const DATA = path.resolve(import.meta.dirname, "../data");
const CSV = path.join(DATA, "artists_seed.csv");
const readData = (f: string) => readFileSync(path.join(DATA, f), "utf8");

/** Идемпотентный импорт: upsert по постоянному seedId. Проверенные вручную записи (verified) не перезаписываются. */
async function main() {
  const { records, issues } = parseSeedCsv(readFileSync(CSV, "utf8"));

  for (const i of issues) console.error(`[ошибка] строка ${i.line} (${i.id ?? "?"}): ${i.message}`);

  const region = await prisma.region.upsert({
    where: { slug: "russia" },
    update: {},
    create: { slug: "russia", nameRu: "Россия", kind: "cultural_region" },
  });

  const movementIds = new Map<string, string>();
  const genreIds = new Map<string, string>();
  const refId = async (kind: "movement" | "genre", label: string) => {
    const cache = kind === "movement" ? movementIds : genreIds;
    const hit = cache.get(label);
    if (hit) return hit;
    const slug = slugify(label);
    const row =
      kind === "movement"
        ? await prisma.movement.upsert({ where: { slug }, update: {}, create: { slug, nameRu: label } })
        : await prisma.genre.upsert({ where: { slug }, update: {}, create: { slug, nameRu: label } });
    cache.set(label, row.id);
    return row.id;
  };

  let created = 0;
  let updated = 0;
  let skipped = 0;
  for (const r of records) {
    const existing = await prisma.artist.findUnique({ where: { seedId: r.seedId } });
    if (existing?.verificationStatus === "verified") {
      console.warn(`[конфликт] ${r.seedId} ${r.nameRu}: запись verified, черновые данные не применены`);
      skipped++;
      continue;
    }
    const data = {
      slug: r.slug,
      nameRu: r.nameRu,
      nameSearch: r.nameSearch,
      birthYear: r.birthYear,
      deathYear: r.deathYear,
      birthPrecision: r.birthPrecision,
      deathPrecision: r.deathPrecision,
      eraLabel: r.eraLabel,
      verificationStatus: r.verificationStatus,
      importance: r.importance,
    };
    const artist = await prisma.artist.upsert({
      where: { seedId: r.seedId },
      update: data,
      create: { seedId: r.seedId, ...data },
    });
    existing ? updated++ : created++;

    const movementLinks = await Promise.all(r.movements.map((l) => refId("movement", l)));
    const genreLinks = await Promise.all(r.genres.map((l) => refId("genre", l)));
    await prisma.$transaction([
      prisma.artistMovement.deleteMany({ where: { artistId: artist.id } }),
      prisma.artistMovement.createMany({ data: movementLinks.map((movementId) => ({ artistId: artist.id, movementId })) }),
      prisma.artistGenre.deleteMany({ where: { artistId: artist.id } }),
      prisma.artistGenre.createMany({ data: genreLinks.map((genreId) => ({ artistId: artist.id, genreId })) }),
      prisma.artistRegion.deleteMany({ where: { artistId: artist.id, regionId: region.id, role: "associated" } }),
      prisma.artistRegion.create({ data: { artistId: artist.id, regionId: region.id, role: "associated" } }),
    ]);
  }

  // ---- источники, связи, портреты ----
  const allIssues = [...issues];
  const sources = parseSourcesCsv(readData("sources_seed.csv"));
  sources.issues.forEach((i) => console.error(`[ошибка источника] строка ${i.line} (${i.id ?? "?"}): ${i.message}`));
  allIssues.push(...sources.issues);
  const sourceDbId = new Map<string, string>();
  for (const sr of sources.records) {
    const { seedId, ...rest } = sr;
    const row = await prisma.source.upsert({ where: { seedId }, update: rest, create: { seedId, ...rest } });
    sourceDbId.set(seedId, row.id);
  }

  const dbArtists = await prisma.artist.findMany({ select: { id: true, seedId: true, slug: true, birthYear: true } });
  const bySeed = new Map(dbArtists.filter((a) => a.seedId).map((a) => [a.seedId as string, a]));
  const rels = parseRelationshipsCsv(
    readData("relationships_seed.csv"),
    new Map([...bySeed].map(([k, a]) => [k, { slug: a.slug, birthYear: a.birthYear }])),
    new Set(sources.records.map((x) => x.seedId)),
  );
  rels.issues.forEach((i) => console.error(`[ошибка связи] строка ${i.line} (${i.id ?? "?"}): ${i.message}`));
  rels.warnings.forEach((i) => console.warn(`[предупреждение] связь ${i.id}: ${i.message}`));
  allIssues.push(...rels.issues);

  let relCount = 0;
  if (rels.issues.length === 0) {
    for (const r of rels.records) {
      const fromId = bySeed.get(r.fromSeedId)?.id as string;
      const toId = bySeed.get(r.toSeedId)?.id as string;
      const prev = await prisma.relationship.findUnique({ where: { seedId: r.seedId } });
      if (prev?.verificationStatus === "verified") {
        console.warn(`[конфликт] связь ${r.seedId}: запись verified, черновые данные не применены`);
        continue;
      }
      const data = { fromArtistId: fromId, toArtistId: toId, type: r.type, fromYear: r.fromYear, toYear: r.toYear, verificationStatus: r.verificationStatus, evidenceNote: r.evidenceNote };
      const rel = await prisma.relationship.upsert({ where: { seedId: r.seedId }, update: data, create: { seedId: r.seedId, ...data } });
      await prisma.relationshipSource.deleteMany({ where: { relationshipId: rel.id } });
      const links = r.sourceSeedIds.map((sid) => ({ relationshipId: rel.id, sourceId: sourceDbId.get(sid) as string }));
      if (links.length) await prisma.relationshipSource.createMany({ data: links });
      relCount++;
    }
  } else {
    console.error("Связи не импортированы: исправьте ошибки выше (частичный импорт связей не выполняется).");
  }

  const portraits = parsePortraitsCsv(readData("portraits.csv"), new Set(dbArtists.map((a) => a.slug)));
  portraits.issues.forEach((i) => console.error(`[ошибка портрета] строка ${i.line} (${i.id ?? "?"}): ${i.message}`));
  allIssues.push(...portraits.issues);
  for (const p of portraits.records) {
    await prisma.artist.update({
      where: { slug: p.slug },
      data: { portraitUrl: p.url, portraitRights: p.rights, portraitCredit: p.credit, portraitSourceUrl: p.sourceUrl },
    });
  }

  console.log(`Связи: ${relCount}, источники: ${sources.records.length}, портреты: ${portraits.records.length}.`);
  console.log(
    `Импорт: создано ${created}, обновлено ${updated}, пропущено (verified) ${skipped}, ошибок в CSV ${issues.length}.`,
  );
  if (allIssues.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
