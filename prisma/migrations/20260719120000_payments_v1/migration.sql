-- T09 PAYMENTS-V1: honest subscription/payment/sponsored lifecycle.
-- All additive. Existing production rows are untouched: new columns are
-- nullable or carry a safe default. Plaintext "providerToken" stays for
-- backward reads; new writes go to the encrypted cipher columns only.

-- Subscription: cancel-at-period-end keeps paid access until validUntil and
-- stops new renewals; the row stays ACTIVE until the period actually ends.
ALTER TABLE "Subscription" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;

-- BillingMethod: the recurring mandate token is encrypted at rest with a
-- separate server key. providerTokenKeyId identifies the key for rotation and
-- fail-closed decryption; the plaintext value is never written by new code.
ALTER TABLE "BillingMethod" ADD COLUMN "providerTokenCipher" TEXT;
ALTER TABLE "BillingMethod" ADD COLUMN "providerTokenKeyId" TEXT;

-- Payment/invite email outbox: idempotent, retryable, repo-managed delivery.
-- The subscription truth lives in Subscription/Payment; this table only
-- delivers notifications and carries a minimal render payload.
CREATE TABLE "PaymentEmailOutbox" (
  "id" TEXT NOT NULL,
  "dedupeKey" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "toEmail" TEXT NOT NULL,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "payload" JSONB,
  "paymentId" TEXT,
  "inviteId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3),
  "claimedAt" TIMESTAMP(3),
  "lastErrorCode" TEXT,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentEmailOutbox_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentEmailOutbox_dedupeKey_key" ON "PaymentEmailOutbox"("dedupeKey");
CREATE INDEX "PaymentEmailOutbox_status_nextAttemptAt_id_idx" ON "PaymentEmailOutbox"("status", "nextAttemptAt", "id");
CREATE INDEX "PaymentEmailOutbox_paymentId_idx" ON "PaymentEmailOutbox"("paymentId");
CREATE INDEX "PaymentEmailOutbox_inviteId_idx" ON "PaymentEmailOutbox"("inviteId");
CREATE INDEX "PaymentEmailOutbox_createdAt_idx" ON "PaymentEmailOutbox"("createdAt");
