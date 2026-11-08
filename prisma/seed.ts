import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArtworksCsv, parseFactsCsv, parseGroupsCsv, parseMembershipsCsv, parseSummariesCsv, type Ctx } from "../src/lib/import/content";
import { parsePortraitsCsv, parseRelationshipsCsv, parseSourcesCsv } from "../src/lib/import/relationships";
import { parseSeedCsv } from "../src/lib/import/seed";
import { slugify } from "../src/lib/text";

const prisma = new PrismaClient();
const DATA = process.env.ATLAS_DATA_DIR ?? path.resolve(import.meta.dirname, "../data");
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

  const dbArtists = await prisma.artist.findMany({ select: { id: true, seedId: true, slug: true, birthYear: true, deathYear: true } });
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
      const links = r.sources.map((x) => ({ relationshipId: rel.id, sourceId: sourceDbId.get(x.id) as string, note: x.note }));
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

  // ---- сводки, факты, картины, объединения ----
  const ctx: Ctx = {
    artists: new Map(dbArtists.map((a) => [a.slug, { birthYear: a.birthYear, deathYear: a.deathYear }])),
    sourceIds: new Set(sources.records.map((x) => x.seedId)),
  };
  const idBySlug = new Map(dbArtists.map((a) => [a.slug, a.id]));
  const summaries = parseSummariesCsv(readData("summaries.csv"), ctx);
  const facts = parseFactsCsv(readData("facts_seed.csv"), ctx);
  const works = parseArtworksCsv(readData("artworks_seed.csv"), ctx);
  const groups = parseGroupsCsv(readData("groups_seed.csv"));
  const memberships = parseMembershipsCsv(readData("memberships_seed.csv"), ctx, new Map(groups.records.map((g) => [g.slug, { fromYear: g.fromYear, toYear: g.toYear }])));
  const content = { summaries, facts, works, groups, memberships };
  for (const [name, r] of Object.entries(content)) {
    r.issues.forEach((i) => console.error(`[ошибка: ${name}] строка ${i.line} (${i.id ?? "?"}): ${i.message}`));
    if ("warnings" in r) r.warnings.forEach((i) => console.warn(`[предупреждение: ${name}] строка ${i.line} (${i.id ?? "?"}): ${i.message}`));
    allIssues.push(...r.issues);
  }
  const contentIssues = Object.values(content).reduce((n, r) => n + r.issues.length, 0);
  if (contentIssues === 0) {
    for (const r of summaries.records) {
      await prisma.artist.update({ where: { slug: r.artistSlug }, data: { bio: r.summary, bioSourceId: sourceDbId.get(r.sourceSeedId) } });
    }
    for (const r of facts.records) {
      const data = { artistId: idBySlug.get(r.artistSlug) as string, text: r.text, sourceId: sourceDbId.get(r.sourceSeedId) as string, sortOrder: r.sortOrder };
      await prisma.artistFact.upsert({ where: { seedId: r.seedId }, update: data, create: { seedId: r.seedId, ...data } });
    }
    await prisma.artistFact.deleteMany({ where: { seedId: { not: null, notIn: facts.records.map((f) => f.seedId) } } });

    for (const g of groups.records) {
      const { seedId, ...rest } = g;
      await prisma.group.upsert({ where: { seedId }, update: rest, create: { seedId, ...rest } });
    }
    for (const w of works.records) {
      const prev = await prisma.artwork.findUnique({ where: { seedId: w.seedId } });
      if (prev?.verificationStatus === "verified") {
        console.warn(`[конфликт] картина ${w.seedId}: запись verified, черновые данные не применены`);
        continue;
      }
      const { seedId, artistSlugs, sourceSeedId, ...rest } = w;
      const data = { ...rest, sourceId: sourceSeedId ? sourceDbId.get(sourceSeedId) : null };
      const art = await prisma.artwork.upsert({ where: { seedId }, update: data, create: { seedId, ...data } });
      await prisma.artworkArtist.deleteMany({ where: { artworkId: art.id } });
      await prisma.artworkArtist.createMany({ data: artistSlugs.map((s) => ({ artworkId: art.id, artistId: idBySlug.get(s) as string })) });
    }
    await prisma.artwork.deleteMany({ where: { seedId: { not: null, notIn: works.records.map((w) => w.seedId) } } });

    const groupId = new Map((await prisma.group.findMany({ select: { id: true, slug: true } })).map((g) => [g.slug, g.id]));
    await prisma.artistGroup.deleteMany({});
    if (memberships.records.length) {
      await prisma.artistGroup.createMany({
        data: memberships.records.map((m) => ({
          artistId: idBySlug.get(m.artistSlug) as string,
          groupId: groupId.get(m.groupSlug) as string,
          fromYear: m.fromYear,
          toYear: m.toYear,
          verificationStatus: m.verificationStatus,
          sourceId: m.sourceSeedId ? sourceDbId.get(m.sourceSeedId) : null,
        })),
      });
    }
    console.log(`Контент: сводок ${summaries.records.length}, фактов ${facts.records.length}, картин ${works.records.length}, объединений ${groups.records.length}, участий ${memberships.records.length}.`);
  } else {
    console.error("Контент (сводки, факты, картины, объединения) не импортирован: исправьте ошибки выше.");
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
