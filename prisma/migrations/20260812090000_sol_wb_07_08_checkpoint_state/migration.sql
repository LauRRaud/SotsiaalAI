-- SOL-WB-07 (P1) ja SOL-WB-08 (P2) — kontrollpunkti taimer ja tema omand.
--
-- WB-07: NÄLJUTUS. Due-päring võttis `checkpointDueOn <= now` järgi kuni 1000
-- VANIMAT rida ja filtreeris alles PÄRAST seda mälus välja need, mille
-- `followUp` on juba vastatud. Vastamine ei nullinud `checkpointDueOn`-i, seega
-- vastatud vanad read jäid igal jooksul kandidaatide algusse. Kui neid koguneb
-- batch'i jagu, tagastab taimer iga kord null uut due-kirjet ja hilisemad
-- kasutajad ei saa oma meeldetuletust MITTE KUNAGI — vaikselt, ilma veata.
--
-- Juur on see, et „kas vastatud?" elas ainult JSON-i sees ja SQL ei saanud teda
-- küsida. Skalaar `checkpointAnsweredAt` viib otsuse päringusse: vastatud read
-- ei ole enam kandidaadid, seega ei saa nad kedagi välja tõrjuda.
ALTER TABLE "WellbeingRecord" ADD COLUMN IF NOT EXISTS "checkpointAnsweredAt" TIMESTAMP(3);

-- Pärandread: vastuse aeg on JSON-is olemas, seega backfill ei oleta midagi.
-- `notedAt` on kirjutatud iga vastuse juurde alates funktsiooni sünnist;
-- `updatedAt` on tagavaratee ainult juhuks, kui mõni vana rida on ilma temata.
UPDATE "WellbeingRecord"
SET "checkpointAnsweredAt" = COALESCE(
      NULLIF("checkpoint" #>> '{followUp,notedAt}', '')::timestamp,
      "updatedAt"
    )
WHERE "checkpointAnsweredAt" IS NULL
  AND "checkpoint" #>> '{followUp,state}' IS NOT NULL;

CREATE INDEX IF NOT EXISTS "WellbeingRecord_checkpointDueOn_checkpointAnsweredAt_idx"
  ON "WellbeingRecord" ("checkpointDueOn", "checkpointAnsweredAt");

-- WB-08: KAKS AKTIIVSET KONTROLLPUNKTI ÜHE KOKKULEPPE PEALE. Parandus („paranda
-- uue kirjena") kopeeris `checkpointDueOn` ja `checkpoint` uuele reale, aga jättis
-- need ka vanale — vana rida kukkus küll koondist välja (`aggregationEligible`),
-- kuid taimer ei filtreerinud teda, ja kuna sourceId erineb, tekkis kaks
-- teavitust. Kasutaja sai sama kokkuleppe kohta kaks badge'i ja sai vastata
-- kahele iseseisvalt lahknevale kontrollpunktile.
--
-- Edaspidi LIIGUTAB parandustehing kontrollpunkti (kood), siin korrastatakse
-- pärandread: asendatud kirje ei kanna enam kokkulepet. Kokkulepe elab ahela
-- kehtiva tipu peal, kus kasutaja teda ka näeb.
UPDATE "WellbeingRecord"
SET "checkpointDueOn" = NULL,
    "checkpoint" = NULL,
    "checkpointAnsweredAt" = NULL
WHERE "id" IN (
  SELECT "supersedesRecordId" FROM "WellbeingRecord" WHERE "supersedesRecordId" IS NOT NULL
);
