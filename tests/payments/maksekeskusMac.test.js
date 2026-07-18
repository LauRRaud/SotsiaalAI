import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { verifyMaksekeskusMac } from "../../lib/payments/maksekeskus.js";

const SECRET = "shared-secret-key";
const JSON_TEXT = '{"reference":"mk_ref_1","status":"PAID"}';

function macFor(jsonText, secret) {
  return crypto.createHash("sha512").update(`${jsonText}${secret}`).digest("hex").toUpperCase();
}

test("valid MAC verifies", () => {
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, macFor(JSON_TEXT, SECRET), SECRET), true);
});

test("empty/unconfigured secret fails closed (L-02)", () => {
  const anyMac = macFor(JSON_TEXT, SECRET);
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, anyMac, ""), false);
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, anyMac, "   "), false);
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, anyMac, undefined), false);
});

test("wrong MAC is rejected", () => {
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, macFor(JSON_TEXT, "other-secret"), SECRET), false);
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, "DEADBEEF", SECRET), false);
  assert.equal(verifyMaksekeskusMac(JSON_TEXT, "", SECRET), false);
});

test("tampered payload is rejected", () => {
  const mac = macFor(JSON_TEXT, SECRET);
  assert.equal(verifyMaksekeskusMac('{"reference":"mk_ref_1","status":"REFUNDED"}', mac, SECRET), false);
});
