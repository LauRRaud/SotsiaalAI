import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("KOV pilot view explains selected scope, period and decision report context", () => {
  const source = read("app/tooheaolu/piloot/WellbeingPilotClient.jsx");

  assert.match(source, /viewContext:\s*"Mida vaatan"/);
  assert.match(source, /selectedPilotScope\?\.municipalityId/);
  assert.match(source, /periodLabel/);
  assert.match(source, /scopeMeta/);
  assert.match(source, /decisionSummary/);
  assert.match(source, /primaryRecommendation/);
  assert.match(source, /decisionFocus/);
});

test("admin wellbeing pilot form supports dates, active status and viewer management", () => {
  const source = read("app/admin/wellbeing/AdminWellbeingClient.jsx");

  assert.match(source, /startsAt/);
  assert.match(source, /endsAt/);
  assert.match(source, /active/);
  assert.match(source, /selectedPilotScopeId/);
  assert.match(source, /addPilotViewer/);
  assert.match(source, /\/viewers/);
  assert.match(source, /Lisa vaataja/);
});

test("admin pilot viewer API is admin gated and appends viewers to an existing pilot", () => {
  const source = read("app/api/admin/wellbeing/pilots/[id]/viewers/route.js");

  assert.match(source, /export async function POST\(request,\s*context\)/);
  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /assertAdmin\(session\)/);
  assert.match(source, /addWellbeingPilotViewer/);
  assert.match(source, /"Cache-Control":\s*"no-store/);
});
