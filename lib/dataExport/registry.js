import { readStoredDocument } from "@/lib/documents/server";

const iso = value => value?.toISOString?.() || value || null;
const json = value => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");

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

// Every V1 surface owns its filter and projection. Missing entries are omitted;
// there is deliberately no fallback raw-database exporter.
export const DATA_EXPORT_REGISTRY = Object.freeze([
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
    name: "documents_and_artifacts", version: "1.0", thirdPartyExcluded: true,
    async collect({ db, userId }) {
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
          const content = await readStoredDocument(document.storagePath);
          const safeName = String(document.originalName || document.id).replace(/[^A-Za-z0-9._ -]/g, "_");
          fileEntries.push({ name: `files/${document.id}-${safeName}`, content });
        } catch {
          // A missing original is not replaced with a raw storage reference.
        }
      }
      const metadata = {
        documents: documents.map(({ id: _id, storagePath: _storagePath, ...document }) => ({ ...document, createdAt: iso(document.createdAt), updatedAt: iso(document.updatedAt) })),
        artifacts: artifacts.map(item => ({ ...item, approvedAt: iso(item.approvedAt), createdAt: iso(item.createdAt), updatedAt: iso(item.updatedAt) }))
      };
      return [{ name: "documents.json", content: json(metadata), count: documents.length + artifacts.length }, ...fileEntries.map(entry => ({ ...entry, count: 1 }))];
    }
  }
]);
