-- CreateEnum
CREATE TYPE "RoomMessageSenderType" AS ENUM ('USER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN "displayName" TEXT;

-- AlterTable
ALTER TABLE "RoomMessage" ADD COLUMN "senderType" "RoomMessageSenderType" NOT NULL DEFAULT 'USER';
