-- SOL-NET-01 ja SOL-NET-02 — kinnitus viitab tekstile, mitte reale.
--
-- `contentHash`  = sha256 jagatavast sisust, arvutatakse igal kirjutusel.
-- `confirmedContentHash` = see, mida klient kinnitamise hetkel nägi.
--
-- Kanooniline string on VÄLJAD ERALDAJAGA \x1E (record separator). Eraldaja on
-- valitud nii, et teda ei saa kasutaja tekstis olla, aga ta on Postgresi
-- `text`-is lubatud (erinevalt \x00-st). Sama string arvutatakse JS-is
-- (`computeShareContentHash`) ja see migratsioon peab andma temaga SAMA
-- tulemuse — vastasel juhul ei kinnitaks ükski olemasolev rida enam.

ALTER TABLE "NetworkShare" ADD COLUMN "contentHash" TEXT;
ALTER TABLE "NetworkShare" ADD COLUMN "confirmedContentHash" TEXT;

UPDATE "NetworkShare"
SET "contentHash" = encode(
  sha256(convert_to(
    "summaryText" || E'\x1E' ||
    "purpose" || E'\x1E' ||
    "sharingBoundary" || E'\x1E' ||
    to_char("participationEndsOn", 'YYYY-MM-DD'),
    'UTF8'
  )),
  'hex'
);

-- Juba kinnitatud read: kinnitus käis selle sama teksti kohta, mis reas praegu
-- on — muutmine oleks olekut niikuinii DRAFT-iks kukutanud. Seega on
-- `confirmedContentHash` neil võrdne `contentHash`-iga ja nad jäävad
-- saadetavaks. Kinnitamata read jäävad NULL-iks: nemad peavad kinnituse
-- niikuinii alles saama.
UPDATE "NetworkShare"
SET "confirmedContentHash" = "contentHash"
WHERE "clientConfirmedAt" IS NOT NULL;

ALTER TABLE "NetworkShare" ALTER COLUMN "contentHash" SET NOT NULL;
