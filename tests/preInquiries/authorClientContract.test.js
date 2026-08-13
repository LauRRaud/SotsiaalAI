import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const component = readFileSync(resolve(root, "components/workspace/WorkspaceFeaturePage.jsx"), "utf8");
const roomRoute = readFileSync(resolve(root, "app/api/pre-inquiries/[id]/room/route.js"), "utf8");
const sendRoute = readFileSync(resolve(root, "app/api/pre-inquiries/[id]/send/route.js"), "utf8");

test("author edit and archive send the exact visible updatedAt fingerprint", () => {
  assert.match(component, /expectedUpdatedAt:\s*activeInquiry\?\.updatedAt/u);
  assert.match(component, /status:\s*"ARCHIVED"[\s\S]*?expectedUpdatedAt:\s*inquiry\.updatedAt/u);
});

test("ARCHIVED list rows expose reopen instead of edit", () => {
  assert.match(component, /inquiry\.status === "ARCHIVED"[\s\S]*?handleReopenAuthoredInquiry/u);
  assert.doesNotMatch(component, /<Button[^>]+onClick=\{\(\) => handleOpenInquiry\(inquiry\)\}[^>]*>[\s\S]{0,180}?actions\.edit[\s\S]{0,180}?<\/Button>[\s\S]{0,180}?inquiry\.status === "ARCHIVED"/u);
});

test("room route has no swallowed post-creation inquiry update", () => {
  assert.doesNotMatch(roomRoute, /prisma\.preInquiry\.update/u);
  assert.doesNotMatch(roomRoute, /preInquiry\.update[\s\S]{0,240}?\.catch\(\(\) => null\)/u);
});

test("external send route records explicit confirmation input instead of invoking SMTP", () => {
  assert.match(sendRoute, /expectedUpdatedAt/u);
  assert.match(sendRoute, /confirmExternalPreInquirySent/u);
  assert.doesNotMatch(sendRoute, /sendExternalPreInquiry/u);
});

test("external confirmation opens mailto from the persisted inquiry snapshot", () => {
  assert.match(component, /activeInquiryMailto[\s\S]*?activeInquiry\.selectedRecipientEmail/u);
  assert.match(component, /href=\{activeInquiryMailto \|\| selectedRecipientMailto\}/u);
  assert.match(component, /activeInquiryMailto && activeInquiry\.status !== "SENT"/u);
});
