import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";

function read(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("call service supports covision audio context without recording", () => {
  const service = read("lib/calls/service.js");

  assert.match(service, /CALL_CONTEXT_COVISION\s*=\s*"COVISION"/);
  assert.match(service, /startContextCall/);
  assert.match(service, /CALL_CONTEXT_COVISION/);
  assert.match(service, /contextType/);
  assert.match(service, /recordingAllowed:\s*call\.contextType !== CALL_CONTEXT_COVISION/);
  assert.match(service, /call\.recording_not_allowed/);
});

test("covision call UI hides recording consent controls", () => {
  const callBar = read("components/rooms/RoomCallBar.jsx");
  const covisionPage = read("components/covision/CovisionPage.jsx");

  assert.match(callBar, /recordingAllowed/);
  assert.match(callBar, /allowRecordingControls/);
  assert.match(covisionPage, /allowRecordingControls=\{false\}/);
  assert.match(covisionPage, /recordingAllowed=\{false\}/);
  assert.doesNotMatch(covisionPage, /Taotle salvestamise n(?:õ|Ćµ)usolekut/);
});

test("covision call routes use contextType COVISION", () => {
  const routes = [
    "app/api/covision/[id]/calls/route.js",
    "app/api/covision/[id]/calls/start/route.js",
    "app/api/covision/[id]/calls/join/route.js"
  ].map(read).join("\n");

  assert.match(routes, /requireCovisionCallAccess/);
  assert.match(routes, /getContextCall\(\{ contextType: "COVISION"/);
  assert.match(routes, /startContextCall\(\{ contextType: "COVISION"/);
  assert.doesNotMatch(routes, /recording\/request/);
});
