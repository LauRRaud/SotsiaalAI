#!/usr/bin/env node

import path from "node:path";
import fs from "node:fs";
import * as dotenv from "dotenv";

import { buildFormsContactsAudit } from "../lib/admin/rag/sourcePackages/formsContactsAudit.js";
import {
  DEFAULT_REGISTRY_PATH,
  readJson,
  readText,
  writeJson
} from "./lib/kov-rag-state.mjs";

if (fs.existsSync(".env")) {
  dotenv.config({ path: ".env" });
}
if (fs.existsSync("rag.env")) {
  dotenv.config({ path: "rag.env", override: false });
}

function usage() {
  return [
    "Usage:",
    "  npm run rag:audit:forms-contacts -- --municipality harku_vald --slug harku-vald --json logs/harku-vald-forms-contacts-audit.json",
    "",
    "Options:",
    "  --municipality <id>    Municipality id, e.g. harku_vald",
    "  --municipality-id <id> Alias for --municipality",
    "  --slug <slug>          KOV slug. Defaults from municipality id",
    "  --root <path>          KOV input root. Defaults to KOV/<slug>",
    "  --registry <path>      RAG registry.json path",
    "  --json <path>          Write JSON audit report",
    "  --summary-only         Print only compact console summary",
    "",
    "Read-only: audits local KOV inputs, optional registry metadata, and optional SourcePackage snapshots."
  ].join("\n");
}

function clean(value) {
  const text = String(value || "").trim();
  return text || null;
}

function parseArgs(argv = []) {
  const args = {
    municipalityId: "",
    slug: "",
    root: "",
    registry: DEFAULT_REGISTRY_PATH,
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
    else if (arg === "--registry") args.registry = argv[++index] || args.registry;
    else if (arg === "--json") args.json = argv[++index] || "";
    else if (arg === "--summary-only") args.summaryOnly = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  args.slug = clean(args.slug) || clean(args.municipalityId)?.replace(/_/gu, "-") || "";
  args.municipalityId = clean(args.municipalityId) || clean(args.slug)?.replace(/-/gu, "_") || "";
  args.root = args.root || (args.slug ? path.join("KOV", args.slug) : "");
  args.json = args.json || (args.slug ? path.join("logs", `${args.slug}-forms-contacts-audit.json`) : "");
  return args;
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
    slug: report.slug,
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
    relatedForms: report.summary.relatedForms,
    relatedContacts: report.summary.relatedContacts,
    reason_counts: report.summary.reason_counts,
    recommended_next_step: report.recommended_next_step,
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
  if (!args.municipalityId || !args.slug || !args.root) {
    throw new Error("Pass --municipality and --slug, or enough data to derive them.");
  }

  const root = path.resolve(process.cwd(), args.root);
  const checkedPaths = {
    root,
    localData: path.join(root, `${args.slug}.json`),
    localSources: path.join(root, `${args.slug}.sources.json`),
    localRagMarkdown: path.join(root, `${args.slug}.rag.md`),
    registry: args.registry
  };
  const [localData, localSourcesData, registry, ragMarkdown, snapshotResult] = await Promise.all([
    readJson(checkedPaths.localData),
    readJson(checkedPaths.localSources),
    readJson(args.registry),
    readText(checkedPaths.localRagMarkdown),
    loadSnapshots(args.municipalityId)
  ]);

  const report = buildFormsContactsAudit({
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
  report.slug = args.slug;
  report.summary.relatedForms = {
    resolved: report.services.filter(service => service.forms.status === "present").length,
    missing: report.services.filter(service => service.forms.status === "missing").length
  };
  report.summary.relatedContacts = {
    resolved: report.services.filter(service => service.contacts.status === "present").length,
    missing: report.services.filter(service => service.contacts.status === "missing").length
  };

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
  console.error(`[forms-contacts-audit] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
