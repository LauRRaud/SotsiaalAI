-- CreateEnum
CREATE TYPE "public"."MunicipalityType" AS ENUM ('LINN', 'VALD');

-- CreateEnum
CREATE TYPE "public"."HelpRecordStatus" AS ENUM ('DRAFT', 'OPEN', 'MATCHED', 'CLOSED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "public"."HelpType" AS ENUM ('VOLUNTARY', 'PAID', 'MIXED');

-- CreateEnum
CREATE TYPE "public"."TimeType" AS ENUM ('ONE_TIME', 'RECURRING', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "public"."ClassificationSource" AS ENUM ('AI', 'USER', 'MANUAL');

-- CreateEnum
CREATE TYPE "public"."HelpMatchStatus" AS ENUM ('PENDING', 'CONTACTED', 'ACCEPTED', 'DECLINED', 'CLOSED');

-- CreateTable
CREATE TABLE "public"."Municipality" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "baseName" TEXT NOT NULL,
    "type" "public"."MunicipalityType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "county" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Municipality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelEt" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "descriptionEt" TEXT,
    "descriptionEn" TEXT,
    "descriptionRu" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TargetGroup" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelEt" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelRu" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TargetGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "municipalityId" TEXT,
    "primaryCategoryId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "structuredSummary" TEXT,
    "roleLabel" TEXT,
    "rawPlace" TEXT,
    "helpType" "public"."HelpType",
    "timeType" "public"."TimeType",
    "status" "public"."HelpRecordStatus" NOT NULL DEFAULT 'OPEN',
    "classificationSource" "public"."ClassificationSource" NOT NULL DEFAULT 'AI',
    "classificationConfidence" DOUBLE PRECISION,
    "userConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpOffer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "municipalityId" TEXT,
    "primaryCategoryId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT NOT NULL,
    "structuredSummary" TEXT,
    "roleLabel" TEXT,
    "rawPlace" TEXT,
    "helpType" "public"."HelpType",
    "timeType" "public"."TimeType",
    "status" "public"."HelpRecordStatus" NOT NULL DEFAULT 'OPEN',
    "classificationSource" "public"."ClassificationSource" NOT NULL DEFAULT 'AI',
    "classificationConfidence" DOUBLE PRECISION,
    "userConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."HelpRequestCategory" (
    "requestId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "HelpRequestCategory_pkey" PRIMARY KEY ("requestId","categoryId")
);

-- CreateTable
CREATE TABLE "public"."HelpOfferCategory" (
    "offerId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    CONSTRAINT "HelpOfferCategory_pkey" PRIMARY KEY ("offerId","categoryId")
);

-- CreateTable
CREATE TABLE "public"."HelpRequestTargetGroup" (
    "requestId" TEXT NOT NULL,
    "targetGroupId" TEXT NOT NULL,

    CONSTRAINT "HelpRequestTargetGroup_pkey" PRIMARY KEY ("requestId","targetGroupId")
);

-- CreateTable
CREATE TABLE "public"."HelpOfferTargetGroup" (
    "offerId" TEXT NOT NULL,
    "targetGroupId" TEXT NOT NULL,

    CONSTRAINT "HelpOfferTargetGroup_pkey" PRIMARY KEY ("offerId","targetGroupId")
);

-- CreateTable
CREATE TABLE "public"."HelpMatch" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "offererId" TEXT NOT NULL,
    "roomId" TEXT,
    "status" "public"."HelpMatchStatus" NOT NULL DEFAULT 'PENDING',
    "scoreSnapshot" DOUBLE PRECISION,
    "reasonsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HelpMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_slug_key" ON "public"."Municipality"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Municipality_displayName_key" ON "public"."Municipality"("displayName");

-- CreateIndex
CREATE INDEX "Municipality_baseName_idx" ON "public"."Municipality"("baseName");

-- CreateIndex
CREATE INDEX "Municipality_type_idx" ON "public"."Municipality"("type");

-- CreateIndex
CREATE INDEX "Municipality_isActive_idx" ON "public"."Municipality"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "HelpCategory_code_key" ON "public"."HelpCategory"("code");

-- CreateIndex
CREATE INDEX "HelpCategory_isActive_idx" ON "public"."HelpCategory"("isActive");

-- CreateIndex
CREATE INDEX "HelpCategory_sortOrder_idx" ON "public"."HelpCategory"("sortOrder");

-- CreateIndex
CREATE INDEX "HelpCategory_parentId_idx" ON "public"."HelpCategory"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "TargetGroup_code_key" ON "public"."TargetGroup"("code");

-- CreateIndex
CREATE INDEX "HelpRequest_userId_idx" ON "public"."HelpRequest"("userId");

-- CreateIndex
CREATE INDEX "HelpRequest_municipalityId_idx" ON "public"."HelpRequest"("municipalityId");

-- CreateIndex
CREATE INDEX "HelpRequest_primaryCategoryId_idx" ON "public"."HelpRequest"("primaryCategoryId");

-- CreateIndex
CREATE INDEX "HelpRequest_status_idx" ON "public"."HelpRequest"("status");

-- CreateIndex
CREATE INDEX "HelpRequest_createdAt_idx" ON "public"."HelpRequest"("createdAt");

-- CreateIndex
CREATE INDEX "HelpOffer_userId_idx" ON "public"."HelpOffer"("userId");

-- CreateIndex
CREATE INDEX "HelpOffer_municipalityId_idx" ON "public"."HelpOffer"("municipalityId");

-- CreateIndex
CREATE INDEX "HelpOffer_primaryCategoryId_idx" ON "public"."HelpOffer"("primaryCategoryId");

-- CreateIndex
CREATE INDEX "HelpOffer_status_idx" ON "public"."HelpOffer"("status");

-- CreateIndex
CREATE INDEX "HelpOffer_createdAt_idx" ON "public"."HelpOffer"("createdAt");

-- CreateIndex
CREATE INDEX "HelpRequestCategory_categoryId_idx" ON "public"."HelpRequestCategory"("categoryId");

-- CreateIndex
CREATE INDEX "HelpOfferCategory_categoryId_idx" ON "public"."HelpOfferCategory"("categoryId");

-- CreateIndex
CREATE INDEX "HelpRequestTargetGroup_targetGroupId_idx" ON "public"."HelpRequestTargetGroup"("targetGroupId");

-- CreateIndex
CREATE INDEX "HelpOfferTargetGroup_targetGroupId_idx" ON "public"."HelpOfferTargetGroup"("targetGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpMatch_requestId_offerId_key" ON "public"."HelpMatch"("requestId", "offerId");

-- CreateIndex
CREATE INDEX "HelpMatch_requesterId_idx" ON "public"."HelpMatch"("requesterId");

-- CreateIndex
CREATE INDEX "HelpMatch_offererId_idx" ON "public"."HelpMatch"("offererId");

-- CreateIndex
CREATE UNIQUE INDEX "HelpMatch_roomId_key" ON "public"."HelpMatch"("roomId");

-- CreateIndex
CREATE INDEX "HelpMatch_status_idx" ON "public"."HelpMatch"("status");

-- AddForeignKey
ALTER TABLE "public"."HelpCategory" ADD CONSTRAINT "HelpCategory_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."HelpCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequest" ADD CONSTRAINT "HelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequest" ADD CONSTRAINT "HelpRequest_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "public"."Municipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequest" ADD CONSTRAINT "HelpRequest_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "public"."HelpCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOffer" ADD CONSTRAINT "HelpOffer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOffer" ADD CONSTRAINT "HelpOffer_municipalityId_fkey" FOREIGN KEY ("municipalityId") REFERENCES "public"."Municipality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOffer" ADD CONSTRAINT "HelpOffer_primaryCategoryId_fkey" FOREIGN KEY ("primaryCategoryId") REFERENCES "public"."HelpCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequestCategory" ADD CONSTRAINT "HelpRequestCategory_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequestCategory" ADD CONSTRAINT "HelpRequestCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."HelpCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOfferCategory" ADD CONSTRAINT "HelpOfferCategory_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."HelpOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOfferCategory" ADD CONSTRAINT "HelpOfferCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."HelpCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequestTargetGroup" ADD CONSTRAINT "HelpRequestTargetGroup_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpRequestTargetGroup" ADD CONSTRAINT "HelpRequestTargetGroup_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "public"."TargetGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOfferTargetGroup" ADD CONSTRAINT "HelpOfferTargetGroup_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."HelpOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpOfferTargetGroup" ADD CONSTRAINT "HelpOfferTargetGroup_targetGroupId_fkey" FOREIGN KEY ("targetGroupId") REFERENCES "public"."TargetGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpMatch" ADD CONSTRAINT "HelpMatch_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."HelpRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpMatch" ADD CONSTRAINT "HelpMatch_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "public"."HelpOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."HelpMatch" ADD CONSTRAINT "HelpMatch_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
