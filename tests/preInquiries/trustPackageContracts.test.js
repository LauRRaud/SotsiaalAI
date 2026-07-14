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
  assert.doesNotMatch(schema, /enum PreInquiryStatus[\s\S]*RECALLED/);
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
  assert.match(room, /markRecipientOpened/);
  assert.match(room, /openedAt: null[\s\S]*recalledAt: null[\s\S]*data: \{ openedAt: new Date\(\) \}/);
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
  assert.doesNotMatch(component, /\sanchorBack(?:\s|\/>)/);
  assert.match(component, /overlayClassName=\{styles\.modalOverlay\}/);
});
