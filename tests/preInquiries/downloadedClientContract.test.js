import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// A3 Sol round 2, point 3: cheap SOURCE-CONTRACT regression tests. There is no
// DOM/component harness in this repo, so the pure-helper tests cannot prove the
// handlers are actually wired. These assert the wiring in the component source so
// a future refactor cannot silently unhook the download-marking flow.

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(__dirname, "../../components/workspace/WorkspaceFeaturePage.jsx"),
  "utf8"
);

/** Returns the body of a top-level (2-space-indented) component method by name. */
function methodBody(name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `expected ${name} to be defined`);
  const rest = source.slice(start + marker.length);
  const next = rest.search(/\n {2}(?:async )?function /);
  return next === -1 ? rest : rest.slice(0, next);
}

test("client: the saved-records list download button wires handleDownloadSavedInquiry", () => {
  assert.match(source, /onClick=\{\(\) => handleDownloadSavedInquiry\(inquiry\)\}/);
});

test("client: the author marking flow POSTs to /downloaded with expectedUpdatedAt", () => {
  const body = methodBody("markSavedInquiryDownloaded");
  assert.match(body, /\/pre-inquiries\/\$\{encodeURIComponent\(inquiryId\)\}\/downloaded/);
  assert.match(body, /method:\s*"POST"/);
  assert.match(body, /expectedUpdatedAt/);
});

test("client: both download handlers route their marking through markSavedInquiryDownloaded", () => {
  assert.match(methodBody("handleDownload"), /markSavedInquiryDownloaded\(saved\)/);
  assert.match(methodBody("handleDownloadSavedInquiry"), /markSavedInquiryDownloaded\(inquiry\)/);
});

test("client: the recipient download never triggers the marking flow (semantics #8)", () => {
  const body = methodBody("handleDownloadReceivedInquiry");
  assert.doesNotMatch(body, /markSavedInquiryDownloaded/);
  assert.doesNotMatch(body, /\/downloaded/);
});
