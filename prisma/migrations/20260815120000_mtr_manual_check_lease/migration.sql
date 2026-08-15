ALTER TABLE "ServiceProviderProfile"
  ADD COLUMN "licenceCheckLeaseToken" TEXT,
  ADD COLUMN "licenceCheckLeaseUntil" TIMESTAMP(3);
