-- JTA-V1 / SOL-CW-12 — üks juhtum lähteobjekti kohta + idempotentsusvõti.
--
-- Omaniku otsus 09.08.2026: „üks juhtum lähteobjekti kohta + idempotentsusvõti".
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-CW-12.
--
-- MIKS SEE MIGRATSIOON OLEMAS ON. `POST /api/casework/cases` tegi iga kutse
-- peale tingimusteta `create`. Topeltklõps, võrgu timeout või kliendi
-- korduskatse tegi samast pöördumisest KAKS sõltumatult muutuvat juhtumit;
-- hilisem märge, säilituskell ja STAR2 ülekanne jagunesid eri tõdede vahel.
-- Ükski veateade ei tekkinud.
--
-- MIKS JÕUSTAJA ON INDEKS, MITTE TEENUSKIHI EELKONTROLL. Kaks paralleelset
-- päringut jõuaksid eelkontrollist mõlemad läbi — sama õppetund, mille L22
-- kopeerimisauditi juures juba kirja pani. Teenuskiht püüab kinni indeksi
-- vastuse, ta ei asenda seda.
--
-- MIKS `NULL` EI PÕRKA. PostgreSQL loeb unikaalses indeksis NULL-id
-- eristuvaks. Seetõttu:
--   · päritoluta juhtumeid (rada B) see piirang ei puuduta;
--   · sama pöördumisest võib juhtumi teha KAKS ERI töötajat — piirang on
--     `(ownerUserId, ...)`, mitte pöördumine üksi;
--   · vana klient, kes `clientActionId`-d ei saada, töötab edasi.

-- AlterTable
ALTER TABLE "CaseWorkAssist" ADD COLUMN "clientActionId" TEXT;

-- VÄRAV ENNE INDEKSEID. Unikaalne indeks olemasolevate duplikaatide peal
-- kukuks läbi Postgresi enda sõnumiga, mis nimetab indeksi, mitte põhjust.
-- Siin ütleb tõrge, MITU rida ja MILLISE lähteobjekti pealt — ja andmeid EI
-- KUSTUTATA automaatselt: mis kahest juhtumist alles jääb, ei ole migratsiooni
-- otsustada.
DO $$
DECLARE
  pre_dupes INTEGER;
  urgent_dupes INTEGER;
BEGIN
  SELECT COUNT(*) INTO pre_dupes FROM (
    SELECT "ownerUserId", "preInquiryId"
    FROM "CaseWorkAssist"
    WHERE "preInquiryId" IS NOT NULL
    GROUP BY "ownerUserId", "preInquiryId"
    HAVING COUNT(*) > 1
  ) AS d;

  SELECT COUNT(*) INTO urgent_dupes FROM (
    SELECT "ownerUserId", "urgentRequestId"
    FROM "CaseWorkAssist"
    WHERE "urgentRequestId" IS NOT NULL
    GROUP BY "ownerUserId", "urgentRequestId"
    HAVING COUNT(*) > 1
  ) AS d;

  IF pre_dupes > 0 OR urgent_dupes > 0 THEN
    RAISE EXCEPTION
      'SOL-CW-12: enne unikaalsuse jõustamist tuleb lahendada duplikaadid — % eelpöördumise ja % kiire abi pöördumise (omanik, lähteobjekt) paari kannavad rohkem kui üht juhtumit. Migratsioon ei kustuta andmeid ise.',
      pre_dupes, urgent_dupes;
  END IF;
END $$;

-- CreateIndex
CREATE UNIQUE INDEX "CaseWorkAssist_ownerUserId_preInquiryId_key"
  ON "CaseWorkAssist"("ownerUserId", "preInquiryId");

CREATE UNIQUE INDEX "CaseWorkAssist_ownerUserId_urgentRequestId_key"
  ON "CaseWorkAssist"("ownerUserId", "urgentRequestId");

CREATE UNIQUE INDEX "CaseWorkAssist_ownerUserId_clientActionId_key"
  ON "CaseWorkAssist"("ownerUserId", "clientActionId");
