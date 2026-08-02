-- TEENUSPÄEVIK-V1 — kliendipoolne idempotentsusvõti võrguta sisestuse jaoks.
--
-- ADDITIIVNE: uus nullable veerg + unikaalindeks. Olemasolevad read jäävad
-- puutumata (kõigil NULL) ja vana kood, mis võtit ei saada, töötab edasi.
--
-- TAVALINE, MITTE OSALINE indeks: PostgreSQL loeb NULL-e unikaalindeksis
-- üksteisest erinevaks, seega mitu NULL-rida on lubatud ka nii. Osaline indeks
-- (WHERE ... IS NOT NULL) oleks lugemiseks selgem, aga Prisma ei oska teda
-- skeemis väljendada ja `db:migrate:check` näeks seda skeemitriivina.
ALTER TABLE "ServiceEntry" ADD COLUMN "clientRequestId" TEXT;

CREATE UNIQUE INDEX "ServiceEntry_providerProfileId_clientRequestId_key"
  ON "ServiceEntry" ("providerProfileId", "clientRequestId");
