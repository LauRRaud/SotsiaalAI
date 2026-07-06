import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("quick-check API saves standardized wellbeing records through the service layer", () => {
  const source = `${read("app/api/wellbeing/quick-check/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createQuickCheckRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("wellbeing overview API reads the current user's private aggregate", () => {
  const source = `${read("app/api/wellbeing/overview/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function GET\(request\)/);
  assert.match(source, /buildWellbeingOverviewForUser\(auth\.userId/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /period:\s*requestUrl\.searchParams\.get\("period"\)/);
  assert.match(source, /periodStart:\s*requestUrl\.searchParams\.get\("periodStart"\)/);
  assert.match(source, /periodEnd:\s*requestUrl\.searchParams\.get\("periodEnd"\)/);
});

test("wellbeing output draft API keeps support requests user controlled", () => {
  const source = `${read("app/api/wellbeing/output-drafts/route.js")}\n${read("app/api/wellbeing/output-drafts/[id]/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function GET\(request\)/);
  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /export async function PATCH\(request,\s*context\)/);
  assert.match(source, /createWellbeingOutputDraftForUser\(auth\.userId,\s*body/);
  assert.match(source, /listWellbeingOutputDraftsForUser\(auth\.userId/);
  assert.match(source, /confirmWellbeingOutputDraftForUser\(auth\.userId/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("admin wellbeing aggregate API exposes suppressed JSON and CSV exports", () => {
  const source = read("app/api/admin/wellbeing/aggregate/route.js");

  assert.match(source, /export async function GET\(request\)/);
  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /assertAdmin\(session\)/);
  assert.match(source, /buildWellbeingExportDataset/);
  assert.match(source, /exportWellbeingCsv/);
  assert.match(source, /format\s*===\s*"csv"/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("recovery API saves the current user's private 72h recovery plan", () => {
  const source = `${read("app/api/wellbeing/recovery/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createRecoveryRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("work boundaries API saves the current user's private boundary agreement draft", () => {
  const source = `${read("app/api/wellbeing/work-boundaries/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createWorkBoundariesRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("hard case API saves the current user's private 24h aftercare plan", () => {
  const source = `${read("app/api/wellbeing/hard-case/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createHardCaseRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("workplace violence API saves the current user's private safety follow-up record", () => {
  const source = `${read("app/api/wellbeing/workplace-violence/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createWorkplaceViolenceRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("interruptions API saves the current user's private fragmentation diagnostic", () => {
  const source = `${read("app/api/wellbeing/interruptions/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createInterruptionsRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("work processes API saves the current user's private workflow audit", () => {
  const source = `${read("app/api/wellbeing/work-processes/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createWorkProcessesRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("role boundaries API saves the current user's private role clarification", () => {
  const source = `${read("app/api/wellbeing/role-boundaries/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createRoleBoundariesRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("starter support API saves the current user's private 100 day support plan", () => {
  const source = `${read("app/api/wellbeing/starter-support/route.js")}\n${read("app/api/wellbeing/_shared.js")}`;

  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /createStarterSupportRecordForUser\(auth\.userId,\s*body/);
  assert.match(source, /canUseWellbeingRole\(roleState\.effectiveRole,\s*Boolean\(roleState\.isAdmin\)\)/);
  assert.match(source, /requireSubscription\(session,\s*roleState\.effectiveRole\)/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});
