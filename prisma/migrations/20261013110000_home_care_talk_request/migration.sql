-- KODUTEENUS K6-k — „Soovin sellest rääkida" (kava II.6.3, pärast rasket käiku).
--
-- Hooldaja töötab üksi ja raske juhtumi (agressiivsus, õnnetus, inimese leidmine maast)
-- järel ei ole kedagi, kellega sellest rääkida, kui ta ise ei küsi. Erijuhtumi autor saab
-- ühe puudutusega öelda, et soovib sellest rääkida. Soov ei kanna teksti: hooldusjuht saab
-- teada, KES soovib rääkida ja mis juhtumi järel, mitte seda, mida töötaja tunneb.
--
-- Rida näevad soovi esitaja ja hooldusjuht; kliendi meeskond seda ei näe. Rida ei kustutata:
-- soov kas võetakse tagasi (`withdrawnAt`) või märgib hooldusjuht, et rääkimine on toimunud
-- (`handledAt`). Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareTalkRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "requesterName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),
    "handledAt" TIMESTAMP(3),
    "handledByMembershipId" TEXT,
    "handledByName" TEXT,

    CONSTRAINT "CareTalkRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareTalkRequest_organizationId_handledAt_idx" ON "CareTalkRequest"("organizationId", "handledAt");
CREATE INDEX "CareTalkRequest_entryId_idx" ON "CareTalkRequest"("entryId");

ALTER TABLE "CareTalkRequest"
  ADD CONSTRAINT "CareTalkRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CareTalkRequest"
  ADD CONSTRAINT "CareTalkRequest_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "CareClientEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Soov on kas lahtine, tagasi võetud või räägitud: tagasi võetud soovi ei saa märkida räägituks.
ALTER TABLE "CareTalkRequest"
  ADD CONSTRAINT "CareTalkRequest_state_check" CHECK ("withdrawnAt" IS NULL OR "handledAt" IS NULL);
-- Kes märkis räägituks, on kirjas ainult räägitud real.
ALTER TABLE "CareTalkRequest"
  ADD CONSTRAINT "CareTalkRequest_handledBy_check" CHECK ("handledAt" IS NOT NULL OR ("handledByMembershipId" IS NULL AND "handledByName" IS NULL));

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareTalkRequest";
