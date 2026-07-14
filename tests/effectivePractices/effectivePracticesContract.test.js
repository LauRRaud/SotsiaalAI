import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("schema models explicit capabilities, immutable reviews, assignments, versions and application assignees", async () => {
  const schema = await read("prisma/schema.prisma");
  assert.match(schema, /model PracticeCapability[\s\S]*@@unique\(\[userId, type, scope\]\)/);
  assert.match(schema, /model EffectivePracticeReview[\s\S]*conflictStatus[\s\S]*authorFeedback[\s\S]*privateNotes/);
  assert.match(schema, /model EffectivePracticeReviewAssignment[\s\S]*contentVersion[\s\S]*status/);
  assert.match(schema, /model EffectivePracticeVersion[\s\S]*publicSnapshot\s+Json/);
  const applicationModel = schema.match(/model EffectivePracticeApplication \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(applicationModel, /practiceSnapshot\s+Json/);
  assert.match(applicationModel, /assignedReviewerId\s+String\?/);
  assert.match(applicationModel, /assignedCapabilityType\s+PracticeCapabilityType\?/);
});

test("historical practice actors survive account deletion anonymously", async () => {
  const schema = await read("prisma/schema.prisma");
  for (const pattern of [
    /authorId\s+String\?[\s\S]*EffectivePracticeAuthor[\s\S]*onDelete: SetNull/,
    /model EffectivePracticeReview[\s\S]*reviewerId\s+String\?[\s\S]*EffectivePracticeReviewer[\s\S]*onDelete: SetNull/,
    /model EffectivePracticeReviewAssignment[\s\S]*reviewerId\s+String\?[\s\S]*EffectivePracticeReviewAssignee[\s\S]*onDelete: SetNull/,
    /model EffectivePracticeVersion[\s\S]*publishedById\s+String\?[\s\S]*onDelete: SetNull/,
    /model PracticeCapabilityAudit[\s\S]*actorUserId\s+String\?[\s\S]*onDelete: SetNull/,
    /model EffectivePracticeAuditEvent[\s\S]*actorId\s+String\?[\s\S]*onDelete: SetNull/
  ]) assert.match(schema, pattern);
  const migration = await read("prisma/migrations/20260714170000_effective_practice_workflow/migration.sql");
  assert.match(migration, /ALTER COLUMN "authorId" DROP NOT NULL/);
  assert.match(migration, /EffectivePractice_authorId_fkey[\s\S]*ON DELETE SET NULL/);
  assert.doesNotMatch(migration, /EffectivePracticeReview_reviewerId_fkey"[\s\S]{0,140}ON DELETE CASCADE/);
});

test("account deletion removes never-published private candidates before anonymising the user", async () => {
  const service = await read("lib/privacy/userDeletion.js");
  const practiceCleanup = await read("lib/privacy/effectivePracticeAccountCleanup.js");
  const orchestrator = await read("lib/privacy/userDeletionOrchestrator.js");
  assert.match(practiceCleanup, /scrubOrDeleteEffectivePracticesTx[\s\S]*!practice\.publishedVersion[\s\S]*effectivePractice\.deleteMany/);
  assert.match(practiceCleanup, /practiceScrubData[\s\S]*authorId: null[\s\S]*background: null[\s\S]*sourceCovisionCaseId: null/);
  assert.match(practiceCleanup, /RAG_DELETE[\s\S]*author_account_deleted/);
  assert.match(practiceCleanup, /FOR UPDATE[\s\S]*scrubOrDeleteEffectivePracticesTx[\s\S]*user\.delete/);
  assert.match(service, /deletePrivatePracticeCandidates: userId => scrubOrDeleteEffectivePracticesPure/);
  assert.match(orchestrator, /await deletePrivatePracticeCandidates\(targetUserId\)[\s\S]*await deleteUser\(targetUserId\)/);
});

test("legacy practice rows are quarantined and their RAG references enter the durable deletion queue", async () => {
  const migration = await read("prisma/migrations/20260714171000_effective_practice_legacy_quarantine/migration.sql");
  assert.match(migration, /INSERT INTO "DataDeletionJob"/);
  assert.match(migration, /'RAG_DELETE'/);
  assert.match(migration, /"status" = 'NEEDS_CHANGES'/);
  assert.match(migration, /WHERE "status" IN \('PUBLISHED', 'REVIEW', 'ANONYMITY_CHECK'\)/);
  assert.match(migration, /"publishedVersion" = NULL/);
  assert.match(migration, /'effective-practice::' \|\| ep\."id"/);
  assert.doesNotMatch(migration, /ep\."ragSourceId" IS NOT NULL\s+AND ep\."status"/);
});

test("RAG removal uses the platform deletion-job retry path and blocks publication while unresolved", async () => {
  const service = await read("lib/effectivePractices.js");
  assert.match(service, /dataDeletionJob\.create[\s\S]*action: "RAG_DELETE"[\s\S]*resourceType: "EffectivePractice"/);
  assert.match(service, /result\?\.ok === false/);
  assert.match(service, /status: \{ in: \["guard", "pending", "failed"\] \}/);
  assert.match(service, /publish_link_guard:v\$\{releaseVersion\}[\s\S]*status: "guard"/);
  const drain = await read("scripts/drain-effective-practice-rag-deletions.mjs");
  assert.match(drain, /status: "guard", createdAt: \{ lte: staleGuardBefore \}/);
  assert.match(drain, /staleReferences/);
  const deletionRetry = await read("lib/privacy/deletionJobRetryService.js");
  assert.match(deletionRetry, /resourceType === "EffectivePractice"[\s\S]*effectivePractice\.updateMany[\s\S]*ragSourceId: null/);
  const rag = await read("lib/documents/ragService.js");
  assert.match(rag, /error\?\.status === 404[\s\S]*ok: true, missing: true/);
  const retry = await read("lib/privacy/deletionJobRetryService.js");
  assert.match(retry, /job\.action === "RAG_DELETE"[\s\S]*actions\.deleteRag/);
});

test("all mutation routes use shared authentication and safe public error mapping", async () => {
  const [routes, service] = await Promise.all([
    Promise.all([
    "app/api/effective-practices/route.js",
    "app/api/effective-practices/[id]/route.js",
    "app/api/effective-practices/[id]/actions/route.js",
    "app/api/effective-practices/[id]/applications/route.js",
    "app/api/effective-practices/applications/[id]/actions/route.js",
    "app/api/effective-practices/capabilities/route.js"
    ].map(read)),
    read("lib/effectivePractices.js")
  ]);
  for (const source of routes) {
    assert.match(source, /requireEffectivePracticeAuth/);
    assert.match(source, /effectivePracticeErrorResponse/);
    assert.doesNotMatch(source, /error\.message\s*[},]/);
  }
  assert.match(service, /"api\.common\.unauthorized":\s*401/);
});

test("client exposes evidence fields, versioned actions, conflict separation and assigned application review", async () => {
  const source = await read("components/covision/EffectivePracticesPage.jsx");
  assert.match(source, /learningPoints/);
  assert.match(source, /sources/);
  assert.match(source, /ownerConfirmedNoIdentifiers: false/);
  assert.match(source, /conflictStatus/);
  assert.match(source, /authorFeedback/);
  assert.match(source, /privateNotes/);
  assert.match(source, /assignedCapabilityType/);
  assert.match(source, /action: "RESUBMIT"/);
  assert.match(source, /expectedVersion/);
  assert.match(source, /aria-label=\{m\(t, "effective_practices\.search_label"/);
  for (const field of ["targetGroups", "environments", "expectedOutcome", "learningPoints", "sources", "background", "mainChallenge", "whatHelped", "networkOrServiceRole"]) {
    assert.match(source, new RegExp(`practice\\.${field}`));
  }
  assert.match(source, /application\.needsReview/);
  assert.match(source, /application\.followUpAt/);
  assert.match(source, /action: "re_review"/);
  assert.match(source, /action: "archive"/);
});

test("detail, editor and mutation lifecycles cannot revive a closed or switched modal", async () => {
  const source = await read("components/covision/EffectivePracticesPage.jsx");
  assert.match(source, /parseEffectivePracticeView\(window\.location\.search\)/);
  assert.match(source, /EFFECTIVE_PRACTICE_HISTORY_KEY/);
  assert.match(source, /\{ kind: "editor", id: String\(value\?\.id \|\| ""\)\.trim\(\) \}/);
  assert.match(source, /window\.addEventListener\("popstate", syncFromLocation\)/);
  assert.match(source, /mutationRequestGateRef\.current\.begin\(viewKey\)/);
  assert.match(source, /effectivePracticeViewKey\(activeViewRef\.current\) !== viewKey/);
  assert.match(source, /openDetail\(practiceId, \{ history: "none" \}\)/);
  assert.match(source, /openDetail\(savedId, \{ history: "none" \}\)/);
  assert.doesNotMatch(source, /await openDetail\(selected\.practice\.id\)/);
  assert.match(source, /function LoadingDialog[\s\S]*useModalFocusTrap\(dialogRef\)/);
  assert.match(source, /aria-modal="true"[\s\S]*autoFocus onClick=\{onClose\}/);
});

test("admin does not receive a candidate creation affordance before or after capability load", async () => {
  const source = await read("components/covision/EffectivePracticesPage.jsx");
  assert.match(source, /capabilities: \{ canCreate: false/);
  assert.match(source, /const canViewOwnWork = workspace\.capabilities\.canCreate \|\| workspace\.myApplications\.length > 0/);
  assert.match(source, /canViewOwnWork \? \[\["candidates"/);
  assert.match(source, /tab === "candidates" && workspace\.capabilities\.canCreate/);
});

test("effective-practice UI has a dedicated responsive and reduced-motion visual layer", async () => {
  const [globals, css] = await Promise.all([
    read("app/styles/globals.css"),
    read("app/styles/effective-practices.css")
  ]);
  assert.match(globals, /effective-practices\.css/);
  assert.match(css, /\.epp-shell/);
  assert.match(css, /@media \(max-width: 620px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.epp-shell \{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\)/);
  assert.match(css, /\.epp-sidebar \{[^}]*grid-row:\s*1/);
  assert.match(css, /\.epp-main \{\s*grid-row:\s*2/);
  assert.match(css, /@media \(max-width: 900px\)[\s\S]*\.epp-sidebar \{[^}]*max-width:\s*100vw[^}]*overflow:\s*hidden/);
  assert.match(css, /\.epp-sidebar nav\s*\{[\s\S]*max-width:\s*100%[\s\S]*display:\s*flex[\s\S]*overflow-x:\s*auto[\s\S]*scroll-snap-type:\s*x proximity/);
  assert.match(css, /\.epp-sidebar nav a\s*\{[\s\S]*flex:\s*0 0 auto[\s\S]*white-space:\s*nowrap[\s\S]*scroll-snap-align:\s*start/);
});

test("all three locales contain the same effective-practices message tree", async () => {
  const [et, en, ru] = await Promise.all(["et", "en", "ru"].map(async (locale) => (
    JSON.parse(await read(`messages/${locale}.json`)).effective_practices
  )));
  const keys = (value, prefix = "") => Object.entries(value).flatMap(([key, item]) => (
    item && typeof item === "object" ? keys(item, `${prefix}${key}.`) : `${prefix}${key}`
  )).sort();
  assert.deepEqual(keys(en), keys(et));
  assert.deepEqual(keys(ru), keys(et));
});
