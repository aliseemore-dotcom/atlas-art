-- CreateEnum
CREATE TYPE "DatePrecision" AS ENUM ('exact', 'circa', 'range', 'unknown');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('draft', 'needs_review', 'verified');

-- CreateEnum
CREATE TYPE "Importance" AS ENUM ('core', 'extended');

-- CreateEnum
CREATE TYPE "RegionKind" AS ENUM ('cultural_region', 'modern_country', 'historical_state', 'city');

-- CreateEnum
CREATE TYPE "ArtistRegionRole" AS ENUM ('born', 'worked', 'studied', 'associated');

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seedId" TEXT,
    "nameRu" TEXT NOT NULL,
    "nameOriginal" TEXT,
    "alternateNames" TEXT[],
    "nameSearch" TEXT NOT NULL DEFAULT '',
    "birthYear" INTEGER,
    "deathYear" INTEGER,
    "activeFrom" INTEGER,
    "activeTo" INTEGER,
    "birthPrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "deathPrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "birthYearMin" INTEGER,
    "birthYearMax" INTEGER,
    "deathYearMin" INTEGER,
    "deathYearMax" INTEGER,
    "bio" TEXT,
    "eraLabel" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'draft',
    "importance" "Importance" NOT NULL DEFAULT 'extended',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "description" TEXT,

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Genre" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "Genre_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Region" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nameRu" TEXT NOT NULL,
    "kind" "RegionKind" NOT NULL,
    "activeFrom" INTEGER,
    "activeTo" INTEGER,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistMovement" (
    "artistId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,

    CONSTRAINT "ArtistMovement_pkey" PRIMARY KEY ("artistId","movementId")
);

-- CreateTable
CREATE TABLE "ArtistGenre" (
    "artistId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "ArtistGenre_pkey" PRIMARY KEY ("artistId","genreId")
);

-- CreateTable
CREATE TABLE "ArtistRegion" (
    "artistId" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "role" "ArtistRegionRole" NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,

    CONSTRAINT "ArtistRegion_pkey" PRIMARY KEY ("artistId","regionId","role")
);

-- CreateIndex
CREATE UNIQUE INDEX "Artist_slug_key" ON "Artist"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_seedId_key" ON "Artist"("seedId");

-- CreateIndex
CREATE INDEX "Artist_birthYear_idx" ON "Artist"("birthYear");

-- CreateIndex
CREATE INDEX "Artist_nameSearch_idx" ON "Artist"("nameSearch");

-- CreateIndex
CREATE UNIQUE INDEX "Movement_slug_key" ON "Movement"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Genre_slug_key" ON "Genre"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Region_slug_key" ON "Region"("slug");

-- CreateIndex
CREATE INDEX "ArtistMovement_movementId_idx" ON "ArtistMovement"("movementId");

-- CreateIndex
CREATE INDEX "ArtistGenre_genreId_idx" ON "ArtistGenre"("genreId");

-- CreateIndex
CREATE INDEX "ArtistRegion_regionId_idx" ON "ArtistRegion"("regionId");

-- AddForeignKey
ALTER TABLE "ArtistMovement" ADD CONSTRAINT "ArtistMovement_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistMovement" ADD CONSTRAINT "ArtistMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGenre" ADD CONSTRAINT "ArtistGenre_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGenre" ADD CONSTRAINT "ArtistGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistRegion" ADD CONSTRAINT "ArtistRegion_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistRegion" ADD CONSTRAINT "ArtistRegion_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE CASCADE ON UPDATE CASCADE;
