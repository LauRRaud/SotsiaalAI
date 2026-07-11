import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { runUserDeletionCleanup } from "../../lib/privacy/userDeletionOrchestrator.js";

test("account cleanup retries Chroma failure and leaves no DB, file or index residue", async () => {
  const directory = await mkdtemp(join(tmpdir(), "sotsiaalai-delete-"));
  const filePath = join(directory, "document.txt");
  await writeFile(filePath, "private test content", "utf8");

  const state = { userExists: true, chatLogs: 1, chroma: new Set(["rag-doc-1"]) };
  const targets = {
    documents: [{ id: "doc-1", storagePath: filePath }],
    materialSubmissions: [],
    artifacts: []
  };
  const base = {
    targets,
    user: { email: "delete-test@example.invalid" },
    targetUserId: "user-1",
    deleteDocumentFile: async document => {
      await unlink(document.storagePath).catch(error => {
        if (error.code !== "ENOENT") throw error;
      });
      return { ok: true };
    },
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => { state.chatLogs = 0; },
    deleteUser: async () => { state.userExists = false; }
  };

  try {
    const failed = await runUserDeletionCleanup({
      ...base,
      deleteRagReference: async () => ({ ok: false })
    });
    assert.equal(failed.ok, false);
    assert.equal(state.userExists, true);
    assert.equal(state.chatLogs, 1);
    assert.equal(state.chroma.has("rag-doc-1"), true);
    await assert.rejects(readFile(filePath));

    const completed = await runUserDeletionCleanup({
      ...base,
      deleteRagReference: async () => {
        state.chroma.delete("rag-doc-1");
        return { ok: true };
      }
    });
    assert.equal(completed.ok, true);
    assert.equal(state.userExists, false);
    assert.equal(state.chatLogs, 0);
    assert.equal(state.chroma.size, 0);
    await assert.rejects(readFile(filePath));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
