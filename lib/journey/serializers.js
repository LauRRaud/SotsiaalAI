export function serializeJourney(journey) {
  if (!journey) return null;
  return {
    id: journey.id,
    ownerUserId: journey.ownerUserId,
    conversationId: journey.conversationId,
    roleContext: journey.roleContext,
    status: journey.status,
    sharingStatus: journey.sharingStatus,
    title: journey.title,
    summary: journey.summary,
    primaryPath: journey.primaryPath,
    domains: Array.isArray(journey.domains) ? journey.domains : [],
    missingInfo: Array.isArray(journey.missingInfo) ? journey.missingInfo : [],
    riskSignals: Array.isArray(journey.riskSignals) ? journey.riskSignals : [],
    suggestedActions: Array.isArray(journey.suggestedActions) ? journey.suggestedActions : [],
    context: journey.context && typeof journey.context === "object" && !Array.isArray(journey.context)
      ? journey.context
      : {},
    createdAt: journey.createdAt?.toISOString?.() || journey.createdAt,
    updatedAt: journey.updatedAt?.toISOString?.() || journey.updatedAt
  };
}
