import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { MAX_ARTIFACT_SOURCE_DOCUMENTS } from "../../lib/documents/constants.js";
import {
  ANALYSIS_DISCLAIMER,
  normalizeAnalysisContent,
  normalizeAnalysisSourceIds,
  serializeSavedAnalysis
} from "../../lib/documents/savedAnalysis.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// --- E2: savable analysis object — pure input + serialization contracts (real logic) ---

test("analysis content is required and size-bounded", () => {
  assert.throws(() => normalizeAnalysisContent("   "), /content_required/);
  assert.throws(() => normalizeAnalysisContent("x".repeat(200_001)), /content_too_large/);
  assert.equal(normalizeAnalysisContent("  hello  "), "hello");
});

test("source ids are de-duplicated, trimmed and capped to the artifact source limit", () => {
  assert.deepEqual(normalizeAnalysisSourceIds(["a", "a", " b ", "", null, 5]), ["a", "b", "5"]);
  const many = normalizeAnalysisSourceIds(Array.from({ length: 100 }, (_, i) => `d${i}`));
  assert.equal(many.length, MAX_ARTIFACT_SOURCE_DOCUMENTS);
});

test("every serialized analysis carries the AI-explanation disclaimer and hides content by default", () => {
  const row = {
    id: "an1",
    title: "T",
    content: "secret analysis text",
    sourceDocumentIds: ["d1"],
    createdAt: new Date(),
    updatedAt: new Date()
  };
  const view = serializeSavedAnalysis(row);
  assert.equal(view.disclaimer, ANALYSIS_DISCLAIMER);
  assert.equal(view.disclaimer, "ai_explanation_not_official_decision");
  assert.equal(view.content, undefined, "content is not exposed unless explicitly requested");
  assert.deepEqual(view.sourceDocumentIds, ["d1"]);
  assert.equal(serializeSavedAnalysis(row, { includeContent: true }).content, "secret analysis text");
  assert.equal(serializeSavedAnalysis(null), null);
});

// --- E2 / Contract 4 + Contract 2: owner-scoping asserted against source ---

test("saved-analysis persistence validates source ownership and stamps the disclaimer", () => {
  const src = read("lib/documents/savedAnalysis.js");
  // Save validates every source id belongs to the owner before writing (no cross-owner refs).
  assert.match(src, /userDocument\.findMany\(\{[\s\S]*?ownerId:\s*userId,\s*id:\s*\{\s*in:/);
  assert.match(src, /owned\.length\s*!==\s*requestedIds\.length[\s\S]*?sources_not_found/);
  // The stored row always carries the disclaimer marker.
  assert.match(src, /metadata:\s*\{\s*disclaimer:\s*ANALYSIS_DISCLAIMER\s*\}/);
});

test("saved-analysis reads and deletes are owner-scoped — a foreign id is indistinguishable from a missing one", () => {
  const src = read("lib/documents/savedAnalysis.js");
  assert.match(src, /savedAnalysis\.findFirst\(\{\s*where:\s*\{\s*id,\s*ownerId:\s*userId\b/);
  assert.match(src, /savedAnalysis\.deleteMany\(\{\s*where:\s*\{\s*id,\s*ownerId:\s*userId\b/);

  const detail = read("app/api/documents/analyses/[id]/route.js");
  assert.match(detail, /getSavedAnalysisForOwner[\s\S]{0,220}analyses\.errors\.not_found/);
  assert.match(detail, /deleteSavedAnalysisForOwner[\s\S]{0,220}analyses\.errors\.not_found/);
  assert.doesNotMatch(detail, /api\.common\.forbidden/);
});

test("an analysis is persisted only by the explicit Save (POST -> createSavedAnalysis)", () => {
  const collection = read("app/api/documents/analyses/route.js");
  assert.match(collection, /export async function POST[\s\S]*createSavedAnalysis/);
  // GET is read-only: it must not create anything.
  const getBlock = collection.slice(collection.indexOf("export async function GET"), collection.indexOf("export async function POST"));
  assert.doesNotMatch(getBlock, /createSavedAnalysis|\.create\(/);
});
