import assert from "node:assert/strict";

import { GET } from "../../../app/api/service-map/entries/route.js";

function routeDeps(overrides = {}) {
  return {
    getSession: async () => ({ user: { id: "owner-1" } }),
    consumeRateLimit: () => ({ allowed: true }),
    loadServices: async () => ({ entries: [{ id: "service" }], page: { hasMore: false } }),
    loadPeerListings: async () => ({ entries: [{ id: "peer" }], page: { hasMore: false } }),
    ...overrides
  };
}

async function readResponse(requestUrl, deps) {
  const response = await GET(new Request(requestUrl, { headers: { "accept-language": "en" } }), deps);
  return { response, body: await response.json() };
}

const original = console.error;
const logs = [];
console.error = (...args) => logs.push(args);

try {
  let anonymousPeerCalls = 0;
  const anonymous = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    getSession: async () => null,
    loadPeerListings: async () => { anonymousPeerCalls += 1; return { entries: [{ id: "SECRET-peer" }] }; }
  }));
  assert.equal(anonymous.response.status, 200);
  assert.equal(anonymousPeerCalls, 0);
  assert.equal(anonymous.body.peerListingsAvailable, false);
  assert.equal(anonymous.body.sources.peerListings.status, "auth_required");
  assert.deepEqual(anonymous.body.entries, [{ id: "service" }]);

  const partial = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    allowPartialResults: true,
    loadServices: async () => { throw Object.assign(new Error("SECRET query on private_table"), { stack: "SECRET stack" }); }
  }));
  assert.equal(partial.response.status, 200);
  assert.equal(partial.body.partial, true);
  assert.deepEqual(partial.body.entries, [{ id: "peer" }]);
  assert.equal(partial.body.sources.services.errorCode, "SERVICE_MAP_SERVICES_UNAVAILABLE");

  const pendingDecision = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    loadServices: async () => { throw new Error("SECRET pending owner decision"); }
  }));
  assert.equal(pendingDecision.response.status, 503);
  assert.equal(pendingDecision.body.code, "SERVICE_MAP_SOURCES_UNAVAILABLE");
  assert.equal(pendingDecision.body.partial, false);
  assert.equal("entries" in pendingDecision.body, false);

  let loaderCalls = 0;
  const authFailure = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    getSession: async () => { throw new Error("SECRET auth backend"); },
    loadServices: async () => { loaderCalls += 1; return []; },
    loadPeerListings: async () => { loaderCalls += 1; return []; }
  }));
  assert.equal(authFailure.response.status, 503);
  assert.equal(authFailure.body.code, "SERVICE_MAP_AUTH_UNAVAILABLE");
  assert.equal(authFailure.body.partial, false);
  assert.equal(loaderCalls, 0);

  const bothFail = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    loadServices: async () => { throw new Error("SECRET services"); },
    loadPeerListings: async () => { throw new Error("SECRET peer"); }
  }));
  assert.equal(bothFail.response.status, 503);
  assert.equal(bothFail.body.code, "SERVICE_MAP_SOURCES_UNAVAILABLE");
  assert.equal(bothFail.body.partial, false);
  assert.equal("entries" in bothFail.body, false);

  const denied = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    loadPeerListings: async () => { throw Object.assign(new Error("SECRET recipient"), { status: 403 }); }
  }));
  assert.equal(denied.response.status, 403);
  assert.equal(denied.body.code, "SERVICE_MAP_ACCESS_DENIED");
  assert.equal("entries" in denied.body, false);

  const dbDenied = await readResponse("http://localhost/api/service-map/entries?type=ALL", routeDeps({
    loadServices: async () => { throw Object.assign(new Error("SECRET db user"), { code: "P1010" }); }
  }));
  assert.equal(dbDenied.response.status, 503);
  assert.equal(dbDenied.body.code, "SERVICE_MAP_SOURCE_PERMISSION_UNAVAILABLE");
  assert.equal("entries" in dbDenied.body, false);

  assert.doesNotMatch(
    JSON.stringify({ anonymous: anonymous.body, partial: partial.body, pendingDecision: pendingDecision.body, authFailure: authFailure.body, bothFail: bothFail.body, denied: denied.body, dbDenied: dbDenied.body, logs }),
    /SECRET|private_table|query|stack|recipient|db user|auth backend/i
  );
} finally {
  console.error = original;
}
