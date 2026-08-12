import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  ORG_CREATION_RATE_LIMIT,
  ORG_CREATION_RATE_WINDOW_MS,
  consumeOrganizationCreationLimit
} from "../../lib/org/creationRateLimit.js";

test("SOL-ORG-17: server rate limit is user-bound and optional trusted-IP-bound", () => {
  const calls = [];
  const consume = (key, limit, windowMs) => {
    calls.push({ key, limit, windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: 0 };
  };
  const result = consumeOrganizationCreationLimit(
    { userId: "user_1", trustedIp: "192.0.2.10" },
    { consume }
  );
  assert.equal(result.allowed, true);
  assert.deepEqual(calls, [
    {
      key: "org:create:user:user_1",
      limit: ORG_CREATION_RATE_LIMIT,
      windowMs: ORG_CREATION_RATE_WINDOW_MS
    },
    {
      key: "org:create:ip:192.0.2.10",
      limit: ORG_CREATION_RATE_LIMIT * 2,
      windowMs: ORG_CREATION_RATE_WINDOW_MS
    }
  ]);
});

test("SOL-ORG-17: a denied user bucket stops before the IP bucket", () => {
  const calls = [];
  const result = consumeOrganizationCreationLimit(
    { userId: "user_1", trustedIp: "192.0.2.10" },
    {
      consume: (key) => {
        calls.push(key);
        return { allowed: false, remaining: 0, retryAfterSec: 60 };
      }
    }
  );
  assert.equal(result.allowed, false);
  assert.deepEqual(calls, ["org:create:user:user_1"]);
});

test("SOL-ORG-17: UI reuses one clientActionId for an unchanged retry and route enforces the limiter", async () => {
  const [clientSource, routeSource] = await Promise.all([
    readFile(new URL("../../app/org/OrgHomeClient.jsx", import.meta.url), "utf8"),
    readFile(new URL("../../app/api/org/route.js", import.meta.url), "utf8")
  ]);
  assert.match(clientSource, /creationActionRef\.current\?\.fingerprint !== fingerprint/);
  assert.match(clientSource, /clientActionId = creationActionRef\.current\.id/);
  assert.match(routeSource, /consumeOrganizationCreationLimit/);
  assert.match(routeSource, /clientActionId: body\?\.clientActionId/);
});
