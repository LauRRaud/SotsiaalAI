-- KODUTEENUS K6-h — lepingu allkirja märge ja originaali hoiukoht (kava II.6.9).
--
-- Haldusleping peab olema kirjalik ja kliendi allkirjaga; haldusakti puhul kliendi allkirja
-- ei nõuta. Seni ei olnud kuskil näha, kas kliendi leping on allkirjastatud, kuidas ja kus
-- originaal on. Otsuse reale tuleb kolm välja:
--   signState    kuidas leping allkirjastati (PAPER, DIGITAL, REPRESENTATIVE), et allkirja ei
--                nõuta (NOT_REQUIRED) või et allkirja ei koguta, sest ei ole kindel, kas
--                inimene sai aru (UNSURE); NULL = märkimata. Ainult halduslepingul.
--   signedOn     allkirjastamise päev (AAAA-KK-PP); ainult allkirjastatud seisuga.
--   originalKept kus originaal on (vaba tekst); lubatud ka haldusaktil.
-- Platvorm allkirja ei kogu ega hoia dokumenti: see on märge selle kohta, mis paberil tehti.
--
-- Aditiivne: kolm NULL-i lubavat veergu; eelmine rakenduse versioon neid ei loe ega kirjuta.
-- CHECK läbib ka NULL-i korral, seepärast on allkirja päeva tingimuses seis eraldi nõutud.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareDecision"
  ADD COLUMN "signState" TEXT,
  ADD COLUMN "signedOn" TEXT,
  ADD COLUMN "originalKept" TEXT;

ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_signState_check" CHECK (
    "signState" IS NULL OR ("signState" IN ('PAPER', 'DIGITAL', 'REPRESENTATIVE', 'NOT_REQUIRED', 'UNSURE') AND "kind" = 'CONTRACT')
  );

ALTER TABLE "CareDecision"
  ADD CONSTRAINT "CareDecision_signedOn_check" CHECK (
    "signedOn" IS NULL
    OR ("signedOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "signState" IS NOT NULL AND "signState" IN ('PAPER', 'DIGITAL', 'REPRESENTATIVE'))
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   ALTER TABLE "CareDecision" DROP CONSTRAINT IF EXISTS "CareDecision_signedOn_check";
--   ALTER TABLE "CareDecision" DROP CONSTRAINT IF EXISTS "CareDecision_signState_check";
--   ALTER TABLE "CareDecision" DROP COLUMN IF EXISTS "originalKept", DROP COLUMN IF EXISTS "signedOn", DROP COLUMN IF EXISTS "signState";
