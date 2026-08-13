import { readStoredDocument } from "@/lib/documents/server";
import { readStoredMaterial } from "@/lib/materials/server";
import { collectOwnerSharingHistory } from "@/lib/mySharings";
import { collectServiceLogDataExport } from "@/lib/serviceLog/privacyLifecycle";
import { collectOrganizationMembershipDataExport } from "@/lib/org/dataExport";

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
    retentionUntil: iso(row.retentionUntil),
    ragRelation: row.ragSourceId ? { sourceId: row.ragSourceId } : null,
    ragRelationStatus: row.status === "imported" && !row.ragSourceId ? "not_recorded" : "not_applicable",
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
        try {
          const content = await readMaterial(row.storagePath);
          fileEntries.push({ name: archivePath, content, count: 0 });
          file = { status: "included", archivePath };
        } catch (error) {
          file = { status: "unavailable", reason: materialFileReason(error), archivePath: null };
        }
        fileManifest.push({
          submissionId: row.id,
          status: file.status,
          reason: file.reason || null,
          archivePath: file.archivePath,
          sha256: row.sha256,
          importedRelation: row.ragSourceId || null,
          retentionUntil: iso(row.retentionUntil)
        });
        metadata.push(materialProjection(row, file));
      }
      return [{
        name: "materials.json",
        content: json(metadata),
        count: rows.length,
        manifest: { originalFiles: fileManifest }
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
