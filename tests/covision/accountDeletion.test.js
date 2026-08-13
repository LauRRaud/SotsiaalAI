import test from "node:test";
import assert from "node:assert/strict";

import { tombstoneCovisionParticipationForAccountDeletion } from "../../lib/covision/accountDeletion.js";

test("SOL-COV-01: account deletion makes every participant identity terminal", async () => {
  const calls = [];
  const now = new Date("2026-08-13T12:00:00.000Z");
  const result = await tombstoneCovisionParticipationForAccountDeletion("user-old", {
    now,
    db: {
      covisionParticipant: {
        async updateMany(input) {
          calls.push(input);
          return { count: 2 };
        }
      }
    }
  });
  assert.deepEqual(calls, [{
    where: { userId: "user-old" },
    data: {
      userId: null,
      email: null,
      inviteStatus: "EXPIRED",
      inviteExpiresAt: now,
      decisionAt: now,
      identityErasedAt: now
    }
  }]);
  assert.deepEqual(result, {
    participationsTombstoned: 2,
    ownedCasesRetained: 0,
    ownedClosuresRetained: 0
  });
});
