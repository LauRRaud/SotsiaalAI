import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("root layout loads the Cloudflare Web Analytics beacon for sotsiaal.ai", async () => {
  const layout = await readFile(new URL("../app/layout.js", import.meta.url), "utf8");

  assert.match(layout, /static\.cloudflareinsights\.com\/beacon\.min\.js/);
  assert.match(layout, /data-cf-beacon/);
  assert.match(layout, /86bf2928d0f44110b9f188ce8d0c28a9/);
});
