#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildRtXmlIngestPayload } from "../lib/admin/rag/kov/rtXml.js";
import {
  auditKovRtManifestEntry,
  findKovRtManifestEntry,
  readKovRtManifest
} from "../lib/admin/rag/kov/rtManifest.js";
import { assertRagSourceMetadataContract } from "../lib/rag/sourceMetadata.js";
import { syncKovRtCliIngest } from "./lib/kov-admin-sync.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const RAW_RAG_HOST = String(process.env.RAG_INTERNAL_HOST || process.env.RAG_API_BASE || "127.0.0.1:8000").trim();
const RAG_KEY = String(process.env.RAG_SERVICE_API_KEY || "").trim();

function usage() {
  console.log(`
Usage:
  node scripts/ingest-national-rt-xml.mjs <xml-file> [--doc-id <doc-id>] [--source-url <url>] [--municipality <name>] [--municipality-id <id>] [--kov-root <root> --slug <slug>] [--dry-run]

Example:
  node scripts/ingest-national-rt-xml.mjs KOV/130122025029.xml --dry-run
  node scripts/ingest-national-rt-xml.mjs KOV/130122025029.xml
`.trim());
}

function normalizeBaseFromHost(host) {
  const trimmed = String(host || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "http://127.0.0.1:8000";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function parseArgs(argv) {
  const args = {
    file: "",
    docId: "",
    sourceUrl: "",
    municipality: "",
    municipalityId: "",
    kovRoot: "",
    slug: "",
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === "--help" || value === "-h") {
      args.help = true;
      continue;
    }
    if (value === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (value === "--doc-id") {
      args.docId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (value === "--source-url") {
      args.sourceUrl = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (value === "--municipality") {
      args.municipality = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (value === "--municipality-id") {
      args.municipalityId = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (value === "--kov-root") {
      args.kovRoot = String(argv[i + 1] || "").trim();
      i += 1;
      continue;
    }
    if (value === "--slug") {
      args.slug = String(argv[i + 1] || "").trim().toLowerCase();
      i += 1;
      continue;
    }
    if (!args.file) {
      args.file = value;
      continue;
    }
    throw new Error(`Unknown argument: ${value}`);
  }

  return args;
}

function summarizePayload(payload) {
  const firstChunk = payload.chunks?.[0] || {};
  return {
    doc_id: payload.doc_id,
    title: payload.metadata?.title,
    act_reference: payload.metadata?.act_reference,
    issuer: payload.metadata?.issuer,
    collection_id: payload.metadata?.collection_id,
    jurisdiction_level: payload.metadata?.jurisdiction_level,
    municipality_name: payload.metadata?.municipality_name || null,
    source_url: payload.metadata?.source_url,
    source_type: payload.metadata?.source_type,
    municipality_id: payload.metadata?.municipality_id || null,
    valid_from: payload.metadata?.valid_from || null,
    valid_to: payload.metadata?.valid_to || null,
    historical: payload.metadata?.historical === true,
    source_status: payload.metadata?.source_status || null,
    chunk_count: Array.isArray(payload.chunks) ? payload.chunks.length : 0,
    first_chunk: {
      chunk_key: firstChunk.metadata?.chunk_key,
      canonical_chunk_id: firstChunk.metadata?.canonical_chunk_id,
      paragraph_number: firstChunk.metadata?.paragraph_number,
      title: firstChunk.metadata?.title
    }
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.kovRoot && args.slug && !args.file) {
    const { manifest } = await readKovRtManifest(args.kovRoot);
    const entry = findKovRtManifestEntry(manifest, args.slug);
    if (!entry) throw new Error(`RT manifest entry missing for slug: ${args.slug}`);
    const audit = await auditKovRtManifestEntry(args.kovRoot, entry);
    if (!audit.xml_found || !audit.xml_path || !audit.generated_metadata_valid) {
      throw new Error(`RT manifest entry is not ingest-ready for ${args.slug}: ${(audit.errors || []).join("; ") || audit.ingest_status}`);
    }
    args.file = path.relative(rootDir, audit.xml_path).replace(/\\/g, "/");
    args.docId = audit.generated_metadata.docId;
    args.sourceUrl = audit.generated_metadata.act_url;
    args.municipality = audit.generated_metadata.municipality_name;
    args.municipalityId = audit.generated_metadata.municipality_id;
    args.generatedMetadata = audit.generated_metadata;
  }

  if (args.help || !args.file) {
    usage();
    process.exit(args.help ? 0 : 1);
  }

  const absolutePath = path.resolve(rootDir, args.file);
  const xmlText = await fs.readFile(absolutePath, "utf8");
  const sourcePath = path.relative(rootDir, absolutePath).replace(/\\/g, "/");
  const payload = buildRtXmlIngestPayload({
    xmlText,
    sourceFile: path.basename(absolutePath),
    sourcePath,
    sourceUrl: args.sourceUrl,
    docId: args.docId,
    municipality: args.municipality,
    municipalityId: args.municipalityId,
    generatedMetadata: args.generatedMetadata
  });
  assertRagSourceMetadataContract(payload.metadata, {
    label: "national_rt.metadata",
    requireMunicipality: false,
    requireDocumentId: true,
    requireTitle: true,
    requireAudience: true
  });

  console.log(JSON.stringify(summarizePayload(payload), null, 2));

  if (args.dryRun) return;

  if (!RAG_KEY) {
    throw new Error("RAG_SERVICE_API_KEY is required for ingest");
  }

  const response = await fetch(`${normalizeBaseFromHost(RAW_RAG_HOST)}/ingest/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": RAG_KEY
    },
    body: JSON.stringify(payload)
  });
  const raw = await response.text().catch(() => "");
  const data = raw ? JSON.parse(raw) : {};

  if (!response.ok || data?.ok === false) {
    throw new Error(data?.detail || data?.message || raw || `RAG ingest failed (${response.status})`);
  }

  console.log(`Ingested ${payload.doc_id}: ${data?.inserted ?? payload.chunks.length} chunks`);
  const adminSync = await syncKovRtCliIngest({
    municipalitySlug: args.municipalityId || payload.metadata?.municipality_id || "",
    municipalityName: args.municipality || payload.metadata?.municipality_name || "",
    county: payload.metadata?.county || "",
    sourceUrl: args.sourceUrl || payload.metadata?.source_url || "",
    ragDocId: payload.doc_id
  });
  if (adminSync?.synced) {
    console.log(`[rt:admin-sync] ${adminSync.municipalitySlug} -> ${adminSync.ragDocId}`);
  } else if (adminSync?.reason && adminSync.reason !== "municipality not provided") {
    console.log(`[rt:admin-sync] skipped (${adminSync.reason})`);
  }
}

main().catch(error => {
  console.error(error?.message || error);
  process.exit(1);
});
