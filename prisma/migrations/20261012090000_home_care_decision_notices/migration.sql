-- KODUTEENUS K5-r — teade otsustajale (kava II.6.13, ehituse esimene samm).
--
-- Koduteenuse mahu otsustab omavalitsuse sotsiaaltöötaja; osutab hoolekandekeskus. Kui
-- hooldajad näevad, et abivajadus on muutunud, koostab hooldusjuht kliendi kohta teate
-- (põhjus, kaks lauset, kuni viis päeviku kirjet). Siin hoitakse, mis saadeti (tekst täpselt
-- sellisena, nagu see koostati), mis kanalit pidi ja mis päeval, ning otsustaja vastus,
-- mille hooldusjuht märgib käsitsi. Platvorm ise teadet ei saada.
--
-- Ridu ei kustutata: ekslik teade võetakse tagasi põhjusega.
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "CareDecisionNotice" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "recipient" TEXT,
    "channel" TEXT NOT NULL,
    "sentOn" TEXT NOT NULL,
    "entryIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sentText" TEXT NOT NULL,
    "createdByMembershipId" TEXT,
    "createdByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer" TEXT,
    "answeredOn" TEXT,
    "reassessBy" TEXT,
    "answerNote" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredByMembershipId" TEXT,
    "answeredByName" TEXT,
    "withdrawnAt" TIMESTAMP(3),
    "withdrawnByMembershipId" TEXT,
    "withdrawReason" TEXT,

    CONSTRAINT "CareDecisionNotice_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CareDecisionNotice_clientId_sentOn_idx" ON "CareDecisionNotice"("clientId", "sentOn");
CREATE INDEX "CareDecisionNotice_organizationId_answer_withdrawnAt_idx" ON "CareDecisionNotice"("organizationId", "answer", "withdrawnAt");

ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_clientId_fkey"
  FOREIGN KEY ("clientId") REFERENCES "CareClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_reason_check"
  CHECK ("reason" IN ('NEED_GROWN', 'NEED_REDUCED', 'SERVICE_UNFIT', 'OTHER_SERVICE', 'RELATIVE_CHANGED'));
ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_channel_check" CHECK ("channel" IN ('EMAIL', 'STAR', 'PHONE', 'MEETING', 'OTHER'));
ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_text_check"
  CHECK (
    char_length(btrim("text")) BETWEEN 1 AND 600
    AND char_length("sentText") BETWEEN 1 AND 12000
    AND ("recipient" IS NULL OR char_length(btrim("recipient")) BETWEEN 1 AND 160)
    AND "sentOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    AND "entryIds" IS NOT NULL
    AND cardinality("entryIds") <= 5
  );
-- Vastuse väljad käivad koos; uue hindamise päev on olemas parajasti siis, kui vastus on „hindab uuesti".
ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_answer_check"
  CHECK (
    ("answer" IS NULL AND "answeredOn" IS NULL AND "reassessBy" IS NULL AND "answerNote" IS NULL AND "answeredAt" IS NULL)
    OR (
      "answer" IS NOT NULL
      AND "answer" IN ('REASSESS', 'VOLUME_STAYS', 'OTHER_SERVICE', 'OTHER')
      AND "answeredOn" IS NOT NULL
      AND "answeredOn" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND "answeredAt" IS NOT NULL
      AND ("answer" = 'REASSESS') = ("reassessBy" IS NOT NULL)
      AND ("reassessBy" IS NULL OR "reassessBy" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
      AND ("answerNote" IS NULL OR char_length(btrim("answerNote")) BETWEEN 1 AND 300)
    )
  );
-- Tagasi võetakse põhjusega ja ainult vastuseta teade.
ALTER TABLE "CareDecisionNotice"
  ADD CONSTRAINT "CareDecisionNotice_withdraw_check"
  CHECK (
    ("withdrawnAt" IS NULL AND "withdrawReason" IS NULL AND "withdrawnByMembershipId" IS NULL)
    OR (
      "withdrawnAt" IS NOT NULL
      AND "withdrawReason" IS NOT NULL
      AND char_length(btrim("withdrawReason")) BETWEEN 1 AND 300
      AND "answer" IS NULL
    )
  );

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "CareDecisionNotice";
