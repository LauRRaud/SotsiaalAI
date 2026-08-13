import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  clearChatJourneyDraft,
  readChatJourneyDraft,
  writeChatJourneyDraft
} from "../../lib/journey/chatDraftStorage.js";

const chatBody = await readFile(
  new URL("../../components/alalehed/ChatBody.jsx", import.meta.url),
  "utf8"
);

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function draft(marker) {
  return {
    sourceText: `source-${marker}`,
    draft: {
      title: `title-${marker}`,
      summary: `summary-${marker}`
    }
  };
}

test("SOL-JOUR-09: chat Journey drafts restore only for the same owner and conversation", () => {
  const storage = memoryStorage();
  writeChatJourneyDraft(storage, "owner-a", "conversation-a", draft("A"));
  writeChatJourneyDraft(storage, "owner-a", "conversation-b", draft("B"));
  writeChatJourneyDraft(storage, "owner-b", "conversation-a", draft("FOREIGN"));

  assert.equal(readChatJourneyDraft(storage, "owner-a", "conversation-a")?.draft?.summary, "summary-A");
  assert.equal(readChatJourneyDraft(storage, "owner-a", "conversation-b")?.draft?.summary, "summary-B");
  assert.equal(readChatJourneyDraft(storage, "owner-b", "conversation-a")?.draft?.summary, "summary-FOREIGN");
  assert.equal(readChatJourneyDraft(storage, "owner-b", "conversation-b"), null);

  clearChatJourneyDraft(storage, "owner-a", "conversation-a");
  assert.equal(readChatJourneyDraft(storage, "owner-a", "conversation-a"), null);
  assert.equal(readChatJourneyDraft(storage, "owner-a", "conversation-b")?.draft?.summary, "summary-B");
});

test("SOL-JOUR-09: chat restores the scoped draft and saves the active conversation origin", () => {
  assert.match(chatBody, /readChatJourneyDraft\([\s\S]*sessionUserId[\s\S]*convId/u);
  assert.match(chatBody, /writeChatJourneyDraft\([\s\S]*sessionUserId[\s\S]*convId/u);
  assert.match(chatBody, /conversationId: convId/u);
  assert.match(chatBody, /clearChatJourneyDraft\([\s\S]*sessionUserId[\s\S]*convId/u);
});
