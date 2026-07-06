-- AlterTable
ALTER TABLE "public"."HelpRequest"
ADD COLUMN "beneficiaryLabel" TEXT,
ADD COLUMN "urgency" TEXT,
ADD COLUMN "availabilityOrStart" TEXT,
ADD COLUMN "compensationDetails" TEXT,
ADD COLUMN "conditions" TEXT,
ADD COLUMN "skillsOrBackground" TEXT;

-- AlterTable
ALTER TABLE "public"."HelpOffer"
ADD COLUMN "providerScopeOrConditions" TEXT,
ADD COLUMN "availabilityOrStart" TEXT,
ADD COLUMN "compensationDetails" TEXT,
ADD COLUMN "conditions" TEXT,
ADD COLUMN "skillsOrBackground" TEXT;
