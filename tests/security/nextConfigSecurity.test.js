import test from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../../next.config.mjs";

test("Next production config exposes source maps for PageSpeed diagnostics", () => {
  assert.equal(nextConfig.productionBrowserSourceMaps, true);
  assert.equal(nextConfig.poweredByHeader, false);
});

test("Next production headers include transport and clickjacking protections", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";

  try {
    const rules = await nextConfig.headers();
    const globalRule = rules.find((rule) => rule.source === "/:path*");
    assert.ok(globalRule);

    const headers = new Map(globalRule.headers.map(({ key, value }) => [key.toLowerCase(), value]));
    assert.equal(headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains; preload");
    assert.equal(headers.get("x-frame-options"), "DENY");
    assert.equal(headers.get("content-security-policy"), "frame-ancestors 'none'");
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});
