import crypto from "node:crypto";

import prisma from "../prisma.js";

const IMPORTANT_SECTIONS_BY_PACKAGE_TYPE = {
  kov_service: ["forms", "contacts", "legal_basis"],
  kov_benefit: ["forms", "contacts", "legal_basis"],
  kov_form: ["forms"],
  kov_contact: ["contacts"]
};

const CURRENT_EVIDENCE_SECTIONS = new Set(["forms", "contacts", "legal_basis"]);
const DISALLOWED_CURRENT_SOURCE_TYPES = new Set(["journal_article", "article", "historical_source", "personal_story", "opinion"]);

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort().map((key) => [key, stableJson(value[key])])
    );
  }
  return value;
}

function hashObject(value) {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(stableJson(value)))
    .digest("hex");
}

function parseDate(value) {
  const text = clean(value);
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function unique(values = []) {
  return [...new Set(values.map(clean).filter(Boolean))].sort();
}

export function normalizeSourcePackageSnapshotCanonicalId(value) {
  let text = clean(value);
  if (!text) return null;
  const genericDuplicate = text.match(/^(.+?_(?:vald|linn))_(service|benefit|resource|contact|form)_\1_\2_(.+)$/);
  if (genericDuplicate) {
    return `${genericDuplicate[1]}_${genericDuplicate[2]}_${genericDuplicate[3]}`;
  }
  return text;
}

function stablePackageIdentityScore(row = {}) {
  const packageId = clean(row.packageId || row.package_id);
  if (/^(.+?_(?:vald|linn))_(service|benefit|resource|contact|form)_\1_\2_.+_package$/.test(packageId || "")) return 50;
  if (/^(.+?_(?:vald|linn))_(service|benefit|resource|contact|form)_.+_package$/.test(packageId || "")) return 100;
  return 0;
}

function compareActiveSnapshotPreference(left = {}, right = {}) {
  const scoreDiff = stablePackageIdentityScore(right) - stablePackageIdentityScore(left);
  if (scoreDiff) return scoreDiff;
  const versionDiff = Number(right.version || 0) - Number(left.version || 0);
  if (versionDiff) return versionDiff;
  return String(right.packageId || "").localeCompare(String(left.packageId || ""));
}

async function archiveDuplicateNormalizedActiveSnapshots(snapshot = {}, delegate = null) {
  if (!delegate?.findMany || !delegate?.update) return null;
  const normalizedCanonicalId = normalizeSourcePackageSnapshotCanonicalId(snapshot.canonicalItemId);
  const municipalityId = clean(snapshot.municipalityId);
  if (!normalizedCanonicalId || !municipalityId) return null;

  const activeRows = await delegate.findMany({
    where: {
      municipalityId,
      active: true
    }
  });
  const duplicates = (Array.isArray(activeRows) ? activeRows : [])
    .filter(row => normalizeSourcePackageSnapshotCanonicalId(row.canonicalItemId) === normalizedCanonicalId);
  if (duplicates.length <= 1) return null;

  const [winner, ...losers] = duplicates.sort(compareActiveSnapshotPreference);
  for (const row of losers) {
    if (!row?.id) continue;
    await delegate.update({
      where: { id: row.id },
      data: {
        active: false,
        status: "archived"
      }
    });
  }
  return {
    normalizedCanonicalId,
    activeCountBefore: duplicates.length,
    archivedCount: losers.length,
    winnerPackageId: winner.packageId
  };
}

function sectionSources(sections = {}, section) {
  const items = Array.isArray(sections?.[section]) ? sections[section] : [];
  return items.filter(item => item && typeof item === "object");
}

function buildSectionSummary(pkg = {}) {
  const sections = pkg.sections && typeof pkg.sections === "object" ? pkg.sections : {};
  return Object.fromEntries(Object.keys(sections).sort().map((section) => {
    const sourceIds = unique(sectionSources(sections, section).map(source => source.source_id));
    return [section, {
      count: sourceIds.length,
      source_ids: sourceIds
    }];
  }));
}

function sourceEvidenceStrength(section, source = {}) {
  if (clean(source.evidence_strength || source.evidenceStrength) === "partial") return "partial";
  if (section === "legal_basis" || section === "forms" || section === "contacts") return "strong";
  if (section === "description" || section === "eligibility" || section === "application") return "medium";
  return "weak";
}

function buildSourceMembership(pkg = {}) {
  const sections = pkg.sections && typeof pkg.sections === "object" ? pkg.sections : {};
  const bySource = new Map();

  for (const section of Object.keys(sections).sort()) {
    for (const source of sectionSources(sections, section)) {
      const sourceId = clean(source.source_id);
      if (!sourceId) continue;
      if (!bySource.has(sourceId)) {
        bySource.set(sourceId, {
          source_id: sourceId,
          source_type: clean(source.source_type),
          collection_id: clean(source.collection_id),
          item_type: clean(source.item_type),
          resource_type: clean(source.resource_type),
          municipality_id: clean(source.municipality_id),
          municipality_name: clean(source.municipality_name),
          source_status: clean(source.source_status),
          last_checked: clean(source.last_checked),
          historical: source.historical === true,
          sections: [],
          evidence_allowed: true,
          evidence_strength: "weak"
        });
      }
      const entry = bySource.get(sourceId);
      if (!entry.sections.includes(section)) entry.sections.push(section);
      const strength = sourceEvidenceStrength(section, source);
      if (strength === "strong" || (strength === "medium" && entry.evidence_strength === "weak")) {
        entry.evidence_strength = strength;
      }
      if (strength === "partial" && entry.evidence_strength === "weak") {
        entry.evidence_strength = strength;
      }
      if (CURRENT_EVIDENCE_SECTIONS.has(section) && DISALLOWED_CURRENT_SOURCE_TYPES.has(entry.source_type)) {
        entry.evidence_allowed = false;
      }
    }
  }

  return Array.from(bySource.values())
    .map(entry => ({
      ...entry,
      sections: entry.sections.sort()
    }))
    .sort((a, b) => String(a.source_id).localeCompare(String(b.source_id)));
}

function hasPackageConflict(pkg = {}, allPackages = []) {
  const canonicalId = clean(pkg.canonical_item_id);
  const municipalities = unique(
    allPackages
      .filter(item => clean(item?.canonical_item_id) === canonicalId)
      .map(item => item?.municipality_id)
  );
  return !!canonicalId && municipalities.length > 1;
}

function statusForSnapshot(pkg = {}, sourceMembership = [], allPackages = []) {
  const packageType = clean(pkg.package_type) || "unknown";
  const importantSections = IMPORTANT_SECTIONS_BY_PACKAGE_TYPE[packageType] || [];
  const missingSections = Array.isArray(pkg.missing_sections) ? pkg.missing_sections.map(clean).filter(Boolean) : [];
  const missingImportant = importantSections.some(section => missingSections.includes(section));
  const conflict = hasPackageConflict(pkg, allPackages);
  const invalidCurrentEvidence = sourceMembership.some((source) => {
    const sourceStatus = clean(source.source_status);
    const currentEvidence = source.sections.some(section => CURRENT_EVIDENCE_SECTIONS.has(section));
    return currentEvidence && (
      source.evidence_allowed === false ||
      source.historical === true ||
      (sourceStatus && sourceStatus !== "active")
    );
  });
  return missingImportant || conflict || invalidCurrentEvidence ? "needs_review" : "active";
}

export function buildSourcePackageSnapshot(pkg = {}, allPackages = [pkg]) {
  const sectionSummary = buildSectionSummary(pkg);
  const sourceMembership = buildSourceMembership(pkg);
  const hashBasis = {
    canonical_item_id: clean(pkg.canonical_item_id),
    municipality_id: clean(pkg.municipality_id),
    package_type: clean(pkg.package_type),
    section_summary: sectionSummary,
    source_membership: sourceMembership.map(source => ({
      source_id: source.source_id,
      source_type: source.source_type,
      sections: source.sections,
      evidence_allowed: source.evidence_allowed,
      evidence_strength: source.evidence_strength
    }))
  };

  return {
    packageId: clean(pkg.package_id),
    canonicalItemId: clean(pkg.canonical_item_id),
    municipalityId: clean(pkg.municipality_id),
    packageType: clean(pkg.package_type) || "unknown",
    title: clean(pkg.title),
    status: statusForSnapshot(pkg, sourceMembership, allPackages),
    confidence: clean(pkg.confidence),
    missingSections: Array.isArray(pkg.missing_sections) ? pkg.missing_sections.map(clean).filter(Boolean).sort() : [],
    packageHash: hashObject(hashBasis),
    lastChecked: parseDate(pkg.last_checked),
    sectionSummary,
    sourceMembership
  };
}

export function buildSourcePackageSnapshots(packages = []) {
  if (!Array.isArray(packages)) return [];
  return packages
    .map(pkg => buildSourcePackageSnapshot(pkg, packages))
    .filter(snapshot => snapshot.packageId && snapshot.canonicalItemId);
}

export async function persistSourcePackageSnapshots(packages = [], client = prisma) {
  const snapshots = buildSourcePackageSnapshots(packages);
  const delegate = client?.sourcePackageSnapshot;
  if (!delegate || !snapshots.length) return [];

  const persisted = [];
  for (const snapshot of snapshots) {
    const sameHash = await delegate.findFirst({
      where: {
        packageId: snapshot.packageId,
        packageHash: snapshot.packageHash
      },
      orderBy: { version: "desc" }
    });
    if (sameHash?.active === true) {
      const dedupe = await archiveDuplicateNormalizedActiveSnapshots(snapshot, delegate);
      persisted.push({ snapshot: sameHash, created: false, unchanged: true, dedupe });
      continue;
    }

    const latest = await delegate.findFirst({
      where: { packageId: snapshot.packageId },
      orderBy: { version: "desc" }
    });
    const version = latest?.version ? Number(latest.version) + 1 : 1;
    if (latest) {
      await delegate.updateMany({
        where: {
          packageId: snapshot.packageId,
          active: true
        },
        data: {
          active: false,
          status: "archived"
        }
      });
    }

    if (sameHash) {
      const reactivated = await delegate.update({
        where: { id: sameHash.id },
        data: {
          ...snapshot,
          version,
          active: true,
          lastBuiltAt: new Date()
        }
      });
      const dedupe = await archiveDuplicateNormalizedActiveSnapshots(reactivated, delegate);
      persisted.push({ snapshot: reactivated, created: false, unchanged: false, reactivated: true, dedupe });
      continue;
    }

    const created = await delegate.create({
      data: {
        ...snapshot,
        version,
        active: true,
        lastBuiltAt: new Date()
      }
    });
    const dedupe = await archiveDuplicateNormalizedActiveSnapshots(created, delegate);
    persisted.push({ snapshot: created, created: true, unchanged: false, dedupe });
  }
  return persisted;
}
