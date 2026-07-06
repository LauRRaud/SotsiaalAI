-- Persistent wellbeing pilot scopes for KOV and organization pilots.
CREATE TABLE "WellbeingPilotScope" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL DEFAULT 'role_group',
    "municipalityId" TEXT,
    "organizationId" TEXT,
    "roleGroups" JSONB NOT NULL,
    "minimumGroupSize" INTEGER NOT NULL DEFAULT 3,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellbeingPilotScope_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WellbeingPilotViewer" (
    "id" TEXT NOT NULL,
    "pilotScopeId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WellbeingPilotViewer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WellbeingPilotScope_active_scopeType_idx" ON "WellbeingPilotScope"("active", "scopeType");
CREATE INDEX "WellbeingPilotScope_municipalityId_idx" ON "WellbeingPilotScope"("municipalityId");
CREATE INDEX "WellbeingPilotScope_organizationId_idx" ON "WellbeingPilotScope"("organizationId");
CREATE INDEX "WellbeingPilotScope_startsAt_endsAt_idx" ON "WellbeingPilotScope"("startsAt", "endsAt");

CREATE UNIQUE INDEX "WellbeingPilotViewer_pilotScopeId_userId_key" ON "WellbeingPilotViewer"("pilotScopeId", "userId");
CREATE UNIQUE INDEX "WellbeingPilotViewer_pilotScopeId_email_key" ON "WellbeingPilotViewer"("pilotScopeId", "email");
CREATE INDEX "WellbeingPilotViewer_userId_idx" ON "WellbeingPilotViewer"("userId");
CREATE INDEX "WellbeingPilotViewer_email_idx" ON "WellbeingPilotViewer"("email");

ALTER TABLE "WellbeingPilotViewer"
ADD CONSTRAINT "WellbeingPilotViewer_pilotScopeId_fkey"
FOREIGN KEY ("pilotScopeId") REFERENCES "WellbeingPilotScope"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WellbeingPilotViewer"
ADD CONSTRAINT "WellbeingPilotViewer_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
