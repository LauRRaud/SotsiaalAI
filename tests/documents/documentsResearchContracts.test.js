import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// T07 DOCUMENTS-RESEARCH-V1 — server-boundary contracts asserted against source (the same static
// style used by tests/rag/agentDocumentIsolation.test.js), because these routes have no unit
// harness and the guarantees live in the request path, not in an isolated function.

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (rel) => readFileSync(path.join(ROOT, rel), "utf8");

// --- Contract 2: owner-404. A foreign id must be indistinguishable from a missing id. ---

test("document + artifact detail routes owner-scope the lookup instead of throwing an ownership 403", () => {
  const documentRoute = read("app/api/documents/[id]/route.js");
  assert.match(documentRoute, /findFirst\(\{\s*where:\s*\{\s*id,\s*ownerId\b/);
  assert.doesNotMatch(documentRoute, /assertOwnedByUser/);

  const artifactRoute = read("app/api/documents/artifacts/[id]/route.js");
  assert.match(artifactRoute, /findFirst\(\{\s*where:\s*\{\s*id,\s*ownerId:\s*userId\b/);
  assert.doesNotMatch(artifactRoute, /assertOwnedByUser/);

  for (const rel of [
    "app/api/documents/[id]/summary/route.js",
    "app/api/documents/[id]/transcribe/route.js",
    "app/api/documents/[id]/audio-select/route.js",
    "app/api/documents/[id]/download/route.js",
    "app/api/documents/artifacts/refine/route.js",
    "app/api/documents/artifacts/[id]/approve/route.js",
    "app/api/documents/artifacts/[id]/download/route.js"
  ]) {
    const src = read(rel);
    assert.match(src, /findFirst\(/, `${rel} should owner-scope its fetch`);
    assert.doesNotMatch(src, /assertOwnedByUser/, `${rel} should no longer assert ownership with a 403`);
  }
});

test("store-fetched routes convert the ownership-fail branch to the resource's own 404", () => {
  const research = read("app/api/research/jobs/[id]/route.js");
  assert.match(research, /assertResearchAccess[\s\S]{0,160}research\.error\.not_found/);
  assert.doesNotMatch(research, /api\.common\.forbidden/);

  const stream = read("app/api/research/jobs/[id]/stream/route.js");
  assert.match(stream, /assertResearchAccess[\s\S]{0,200}research\.error\.not_found/);
  assert.doesNotMatch(stream, /api\.common\.forbidden/);

  const meeting = read("app/api/documents/meeting-summary/jobs/[id]/route.js");
  assert.match(meeting, /assertMeetingSummaryAccess[\s\S]{0,220}meeting_summary\.not_found/);
  assert.doesNotMatch(meeting, /api\.common\.forbidden/);
});

// --- Contract 3: a generated draft is persisted immediately and idempotently. ---

test("generation persists a durable DRAFT (no transient result) and both entry points share the idempotent helper", () => {
  const generate = read("app/api/documents/artifacts/generate/route.js");
  assert.match(generate, /persistArtifactDraft/);
  assert.match(generate, /draft:\s*persisted\.artifact/, "the persisted artifact is returned to the workspace client as draft");
  assert.doesNotMatch(generate, /isTransient:\s*true/, "no transient, cost-losing draft is returned");

  const create = read("app/api/documents/artifacts/route.js");
  assert.match(create, /persistArtifactDraft/);

  const helper = read("lib/documents/persistDraft.js");
  assert.match(helper, /idempotencyKey/);
  assert.match(helper, /P2002/, "a concurrent retry with the same key resolves to the existing draft");
  assert.match(helper, /findFirst\(\{\s*where:\s*\{\s*ownerId:\s*userId,\s*idempotencyKey:\s*key\s*\}/);
});

// SOL-DOC-01. Järjekord ise on marsruudi kõige kergemini katkev omadus — ta elab ainult ridade
// järjestuses. Moodulitestid tõendavad reeglit, see siin tõendab, et marsruudid ka kasutavad
// teda: vana viga oli täpselt „genereerimine õnnestus" lipp, mis keelas hilisema vabastuse.
test("the three paid document routes settle usage through the shared paid-result order", () => {
  for (const rel of [
    "app/api/documents/artifacts/generate/route.js",
    "app/api/documents/artifacts/route.js",
    "app/api/documents/artifacts/refine/route.js"
  ]) {
    const src = read(rel);
    assert.match(src, /runPaidResult\(/, `${rel} must settle usage through lib/usage/paidResult`);
    assert.doesNotMatch(
      src,
      /generationCompleted|refinementCompleted/,
      `${rel} must not gate the release on a "work finished" flag`
    );
  }

  const refine = read("app/api/documents/artifacts/refine/route.js");
  assert.match(
    refine,
    /\$transaction\([\s\S]{0,400}documentAudit\.create[\s\S]{0,200}commitUsageForRequest\(handle,\s*\{\s*tx\s*\}\)/,
    "the mandatory refine audit row and the charge must land in one transaction"
  );
});

// --- Contract 5: deep research survives soft navigation; only an explicit Stop cancels it. ---

test("the chat stream hook cancels the durable job only on explicit stop, never on soft detach", () => {
  const hook = read("components/chat/hooks/useChatStream.js");
  assert.match(hook, /const teardownLocalStream = useCallback/);
  assert.match(hook, /const detach = useCallback\(\(\) => \{\s*teardownLocalStream\(\);/);
  // The DELETE (cancel) lives only in stop, and stop still exists.
  assert.match(hook, /const stop = useCallback[\s\S]*?method:\s*"DELETE"[\s\S]*?teardownLocalStream\(\);/);
  // detach must not issue the cancel: the only DELETE in the file is inside stop.
  assert.equal((hook.match(/method:\s*"DELETE"/g) || []).length, 1, "there is exactly one DELETE (the explicit stop)");
  assert.match(hook, /detach\s*\n?\s*\};\s*\}/, "detach is returned from the hook");
});

test("ChatBody leaves the research job running on unmount and conversation switch", () => {
  const chatBody = read("components/alalehed/ChatBody.jsx");
  assert.match(chatBody, /detach:\s*detachChatStream/);
  // Unmount cleanup detaches (was stop()).
  assert.match(chatBody, /return \(\) => \{\s*detach\(\);\s*\};\s*\}, \[detach\]\)/);
  // Fresh conversation / soft-nav detaches too.
  assert.match(chatBody, /detach\(\);\s*setErrorBanner\(null\)/);
});
