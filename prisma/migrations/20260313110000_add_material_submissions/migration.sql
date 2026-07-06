-- CreateTable
CREATE TABLE "MaterialSubmission" (
    "id" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "comment" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MaterialSubmission_submittedByUserId_createdAt_idx" ON "MaterialSubmission"("submittedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MaterialSubmission_createdAt_idx" ON "MaterialSubmission"("createdAt");

-- CreateIndex
CREATE INDEX "MaterialSubmission_sha256_idx" ON "MaterialSubmission"("sha256");

-- AddForeignKey
ALTER TABLE "MaterialSubmission" ADD CONSTRAINT "MaterialSubmission_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
