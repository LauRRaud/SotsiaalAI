-- SOL-SLOG-17 ja -18 (mõlemad P0): külastusel puudus organisatsiooniline päritolu.
--
-- Juhi tahvel tuletas skoobi inimeste kaudu (juhi üksused -> liikmed ->
-- workerUserId), aga kahes organisatsioonis töötaval inimesel on ÜKS tööpäev.
-- Nii nägi org A juht org B klientide nimesid ja sai teadaoleva visitId abil
-- org B planeeritud töö oma töötajale ümber määrata.
--
-- Veerg on SNAPSHOT, mitte seos: võõrvõtit ei ole, sest kustutatud
-- organisatsioon ei tohi tõendit kaasa võtta.
--
-- BACKFILL'i EI OLE ja seda ei ole vaja: 10.08.2026 seisuga on tootmises
-- 0 ServiceVisit rida (mõõdetud). Vanad read jääksid NULL-iks ehk
-- "päritolu ei ole tõendatud" — ja see on õige vaikeväärtus, mitte kadu.
ALTER TABLE "ServiceVisit" ADD COLUMN "assignedOrganizationId" TEXT;

CREATE INDEX "ServiceVisit_assignedOrganizationId_routeId_idx"
  ON "ServiceVisit" ("assignedOrganizationId", "routeId");
