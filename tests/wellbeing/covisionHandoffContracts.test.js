import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function read(...segments) {
  return readFileSync(path.join(root, ...segments), "utf8");
}

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `Missing start marker: ${startMarker}`);
  assert.notEqual(end, -1, `Missing end marker after ${startMarker}: ${endMarker}`);
  return source.slice(start, end);
}

const schema = read("prisma", "schema.prisma");
const migration = read(
  "prisma",
  "migrations",
  "20260714203000_wellbeing_covision_handoff",
  "migration.sql"
);
const route = read(
  "app",
  "api",
  "wellbeing",
  "output-drafts",
  "[id]",
  "covision",
  "route.js"
);
const draftRoute = read(
  "app",
  "api",
  "wellbeing",
  "output-drafts",
  "[id]",
  "route.js"
);
const handoffService = read("lib", "wellbeing", "covisionHandoff.js");
const supportPanel = read("components", "wellbeing", "SupportRequestPanel.jsx");
const overview = read("components", "wellbeing", "OverviewWorkflow.jsx");
const liveSession = read("components", "covision", "CovisionLiveSession.jsx");

test("wellbeing draft and Covision case have a nullable one-to-one SetNull relation", () => {
  const draftModel = between(schema, "model WellbeingOutputDraft {", "\n}");
  const caseModel = between(schema, "model CovisionCase {", "\n}");

  assert.match(draftModel, /covisionCaseId\s+String\?\s+@unique/);
  assert.match(
    draftModel,
    /covisionCase\s+CovisionCase\?\s+@relation\("WellbeingOutputDraftCovisionCase",\s*fields:\s*\[covisionCaseId\],\s*references:\s*\[id\],\s*onDelete:\s*SetNull\)/
  );
  assert.match(
    caseModel,
    /sourceWellbeingOutputDraft\s+WellbeingOutputDraft\?\s+@relation\("WellbeingOutputDraftCovisionCase"\)/
  );
});

test("handoff migration adds a nullable unique FK with ON DELETE SET NULL", () => {
  const addColumns = between(
    migration,
    'ALTER TABLE "WellbeingOutputDraft"',
    ";"
  );

  assert.match(addColumns, /ADD COLUMN "covisionCaseId" TEXT/);
  assert.doesNotMatch(addColumns, /NOT NULL/);
  assert.match(
    migration,
    /CREATE UNIQUE INDEX "WellbeingOutputDraft_covisionCaseId_key"\s+ON "WellbeingOutputDraft"\("covisionCaseId"\)/
  );
  assert.match(
    migration,
    /FOREIGN KEY \("covisionCaseId"\) REFERENCES "CovisionCase"\("id"\)\s+ON DELETE SET NULL ON UPDATE CASCADE/
  );
});

test("Covision handoff route authenticates before parsing or calling the service", () => {
  const authIndex = route.indexOf("await requireWellbeingApiUser(request)");
  const normalizeIndex = route.indexOf("normalizeWellbeingCovisionHandoffRequest(");
  const serviceIndex = route.indexOf("await startCovisionFromWellbeingDraft(");

  assert.ok(authIndex >= 0, "route must authenticate through the shared wellbeing guard");
  assert.ok(normalizeIndex > authIndex, "request body must not be parsed before authentication");
  assert.ok(serviceIndex > normalizeIndex, "service must receive only normalized input");
  assert.match(route, /if \(!auth\.ok\) return auth\.response/);
});

test("handoff request normalization is strict and public errors are allowlisted", () => {
  const normalizer = between(
    handoffService,
    "export function normalizeWellbeingCovisionHandoffRequest(input)",
    "export function wellbeingCovisionHandoffPublicError(error)"
  );
  const publicError = between(
    handoffService,
    "export function wellbeingCovisionHandoffPublicError(error)",
    "function finalDraftText"
  );

  assert.match(normalizer, /isPlainObject\(input\)/);
  assert.match(normalizer, /Object\.keys\(input\)/);
  assert.match(handoffService, /HANDOFF_REQUEST_KEYS\s*=\s*new Set\(\["expectedUpdatedAt",\s*"confirmedNoIdentifiers"\]\)/);
  assert.match(normalizer, /HANDOFF_REQUEST_KEYS\.has\(key\)/);
  assert.match(normalizer, /confirmedNoIdentifiers\s*!==\s*true/);
  assert.match(normalizer, /typeof input\.expectedUpdatedAt === "string"/);
  assert.match(normalizer, /parsedExpectedUpdatedAt\.toISOString\(\) !== expectedUpdatedAt/);

  assert.match(publicError, /PUBLIC_ERRORS\[messageKey\]/);
  assert.match(publicError, /Number\(error\?\.status\) === status/);
  assert.match(
    publicError,
    /messageKey:\s*"wellbeing\.errors\.covision_handoff_failed",\s*status:\s*500/
  );
  assert.match(route, /wellbeingCovisionHandoffPublicError\(error\)/);
  assert.match(route, /message:\s*messageKey/);
  assert.doesNotMatch(route, /message:\s*error\?\.message/);
});

test("SupportRequestPanel sends only the handoff contract and navigates to the exact created case", () => {
  const startCovision = between(
    supportPanel,
    "async function startCovision()",
    "  return ("
  );

  assert.match(
    startCovision,
    /`\/api\/wellbeing\/output-drafts\/\$\{encodeURIComponent\(draft\.id\)\}\/covision`/
  );
  assert.match(
    startCovision,
    /body:\s*JSON\.stringify\(\{\s*expectedUpdatedAt:\s*draft\.updatedAt,\s*confirmedNoIdentifiers:\s*true\s*\}\)/
  );
  assert.doesNotMatch(startCovision, /editedText|generatedText|preview|sourceRecordId/);
  assert.match(
    startCovision,
    /const href = `\/kovisioon\?case=\$\{encodeURIComponent\(payload\.covisionCaseId\)\}`/
  );
  assert.match(startCovision, /onNavigate\(href\)/);
  assert.match(startCovision, /window\.location\.assign\(href\)/);
  assert.doesNotMatch(supportPanel, /onNavigate\?\.\(["']\/kovisioon["']\)/);
});

test("both wellbeing confirmation callers submit their saved draft fingerprint", () => {
  const supportConfirm = between(
    supportPanel,
    "async function confirmDraft()",
    "async function startCovision()"
  );
  const overviewConfirm = between(
    overview,
    "async function confirmManagerMemoDraft()",
    "  return ("
  );

  for (const source of [supportConfirm, overviewConfirm]) {
    assert.match(source, /method:\s*"PATCH"/);
    assert.match(source, /expectedUpdatedAt:\s*draft\.updatedAt/);
    assert.match(source, /textToConfirm/);
  }
  assert.match(supportConfirm, /setEditedText\(String\(payload\.draft\?\.editedText \|\| payload\.draft\?\.generatedText \|\| ""\)\)/);
});

test("draft edits reset attestations and save the current text back to the same row", () => {
  const supportChange = between(
    supportPanel,
    "function changeEditedText(value)",
    "function chooseOption(option)"
  );
  const supportSave = between(
    supportPanel,
    "async function saveDraft()",
    "async function confirmDraft()"
  );
  const overviewSave = between(
    overview,
    "async function saveManagerMemoDraft()",
    "async function confirmManagerMemoDraft()"
  );

  for (const source of [supportChange, overview]) {
    assert.match(source, /setUserReviewed\(false\)/);
    assert.match(source, /setUserConfirmed\(false\)/);
  }
  for (const source of [supportSave, overviewSave]) {
    assert.match(source, /method:\s*draft\?\.id \? "PUT" : "POST"/);
    assert.match(source, /editedText:\s*textToSave/);
    assert.match(source, /expectedUpdatedAt:\s*draft\.updatedAt/);
  }
  assert.match(overviewSave, /generatedText:\s*textToSave/);
  assert.doesNotMatch(overviewSave, /generatedText:\s*managerMemo\.text/);
  assert.match(supportPanel, /const isBusy = status === "saving" \|\| status === "starting_covision"/);
  assert.match(supportPanel, /disabled=\{isBusy/);
  assert.match(supportPanel, /t\(option\.labelKey, option\.labelFallback\)/);
});

test("output draft PUT authenticates and performs versioned owner-scoped saving", () => {
  const putHandler = between(
    draftRoute,
    "export async function PUT(request, context)",
    "\n}"
  );
  const authIndex = putHandler.indexOf("await requireWellbeingApiUser(request)");
  const serviceIndex = putHandler.indexOf("await saveWellbeingOutputDraftForUser(");
  assert.ok(authIndex >= 0);
  assert.ok(serviceIndex > authIndex);
  assert.match(putHandler, /wellbeingOutputDraftSavePublicError\(error\)/);
  assert.doesNotMatch(putHandler, /message:\s*error\?\.message/);
});

test("Covision stage two exposes the owner-private case anchor only as an editable prefill", () => {
  const prefillHook = between(
    liveSession,
    "const caseAnchorPrefill = useMemo(() =>",
    "const serverOnlyPrivacyReview"
  );
  const composerSetup = between(
    liveSession,
    "function Composer(",
    "if (!canWrite || stage === 1"
  );

  assert.match(prefillHook, /!isOwner \|\| stage !== 2/);
  assert.match(prefillHook, /items\.some\(\(item\) => item\.kind === "case_anchor"\)/);
  assert.match(prefillHook, /stateByKind\(privateStates,\s*"case_anchor"\)/);
  assert.doesNotMatch(prefillHook, /dispatchAction|submitWorkItem/);
  assert.match(liveSession, /prefillText=\{caseAnchorPrefill\}/);
  assert.match(composerSetup, /prefillText\s*=\s*""/);
  assert.match(composerSetup, /useState\(stage === 2 \? prefillText : ""\)/);
  assert.match(composerSetup, /stage === 2 && Boolean\(prefillText\.trim\(\)\)\) \? "private" : "shared"/);
  assert.match(liveSession, /modeTouchedRef\.current/);
  assert.match(liveSession, /setText\(\(current\) => current\.trim\(\) \? current : prefillText\)/);
  assert.doesNotMatch(composerSetup, /ACTIONS\.|await dispatchAction/);
});

test("handoff persists a private case anchor and never auto-creates shared work", () => {
  assert.match(
    handoffService,
    /tx\.covisionPrivateState\.create\(\{[\s\S]*?stage:\s*2,[\s\S]*?kind:\s*"case_anchor",[\s\S]*?content:\s*\{ text:\s*prefillText \}/
  );
  assert.doesNotMatch(handoffService, /covisionWorkItem\.(?:create|upsert)/);
  assert.doesNotMatch(handoffService, /visibility:\s*"shared"/);
  assert.doesNotMatch(handoffService, /SUBMIT_WORK_ITEM|submitWorkItem/);
});
