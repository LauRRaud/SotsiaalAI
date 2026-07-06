#!/usr/bin/env node

import path from "node:path";

import prisma from "../lib/prisma.js";
import { buildSourcePackageGapReport } from "../lib/admin/rag/sourcePackages/gapReport.js";
import {
  arrayValue,
  clean,
  readJson,
  unique,
  writeJson
} from "./lib/kov-rag-state.mjs";

function usage() {
  return [
    "Usage:",
    "  npm run rag:report:sourcepackage-gaps -- --municipality harku_vald --slug harku-vald --json logs/harku-vald-sourcepackage-gap-report.json",
    "",
    "Options:",
    "  --municipality <id>    Municipality id, e.g. harku_vald",
    "  --municipality-id <id> Alias for --municipality",
    "  --slug <slug>          KOV slug. Defaults from municipality id",
    "  --root <path>          KOV input root. Defaults to KOV/<slug>",
    "  --json <path>          Write JSON report",
    "  --summary-only         Print only compact console summary",
    "",
    "Read-only: reads SourcePackageSnapshot rows and local KOV metadata."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    municipalityId: "",
    slug: "",
    root: "",
    json: "",
    summaryOnly: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--municipality" || arg === "--municipality-id") args.municipalityId = argv[++index] || "";
    else if (arg === "--slug") args.slug = argv[++index] || "";
    else if (arg === "--root") args.root = argv[++index] || "";
    else if (arg === "--json") args.json = argv[++index] || "";
    else if (arg === "--summary-only") args.summaryOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  args.slug = clean(args.slug) || clean(args.municipalityId)?.replace(/_/gu, "-") || "";
  args.municipalityId = clean(args.municipalityId) || clean(args.slug)?.replace(/-/gu, "_") || "";
  args.root = args.root || (args.slug ? path.join("KOV", args.slug) : "");
  args.json = args.json || (args.slug ? path.join("logs", `${args.slug}-sourcepackage-gap-report.json`) : "");
  return args;
}

function byId(items = []) {
  return new Map(arrayValue(items).map(item => [clean(item.id || item.source_id || item.key), item]).filter(([id]) => id));
}

function sourceKey(source = {}) {
  return clean(source.key || source.source_key || source.sourceKey || source.id || source.source_id);
}

function sourceForItem(item = {}, sourceByKey = new Map(), fallback = {}, municipalityId) {
  const sourceKeys = arrayValue(item.sourceKeys || item.source_keys);
  const source = sourceByKey.get(clean(sourceKeys[0])) || {};
  return {
    source_id: clean(source.source_id) || clean(item.id) || clean(fallback.source_id),
    source_type: clean(source.source_type) || clean(fallback.source_type),
    resource_type: clean(source.resource_type) || clean(fallback.resource_type),
    item_type: clean(item.itemType || item.item_type) || clean(fallback.item_type),
    municipality_id: clean(source.municipality_id) || municipalityId,
    source_status: clean(source.source_status) || clean(item.status) || "active",
    historical: source.historical === true || item.historical === true
  };
}

function itemType(item = {}) {
  return clean(item.itemType || item.item_type);
}

function isServiceLike(item = {}) {
  const type = itemType(item);
  return type && !["form", "contact"].includes(type);
}

async function buildCandidateSources(root, slug, municipalityId) {
  const data = await readJson(path.join(root, `${slug}.json`));
  const sourcesFile = await readJson(path.join(root, `${slug}.sources.json`));
  const meta = await readJson(path.join(root, `${slug}.meta.json`));
  const items = arrayValue(data?.items);
  const itemById = byId(items);
  const sourceByKey = new Map(arrayValue(sourcesFile?.sources).map(source => [sourceKey(source), source]).filter(([key]) => key));
  const candidates = [];

  for (const item of items.filter(isServiceLike)) {
    const canonicalItemId = clean(item.id);
    if (!canonicalItemId) continue;

    for (const formId of arrayValue(item.relatedForms || item.related_forms)) {
      const form = itemById.get(formId) || { id: formId, itemType: "form", status: "active" };
      candidates.push({
        ...sourceForItem(form, sourceByKey, { source_id: formId, source_type: "application_form", item_type: "form" }, municipalityId),
        canonical_item_id: canonicalItemId,
        section: "forms"
      });
    }

    for (const contactId of arrayValue(item.relatedContacts || item.related_contacts)) {
      const contact = itemById.get(contactId) || { id: contactId, itemType: "contact", status: "active" };
      candidates.push({
        ...sourceForItem(contact, sourceByKey, { source_id: contactId, source_type: "official_contact", item_type: "contact" }, municipalityId),
        canonical_item_id: canonicalItemId,
        section: "contacts"
      });
    }

    if (clean(item.amount || item.pricingOrAmount?.value || item.pricingOrAmount?.note)) {
      candidates.push({
        source_id: `${canonicalItemId}:amount`,
        source_type: "kov_service_info",
        item_type: itemType(item),
        municipality_id: municipalityId,
        source_status: clean(item.status) || "active",
        historical: false,
        canonical_item_id: canonicalItemId,
        section: "fees"
      });
    }

    if (clean(item.deadline || item.decisionTime || item.application?.deadline || item.application?.decisionTime)) {
      candidates.push({
        source_id: `${canonicalItemId}:deadline`,
        source_type: "kov_service_info",
        item_type: itemType(item),
        municipality_id: municipalityId,
        source_status: clean(item.status) || "active",
        historical: false,
        canonical_item_id: canonicalItemId,
        section: "deadlines"
      });
    }
  }

  const rtSource = meta?.rtAct && typeof meta.rtAct === "object" ? meta.rtAct : null;
  if (rtSource) {
    candidates.push({
      source_id: clean(rtSource.source_id) || `${slug}-rt-local`,
      source_type: "kov_regulation",
      resource_type: "legal_basis",
      municipality_id: municipalityId,
      source_status: clean(rtSource.source_status) || "active",
      historical: false,
      section: "legal_basis",
      global_current_evidence: true
    });
  }

  return {
    candidateSources: candidates,
    localMetadata: meta ? {
      schemaVersion: meta.schemaVersion || null,
      sourcePackageReadiness: meta.sourcePackageReadiness || null,
      regulation_sources: Number(meta.sourcePackageReadiness?.regulation_sources || 0)
    } : null
  };
}

async function loadSnapshots(municipalityId) {
  if (!process.env.DATABASE_URL) return [];
  return prisma.sourcePackageSnapshot.findMany({
    where: {
      municipalityId,
      active: true
    },
    orderBy: [
      { status: "asc" },
      { title: "asc" }
    ]
  });
}

function duplicateCount(rows = []) {
  const groups = new Map();
  for (const row of rows) {
    const key = clean(row.canonicalItemId);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row.packageId);
  }
  return [...groups.values()].reduce((sum, group) => sum + Math.max(0, group.length - 1), 0);
}

function printSummary(report, outputPath) {
  console.log(JSON.stringify({
    ok: true,
    municipality_id: report.municipality_id,
    slug: report.slug,
    package_count: report.summary.package_count,
    duplicate_normalized_canonical_id_count: report.summary.duplicate_normalized_canonical_id_count,
    missing_counts: report.summary.missing_counts,
    relatedForms: report.summary.relatedForms,
    relatedContacts: report.summary.relatedContacts,
    regulation_sources: report.local_metadata?.sourcePackageReadiness?.regulation_sources ?? null,
    output: outputPath
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.municipalityId || !args.slug || !args.root) {
    throw new Error("Pass --municipality and --slug, or enough data to derive them.");
  }

  const root = path.resolve(process.cwd(), args.root);
  const [snapshots, candidates] = await Promise.all([
    loadSnapshots(args.municipalityId),
    buildCandidateSources(root, args.slug, args.municipalityId)
  ]);
  const report = buildSourcePackageGapReport(snapshots, {
    municipalityId: args.municipalityId,
    candidateSources: candidates.candidateSources
  });
  report.slug = args.slug;
  report.root = root;
  report.local_metadata = candidates.localMetadata;
  report.summary.duplicate_normalized_canonical_id_count = duplicateCount(snapshots);
  report.summary.relatedForms = {
    resolved: unique(candidates.candidateSources.filter(source => source.section === "forms").map(source => source.source_id)).length,
    missing: report.summary.missing_counts.forms
  };
  report.summary.relatedContacts = {
    resolved: unique(candidates.candidateSources.filter(source => source.section === "contacts").map(source => source.source_id)).length,
    missing: report.summary.missing_counts.contacts
  };
  report.summary.missing_legal_basis = report.summary.missing_counts.legal_basis;
  report.summary.missing_fees = report.summary.missing_counts.fees;
  report.summary.missing_deadlines = report.summary.missing_counts.deadlines;

  if (args.json) await writeJson(args.json, report);
  printSummary(report, args.json || null);

  if (!args.summaryOnly) {
    for (const pkg of report.packages.slice(0, 20)) {
      const missing = Object.entries(pkg.gaps)
        .filter(([, gap]) => gap.status === "missing")
        .map(([section, gap]) => `${section}:${gap.likelyReason}`)
        .join(", ");
      console.log(`${pkg.title || pkg.packageId}: ${missing || "no missing audited sections"}`);
    }
  }
}

main()
  .catch((error) => {
    console.error(`[sourcepackage-gap-report] ${error?.message || String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect?.().catch(() => {});
  });
