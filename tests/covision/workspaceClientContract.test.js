import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const pageSource = fs.readFileSync(
  path.join(root, "components", "covision", "CovisionPage.jsx"),
  "utf8"
);
const workspaceSource = fs.readFileSync(
  path.join(root, "components", "covision", "CovisionWorkspace.jsx"),
  "utf8"
);
const workspaceStyles = fs.readFileSync(
  path.join(root, "app", "styles", "covision-workspace.css"),
  "utf8"
);

test("production Kovisioon entry mounts the real workspace, not the legacy demo", () => {
  assert.match(pageSource, /CovisionWorkspace/);
  assert.doesNotMatch(pageSource, /CovisionSession/);
  assert.doesNotMatch(workspaceSource, /DEMO_|setInterval\([^)]*setStage|Demo vaade/);
});

test("workspace uses the real case, Topic Seed and versioned session APIs", () => {
  assert.match(workspaceSource, /fetch\("\/api\/covision"/);
  assert.match(workspaceSource, /fetch\("\/api\/topic-seeds"/);
  assert.match(workspaceSource, /\/api\/topic-seeds\/\$\{encodeURIComponent\(seed\.id\)\}\/covision/);
  assert.match(workspaceSource, /\/api\/covision\/\$\{encodeURIComponent\(caseId\)\}\/session\/actions/);
  assert.match(workspaceSource, /expectedVersion/);
});

test("session reads and writes are abortable and cannot cross a case switch", () => {
  assert.match(workspaceSource, /sessionRequestGateRef\.current\.begin\(normalizedId\)/);
  assert.match(workspaceSource, /actionRequestGateRef\.current\.begin\(caseId\)/);
  assert.match(workspaceSource, /const caseId = selectedCaseId;[\s\S]*sessionRequestGateRef\.current\.invalidate\(\);[\s\S]*actionRequestGateRef\.current\.begin\(caseId\)/);
  assert.match(workspaceSource, /signal: request\.signal/);
  assert.match(workspaceSource, /!request\.isCurrent\(\) \|\| selectedRef\.current !== normalizedId/);
  assert.match(workspaceSource, /!request\.isCurrent\(\) \|\| selectedRef\.current !== caseId/);
  assert.match(workspaceSource, /finally \{[\s\S]*request\.isCurrent\(\)/);
  assert.match(workspaceSource, /quiet && actingRef\.current && !allowDuringAction/);
  assert.match(workspaceSource, /quiet: true, allowDuringAction: true/);
});

test("case chooser and long live sessions scroll inside the full-screen canvas", () => {
  assert.match(workspaceStyles, /\.cvw\s*\{[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/);
  assert.match(workspaceStyles, /\.cvw-session-wrap\s*\{[\s\S]*height:\s*100%[\s\S]*overflow:\s*hidden/);
});

test("workspace requires an explicit case choice and exposes all four main destinations", () => {
  assert.match(workspaceSource, /readCaseIdFromLocation/);
  assert.doesNotMatch(workspaceSource, /activeCases\[0\]/);
  assert.match(workspaceSource, /href="\/kovisioon"/);
  assert.match(workspaceSource, /href="\/teemaseemned"/);
  assert.match(workspaceSource, /href="\/lopetatud-juhtumid"/);
  assert.match(workspaceSource, /href="\/parimad-praktikad"/);
});

test("workspace follows browser history and respects server create capability", () => {
  assert.match(workspaceSource, /window\.addEventListener\("popstate", onPopState\)/);
  assert.match(workspaceSource, /setSelectedCaseId\(readCaseIdFromLocation\(\)\)/);
  assert.match(workspaceSource, /workspace\.capabilities\?\.canCreate !== false/);
  assert.match(workspaceSource, /covision\.workspace\.queue\.invite_only/);
});

test("workspace never reads the mutable Topic Seed body when a frozen card exists", () => {
  assert.match(workspaceSource, /const shared = seed\.sharedCardSnapshot \|\| \{\}/);
  assert.match(workspaceSource, /shared\.title \|\| seed\.title/);
  assert.match(workspaceSource, /shared\.whyNow \|\| seed\.whyNow/);
});
