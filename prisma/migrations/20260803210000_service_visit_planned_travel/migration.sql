-- TEENUSPÄEVIK — ette arvutatud sõit.
--
-- Omaniku kirjeldatud voog: „alustan sõitu" → arvutab teepikkuse sihtkohta →
-- kinnitab kohalejõudmise → „lõpetan sõidu" võtab kokku. Praegu tuli kaugus
-- alles tagantjärele; töötaja peab teadma ENNE sõitu.
--
-- Need väljad EI OLE arve alus: arvele läheb tegelik sõit mõõdetud punktide
-- vahelt. Plaan jääb alles selleks, et hiljem näha, kas päev läks nii nagu
-- arvati.
--
-- ADDITIIVNE: olemasolevad read jäävad NULL-iks.
ALTER TABLE "ServiceVisit" ADD COLUMN "plannedTravelKm" DOUBLE PRECISION;
ALTER TABLE "ServiceVisit" ADD COLUMN "plannedTravelMinutes" INTEGER;
