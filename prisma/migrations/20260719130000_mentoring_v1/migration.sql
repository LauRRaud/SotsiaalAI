-- CreateTable
CREATE TABLE "MentorProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "origin" TEXT NOT NULL DEFAULT 'SELF',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "consentStatus" TEXT,
    "displayName" TEXT NOT NULL,
    "title" TEXT,
    "organization" TEXT,
    "fields" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "topics" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "formats" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "bioShort" TEXT,
    "bioFull" TEXT,
    "experienceSummary" TEXT,
    "capacity" TEXT NOT NULL DEFAULT 'OPEN',
    "externalProfileUrl" TEXT,
    "externalSlug" TEXT,
    "publicContact" JSONB,
    "contactDisplayAllowed" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "consentNote" TEXT,
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReasonKey" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringRequest" (
    "id" TEXT NOT NULL,
    "menteeId" TEXT NOT NULL,
    "mentorProfileId" TEXT NOT NULL,
    "mentorUserId" TEXT NOT NULL,
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "anonymizedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringRelation" (
    "id" TEXT NOT NULL,
    "mentorUserId" TEXT,
    "menteeUserId" TEXT,
    "requestId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "goalSummary" TEXT,
    "agreementText" TEXT,
    "agreementVersion" INTEGER NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closeReasonKey" TEXT,
    "purgedAt" TIMESTAMP(3),
    "inactivityCheckAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringAgreementAcceptance" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "userId" TEXT,
    "agreementVersion" INTEGER NOT NULL,
    "textSnapshot" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'et',
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringAgreementAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringMeeting" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'EXTERNAL',
    "roomId" TEXT,
    "topicSummary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "createdByUserId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringSummary" (
    "id" TEXT NOT NULL,
    "relationId" TEXT NOT NULL,
    "meetingId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'MEETING',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "supersededById" TEXT,
    "createdByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringSummaryConfirmation" (
    "id" TEXT NOT NULL,
    "summaryId" TEXT NOT NULL,
    "userId" TEXT,
    "confirmedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringSummaryConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringPrivateNote" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "relationId" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'NOTE',
    "content" TEXT NOT NULL,
    "sourceDraftId" TEXT,
    "sharedContent" TEXT,
    "sharedAt" TIMESTAMP(3),
    "openedByOtherAt" TIMESTAMP(3),
    "recalledAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MentoringPrivateNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MentoringAuditEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "profileId" TEXT,
    "relationId" TEXT,
    "requestId" TEXT,
    "summaryId" TEXT,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MentoringAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_userId_key" ON "MentorProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MentorProfile_externalSlug_key" ON "MentorProfile"("externalSlug");

-- CreateIndex
CREATE INDEX "MentorProfile_status_updatedAt_idx" ON "MentorProfile"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "MentorProfile_origin_consentStatus_idx" ON "MentorProfile"("origin", "consentStatus");

-- CreateIndex
CREATE INDEX "MentoringRequest_mentorUserId_status_updatedAt_idx" ON "MentoringRequest"("mentorUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MentoringRequest_menteeId_status_updatedAt_idx" ON "MentoringRequest"("menteeId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MentoringRequest_status_expiresAt_idx" ON "MentoringRequest"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringRelation_requestId_key" ON "MentoringRelation"("requestId");

-- CreateIndex
CREATE INDEX "MentoringRelation_mentorUserId_status_updatedAt_idx" ON "MentoringRelation"("mentorUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MentoringRelation_menteeUserId_status_updatedAt_idx" ON "MentoringRelation"("menteeUserId", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "MentoringRelation_status_lastActivityAt_idx" ON "MentoringRelation"("status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "MentoringAgreementAcceptance_relationId_agreementVersion_idx" ON "MentoringAgreementAcceptance"("relationId", "agreementVersion");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringAgreementAcceptance_relationId_userId_agreementVer_key" ON "MentoringAgreementAcceptance"("relationId", "userId", "agreementVersion");

-- CreateIndex
CREATE INDEX "MentoringMeeting_relationId_occurredAt_idx" ON "MentoringMeeting"("relationId", "occurredAt");

-- CreateIndex
CREATE INDEX "MentoringMeeting_status_occurredAt_idx" ON "MentoringMeeting"("status", "occurredAt");

-- CreateIndex
CREATE INDEX "MentoringSummary_relationId_status_updatedAt_idx" ON "MentoringSummary"("relationId", "status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringSummaryConfirmation_summaryId_userId_key" ON "MentoringSummaryConfirmation"("summaryId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "MentoringPrivateNote_sourceDraftId_key" ON "MentoringPrivateNote"("sourceDraftId");

-- CreateIndex
CREATE INDEX "MentoringPrivateNote_ownerId_relationId_updatedAt_idx" ON "MentoringPrivateNote"("ownerId", "relationId", "updatedAt");

-- CreateIndex
CREATE INDEX "MentoringPrivateNote_relationId_sharedAt_idx" ON "MentoringPrivateNote"("relationId", "sharedAt");

-- CreateIndex
CREATE INDEX "MentoringAuditEvent_profileId_createdAt_idx" ON "MentoringAuditEvent"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "MentoringAuditEvent_relationId_createdAt_idx" ON "MentoringAuditEvent"("relationId", "createdAt");

-- CreateIndex
CREATE INDEX "MentoringAuditEvent_action_createdAt_idx" ON "MentoringAuditEvent"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentorProfile" ADD CONSTRAINT "MentorProfile_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRequest" ADD CONSTRAINT "MentoringRequest_menteeId_fkey" FOREIGN KEY ("menteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRequest" ADD CONSTRAINT "MentoringRequest_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRequest" ADD CONSTRAINT "MentoringRequest_mentorProfileId_fkey" FOREIGN KEY ("mentorProfileId") REFERENCES "MentorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRelation" ADD CONSTRAINT "MentoringRelation_mentorUserId_fkey" FOREIGN KEY ("mentorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRelation" ADD CONSTRAINT "MentoringRelation_menteeUserId_fkey" FOREIGN KEY ("menteeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRelation" ADD CONSTRAINT "MentoringRelation_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringRelation" ADD CONSTRAINT "MentoringRelation_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MentoringRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringAgreementAcceptance" ADD CONSTRAINT "MentoringAgreementAcceptance_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "MentoringRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringAgreementAcceptance" ADD CONSTRAINT "MentoringAgreementAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringMeeting" ADD CONSTRAINT "MentoringMeeting_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "MentoringRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringMeeting" ADD CONSTRAINT "MentoringMeeting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringMeeting" ADD CONSTRAINT "MentoringMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummary" ADD CONSTRAINT "MentoringSummary_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "MentoringRelation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummary" ADD CONSTRAINT "MentoringSummary_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "MentoringMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummary" ADD CONSTRAINT "MentoringSummary_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "MentoringSummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummary" ADD CONSTRAINT "MentoringSummary_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummaryConfirmation" ADD CONSTRAINT "MentoringSummaryConfirmation_summaryId_fkey" FOREIGN KEY ("summaryId") REFERENCES "MentoringSummary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringSummaryConfirmation" ADD CONSTRAINT "MentoringSummaryConfirmation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringPrivateNote" ADD CONSTRAINT "MentoringPrivateNote_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MentoringAuditEvent" ADD CONSTRAINT "MentoringAuditEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Osalised unikaalindeksid (rakenduskihi olekukonstandid; Prisma ei oska neid
-- deklareerida — ESTA-MENTOR-A0 ptk 5.3 / I7):
-- max 1 PENDING taotlus paari kohta
CREATE UNIQUE INDEX "MentoringRequest_pending_pair_key"
  ON "MentoringRequest" ("menteeId", "mentorUserId")
  WHERE "status" = 'PENDING';
-- max 1 mitte-CLOSED suhe sama suunaga paari kohta
CREATE UNIQUE INDEX "MentoringRelation_open_pair_key"
  ON "MentoringRelation" ("mentorUserId", "menteeUserId")
  WHERE "status" <> 'CLOSED';
