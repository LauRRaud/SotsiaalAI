/**
 * SOL-CW-01 — tasuta lugemine, tasulised tööriistad.
 *
 * Omanik lukustas lepingu 09.08.2026: oma juhtumite lugemine (GET) ja
 * kustutamine (DELETE) ei sõltu tellimusest — „ligipääs oma andmetele ei aegu
 * kunagi" — aga loomine ja muutmine (POST/PUT/PATCH) on tasuline tööriist.
 *
 * Test käivitab PÄRIS väravat (`guardCaseWorkRequest`), mitte ei loe teksti:
 * sessioon ja tellimuskontroll tulevad `deps` õmbluse kaudu. Nii tõendab test
 * väravat ennast, mitte selle kirjeldust.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { caseWorkRequiresSubscription, guardCaseWorkRequest } from "../../lib/casework/routes.js";

const FLAG = "CASEWORK_V1_ENABLED";

function makeRequest(method, { cookie = "" } = {}) {
  const headers = new Map([["cookie", cookie]]);
  return {
    method,
    url: "https://sotsiaal.ai/api/casework/cases",
    headers: { get: (name) => headers.get(String(name).toLowerCase()) ?? null }
  };
}

function workerSession({ isAdmin = false, role = "SOCIAL_WORKER" } = {}) {
  return { user: { id: "worker-1", role, isAdmin }, subActive: false };
}

/** Jäljendab `requireSubscription`-i lepingut ilma andmebaasita. */
function subscriptionStub({ active }) {
  const calls = [];
  const fn = async (session, role, opts = {}) => {
    calls.push({ role, allowWithoutSubscription: opts.allowWithoutSubscription === true });
    if (!session) return { ok: false, status: 401, message: "api.common.unauthorized" };
    if (session.user?.isAdmin) return { ok: true, status: 200 };
    if (opts.allowWithoutSubscription === true) return { ok: true, status: 200 };
    if (active) return { ok: true, status: 200 };
    return {
      ok: false,
      status: 402,
      message: "api.common.subscription_required",
      redirect: "/tellimus",
      requireSubscription: true
    };
  };
  fn.calls = calls;
  return fn;
}

async function runGuard(method, { active = false, isAdmin = false } = {}) {
  const requireSubscriptionStub = subscriptionStub({ active });
  const result = await guardCaseWorkRequest(makeRequest(method), {
    deps: {
      getSession: () => workerSession({ isAdmin }),
      requireSubscription: requireSubscriptionStub
    }
  });
  return { result, calls: requireSubscriptionStub.calls };
}

async function withFlag(value, run) {
  const previous = process.env[FLAG];
  process.env[FLAG] = value;
  try {
    return await run();
  } finally {
    if (previous === undefined) delete process.env[FLAG];
    else process.env[FLAG] = previous;
  }
}

test("caseWorkRequiresSubscription: GET/HEAD/DELETE tasuta, POST/PUT/PATCH tasuline", () => {
  for (const method of ["GET", "get", "HEAD", "DELETE", "delete"]) {
    assert.equal(caseWorkRequiresSubscription(method), false, `${method} peab olema tasuta`);
  }
  for (const method of ["POST", "PUT", "PATCH", "post"]) {
    assert.equal(caseWorkRequiresSubscription(method), true, `${method} peab olema tasuline`);
  }
  // Tundmatu/puuduv meetod langeb tasulisele poolele — fail-closed.
  assert.equal(caseWorkRequiresSubscription(undefined), true);
  assert.equal(caseWorkRequiresSubscription("TRACE"), true);
});

test("SOL-CW-01: tellimuseta töötaja saab lugeda ja kustutada", async () => {
  await withFlag("1", async () => {
    for (const method of ["GET", "DELETE"]) {
      const { result, calls } = await runGuard(method, { active: false });
      assert.equal(result.response, undefined, `${method} ei tohi tellimuseta blokeeruda`);
      assert.equal(result.userId, "worker-1");
      assert.equal(calls.at(-1).allowWithoutSubscription, true);
    }
  });
});

test("SOL-CW-01: tellimuseta töötaja ei saa luua ega muuta — 402", async () => {
  await withFlag("1", async () => {
    for (const method of ["POST", "PUT", "PATCH"]) {
      const { result, calls } = await runGuard(method, { active: false });
      assert.ok(result.response, `${method} peab tellimuseta blokeeruma`);
      assert.equal(result.response.status, 402, `${method} peab andma 402`);
      const body = await result.response.json();
      assert.equal(body.ok, false);
      assert.equal(body.messageKey, "api.common.subscription_required");
      assert.equal(body.requireSubscription, true);
      assert.equal(body.redirect, "/tellimus");
      assert.equal(calls.at(-1).allowWithoutSubscription, false);
    }
  });
});

test("SOL-CW-01: aktiivse tellimusega töötaja saab kõik toimingud teha", async () => {
  await withFlag("1", async () => {
    for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
      const { result } = await runGuard(method, { active: true });
      assert.equal(result.response, undefined, `${method} peab tellimusega läbi minema`);
      assert.equal(result.userId, "worker-1");
    }
  });
});

test("SOL-CW-01: väljas lipp annab endiselt 404, mitte 402", async () => {
  /* Väravate järjekord ei tohi muutuda: suletud funktsioon peab jääma
     olematust marsruudist eristamatuks (leping L19), mitte paljastama end
     maksemüüri kaudu. */
  await withFlag("0", async () => {
    const subscription = subscriptionStub({ active: false });
    let sessionReads = 0;
    const result = await guardCaseWorkRequest(makeRequest("POST"), {
      deps: {
        getSession: () => {
          sessionReads += 1;
          return workerSession();
        },
        requireSubscription: subscription
      }
    });
    assert.ok(result.response);
    assert.equal(result.response.status, 404);
    assert.equal(sessionReads, 0, "väljas lipuga ei tohi sessiooni üldse lugeda");
    assert.equal(subscription.calls.length, 0, "väljas lipuga ei tohi tellimust üldse küsida");
  });
});

test("SOL-CW-01: autentimata ja vale rolliga kasutaja seisund ei muutu", async () => {
  await withFlag("1", async () => {
    const anonymous = await guardCaseWorkRequest(makeRequest("POST"), {
      deps: { getSession: () => null, requireSubscription: subscriptionStub({ active: true }) }
    });
    assert.equal(anonymous.response.status, 401);

    const clientRole = subscriptionStub({ active: true });
    const client = await guardCaseWorkRequest(makeRequest("GET"), {
      deps: {
        getSession: () => ({ user: { id: "client-1", role: "CLIENT", isAdmin: false } }),
        requireSubscription: clientRole
      }
    });
    assert.equal(client.response.status, 403);
    assert.equal(clientRole.calls.length, 0, "roll peab lahenema enne tellimust");
  });
});

test("SOL-CW-01: admin ei jää oma tellimuse puudumise taha kinni", async () => {
  await withFlag("1", async () => {
    const { result } = await runGuard("POST", { active: false, isAdmin: true });
    assert.equal(result.response, undefined);
  });
});
