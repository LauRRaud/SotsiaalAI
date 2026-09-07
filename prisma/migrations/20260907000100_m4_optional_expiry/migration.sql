-- Owner-approved M4 plans may explicitly have no expiry. Existing deadlines are unchanged.
ALTER TABLE "M4PilotTurn" ALTER COLUMN "expiresAt" DROP NOT NULL;
