/**
 * SOL-XFUNC-03 — masinloetav isikuandmete pinnaregister.
 *
 * Loendid on tahtlikult NIMELISED, mitte skeemist automaatselt tuletatud.
 * Nii muudab uus või ümber nimetatud `User`-seos CI värava punaseks, kuni
 * omanik, projektsioon, kolmanda isiku piir, säilitus ja ekspordiotsus on läbi
 * mõeldud. Sama reegel kehtib faili-, RAG- ja väliskoopia marker-väljadele.
 */

export const PERSONAL_DATA_EXPORT_DECISIONS = Object.freeze({
  EXPORTED: "EXPORTED",
  THIRD_PARTY_EXCLUDED: "THIRD_PARTY_EXCLUDED",
  RETAINED_SNAPSHOT: "RETAINED_SNAPSHOT",
  NOT_PERSONAL_DATA: "NOT_PERSONAL_DATA"
});

const EXPORTED_RELATIONS = Object.freeze({
  profile: ["profile_and_consents"],
  frameworkAcceptances: ["profile_and_consents"],
  materialSubmissions: ["material_submissions"],
  fieldVisits: ["field_visits"],
  fieldOcrJobs: ["field_visits"],
  caseWorkAssistsOwned: ["casework"],
  organizationMemberships: ["organization_memberships"],
  serviceEntriesEntered: ["service_log"],
  serviceLogTimeSamples: ["service_log"],
  serviceEntriesAsClient: ["service_log"],
  serviceReferralsAsClient: ["service_log"],
  serviceNarrativesAsClient: ["service_log"],
  serviceEntryCorrections: ["service_log"],
  serviceReportShares: ["service_log", "sharing_history"],
  serviceProviderProfiles: ["service_provider_profile", "service_log"],
  conversations: ["conversations"],
  conversationMessages: ["conversations"],
  journeys: ["journeys"],
  wellbeingRecords: ["wellbeing_records"],
  wellbeingOutputDrafts: ["wellbeing_output_drafts"],
  practiceReflections: ["practice_reflections"],
  authoredPreInquiries: ["pre_inquiries_sender_view", "sharing_history"],
  roomMemberships: ["sharing_history"],
  sentInvites: ["sharing_history"],
  roomSharedSummaries: ["sharing_history"],
  helpRequests: ["sharing_history"],
  helpOffers: ["sharing_history"],
  requestedHelpMatches: ["sharing_history"],
  offeredHelpMatches: ["sharing_history"],
  mentoringPrivateNotes: ["sharing_history"],
  wellbeingSupportShares: ["sharing_history"],
  networkSharesAsWorker: ["sharing_history"],
  networkSharesAsClient: ["sharing_history"],
  networkSharesAsRecipient: ["sharing_history"],
  documents: ["documents_and_artifacts"],
  agentArtifacts: ["documents_and_artifacts"],
  savedAnalyses: ["saved_analyses"]
});

const SECURITY_RELATIONS = Object.freeze([
  "accounts",
  "sessions",
  "emailOtpCodes",
  "trustedDevices",
  "loginTempTokens",
  "pendingEmailChange",
  "dataExportJobs"
]);

const LEGAL_AND_USAGE_RELATIONS = Object.freeze([
  "subscriptions",
  "payments",
  "billingMethods",
  "sponsoredSubscriptions",
  "usageBuckets",
  "usageReservations",
  "usageEvents",
  "usageOverrides"
]);

const DERIVED_AND_AUDIT_RELATIONS = Object.freeze([
  "ragDocuments",
  "transcriptionJobs",
  "artifactRefinements",
  "documentAudits",
  "materialSubmissionBatches",
  "conversationRuns",
  "chatTurns",
  "researchJobs",
  "meetingSummaryJobClaim",
  "fieldOcrRateEvents",
  "notificationEvents",
  "domainEventsActed",
  "sourceFeedbackReported",
  "sourceFeedbackResolved",
  "effectivePracticeAuditEvents",
  "practiceCapabilityAuditsTarget",
  "practiceCapabilityAuditsActor",
  "covisionAuditEvents",
  "supervisionAuditEvents",
  "mentoringAuditEventsActed",
  "urgentRequestEvents"
]);

const SHARED_OR_THIRD_PARTY_RELATIONS = Object.freeze([
  "grantedUsageOverrides",
  "roomsOwned",
  "sponsoredInvites",
  "sponsoredMembers",
  "acceptedInvites",
  "roomMessages",
  "roomSummaryCopies",
  "roomSummaryApprovals",
  "callSessionsStarted",
  "callParticipants",
  "callSpeakRequests",
  "callSpeakRequestsClosed",
  "callRecordingRequests",
  "callRecordingConsents",
  "receivedPreInquiries",
  "wellbeingPilotViewers",
  "covisionCasesOwned",
  "covisionParticipants",
  "revokedCovisionParticipants",
  "covisionMessages",
  "effectivePractices",
  "topicSeeds",
  "covisionPrivateStates",
  "covisionStageSnapshots",
  "covisionClosuresOwned",
  "covisionClosuresClosed",
  "covisionClosuresAssigned",
  "covisionFollowUps",
  "covisionFollowUpsDone",
  "covisionOwnerPackages",
  "practiceCapabilities",
  "practiceCapabilitiesGranted",
  "effectivePracticeReviews",
  "effectivePracticeReviewAssignments",
  "effectivePracticeVersions",
  "effectivePracticeApplications",
  "effectivePracticeApplicationsReviewed",
  "effectivePracticeApplicationsAssigned",
  "supervisorGrants",
  "supervisorGrantsGranted",
  "supervisorGrantsRevoked",
  "supervisionProcessesSupervised",
  "supervisionContractVersionsCreated",
  "supervisionParticipations",
  "supervisionInvitationsSent",
  "supervisionTopicsAuthoredAsSupervisor",
  "supervisionPrivateItems",
  "supervisionMeetingsMarkedHeld",
  "supervisionSummariesCreated",
  "supervisionClosuresClosed",
  "supervisionPersonalOutcomes",
  "mentorProfile",
  "mentorProfilesReviewed",
  "mentoringRequestsSent",
  "mentoringRequestsReceived",
  "mentoringRelationsAsMentor",
  "mentoringRelationsAsMentee",
  "mentoringRelationsClosed",
  "mentoringAgreementAcceptances",
  "mentoringMeetingsCreated",
  "mentoringSummariesCreated",
  "mentoringSummaryConfirmations",
  "organizationMembershipsInvited",
  "organizationsCreated",
  "organizationsVerified",
  "organizationModulesActivated",
  "organizationCapabilitiesGranted",
  "organizationCapabilitiesRevoked",
  "organizationInvitesSent",
  "organizationInvitesAccepted",
  "organizationSeatPlansCreated",
  "organizationSeatsAssigned",
  "organizationWorkAssigned",
  "orgClientSponsorshipsSent",
  "orgClientSponsorshipsAccepted",
  "organizationReportingLinesCreated",
  "organizationSupportContactsCreated",
  "networkSharesAttested",
  "urgentDesksOwned",
  "urgentDesksVerified",
  "urgentDeskMemberships",
  "urgentRequestsAuthored",
  "urgentRequestsTaken",
  "caseWorkAssistsAsClient"
]);

function relationRecord(relation, details) {
  return Object.freeze({
    id: `User.${relation}`,
    kind: "PRISMA_USER_RELATION",
    relation,
    owner: details.owner,
    projection: details.projection,
    thirdPartyFilter: details.thirdPartyFilter,
    retentionClass: details.retentionClass,
    exportDecision: details.exportDecision,
    manifestSurfaces: Object.freeze([...(details.manifestSurfaces || [])]),
    decisionReason: details.decisionReason,
    positiveTest: details.positiveTest,
    negativeTest: details.negativeTest
  });
}

const exportedRecords = Object.entries(EXPORTED_RELATIONS).map(([relation, manifestSurfaces]) => relationRecord(relation, {
  owner: "REQUESTING_USER",
  projection: `ALLOWLIST:${manifestSurfaces.join("+")}`,
  thirdPartyFilter: "EXACT_OWNER_SCOPE_AND_EXPLICIT_FIELD_ALLOWLIST",
  retentionClass: "DOMAIN_POLICY",
  exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED,
  manifestSurfaces,
  decisionReason: "The requester's allowlisted data is represented in the named ZIP surface.",
  positiveTest: "ZIP_MANIFEST_CONTAINS_OWNER_SURFACE",
  negativeTest: "FOREIGN_OWNER_CONTENT_IS_EXCLUDED"
}));

const securityRecords = SECURITY_RELATIONS.map(relation => relationRecord(relation, {
  owner: "REQUESTING_USER_SECURITY_CONTEXT",
  projection: "NO_SECRET_MATERIAL; CONTENT_FREE_LIFECYCLE_ONLY",
  thirdPartyFilter: "TOKENS_HASHES_PROVIDER_SECRETS_AND_DEVICE_IDENTIFIERS_EXCLUDED",
  retentionClass: "SECURITY_TRANSIENT_OR_ACCOUNT_LIFETIME",
  exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.RETAINED_SNAPSHOT,
  decisionReason: "Authentication and export-job internals are retained under the security policy and are not copied recursively into the archive.",
  positiveTest: "SECURITY_SURFACE_HAS_EXPLICIT_RETENTION_DECISION",
  negativeTest: "SECRET_MATERIAL_IS_NOT_EXPORTED"
}));

const legalRecords = LEGAL_AND_USAGE_RELATIONS.map(relation => relationRecord(relation, {
  owner: "REQUESTING_USER_OR_SPONSORSHIP_LEDGER",
  projection: "CONTENT_FREE_FINANCIAL_OR_USAGE_SNAPSHOT",
  thirdPartyFilter: "SPONSOR_RECIPIENT_AND_PROVIDER_SECRET_FIELDS_EXCLUDED",
  retentionClass: "LEGAL_ACCOUNTING_OR_USAGE_LEDGER",
  exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.RETAINED_SNAPSHOT,
  decisionReason: "The canonical record follows a separate statutory or usage-ledger retention contract.",
  positiveTest: "LEGAL_SURFACE_HAS_EXPLICIT_RETENTION_DECISION",
  negativeTest: "PROVIDER_AND_SPONSOR_DETAILS_ARE_EXCLUDED"
}));

const auditRecords = DERIVED_AND_AUDIT_RELATIONS.map(relation => relationRecord(relation, {
  owner: "PLATFORM_AUDIT_OR_DERIVED_JOB",
  projection: "CONTENT_FREE_PROVENANCE_OR_SOURCE_OBJECT_IN_OWNER_SURFACE",
  thirdPartyFilter: "DERIVED_TEXT_INTERNAL_ERRORS_ACTOR_IDENTITIES_AND_SECRET_REFERENCES_EXCLUDED",
  retentionClass: "AUDIT_JOB_OR_DERIVED_COPY_POLICY",
  exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.RETAINED_SNAPSHOT,
  decisionReason: "The source object is exported where applicable; operational jobs and audit evidence stay in their bounded retention class.",
  positiveTest: "DERIVED_SURFACE_HAS_EXPLICIT_RETENTION_DECISION",
  negativeTest: "INTERNAL_DERIVED_TEXT_AND_ERRORS_ARE_EXCLUDED"
}));

const sharedRecords = SHARED_OR_THIRD_PARTY_RELATIONS.map(relation => relationRecord(relation, {
  owner: "SHARED_DOMAIN_OBJECT_OR_OTHER_SUBJECT",
  projection: "NO_RAW_SHARED_CONTENT; OWNER_HISTORY_ONLY_WHERE_SEPARATELY_REGISTERED",
  thirdPartyFilter: "OTHER_PARTICIPANT_CONTENT_AND_IDENTITIES_EXCLUDED",
  retentionClass: "SHARED_RECORD_OR_DOMAIN_POLICY",
  exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.THIRD_PARTY_EXCLUDED,
  decisionReason: "The relation is an actor, recipient, reviewer, shared-room or shared-case edge; its raw object cannot be copied as solely the requester's data.",
  positiveTest: "SHARED_SURFACE_HAS_EXPLICIT_OWNER_HISTORY_DECISION",
  negativeTest: "OTHER_SUBJECT_CONTENT_IS_EXCLUDED"
}));

export const PRISMA_USER_RELATION_CLASSIFICATIONS = Object.freeze([
  ...exportedRecords,
  ...securityRecords,
  ...legalRecords,
  ...auditRecords,
  ...sharedRecords
]);

const COPY_GROUPS = Object.freeze([
  {
    ids: ["ServiceProviderProfile.ragSourceId"],
    owner: "REQUESTING_USER",
    projection: "service_provider_profile.ragSourceId",
    thirdPartyFilter: "EXACT_PROFILE_OWNER; INTERNAL_RAG_METADATA_EXCLUDED",
    retentionClass: "SERVICE_PROVIDER_PROFILE_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED,
    manifestSurfaces: ["service_provider_profile"],
    decisionReason: "The owner's safe RAG source relation is represented in the service-provider-profile ZIP surface."
  },
  {
    ids: ["UserDocument.storagePath"],
    owner: "REQUESTING_USER",
    projection: "documents_and_artifacts.originalFile",
    thirdPartyFilter: "EXACT_DOCUMENT_OWNER; INTERNAL_STORAGE_PATH_EXCLUDED",
    retentionClass: "USER_DOCUMENT_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED,
    manifestSurfaces: ["documents_and_artifacts"],
    decisionReason: "The owner's stored document is represented by its safe archive entry and manifest state."
  },
  {
    ids: ["MaterialSubmission.storagePath", "MaterialSubmission.ragSourceId"],
    owner: "REQUESTING_USER",
    projection: "material_submissions.originalFile+ragRelation",
    thirdPartyFilter: "EXACT_SUBMITTER; INTERNAL_STORAGE_PATH_AND_RAG_METADATA_EXCLUDED",
    retentionClass: "MATERIAL_SUBMISSION_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED,
    manifestSurfaces: ["material_submissions"],
    decisionReason: "The submitter's file and safe imported-RAG relation are represented in the material-submissions ZIP surface."
  },
  {
    ids: [
      "Account.providerAccountId",
      "Payment.providerPaymentId",
      "BillingMethod.providerCustomerId",
      "BillingMethod.providerMandateId",
      "PaymentEmailOutbox.messageId",
      "DataDeletionJob.storagePath",
      "DataDeletionJob.externalRef",
      "DataExportJob.outputPath",
      "NotificationEvent.emailMessageId",
      "CovisionInviteDelivery.messageId",
      "EffectivePractice.ragSourceId",
      "RagDocument.remoteId",
      "ServiceProviderProfileRagJob.documentId",
      "CallRecordingFile.egressId",
      "CallRecordingFile.filePath",
      "ServiceLogReportLegalArchive.storagePath",
      "MaterialSubmissionBatch.notificationMessageId",
      "ServiceReportShare.storagePath",
      "ServiceReportShare.stagingStoragePath",
      "PreInquiry.externalEmailDelivery"
    ],
    owner: "PLATFORM_OR_LEGAL_COPY",
    projection: "CONTENT_FREE_REFERENCE_OR_SOURCE_OBJECT_EXPORT",
    thirdPartyFilter: "PROVIDER_SECRETS_RECIPIENT_CONTENT_INTERNAL_PATHS_AND_ERRORS_EXCLUDED",
    retentionClass: "SECURITY_LEGAL_OUTBOX_OR_DERIVED_COPY_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.RETAINED_SNAPSHOT,
    manifestSurfaces: [],
    decisionReason: "The external or retained copy follows a separate bounded lifecycle; raw provider and storage identifiers are not recursively exported."
  },
  {
    ids: [
      "ChatTurn.userMessageId",
      "ChatTurn.assistantMessageId",
      "SourceFeedback.messageId",
      "RoomSharedSummary.messageId",
      "ServiceReferral.clientExternalRef",
      "ServiceEntry.clientExternalRef",
      "ServiceMonthlyNarrative.clientExternalRef",
      "ServiceVisit.clientExternalRef",
      "NetworkShare.clientExternalRef",
      "CaseWorkAssist.clientExternalRef",
      "CaseWorkAssist.externalReference"
    ],
    owner: "DOMAIN_RECORD",
    projection: "SOURCE_RECORD_ONLY; IDEMPOTENCY_OR_LOCAL_LINK_NOT_A_COPY",
    thirdPartyFilter: "NO_LINKED_THIRD_PARTY_CONTENT",
    retentionClass: "DOMAIN_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.NOT_PERSONAL_DATA,
    manifestSurfaces: [],
    decisionReason: "The field is a local identity/idempotency link, not a separately held personal-data copy."
  },
  {
    ids: [
      "MunicipalityKovAdmin.ragDocId",
      "MunicipalityKovAdmin.rtRagDocId",
      "MunicipalityKovAdminFile.storagePath",
      "OrganizationAdmin.ragDocId",
      "OrganizationAdminFile.storagePath",
      "ServiceProviderLocation.adsObjectId",
      "ServiceMapEntry.sourceDocId",
      "ServiceMapEntry.adsObjectId"
    ],
    owner: "PUBLIC_BODY_OR_ORGANIZATION",
    projection: "PUBLIC_OR_ORGANIZATION_SOURCE_REGISTER",
    thirdPartyFilter: "CONTACT_PERSON_IDENTITIES_NOT_TREATED_AS_REQUESTER_OWNED",
    retentionClass: "SOURCE_REGISTRY_POLICY",
    exportDecision: PERSONAL_DATA_EXPORT_DECISIONS.THIRD_PARTY_EXCLUDED,
    manifestSurfaces: [],
    decisionReason: "The source file/RAG copy belongs to a public body or organization, not automatically to the requesting account."
  }
]);

export const PERSONAL_DATA_COPY_CLASSIFICATIONS = Object.freeze(COPY_GROUPS.flatMap(group =>
  group.ids.map(id => Object.freeze({
    id,
    kind: "FILE_RAG_OR_EXTERNAL_COPY",
    owner: group.owner,
    projection: group.projection,
    thirdPartyFilter: group.thirdPartyFilter,
    retentionClass: group.retentionClass,
    exportDecision: group.exportDecision,
    manifestSurfaces: Object.freeze([...group.manifestSurfaces]),
    decisionReason: group.decisionReason,
    positiveTest: group.exportDecision === PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED
      ? "ZIP_MANIFEST_CONTAINS_OWNER_COPY_SURFACE"
      : "COPY_HAS_EXPLICIT_NON_EXPORT_DECISION",
    negativeTest: group.exportDecision === PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED
      ? "INTERNAL_COPY_REFERENCE_IS_EXCLUDED"
      : "NON_OWNER_OR_INTERNAL_COPY_IS_NOT_EXPORTED"
  }))
));

const VIRTUAL_COPY_IDS = Object.freeze([
  // The exporter still supports the legacy imported-RAG reference even though
  // it is not currently a Prisma field. Keeping it explicit prevents that
  // code-held copy from disappearing from the contract silently.
  "MaterialSubmission.ragSourceId",
  "PreInquiry.externalEmailDelivery"
]);

export const PERSONAL_DATA_SURFACE_REGISTRY = Object.freeze([
  ...PRISMA_USER_RELATION_CLASSIFICATIONS,
  ...PERSONAL_DATA_COPY_CLASSIFICATIONS
]);

function prismaModels(schemaText) {
  return new Set([...String(schemaText || "").matchAll(/^model\s+([A-Za-z][A-Za-z0-9_]*)\s*\{/gmu)]
    .map(match => match[1]));
}

export function discoverPrismaUserRelations(schemaText) {
  const schema = String(schemaText || "");
  const body = schema.match(/^model\s+User\s*\{(?<body>[\s\S]*?)^\}/mu)?.groups?.body;
  if (typeof body !== "string") throw new Error("personal_data_surface_registry.user_model_missing");
  const models = prismaModels(schema);
  const relations = [];
  for (const line of body.split(/\r?\n/u)) {
    const field = line.match(/^\s{2}(?<name>[A-Za-z][A-Za-z0-9_]*)\s+(?<type>[A-Za-z][A-Za-z0-9_]*)(?:\[\]|\?)?/u);
    if (field?.groups && models.has(field.groups.type)) relations.push(field.groups.name);
  }
  return relations.sort();
}

const COPY_FIELD_PATTERN = /^(?:storagePath|stagingStoragePath|outputPath|filePath|egressId|ragSourceId|ragDocId|rtRagDocId|remoteId|sourceDocId|adsObjectId|externalRef|externalReference|clientExternalRef|provider(?:Payment|Customer|Mandate|Account)Id|messageId|emailMessageId|notificationMessageId|userMessageId|assistantMessageId)$/u;
const MODEL_SPECIFIC_COPY_FIELDS = Object.freeze({
  ServiceProviderProfileRagJob: Object.freeze(["documentId"])
});

export function discoverPersonalDataCopyFields(schemaText) {
  const found = [];
  for (const model of String(schemaText || "").matchAll(/^model\s+(?<model>[A-Za-z][A-Za-z0-9_]*)\s*\{(?<body>[\s\S]*?)^\}/gmu)) {
    for (const line of model.groups.body.split(/\r?\n/u)) {
      const field = line.match(/^\s{2}(?<name>[A-Za-z][A-Za-z0-9_]*)\s+/u)?.groups?.name;
      const modelSpecific = MODEL_SPECIFIC_COPY_FIELDS[model.groups.model] || [];
      if (field && (COPY_FIELD_PATTERN.test(field) || modelSpecific.includes(field))) {
        found.push(`${model.groups.model}.${field}`);
      }
    }
  }
  return found.sort();
}

function duplicates(values) {
  const seen = new Set();
  const duplicate = new Set();
  for (const value of values) {
    if (seen.has(value)) duplicate.add(value);
    seen.add(value);
  }
  return [...duplicate].sort();
}

function setDifference(left, right) {
  const rightSet = new Set(right);
  return [...new Set(left)].filter(value => !rightSet.has(value)).sort();
}

export function classifiedExportSurfaceNames() {
  return [...new Set(PERSONAL_DATA_SURFACE_REGISTRY
    .filter(item => item.exportDecision === PERSONAL_DATA_EXPORT_DECISIONS.EXPORTED)
    .flatMap(item => item.manifestSurfaces))].sort();
}

export function validatePersonalDataSurfaceRegistry({ schemaText, exportSurfaceNames }) {
  const schemaRelations = discoverPrismaUserRelations(schemaText);
  const classifiedRelations = PRISMA_USER_RELATION_CLASSIFICATIONS.map(item => item.relation);
  const discoveredCopies = discoverPersonalDataCopyFields(schemaText);
  const classifiedCopyIds = PERSONAL_DATA_COPY_CLASSIFICATIONS.map(item => item.id)
    .filter(id => !VIRTUAL_COPY_IDS.includes(id));
  const runtimeSurfaces = [...new Set(exportSurfaceNames || [])].sort();
  const classifiedSurfaces = classifiedExportSurfaceNames();
  const requiredFields = [
    "owner",
    "projection",
    "thirdPartyFilter",
    "retentionClass",
    "exportDecision",
    "decisionReason",
    "positiveTest",
    "negativeTest"
  ];
  const invalidRecords = PERSONAL_DATA_SURFACE_REGISTRY
    .filter(item => requiredFields.some(field => !String(item[field] || "").trim()))
    .map(item => item.id);
  const invalidDecisions = PERSONAL_DATA_SURFACE_REGISTRY
    .filter(item => !Object.values(PERSONAL_DATA_EXPORT_DECISIONS).includes(item.exportDecision))
    .map(item => item.id);
  return Object.freeze({
    missingRelations: setDifference(schemaRelations, classifiedRelations),
    staleRelations: setDifference(classifiedRelations, schemaRelations),
    duplicateRelations: duplicates(classifiedRelations),
    missingCopyFields: setDifference(discoveredCopies, classifiedCopyIds),
    staleCopyFields: setDifference(classifiedCopyIds, discoveredCopies),
    duplicateCopyFields: duplicates(PERSONAL_DATA_COPY_CLASSIFICATIONS.map(item => item.id)),
    invalidRecords: invalidRecords.sort(),
    invalidDecisions: invalidDecisions.sort(),
    missingManifestSurfaces: setDifference(classifiedSurfaces, runtimeSurfaces),
    unclassifiedManifestSurfaces: setDifference(runtimeSurfaces, classifiedSurfaces)
  });
}

export function assertPersonalDataSurfaceRegistryComplete(input) {
  const result = validatePersonalDataSurfaceRegistry(input);
  const failures = Object.entries(result).filter(([, values]) => values.length > 0);
  if (failures.length) {
    const detail = failures.map(([key, values]) => `${key}=${values.join(",")}`).join("; ");
    throw new Error(`personal_data_surface_registry.incomplete: ${detail}`);
  }
  return result;
}
