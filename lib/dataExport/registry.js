import { readStoredDocument } from "@/lib/documents/server";
import { readStoredMaterial } from "@/lib/materials/server";
import { collectOwnerSharingHistory } from "@/lib/mySharings";
import { collectServiceLogDataExport } from "@/lib/serviceLog/privacyLifecycle";
import { collectOrganizationMembershipDataExport } from "@/lib/org/dataExport";
import { collectCaseWorkDataExport } from "@/lib/casework/dataExport";

// Canonical machine-readable classification contract for every schema-backed
// user relation and file/RAG/external copy considered by this export registry.
export {
  PERSONAL_DATA_COPY_CLASSIFICATIONS,
  PERSONAL_DATA_EXPORT_DECISIONS,
  PERSONAL_DATA_SURFACE_REGISTRY,
  PRISMA_USER_RELATION_CLASSIFICATIONS
} from "@/lib/dataExport/personalDataSurfaceRegistry";

const iso = value => value?.toISOString?.() || value || null;
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
const ndjson = rows => Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");

function profileProjection(row) {
  return {
    account: {
      email: row.email || null,
      emailVerifiedAt: iso(row.emailVerified),
      role: row.role,
      acceptsPreInquiries: Boolean(row.acceptsPreInquiries),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt)
    },
    profile: row.profile ? {
      firstName: row.profile.firstName || null,
      lastName: row.profile.lastName || null,
      phone: row.profile.phone || null
    } : null,
    consents: (row.frameworkAcceptances || []).map(item => ({
      frameworkKey: item.frameworkKey,
      frameworkVersion: item.frameworkVersion,
      acceptanceType: item.acceptanceType,
      acceptanceSource: item.acceptanceSource,
      roleAtAcceptance: item.roleAtAcceptance,
      locale: item.locale || null,
      acceptedAt: iso(item.acceptedAt)
    }))
  };
}

function serviceProviderProfileExportProjection(row) {
  const safeRagMetadata = row.ragMetadata && typeof row.ragMetadata === "object" && !Array.isArray(row.ragMetadata)
    ? {
        syncStatus: row.ragMetadata.syncStatus || null,
        reason: row.ragMetadata.reason || null,
        checkedAt: row.ragMetadata.checkedAt || null
      }
    : null;
  return {
    id: row.id,
    ownershipMode: row.ownershipMode,
    organizationName: row.organizationName,
    organizationType: row.organizationType || null,
    registryCode: row.registryCode || null,
    shortDescription: row.shortDescription || null,
    longDescription: row.longDescription || null,
    serviceArea: row.serviceArea || null,
    serviceAreaMunicipalityIds: row.serviceAreaMunicipalityIds || [],
    county: row.county || null,
    address: row.address || null,
    normalizedAddress: row.normalizedAddress || null,
    phone: row.phone || null,
    email: row.email || null,
    website: row.website || null,
    primaryContactName: row.primaryContactName || null,
    languages: row.languages || [],
    accessibilityInfo: row.accessibilityInfo || null,
    generalAccessibilityNote: row.generalAccessibilityNote || null,
    feeType: row.feeType,
    mapVisible: Boolean(row.mapVisible),
    acceptsPlatformPreInquiries: Boolean(row.acceptsPlatformPreInquiries),
    acceptsEmailPreInquiries: Boolean(row.acceptsEmailPreInquiries),
    assistantRecommendationAllowed: Boolean(row.assistantRecommendationAllowed),
    status: row.status,
    publicSlug: row.publicSlug || null,
    publishedAt: iso(row.publishedAt),
    hiddenAt: iso(row.hiddenAt),
    checkedAt: iso(row.checkedAt),
    rag: { sourceId: row.ragSourceId || null, metadata: safeRagMetadata },
    services: (row.serviceItems || []).map((service) => ({
      id: service.id,
      serviceKey: service.serviceKey || null,
      name: service.name,
      description: service.description || null,
      longDescription: service.longDescription || null,
      includesText: service.includesText || null,
      excludesText: service.excludesText || null,
      additionalInfo: service.additionalInfo || null,
      categories: service.categories || [],
      ageGroups: service.ageGroups || [],
      targetGroups: service.targetGroups || [],
      requesterRoles: service.requesterRoles || [],
      needTags: service.needTags || [],
      lifeDomains: service.lifeDomains || [],
      deliveryModes: service.deliveryModes || [],
      serviceArea: service.serviceArea || null,
      municipalityIds: service.municipalityIds || [],
      serviceLanguages: service.serviceLanguages || [],
      inquiryLanguages: service.inquiryLanguages || [],
      feeType: service.feeType,
      priceDescription: service.priceDescription || null,
      availabilityStatus: service.availabilityStatus || null,
      availabilityDescription: service.availabilityDescription || null,
      availabilityCheckedAt: iso(service.availabilityCheckedAt),
      contactMode: service.contactMode || null,
      contactName: service.contactName || null,
      phone: service.phone || null,
      email: service.email || null,
      website: service.website || null,
      mapVisible: Boolean(service.mapVisible),
      status: service.status,
      sortOrder: service.sortOrder,
      licence: service.licenceAssessment ? {
        publicStatus: service.licenceAssessment.publicStatus,
        coverage: service.licenceAssessment.coverage,
        publicStatusValidUntil: iso(service.licenceAssessment.publicStatusValidUntil)
      } : null,
      locationIds: (service.locationLinks || []).map((link) => link.providerLocationId),
      createdAt: iso(service.createdAt),
      updatedAt: iso(service.updatedAt)
    })),
    locations: (row.serviceLocations || []).map((location) => ({
      id: location.id,
      label: location.label || null,
      address: location.address || null,
      normalizedAddress: location.normalizedAddress || null,
      county: location.county || null,
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
      geocodingStatus: location.geocodingStatus,
      adsObjectId: location.adsObjectId || null,
      phone: location.phone || null,
      email: location.email || null,
      website: location.website || null,
      openingHours: location.openingHours || null,
      accessibilityInfo: location.accessibilityInfo || null,
      mapVisible: Boolean(location.mapVisible),
      status: location.status,
      sortOrder: location.sortOrder,
      createdAt: iso(location.createdAt),
      updatedAt: iso(location.updatedAt)
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function conversationProjection(row, userId) {
  return {
    title: row.title || null,
    role: row.role,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt),
    // Only the owner's own messages and user-visible assistant replies are
    // exported. A message authored by a different user (authorId present and not
    // the owner) or an internal SYSTEM message is never included, so a shared or
    // migrated conversation cannot leak another person's words.
    messages: (row.messages || [])
      .filter(message => message.role !== "SYSTEM" && (message.authorId == null || message.authorId === userId))
      .map(message => ({ role: message.role, content: message.content, createdAt: iso(message.createdAt) }))
  };
}

function journeyProjection(row) {
  return {
    title: row.title,
    summary: row.summary,
    roleContext: row.roleContext,
    status: row.status,
    sharingStatus: row.sharingStatus,
    primaryPath: row.primaryPath || null,
    domains: Array.isArray(row.domains) ? row.domains : [],
    missingInfo: Array.isArray(row.missingInfo) ? row.missingInfo : [],
    riskSignals: Array.isArray(row.riskSignals) ? row.riskSignals : [],
    suggestedActions: Array.isArray(row.suggestedActions) ? row.suggestedActions : [],
    context: row.context && typeof row.context === "object" && !Array.isArray(row.context) ? row.context : {},
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function practiceReflectionProjection(row) {
  return {
    id: row.id,
    schemaVersion: row.schemaVersion,
    sourceKind: row.sourceKind || null,
    sourceId: row.sourceId || null,
    approach: row.approach || null,
    method: row.method || null,
    action: row.action || null,
    supportTechnique: row.supportTechnique || null,
    choiceReason: row.choiceReason || null,
    methodCatalogRef: row.methodCatalogRef || null,
    clientGoal: row.clientGoal || null,
    clientReaction: row.clientReaction || null,
    workerObservation: row.workerObservation || null,
    interpretation: row.interpretation || null,
    whatWorked: row.whatWorked || null,
    whatDidNot: row.whatDidNot || null,
    nextStep: row.nextStep || null,
    supportNeed: row.supportNeed || null,
    interimOutcome: row.interimOutcome || null,
    retentionState: row.retentionState,
    retentionDeadline: iso(row.retentionDeadline),
    deletedAt: iso(row.deletedAt),
    undoUntil: iso(row.undoUntil),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

/* SOL-WB-18: koopia jättis välja täpselt need väljad, mis teevad kirjest
   ELUTSÜKLI, mitte hetketõmmise: kontrollpunkti kokkulepe ja tema vastus,
   parandusahela viide ning see, kas kirje koondis üldse osaleb. Kasutaja ei
   saanud oma plaani, järelhindamist ega parandusahelat taastada, kuigi
   manifest näis täielik. */
function wellbeingProjection(row) {
  return {
    schemaVersion: row.schemaVersion,
    scoringVersion: row.scoringVersion,
    workflowType: row.workflowType,
    period: row.period || null,
    roleGroup: row.roleGroup || null,
    standardizedFields: row.standardizedFields,
    computedSignal: row.computedSignal,
    loadFactors: row.loadFactors,
    resourceFactors: row.resourceFactors,
    riskMarkers: row.riskMarkers,
    recommendedActions: row.recommendedActions,
    visibility: row.visibility,
    aggregationEligible: row.aggregationEligible,
    /* Parandusahel mõlemas suunas: mida SEE kirje parandab ja mis teda parandas.
       Ühesuunaline viide jätaks ahela lugeja jaoks katki. */
    supersedesRecordId: row.supersedesRecordId || null,
    supersededByRecordId: row.supersededBy?.id || null,
    checkpointDueOn: iso(row.checkpointDueOn),
    checkpointAnsweredAt: iso(row.checkpointAnsweredAt),
    checkpoint: row.checkpoint ?? null,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

/* SOL-WB-18: mustandeid ei loetud üldse, kuigi nad kannavad kasutaja enda
   kirjutatud ja toimetatud teksti, adressaaditüüpi, kinnitusi ja üleandmise
   aega. `covisionCaseId` EI ole siin: kovisiooni juhtum on jagatud objekt ja
   tema sisu ei kuulu selle inimese koopiasse — kaasa käib ainult FAKT, et
   üleandmine toimus. */
function wellbeingDraftProjection(row) {
  return {
    sourceWorkflowType: row.sourceWorkflowType,
    sourceRecordId: row.sourceRecordId || null,
    outputType: row.outputType,
    recipientType: row.recipientType,
    generatedText: row.generatedText,
    editedText: row.editedText || null,
    userReviewed: Boolean(row.userReviewed),
    userConfirmed: Boolean(row.userConfirmed),
    visibility: row.visibility,
    status: row.status,
    schemaVersion: row.schemaVersion,
    handedOff: Boolean(row.handedOffAt),
    handedOffAt: iso(row.handedOffAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function preInquiryProjection(row) {
  return {
    topic: row.topic || null,
    situation: row.situation,
    assessmentState: row.assessmentState || null,
    generatedDraft: row.generatedDraft || null,
    userEditedDraft: row.userEditedDraft || null,
    recipientType: row.recipientType,
    deliveryChannel: row.deliveryChannel,
    status: row.status,
    sentAt: iso(row.sentAt),
    openedAt: iso(row.openedAt),
    recalledAt: iso(row.recalledAt),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

/* SOL-DOC-J-04: salvestatud analüüs on omaniku teadlikult salvestatud tekst,
   mitte ajutine AI-vastus. Allika-ID-d jäävad alles ka siis, kui algdokument on
   hiljem kustutatud — vastasel juhul kaoks koopiast analüüsi päritolu. */
function savedAnalysisProjection(row) {
  return {
    id: row.id,
    title: row.title || null,
    content: row.content,
    disclaimer: row.metadata?.disclaimer || "ai_explanation_not_official_decision",
    sourceDocumentIds: Array.isArray(row.sourceDocumentIds) ? row.sourceDocumentIds : [],
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function fieldVisitProjection(row) {
  return {
    id: row.id,
    schemaVersion: 1,
    contentPolicy: "owner_authored_professional_record_may_describe_third_parties",
    status: row.status,
    version: row.version,
    goal: row.goal || null,
    locationText: row.locationText || null,
    plannedStartAt: iso(row.plannedStartAt),
    plannedEndAt: iso(row.plannedEndAt),
    arrivedConfirmedAt: iso(row.arrivedConfirmedAt),
    departedConfirmedAt: iso(row.departedConfirmedAt),
    safety: {
      armedAt: iso(row.safetyArmedAt),
      deadlineAt: iso(row.safetyDeadlineAt),
      remindedAt: iso(row.safetyRemindedAt),
      escalatedAt: iso(row.safetyEscalatedAt),
      escalationStatus: row.safetyEscalationStatus || null,
      resolvedNotifiedAt: iso(row.safetyResolvedNotifiedAt),
      resolvedNoticeStatus: row.safetyResolvedNoticeStatus || null,
      cancelledAt: iso(row.safetyCancelledAt)
    },
    notes: (row.notes || []).map(note => ({
      clientItemId: note.clientItemId,
      revision: note.revision,
      kind: note.kind,
      provenance: note.provenance,
      body: note.body,
      consent: note.kind === "consent" ? {
        kind: note.consentKind || null,
        subject: note.consentSubject || null,
        form: note.consentForm || null,
        withdrawnAt: iso(note.consentWithdrawnAt)
      } : null,
      aiConfirmedAt: iso(note.aiConfirmedAt),
      conflict: note.conflictState ? {
        state: note.conflictState,
        revision: note.conflictRevision,
        body: note.conflictBody || null,
        provenance: note.conflictProvenance || null
      } : null,
      deviceCreatedAt: iso(note.deviceCreatedAt),
      recoveryImportedAt: iso(note.recoveryImportedAt),
      createdAt: iso(note.createdAt),
      updatedAt: iso(note.updatedAt)
    })),
    attachments: (row.attachments || []).map(attachment => ({
      clientItemId: attachment.clientItemId,
      role: attachment.role,
      documentId: attachment.documentId || null,
      consentClientItemId: attachment.consentClientItemId || null,
      captureBasis: attachment.captureBasis || null,
      documentRequestReason: attachment.documentRequestReason || null,
      documentRequestAt: iso(attachment.documentRequestAt),
      storageStatus: attachment.storageStatus,
      transcriptConfirmedAt: iso(attachment.transcriptConfirmedAt),
      deviceCreatedAt: iso(attachment.deviceCreatedAt),
      recoveryImportedAt: iso(attachment.recoveryImportedAt),
      technical: attachment.document ? {
        kind: attachment.document.kind,
        mime: attachment.document.mime,
        size: attachment.document.size,
        sha256: attachment.document.sha256
      } : null,
      createdAt: iso(attachment.createdAt)
    })),
    handovers: (row.handovers || []).map(handover => ({
      id: handover.id,
      clientActionId: handover.clientActionId,
      requestSha256: handover.requestSha256,
      targets: handover.targetStates,
      createdAt: iso(handover.createdAt),
      updatedAt: iso(handover.updatedAt)
    })),
    ocrDrafts: (row.ocrJobs || []).map(job => ({
      attachmentId: job.attachmentId,
      contentSha256: job.contentSha256,
      status: job.status,
      provenance: "AI_MUSTAND",
      text: job.resultText || null,
      truncated: Boolean(job.resultTruncated),
      completedAt: iso(job.completedAt)
    })),
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function documentFileFailure(documentId, error) {
  const rawCode = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  const reason = rawCode === "ENOENT"
    ? "missing"
    : ["EACCES", "EPERM"].includes(rawCode)
      ? "access_denied"
      : message.includes("storage_path_invalid")
        ? "containment"
        : "read_failed";
  const failure = new Error(`data_export.document_file_unreadable|${documentId}|${reason}`);
  failure.code = "DATA_EXPORT_DOCUMENT_FILE_UNREADABLE";
  failure.documentId = documentId;
  failure.reason = reason;
  return failure;
}

function materialFileReason(error) {
  const rawCode = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  if (rawCode === "ENOENT") return "missing";
  if (["EACCES", "EPERM"].includes(rawCode)) return "access_denied";
  if (message.includes("storage_path_invalid")) return "containment";
  return "read_failed";
}

function materialProjection(row, file) {
  return {
    id: row.id,
    comment: row.comment,
    originalName: row.originalName,
    mime: row.mime,
    size: row.size,
    sha256: row.sha256,
    storageStatus: row.storageStatus,
    status: row.status,
    reviewRevision: row.reviewRevision,
    reviewedAt: iso(row.reviewedAt),
    reviewNote: row.reviewNote || null,
    retention: {
      original: {
        until: iso(row.originalRetentionUntil),
        class: row.originalRetentionClass || "MATERIAL_PENDING",
        state: row.originalRetentionState || "SCHEDULED",
        policyVersion: row.originalRetentionPolicyVersion || null,
        deletedAt: iso(row.originalDeletedAt)
      },
      derivative: {
        until: iso(row.derivativeRetentionUntil),
        class: row.derivativeRetentionClass || "MATERIAL_SANITIZED_DERIVATIVE",
        state: row.derivativeRetentionState || "NOT_PRESENT",
        policyVersion: row.derivativeRetentionPolicyVersion || null,
        deletedAt: iso(row.derivativeDeletedAt)
      },
      rag: {
        until: iso(row.ragRetentionUntil),
        class: row.ragRetentionClass || "MATERIAL_RAG_COPY",
        state: row.ragRetentionState || "NOT_PRESENT",
        policyVersion: row.ragRetentionPolicyVersion || null,
        rightsReviewedAt: iso(row.ragRightsReviewedAt),
        freshnessReviewedAt: iso(row.ragFreshnessReviewedAt),
        rightsValidUntil: iso(row.rightsValidUntil),
        sourceValidUntil: iso(row.sourceValidUntil),
        deletedAt: iso(row.ragDeletedAt)
      }
    },
    ragRelation: row.sourceId ? { sourceId: row.sourceId } : null,
    ragRelationStatus: row.status === "imported" && !row.sourceId ? "not_recorded" : "not_applicable",
    originalFile: file,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

// Every V1 surface owns its filter and projection. Missing entries are omitted;
// there is deliberately no fallback raw-database exporter.
export const DATA_EXPORT_REGISTRY = Object.freeze([
  {
    name: "material_submissions", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId, readMaterial = readStoredMaterial }) {
      const rows = await db.materialSubmission.findMany({
        where: { submittedByUserId: userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }]
      });
      const fileEntries = [];
      const fileManifest = [];
      const metadata = [];
      for (const row of rows) {
        const safeName = String(row.originalName || row.id).replace(/[^A-Za-z0-9._ -]/g, "_");
        const archivePath = `materials/files/${row.id}-${safeName}`;
        let file;
        if (row.storagePath) {
          try {
            const content = await readMaterial(row.storagePath);
            fileEntries.push({ name: archivePath, content, count: 0 });
            file = { status: "included", archivePath };
          } catch (error) {
            file = { status: "unavailable", reason: materialFileReason(error), archivePath: null };
          }
        } else {
          file = { status: "retention_deleted", reason: "retention_deleted", archivePath: null };
        }
        fileManifest.push({
          submissionId: row.id,
          status: file.status,
          reason: file.reason || null,
          archivePath: file.archivePath,
          sha256: row.sha256,
          importedRelation: row.sourceId || null,
          retentionUntil: iso(row.originalRetentionUntil),
          retentionClass: row.originalRetentionClass || "MATERIAL_PENDING",
          retentionState: row.originalRetentionState || "SCHEDULED"
        });
        if (row.derivativeStoragePath) {
          const derivativeArchivePath = `materials/derivatives/${row.id}-sanitized`;
          let derivativeFile;
          try {
            const content = await readMaterial(row.derivativeStoragePath);
            fileEntries.push({ name: derivativeArchivePath, content, count: 0 });
            derivativeFile = { status: "included", archivePath: derivativeArchivePath };
          } catch (error) {
            derivativeFile = { status: "unavailable", reason: materialFileReason(error), archivePath: null };
          }
          fileManifest.push({
            id: row.id,
            layer: "sanitized_derivative",
            status: derivativeFile.status,
            reason: derivativeFile.reason || null,
            archivePath: derivativeFile.archivePath,
            sha256: row.derivativeSha256 || null,
            retentionUntil: iso(row.derivativeRetentionUntil),
            retentionClass: row.derivativeRetentionClass,
            retentionState: row.derivativeRetentionState
          });
        }
        metadata.push(materialProjection(row, file));
      }
      return [{
        name: "materials.json",
        content: json(metadata),
        count: rows.length,
        manifest: {
          originalFiles: fileManifest.filter(item => !item.layer),
          materialFiles: fileManifest
        }
      }, ...fileEntries];
    }
  },
  {
    name: "field_visits", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.fieldVisit.findMany({
        where: { ownerUserId: userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          notes: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          attachments: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: { document: { select: { kind: true, mime: true, size: true, sha256: true } } }
          },
          handovers: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
          ocrJobs: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }
        }
      });
      return [{ name: "field-visits.ndjson", content: ndjson(rows.map(fieldVisitProjection)), count: rows.length }];
    }
  },
  {
    name: "casework", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await collectCaseWorkDataExport({ db, userId });
      return [{ name: "casework.ndjson", content: ndjson(rows), count: rows.length }];
    }
  },
  {
    name: "organization_memberships", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      return collectOrganizationMembershipDataExport({ db, userId });
    }
  },
  {
    name: "service_log", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      return collectServiceLogDataExport({ db, userId });
    }
  },
  {
    name: "profile_and_consents", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const user = await db.user.findUnique({ where: { id: userId }, select: {
        email: true, emailVerified: true, role: true, acceptsPreInquiries: true, createdAt: true, updatedAt: true,
        profile: { select: { firstName: true, lastName: true, phone: true } },
        frameworkAcceptances: { orderBy: { acceptedAt: "asc" }, select: {
          frameworkKey: true, frameworkVersion: true, acceptanceType: true, acceptanceSource: true,
          roleAtAcceptance: true, locale: true, acceptedAt: true
        } }
      } });
      return [{ name: "profile.json", content: json(profileProjection(user || { frameworkAcceptances: [] })), count: user ? 1 : 0 }];
    }
  },
  {
    name: "service_provider_profile", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const row = await db.serviceProviderProfile.findFirst({
        where: { ownerId: userId, ownershipMode: "SOLO" },
        include: {
          serviceItems: {
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            include: {
              locationLinks: { select: { providerLocationId: true } },
              licenceAssessment: { select: { publicStatus: true, coverage: true, publicStatusValidUntil: true } }
            }
          },
          serviceLocations: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }
        }
      });
      return [{
        name: "service-provider-profile.json",
        content: json(row ? serviceProviderProfileExportProjection(row) : null),
        count: row ? 1 : 0
      }];
    }
  },
  {
    name: "conversations", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.conversation.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, include: {
        messages: { orderBy: { createdAt: "asc" }, select: { authorId: true, role: true, content: true, createdAt: true } }
      } });
      return [{ name: "conversations.ndjson", content: Buffer.from(rows.map(row => JSON.stringify(conversationProjection(row, userId))).join("\n") + (rows.length ? "\n" : "")), count: rows.length }];
    }
  },
  {
    name: "journeys", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.journey.findMany({ where: { ownerUserId: userId }, orderBy: { createdAt: "asc" } });
      return [{ name: "journeys.ndjson", content: Buffer.from(rows.map(row => JSON.stringify(journeyProjection(row))).join("\n") + (rows.length ? "\n" : "")), count: rows.length }];
    }
  },
  {
    name: "wellbeing_records", version: "1.1", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.wellbeingRecord.findMany({
        where: { ownerUserId: userId },
        orderBy: { createdAt: "asc" },
        /* Ainult ahela teise otsa ID — parandava kirje SISU on tal endal oma
           rida ja teda ei dubleerita. */
        include: { supersededBy: { select: { id: true } } }
      });
      return [{ name: "wellbeing-records.ndjson", content: Buffer.from(rows.map(row => JSON.stringify(wellbeingProjection(row))).join("\n") + (rows.length ? "\n" : "")), count: rows.length }];
    }
  },
  {
    name: "wellbeing_output_drafts", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.wellbeingOutputDraft.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });
      return [{ name: "wellbeing-output-drafts.ndjson", content: Buffer.from(rows.map(row => JSON.stringify(wellbeingDraftProjection(row))).join("\n") + (rows.length ? "\n" : "")), count: rows.length }];
    }
  },
  {
    name: "practice_reflections", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.practiceReflection.findMany({
        where: { ownerUserId: userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          schemaVersion: true,
          sourceKind: true,
          sourceId: true,
          approach: true,
          method: true,
          action: true,
          supportTechnique: true,
          choiceReason: true,
          methodCatalogRef: true,
          clientGoal: true,
          clientReaction: true,
          workerObservation: true,
          interpretation: true,
          whatWorked: true,
          whatDidNot: true,
          nextStep: true,
          supportNeed: true,
          interimOutcome: true,
          retentionState: true,
          retentionDeadline: true,
          deletedAt: true,
          undoUntil: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return [{
        name: "practice-reflections.ndjson",
        content: ndjson(rows.map(practiceReflectionProjection)),
        count: rows.length
      }];
    }
  },
  {
    name: "pre_inquiries_sender_view", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.preInquiry.findMany({ where: { authorId: userId }, orderBy: { createdAt: "asc" } });
      return [{ name: "pre-inquiries.ndjson", content: Buffer.from(rows.map(row => JSON.stringify(preInquiryProjection(row))).join("\n") + (rows.length ? "\n" : "")), count: rows.length }];
    }
  },
  {
    name: "sharing_history", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await collectOwnerSharingHistory(userId, { db });
      return [{ name: "sharing-history.ndjson", content: ndjson(rows), count: rows.length }];
    }
  },
  {
    name: "documents_and_artifacts", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId, readDocument = readStoredDocument }) {
      const [documents, artifacts] = await Promise.all([
        db.userDocument.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, select: {
          id: true, title: true, originalName: true, kind: true, mime: true, size: true, sha256: true, storagePath: true, createdAt: true, updatedAt: true
        } }),
        db.agentArtifact.findMany({ where: { ownerId: userId }, orderBy: { createdAt: "asc" }, select: {
          title: true, type: true, status: true, content: true, approvedAt: true, createdAt: true, updatedAt: true
        } })
      ]);
      const fileEntries = [];
      for (const document of documents) {
        try {
          const content = await readDocument(document.storagePath);
          const safeName = String(document.originalName || document.id).replace(/[^A-Za-z0-9._ -]/g, "_");
          fileEntries.push({ name: `files/${document.id}-${safeName}`, content });
        } catch (error) {
          /* SOL-DOC-J-05: ükski failiviga ei tohi muutuda märgistamata READY
             koopiaks. Katkestame kogu töö stabiilse ID+põhjuse koodiga; storage
             path ega toore erindi tekst ei lähe manifesti ega kasutajale. */
          throw documentFileFailure(document.id, error);
        }
      }
      const metadata = {
        documents: documents.map(({ id: _id, storagePath: _storagePath, ...document }) => ({ ...document, createdAt: iso(document.createdAt), updatedAt: iso(document.updatedAt) })),
        artifacts: artifacts.map(item => ({ ...item, approvedAt: iso(item.approvedAt), createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt) }))
      };
      return [{ name: "documents.json", content: json(metadata), count: documents.length + artifacts.length }, ...fileEntries.map(entry => ({ ...entry, count: 1 }))];
    }
  },
  {
    name: "saved_analyses", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
      const rows = await db.savedAnalysis.findMany({
        where: { ownerId: userId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          title: true,
          content: true,
          sourceDocumentIds: true,
          metadata: true,
          createdAt: true,
          updatedAt: true
        }
      });
      return [{
        name: "saved-analyses.ndjson",
        content: Buffer.from(rows.map(row => JSON.stringify(savedAnalysisProjection(row))).join("\n") + (rows.length ? "\n" : "")),
        count: rows.length
      }];
    }
  }
]);
