import assert from "node:assert/strict";
import test from "node:test";

import {
  addWellbeingPilotViewer,
  WELLBEING_PILOT_AUDIT_ACTIONS
} from "../../lib/wellbeing/pilotScopes.js";

test("wellbeing pilot viewer workflow links an existing user by email", async () => {
  const calls = [];
  const audits = [];
  const prisma = {
    user: {
      findUnique: async (query) => {
        assert.deepEqual(query.where, { email: "kov@example.test" });
        return {
          id: "user_1",
          email: "kov@example.test",
          role: "SOCIAL_WORKER",
          isAdmin: false,
          emailVerified: new Date("2026-05-01T00:00:00.000Z")
        };
      }
    },
    /* SOL-WB-13: jälg käib sama tehinguga; fake peab teda seetõttu tundma. */
    dataAuditLog: { create: async (query) => { audits.push(query.data); return query.data; } },
    wellbeingPilotViewer: {
      upsert: async (query) => {
        calls.push(query);
        return {
          id: "viewer_1",
          pilotScopeId: "pilot_1",
          userId: "user_1",
          email: "kov@example.test",
          user: {
            id: "user_1",
            email: "kov@example.test",
            role: "SOCIAL_WORKER",
            isAdmin: false,
            emailVerified: new Date("2026-05-01T00:00:00.000Z")
          }
        };
      }
    }
  };

  const viewer = await addWellbeingPilotViewer(
    "pilot_1",
    { email: " KOV@example.test " },
    { prisma, actorUserId: "admin_1" }
  );

  assert.equal(calls[0].where.pilotScopeId_email.pilotScopeId, "pilot_1");
  assert.equal(calls[0].where.pilotScopeId_email.email, "kov@example.test");
  assert.equal(calls[0].create.userId, "user_1");
  assert.deepEqual(viewer, {
    id: "viewer_1",
    pilotScopeId: "pilot_1",
    userId: "user_1",
    email: "kov@example.test",
    claimedAt: null,
    role: "SOCIAL_WORKER",
    isAdmin: false,
    emailVerified: true
  });

  /* SOL-WB-12: olemasoleva kontoga rida seotakse KOHE — nii kaob ta koos
     kontoga ja e-post ei ole enam iseseisev võti. */
  assert.ok(calls[0].create.claimedAt instanceof Date);

  /* SOL-WB-13: kes, kellele, millisesse skoopi — ja mitte ühtki koondi arvu. */
  assert.equal(audits.length, 1);
  assert.equal(audits[0].action, WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_ADDED);
  assert.equal(audits[0].actorUserId, "admin_1");
  assert.equal(audits[0].targetUserId, "user_1");
  assert.equal(audits[0].resourceId, "pilot_1");
  assert.equal(audits[0].meta.viewerEmail, "kov@example.test");
});

/* SOL-WB-13: tegijata ei muutu midagi. Vaikimisi `null` oleks tähendanud
   „keegi andis kellelegi ligipääsu" — täpselt see seis oli enne. */
test("adding a viewer without a named actor changes nothing", async () => {
  let touched = false;
  const prisma = {
    user: { findUnique: async () => null },
    dataAuditLog: { create: async () => { touched = true; } },
    wellbeingPilotViewer: { upsert: async () => { touched = true; } }
  };

  await assert.rejects(
    () => addWellbeingPilotViewer("pilot_1", { email: "kov@example.test" }, { prisma }),
    /wellbeing\.pilot\.actor_required/u
  );
  assert.equal(touched, false);
});
