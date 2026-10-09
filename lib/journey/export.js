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
  steps = [],
  assessments = [],
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
    /* Inimese enda sammud: mida, kes, mis ajaks, kas tehtud ja mis juhtus. */
    steps: steps.map((step) => ({
      id: step.id,
      title: step.title,
      doer: step.doer || null,
      dueOn: step.dueOn || null,
      state: step.state,
      note: step.note || null,
      doneAt: step.doneAt || null,
      createdAt: step.createdAt,
      updatedAt: step.updatedAt
    })),
    /* Inimese enda hinnangud: aste (1 = väga raske … 5 = hästi), muutus võrreldes algseisuga ja märkus. */
    assessments: assessments.map((item) => ({
      id: item.id,
      level: item.level,
      change: item.change,
      note: item.note || null,
      createdAt: item.createdAt
    })),
    links: {
      preInquiries: linkedPreInquiries
    },
    activity,
    excludedFields: [...EXCLUDED_FIELDS]
  };
}
