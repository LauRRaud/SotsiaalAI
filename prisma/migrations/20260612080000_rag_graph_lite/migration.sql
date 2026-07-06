-- Graph-lite phase 1 (track C): RagEntity / RagRelation / RagChunkEntity.
-- Additive only; generated via prisma migrate diff against the live database
-- and trimmed to graph-related statements (pre-existing unrelated drift such
-- as timestamp precision and index-name truncations was deliberately excluded).

-- CreateEnum
CREATE TYPE "RagEntityType" AS ENUM ('SERVICE', 'BENEFIT', 'LAW', 'LEGAL_SECTION', 'MUNICIPALITY', 'ORGANIZATION', 'FORM', 'CONTACT_POINT', 'TARGET_GROUP', 'NEED', 'RISK_SIGNAL', 'DOCUMENT_TYPE', 'WORKFLOW');

-- CreateEnum
CREATE TYPE "RagRelationType" AS ENUM ('REGULATES', 'BELONGS_TO', 'PROVIDED_BY', 'ORGANIZED_BY', 'SUITABLE_FOR', 'REQUIRES', 'RELATED_TO', 'HAS_LEGAL_BASIS', 'HAS_DOCUMENT', 'HAS_FORM', 'HAS_NEXT_STEP', 'HAS_CONTACT_POINT', 'ASSESSES', 'MITIGATES_RISK', 'ESCALATES_TO', 'APPLIES_TO', 'AVAILABLE_IN');

-- CreateEnum
CREATE TYPE "RagGraphReviewStatus" AS ENUM ('AUTO_APPROVED', 'NEEDS_REVIEW', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "RagEntity" (
    "id" TEXT NOT NULL,
    "type" "RagEntityType" NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "externalKey" TEXT NOT NULL,
    "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "roles" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "reviewStatus" "RagGraphReviewStatus" NOT NULL DEFAULT 'AUTO_APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagRelation" (
    "id" TEXT NOT NULL,
    "fromEntityId" TEXT NOT NULL,
    "toEntityId" TEXT NOT NULL,
    "relationType" "RagRelationType" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "evidenceChunkId" TEXT,
    "sourceDocumentId" TEXT,
    "evidenceRef" TEXT,
    "extractor" TEXT NOT NULL DEFAULT 'deterministic_kov_v1',
    "reviewStatus" "RagGraphReviewStatus" NOT NULL DEFAULT 'AUTO_APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RagChunkEntity" (
    "id" TEXT NOT NULL,
    "chunkId" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "relevance" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "evidenceText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RagChunkEntity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RagEntity_externalKey_key" ON "RagEntity"("externalKey");

-- CreateIndex
CREATE INDEX "RagEntity_type_normalizedName_idx" ON "RagEntity"("type", "normalizedName");

-- CreateIndex
CREATE INDEX "RagEntity_normalizedName_idx" ON "RagEntity"("normalizedName");

-- CreateIndex
CREATE INDEX "RagRelation_relationType_idx" ON "RagRelation"("relationType");

-- CreateIndex
CREATE INDEX "RagRelation_toEntityId_idx" ON "RagRelation"("toEntityId");

-- CreateIndex
CREATE UNIQUE INDEX "RagRelation_fromEntityId_toEntityId_relationType_sourceDocu_key" ON "RagRelation"("fromEntityId", "toEntityId", "relationType", "sourceDocumentId");

-- CreateIndex
CREATE INDEX "RagChunkEntity_entityId_idx" ON "RagChunkEntity"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RagChunkEntity_chunkId_entityId_key" ON "RagChunkEntity"("chunkId", "entityId");

-- AddForeignKey
ALTER TABLE "RagRelation" ADD CONSTRAINT "RagRelation_fromEntityId_fkey" FOREIGN KEY ("fromEntityId") REFERENCES "RagEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RagRelation" ADD CONSTRAINT "RagRelation_toEntityId_fkey" FOREIGN KEY ("toEntityId") REFERENCES "RagEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RagChunkEntity" ADD CONSTRAINT "RagChunkEntity_entityId_fkey" FOREIGN KEY ("entityId") REFERENCES "RagEntity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
