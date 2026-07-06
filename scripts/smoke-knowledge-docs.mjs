#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

import {
  buildKnowledgeDocIngestPayload,
  loadKnowledgeMetadataFiles,
  validateKnowledgeMetadata
} from "./lib/knowledge-docs.mjs";

const SAMPLE_DOC_ID = "sm-terviseprobleemiga-laste-perede-hea-tava-2025";

function usage() {
  return [
    "Usage:",
    "  npm run knowledge:smoke -- --root \"C:\\Users\\rauds\\Desktop\\SotsiaalAI\\Andmebaasi\\uuringud ja juhendid\"",
    "  npm run knowledge:smoke -- --root \"C:\\Users\\rauds\\Desktop\\SotsiaalAI\\Andmebaasi\\lisatest\"",
    "",
    "Checks all knowledge-doc metadata files and RAG ingest payload shapes without ingesting anything.",
    "If the historical sample guideline is present, it also runs the stricter sample assertions."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = {
    root: "",
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--root") args.root = argv[++index] || "";
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.root) throw new Error("Pass --root <path>.");

  const root = path.resolve(args.root);
  const metadataFiles = await loadKnowledgeMetadataFiles(root);
  const validated = metadataFiles.map(item => ({
    file: item.fileName,
    result: validateKnowledgeMetadata(item.data || {}, { root })
  }));
  const failures = validated.filter(item => !item.result.ok);
  assertCondition(metadataFiles.length > 0, "expected at least one metadata file");
  assertCondition(
    failures.length === 0,
    `metadata validation failed: ${failures.map(item => `${item.file}: ${item.result.errors.join("; ")}`).join(" | ")}`
  );

  const payloads = validated.map(item => ({
    file: item.file,
    metadata: item.result.metadata,
    sourceFilePath: item.result.sourceFilePath,
    payload: buildKnowledgeDocIngestPayload(item.result.metadata)
  }));
  for (const item of payloads) {
    assertCondition(item.payload.doc_id === item.metadata.docId, `${item.file}: ingest payload doc_id mismatch`);
    assertCondition(item.payload.metadata.collection_id === item.metadata.collection_id, `${item.file}: ingest metadata collection mismatch`);
    assertCondition(item.payload.metadata.source_type === item.metadata.source_type, `${item.file}: ingest metadata source_type mismatch`);
    assertCondition(item.payload.metadata.legal_basis === false, `${item.file}: knowledge docs must not be legal_basis`);
    assertCondition(item.payload.chunks.every(chunk => chunk.metadata.legal_basis === false), `${item.file}: chunks must not be legal_basis`);
    assertCondition(item.payload.chunks.every(chunk => chunk.metadata.collection_id !== "kov_services"), `${item.file}: chunks must not use kov_services`);
    assertCondition(await exists(item.sourceFilePath), `${item.file}: source_path file must exist`);
  }

  const guidelines = validated.filter(item => item.result.metadata.document_kind === "guideline");
  const sample = validated.find(item => item.result.metadata.docId === SAMPLE_DOC_ID);
  let sampleResult = null;
  if (sample) {
    const metadata = sample.result.metadata;
    assertCondition(metadata.collection_id === "national_guidelines", "sample collection_id must be national_guidelines");
    assertCondition(metadata.source_type === "official_guideline", "sample source_type must be official_guideline");
    assertCondition(metadata.evidence_role === "practice_guidance", "sample evidence_role must be practice_guidance");
    assertCondition(metadata.disallowed_claim_types.includes("legal_entitlement"), "sample must disallow legal_entitlement");
    assertCondition(metadata.disallowed_claim_types.includes("benefit_amount"), "sample must disallow benefit_amount");
    assertCondition(
      metadata.sectionIndex.some(section => section.section_id === "ametniku-sekkumise-eetika" || /Ametniku sekkumise eetika/u.test(section.title || "")),
      "sample sectionIndex must include Ametniku sekkumise eetika"
    );
    const payload = buildKnowledgeDocIngestPayload(metadata);
    assertCondition(payload.chunks.length >= metadata.sectionIndex.length, "sample ingest payload must include section chunks");
    sampleResult = {
      sample_doc_id: SAMPLE_DOC_ID,
      sample_ingest_ready: true,
      section_count: metadata.sectionIndex.length,
      payload_chunk_count: payload.chunks.length,
      collection_id: metadata.collection_id,
      source_type: metadata.source_type,
      evidence_role: metadata.evidence_role,
      disallowed_claim_types: metadata.disallowed_claim_types
    };
  }

  const countBy = (items, field) => items.reduce((acc, item) => {
    const key = String(item.result.metadata?.[field] || "unknown");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  console.log(JSON.stringify({
    ok: true,
    root,
    metadata_file_count: validated.length,
    guideline_count: guidelines.length,
    payload_count: payloads.length,
    chunk_count: payloads.reduce((sum, item) => sum + item.payload.chunks.length, 0),
    collection_counts: countBy(validated, "collection_id"),
    source_type_counts: countBy(validated, "source_type"),
    resource_type_counts: countBy(validated, "resource_type"),
    sample: sampleResult
  }, null, 2));
}

main().catch((error) => {
  console.error(`[knowledge:smoke] ${error?.message || String(error)}`);
  process.exitCode = 1;
});
