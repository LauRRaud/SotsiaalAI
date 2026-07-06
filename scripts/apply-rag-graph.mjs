#!/usr/bin/env node

// Graph-lite phase 1 loader: builds the deterministic KOV graph plan and
// writes it into Postgres (RagEntity / RagRelation). Dry-run by default;
// --apply performs idempotent upserts (entities by externalKey, relations
// deduped by the unique (from,to,type,sourceDocumentId) constraint), so
// re-running after KOV data changes is safe.

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { buildKovGraph, mergeGraphBuilds } from "../lib/rag/graph/kovGraphBuilder.js";

const DEFAULT_KOV_ROOT = "KOV";
const ENTITY_BATCH = 200;
const RELATION_BATCH = 1000;

function usage() {
  return [
    "Usage:",
    "  npm run rag:graph:apply                      (dry-run: plan + counts only)",
    "  npm run rag:graph:apply -- --apply           (write graph into Postgres)",
    "  npm run rag:graph:apply -- --root KOV --municipality kuusalu-vald",
    "",
    "Requires DATABASE_URL (run on the server with frontend.env loaded).",
    "The rag_graph_lite migration must be applied first."
  ].join("\n");
}

function parseArgs(argv = []) {
  const args = { root: DEFAULT_KOV_ROOT, apply: false, municipalities: [], jsonPath: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--apply") args.apply = true;
    else if (arg === "--root") args.root = argv[++index] || args.root;
    else if (arg === "--municipality") args.municipalities.push(argv[++index] || "");
    else if (arg === "--json") args.jsonPath = argv[++index] || null;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return args;
}

async function loadBundles(root, municipalities = []) {
  const bundles = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name === "kov_rt") continue;
    if (municipalities.length > 0 && !municipalities.includes(entry.name)) continue;
    try {
      const raw = await fs.readFile(path.join(root, entry.name, `${entry.name}.json`), "utf8");
      bundles.push(JSON.parse(raw));
    } catch {
      // folder without a canonical bundle; skip
    }
  }
  return bundles;
}

export function chunked(list = [], size = 100) {
  const out = [];
  for (let index = 0; index < list.length; index += size) out.push(list.slice(index, index + size));
  return out;
}

export function relationRowsFor(relations = [], idByExternalKey = new Map()) {
  const rows = [];
  const skipped = [];
  for (const relation of relations) {
    const fromEntityId = idByExternalKey.get(relation.fromKey);
    const toEntityId = idByExternalKey.get(relation.toKey);
    if (!fromEntityId || !toEntityId) {
      skipped.push(`${relation.fromKey} ${relation.relationType} ${relation.toKey}`);
      continue;
    }
    rows.push({
      fromEntityId,
      toEntityId,
      relationType: relation.relationType,
      confidence: relation.confidence ?? 1,
      evidenceChunkId: relation.evidence?.chunk_id ?? null,
      sourceDocumentId: relation.evidence?.source_document_id ?? null,
      evidenceRef: relation.evidence?.canonical_item_id ?? null,
      extractor: relation.extractor || "deterministic_kov_v1",
      reviewStatus: relation.reviewStatus || "AUTO_APPROVED"
    });
  }
  return { rows, skipped };
}

async function applyGraph(prisma, merged) {
  const counts = { entities_upserted: 0, relations_created: 0, relations_skipped_existing: 0, relations_unresolved: 0 };

  for (const batch of chunked(merged.entities, ENTITY_BATCH)) {
    await prisma.$transaction(batch.map(entity => prisma.ragEntity.upsert({
      where: { externalKey: entity.externalKey },
      update: {
        name: entity.name,
        normalizedName: entity.normalizedName,
        description: entity.description ?? null,
        confidence: entity.confidence ?? 1,
        reviewStatus: entity.reviewStatus || "AUTO_APPROVED"
      },
      create: {
        type: entity.type,
        name: entity.name,
        normalizedName: entity.normalizedName,
        externalKey: entity.externalKey,
        aliases: entity.aliases || [],
        roles: entity.roles || [],
        description: entity.description ?? null,
        confidence: entity.confidence ?? 1,
        reviewStatus: entity.reviewStatus || "AUTO_APPROVED"
      }
    })));
    counts.entities_upserted += batch.length;
  }

  const stored = await prisma.ragEntity.findMany({ select: { id: true, externalKey: true } });
  const idByExternalKey = new Map(stored.map(row => [row.externalKey, row.id]));

  const { rows, skipped } = relationRowsFor(merged.relations, idByExternalKey);
  counts.relations_unresolved = skipped.length;
  for (const batch of chunked(rows, RELATION_BATCH)) {
    const result = await prisma.ragRelation.createMany({ data: batch, skipDuplicates: true });
    counts.relations_created += result.count;
    counts.relations_skipped_existing += batch.length - result.count;
  }
  return counts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const bundles = await loadBundles(args.root, args.municipalities);
  if (bundles.length === 0) throw new Error(`No KOV bundles found under ${args.root}`);
  const merged = mergeGraphBuilds(bundles.map(bundle => buildKovGraph(bundle)));

  const output = {
    ok: true,
    mode: args.apply ? "apply" : "dry-run",
    bundle_count: bundles.length,
    summary: merged.summary,
    warning_count: merged.warnings.length
  };

  if (args.apply) {
    const { default: prisma } = await import("../lib/prisma.js");
    try {
      output.db = await applyGraph(prisma, merged);
      output.db_totals = {
        entities: await prisma.ragEntity.count(),
        relations: await prisma.ragRelation.count()
      };
    } finally {
      await prisma.$disconnect().catch(() => {});
    }
  }

  const serialized = JSON.stringify(output, null, 2);
  if (args.jsonPath) await fs.writeFile(args.jsonPath, serialized, "utf8");
  console.log(serialized);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(JSON.stringify({ ok: false, error: error?.message || String(error) }));
    process.exitCode = 1;
  });
}
