import test from "node:test";
import assert from "node:assert/strict";

import { computeIpFromHeaders } from "../../lib/auth/pin-login.js";
import { getRequestIp } from "../../lib/request-ip.js";

test("request IP helper prefers proxy-overwritten X-Real-IP over client-controlled XFF", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 198.51.100.20",
    "x-real-ip": "198.51.100.20"
  });

  assert.equal(getRequestIp(headers), "198.51.100.20");
});

test("request IP helper falls back to first XFF value when X-Real-IP is absent", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 198.51.100.20"
  });

  assert.equal(getRequestIp(headers), "203.0.113.10");
});

test("PIN login IP helper prefers X-Real-IP over client-controlled XFF", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 198.51.100.20",
    "x-real-ip": "198.51.100.20"
  });

  assert.equal(computeIpFromHeaders(headers), "198.51.100.20");
});
