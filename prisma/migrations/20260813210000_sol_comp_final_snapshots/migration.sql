CREATE TABLE "AgentArtifactFinalSnapshot" (
  "id" TEXT NOT NULL,
  "artifactId" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "docxBytes" BYTEA NOT NULL,
  "docxSha256" TEXT NOT NULL,
  "docxSize" INTEGER NOT NULL,
  "pdfBytes" BYTEA,
  "pdfSha256" TEXT,
  "pdfSize" INTEGER NOT NULL DEFAULT 0,
  "totalBytes" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgentArtifactFinalSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AgentArtifactFinalSnapshot_artifactId_key"
  ON "AgentArtifactFinalSnapshot"("artifactId");
CREATE INDEX "AgentArtifactFinalSnapshot_createdAt_idx"
  ON "AgentArtifactFinalSnapshot"("createdAt");

ALTER TABLE "AgentArtifactFinalSnapshot"
  ADD CONSTRAINT "AgentArtifactFinalSnapshot_artifactId_fkey"
  FOREIGN KEY ("artifactId") REFERENCES "AgentArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
