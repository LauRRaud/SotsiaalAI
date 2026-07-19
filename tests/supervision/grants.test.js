import test from "node:test";
import assert from "node:assert/strict";
import {
  createSupervisionDb,
  seedUser,
  resetIds,
  adminSession,
  memberSession
} from "./harness.js";
import {
  issueGrant,
  revokeGrant,
  listGrants,
  getActiveGrant,
  assertActiveSupervisorGrant
} from "../../lib/supervision/grants.js";
import {
  requireSupervisionAdmin,
  requireSupervisionMember
} from "../../lib/supervision/shared.js";

function setup() {
  resetIds();
  const db = createSupervisionDb();
  seedUser(db, "admin1", "ADMIN");
  seedUser(db, "sv1", "SOCIAL_WORKER");
  seedUser(db, "sp1", "SERVICE_PROVIDER");
  seedUser(db, "client1", "CLIENT");
  return db;
}

test("issueGrant loob aktiivse grandi ja kirjutab sisuvaba GRANT_ISSUED auditi", async () => {
  const db = setup();
  const grant = await issueGrant(
    { actorUserId: "admin1", userId: "sv1", grantBasis: "ESCU-register-2026" },
    { db }
  );
  assert.equal(grant.active, true);
  assert.equal(grant.userId, "sv1");
  assert.equal(grant.grantBasis, "ESCU-register-2026");

  const audits = db.store.supervisionAuditEvent;
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, "GRANT_ISSUED");
  assert.equal(audits[0].processId, null);
  assert.equal(audits[0].targetId, "sv1");
  // Sisuvaba invariant: metadata kannab AINULT grantId-d, mitte grantBasis-teksti.
  assert.deepEqual(Object.keys(audits[0].metadata), ["grantId"]);
  assert.ok(!JSON.stringify(audits[0].metadata).includes("ESCU-register"));
});

test("test #1: grant-haldus ainult adminile (SW/SP/CLIENT → 403, autentimata → 401)", () => {
  assert.deepEqual(requireSupervisionAdmin(adminSession("admin1")), { userId: "admin1", role: "ADMIN" });
  for (const role of ["SOCIAL_WORKER", "SERVICE_PROVIDER", "CLIENT"]) {
    assert.throws(
      () => requireSupervisionAdmin(memberSession("u", role)),
      (e) => e.status === 403
    );
  }
  assert.throws(() => requireSupervisionAdmin(null), (e) => e.status === 401);
});

test("liikmeroll: SW/SP läbivad, CLIENT/ADMIN → 403, autentimata → 401", () => {
  assert.equal(requireSupervisionMember(memberSession("sv1", "SOCIAL_WORKER")).userId, "sv1");
  assert.equal(requireSupervisionMember(memberSession("sp1", "SERVICE_PROVIDER")).role, "SERVICE_PROVIDER");
  assert.throws(() => requireSupervisionMember(memberSession("c", "CLIENT")), (e) => e.status === 403);
  assert.throws(() => requireSupervisionMember(adminSession("a")), (e) => e.status === 403);
  assert.throws(() => requireSupervisionMember(null), (e) => e.status === 401);
});

test("grandi andmine CLIENT-ile → 422 role_not_allowed", async () => {
  const db = setup();
  await assert.rejects(
    () => issueGrant({ actorUserId: "admin1", userId: "client1", grantBasis: "x" }, { db }),
    (e) => e.status === 422 && e.message === "supervision.errors.role_not_allowed"
  );
  assert.equal(db.store.supervisorGrant.length, 0);
});

test("grantBasis on kohustuslik (tühi → 400) ja tundmatu kasutaja → 400", async () => {
  const db = setup();
  await assert.rejects(
    () => issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "   " }, { db }),
    (e) => e.status === 400
  );
  await assert.rejects(
    () => issueGrant({ actorUserId: "admin1", userId: "ghost", grantBasis: "x" }, { db }),
    (e) => e.status === 400
  );
});

test("üks aktiivne grant kasutaja kohta: teine andmine → 409 grant_exists", async () => {
  const db = setup();
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "alus1" }, { db });
  await assert.rejects(
    () => issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "alus2" }, { db }),
    (e) => e.status === 409 && e.message === "supervision.errors.grant_exists"
  );
  assert.equal(db.store.supervisorGrant.length, 1);
});

test("revoke tühistab grandi ja on idempotentne (teine kord ei kirjuta uut auditit)", async () => {
  const db = setup();
  const grant = await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "alus" }, { db });
  const revoked = await revokeGrant({ actorUserId: "admin1", grantId: grant.id }, { db });
  assert.equal(revoked.active, false);
  assert.ok(revoked.revokedAt);
  assert.equal(await getActiveGrant("sv1", { db }), null);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "GRANT_REVOKED").length, 1);

  const again = await revokeGrant({ actorUserId: "admin1", grantId: grant.id }, { db });
  assert.equal(again.active, false);
  assert.equal(db.store.supervisionAuditEvent.filter((a) => a.action === "GRANT_REVOKED").length, 1);

  // Pärast tühistamist saab anda uue grandi (ajalugu ei blokeeri).
  const fresh = await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "alus2" }, { db });
  assert.equal(fresh.active, true);
});

test("test #2: aegunud või tühistatud grant → getActiveGrant null ja protsessi-värav 403", async () => {
  const db = setup();
  const now = new Date("2026-07-19T12:00:00Z");
  // Aegunud grant (validUntil minevikus)
  await issueGrant(
    { actorUserId: "admin1", userId: "sv1", grantBasis: "alus", validUntil: new Date("2026-07-18T00:00:00Z") },
    { db, now }
  );
  assert.equal(await getActiveGrant("sv1", { db, now }), null);
  await assert.rejects(
    () => assertActiveSupervisorGrant("sv1", { db, now }),
    (e) => e.status === 403 && e.message === "supervision.errors.grant_required"
  );
  // Tühistatud grant
  const g2 = await issueGrant({ actorUserId: "admin1", userId: "sp1", grantBasis: "alus" }, { db, now });
  await revokeGrant({ actorUserId: "admin1", grantId: g2.id }, { db, now });
  await assert.rejects(
    () => assertActiveSupervisorGrant("sp1", { db, now }),
    (e) => e.status === 403
  );
});

test("listGrants: admin näeb grantBasis'ega, userId-skoop filtreerib", async () => {
  const db = setup();
  await issueGrant({ actorUserId: "admin1", userId: "sv1", grantBasis: "alus-a" }, { db });
  const all = await listGrants({}, { db });
  assert.equal(all.length, 1);
  assert.equal(all[0].grantBasis, "alus-a");
  assert.equal(all[0].active, true);
  const scoped = await listGrants({ userId: "sp1" }, { db });
  assert.equal(scoped.length, 0);
});
