-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('teacher_of', 'influenced', 'collaborated');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('museum', 'catalogue', 'scholarly', 'book', 'other');

-- CreateEnum
CREATE TYPE "ImageRights" AS ENUM ('unknown', 'public_domain', 'licensed');

-- AlterTable
ALTER TABLE "Artist" ADD COLUMN     "portraitCredit" TEXT,
ADD COLUMN     "portraitRights" "ImageRights" NOT NULL DEFAULT 'unknown',
ADD COLUMN     "portraitSourceUrl" TEXT,
ADD COLUMN     "portraitUrl" TEXT;

-- CreateTable
CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "seedId" TEXT,
    "title" TEXT NOT NULL,
    "authorOrInstitution" TEXT,
    "url" TEXT,
    "publicationYear" INTEGER,
    "page" TEXT,
    "notes" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'other',

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Relationship" (
    "id" TEXT NOT NULL,
    "seedId" TEXT,
    "fromArtistId" TEXT NOT NULL,
    "toArtistId" TEXT NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "fromYear" INTEGER,
    "toYear" INTEGER,
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'needs_review',
    "evidenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Relationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RelationshipSource" (
    "relationshipId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "RelationshipSource_pkey" PRIMARY KEY ("relationshipId","sourceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Source_seedId_key" ON "Source"("seedId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_seedId_key" ON "Relationship"("seedId");

-- CreateIndex
CREATE INDEX "Relationship_toArtistId_idx" ON "Relationship"("toArtistId");

-- CreateIndex
CREATE UNIQUE INDEX "Relationship_fromArtistId_toArtistId_type_key" ON "Relationship"("fromArtistId", "toArtistId", "type");

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_fromArtistId_fkey" FOREIGN KEY ("fromArtistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relationship" ADD CONSTRAINT "Relationship_toArtistId_fkey" FOREIGN KEY ("toArtistId") REFERENCES "Artist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipSource" ADD CONSTRAINT "RelationshipSource_relationshipId_fkey" FOREIGN KEY ("relationshipId") REFERENCES "Relationship"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RelationshipSource" ADD CONSTRAINT "RelationshipSource_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;
