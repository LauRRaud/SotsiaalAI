-- KODUTEENUS kiht 3, K3-e — hooldaja teade „Mul on takistus" (kava II.6.10).
--
-- Hooldaja teatab ise, et tema tänane päev ei lähe plaani järgi: hilineb umbes pool
-- tundi või umbes tunni, auto on rikkis, tee on läbimatu või ta ei saa täna töötada.
-- Hooldusjuht näeb teadet päevaplaanis koos selle töötaja tegemata käikudega tähtsuse
-- järjekorras ja märgib teate vaadatuks.
--
-- MIDA EI HOITA. Ainult liik viiest valikust: vaba teksti välja ei ole ja põhjust
-- lähemalt ei küsita (see oleks sageli terviseandmed).
--
-- Rida ei kustutata: töötaja võtab teate tagasi (`withdrawnAt`) või hooldusjuht vaatab
-- selle üle (`handledAt`). Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareObstacle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "handledAt" TIMESTAMP(3),
    "handledByMembershipId" TEXT,
    "handledByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareObstacle_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareObstacle_organizationId_day_idx" ON "CareObstacle"("organizationId", "day");
CREATE INDEX "CareObstacle_membershipId_day_idx" ON "CareObstacle"("membershipId", "day");

-- Ühel töötajal on ühe päeva kohta korraga üks lahtine teade (ei ole tagasi võetud ega
-- üle vaadatud). Uus teade võtab eelmise lahtise tagasi.
CREATE UNIQUE INDEX "CareObstacle_open_key" ON "CareObstacle"("membershipId", "day")
  WHERE "withdrawnAt" IS NULL AND "handledAt" IS NULL;

-- Liikmesuse kadumisel kaob ka teade: ilma töötajata ei ole sellel tähendust.
ALTER TABLE "CareObstacle"
  ADD CONSTRAINT "CareObstacle_membershipId_fkey"
  FOREIGN KEY ("membershipId") REFERENCES "OrganizationMembership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareObstacle"
  ADD CONSTRAINT "CareObstacle_kind_check"
  CHECK ("kind" IN ('LATE_30', 'LATE_60', 'CAR_BROKEN', 'ROAD_BLOCKED', 'CANNOT_WORK'));
-- Päev kujul AAAA-KK-PP.
ALTER TABLE "CareObstacle"
  ADD CONSTRAINT "CareObstacle_day_check" CHECK ("day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');
-- Teade on kas tagasi võetud või üle vaadatud, mitte mõlemat.
ALTER TABLE "CareObstacle"
  ADD CONSTRAINT "CareObstacle_state_check" CHECK ("withdrawnAt" IS NULL OR "handledAt" IS NULL);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareObstacle";
