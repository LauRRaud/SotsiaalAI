import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

/**
 * Doc ptk 4.10 is an absolute contract, so this test does not grep the source:
 * it executes public/sw.js in a fake worker global and drives real fetch
 * events through it. A regression that starts caching /api/ has to make the
 * worker actually do it, and that is what is asserted here.
 */

const SW_SOURCE = readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8");
const ORIGIN = "https://sotsiaalai.test";

class FakeResponse {
  constructor(body = "", init = {}) {
    this.body = body;
    this.status = init.status ?? 200;
    this.headers = init.headers ?? {};
    this.ok = this.status >= 200 && this.status < 300;
  }

  clone() {
    return new FakeResponse(this.body, { status: this.status, headers: this.headers });
  }
}

function loadWorker({ networkFails = false } = {}) {
  const listeners = new Map();
  const calls = { cacheOpens: [], cachePuts: [], cacheMatches: [], fetches: [], deletedCaches: [] };
  const cacheStore = new Map();

  const makeCache = (name) => ({
    async match(request) {
      calls.cacheMatches.push({ name, url: typeof request === "string" ? request : request.url });
      const bucket = cacheStore.get(name) || new Map();
      return bucket.get(typeof request === "string" ? request : request.url) || undefined;
    },
    async put(request, response) {
      const url = typeof request === "string" ? request : request.url;
      calls.cachePuts.push({ name, url });
      if (!cacheStore.has(name)) cacheStore.set(name, new Map());
      cacheStore.get(name).set(url, response);
    }
  });

  const sandbox = {
    console,
    URL,
    Response: FakeResponse,
    self: {
      location: { origin: ORIGIN },
      addEventListener(type, handler) {
        listeners.set(type, handler);
      },
      skipWaiting() {},
      clients: { async claim() {} }
    },
    caches: {
      async open(name) {
        calls.cacheOpens.push(name);
        return makeCache(name);
      },
      async keys() {
        return ["field-static-obsolete", "field-shell-obsolete", ...cacheStore.keys()];
      },
      async delete(name) {
        calls.deletedCaches.push(name);
        return true;
      }
    },
    async fetch(request) {
      calls.fetches.push(typeof request === "string" ? request : request.url);
      if (networkFails) throw new Error("offline");
      return new FakeResponse("network", { status: 200 });
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(SW_SOURCE, sandbox, { filename: "sw.js" });
  return { listeners, calls, sandbox, cacheStore };
}

async function dispatchFetch(worker, { url, mode = "no-cors", method = "GET" }) {
  const handler = worker.listeners.get("fetch");
  assert.ok(handler, "service worker registers a fetch listener");
  const request = { url, mode, method, clone: () => request };
  let responded = null;
  handler({
    request,
    respondWith(promise) {
      responded = promise;
    },
    waitUntil() {}
  });
  return responded ? { handled: true, response: await responded } : { handled: false, response: null };
}

test("no /api/ request is ever handled by the worker, in any request mode", async () => {
  const worker = loadWorker();

  // Every mode matters: without the guard a "navigate"-mode API request falls
  // into the generic navigation branch and gets answered with the offline HTML
  // shell instead of the real API error.
  for (const path of [
    "/api/field/visits",
    "/api/field/visits/visit-1",
    "/api/field/visits/visit-1/items/fld-note-1",
    "/api/documents/doc-1",
    "/api/auth/session"
  ]) {
    for (const mode of ["no-cors", "cors", "same-origin", "navigate"]) {
      const result = await dispatchFetch(worker, { url: `${ORIGIN}${path}`, mode });
      // Falling through means the worker never calls respondWith: the request
      // goes straight to the network and no cache layer sees it.
      assert.equal(result.handled, false, `${path} (mode=${mode}) must fall through to the network`);
    }
  }

  assert.deepEqual(worker.calls.cacheOpens, [], "no cache was opened for an /api/ request");
  assert.deepEqual(worker.calls.cachePuts, [], "no /api/ response was written to a cache");
  assert.deepEqual(worker.calls.cacheMatches, [], "no /api/ response was read from a cache");
});

test("an offline /api/ request never receives the offline HTML shell as a fake answer", async () => {
  const worker = loadWorker({ networkFails: true });

  const result = await dispatchFetch(worker, { url: `${ORIGIN}/api/field/visits`, mode: "navigate" });

  assert.equal(result.handled, false, "the sync layer must see a real network failure, not HTML");
  assert.deepEqual(worker.calls.cachePuts, []);
});

test("static shell assets are cached, so the field view survives going offline", async () => {
  const worker = loadWorker();

  const asset = await dispatchFetch(worker, { url: `${ORIGIN}/_next/static/chunk.js` });

  assert.equal(asset.handled, true);
  assert.equal(worker.calls.cachePuts.length, 1);
  assert.match(worker.calls.cachePuts[0].name, /^field-static-/);
});

test("an offline /valitoo navigation serves the shell, never a blank failure", async () => {
  const online = loadWorker();
  await dispatchFetch(online, { url: `${ORIGIN}/valitoo`, mode: "navigate" });
  assert.equal(online.calls.cachePuts.length, 1, "the successful navigation is cached for later");

  const offline = loadWorker({ networkFails: true });
  const result = await dispatchFetch(offline, { url: `${ORIGIN}/valitoo`, mode: "navigate" });

  assert.equal(result.handled, true);
  assert.equal(result.response.status, 200);
  assert.match(result.response.body, /Oled võrguta/);
  assert.match(result.response.body, /\/valitoo/);
});

test("cross-origin and non-GET requests are left entirely alone", async () => {
  const worker = loadWorker();

  const crossOrigin = await dispatchFetch(worker, { url: "https://elsewhere.test/_next/static/chunk.js" });
  assert.equal(crossOrigin.handled, false);

  const post = await dispatchFetch(worker, { url: `${ORIGIN}/valitoo`, mode: "navigate", method: "POST" });
  assert.equal(post.handled, false);

  assert.deepEqual(worker.calls.cachePuts, []);
});

test("the worker is a shell, not a data channel: no background sync or push listeners", async () => {
  const worker = loadWorker();

  assert.equal(worker.listeners.has("sync"), false);
  assert.equal(worker.listeners.has("periodicsync"), false);
  assert.equal(worker.listeners.has("push"), false);
  assert.equal(worker.listeners.has("backgroundfetchsuccess"), false);
});

test("activation drops caches from older worker versions", async () => {
  const worker = loadWorker();
  const activate = worker.listeners.get("activate");
  assert.ok(activate);

  let pending = null;
  activate({ waitUntil(promise) { pending = promise; } });
  await pending;

  assert.deepEqual(worker.calls.deletedCaches, ["field-static-obsolete", "field-shell-obsolete"]);
});

test("the shell only swaps when the page says syncing is idle", async () => {
  const worker = loadWorker();
  const message = worker.listeners.get("message");
  assert.ok(message, "worker listens for the page's SKIP_WAITING handshake");

  let skipped = 0;
  worker.sandbox.self.skipWaiting = () => { skipped += 1; };

  message({ data: "SOMETHING_ELSE" });
  assert.equal(skipped, 0, "an unrelated message must not swap the shell mid-sync");

  message({ data: "SKIP_WAITING" });
  assert.equal(skipped, 1);
});
