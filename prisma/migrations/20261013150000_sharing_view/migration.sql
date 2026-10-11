-- „KES ON VAADANUD" — jagatu vaatamiste jälg (funktsioonikaart F13).
--
-- Lehel „Minu jagamised" oli seni näha ainult see, millal saaja jagatu ESIMEST korda avas.
-- Inimene, kes oma lugu jagab, tahab teada, kas seda ka edaspidi loetakse: Eesti inimene on
-- riigi andmejälgijaga harjunud. Siia tabelisse tekib üks rida vaataja ja päeva kohta, kui
-- SAAJA jagatut loeb. Jagaja enda vaatamist ei logita.
--
-- Rida viitab jagatule oma liigi veeruga (eelpöördumine või võrgustikujagamine), mitte vaba
-- tekstina: kui jagatu või vaataja konto kustub, kustuvad read koos sellega ja orvuks jäänud
-- isikuandmeid ei teki. Rida ei muudeta: sama vaataja sama päeva teine lugemine ei tee uut
-- rida (kordumatu võti). Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "SharingView" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "preInquiryId" TEXT,
    "networkShareId" TEXT,
    "viewerUserId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SharingView_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SharingView_preInquiryId_viewerUserId_day_key" ON "SharingView"("preInquiryId", "viewerUserId", "day");
CREATE UNIQUE INDEX "SharingView_networkShareId_viewerUserId_day_key" ON "SharingView"("networkShareId", "viewerUserId", "day");
CREATE INDEX "SharingView_viewerUserId_idx" ON "SharingView"("viewerUserId");

ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_preInquiryId_fkey"
  FOREIGN KEY ("preInquiryId") REFERENCES "PreInquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_networkShareId_fkey"
  FOREIGN KEY ("networkShareId") REFERENCES "NetworkShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_viewerUserId_fkey"
  FOREIGN KEY ("viewerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Täidetud on täpselt selle liigi viide, mida rida nimetab (NULL-kindlalt: iga haru nõuab oma veergu ja keelab teise).
ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_kind_check" CHECK (
    ("kind" = 'PRE_INQUIRY' AND "preInquiryId" IS NOT NULL AND "networkShareId" IS NULL)
    OR ("kind" = 'NETWORK_SHARE' AND "networkShareId" IS NOT NULL AND "preInquiryId" IS NULL)
  );
-- Päev kujul AAAA-KK-PP (Eesti aja järgi).
ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_day_check" CHECK ("day" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$');

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "SharingView";
