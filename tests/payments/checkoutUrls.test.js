import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { resolveCheckoutUrl } from "../../lib/payments/checkoutUrls.js";

test("payment callback URLs use only the configured canonical public origin", () => {
  const url = resolveCheckoutUrl("", "/api/subscription/callback", {
    requestUrl: "http://localhost:3000/api/subscription/init",
    headers: new Headers({
      host: "attacker.invalid",
      "x-forwarded-host": "attacker.invalid",
      "x-forwarded-proto": "https"
    }),
    canonicalUrl: "https://sotsiaal.ai"
  });

  assert.equal(url, "https://sotsiaal.ai/api/subscription/callback");
});

test("payment-specific absolute HTTPS URL remains authoritative", () => {
  const url = resolveCheckoutUrl(
    "https://payments.sotsiaal.ai/return",
    "/api/subscription/callback",
    { canonicalUrl: "https://sotsiaal.ai" }
  );

  assert.equal(url, "https://payments.sotsiaal.ai/return");
});

test("unsafe schemes and missing production configuration fail closed", () => {
  assert.equal(
    resolveCheckoutUrl("javascript:alert(1)", "/api/subscription/callback", {
      canonicalUrl: "ftp://sotsiaal.ai",
      nodeEnv: "production"
    }),
    ""
  );
});

test("local development keeps a localhost fallback without trusting headers", () => {
  assert.equal(
    resolveCheckoutUrl("", "/api/subscription/callback", {
      nodeEnv: "development"
    }),
    "http://localhost:3000/api/subscription/callback"
  );
});

test("both checkout init routes use the header-independent resolver", () => {
  for (const relativePath of [
    "../../app/api/subscription/init/route.js",
    "../../app/api/invites/sponsored/init/route.js"
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /resolveCheckoutUrl\(/u);
    assert.doesNotMatch(source, /x-forwarded-host|x-forwarded-proto|get\(\s*["']host["']\s*\)/u);
  }
});
