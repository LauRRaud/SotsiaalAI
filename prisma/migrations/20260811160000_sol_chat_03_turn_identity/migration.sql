-- SOL-CHAT-03 ja SOL-CHAT-04: vestluspöördel ei olnud serveripoolset identiteeti. Kliendi kordus
-- tegi uue kasutusreservatsiooni ja uue sõnumipaari, kaks vahekaarti läbisid mõlemad sessioonipiiri
-- kontrolli, ja `retryOf` viitas kohalikule sõnumi-ID-le, mida server ära ei tundnud.
-- `(userId, clientTurnKey)` unikaalsus on ainus koht, kus üks kavatsus muutub üheks reaks.
-- Uus tabel ja uus enum; olemasolevaid ridu ei puudutata.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ChatTurnStatus') THEN
    CREATE TYPE "ChatTurnStatus" AS ENUM ('RUNNING', 'COMPLETED', 'ERROR', 'ABORTED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "ChatTurn" (
  "id"                 TEXT NOT NULL,
  "userId"             TEXT NOT NULL,
  "conversationId"     TEXT NOT NULL,
  "clientTurnKey"      TEXT NOT NULL,
  "attempt"            INTEGER NOT NULL DEFAULT 1,
  "status"             "ChatTurnStatus" NOT NULL DEFAULT 'RUNNING',
  "userMessageId"      TEXT,
  "assistantMessageId" TEXT,
  "startedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  "endedAt"            TIMESTAMP(3),
  CONSTRAINT "ChatTurn_pkey" PRIMARY KEY ("id")
);

-- Üks kavatsus = üks rida. Siin lõpeb nii kliendi kordus kui ka topelt-POST.
CREATE UNIQUE INDEX IF NOT EXISTS "ChatTurn_userId_clientTurnKey_key"
  ON "ChatTurn"("userId", "clientTurnKey");

CREATE INDEX IF NOT EXISTS "ChatTurn_conversationId_startedAt_idx"
  ON "ChatTurn"("conversationId", "startedAt");

-- Aegunud RUNNING pöörde leidmiseks: rippuma jäänud pööre ei tohi vestlust igaveseks lukku panna.
CREATE INDEX IF NOT EXISTS "ChatTurn_status_updatedAt_idx"
  ON "ChatTurn"("status", "updatedAt");

ALTER TABLE "ChatTurn"
  ADD CONSTRAINT "ChatTurn_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChatTurn"
  ADD CONSTRAINT "ChatTurn_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
