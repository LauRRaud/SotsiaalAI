-- TEENUSEPROFIIL — kinnituslink asutuse e-postile, mis on äriregistris kirjas.
--
-- Esimene pool (20261014090000) andis haldurile käsitsi kinnitamise. See migratsioon lisab
-- koha ühele ootel kinnituslingile: teenuseosutaja kirjutab asutuse e-posti, platvorm
-- kontrollib, et see on äriregistris selle registrikoodi kontaktina kirjas, ja saadab sinna
-- lingi. Lingi avab sama konto, mis profiili tegi.
--
-- Siin hoitakse AINULT lingi räsi, registrikoodi, millele link anti, ja kaht aega. E-posti
-- aadressi ei salvestata. Uus taotlus kirjutab eelmise üle; kinnitus ja tagasivõtmine
-- tühjendavad väljad.
--
-- Aditiivne: neli tühja lubavat veergu ja üks kontroll. Eelmine rakenduse versioon neid ei
-- loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "ServiceProviderProfile"
    ADD COLUMN "representationRequestHash" TEXT,
    ADD COLUMN "representationRequestCode" TEXT,
    ADD COLUMN "representationRequestExpiresAt" TIMESTAMP(3),
    ADD COLUMN "representationRequestSentAt" TIMESTAMP(3);

-- Kas kõik tühjad või kõik neli koos. NULL-i juhtum on kirjas otse: CHECK laseb NULL-iks
-- hinduva avaldise läbi.
ALTER TABLE "ServiceProviderProfile"
    ADD CONSTRAINT "ServiceProviderProfile_representation_request_check" CHECK (
        (
            "representationRequestHash" IS NULL
            AND "representationRequestCode" IS NULL
            AND "representationRequestExpiresAt" IS NULL
            AND "representationRequestSentAt" IS NULL
        )
        OR (
            "representationRequestHash" IS NOT NULL
            AND char_length("representationRequestHash") BETWEEN 32 AND 128
            AND "representationRequestCode" IS NOT NULL
            AND char_length(btrim("representationRequestCode")) BETWEEN 1 AND 40
            AND "representationRequestExpiresAt" IS NOT NULL
            AND "representationRequestSentAt" IS NOT NULL
        )
    );
