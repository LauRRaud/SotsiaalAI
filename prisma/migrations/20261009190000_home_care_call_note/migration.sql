-- KODUTEENUS K1-h — kõnemärge: kes helistas ja mille pärast.
--
-- Aditiivne: kaks nullitavat veergu ilma vaikeväärtuseta (ainult kataloogimuudatus)
-- ja osaline indeks loenduri jaoks. Eelmine rakenduse versioon valib veerud
-- nimeliselt ja neid veerge ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "CareClientEntry" ADD COLUMN "callTopic" TEXT;
ALTER TABLE "CareClientEntry" ADD COLUMN "callCaller" TEXT;

-- Mõlemad koos või mitte kumbki, ja ainult telefonikontakti kirjel.
ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_call_fields_together"
  CHECK (("callTopic" IS NULL) = ("callCaller" IS NULL)) NOT VALID;
ALTER TABLE "CareClientEntry" VALIDATE CONSTRAINT "CareClientEntry_call_fields_together";

ALTER TABLE "CareClientEntry"
  ADD CONSTRAINT "CareClientEntry_call_only_on_phone"
  CHECK ("callTopic" IS NULL OR "contactMode" = 'PHONE') NOT VALID;
ALTER TABLE "CareClientEntry" VALIDATE CONSTRAINT "CareClientEntry_call_only_on_phone";

-- Loendur loeb ühe asutuse ühe kuu kõnemärkeid; enamik kirjeid ei ole kõned.
CREATE INDEX "CareClientEntry_call_month_idx"
  ON "CareClientEntry"("organizationId", "occurredAt")
  WHERE "callTopic" IS NOT NULL;

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP INDEX IF EXISTS "CareClientEntry_call_month_idx";
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "callTopic";
--   ALTER TABLE "CareClientEntry" DROP COLUMN IF EXISTS "callCaller";
