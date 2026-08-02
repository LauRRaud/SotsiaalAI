-- TEENUSPÄEVIK — külastuse aadressi koordinaat Maa-ameti registrist.
--
-- Teenusekaart geokodeerib osutajate asukohti juba ammu; siin on see kiht
-- lihtsalt kasutusele võetud. Kolm võitu: sõidulõigu kaugus ka ilma GPS-ita,
-- ristkontroll mõõdetud punktile (seade ütleb Kopli, aadress Tabasalu -> üks
-- neist on vale ja seda saab NÄHA) ja navigatsioon päris aadressile.
--
-- ADDITIIVNE: olemasolevad read jäävad NULL-iks ja vana voog töötab edasi.
ALTER TABLE "ServiceVisit" ADD COLUMN "addressLat" DOUBLE PRECISION;
ALTER TABLE "ServiceVisit" ADD COLUMN "addressLng" DOUBLE PRECISION;
ALTER TABLE "ServiceVisit" ADD COLUMN "addressAdsId" TEXT;
