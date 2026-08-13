import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

async function source(path) {
  return readFile(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("schema and migration preserve history without adding a status enum value", async () => {
  const [schema, migration] = await Promise.all([
    source("prisma/schema.prisma"),
    source("prisma/migrations/20260714220000_pre_inquiry_recall_and_correction/migration.sql")
  ]);

  assert.match(schema, /openedAt\s+DateTime\?/);
  assert.match(schema, /recalledAt\s+DateTime\?/);
  assert.match(schema, /supersededById\s+String\?\s+@unique/);
  assert.match(schema, /@relation\("PreInquirySupersession"/);
  /* Invariant: tagasivõtmine on AJATEMPEL (`recalledAt`), mitte staatus —
     `PreInquiryStatus` ei tohi kanda `RECALLED` väärtust.
     Regex on T25 viilus B kitsendatud enumi KEHALE (`\{[^}]*\}`): varasem
     `[\s\S]*` luges üle terve faili ja kukkus kohe, kui mõni HILISEM enum
     sisaldas sõna RECALLED (`OrganizationInboxStatus`). Kontrollitav
     invariant on sama, valepositiivi enam ei ole. */
  assert.doesNotMatch(schema, /enum PreInquiryStatus \{[^}]*RECALLED/);
  assert.match(migration, /WHERE "status" = 'SENT'::"PreInquiryStatus"[\s\S]*AND "sentAt" IS NULL/);
  assert.doesNotMatch(migration, /WHERE "status" (?:<>|!=) 'SENT'/);
  assert.match(migration, /ON DELETE SET NULL/);
});

test("mutation routes authenticate before reading bodies and expose only allowlisted errors", async () => {
  for (const path of [
    "app/api/pre-inquiries/[id]/recall/route.js",
    "app/api/pre-inquiries/[id]/corrections/route.js"
  ]) {
    const route = await source(path);
    const authIndex = route.indexOf("if (!userId)");
    const bodyIndex = route.indexOf("request.json()");
    assert.ok(authIndex > -1 && bodyIndex > authIndex, `${path} must authenticate before body parsing`);
    assert.match(route, /const PUBLIC_ERRORS = new Set/);
    assert.match(route, /safeError\(error\)/);
    assert.doesNotMatch(route, /errorJson\(error\.message/);
  }

  const acceptRoute = await source("app/api/pre-inquiries/[id]/accept/route.js");
  assert.match(acceptRoute, /const PUBLIC_ERRORS = new Set/);
  assert.match(acceptRoute, /PUBLIC_ERRORS\.has\(error\?\.message\)/);
  assert.match(acceptRoute, /safeError\(error\)/);
  assert.doesNotMatch(acceptRoute, /status < 500 \? error\.message/);
});

test("receiver UI does not offer acceptance for an archived workflow", async () => {
  const workspace = await source("components/workspace/WorkspaceFeaturePage.jsx");
  assert.match(workspace, /\["READY", "ARCHIVED"\]\.includes\(inquiry\?\.status\)/);
  assert.match(workspace, /\["READY", "ARCHIVED"\]\.includes\(inquiry\.status\)/);
});

test("all trust mutations share the pre-inquiry advisory lock", async () => {
  const preInquiries = await source("lib/preInquiries.js");
  for (const functionName of [
    "recallPreInquiry",
    "acceptPreInquiry",
    "sendPreInquiryCorrection",
    "updatePreInquiryReceiverWorkflow"
  ]) {
    const start = preInquiries.indexOf(`export async function ${functionName}`);
    assert.ok(start > -1, `${functionName} exists`);
    const nextExport = preInquiries.indexOf("export async function ", start + 22);
    const body = preInquiries.slice(start, nextExport === -1 ? undefined : nextExport);
    assert.match(body, /withPreInquiryRoomLock\(/, `${functionName} uses the shared lock`);
  }
  const room = await source("lib/rooms/preInquiryRoom.js");
  assert.match(preInquiries, /recallPreInquiry[\s\S]*findPreInquiryCanonicalRoom\(fresh\.id, \{ db: tx \}\)/);
  assert.match(room, /fresh\.status !== "READY" \|\| !fresh\.openedAt/);
  assert.doesNotMatch(room, /data: \{ openedAt: new Date\(\) \}/);
  assert.match(room, /if \(fresh\.recalledAt\)/);
});

test("My sharings page is linked from profile and uses the single aggregate endpoint", async () => {
  const [profile, page, component] = await Promise.all([
    source("components/alalehed/ProfiilBody.jsx"),
    source("app/minu-jagamised/page.jsx"),
    source("components/sharings/MySharingsPage.jsx")
  ]);
  assert.match(profile, /navigateFromOrbit\("\/minu-jagamised"\)/);
  assert.match(page, /<MySharingsPage\s*\/>/);
  assert.match(component, /fetch\("\/api\/my-sharings"/);
  assert.match(component, /aria-live="polite"/);
  assert.match(component, /expectedUpdatedAt/);
  assert.match(component, /privacyDecision/);
  assert.match(component, /mutationInFlightRef\.current/);
  assert.match(component, /if \(!action \|\| mutationInFlightRef\.current\) return/);
  assert.match(component, /if \(!correction \|\| mutationInFlightRef\.current\) return/);
  /* Väli käib 03.08 alates platvormi Input-komponendi kaudu. Kontrakt on
     sama: parandust saatva päringu ajal on ta kinni. */
  assert.match(component, /<Input disabled=\{Boolean\(busyKey\)\}/);
  assert.match(component, /<textarea required disabled=\{Boolean\(busyKey\)\}/);
  assert.doesNotMatch(component, /\sanchorBack(?:\s|\/>)/);
  assert.match(component, /overlayClassName=\{styles\.modalOverlay\}/);
  assert.match(component, /if \(confirmAction\) return;[\s\S]*feedbackRef\.current\?\.focus/);
  assert.match(component, /className=\{styles\.modalError\} role="alert"/);
  assert.match(component, /role=\{actionError && !confirmAction \? "alert" : "status"\}/);
  assert.match(component, /\{confirmAction \? feedback : actionError \|\| feedback\}/);
  assert.match(component, /preserveData = false/);
  assert.match(component, /if \(!preserveData\) setLoadError\(""\)/);
  assert.match(component, /loadSharings\(\{ preserveData: true \}\)/);
  assert.match(component, /my_sharings\.errors\.refresh_failed/);
  assert.match(component, /const openConfirmAction = useCallback\([\s\S]*resetMessages\(\);[\s\S]*setConfirmAction\(action\)/);
  assert.match(component, /onClick=\{\(\) => openConfirmAction\(\{ kind: "recall", item \}\)\}/);
});

test("post-open edit and correction errors have ET, EN and RU translations", async () => {
  const messages = await Promise.all(
    ["et", "en", "ru"].map(async (locale) => JSON.parse(await source(`messages/${locale}.json`)))
  );

  for (const catalog of messages) {
    assert.ok(catalog.pre_inquiries.errors.opened_cannot_be_edited);
    assert.ok(catalog.pre_inquiries.errors.situation_required);
    assert.ok(catalog.my_sharings.errors.refresh_failed);
  }
});
