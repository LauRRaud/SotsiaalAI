ALTER TYPE "public"."InviteStatus" ADD VALUE IF NOT EXISTS 'PENDING_PAYMENT';

ALTER TABLE "public"."Subscription"
  ADD COLUMN "billingSource" "public"."BillingSource" NOT NULL DEFAULT 'SELF',
  ADD COLUMN "sponsorUserId" TEXT,
  ADD COLUMN "inviteId" TEXT;

ALTER TABLE "public"."Subscription"
  ADD CONSTRAINT "Subscription_sponsorUserId_fkey"
  FOREIGN KEY ("sponsorUserId") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Subscription"
  ADD CONSTRAINT "Subscription_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "public"."Invite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Subscription_billingSource_idx" ON "public"."Subscription"("billingSource");
CREATE INDEX "Subscription_sponsorUserId_idx" ON "public"."Subscription"("sponsorUserId");
CREATE INDEX "Subscription_inviteId_idx" ON "public"."Subscription"("inviteId");

ALTER TABLE "public"."Payment"
  ALTER COLUMN "subscriptionId" DROP NOT NULL,
  ADD COLUMN "inviteId" TEXT;

ALTER TABLE "public"."Payment"
  ADD CONSTRAINT "Payment_inviteId_fkey"
  FOREIGN KEY ("inviteId") REFERENCES "public"."Invite"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_inviteId_idx" ON "public"."Payment"("inviteId");

ALTER TABLE "public"."Invite"
  ADD COLUMN "sponsoredRole" "public"."Role",
  ADD COLUMN "sponsoredPlan" TEXT,
  ADD COLUMN "sponsoredPaidAt" TIMESTAMP(3);

CREATE INDEX "Invite_sponsoredRole_idx" ON "public"."Invite"("sponsoredRole");
