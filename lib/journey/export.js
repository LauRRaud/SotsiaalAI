const EXCLUDED_FIELDS = Object.freeze([
  "ownerUserId",
  "context.activityLog",
  "preInquiry.body",
  "preInquiry.recipient"
]);

function withoutUntrustedActivity(context) {
  const source = context && typeof context === "object" && !Array.isArray(context) ? context : {};
  const { activityLog: _activityLog, ...trustedContext } = source;
  return trustedContext;
}

export function buildJourneyExport({
  journey,
  activity = [],
  linkedPreInquiries = [],
  exportedAt = new Date()
} = {}) {
  if (!journey?.id) {
    const error = new Error("journeys.errors.not_found");
    error.status = 404;
    throw error;
  }
  return {
    schema: "sotsiaalai.journey.export",
    schemaVersion: "1.0",
    exportedAt: exportedAt.toISOString(),
    journey: {
      id: journey.id,
      roleContext: journey.roleContext,
      status: journey.status,
      sharingStatus: journey.sharingStatus,
      title: journey.title,
      summary: journey.summary,
      primaryPath: journey.primaryPath,
      domains: journey.domains || [],
      missingInfo: journey.missingInfo || [],
      riskSignals: journey.riskSignals || [],
      suggestedActions: journey.suggestedActions || [],
      context: withoutUntrustedActivity(journey.context),
      createdAt: journey.createdAt,
      updatedAt: journey.updatedAt
    },
    origin: {
      conversationId: journey.conversationId || null
    },
    links: {
      preInquiries: linkedPreInquiries
    },
    activity,
    excludedFields: [...EXCLUDED_FIELDS]
  };
}
