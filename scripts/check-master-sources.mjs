#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import { DEFAULT_SOURCE_MASTER_PATH, loadSourceMasterRecords } from "./lib/source-master-knowledge-docs.mjs";
import { safeFetch, SafeFetchError } from "./lib/safe-fetch.mjs";
import { assertExistingStateCompatible, sha256 } from "./lib/master-sources-inventory.mjs";

const DEFAULT_STATE = "Andmebaasi/Admebaasi-materjali-lisa/master_sources.state.json";
const DEFAULT_CANDIDATES = "Andmebaasi/Admebaasi-materjali-lisa/master_sources.korje.json";
const CANDIDATE_STATUSES = new Set(["missing", "incomplete", "stale_match", "needs_adoption", "needs_content_check"]);

function usage() {
  return [
    "Usage: npm run rag:master:check -- [--state <path>] [--output <path>] [--priority high] [--limit 10] [--fetch] [--json]",
    "Without --fetch this is a dry-run plan and performs no external request or ingest.",
    "--fetch only writes review candidates; it never updates the master registry or ingests RAG content."
  ].join("\n");
}

function parseArgs(argv) {
  const args = { master: DEFAULT_SOURCE_MASTER_PATH, state: DEFAULT_STATE, output: DEFAULT_CANDIDATES, priority: "all", limit: 0, fetch: false, json: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--master") args.master = argv[++index];
    else if (arg === "--state") args.state = argv[++index];
    else if (arg === "--output") args.output = argv[++index];
    else if (arg === "--priority") args.priority = String(argv[++index] || "all").toLowerCase();
    else if (arg === "--limit") args.limit = Math.max(0, Number.parseInt(argv[++index], 10) || 0);
    else if (arg === "--fetch") args.fetch = true;
    else if (arg === "--json") args.json = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

function cleanText(value) {
  return String(value || "").replace(/<script[\s\S]*?<\/script>/giu, " ").replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ").replace(/&nbsp;/giu, " ").replace(/&amp;/giu, "&").replace(/\s+/gu, " ").trim();
}

function snapshot(record, response) {
  const format = response.body.subarray(0, 5).toString("latin1") === "%PDF-" ? "pdf" : response.contentType.includes("html") ? "html" : "unknown";
  const raw = format === "html" ? response.body.toString("utf8") : "";
  const text = format === "html" ? cleanText(raw) : "";
  return {
    source_id: record.source_id,
    url: record.url,
    final_url: response.finalUrl,
    http_status: response.status,
    redirects: response.redirects,
    detected_format: format,
    content_type: response.contentType || null,
    bytes: response.bytes,
    content_hash: format === "pdf" ? sha256(response.body) : sha256(text.toLocaleLowerCase("et")),
    content_length: text.length || response.bytes,
    sample: text.slice(0, 420),
    route: record.recommended_pipeline === "html_or_topic_pipeline" ? "html_or_topic" : record.recommended_pipeline || "needs_review",
    status: format === "unknown" || (!text && format === "html") ? "needs_review" : "review_required"
  };
}

async function atomicWrite(filePath, value) {
  const absolute = path.resolve(filePath);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const temporary = `${absolute}.tmp-${process.pid}-${crypto.randomUUID()}`;
  await fs.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await fs.rename(temporary, absolute);
}

export async function buildMasterSourceCandidatePlan(args, { fetcher = safeFetch } = {}) {
  const [records, stateText] = await Promise.all([loadSourceMasterRecords(args.master), fs.readFile(args.state, "utf8")]);
  const registrySha = sha256(await fs.readFile(args.master));
  await assertExistingStateCompatible(args.state, registrySha);
  const state = JSON.parse(stateText);
  const candidates = records.filter(record => CANDIDATE_STATUSES.has(state.sources?.[record.source_id]?.match_status))
    .filter(record => args.priority === "all" || record.ingest_priority === args.priority)
    .filter(record => record.recommended_pipeline !== "registry_reference" && record.source_type !== "social_media_page")
    .slice(0, args.limit || undefined);
  const result = { schema_version: "master-sources-candidates-v1", registry_sha256: registrySha, generated_at: new Date().toISOString(), dry_run: !args.fetch, candidates: [] };
  for (const record of candidates) {
    if (!args.fetch) {
      result.candidates.push({ source_id: record.source_id, title: record.title, url: record.url, status: "planned_review", route: record.recommended_pipeline || "needs_review" });
      continue;
    }
    try {
      result.candidates.push(snapshot(record, await fetcher(record.url, { headers: { Accept: "text/html,application/xhtml+xml,application/pdf;q=0.9,*/*;q=0.1", "User-Agent": "SotsiaalAI source-master collector/1.0 (+https://sotsiaal.ai)" } })));
    } catch (error) {
      result.candidates.push({ source_id: record.source_id, title: record.title, url: record.url, status: error instanceof SafeFetchError ? error.code : "fetch_failed", route: "manual_review" });
    }
  }
  return result;
}

export async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.help) return usage();
  const result = await buildMasterSourceCandidatePlan(args);
  if (args.fetch) await atomicWrite(args.output, result);
  return result;
}

if (import.meta.url === new URL(process.argv[1], "file:").href) {
  main().then(result => process.stdout.write(`${typeof result === "string" ? result : JSON.stringify(result, null, 2)}\n`)).catch(error => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: { code: error?.code || "candidate_check_failed", message: String(error?.message || error) } })}\n`);
    process.exitCode = 2;
  });
}
