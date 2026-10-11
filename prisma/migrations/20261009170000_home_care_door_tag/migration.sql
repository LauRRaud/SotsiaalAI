-- KODUTEENUS K1-g — uksesilt: juhuslik tunnus, mis viib kliendi lehele.
--
-- Aditiivne: üks uus tabel. Olemasolevaid tabeleid ei muudeta; eelmine
-- rakenduse versioon seda tabelit ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareClientDoorTag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdByMembershipId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "revokedByMembershipId" TEXT,

    CONSTRAINT "CareClientDoorTag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CareClientDoorTag_token_key" ON "CareClientDoorTag"("token");

CREATE INDEX "CareClientDoorTag_clientId_revokedAt_idx" ON "CareClientDoorTag"("clientId", "revokedAt");

ALTER TABLE "CareClientDoorTag" ADD CONSTRAINT "CareClientDoorTag_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reegel, mida Prisma skeem ei väljenda: kliendil on korraga üks kehtiv silt.
CREATE UNIQUE INDEX "CareClientDoorTag_one_active_per_client" ON "CareClientDoorTag"("clientId") WHERE "revokedAt" IS NULL;

-- Tunnus on piisavalt pikk, et seda ei saaks ära arvata.
ALTER TABLE "CareClientDoorTag"
  ADD CONSTRAINT "CareClientDoorTag_token_length" CHECK (length("token") >= 22);

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareClientDoorTag" CASCADE;
