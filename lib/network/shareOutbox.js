import {
  createNotificationEvent,
  NOTIFICATION_EVENT_TYPES
} from "@/lib/notifications";

/**
 * Saatmise püsiv outbox. Rida sünnib sama Prisma tehingukliendiga nagu SENT,
 * ruum ja liikmed; teavituse töötlus võib tulla hiljem, aga sündmus ei saa
 * jääda neist ette ega taha.
 */
export async function createNetworkShareOutbox({ share, db, now = new Date() }) {
  if (!share?.id || !share?.recipientUserId || !share?.sourcePreInquiryId || !db) {
    throw new Error("network_share.outbox_input_required");
  }
  return createNotificationEvent({
    userId: share.recipientUserId,
    type: NOTIFICATION_EVENT_TYPES.NETWORK_SHARE_RECEIVED,
    sourceId: share.id,
    targetId: share.id,
    dedupeSuffix: "sent-v1",
    emailPolicy: "NONE",
    expiresAt: share.participationEndsOn
      ? new Date(Date.UTC(
        new Date(share.participationEndsOn).getUTCFullYear(),
        new Date(share.participationEndsOn).getUTCMonth(),
        new Date(share.participationEndsOn).getUTCDate() + 1
      ))
      : null
  }, { db, now, verifyRecipient: false });
}
