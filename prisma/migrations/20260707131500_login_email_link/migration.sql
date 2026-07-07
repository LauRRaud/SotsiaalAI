ALTER TABLE "LoginTempToken" ADD COLUMN "emailLinkTokenHash" TEXT;

CREATE UNIQUE INDEX "LoginTempToken_emailLinkTokenHash_key" ON "LoginTempToken"("emailLinkTokenHash");
