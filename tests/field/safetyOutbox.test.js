import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import {
  buildFieldSafetyEscalationEmail,
  buildFieldSafetyResolvedEmail
} from "../../lib/field/safety.js";

const SOURCE = fs.readFileSync(new URL("../../lib/field/safety.js", import.meta.url), "utf8");

test("safety mail payload stays minimal and contains no visit content", () => {
  const visit = {
    id: "visit-1",
    goal: "DO NOT LEAK GOAL",
    locationText: "DO NOT LEAK ADDRESS",
    safetyContactName: "Kontakt",
    safetyDeadlineAt: new Date("2026-08-13T20:00:00.000Z"),
    safetyInstructions: "Helista töötajale."
  };
  const escalation = buildFieldSafetyEscalationEmail({ visit, workerName: "Töötaja" });
  const resolved = buildFieldSafetyResolvedEmail({ visit, workerName: "Töötaja" });
  assert.doesNotMatch(`${escalation.text}\n${resolved.text}`, /DO NOT LEAK/u);
  assert.match(escalation.text, /Helista töötajale\./u);
});

test("resolved timestamp is reconciled from outbox SENT, never claimed before SMTP", () => {
  assert.match(SOURCE, /enqueuePaymentEmail/u);
  assert.match(SOURCE, /runPaymentEmailDelivery/u);
  assert.match(SOURCE, /status === "SENT" \? \{ safetyResolvedNotifiedAt:/u);
  assert.doesNotMatch(SOURCE, /where: \{ id: visit\.id, safetyResolvedNotifiedAt: null \},\s*data: \{ safetyResolvedNotifiedAt: now \}/u);
  assert.match(SOURCE, /status === "AMBIGUOUS" \|\| status === "SENDING"/u);
  assert.match(SOURCE, /safetyResolvedNoticeStatus: "FAILED"/u);
});
