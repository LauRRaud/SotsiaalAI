import assert from "node:assert/strict";

import { GET } from "../../../app/api/service-map/entries/route.js";
import { encodeServiceMapCursor } from "../../../lib/serviceMap/entriesQueryPolicy.js";

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
    loadServices: async () => { throw Object.assign(new Error("SECRET query on private_table"), { stack: "SECRET stack" }); }
  }));
  assert.equal(partial.response.status, 200);
  assert.equal(partial.body.partial, true);
  assert.deepEqual(partial.body.entries, [{ id: "peer" }]);
  assert.equal(partial.body.sources.services.errorCode, "SERVICE_MAP_SERVICES_UNAVAILABLE");
  assert.equal(partial.body.page.hasMore, false);
  assert.equal(partial.body.page.nextCursor, null);

  const sourcePositions = [];
  const peerPositions = [];
  const pagedDeps = routeDeps({
    loadServices: async (query) => {
      sourcePositions.push(query.cursor?.id || null);
      return query.cursor
        ? { entries: [{ id: "service-2" }], page: { hasMore: false, nextCursor: null } }
        : {
            entries: [{ id: "service-1" }],
            page: {
              hasMore: true,
              nextCursor: encodeServiceMapCursor({ kind: "service", title: "Service 1", id: "service-1" }, query)
            }
          };
    },
    loadPeerListings: async ({ query }) => {
      peerPositions.push(query.cursor?.id || null);
      return query.cursor
        ? { entries: [{ id: "peer-2" }], page: { hasMore: false, nextCursor: null } }
        : {
            entries: [{ id: "peer-1" }],
            page: {
              hasMore: true,
              nextCursor: encodeServiceMapCursor({ kind: "help", updatedAt: "2026-08-13T00:00:00.000Z", id: "peer-1" }, query)
            }
          };
    }
  });
  const firstPage = await readResponse("http://localhost/api/service-map/entries?type=ALL&q=abi", pagedDeps);
  assert.deepEqual(firstPage.body.entries.map((entry) => entry.id), ["service-1", "peer-1"]);
  assert.equal(firstPage.body.page.hasMore, true);
  assert.equal(firstPage.body.page.limitScope, "per_source");
  assert.equal(firstPage.body.page.requestedLimitPerSource, 24);
  const secondPage = await readResponse(`http://localhost/api/service-map/entries?type=ALL&q=abi&cursor=${encodeURIComponent(firstPage.body.page.nextCursor)}`, pagedDeps);
  assert.deepEqual(secondPage.body.entries.map((entry) => entry.id), ["service-2", "peer-2"]);
  assert.equal(secondPage.body.page.hasMore, false);
  assert.deepEqual(sourcePositions, [null, "service-1"]);
  assert.deepEqual(peerPositions, [null, "peer-1"]);

  const decodedCombined = JSON.parse(Buffer.from(firstPage.body.page.nextCursor, "base64url").toString("utf8"));
  decodedCombined.peerCursor = "malformed-child";
  const malformedCombined = Buffer.from(JSON.stringify(decodedCombined), "utf8").toString("base64url");
  const malformed = await readResponse(`http://localhost/api/service-map/entries?type=ALL&q=abi&cursor=${malformedCombined}`, pagedDeps);
  assert.equal(malformed.response.status, 400);
  assert.equal(malformed.body.messageKey, "workspace_feature_pages.service_map.errors.invalid_cursor");

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
    JSON.stringify({ anonymous: anonymous.body, partial: partial.body, authFailure: authFailure.body, bothFail: bothFail.body, denied: denied.body, dbDenied: dbDenied.body, logs }),
    /SECRET|private_table|query|stack|recipient|db user|auth backend/i
  );
} finally {
  console.error = original;
}
