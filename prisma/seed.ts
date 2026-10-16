import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSeedCsv } from "../src/lib/import/seed";
import { slugify } from "../src/lib/text";

const prisma = new PrismaClient();
const CSV = path.resolve(import.meta.dirname, "../data/artists_seed.csv");

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

  console.log(
    `Импорт: создано ${created}, обновлено ${updated}, пропущено (verified) ${skipped}, ошибок в CSV ${issues.length}.`,
  );
  if (issues.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
