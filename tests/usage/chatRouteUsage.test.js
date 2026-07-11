import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("main chat reserves reply usage before retrieval and RAG usage only at the RAG boundary", () => {
  const source = read("app/api/chat/route.js");
  const chatReserve = source.indexOf('metric: "CHAT_ASSISTANT_REPLY"');
  const retrieval = source.indexOf("assembleRetrievalContext({");
  const ragBoundary = source.indexOf("onBeforeRag: async () =>");
  const ragReserve = source.indexOf('metric: "RAG_SEARCH"');

  assert.ok(chatReserve >= 0 && chatReserve < retrieval);
  assert.ok(retrieval >= 0 && retrieval < ragBoundary);
  assert.ok(ragBoundary >= 0 && ragBoundary < ragReserve);
  assert.match(source, /ragSearchFailed[\s\S]*releaseUsageForRequest/);
  assert.match(source, /onUsageCommit:[\s\S]*commitUsageForRequest/);
  assert.match(source, /onUsageRelease:[\s\S]*releaseUsageForRequest/);
});

test("chat response handler settles usage across no-context, non-stream and stream paths", () => {
  const source = read("lib/chat/mainResponseHandler.js");

  assert.match(source, /onUsageCommit = null/);
  assert.match(source, /onUsageRelease = null/);
  assert.ok((source.match(/usage\.chat_commit\.error/g) || []).length >= 3);
  assert.match(source, /chat_provider_failed/);
  assert.match(source, /chat_stream_failed/);
});

test("retrieval exposes whether a real RAG attempt failed", () => {
  const source = read("lib/chat/retrievalContextAssembler.js");

  assert.match(source, /if \(shouldRunRag\)[\s\S]*await onBeforeRag\(\)/);
  assert.match(source, /ragAttempted: shouldRunRag/);
  assert.match(source, /ragSearchFailed/);
});

test("chat document generation uses the document entitlement at the provider boundary", () => {
  const routeSource = read("app/api/chat/route.js");
  const workflowSource = read("lib/chat/workflowBranchHandlers.js");

  assert.match(routeSource, /onBeforeGenerate:[\s\S]*metric: "DOCUMENT_GENERATE"/);
  assert.match(routeSource, /onGenerationComplete:[\s\S]*commitUsageForRequest/);
  assert.match(routeSource, /onGenerationFailure:[\s\S]*releaseUsageForRequest/);
  assert.match(workflowSource, /await onBeforeGenerate\(\)[\s\S]*await generateDraftContent/);
  assert.match(workflowSource, /generationCompleted = true[\s\S]*await onGenerationComplete\(\)/);
});
