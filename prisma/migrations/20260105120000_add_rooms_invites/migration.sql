-- CreateEnum
CREATE TYPE "public"."RoomRole" AS ENUM ('OWNER', 'MODERATOR', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."InviteStatus" AS ENUM ('SENT', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "public"."RelationshipType" AS ENUM ('COLLEAGUE', 'CLIENT');

-- CreateEnum
CREATE TYPE "public"."InvitePaymentMode" AS ENUM ('SELF_PAID', 'SPONSORED_BY_HOST');

-- CreateEnum
CREATE TYPE "public"."BillingSource" AS ENUM ('SELF', 'SPONSORED_BY_HOST');

-- CreateTable
CREATE TABLE "public"."Room" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."RoomRole" NOT NULL DEFAULT 'MEMBER',
    "billingSource" "public"."BillingSource" NOT NULL DEFAULT 'SELF',
    "sponsorUserId" TEXT,
    "sponsorOrgId" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "lastReadAt" TIMESTAMP(3),

    CONSTRAINT "RoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invite" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeEmail" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "status" "public"."InviteStatus" NOT NULL DEFAULT 'SENT',
    "relationshipType" "public"."RelationshipType" NOT NULL DEFAULT 'COLLEAGUE',
    "paymentMode" "public"."InvitePaymentMode" NOT NULL DEFAULT 'SELF_PAID',
    "sponsoredByUserId" TEXT,
    "sponsoredByOrgId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedBillingSource" "public"."BillingSource",
    "acceptedByUserId" TEXT,

    CONSTRAINT "Invite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoomMessage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "RoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Room_ownerId_idx" ON "public"."Room"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "RoomMember_roomId_userId_key" ON "public"."RoomMember"("roomId", "userId");

-- CreateIndex
CREATE INDEX "RoomMember_userId_idx" ON "public"."RoomMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Invite_tokenHash_key" ON "public"."Invite"("tokenHash");

-- CreateIndex
CREATE INDEX "Invite_roomId_status_idx" ON "public"."Invite"("roomId", "status");

-- CreateIndex
CREATE INDEX "Invite_expiresAt_idx" ON "public"."Invite"("expiresAt");

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_createdAt_idx" ON "public"."RoomMessage"("roomId", "createdAt");

-- CreateIndex
CREATE INDEX "RoomMessage_roomId_id_idx" ON "public"."RoomMessage"("roomId", "id");

-- AddForeignKey
ALTER TABLE "public"."Room" ADD CONSTRAINT "Room_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomMember" ADD CONSTRAINT "RoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomMember" ADD CONSTRAINT "RoomMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomMember" ADD CONSTRAINT "RoomMember_sponsorUserId_fkey" FOREIGN KEY ("sponsorUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_sponsoredByUserId_fkey" FOREIGN KEY ("sponsoredByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Invite" ADD CONSTRAINT "Invite_acceptedByUserId_fkey" FOREIGN KEY ("acceptedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomMessage" ADD CONSTRAINT "RoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "public"."Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RoomMessage" ADD CONSTRAINT "RoomMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
