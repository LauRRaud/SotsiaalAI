ALTER TABLE "User"
  ADD COLUMN "acceptsPreInquiries" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "User_acceptsPreInquiries_idx" ON "User"("acceptsPreInquiries");
