const ordered = (select) => ({
  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  select
});

const CASEWORK_EXPORT_SELECT = Object.freeze({
  id: true,
  clientDisplayName: true,
  clientExternalRef: true,
  clientErasedAt: true,
  externalSystem: true,
  externalReference: true,
  nextContactAt: true,
  retentionState: true,
  createdAt: true,
  updatedAt: true,
  items: ordered({
    id: true,
    userDocumentId: true,
    agentArtifactId: true,
    fieldVisitId: true,
    createdAt: true
  }),
  missingInfo: ordered({
    id: true,
    text: true,
    provenance: true,
    status: true,
    resolvedAt: true,
    createdAt: true,
    updatedAt: true
  }),
  meetingPreps: ordered({
    id: true,
    meetingAt: true,
    contentPurgedAt: true,
    contentPurgeReason: true,
    createdAt: true,
    updatedAt: true,
    fields: ordered({
      id: true,
      fieldKey: true,
      text: true,
      provenance: true,
      createdAt: true,
      updatedAt: true
    }),
    questions: ordered({
      id: true,
      kind: true,
      text: true,
      provenance: true,
      ordinal: true,
      createdAt: true,
      updatedAt: true
    })
  }),
  meetingNotes: ordered({
    id: true,
    meetingPrepId: true,
    meetingAt: true,
    createdAt: true,
    updatedAt: true,
    entries: ordered({
      id: true,
      layer: true,
      text: true,
      provenance: true,
      ordinal: true,
      revision: true,
      retractedAt: true,
      createdAt: true,
      updatedAt: true,
      revisions: ordered({
        id: true,
        kind: true,
        layer: true,
        text: true,
        provenance: true,
        ordinal: true,
        revision: true,
        reason: true,
        createdAt: true
      })
    })
  }),
  drafts: ordered({
    id: true,
    draftType: true,
    transferState: true,
    reviewKind: true,
    transferredAt: true,
    contentPurgedAt: true,
    contentPurgeReason: true,
    createdAt: true,
    updatedAt: true,
    fields: ordered({
      id: true,
      fieldKey: true,
      text: true,
      provenance: true,
      createdAt: true,
      updatedAt: true
    })
  }),
  transferEvents: ordered({
    id: true,
    draftId: true,
    kind: true,
    draftType: true,
    transferStateAtEvent: true,
    fieldKeys: true,
    contentHash: true,
    createdAt: true
  }),
  retentionAudit: ordered({
    id: true,
    fromState: true,
    toState: true,
    reason: true,
    createdAt: true
  }),
  erasureAudit: ordered({
    id: true,
    actorKind: true,
    reason: true,
    createdAt: true
  })
});

function portable(value) {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, portable(child)]));
  }
  return value ?? null;
}

function selectedValue(value, selection) {
  if (selection === true) return portable(value);
  if (!selection?.select) return undefined;
  if (Array.isArray(value)) return value.map((item) => projectSelected(item, selection.select));
  return value ? projectSelected(value, selection.select) : null;
}

function projectSelected(row, selection) {
  return Object.fromEntries(
    Object.entries(selection).map(([key, rule]) => [key, selectedValue(row?.[key], rule)])
  );
}

function projectCasework(row) {
  return {
    schemaVersion: 1,
    contentPolicy: "owner_private_working_material_may_describe_clients",
    ...projectSelected(row, CASEWORK_EXPORT_SELECT)
  };
}

/**
 * SOL-CW-19: CaseWorkAssist on kanoonilise JTA lepingu järgi töötaja rangelt
 * isiklik töömaterjal. Koopia on seetõttu omaniku FK-ga piiratud ja valib
 * väljad nimeliselt. Kliendi konto-, lähtepöördumise ja tegija-ID-sid ei valita;
 * teise kasutaja `clientUserId` seos ei tee tema juhtumit küsija omaks.
 */
export async function collectCaseWorkDataExport({ db, userId }) {
  const ownerUserId = String(userId || "").trim();
  if (!ownerUserId) return [];

  const rows = await db.caseWorkAssist.findMany({
    where: { ownerUserId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: CASEWORK_EXPORT_SELECT
  });
  return rows.map(projectCasework);
}
