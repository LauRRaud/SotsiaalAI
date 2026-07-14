-- U4 is additive: historical free-text availability values are deliberately
-- left untouched because they were not explicit freshness confirmations.
ALTER TABLE "ServiceProviderService"
  ADD COLUMN "availabilityCheckedAt" TIMESTAMP(3),
  ADD COLUMN "availabilityReminderSentAt" TIMESTAMP(3);

CREATE INDEX "ServiceProviderService_status_availabilityCheckedAt_idx"
  ON "ServiceProviderService"("status", "availabilityCheckedAt");

CREATE INDEX "ServiceProviderService_availabilityReminderSentAt_idx"
  ON "ServiceProviderService"("availabilityReminderSentAt");
