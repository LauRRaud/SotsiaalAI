#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import prisma from "../lib/prisma.js";
import { buildSourcePackageGapReport } from "../lib/admin/rag/sourcePackages/gapReport.js";

const DEFAULT_ROOT = "KOV/Jogeva/jogeva-vald";
const DEFAULT_JSON = "logs/jogeva-sourcepackage-gap-report.json";

function usage() {
  return [
    "Usage:",
    "  npm run rag:report:jogeva-sourcepackage-gaps",
    "  npm run rag:report:jogeva-sourcepackage-gaps -- --json logs/jogeva-sourcepackage-gap-report.json",
    "  node scripts/report-jogeva-sourcepackage-gaps.mjs --root KOV/Jogeva/jogeva-vald --summary-only",
    "",
    "Options:",
    "  --root <path>             Jogeva input metadata root",
    "  --json <path>             Write JSON report",
    "  --municipality-id <id>    Defaults to jogeva_vald",
    "  --summary-only            Print only compact console summary",
    "",
    "This is read-only: it reads SourcePackageSnapshot rows and local metadata, then writes a report file."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: DEFAULT_ROOT,
    json: DEFAULT_JSON,
    municipalityId: "jogeva_vald",
    summaryOnly: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--json") args.json = argv[++index] || args.json;
    else if (arg === "--municipality-id") args.municipalityId = argv[++index] || args.municipalityId;
    else if (arg === "--summary-only") args.summaryOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function readJson(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function byId(items = []) {
  return new Map(arrayValue(items).map(item => [clean(item.id || item.source_id || item.key), item]).filter(([id]) => id));
}

function sourceForItem(item = {}, sourceByKey = new Map(), fallback = {}) {
  const sourceKey = arrayValue(item.sourceKeys)[0];
  const source = sourceByKey.get(sourceKey) || {};
  return {
    source_id: clean(source.source_id) || clean(item.id) || clean(fallback.source_id),
    source_type: clean(source.source_type) || clean(fallback.source_type),
    resource_type: clean(source.resource_type) || clean(fallback.resource_type),
    item_type: clean(item.itemType) || clean(fallback.item_type),
    municipality_id: clean(source.municipality_id) || "jogeva_vald",
    source_status: clean(source.source_status) || clean(item.status) || "active",
    historical: source.historical === true || item.historical === true
  };
}

async function buildCandidateSources(root) {
  const data = await readJson(path.join(root, "jogeva-vald.json"));
  const sourcesFile = await readJson(path.join(root, "jogeva-vald.sources.json"));
  const items = arrayValue(data?.items);
  const itemById = byId(items);
  const sourceByKey = new Map(arrayValue(sourcesFile?.sources).map(source => [clean(source.key), source]).filter(([key]) => key));
  const candidates = [];

  for (const item of items) {
    const canonicalItemId = clean(item.id);
    if (!canonicalItemId || item.itemType === "form" || item.itemType === "contact") continue;

    for (const formId of arrayValue(item.relatedForms)) {
      const form = itemById.get(formId) || { id: formId, itemType: "form", status: "active" };
      candidates.push({
        ...sourceForItem(form, sourceByKey, { source_id: formId, source_type: "application_form", item_type: "form" }),
        canonical_item_id: canonicalItemId,
        section: "forms"
      });
    }

    for (const contactId of arrayValue(item.relatedContacts)) {
      const contact = itemById.get(contactId) || { id: contactId, itemType: "contact", status: "active" };
      candidates.push({
        ...sourceForItem(contact, sourceByKey, { source_id: contactId, source_type: "official_contact", item_type: "contact" }),
        canonical_item_id: canonicalItemId,
        section: "contacts"
      });
    }

    if (clean(item.amount)) {
      candidates.push({
        source_id: `${canonicalItemId}:amount`,
        source_type: "kov_service_info",
        item_type: clean(item.itemType),
        municipality_id: "jogeva_vald",
        source_status: clean(item.status) || "active",
        historical: false,
        canonical_item_id: canonicalItemId,
        section: "fees"
      });
    }

    if (clean(item.deadline || item.decisionTime)) {
      candidates.push({
        source_id: `${canonicalItemId}:deadline`,
        source_type: "kov_service_info",
        item_type: clean(item.itemType),
        municipality_id: "jogeva_vald",
        source_status: clean(item.status) || "active",
        historical: false,
        canonical_item_id: canonicalItemId,
        section: "deadlines"
      });
    }
  }

  try {
    await fs.access(path.join(root, "406112024020.xml"));
    candidates.push({
      source_id: "jogeva-vald-rt-406112024020",
      source_type: "kov_regulation",
      resource_type: "legal_basis",
      municipality_id: "jogeva_vald",
      source_status: "active",
      historical: false,
      section: "legal_basis",
      global_current_evidence: true
    });
  } catch {
    // no local RT candidate
  }

  return candidates;
}

async function loadSnapshots(municipalityId) {
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

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function printSummary(report, outputPath) {
  console.log(JSON.stringify({
    ok: true,
    municipality_id: report.municipality_id,
    package_count: report.summary.package_count,
    missing_counts: report.summary.missing_counts,
    likely_reasons: report.summary.likely_reasons,
    output: outputPath
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const [snapshots, candidateSources] = await Promise.all([
    loadSnapshots(args.municipalityId),
    buildCandidateSources(args.root)
  ]);
  const report = buildSourcePackageGapReport(snapshots, {
    municipalityId: args.municipalityId,
    candidateSources
  });

  if (args.json) await writeJson(args.json, report);
  if (args.summaryOnly) {
    printSummary(report, args.json || null);
  } else {
    printSummary(report, args.json || null);
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
    console.error(`[jogeva-sourcepackage-gap-report] ${error?.message || String(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect?.().catch(() => {});
  });
