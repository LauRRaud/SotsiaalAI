import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

test("Prisma schema includes private user-owned wellbeing records for workflow data", () => {
  assert.match(schema, /wellbeingRecords\s+WellbeingRecord\[\]/);
  assert.match(schema, /model WellbeingRecord\s*\{/);
  assert.match(schema, /ownerUserId\s+String/);
  assert.match(schema, /workflowType\s+String/);
  assert.match(schema, /standardizedFields\s+Json/);
  assert.match(schema, /computedSignal\s+Json/);
  assert.match(schema, /visibility\s+String\s+@default\("private"\)/);
  assert.match(schema, /aggregationEligible\s+Boolean\s+@default\(true\)/);
  assert.match(schema, /@@index\(\[ownerUserId,\s*workflowType,\s*createdAt\]\)/);
});

test("Prisma schema includes user-controlled wellbeing output drafts", () => {
  assert.match(schema, /wellbeingOutputDrafts\s+WellbeingOutputDraft\[\]/);
  assert.match(schema, /model WellbeingOutputDraft\s*\{/);
  assert.match(schema, /userId\s+String/);
  assert.match(schema, /sourceWorkflowType\s+String/);
  assert.match(schema, /sourceRecordId\s+String\?/);
  assert.match(schema, /outputType\s+String/);
  assert.match(schema, /recipientType\s+String/);
  assert.match(schema, /generatedText\s+String\s+@db\.Text/);
  assert.match(schema, /editedText\s+String\?\s+@db\.Text/);
  assert.match(schema, /userReviewed\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /userConfirmed\s+Boolean\s+@default\(false\)/);
  assert.match(schema, /visibility\s+String\s+@default\("private"\)/);
  assert.match(schema, /status\s+String\s+@default\("draft"\)/);
  assert.match(schema, /@@index\(\[userId,\s*outputType,\s*createdAt\]\)/);
});
