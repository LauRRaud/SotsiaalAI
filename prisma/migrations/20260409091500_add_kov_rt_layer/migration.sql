ALTER TYPE "public"."KovAdminFileRole" ADD VALUE 'RT_JSON';
ALTER TYPE "public"."KovAdminFileRole" ADD VALUE 'RT_MD';

CREATE TYPE "public"."KovRtStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'NEEDS_REVIEW', 'READY');

ALTER TABLE "public"."MunicipalityKovAdmin"
ADD COLUMN "rtCheckedAt" TIMESTAMP(3),
ADD COLUMN "rtNotes" TEXT,
ADD COLUMN "rtStatus" "public"."KovRtStatus" NOT NULL DEFAULT 'NOT_STARTED';

CREATE INDEX "MunicipalityKovAdmin_rtCheckedAt_idx"
ON "public"."MunicipalityKovAdmin"("rtCheckedAt");

CREATE INDEX "MunicipalityKovAdmin_rtStatus_idx"
ON "public"."MunicipalityKovAdmin"("rtStatus");
