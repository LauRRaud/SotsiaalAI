#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import { buildJogevaFormsContactsAudit } from "../lib/admin/rag/sourcePackages/formsContactsAudit.js";

const DEFAULT_ROOT = "KOV/Jogeva/jogeva-vald";
const DEFAULT_REGISTRY = "/var/lib/sotsiaalai-rag/registry.json";
const DEFAULT_JSON = "logs/jogeva-forms-contacts-audit.json";

function usage() {
  return [
    "Usage:",
    "  npm run rag:audit:jogeva-forms-contacts",
    "  npm run rag:audit:jogeva-forms-contacts -- --json logs/jogeva-forms-contacts-audit.json",
    "  node scripts/audit-jogeva-forms-contacts.mjs --root KOV/Jogeva/jogeva-vald --summary-only",
    "",
    "Options:",
    "  --root <path>             Jogeva input metadata root",
    "  --registry <path>         RAG registry.json path",
    "  --json <path>             Write JSON audit report",
    "  --municipality-id <id>    Defaults to jogeva_vald",
    "  --summary-only            Print only compact console summary",
    "",
    "This is read-only: it audits local KOV inputs, optional registry metadata, and optional SourcePackage snapshots."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: DEFAULT_ROOT,
    registry: DEFAULT_REGISTRY,
    json: DEFAULT_JSON,
    municipalityId: "jogeva_vald",
    summaryOnly: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--registry") args.registry = argv[++index] || args.registry;
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

async function readText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function resolveRoot(root) {
  return path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
}

async function loadSnapshots(municipalityId) {
  if (!process.env.DATABASE_URL) {
    return {
      rows: [],
      available: false,
      error: "DATABASE_URL is not set"
    };
  }

  let prisma = null;
  try {
    const imported = await import("../lib/prisma.js");
    prisma = imported.default;
    const rows = await prisma.sourcePackageSnapshot.findMany({
      where: {
        municipalityId,
        active: true
      },
      orderBy: [
        { title: "asc" }
      ]
    });
    return { rows, available: true, error: null, prisma };
  } catch (error) {
    return {
      rows: [],
      available: false,
      error: error?.message || String(error),
      prisma
    };
  }
}

function printSummary(report, outputPath) {
  console.log(JSON.stringify({
    ok: report.ok,
    municipality_id: report.municipality_id,
    services_audited: report.summary.services_audited,
    active_snapshot_count: report.summary.active_snapshot_count,
    local_form_items: report.summary.local_form_items,
    local_contact_items: report.summary.local_contact_items,
    local_form_sources: report.summary.local_form_sources,
    local_contact_sources: report.summary.local_contact_sources,
    registry_form_sources: report.summary.registry_form_sources,
    registry_contact_sources: report.summary.registry_contact_sources,
    services_with_related_forms: report.summary.services_with_related_forms,
    services_with_related_contacts: report.summary.services_with_related_contacts,
    reason_counts: report.summary.reason_counts,
    recommended_next_step: report.recommended_next_step,
    localJsonFound: report.localJsonFound,
    localDataSourcePath: report.localDataSourcePath,
    checkedPaths: report.checkedPaths,
    registry_available: report.registry_available,
    snapshot_available: report.snapshot_available,
    output: outputPath
  }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const root = resolveRoot(args.root);
  const checkedPaths = {
    root,
    localData: path.join(root, "jogeva-vald.json"),
    localSources: path.join(root, "jogeva-vald.sources.json"),
    localRagMarkdown: path.join(root, "jogeva-vald.rag.md"),
    registry: args.registry
  };
  const localData = await readJson(checkedPaths.localData);
  const localSourcesData = await readJson(checkedPaths.localSources);
  const registry = await readJson(args.registry);
  const ragMarkdown = await readText(checkedPaths.localRagMarkdown);
  const snapshotResult = await loadSnapshots(args.municipalityId);

  const report = buildJogevaFormsContactsAudit({
    municipalityId: args.municipalityId,
    localData,
    localSourcesData,
    localJsonFound: !!localData,
    localDataSourcePath: checkedPaths.localData,
    checkedPaths,
    registry,
    registryAvailable: !!registry,
    ragMarkdown,
    snapshots: snapshotResult.rows,
    snapshotAvailable: snapshotResult.available
  });

  if (snapshotResult.error) {
    report.snapshot_error = snapshotResult.error;
  }

  if (args.json) await writeJson(args.json, report);
  printSummary(report, args.json || null);

  if (!args.summaryOnly) {
    for (const service of report.services.slice(0, 30)) {
      console.log(`${service.title || service.service_id}: forms=${service.forms.status}:${service.forms.reason || "present"} contacts=${service.contacts.status}:${service.contacts.reason || "present"}`);
    }
  }

  await snapshotResult.prisma?.$disconnect?.().catch(() => {});
}

main().catch((error) => {
  console.error(`[jogeva-forms-contacts-audit] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
