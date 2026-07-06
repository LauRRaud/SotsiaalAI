-- CreateTable
CREATE TABLE "EmailOtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailOtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceTokenHash" TEXT NOT NULL,
    "userAgentFingerprint" TEXT,
    "ipRange" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginTempToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "requiresOtp" BOOLEAN NOT NULL DEFAULT false,
    "otpVerifiedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "trustedDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginTempToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailOtpCode_userId_createdAt_idx" ON "EmailOtpCode"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailOtpCode_expiresAt_idx" ON "EmailOtpCode"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_deviceTokenHash_key" ON "TrustedDevice"("deviceTokenHash");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "LoginTempToken_tokenHash_key" ON "LoginTempToken"("tokenHash");

-- CreateIndex
CREATE INDEX "LoginTempToken_userId_idx" ON "LoginTempToken"("userId");

-- CreateIndex
CREATE INDEX "LoginTempToken_expiresAt_idx" ON "LoginTempToken"("expiresAt");

-- AddForeignKey
ALTER TABLE "EmailOtpCode" ADD CONSTRAINT "EmailOtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginTempToken" ADD CONSTRAINT "LoginTempToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginTempToken" ADD CONSTRAINT "LoginTempToken_trustedDeviceId_fkey" FOREIGN KEY ("trustedDeviceId") REFERENCES "TrustedDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
