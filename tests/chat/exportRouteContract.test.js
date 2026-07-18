import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildDocumentAuditRecord } from "../../lib/documents/auditShared.js";

test("chat export audit stores only its minimal successful-export metadata", () => {
  const messageContent = "sensitive chat message that must never be audited";
  const record = buildDocumentAuditRecord("chat.exported", {
    userId: "user-owner",
    conversationId: "conversation-1",
    messageId: "message-1",
    format: "word"
  });

  assert.deepEqual(record, {
    ownerId: "user-owner",
    documentId: null,
    artifactId: null,
    action: "DOWNLOAD",
    meta: {
      event: "chat.exported",
      conversationId: "conversation-1",
      messageId: "message-1",
      format: "word"
    }
  });
  assert.equal(JSON.stringify(record).includes(messageContent), false);
});

test("chat route audits only after authorization and a generated successful export", async () => {
  const source = await readFile(new URL("../../app/api/chat/export/route.js", import.meta.url), "utf8");
  const auditIndex = source.indexOf('await logDocumentsAudit("chat.exported"');

  assert.ok(auditIndex > source.indexOf("conversation.userId !== auth.userId"));
  assert.ok(auditIndex > source.indexOf("if (!msg?.content?.trim())"));
  assert.match(source, /if \(!isPdfTextSupported\(msg\.content\)\) \{\s+return jsonError\(req, "api\.exports\.pdf_content_not_supported", 409\);/);
  assert.match(source, /createChatDocxBuffer\(msg\.content, "SotsiaalAI summary"\)/);
  assert.match(source, /`\$\{fileBase\}\.docx`, DOCX_MIME_TYPE/);
  assert.doesNotMatch(source, /createWordBufferFromText|application\/msword/);
});
