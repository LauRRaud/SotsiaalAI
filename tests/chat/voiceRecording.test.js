import { register } from "node:module";
import test from "node:test";
import assert from "node:assert/strict";

register(new URL("./serverOnlyTestLoader.mjs", import.meta.url), import.meta.url);

const { classifyMicError, MAX_RECORDING_MS, RECORDING_WARNING_MS } = await import("../../components/chat/hooks/useSpeech.js");

// T03 E4: microphone error states are distinguishable, not one generic "cannot start".
test("classifyMicError separates permission, device, unsupported and technical failures", () => {
  assert.equal(classifyMicError({ name: "NotAllowedError" }), "permission");
  assert.equal(classifyMicError({ name: "SecurityError" }), "permission");
  assert.equal(classifyMicError({ name: "PermissionDeniedError" }), "permission");
  assert.equal(classifyMicError({ name: "NotFoundError" }), "no_device");
  assert.equal(classifyMicError({ name: "DevicesNotFoundError" }), "no_device");
  assert.equal(classifyMicError({ message: "UNSUPPORTED_RECORDING" }), "unsupported");
  assert.equal(classifyMicError({ name: "AbortError" }), "technical");
  assert.equal(classifyMicError({}), "technical");
  assert.equal(classifyMicError(null), "technical");
});

test("the recording soft limit is 2.5 minutes with an earlier warning", () => {
  assert.equal(MAX_RECORDING_MS, 150_000);
  assert.ok(RECORDING_WARNING_MS < MAX_RECORDING_MS);
  assert.equal(RECORDING_WARNING_MS, 130_000);
});
