-- TEENUSEPROFIIL — kinnitus, et profiili tegija esindab seda asutust.
--
-- Teenuseosutaja kontoga inimene sai kirjutada profiili võõra asutuse nime ja registrikoodi,
-- profiili avaldada ja saada ka märgise „tegevusluba kontrollitud". Märgis ise oli tõene
-- (register kinnitab selle asutuse loa), vale oli see, kes profiili taga seisab.
--
-- Kinnitus käib ÜHE REGISTRIKOODI kohta: `representationRegistryCode` on kood, mille kohta
-- kinnitus anti. Kui profiili registrikood muutub, ei kehti kinnitus enam, ilma et keegi
-- peaks välju tühjendama. Registrikoodiga profiili ei saa avaldada enne kinnitust
-- (lib/serviceProviderRepresentation.js).
--
-- Viis on praegu ADMIN (haldur kinnitab käsitsi ja kirjutab aluse). EMAIL_LINK on koht
-- kinnituslingile asutuse registris olevale e-postile; seda teed selles migratsioonis ei ehitata.
--
-- Aditiivne: viis tühja lubavat veergu ja üks kontroll. Eelmine rakenduse versioon neid ei
-- loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "ServiceProviderProfile"
    ADD COLUMN "representationConfirmedAt" TIMESTAMP(3),
    ADD COLUMN "representationRegistryCode" TEXT,
    ADD COLUMN "representationMethod" TEXT,
    ADD COLUMN "representationConfirmedById" TEXT,
    ADD COLUMN "representationBasis" TEXT;

-- Kas kõik tühjad või aeg, kood ja viis koos. NULL-i juhtum on kirjas otse: CHECK laseb
-- NULL-iks hinduva avaldise läbi.
ALTER TABLE "ServiceProviderProfile"
    ADD CONSTRAINT "ServiceProviderProfile_representation_check" CHECK (
        (
            "representationConfirmedAt" IS NULL
            AND "representationRegistryCode" IS NULL
            AND "representationMethod" IS NULL
            AND "representationConfirmedById" IS NULL
            AND "representationBasis" IS NULL
        )
        OR (
            "representationConfirmedAt" IS NOT NULL
            AND "representationRegistryCode" IS NOT NULL
            AND char_length(btrim("representationRegistryCode")) BETWEEN 1 AND 40
            AND "representationMethod" IN ('ADMIN', 'EMAIL_LINK')
            AND ("representationBasis" IS NULL OR char_length("representationBasis") <= 300)
        )
    );
