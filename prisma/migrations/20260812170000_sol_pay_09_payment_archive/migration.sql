-- SOL-PAY-09: maksekirje peab elama maksjast kauem.
--
-- `Payment.userId` oli `ON DELETE CASCADE`, seega konto kustutamine viis
-- makseajaloo kohe kaasa — kuigi `lib/retention.js` hoiab makseid seitse aastat
-- ja privaatsustingimuste punkt 7.9 lubab kasutajale sedasama. Andmebaasi tasand
-- võitis teenusekihi vaikselt.
--
-- MÕÕDETUD ENNE (12.08, toodang): 4 `Payment` rida, kõigil `userId` täidetud;
-- 11 `Subscription`, 1 `BillingMethod`. Ükski allolev lause ei muuda ühtki
-- olemasolevat väärtust — veerg muutub nullitavaks ja lisandub kolm tühja veergu.
-- `DROP NOT NULL` ei saa siin kukkuda andmete peal, sest ta ainult LÕDVENDAB piiri.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "archivedPayerRef" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "archivedPlanCode" TEXT;

ALTER TABLE "Payment" ALTER COLUMN "userId" DROP NOT NULL;

-- Maksja seos: CASCADE -> SET NULL. `NULL` tähendab siin „maksja on kustutatud",
-- ja eristajaks on `archivedAt`, mitte veeru tühjus.
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_userId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Tellimuse seos: CASCADE -> SET NULL. Ilma selleta oleks maksja seose
-- parandamine olnud tühi töö — tellimus kaskaadib kasutajaga ja oleks võtnud
-- maksekirje endaga kaasa teist teed pidi.
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_subscriptionId_fkey";
ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_subscriptionId_fkey"
  FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Arhiveeritud ridade leidmiseks säilituskäigus ja raamatupidamise päringus.
CREATE INDEX IF NOT EXISTS "Payment_archivedAt_idx" ON "Payment"("archivedAt");
CREATE INDEX IF NOT EXISTS "Payment_archivedPayerRef_idx" ON "Payment"("archivedPayerRef");
