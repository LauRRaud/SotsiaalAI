import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { resolvePublicOrigin } from "../../lib/publicOrigin.js";

const PUBLIC_ORIGIN = "https://sotsiaal.ai";

async function withPublicOrigin(callback) {
  const previous = process.env.APP_URL;
  process.env.APP_URL = PUBLIC_ORIGIN;
  try {
    await callback();
  } finally {
    if (previous === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = previous;
  }
}

test("configured public origin wins over the callback request origin", async () => {
  await withPublicOrigin(() => {
    assert.equal(resolvePublicOrigin("https://attacker.example/api/callback"), PUBLIC_ORIGIN);
  });
});

test("payment callbacks use the shared configured-origin resolver, not forwarded headers", () => {
  for (const relativePath of [
    "../../app/api/subscription/callback/route.js",
    "../../app/api/invites/sponsored/callback/route.js",
  ]) {
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    assert.match(source, /import \{ resolvePublicOrigin \} from "@\/lib\/publicOrigin"/);
    assert.doesNotMatch(source, /x-forwarded-(?:host|proto)/);
  }
});
