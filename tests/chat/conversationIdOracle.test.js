import test from "node:test";
import assert from "node:assert/strict";

import { PERSIST_FAILURE, writeUserTurn } from "../../lib/chat/persistence.js";

function transactionWith(conversation) {
  const writes = [];
  return {
    writes,
    conversation: {
      findUnique: async () => conversation,
      update: async input => {
        writes.push(["conversation.update", input]);
        return input;
      }
    },
    conversationMessage: {
      create: async input => {
        writes.push(["conversationMessage.create", input]);
        return { id: "message-1" };
      }
    }
  };
}

const input = {
  conversationId: "candidate-conversation-id",
  userId: "attacker-user",
  role: "CLIENT",
  userMessage: "Küsimus",
  now: new Date("2026-08-15T12:00:00.000Z")
};

test("puuduv ja võõras vestluse ID annavad sama suletud tulemuse ilma kirjutusteta", async () => {
  const missingTx = transactionWith(null);
  const foreignTx = transactionWith({
    id: input.conversationId,
    userId: "other-user",
    title: "Privaatne vestlus",
    archivedAt: null
  });

  const missing = await writeUserTurn(missingTx, input);
  const foreign = await writeUserTurn(foreignTx, input);

  assert.equal(missing.ok, false);
  assert.equal(foreign.ok, false);
  assert.equal(missing.reason, PERSIST_FAILURE.CONVERSATION_MISSING);
  assert.equal(foreign.reason, PERSIST_FAILURE.OWNER_MISMATCH);
  assert.deepEqual(missingTx.writes, []);
  assert.deepEqual(foreignTx.writes, []);
});
