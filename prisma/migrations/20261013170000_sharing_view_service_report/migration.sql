-- „KES ON VAADANUD", kolmas liik: teenusaruande jagamine (funktsioonikaart F13).
--
-- Tabel „SharingView" (20261013150000) sai seni viidata eelpöördumisele või
-- võrgustikujagamisele. Siin lisandub teenusaruande jagamine: töötaja, kes saadab kuu
-- aruande oma juhile, näeb lehel „Minu jagamised", mitmel päeval juht seda luges.
--
-- Rida viitab jagamisele oma veeruga ja kustub koos sellega (säilitustähtaja puhastus
-- kustutab jagamise rea; ilma kaskaadita jääks see kustutus välisvõtme taha kinni).
-- Aditiivne: üks uus NULL-lubav veerg; liigi CHECK asendatakse laiemaga, mille alla
-- eelmise rakenduse versiooni kirjutatud read (uus veerg tühi) endiselt mahuvad.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "SharingView" ADD COLUMN "serviceReportShareId" TEXT;

CREATE UNIQUE INDEX "SharingView_serviceReportShareId_viewerUserId_day_key" ON "SharingView"("serviceReportShareId", "viewerUserId", "day");

ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_serviceReportShareId_fkey"
  FOREIGN KEY ("serviceReportShareId") REFERENCES "ServiceReportShare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Täidetud on täpselt selle liigi viide, mida rida nimetab (NULL-kindlalt: iga haru nõuab oma veergu ja keelab teised).
ALTER TABLE "SharingView" DROP CONSTRAINT "SharingView_kind_check";
ALTER TABLE "SharingView"
  ADD CONSTRAINT "SharingView_kind_check" CHECK (
    ("kind" = 'PRE_INQUIRY' AND "preInquiryId" IS NOT NULL AND "networkShareId" IS NULL AND "serviceReportShareId" IS NULL)
    OR ("kind" = 'NETWORK_SHARE' AND "networkShareId" IS NOT NULL AND "preInquiryId" IS NULL AND "serviceReportShareId" IS NULL)
    OR ("kind" = 'SERVICE_REPORT_SHARE' AND "serviceReportShareId" IS NOT NULL AND "preInquiryId" IS NULL AND "networkShareId" IS NULL)
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DELETE FROM "SharingView" WHERE "kind" = 'SERVICE_REPORT_SHARE';
--   ALTER TABLE "SharingView" DROP CONSTRAINT "SharingView_kind_check";
--   ALTER TABLE "SharingView" DROP COLUMN "serviceReportShareId";
--   ALTER TABLE "SharingView" ADD CONSTRAINT "SharingView_kind_check" CHECK (
--     ("kind" = 'PRE_INQUIRY' AND "preInquiryId" IS NOT NULL AND "networkShareId" IS NULL)
--     OR ("kind" = 'NETWORK_SHARE' AND "networkShareId" IS NOT NULL AND "preInquiryId" IS NULL)
--   );
