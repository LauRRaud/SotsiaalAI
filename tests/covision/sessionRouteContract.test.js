import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const startRoute = read("app/api/topic-seeds/[id]/covision/route.js");
const sessionRoute = read("app/api/covision/[id]/session/route.js");
const actionRoute = read("app/api/covision/[id]/session/actions/route.js");
const legacyCollectionRoute = read("app/api/covision/route.js");
const preInquiryCreateRoute = read("app/api/pre-inquiries/[id]/covision/route.js");
const legacyCovisionService = read("lib/covision.js");

test("new Kovisioon routes are authenticated and delegate to the DI service", () => {
  for (const source of [startRoute, sessionRoute, actionRoute]) {
    assert.match(source, /requireCovisionAuth\(\)/);
    assert.match(source, /covisionSessionPublicError\(error\)/);
    assert.doesNotMatch(source, /error\?\.message\s*\|\||error\.message\s*\|\|/);
  }
  assert.match(startRoute, /startCovisionFromTopicSeed\(/);
  assert.match(startRoute, /assertCovisionCreator\(auth\)/);
  assert.match(sessionRoute, /getCovisionSessionForUser\(/);
  assert.match(actionRoute, /applyCovisionSessionAction\(/);
  assert.match(sessionRoute, /userId:\s*auth\.userId,\s*email:\s*auth\.email/);
  assert.match(actionRoute, /userId:\s*auth\.userId,\s*email:\s*auth\.email/);
});

test("both write routes use the strict shared JSON parser", () => {
  assert.match(startRoute, /parseCovisionSessionJsonBody\(request\)/);
  assert.match(actionRoute, /parseCovisionSessionJsonBody\(request\)/);
  assert.doesNotMatch(sessionRoute, /\.update\(|\.create\(|\.upsert\(/);
});

test("session GET has no invite-accept or other mutation side effect", () => {
  assert.match(sessionRoute, /export async function GET/);
  assert.doesNotMatch(sessionRoute, /ACCEPTED|inviteStatus|PATCH|POST/);
});

test("legacy case GET no longer accepts an invitation as a read side effect", () => {
  const detailGetter = legacyCovisionService.slice(
    legacyCovisionService.indexOf("async function findVisibleCovisionCase"),
    legacyCovisionService.indexOf("async function withCovisionLegacyWriteLock")
  );
  assert.match(detailGetter, /covisionCase\.findFirst/);
  assert.doesNotMatch(detailGetter, /covisionParticipant\.update|inviteStatus:\s*"ACCEPTED"/);
});

test("every public case-creation route applies the creator-role gate", () => {
  assert.match(startRoute, /assertCovisionCreator\(auth\)/);
  const createHandler = legacyCollectionRoute.match(/export async function POST[\s\S]*?\n\}/)?.[0] || "";
  assert.match(createHandler, /assertCovisionCreator\(auth\)/);
  assert.match(preInquiryCreateRoute, /assertCovisionCreator\(auth\)/);
  const preInquiryHandler = preInquiryCreateRoute.slice(preInquiryCreateRoute.indexOf("export async function POST"));
  assert.ok(preInquiryHandler.indexOf("assertCovisionCreator(auth)")
    < preInquiryHandler.indexOf("const inquiry = await getVisiblePreInquiry"));
});

test("actions route returns only the role-filtered service snapshot", () => {
  assert.match(actionRoute, /return json\(\{ ok: true, \.\.\.session \}\)/);
  assert.doesNotMatch(actionRoute, /request\.json\(\)/);
});
