import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("prisma schema stores persistent wellbeing pilot scopes and viewers", () => {
  const source = read("prisma/schema.prisma");

  assert.match(source, /model WellbeingPilotScope/);
  assert.match(source, /model WellbeingPilotViewer/);
  assert.match(source, /roleGroups\s+Json/);
  assert.match(source, /minimumGroupSize\s+Int\s+@default\(3\)/);
  assert.match(source, /viewers\s+WellbeingPilotViewer\[\]/);
  assert.match(source, /wellbeingPilotViewers\s+WellbeingPilotViewer\[\]/);
  assert.match(source, /@@index\(\[active,\s*scopeType\]\)/);
  assert.match(source, /@@unique\(\[pilotScopeId,\s*email\]\)/);
});

test("admin wellbeing pilot API is admin gated and exposes list/create operations", () => {
  const source = read("app/api/admin/wellbeing/pilots/route.js");

  assert.match(source, /export async function GET\(request\)/);
  assert.match(source, /export async function POST\(request\)/);
  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /assertAdmin\(session\)/);
  assert.match(source, /listWellbeingPilotScopes/);
  assert.match(source, /createWellbeingPilotScope/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});

test("wellbeing pilot API accepts pilotId and applies pilot-specific minimum group size", () => {
  const source = read("app/api/wellbeing/pilot/aggregate/route.js");

  assert.match(source, /pilotId:\s*url\.searchParams\.get\("pilotId"\)/);
  assert.match(source, /minimumGroupSize/);
  assert.match(source, /WELLBEING_MIN_GROUP_SIZE/);
  assert.match(source, /pilotScopes/);
});

test("pilot and admin wellbeing clients expose persistent pilot scope management", () => {
  const pilotSource = read("app/tooheaolu/piloot/WellbeingPilotClient.jsx");
  const pageSource = read("app/tooheaolu/piloot/page.jsx");
  const adminSource = read("app/admin/wellbeing/AdminWellbeingClient.jsx");

  assert.match(pageSource, /pilotScopes=\{access\.pilotScopes/);
  assert.match(pilotSource, /pilotScopes/);
  assert.match(pilotSource, /pilotId/);
  assert.match(pilotSource, /setPilotId/);
  assert.match(adminSource, /\/api\/admin\/wellbeing\/pilots/);
  assert.match(adminSource, /createPilotScope/);
  assert.match(adminSource, /viewerEmails/);
});
