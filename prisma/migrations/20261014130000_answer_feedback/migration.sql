-- „ANNA TAGASISIDET" — inimese teade ühe assistendi vastuse kohta (omanik 11.10.2026).
--
-- Seni sai teatada ainult allika veast (SourceFeedback). Vastuse enda kohta ei saanud inimene
-- midagi öelda ja kehv vastus jäi märkamata. Siia tabelisse tekib üks rida teataja ja pöörde
-- kohta: põhjus neljast valikust, soovi korral märkus (kuni 500 märki) ja olek OPEN või RESOLVED.
-- Hinnanguid ega loendureid ei ole.
--
-- "turnId" on vastuse pöörde tunnus (M4PilotTurn.id), et kehva vastuse põhjus oleks pöörde
-- kirjest loetav. Rida vestluse sisu ei hoia: halduri vaade loeb küsimuse ja vastuse vestluse
-- enda sõnumitest ("userMessageId", "assistantMessageId"), nii et kustutatud või aegunud vestlus
-- võtab need kaasa. Sõnumitele ega pöördele võõrvõtit ei ole (nagu SourceFeedback.messageId):
-- teade peab alles jääma ka siis, kui vestlus on kadunud. Konto kustutamisel kustub rida koos kontoga.
--
-- Aditiivne: üks uus tabel, eelmine rakenduse versioon seda ei loe.

SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "AnswerFeedback" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "turnId" TEXT NOT NULL,
    "userMessageId" TEXT,
    "assistantMessageId" TEXT,
    "category" TEXT NOT NULL,
    "note" VARCHAR(500),
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" VARCHAR(1000),

    CONSTRAINT "AnswerFeedback_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AnswerFeedback_reporterId_turnId_key" ON "AnswerFeedback"("reporterId", "turnId");
CREATE INDEX "AnswerFeedback_status_createdAt_idx" ON "AnswerFeedback"("status", "createdAt");

ALTER TABLE "AnswerFeedback"
  ADD CONSTRAINT "AnswerFeedback_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnswerFeedback"
  ADD CONSTRAINT "AnswerFeedback_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AnswerFeedback"
  ADD CONSTRAINT "AnswerFeedback_status_check" CHECK ("status" IN ('OPEN', 'RESOLVED'));

-- Rollback (kommentaarina; migratsioon on aditiivne):
--   DROP TABLE IF EXISTS "AnswerFeedback";
