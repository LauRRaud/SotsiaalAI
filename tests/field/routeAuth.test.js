import test from "node:test";
import assert from "node:assert/strict";

import { requireFieldUser } from "../../lib/field/routeAuth.js";

function session(role = "SOCIAL_WORKER") {
  return { user: { id: "field-user-1", role } };
}

test("field API rejects a professional without an active subscription", async () => {
  const calls = [];
  const result = await requireFieldUser({
    getSession: async () => session(),
    requireSubscription: async (currentSession, role) => {
      calls.push({ currentSession, role });
      return {
        ok: false,
        status: 402,
        message: "api.common.subscription_required",
        redirect: "/tellimus",
        requireSubscription: true
      };
    }
  });

  assert.deepEqual(result, {
    ok: false,
    status: 402,
    message: "api.common.subscription_required",
    redirect: "/tellimus",
    requireSubscription: true
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].currentSession.user.id, "field-user-1");
  assert.equal(calls[0].role, "SOCIAL_WORKER");
});

test("field API admits a subscribed professional and preserves its auth context", async () => {
  const currentSession = session("SERVICE_PROVIDER");
  const result = await requireFieldUser({
    getSession: async () => currentSession,
    requireSubscription: async () => ({ ok: true, status: 200 })
  });

  assert.deepEqual(result, {
    ok: true,
    userId: "field-user-1",
    role: "SERVICE_PROVIDER",
    session: currentSession
  });
});

test("field API keeps authentication and role checks ahead of the subscription lookup", async () => {
  let subscriptionChecks = 0;
  const requireSubscription = async () => {
    subscriptionChecks += 1;
    return { ok: true, status: 200 };
  };

  assert.deepEqual(
    await requireFieldUser({ getSession: async () => null, requireSubscription }),
    { ok: false, status: 401, message: "api.common.unauthorized" }
  );
  assert.deepEqual(
    await requireFieldUser({ getSession: async () => session("CLIENT"), requireSubscription }),
    { ok: false, status: 404, message: "api.common.not_found" }
  );
  assert.equal(subscriptionChecks, 0);
});
