-- CreateEnum
CREATE TYPE "GroupType" AS ENUM ('artist_collective', 'association', 'school', 'workshop');

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "bioSourceId" TEXT;

-- CreateTable
CREATE TABLE "ArtistFact" (
    "id" TEXT NOT NULL,
    "seedId" TEXT,
    "artistId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ArtistFact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seedId" TEXT,
    "titleRu" TEXT NOT NULL,
    "yearFrom" INTEGER,
    "yearTo" INTEGER,
    "yearPrecision" "DatePrecision" NOT NULL DEFAULT 'unknown',
    "medium" TEXT,
    "currentCollection" TEXT,
    "imageUrl" TEXT,
    "imageRights" "ImageRights" NOT NULL DEFAULT 'unknown',
    "imageCredit" TEXT,
    "imageSourceUrl" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'needs_review',
    "sourceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkArtist" (
    "artworkId" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,

    CONSTRAINT "ArtworkArtist_pkey" PRIMARY KEY ("artworkId","artistId")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "seedId" TEXT,
    "nameRu" TEXT NOT NULL,
    "type" "GroupType" NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "description" TEXT,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'needs_review',

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtistGroup" (
    "artistId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'needs_review',
    "sourceId" TEXT,

    CONSTRAINT "ArtistGroup_pkey" PRIMARY KEY ("artistId","groupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ArtistFact_seedId_key" ON "ArtistFact"("seedId");

-- CreateIndex
CREATE INDEX "ArtistFact_artistId_idx" ON "ArtistFact"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_slug_key" ON "Artwork"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Artwork_seedId_key" ON "Artwork"("seedId");

-- CreateIndex
CREATE INDEX "ArtworkArtist_artistId_idx" ON "ArtworkArtist"("artistId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Group_seedId_key" ON "Group"("seedId");

-- CreateIndex
CREATE INDEX "ArtistGroup_groupId_idx" ON "ArtistGroup"("groupId");

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_bioSourceId_fkey" FOREIGN KEY ("bioSourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistFact" ADD CONSTRAINT "ArtistFact_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistFact" ADD CONSTRAINT "ArtistFact_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkArtist" ADD CONSTRAINT "ArtworkArtist_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkArtist" ADD CONSTRAINT "ArtworkArtist_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGroup" ADD CONSTRAINT "ArtistGroup_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGroup" ADD CONSTRAINT "ArtistGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtistGroup" ADD CONSTRAINT "ArtistGroup_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
