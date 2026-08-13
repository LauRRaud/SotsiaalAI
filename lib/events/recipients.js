import { AudienceRule, DomainEventType, getEventSpec } from "@/lib/events/registry";

function uniqueIds(values) {
  return [...new Set(values.map((value) => String(value || "").trim()).filter(Boolean))];
}

export async function resolveRecipients(event, { db } = {}) {
  if (!db) throw new TypeError("Recipient resolver database is required");
  const spec = getEventSpec(event?.type);
  if (!spec || event.audienceRule !== spec.audienceRule || event.sourceType !== spec.sourceType) return [];
  if (spec.audienceRule === AudienceRule.OWNER && spec.projectionType === "WORKSPACE_TIMELINE_ONLY") {
    return [];
  }
  if (spec.audienceRule === AudienceRule.AUTHOR) {
    if (!db.preInquiry?.findFirst) throw new TypeError("Pre-inquiry recipient resolver database is required");
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
    if (!db.preInquiry?.findFirst) throw new TypeError("Pre-inquiry recipient resolver database is required");
    const row = await db.preInquiry.findFirst({
      where: { id: event.sourceId, recalledAt: { not: null } },
      select: { recipientOwnerId: true }
    });
    return uniqueIds([row?.recipientOwnerId]);
  }
  if (spec.audienceRule === AudienceRule.NETWORK_SHARE_PARTICIPANT) {
    if (!db.networkShare?.findFirst) throw new TypeError("Network-share recipient resolver database is required");
    const row = await db.networkShare.findFirst({
      where: { id: event.sourceId },
      select: { workerId: true, clientUserId: true, recipientUserId: true }
    });
    const kind = String(event?.meta?.recipientKind || "NONE");
    if (kind === "WORKER") return uniqueIds([row?.workerId]);
    if (kind === "CLIENT") return uniqueIds([row?.clientUserId]);
    if (kind === "RECIPIENT") return uniqueIds([row?.recipientUserId]);
    if (kind === "ALL") return uniqueIds([row?.workerId, row?.clientUserId, row?.recipientUserId]);
    return [];
  }
  return [];
}
