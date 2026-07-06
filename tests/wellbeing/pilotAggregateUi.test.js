import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("wellbeing pilot page is session gated and uses pilot access policy", () => {
  const source = read("app/tooheaolu/piloot/page.jsx");

  assert.match(source, /getServerSession\(authConfig\)/);
  assert.match(source, /callbackUrl:\s*localizePath\("\/tooheaolu\/piloot"/);
  assert.match(source, /resolveWellbeingPilotAccess/);
  assert.match(source, /<WellbeingPilotClient/);
});

test("wellbeing pilot client uses scoped pilot API and privacy copy", () => {
  const source = read("app/tooheaolu/piloot/WellbeingPilotClient.jsx");

  assert.match(source, /\/api\/wellbeing\/pilot\/aggregate/);
  assert.doesNotMatch(source, /\/api\/admin\/wellbeing\/aggregate/);
  assert.match(source, /allowedRoleGroups/);
  assert.match(source, /KOV piloodi koondvaade/);
  assert.match(source, /Piloodi aruanne/);
  assert.match(source, /Töökorralduslikud prioriteedid/);
  assert.match(source, /Soovitatavad kokkulepped/);
  assert.match(source, /Prindivaade/);
  assert.match(source, /XLSX/);
  assert.match(source, /format:\s*"report-html"/);
  assert.match(source, /format:\s*"xlsx"/);
  assert.match(source, /üksiktöötajate vastuseid/);
  assert.match(source, /format:\s*"csv"/);
});

test("wellbeing pilot aggregate API uses pilot access instead of admin access", () => {
  const source = read("app/api/wellbeing/pilot/aggregate/route.js");

  assert.match(source, /resolveWellbeingPilotAccess/);
  assert.match(source, /resolveWellbeingPilotAggregateFilters/);
  assert.match(source, /buildWellbeingPilotReport/);
  assert.match(source, /exportWellbeingPilotReportHtml/);
  assert.match(source, /exportWellbeingPilotReportXlsx/);
  assert.match(source, /format === "report-html"/);
  assert.match(source, /format === "xlsx"/);
  assert.doesNotMatch(source, /assertAdmin/);
  assert.match(source, /exportWellbeingCsv/);
});
