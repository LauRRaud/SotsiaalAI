-- KODUTEENUS K5-w — transpordi soov ja järgmine sõit (kava II.6.14, variandi A esimene samm).
--
-- Kliendi meeskonna liige või hooldusjuht paneb kirja soovi („Telli transport": päev,
-- kellaaeg, sihtkoht, mida on vaja) ja hooldusjuht vastab: korraldatud (mis kell auto tuleb)
-- või ei saa (põhjusega). Korraldatud sõit on kliendi lehel ja selle päeva käigu juures näha.
-- Sõitu ennast platvorm ei telli.
--
-- Ridu ei kustutata: soov saab vastuse või võetakse tagasi.
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareTransportRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "wantedOn" TEXT NOT NULL,
    "wantedTime" TEXT,
    "destination" TEXT NOT NULL,
    "needs" TEXT,
    "requestedByMembershipId" TEXT,
    "requestedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "state" TEXT NOT NULL DEFAULT 'REQUESTED',
    "pickupTime" TEXT,
    "answerNote" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredByMembershipId" TEXT,
    "answeredByName" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnByMembershipId" TEXT,

    CONSTRAINT "CareTransportRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareTransportRequest_clientId_wantedOn_idx" ON "CareTransportRequest"("clientId", "wantedOn");
CREATE INDEX "CareTransportRequest_organizationId_state_wantedOn_idx" ON "CareTransportRequest"("organizationId", "state", "wantedOn");

ALTER TABLE "CareTransportRequest"
  ADD CONSTRAINT "CareTransportRequest_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareTransportRequest"
  ADD CONSTRAINT "CareTransportRequest_state_check" CHECK ("state" IN ('REQUESTED', 'ARRANGED', 'DECLINED', 'WITHDRAWN'));
ALTER TABLE "CareTransportRequest"
  ADD CONSTRAINT "CareTransportRequest_text_check"
  CHECK (
    "wantedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND ("wantedTime" IS NULL OR "wantedTime" ~ '^[0-2][0-9]:[0-5][0-9]$')
    AND ("pickupTime" IS NULL OR "pickupTime" ~ '^[0-2][0-9]:[0-5][0-9]$')
    AND char_length(btrim("destination")) BETWEEN 1 AND 200
    AND ("needs" IS NULL OR char_length(btrim("needs")) BETWEEN 1 AND 200)
    AND ("answerNote" IS NULL OR char_length(btrim("answerNote")) BETWEEN 1 AND 200)
  );
-- Ootel soovil vastust ei ole; vastatud soovil on vastuse aeg; „ei saa" nõuab põhjust;
-- auto tuleku aeg käib ainult korraldatud sõidu juurde (ka pärast tagasivõtmist jääb see alles).
ALTER TABLE "CareTransportRequest"
  ADD CONSTRAINT "CareTransportRequest_answer_check"
  CHECK (
    ("state" = 'REQUESTED' AND "answeredAt" IS NULL AND "pickupTime" IS NULL AND "answerNote" IS NULL AND "withdrawnAt" IS NULL)
    OR ("state" = 'ARRANGED' AND "answeredAt" IS NOT NULL AND "withdrawnAt" IS NULL)
    OR ("state" = 'DECLINED' AND "answeredAt" IS NOT NULL AND "answerNote" IS NOT NULL AND "pickupTime" IS NULL AND "withdrawnAt" IS NULL)
    OR ("state" = 'WITHDRAWN' AND "withdrawnAt" IS NOT NULL)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareTransportRequest";
