import assert from "node:assert/strict";
import test from "node:test";
import { isExpectedSessionInvalidationError } from "../../lib/auth/session-errors.js";

test("expected revoked JWT sessions are not treated as reportable auth logger errors", () => {
  assert.equal(
    isExpectedSessionInvalidationError("JWT_SESSION_ERROR", {
      error: new Error("SESSION_REVOKED")
    }),
    true
  );
  assert.equal(
    isExpectedSessionInvalidationError("JWT_SESSION_ERROR", {
      error: { cause: new Error("SESSION_USER_MISSING") }
    }),
    true
  );
});

test("unexpected JWT session errors are still reportable", () => {
  assert.equal(
    isExpectedSessionInvalidationError("JWT_SESSION_ERROR", {
      error: new Error("DATABASE_DOWN")
    }),
    false
  );
  assert.equal(
    isExpectedSessionInvalidationError("SESSION_ERROR", {
      error: new Error("SESSION_REVOKED")
    }),
    false
  );
});
