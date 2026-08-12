import test from "node:test";
import assert from "node:assert/strict";
import { fetchServiceMapTile, parseServiceMapTileCoordinates } from "../../lib/serviceMap/tileProxy.js";

test("tile coordinates are bounded before the provider request", () => {
  assert.deepEqual(parseServiceMapTileCoordinates({ z: "8", x: "128", y: "127" }), { z: 8, x: 128, y: 127 });
  assert.equal(parseServiceMapTileCoordinates({ z: "7", x: "1", y: "1" }), null);
  assert.equal(parseServiceMapTileCoordinates({ z: "8", x: "256", y: "1" }), null);
});

test("tile proxy sends only fixed headers and returns a bounded png", async () => {
  let captured;
  const result = await fetchServiceMapTile({ z: 8, x: 128, y: 127 }, {
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return new Response(Uint8Array.from([137, 80, 78, 71]), { headers: { "Content-Type": "image/png", "Set-Cookie": "secret=1" } });
    }
  });
  assert.equal(result.ok, true);
  assert.match(captured.url, /\/8\/128\/127\.png&ASUTUS=SOTSIAALAI/);
  assert.deepEqual(captured.options.headers, { Accept: "image/png", "User-Agent": "SotsiaalAI-ServiceMap-Proxy/1.0" });
  assert.equal(captured.options.redirect, "error");
});

test("tile proxy rejects provider errors, wrong mime and oversized bodies", async () => {
  assert.deepEqual(await fetchServiceMapTile({ z: 8, x: 1, y: 1 }, { fetchImpl: async () => new Response("no", { status: 404 }) }), { ok: false, status: 502 });
  assert.deepEqual(await fetchServiceMapTile({ z: 8, x: 1, y: 1 }, { fetchImpl: async () => new Response("secret", { headers: { "Content-Type": "text/plain" } }) }), { ok: false, status: 502 });
  const tooLarge = new Uint8Array(2 * 1024 * 1024 + 1);
  assert.deepEqual(await fetchServiceMapTile({ z: 8, x: 1, y: 1 }, { fetchImpl: async () => new Response(tooLarge, { headers: { "Content-Type": "image/png" } }) }), { ok: false, status: 502 });
});
