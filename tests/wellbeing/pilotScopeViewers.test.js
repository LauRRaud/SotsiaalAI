import assert from "node:assert/strict";
import test from "node:test";

import { addWellbeingPilotViewer } from "../../lib/wellbeing/pilotScopes.js";

test("wellbeing pilot viewer workflow links an existing user by email", async () => {
  const calls = [];
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

  const viewer = await addWellbeingPilotViewer("pilot_1", { email: " KOV@example.test " }, { prisma });

  assert.equal(calls[0].where.pilotScopeId_email.pilotScopeId, "pilot_1");
  assert.equal(calls[0].where.pilotScopeId_email.email, "kov@example.test");
  assert.equal(calls[0].create.userId, "user_1");
  assert.deepEqual(viewer, {
    id: "viewer_1",
    pilotScopeId: "pilot_1",
    userId: "user_1",
    email: "kov@example.test",
    role: "SOCIAL_WORKER",
    isAdmin: false,
    emailVerified: true
  });
});
