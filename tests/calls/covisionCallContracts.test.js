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

  assert.match(callBar, /recordingAllowed/);
  assert.match(callBar, /allowRecordingControls/);
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

test("covision call serialization maps account ids to opaque call participant ids", () => {
  const service = read("lib/calls/service.js");

  assert.match(service, /const isCovision = call\.contextType === CALL_CONTEXT_COVISION/);
  assert.match(service, /participantIdForUser/);
  assert.match(service, /startedByParticipantId/);
  assert.match(service, /participantId:\s*participantIdForUser\(request\.userId\)/);
  assert.match(service, /resolvedByParticipantId/);
  assert.match(service, /!isCovision \? \{ userId: participant\.userId \} : \{\}/);
  assert.doesNotMatch(service, /entry\?\.user\?\.email\s*\|\|\s*entry\?\.email/);
});

test("every activity-creating covision call route rechecks terminal state under the shared lock", () => {
  const mutatingRoutes = [
    "app/api/covision/[id]/calls/start/route.js",
    "app/api/covision/[id]/calls/join/route.js",
    "app/api/covision/[id]/calls/[callSessionId]/mute/route.js",
    "app/api/covision/[id]/calls/[callSessionId]/speak-requests/route.js",
    "app/api/covision/[id]/calls/[callSessionId]/speak-requests/[requestId]/resolve/route.js"
  ];
  for (const path of mutatingRoutes) {
    assert.match(read(path), /withCovisionCallMutation\(/, path);
  }
  const lifecycle = read("lib/calls/covisionLifecycle.js");
  assert.match(lifecycle, /pg_advisory_xact_lock/);
  assert.match(lifecycle, /covisionSession:/);
  assert.match(lifecycle, /isCovisionCaseTerminal\(covisionCase\)/);
});

test("terminal call reads are empty while leave, end and cancel recheck under the shared lock", () => {
  assert.match(read("app/api/covision/[id]/calls/route.js"), /access\.terminal[\s\S]*call:\s*null/);
  for (const path of [
    "app/api/covision/[id]/calls/end/route.js",
    "app/api/covision/[id]/calls/leave/route.js",
    "app/api/covision/[id]/calls/[callSessionId]/speak-requests/me/route.js"
  ]) {
    assert.match(read(path), /allowTerminal:\s*true/);
    assert.match(read(path), /withCovisionCallMutation\(/);
    assert.match(read(path), /onTerminal:/);
  }
});
