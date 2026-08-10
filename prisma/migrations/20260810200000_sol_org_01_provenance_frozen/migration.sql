-- SOL-ORG-01 (P1) — töö organisatsiooniline päritolu peab olema MUUTUMATU.
--
-- Audit: docs/audits/sotsiaalai-sol-suvaaudit.md, SOL-ORG-01.
--
-- MIS OLI JUBA OLEMAS. `ServiceVisit.assignedOrganizationId` (migratsioon
-- 20260810160000, SOL-SLOG-17/-18) kannab päritolu ja skeemikommentaar ütleb, et
-- ta on „külmutatud loomise hetkel". Juhi tahvel ja ümbermääramine filtreerivad
-- selle järgi.
--
-- MIS PUUDUS. „Külmutatud" oli KOMMENTAAR, mitte reegel. Ükski kood ei kirjuta
-- teda täna üle, aga miski ei takistanud seda ka homme — ja see väli EI OLE
-- tavaline andmeväli: tema väärtus otsustab, KELLE juhi ekraanile kliendi nimi
-- jõuab. Üks `update({ data: { assignedOrganizationId } })` vales kohas viiks
-- töö koos kliendi nimega teise majja, ilma et ükski test seda näeks.
--
-- SOL-ORG-01 vastuvõtukriteerium ütleb „MUUTUMATUT organisatsiooni provenantsi".
-- Muutumatus, mida jõustab ainult teenuskiht, on lubadus; muutumatus, mida
-- jõustab andmebaas, on invariant. Sama muster mis `UsageEvent`-il
-- (20260711120000) ja märkme parandusridadel (20260809160000).
--
-- MIDA TÄPSELT KEELATAKSE. Väärtuse MUUTMINE pärast rea sündi — igas suunas:
--   NULL → org      keelatud (tõendamata päritolu ei muutu tagantjärele tõendiks)
--   org  → teine org keelatud (töö ei koli majast majja)
--   org  → NULL     keelatud (päritolu ei kustu, jälg jääb)
-- Rea KUSTUTAMINE ei ole keelatud: konto kustutus ja säilituse purge peavad
-- kaskaadi kaudu läbi minema. Piir on aus — päritolu ei saa MUUTA, ta saab
-- kaduda ainult koos külastusega.
--
-- Ümbermääramine (`reassignVisit`) ei puutu sellesse: ta liigutab tööd
-- INIMESELT INIMESELE (`ownerUserId`, `routeId`, `providerProfileId`) ja jätab
-- päritolu teadlikult puutumata. Trigger on täpselt see piir, kirja pandult.

CREATE FUNCTION "service_visit_provenance_frozen"() RETURNS trigger AS $$
BEGIN
  IF NEW."assignedOrganizationId" IS DISTINCT FROM OLD."assignedOrganizationId" THEN
    RAISE EXCEPTION
      'ServiceVisit.assignedOrganizationId is frozen at creation (row %, was %, tried %)',
      OLD."id",
      coalesce(OLD."assignedOrganizationId", 'NULL'),
      coalesce(NEW."assignedOrganizationId", 'NULL');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ServiceVisit_provenance_frozen"
  BEFORE UPDATE ON "ServiceVisit"
  FOR EACH ROW EXECUTE FUNCTION "service_visit_provenance_frozen"();
