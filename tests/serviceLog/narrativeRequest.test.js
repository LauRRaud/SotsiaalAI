import assert from "node:assert/strict";
import test from "node:test";
import {
  isCurrentNarrativeRequest,
  narrativeRequestFingerprint
} from "../../lib/serviceLog/narrativeRequest.js";

test("A vastus ei tohi pärast B valimist B vormi muuta", () => {
  const a = narrativeRequestFingerprint({ referralId: "A", month: "2026-08" });
  const b = narrativeRequestFingerprint({ referralId: "B", month: "2026-08" });
  assert.equal(
    isCurrentNarrativeRequest({
      requestId: 1,
      activeRequestId: 2,
      fingerprint: a,
      activeFingerprint: b
    }),
    false
  );
});

test("B vastus jääb kehtima ka siis, kui A lahendub hiljem", () => {
  const b = narrativeRequestFingerprint({ referralId: "B", month: "2026-08" });
  assert.equal(
    isCurrentNarrativeRequest({
      requestId: 2,
      activeRequestId: 2,
      fingerprint: b,
      activeFingerprint: b
    }),
    true
  );
});

test("sama referral eri kuus ei ole sama vorm", () => {
  assert.notEqual(
    narrativeRequestFingerprint({ referralId: "A", month: "2026-08" }),
    narrativeRequestFingerprint({ referralId: "A", month: "2026-09" })
  );
});
