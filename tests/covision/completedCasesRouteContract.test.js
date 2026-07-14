import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (path) => readFileSync(join(root, path), "utf8");
const routes = {
  close: read("app/api/covision/[id]/close/route.js"),
  list: read("app/api/covision/completed/route.js"),
  detail: read("app/api/covision/completed/[id]/route.js"),
  followUp: read("app/api/covision/completed/[id]/follow-up/route.js"),
  decision: read("app/api/covision/completed/[id]/decision/route.js"),
  archive: read("app/api/covision/completed/[id]/archive/route.js")
};

test("all completed-case routes authenticate and use the fixed public error mapper", () => {
  for (const source of Object.values(routes)) {
    assert.match(source, /requireCovisionAuth\(\)/);
    assert.match(source, /covisionCompletedCasePublicError\(error\)/);
    assert.doesNotMatch(source, /error\?\.message\s*\|\||error\.message\s*\|\|/);
  }
});

test("writes use strict parser and expected service boundary", () => {
  for (const key of ["close", "followUp", "decision", "archive"]) {
    assert.match(routes[key], /parseCompletedCaseJsonBody\(request\)/);
  }
  assert.match(routes.close, /closeCovisionCase\(/);
  assert.match(routes.followUp, /updateCompletedCaseFollowUp\(/);
  assert.match(routes.decision, /decideCompletedCase\(/);
  assert.match(routes.archive, /archiveCompletedCase\(/);
});

test("read routes cannot mutate persistence", () => {
  for (const key of ["list", "detail"]) {
    assert.match(routes[key], /export async function GET/);
    assert.doesNotMatch(routes[key], /\.create\(|\.update\(|\.delete\(|\.upsert\(/);
  }
});
