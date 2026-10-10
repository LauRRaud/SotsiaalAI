-- ORGANISATSIOONI KUTSE — kutsuja saab kutsele kaasa panna inimese nime.
--
-- Platvormil ei olnud kohta, kus asutus saaks öelda, mis nimega inimene tema juures
-- töötab: nime pani kirja ainult inimene ise pärast liitumist (koduteenuse avalehel), ja
-- kuni ta seda ei teinud, seisis päevaplaanis, võtmeraamatus ja teadetes nime asemel kriips.
--
-- Nimi kutsel on PAKKUMINE: liitumisel täidab see inimese profiili ainult siis, kui tal
-- endal nime ei ole. Inimese enda pandud nime kutse üle ei kirjuta. Kutse sulgemisel
-- (vastu võetud, keeldutud, tühistatud) kustutab rakendus nime kutselt.
--
-- Aditiivne: kaks tühja lubavat veergu ja üks kontroll. Eelmine rakenduse versioon neid ei
-- loe ega kirjuta.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "OrganizationInvite"
    ADD COLUMN "firstName" TEXT,
    ADD COLUMN "lastName" TEXT;

-- Mõlemad nimeosad koos või mitte kumbki; tühikutest tekst ei ole nimi. NULL-i juhtum on
-- kirjas otse: CHECK laseb NULL-iks hinduva avaldise läbi.
ALTER TABLE "OrganizationInvite"
    ADD CONSTRAINT "OrganizationInvite_person_name_check" CHECK (
        ("firstName" IS NULL AND "lastName" IS NULL)
        OR (
            "firstName" IS NOT NULL
            AND "lastName" IS NOT NULL
            AND char_length(btrim("firstName")) BETWEEN 1 AND 60
            AND char_length(btrim("lastName")) BETWEEN 1 AND 60
        )
    );
