-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."Audience" AS ENUM ('SOCIAL_WORKER', 'CLIENT', 'BOTH');

-- CreateEnum
CREATE TYPE "public"."PaymentProvider" AS ENUM ('MAKSEKESKUS', 'TEST');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('INITIATED', 'PAID', 'CANCELED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "public"."RagSourceType" AS ENUM ('FILE', 'URL');

-- CreateEnum
CREATE TYPE "public"."RagStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('ADMIN', 'SOCIAL_WORKER', 'CLIENT');

-- CreateEnum
CREATE TYPE "public"."SubscriptionStatus" AS ENUM ('NONE', 'ACTIVE', 'CANCELED', 'PAST_DUE');

-- NEW: RunStatus enum (sh DELETED, kui tahad pehme kustutamise liputust)
CREATE TYPE "public"."RunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'ERROR', 'DELETED');

-- CreateTable
CREATE TABLE "public"."Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "public"."PaymentProvider" NOT NULL DEFAULT 'MAKSEKESKUS',
    "providerPaymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "public"."PaymentStatus" NOT NULL,
    "paidAt" TIMESTAMP(3),
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Profile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RagDocument" (
    "id" TEXT NOT NULL,
    "adminId" TEXT,
    "title" TEXT,
    "description" TEXT,
    "type" "public"."RagSourceType" NOT NULL,
    "status" "public"."RagStatus" NOT NULL DEFAULT 'PENDING',
    "audience" "public"."Audience" NOT NULL DEFAULT 'BOTH',
    "sourceUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "remoteId" TEXT,
    "error" TEXT,
    "metadata" JSONB,
    "insertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RagDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "public"."SubscriptionStatus" NOT NULL DEFAULT 'NONE',
    "plan" TEXT NOT NULL DEFAULT 'kuutellimus',
    "validUntil" TIMESTAMP(3),
    "nextBilling" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "canceledAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'CLIENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "emailVerified" TIMESTAMP(3),
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "passwordHash" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- NEW: ConversationRun (vestluse “run”)
CREATE TABLE "public"."ConversationRun" (
    "id" TEXT NOT NULL,                             -- frontendi convId (UUID)
    "userId" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "text" TEXT NOT NULL DEFAULT '',
    "sources" JSONB,
    "status" "public"."RunStatus" NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "public"."Account"("provider" ASC, "providerAccountId" ASC);

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "public"."Account"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_provider_providerPaymentId_key" ON "public"."Payment"("provider" ASC, "providerPaymentId" ASC);

-- CreateIndex
CREATE INDEX "Payment_subscriptionId_idx" ON "public"."Payment"("subscriptionId" ASC);

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "public"."Payment"("userId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_userId_key" ON "public"."Profile"("userId" ASC);

-- CreateIndex
CREATE INDEX "RagDocument_adminId_idx" ON "public"."RagDocument"("adminId" ASC);

-- CreateIndex
CREATE INDEX "RagDocument_audience_idx" ON "public"."RagDocument"("audience" ASC);

-- CreateIndex
CREATE INDEX "RagDocument_createdAt_idx" ON "public"."RagDocument"("createdAt" ASC);

-- CreateIndex
CREATE INDEX "RagDocument_status_idx" ON "public"."RagDocument"("status" ASC);

-- CreateIndex
CREATE INDEX "RagDocument_type_idx" ON "public"."RagDocument"("type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "public"."Session"("sessionToken" ASC);

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "public"."Session"("userId" ASC);

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "public"."Subscription"("status" ASC);

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "public"."Subscription"("userId" ASC);

-- CreateIndex
CREATE INDEX "Subscription_validUntil_idx" ON "public"."Subscription"("validUntil" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "public"."VerificationToken"("identifier" ASC, "token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "public"."VerificationToken"("token" ASC);

-- NEW: ConversationRun indeksid
CREATE INDEX "ConversationRun_userId_updatedAt_idx" ON "public"."ConversationRun"("userId" ASC, "updatedAt" ASC);
CREATE INDEX "ConversationRun_status_idx" ON "public"."ConversationRun"("status" ASC);
CREATE INDEX "ConversationRun_userId_status_updatedAt_idx" ON "public"."ConversationRun"("userId" ASC, "status" ASC, "updatedAt" DESC);

-- AddForeignKey
ALTER TABLE "public"."Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "public"."Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RagDocument" ADD CONSTRAINT "RagDocument_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- NEW: ConversationRun FK
ALTER TABLE "public"."ConversationRun" ADD CONSTRAINT "ConversationRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
