-- SOL-MEET-04: ühe aktiivse kokkuvõttetöö piirangut ei saa hoida protsessi mälus ega
-- snapshotikataloogis. Kaks paralleelset POST-i lugesid mõlemad „aktiivseid töid ei ole" ja lõid
-- mõlemad oma töö oma kasutusvõtmega. `userId` unikaalsus on ainus koht, kus see võidujooks
-- päriselt lõpeb. Uus tabel, olemasolevaid ridu ei puudutata.
CREATE TABLE IF NOT EXISTS "MeetingSummaryJobClaim" (
  "id"        TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "jobId"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MeetingSummaryJobClaim_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MeetingSummaryJobClaim_userId_key"
  ON "MeetingSummaryJobClaim"("userId");

CREATE INDEX IF NOT EXISTS "MeetingSummaryJobClaim_updatedAt_idx"
  ON "MeetingSummaryJobClaim"("updatedAt");

ALTER TABLE "MeetingSummaryJobClaim"
  ADD CONSTRAINT "MeetingSummaryJobClaim_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
