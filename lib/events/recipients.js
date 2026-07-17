import { AudienceRule, DomainEventType, getEventSpec } from "@/lib/events/registry";

function uniqueIds(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export async function resolveRecipients(event, { db } = {}) {
  if (!db?.preInquiry?.findFirst) throw new TypeError("Recipient resolver database is required");
  const spec = getEventSpec(event?.type);
  if (!spec || event.audienceRule !== spec.audienceRule || event.sourceType !== spec.sourceType) return [];
  if (spec.audienceRule === AudienceRule.AUTHOR) {
    const expected = event.type === DomainEventType.PRE_INQUIRY_ARCHIVED
      ? { status: "ARCHIVED", openedAt: { not: null } }
      : { openedAt: { not: null } };
    const row = await db.preInquiry.findFirst({
      where: { id: event.sourceId, ...expected },
      select: { authorId: true }
    });
    return uniqueIds([row?.authorId]);
  }
  if (spec.audienceRule === AudienceRule.RECIPIENT_OWNER) {
    const row = await db.preInquiry.findFirst({
      where: { id: event.sourceId, recalledAt: { not: null } },
      select: { recipientOwnerId: true }
    });
    return uniqueIds([row?.recipientOwnerId]);
  }
  return [];
}
