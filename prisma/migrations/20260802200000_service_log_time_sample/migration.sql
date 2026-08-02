-- TEENUSPÄEVIK E8 — aruandlusaja proov (DoD 1 ja 5).
--
-- ADDITIIVNE: ainult uus tabel, ühtegi olemasolevat rida ei puudutata.
--
-- SEOSTE SUUNAD ON TAHTLIKUD JA ERINEVAD:
--   providerProfile CASCADE  — proov on profiili tööriist, mitte raamatupidamise
--                              dokument; profiili kadumisel ei ole tal tähendust.
--   owner           SET NULL — konto võib kaduda, baasjoon jääb. Proov on niigi
--                              isikustamata: temas ei ole klienti ega kirje viidet.
CREATE TABLE "ServiceLogTimeSample" (
  "id"                TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "ownerUserId"       TEXT,
  "kind"              TEXT NOT NULL,
  "seconds"           INTEGER NOT NULL,
  "recordedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceLogTimeSample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceLogTimeSample_providerProfileId_kind_recordedAt_idx"
  ON "ServiceLogTimeSample" ("providerProfileId", "kind", "recordedAt");

CREATE INDEX "ServiceLogTimeSample_ownerUserId_recordedAt_idx"
  ON "ServiceLogTimeSample" ("ownerUserId", "recordedAt");

ALTER TABLE "ServiceLogTimeSample"
  ADD CONSTRAINT "ServiceLogTimeSample_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ServiceProviderProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ServiceLogTimeSample"
  ADD CONSTRAINT "ServiceLogTimeSample_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
