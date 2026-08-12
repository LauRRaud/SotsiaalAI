import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  combineServiceMapSourceResults,
  isServiceMapAccessError,
  isServiceMapSourcePermissionError
} from "../../lib/serviceMap/sourceResults.js";

const ok = (value) => ({ status: "fulfilled", value });
const fail = (reason) => ({ status: "rejected", reason });

test("one independent technical failure keeps the healthy source with a stable partial state", () => {
  const secret = new Error("postgres secret host and query");
  const result = combineServiceMapSourceResults({
    servicesRequested: true,
    peerListingsRequested: true,
    peerListingsAuthorized: true,
    serviceSettled: ok({ entries: [{ id: "service" }], page: { hasMore: false } }),
    peerListingsSettled: fail(secret)
  });
  assert.deepEqual(result.serviceResult.entries, [{ id: "service" }]);
  assert.deepEqual(result.peerResult.entries, []);
  assert.equal(result.partial, true);
  assert.deepEqual(result.sources, {
    services: { status: "ok", errorCode: null },
    peerListings: { status: "unavailable", errorCode: "SERVICE_MAP_PEER_LISTINGS_UNAVAILABLE" }
  });
  assert.doesNotMatch(JSON.stringify({ partial: result.partial, sources: result.sources }), /secret|postgres|query/i);
});

test("service source failure keeps a healthy peer source", () => {
  const result = combineServiceMapSourceResults({
    servicesRequested: true,
    peerListingsRequested: true,
    peerListingsAuthorized: true,
    serviceSettled: fail(new Error("service failed")),
    peerListingsSettled: ok({ entries: [{ id: "peer" }], page: { hasMore: false } })
  });
  assert.deepEqual(result.serviceResult.entries, []);
  assert.deepEqual(result.peerResult.entries, [{ id: "peer" }]);
  assert.equal(result.partial, true);
  assert.deepEqual(result.sources.services, {
    status: "unavailable",
    errorCode: "SERVICE_MAP_SERVICES_UNAVAILABLE"
  });
});

test("both requested technical sources failing produces a sanitized 503 decision", () => {
  assert.throws(() => combineServiceMapSourceResults({
    servicesRequested: true,
    peerListingsRequested: true,
    peerListingsAuthorized: true,
    serviceSettled: fail(new Error("service db secret")),
    peerListingsSettled: fail(new Error("help db secret"))
  }), (error) => error.status === 503 && error.code === "SERVICE_MAP_SOURCES_UNAVAILABLE" && error.message === "SERVICE_MAP_SOURCES_UNAVAILABLE");
});

test("authentication and authorization failures always fail the whole response", () => {
  for (const status of [401, 403]) {
    const accessError = Object.assign(new Error("private access detail"), { status });
    assert.throws(() => combineServiceMapSourceResults({
      servicesRequested: true,
      peerListingsRequested: true,
      peerListingsAuthorized: true,
      serviceSettled: ok([{ id: "service" }]),
      peerListingsSettled: fail(accessError)
    }), (error) => error === accessError);
  }
});

test("access errors are exact-match and source permission failures are classified separately", () => {
  for (const error of [
    { status: 401 },
    { statusCode: 403 },
    { code: "UNAUTHORIZED" },
    { messageKey: "api.common.forbidden" },
    { message: "AUTH_REQUIRED" },
    { cause: { code: "ACCESS_DENIED" } }
  ]) {
    assert.equal(isServiceMapAccessError(error), true);
  }
  for (const error of [
    { code: "P1000" },
    { cause: { code: "P1010" } },
    { code: "28000" },
    { meta: { driverAdapterError: { cause: { code: "28P01" } } } },
    { meta: { driverAdapterError: { cause: { originalCode: "42501" } } } }
  ]) {
    assert.equal(isServiceMapSourcePermissionError(error), true);
    assert.equal(isServiceMapAccessError(error), false);
  }
  for (const code of ["P1001", "P1017", "P2021", "P2022"]) {
    assert.equal(isServiceMapAccessError({ code }), false);
    assert.equal(isServiceMapSourcePermissionError({ code }), false);
  }
  assert.equal(isServiceMapAccessError({ message: "query failed near FORBIDDEN sentinel" }), false);
});

test("malformed fulfilled source output is unavailable, never a healthy empty result", () => {
  for (const value of [undefined, null, {}]) {
    assert.throws(() => combineServiceMapSourceResults({
      servicesRequested: true,
      peerListingsRequested: false,
      peerListingsAuthorized: true,
      serviceSettled: ok(value),
      peerListingsSettled: ok([])
    }), (error) => error.status === 503 && error.code === "SERVICE_MAP_SOURCES_UNAVAILABLE");
  }
});

test("anonymous peer access is not a partial failure", () => {
  const result = combineServiceMapSourceResults({
    servicesRequested: true,
    peerListingsRequested: true,
    peerListingsAuthorized: false,
    serviceSettled: ok([{ id: "service" }]),
    peerListingsSettled: ok([])
  });
  assert.equal(result.partial, false);
  assert.equal(result.sources.peerListings.status, "auth_required");
});

test("unrequested sources are explicit and do not affect completeness", () => {
  const result = combineServiceMapSourceResults({
    servicesRequested: true,
    peerListingsRequested: false,
    peerListingsAuthorized: true,
    serviceSettled: ok([{ id: "service" }]),
    peerListingsSettled: ok([])
  });
  assert.equal(result.partial, false);
  assert.equal(result.sources.peerListings.status, "not_requested");
});

test("route contract is fail-closed and does not serialize or log internal details", () => {
  const fixture = fileURLToPath(new URL("./fixtures/sourceResultsRouteContract.mjs", import.meta.url));
  const loader = fileURLToPath(new URL("../../scripts/register-node-test-loader.mjs", import.meta.url));
  execFileSync(process.execPath, ["--conditions=react-server", "--import", pathToFileURL(loader).href, fixture], {
    cwd: fileURLToPath(new URL("../..", import.meta.url)),
    stdio: "pipe"
  });
});
