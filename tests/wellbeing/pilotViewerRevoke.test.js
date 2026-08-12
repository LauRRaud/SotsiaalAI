import assert from "node:assert/strict";
import test from "node:test";

import { resolveWellbeingPilotAccess } from "../../lib/wellbeing/pilotAccess.js";
import {
  removeWellbeingPilotViewer,
  updateWellbeingPilotScope,
  WELLBEING_PILOT_AUDIT_ACTIONS,
  wellbeingPilotScopeVersion
} from "../../lib/wellbeing/pilotScopes.js";

const NOW = new Date("2026-05-26T09:00:00.000Z");

function scopeStore({ scopes = [], viewers = [], failAudit = false } = {}) {
  const scopeRows = scopes.map((row) => ({ ...row }));
  const viewerRows = viewers.map((row) => ({ ...row }));
  const audits = [];

  const client = {
    /* Päris tehingu semantika: callback'i vise pöörab KÕIK tagasi. Ilma selleta
       ei tõendaks veasüst midagi — ta näitaks ainult, et erind lendas. */
    $transaction: async (callback) => {
      const scopeSnapshot = scopeRows.map((row) => ({ ...row }));
      const viewerSnapshot = viewerRows.map((row) => ({ ...row }));
      try {
        return await callback(client);
      } catch (error) {
        scopeRows.splice(0, scopeRows.length, ...scopeSnapshot);
        viewerRows.splice(0, viewerRows.length, ...viewerSnapshot);
        throw error;
      }
    },
    dataAuditLog: {
      create: async ({ data }) => {
        if (failAudit) throw new Error("audit write failed");
        audits.push(data);
        return data;
      }
    },
    wellbeingPilotScope: {
      findUnique: async ({ where }) => {
        const row = scopeRows.find((candidate) => candidate.id === where.id);
        return row ? { ...row, viewers: viewerRows.filter((v) => v.pilotScopeId === row.id) } : null;
      },
      update: async ({ where, data }) => {
        const row = scopeRows.find((candidate) => candidate.id === where.id);
        Object.assign(row, data);
        return { ...row, viewers: viewerRows.filter((v) => v.pilotScopeId === row.id) };
      },
      findMany: async ({ where }) => scopeRows
        .filter((row) => (where.active === undefined ? true : row.active === where.active))
        .filter((row) => {
          const matchers = where.viewers?.some?.OR;
          if (!matchers) return true;
          return viewerRows.some((viewer) => viewer.pilotScopeId === row.id && matchers.some((matcher) => {
            if (matcher.userId !== undefined) return viewer.userId === matcher.userId;
            if (matcher.email !== undefined) {
              const claimOk = matcher.claimedAt === null ? viewer.claimedAt == null : true;
              return viewer.email === matcher.email && claimOk;
            }
            return false;
          }));
        })
        .map((row) => ({ ...row, viewers: viewerRows.filter((v) => v.pilotScopeId === row.id) }))
    },
    wellbeingPilotViewer: {
      findUnique: async ({ where }) => {
        const key = where.pilotScopeId_email || where;
        const row = viewerRows.find((candidate) => (
          where.id ? candidate.id === where.id
            : candidate.pilotScopeId === key.pilotScopeId && candidate.email === key.email
        ));
        return row ? { ...row } : null;
      },
      delete: async ({ where }) => {
        const key = where.pilotScopeId_email;
        const index = viewerRows.findIndex(
          (row) => row.pilotScopeId === key.pilotScopeId && row.email === key.email
        );
        const [removed] = viewerRows.splice(index, 1);
        return removed;
      },
      updateMany: async ({ where, data }) => {
        const row = viewerRows.find((candidate) => (
          candidate.id === where.id && (where.claimedAt !== null || candidate.claimedAt == null)
        ));
        if (!row) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      }
    },
    user: { findUnique: async () => null }
  };

  return { client, audits, viewerRows, scopeRows };
}

test("a viewer can be revoked immediately, and the audit says who revoked whom", async () => {
  const store = scopeStore({
    scopes: [{ id: "scope_1", name: "Tartu", roleGroups: ["SOCIAL_WORKER"], minimumGroupSize: 3, active: true }],
    viewers: [{ id: "v1", pilotScopeId: "scope_1", email: "kov@example.test", userId: "user_1", claimedAt: NOW }]
  });

  const result = await removeWellbeingPilotViewer(
    "scope_1",
    { email: "KOV@example.test " },
    { prisma: store.client, actorUserId: "admin_1" }
  );

  assert.equal(result.revoked, true);
  assert.equal(store.viewerRows.length, 0);
  assert.equal(store.audits[0].action, WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_REVOKED);
  assert.equal(store.audits[0].actorUserId, "admin_1");
  assert.equal(store.audits[0].targetUserId, "user_1");
  assert.equal(store.audits[0].meta.viewerEmail, "kov@example.test");
  /* Jälg ei kanna koondi sisu — ainult see, kes kellelt mille ära võttis. */
  assert.equal(JSON.stringify(store.audits[0]).includes("signal"), false);
});

test("revoking a viewer who is not there is a 404, not a silent success", async () => {
  const store = scopeStore({ scopes: [{ id: "scope_1", active: true }] });
  await assert.rejects(
    () => removeWellbeingPilotViewer("scope_1", { email: "nobody@example.test" }, {
      prisma: store.client,
      actorUserId: "admin_1"
    }),
    (error) => {
      assert.equal(error.status, 404);
      return true;
    }
  );
});

/* SOL-WB-13 kriteerium: „Veasüstitest peab tõendama, et õigus ei muutu ilma
   auditi õnnestumiseta." Süst tabab AINULT auditikirjutust; tema kõrval on
   negatiivkontroll, et sama toiming töötava auditiga läheb läbi. */
test("if the audit write fails, the access change rolls back with it", async () => {
  const store = scopeStore({
    scopes: [{ id: "scope_1", name: "Tartu", roleGroups: ["SOCIAL_WORKER"], minimumGroupSize: 3, active: true }],
    viewers: [{ id: "v1", pilotScopeId: "scope_1", email: "kov@example.test", userId: "user_1", claimedAt: NOW }],
    failAudit: true
  });

  await assert.rejects(() => removeWellbeingPilotViewer("scope_1", { email: "kov@example.test" }, {
    prisma: store.client,
    actorUserId: "admin_1"
  }), /audit write failed/u);

  assert.equal(store.viewerRows.length, 1, "vaataja peab alles jääma, kui jälg ei õnnestunud");
  assert.equal(store.audits.length, 0);
});

test("deactivating a scope takes the access away on the very next request", async () => {
  const store = scopeStore({
    scopes: [{
      id: "scope_1",
      name: "Tartu",
      scopeType: "role_group",
      roleGroups: ["SOCIAL_WORKER"],
      minimumGroupSize: 3,
      active: true
    }],
    viewers: [{ id: "v1", pilotScopeId: "scope_1", email: "kov@example.test", userId: "user_1", claimedAt: NOW }]
  });

  const before = await resolveWellbeingPilotAccess(
    { user: { id: "user_1", email: "kov@example.test" } },
    { prisma: store.client, env: {}, now: NOW }
  );
  assert.equal(before.ok, true);
  assert.equal(before.pilotScopes.length, 1);

  const updated = await updateWellbeingPilotScope("scope_1", { active: false }, {
    prisma: store.client,
    actorUserId: "admin_1"
  });
  assert.equal(updated.active, false);
  assert.equal(store.audits.at(-1).action, WELLBEING_PILOT_AUDIT_ACTIONS.SCOPE_UPDATED);
  assert.deepEqual(store.audits.at(-1).meta.changedFields, ["active"]);
  assert.notEqual(store.audits.at(-1).meta.fromScopeVersion, store.audits.at(-1).meta.scopeVersion);

  const after = await resolveWellbeingPilotAccess(
    { user: { id: "user_1", email: "kov@example.test" } },
    { prisma: store.client, env: {}, now: NOW }
  );
  assert.equal(after.ok, false);
  assert.equal(after.status, 403);
});

/* SOL-WB-12 tuum: kustutatud konto aadressile hiljem loodud UUS konto ei tohi
   vana vaataja rida pärida. */
test("a claimed invitation stops matching by email, so a new account cannot inherit it", async () => {
  const store = scopeStore({
    scopes: [{ id: "scope_1", name: "Tartu", roleGroups: ["SOCIAL_WORKER"], minimumGroupSize: 3, active: true }],
    /* Rida on lunastatud ja tema konto on kustunud — `userId` on tühi, aga
       `claimedAt` jäi. Täpselt see seis andis vanas lepingus ligipääsu. */
    viewers: [{ id: "v1", pilotScopeId: "scope_1", email: "kov@example.test", userId: null, claimedAt: NOW }]
  });

  const newAccount = await resolveWellbeingPilotAccess(
    { user: { id: "user_new", email: "kov@example.test" } },
    { prisma: store.client, env: {}, now: NOW }
  );
  assert.equal(newAccount.ok, false);

  /* Negatiivkontroll: lunastamata kutse SAMA aadressiga töötab endiselt — piir
     käib lunastamise, mitte e-posti kohta. */
  store.viewerRows[0].claimedAt = null;
  const invited = await resolveWellbeingPilotAccess(
    { user: { id: "user_new", email: "kov@example.test" } },
    { prisma: store.client, env: {}, now: NOW }
  );
  assert.equal(invited.ok, true);
  /* Ja kasutamise hetkel seotakse kutse selle kontoga. */
  assert.equal(store.viewerRows[0].userId, "user_new");
  assert.ok(store.viewerRows[0].claimedAt);
  assert.equal(store.audits.at(-1).action, WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_CLAIMED);
});

test("the scope version changes with the configuration, not with the reading", () => {
  const scope = {
    name: "Tartu",
    scopeType: "municipality",
    municipalityId: "tartu",
    roleGroups: ["b", "a"],
    minimumGroupSize: 5,
    active: true
  };
  assert.equal(wellbeingPilotScopeVersion(scope), wellbeingPilotScopeVersion({ ...scope, roleGroups: ["a", "b"] }));
  assert.notEqual(wellbeingPilotScopeVersion(scope), wellbeingPilotScopeVersion({ ...scope, minimumGroupSize: 6 }));
});
