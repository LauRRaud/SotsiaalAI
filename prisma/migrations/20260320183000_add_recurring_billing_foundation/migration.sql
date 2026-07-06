-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SUBSCRIPTION_INITIAL', 'SUBSCRIPTION_RENEWAL', 'INVITE_SPONSORED', 'OTHER');

-- CreateEnum
CREATE TYPE "BillingMode" AS ENUM ('ONE_OFF', 'RECURRING');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY');

-- CreateEnum
CREATE TYPE "BillingMethodStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "BillingMethod" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'MAKSEKESKUS',
    "status" "BillingMethodStatus" NOT NULL DEFAULT 'PENDING',
    "providerCustomerId" TEXT,
    "providerToken" TEXT,
    "providerMandateId" TEXT,
    "label" TEXT,
    "expiresAt" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingMethod_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Subscription"
ADD COLUMN     "billingInterval" "BillingInterval",
ADD COLUMN     "billingMethodId" TEXT,
ADD COLUMN     "billingMode" "BillingMode" NOT NULL DEFAULT 'ONE_OFF',
ADD COLUMN     "billingRetryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBilledAt" TIMESTAMP(3),
ADD COLUMN     "pastDueSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN     "attemptNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "billingMethodId" TEXT,
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "refundedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "BillingMethod_userId_idx" ON "BillingMethod"("userId");

-- CreateIndex
CREATE INDEX "BillingMethod_status_idx" ON "BillingMethod"("status");

-- CreateIndex
CREATE INDEX "BillingMethod_provider_idx" ON "BillingMethod"("provider");

-- CreateIndex
CREATE INDEX "BillingMethod_providerCustomerId_idx" ON "BillingMethod"("providerCustomerId");

-- CreateIndex
CREATE INDEX "BillingMethod_providerMandateId_idx" ON "BillingMethod"("providerMandateId");

-- CreateIndex
CREATE INDEX "Subscription_billingMode_idx" ON "Subscription"("billingMode");

-- CreateIndex
CREATE INDEX "Subscription_billingMethodId_idx" ON "Subscription"("billingMethodId");

-- CreateIndex
CREATE INDEX "Payment_billingMethodId_idx" ON "Payment"("billingMethodId");

-- CreateIndex
CREATE INDEX "Payment_kind_idx" ON "Payment"("kind");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_billingMethodId_fkey" FOREIGN KEY ("billingMethodId") REFERENCES "BillingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billingMethodId_fkey" FOREIGN KEY ("billingMethodId") REFERENCES "BillingMethod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingMethod" ADD CONSTRAINT "BillingMethod_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
