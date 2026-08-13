-- SOL-ORG-18: konto kustutus säilitab liikmesuse ja tööajaloo tombstone'ina.
ALTER TABLE "OrganizationMembership"
  ADD COLUMN "userErasedAt" TIMESTAMP(3),
  ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "OrganizationMembership"
  DROP CONSTRAINT "OrganizationMembership_userId_fkey";

ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationMembership"
  ADD CONSTRAINT "OrganizationMembership_erased_identity_chk"
  CHECK ("userId" IS NOT NULL OR ("status" = 'ENDED' AND "userErasedAt" IS NOT NULL));
