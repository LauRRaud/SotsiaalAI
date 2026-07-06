import prisma from "@/lib/prisma";
import {
  buildSectionAttributionSummary,
  buildSourcePackageGapItem
} from "@/lib/admin/rag/sourcePackages/gapReport";

const SOURCE_PACKAGE_ACTIONS = new Set(["mark_reviewed", "archive", "restore_active", "recompute", "accept_gap"]);

const CURRENT_EVIDENCE_SECTIONS = new Set(["forms", "contacts", "legal_basis", "fees", "deadlines"]);
const ACTIONABLE_REVIEW_SEVERITIES = new Set(["blocker", "review"]);
const ACCEPTABLE_REVIEW_REASONS = new Set([
  "missing_forms",
  "missing_contacts",
  "missing_legal_basis",
  "missing_fees",
  "missing_deadlines"
]);

const REVIEW_REASON_CATALOG = {
  missing_source_keys: {
    severity: "blocker",
    label: "Allikal puudub sourceKey/source_id."
  },
  missing_forms: {
    severity: "review",
    label: "Taotlusvormi allikas puudub."
  },
  missing_contacts: {
    severity: "review",
    label: "Kontaktiallikas puudub."
  },
  missing_legal_basis: {
    severity: "review",
    label: "RT/oigusliku aluse allikas on olemas, aga paketi legal_basis seos puudub."
  },
  missing_fees: {
    severity: "info",
    label: "Tasude info puudub voi KOV veebis ei avalda seda."
  },
  missing_deadlines: {
    severity: "info",
    label: "Tahtaja info puudub voi KOV veebis ei avalda seda."
  },
  package_conflict: {
    severity: "blocker",
    label: "Paketi allikates on vale voi vastuoluline municipality_id."
  },
  invalid_current_evidence: {
    severity: "blocker",
    label: "Current evidence rollis on ajalooline voi mittesobiv allikas."
  },
  legal_basis_without_rt_layer: {
    severity: "blocker",
    label: "legal_basis on present, aga seos ei tule RT/legal allikast."
  },
  wrong_collection_id: {
    severity: "blocker",
    label: "Allika collection_id ei sobi source_type rolliga."
  }
};

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function boolParam(value) {
  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;
  return null;
}

function intParam(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function missingSections(row = {}) {
  return arrayValue(row.missingSections).map(clean).filter(Boolean);
}

function sourceMembership(row = {}) {
  return arrayValue(row.sourceMembership).map(source => ({
    source_id: clean(source?.source_id),
    source_type: clean(source?.source_type),
    collection_id: clean(source?.collection_id),
    item_type: clean(source?.item_type),
    resource_type: clean(source?.resource_type),
    municipality_id: clean(source?.municipality_id),
    source_status: clean(source?.source_status),
    historical: source?.historical === true,
    sections: arrayValue(source?.sections).map(clean).filter(Boolean),
    evidence_allowed: source?.evidence_allowed !== false,
    evidence_strength: clean(source?.evidence_strength)
  })).filter(source => source.source_id);
}

function rawSourceMembership(row = {}) {
  return arrayValue(row.sourceMembership);
}

function sectionSummary(row = {}) {
  const summary = row.sectionSummary && typeof row.sectionSummary === "object" ? row.sectionSummary : {};
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [
    key,
    {
      count: Number(value?.count || 0),
      source_ids: arrayValue(value?.source_ids).map(clean).filter(Boolean)
    }
  ]));
}

function sourceIdsForSection(row = {}, section) {
  return arrayValue(sectionSummary(row)?.[section]?.source_ids).map(clean).filter(Boolean);
}

function hasMissingSourceKeys(row = {}) {
  return rawSourceMembership(row).some(source => {
    if (!source || typeof source !== "object") return true;
    return !clean(source.source_id || source.sourceId || source.id || source.sourceKey || source.source_key);
  });
}

function isLegalSource(source = {}) {
  return ["kov_regulation", "municipal_regulation", "national_law", "law", "regulation"].includes(clean(source.source_type) || "");
}

function hasRtLegalLayer(row = {}) {
  return sourceMembership(row).some(source => isLegalSource(source) || source.collection_id === "kov_regulations");
}

function legalBasisWithoutRtLayer(row = {}) {
  const legalSourceIds = sourceIdsForSection(row, "legal_basis");
  if (!legalSourceIds.length) return false;
  const membership = sourceMembership(row);
  return legalSourceIds.some(sourceId => {
    const source = membership.find(item => item.source_id === sourceId);
    return !source || (!isLegalSource(source) && source.collection_id !== "kov_regulations");
  });
}

function wrongCollectionId(row = {}) {
  return sourceMembership(row).some(source => {
    if (source.source_type === "kov_regulation") {
      return source.collection_id && !["kov_regulations", "kov_legal"].includes(source.collection_id);
    }
    if (source.source_type === "journal_article") return source.collection_id && source.collection_id !== "sotsiaaltoo_articles";
    if (["kov_service_info", "application_form", "official_contact", "municipality_kov"].includes(source.source_type)) {
      return source.collection_id && !["kov_services", "municipality_services"].includes(source.collection_id);
    }
    return false;
  });
}

function computePackageConflict(row = {}, siblingRows = []) {
  const canonicalItemId = clean(row.canonicalItemId || row.canonical_item_id);
  const municipalityId = clean(row.municipalityId || row.municipality_id);
  if (!canonicalItemId) return false;
  const municipalities = new Set([municipalityId, ...siblingRows.map(item => clean(item?.municipalityId || item?.municipality_id))].filter(Boolean));
  return municipalities.size > 1;
}

export function computeSourcePackageReviewFlags(row = {}, options = {}) {
  const missing = new Set(missingSections(row));
  const membership = sourceMembership(row);
  const municipalities = new Set(membership.map(source => source.municipality_id).filter(Boolean));
  const invalidCurrentEvidence = membership.some(source => {
    const currentEvidence = source.sections.some(section => CURRENT_EVIDENCE_SECTIONS.has(section));
    const sourceStatus = String(source.source_status || "").toLowerCase();
    return currentEvidence && (
      source.evidence_allowed === false ||
      source.historical === true ||
      (sourceStatus && sourceStatus !== "active")
    );
  });
  const packageConflict = options.packageConflict ?? municipalities.size > 1;
  return {
    missing_source_keys: hasMissingSourceKeys(row),
    missing_forms: missing.has("forms"),
    missing_contacts: missing.has("contacts"),
    missing_legal_basis: missing.has("legal_basis") && hasRtLegalLayer(row),
    missing_fees: missing.has("fees"),
    missing_deadlines: missing.has("deadlines"),
    package_conflict: packageConflict,
    invalid_current_evidence: invalidCurrentEvidence,
    legal_basis_without_rt_layer: legalBasisWithoutRtLayer(row),
    wrong_collection_id: wrongCollectionId(row)
  };
}

function slugFromMunicipalityId(value) {
  return String(value || "").trim().replaceAll("_", "-");
}

function sourceKeysForRow(row = {}) {
  return sourceMembership(row).map(source => source.source_id).filter(Boolean).sort();
}

function repairHintForReason(row = {}, code) {
  const canonicalItemId = clean(row.canonicalItemId || row.canonical_item_id);
  const municipalityId = clean(row.municipalityId || row.municipality_id);
  const slug = slugFromMunicipalityId(municipalityId);
  const file = slug ? `${slug}.json` : "<slug>.json";
  const base = {
    actionLabel: "Ava KOV detail",
    municipalityId,
    slug,
    canonicalItemId,
    sourceKeys: sourceKeysForRow(row),
    kovHref: slug ? `/admin/rag/kov?slug=${encodeURIComponent(slug)}` : "/admin/rag/kov"
  };

  if (code === "missing_forms") return { ...base, field: "relatedForms", fileHint: `${file} -> items[] -> id = ${canonicalItemId || "..."} -> relatedForms` };
  if (code === "missing_contacts") return { ...base, field: "relatedContacts", fileHint: `${file} -> items[] -> id = ${canonicalItemId || "..."} -> relatedContacts` };
  if (code === "missing_legal_basis") return { ...base, field: "legalBasis", fileHint: `${file} / RT XML -> legal_basis mapping for item id = ${canonicalItemId || "..."}` };
  if (code === "missing_fees") return { ...base, field: "fees", fileHint: `${file} -> items[] -> id = ${canonicalItemId || "..."} -> fees` };
  if (code === "missing_deadlines") return { ...base, field: "deadlines", fileHint: `${file} -> items[] -> id = ${canonicalItemId || "..."} -> deadlines` };
  return { ...base, field: "sourceMembership", fileHint: `${file} -> items[] / sources[] metadata for id = ${canonicalItemId || "..."}` };
}

function normalizeAcceptedReasons(values = []) {
  return new Set(arrayValue(values).map(clean).filter(Boolean));
}

export function buildSourcePackageReviewReasons(flags = {}, options = {}) {
  const accepted = normalizeAcceptedReasons(options.acceptedReasonCodes);
  const row = options.row || {};
  return Object.entries(flags)
    .filter(([, value]) => value === true)
    .map(([code]) => ({
      code,
      severity: REVIEW_REASON_CATALOG[code]?.severity || "info",
      label: REVIEW_REASON_CATALOG[code]?.label || code.replaceAll("_", " "),
      accepted: accepted.has(code),
      acceptable: ACCEPTABLE_REVIEW_REASONS.has(code),
      repair: repairHintForReason(row, code)
    }));
}

function actionableReviewReasons(reasons = []) {
  return arrayValue(reasons).filter(reason => !reason.accepted && ACTIONABLE_REVIEW_SEVERITIES.has(reason.severity));
}

function infoReviewReasons(reasons = []) {
  return arrayValue(reasons).filter(reason => !reason.accepted && reason.severity === "info");
}

function queueSeverityForReasons(reasons = []) {
  const actionable = actionableReviewReasons(reasons);
  if (actionable.some(reason => reason.severity === "blocker")) return "blocker";
  if (actionable.some(reason => reason.severity === "review")) return "review";
  if (infoReviewReasons(reasons).length) return "info";
  return "none";
}

function acceptedReasonsFromEvents(events = []) {
  return arrayValue(events)
    .filter(event => event?.action === "accept_gap")
    .map(event => clean(event?.metadata?.accepted_reason_code || event?.metadata?.reason_code))
    .filter(Boolean);
}

function computeSnapshotStatus(row = {}, options = {}) {
  const flags = computeSourcePackageReviewFlags(row, options);
  const reasons = buildSourcePackageReviewReasons(flags, {
    row,
    acceptedReasonCodes: options.acceptedReasonCodes || []
  });
  return actionableReviewReasons(reasons).length ? "needs_review" : "active";
}

function serializeReviewEvent(row = {}) {
  return {
    id: row.id,
    action: row.action,
    actor: row.actor,
    note: row.note,
    fromStatus: row.fromStatus,
    toStatus: row.toStatus,
    fromReviewStatus: row.fromReviewStatus,
    toReviewStatus: row.toReviewStatus,
    fromActive: row.fromActive,
    toActive: row.toActive,
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : null,
    createdAt: row.createdAt
  };
}

function serializeHistory(rows = []) {
  return arrayValue(rows).map(serializeReviewEvent);
}

export function serializeSourcePackageSnapshot(row = {}, { detail = false, history = [], packageConflict = undefined } = {}) {
  const rowEvents = Array.isArray(row.reviewEvents) ? row.reviewEvents : [];
  const acceptedReasonCodes = acceptedReasonsFromEvents([...rowEvents, ...history]);
  const flags = computeSourcePackageReviewFlags(row, { packageConflict });
  const reasons = buildSourcePackageReviewReasons(flags, { row, acceptedReasonCodes });
  const actionableReasons = actionableReviewReasons(reasons);
  const infoReasons = infoReviewReasons(reasons);
  const reviewQueueSeverity = queueSeverityForReasons(reasons);
  const base = {
    id: row.id,
    packageId: row.packageId,
    canonicalItemId: row.canonicalItemId,
    municipalityId: row.municipalityId,
    packageType: row.packageType,
    title: row.title,
    status: row.status,
    reviewStatus: row.reviewStatus || "pending",
    confidence: row.confidence,
    missingSections: missingSections(row),
    version: row.version,
    active: row.active === true,
    lastBuiltAt: row.lastBuiltAt,
    lastChecked: row.lastChecked,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reviewedAt: row.reviewedAt,
    reviewedBy: row.reviewedBy,
    reviewNote: row.reviewNote,
    reviewFlags: flags,
    reviewReasons: reasons,
    actionableReviewReasons: actionableReasons,
    infoReviewReasons: infoReasons,
    acceptedReviewReasonCodes: [...new Set(acceptedReasonCodes)].sort(),
    reviewQueueSeverity,
    hasActionableReview: row.active === true && ACTIONABLE_REVIEW_SEVERITIES.has(reviewQueueSeverity),
    hasInfoWarnings: row.active === true && infoReasons.length > 0,
    packageAttributionChecked: true,
    highRiskAttributionChecked: false,
    attributionFlags: actionableReasons.map(reason => reason.code),
    sectionAttributionSummary: buildSectionAttributionSummary(row),
    gapSummary: buildSourcePackageGapItem(row).gaps
  };

  if (!detail) {
    return {
      ...base,
      sectionSummary: sectionSummary(row),
      sourceMembership: sourceMembership(row).map(source => ({
        source_id: source.source_id,
        source_type: source.source_type,
        resource_type: source.resource_type,
        sections: source.sections,
        evidence_allowed: source.evidence_allowed,
        evidence_strength: source.evidence_strength
      }))
    };
  }

  return {
    ...base,
    sectionSummary: sectionSummary(row),
    sourceMembership: sourceMembership(row),
    history: serializeHistory(history)
  };
}

export function buildSourcePackageWhere(params = {}) {
  const where = {};
  const status = clean(params.status);
  if (status) where.status = status;
  const reviewStatus = clean(params.reviewStatus);
  if (reviewStatus) where.reviewStatus = reviewStatus;
  const municipalityId = clean(params.municipalityId);
  if (municipalityId) where.municipalityId = municipalityId;
  const packageType = clean(params.packageType);
  if (packageType) where.packageType = packageType;
  const active = boolParam(params.active);
  if (active !== null) where.active = active;
  const needsReview = boolParam(params.needsReview);
  if (needsReview === true) where.status = "needs_review";
  if (needsReview === false && !where.status) where.status = { not: "needs_review" };
  return where;
}

function clientOrTransaction(client = prisma) {
  return client || prisma;
}

async function inTransaction(client, work) {
  const db = clientOrTransaction(client);
  if (typeof db.$transaction === "function") {
    return db.$transaction(work);
  }
  return work(db);
}

async function findSnapshotOrThrow(id, client) {
  const row = await client.sourcePackageSnapshot.findUnique({ where: { id } });
  if (row) return row;
  const error = new Error("Source package snapshot not found");
  error.code = "P2025";
  throw error;
}

async function listSiblingSnapshots(row, client) {
  const canonicalItemId = clean(row?.canonicalItemId);
  if (!canonicalItemId) return [];
  return client.sourcePackageSnapshot.findMany({
    where: {
      canonicalItemId,
      id: { not: row.id }
    },
    select: {
      id: true,
      municipalityId: true
    }
  });
}

async function createReviewEvent(client, snapshot, action, actor, note, nextState, metadata = null) {
  const delegate = client.sourcePackageSnapshotReviewEvent;
  if (!delegate) return null;
  return delegate.create({
    data: {
      snapshotId: snapshot.id,
      packageId: snapshot.packageId,
      action,
      actor,
      note,
      fromStatus: snapshot.status,
      toStatus: nextState.status,
      fromReviewStatus: snapshot.reviewStatus || "pending",
      toReviewStatus: nextState.reviewStatus || "pending",
      fromActive: snapshot.active === true,
      toActive: nextState.active === true,
      metadata
    }
  });
}

async function listAcceptedReasonCodes(snapshotId, client) {
  const delegate = client.sourcePackageSnapshotReviewEvent;
  if (!delegate) return [];
  const events = await delegate.findMany({
    where: {
      snapshotId,
      action: "accept_gap"
    },
    take: 50
  });
  return acceptedReasonsFromEvents(events);
}

export async function listSourcePackageSnapshots(params = {}, client = prisma) {
  const db = clientOrTransaction(client);
  const delegate = db.sourcePackageSnapshot;
  const limit = intParam(params.limit, 50, 1, 200);
  const offset = intParam(params.offset, 0, 0, 100000);
  const where = buildSourcePackageWhere(params);
  const [total, rows] = await Promise.all([
    delegate.count({ where }),
    delegate.findMany({
      where,
      orderBy: [
        { active: "desc" },
        { status: "asc" },
        { lastBuiltAt: "desc" }
      ],
      skip: offset,
      take: limit,
      include: {
        reviewEvents: {
          where: { action: "accept_gap" },
          orderBy: { createdAt: "desc" },
          take: 50
        }
      }
    })
  ]);
  return {
    total,
    limit,
    offset,
    items: rows.map(row => serializeSourcePackageSnapshot(row))
  };
}

export async function getSourcePackageSnapshot(id, client = prisma) {
  const db = clientOrTransaction(client);
  const row = await db.sourcePackageSnapshot.findUnique({ where: { id } });
  if (!row) return null;

  let history = [];
  if (db.sourcePackageSnapshotReviewEvent) {
    try {
      history = await db.sourcePackageSnapshotReviewEvent.findMany({
        where: { snapshotId: id },
        orderBy: { createdAt: "desc" },
        take: 20
      });
    } catch {
      history = [];
    }
  }

  const siblings = await listSiblingSnapshots(row, db);
  const packageConflict = computePackageConflict(row, siblings);
  return serializeSourcePackageSnapshot(row, { detail: true, history, packageConflict });
}

export function resolveAdminIdentity(session = null) {
  return clean(session?.user?.email) || clean(session?.user?.id) || "admin";
}

function reviewMetadataForState(reviewStatus, now, reviewedBy, reviewNote) {
  if (reviewStatus === "reviewed" || reviewStatus === "archived") {
    return {
      reviewedAt: now,
      reviewedBy,
      reviewNote
    };
  }
  return {
    reviewedAt: null,
    reviewedBy: null,
    reviewNote: null
  };
}

function preserveExistingReviewMetadata(snapshot = {}, reviewStatus, now, reviewedBy, reviewNote) {
  if (reviewStatus === "pending") {
    return reviewMetadataForState(reviewStatus, now, reviewedBy, reviewNote);
  }
  return {
    reviewedAt: snapshot.reviewedAt ?? now,
    reviewedBy: snapshot.reviewedBy ?? reviewedBy,
    reviewNote: snapshot.reviewNote ?? reviewNote
  };
}

export async function reviewSourcePackageSnapshot(id, action, options = {}, client = prisma) {
  if (!SOURCE_PACKAGE_ACTIONS.has(action)) {
    const error = new Error("Unsupported source package review action");
    error.code = "UNSUPPORTED_ACTION";
    throw error;
  }

  return inTransaction(client, async (tx) => {
    const reviewedBy = clean(options.reviewedBy) || "admin";
    const reviewNote = clean(options.reviewNote);
    const now = new Date();
    const snapshot = await findSnapshotOrThrow(id, tx);
    const siblings = await listSiblingSnapshots(snapshot, tx);
    const packageConflict = computePackageConflict(snapshot, siblings);
    const acceptedReasonCodes = await listAcceptedReasonCodes(id, tx);
    const recomputedStatus = computeSnapshotStatus(snapshot, { packageConflict, acceptedReasonCodes });

    if (action === "mark_reviewed") {
      const nextReviewStatus = "reviewed";
      const row = await tx.sourcePackageSnapshot.update({
        where: { id },
        data: {
          reviewStatus: nextReviewStatus,
          ...reviewMetadataForState(nextReviewStatus, now, reviewedBy, reviewNote)
        }
      });
      await createReviewEvent(tx, snapshot, action, reviewedBy, reviewNote, row, {
        reason_codes: buildSourcePackageReviewReasons(computeSourcePackageReviewFlags(snapshot, { packageConflict })).map(reason => reason.code)
      });
      return serializeSourcePackageSnapshot(row, { detail: true, packageConflict });
    }

    if (action === "archive") {
      const nextReviewStatus = "archived";
      const row = await tx.sourcePackageSnapshot.update({
        where: { id },
        data: {
          reviewStatus: nextReviewStatus,
          status: "archived",
          active: false,
          ...reviewMetadataForState(nextReviewStatus, now, reviewedBy, reviewNote)
        }
      });
      await createReviewEvent(tx, snapshot, action, reviewedBy, reviewNote, row);
      return serializeSourcePackageSnapshot(row, { detail: true, packageConflict });
    }

    if (action === "restore_active") {
      const displaced = await tx.sourcePackageSnapshot.findMany({
        where: {
          packageId: snapshot.packageId,
          active: true,
          id: { not: id }
        },
        select: { id: true }
      });

      if (displaced.length) {
        await tx.sourcePackageSnapshot.updateMany({
          where: {
            packageId: snapshot.packageId,
            active: true,
            id: { not: id }
          },
          data: {
            active: false,
            status: "archived"
          }
        });
      }

      const nextReviewStatus = recomputedStatus === "needs_review"
        ? (snapshot.reviewStatus === "reviewed" ? "reviewed" : "pending")
        : "reviewed";
      const row = await tx.sourcePackageSnapshot.update({
        where: { id },
        data: {
          active: true,
          status: recomputedStatus,
          reviewStatus: nextReviewStatus,
          ...preserveExistingReviewMetadata(snapshot, nextReviewStatus, now, reviewedBy, reviewNote)
        }
      });
      await createReviewEvent(tx, snapshot, action, reviewedBy, reviewNote, row, {
        displaced_snapshot_ids: displaced.map(item => item.id),
        reason_codes: buildSourcePackageReviewReasons(computeSourcePackageReviewFlags(snapshot, { packageConflict })).map(reason => reason.code)
      });
      return serializeSourcePackageSnapshot(row, { detail: true, packageConflict });
    }

    if (action === "accept_gap") {
      const acceptedReasonCode = clean(options.acceptedReasonCode);
      if (!acceptedReasonCode || !ACCEPTABLE_REVIEW_REASONS.has(acceptedReasonCode)) {
        const error = new Error("Unsupported source package accept reason");
        error.code = "UNSUPPORTED_ACCEPT_REASON";
        throw error;
      }

      const nextAcceptedReasonCodes = [...new Set([...acceptedReasonCodes, acceptedReasonCode])].sort();
      const nextStatus = computeSnapshotStatus(snapshot, {
        packageConflict,
        acceptedReasonCodes: nextAcceptedReasonCodes
      });
      const nextReviewStatus = nextStatus === "needs_review" ? "pending" : "reviewed";
      const row = await tx.sourcePackageSnapshot.update({
        where: { id },
        data: {
          status: snapshot.active === true ? nextStatus : snapshot.status,
          reviewStatus: nextReviewStatus,
          ...preserveExistingReviewMetadata(snapshot, nextReviewStatus, now, reviewedBy, reviewNote)
        }
      });
      await createReviewEvent(tx, snapshot, action, reviewedBy, reviewNote, row, {
        accepted_reason_code: acceptedReasonCode,
        accepted_disposition: clean(options.acceptedDisposition) || "accepted",
        accepted_reason_codes: nextAcceptedReasonCodes
      });
      const history = tx.sourcePackageSnapshotReviewEvent
        ? await tx.sourcePackageSnapshotReviewEvent.findMany({
            where: { snapshotId: id },
            orderBy: { createdAt: "desc" },
            take: 20
          }).catch(() => [])
        : [];
      return serializeSourcePackageSnapshot(row, { detail: true, packageConflict, history });
    }

    const nextReviewStatus = recomputedStatus === "needs_review"
      ? "pending"
      : snapshot.reviewStatus === "archived"
        ? "archived"
        : "reviewed";
    const row = await tx.sourcePackageSnapshot.update({
      where: { id },
      data: {
        status: snapshot.active === true ? recomputedStatus : snapshot.status,
        reviewStatus: nextReviewStatus,
        ...preserveExistingReviewMetadata(snapshot, nextReviewStatus, now, reviewedBy, reviewNote)
      }
    });
    await createReviewEvent(tx, snapshot, action, reviewedBy, reviewNote, row, {
      recomputed_status: recomputedStatus,
      reason_codes: buildSourcePackageReviewReasons(computeSourcePackageReviewFlags(snapshot, { packageConflict })).map(reason => reason.code)
    });
    return serializeSourcePackageSnapshot(row, { detail: true, packageConflict });
  });
}
