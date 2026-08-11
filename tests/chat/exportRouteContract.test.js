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
  const auditIndex = source.indexOf('writeDocumentAudit("chat.exported"');

  assert.ok(auditIndex > source.indexOf("conversation.userId !== auth.userId"));
  assert.ok(auditIndex > source.indexOf("if (!msg?.content?.trim())"));
  assert.match(source, /if \(!isPdfTextSupported\(msg\.content\)\) \{\s+return jsonError\(req, "api\.exports\.pdf_content_not_supported", 409\);/);
  assert.match(source, /createChatDocxBuffer\(msg\.content, "SotsiaalAI summary"\)/);
  assert.match(source, /`\$\{fileBase\}\.docx`, DOCX_MIME_TYPE/);
  assert.doesNotMatch(source, /createWordBufferFromText|application\/msword/);
});

/* SOL-CHAT-10: audit oli best-effort ja seetõttu VAIKNE — tundliku vestluse faili sai alla laadida
   ilma ühegi püsiva jäljeta. Nüüd on ta kohustuslik ja fail-closed. */
test("ekspordi audit on kohustuslik: kirjutuse viga ei lase faili välja", async () => {
  const source = await readFile(new URL("../../app/api/chat/export/route.js", import.meta.url), "utf8");

  /* Best-effort tee on siit KADUNUD, mitte ainult täiendatud. Mõõdame KUTSET ja importi, mitte
     teksti — nimi esineb veel kommentaaris, mis leidu selgitab. */
  assert.doesNotMatch(source, /await logDocumentsAudit\(/);
  assert.doesNotMatch(source, /import \{ logDocumentsAudit \}/);
  assert.match(source, /import \{ writeDocumentAudit \} from "@\/lib\/documents\/audit"/);

  // Mõlemal formaadil on oma värav ja mõlemad annavad 503, mitte faili.
  const guards = source.match(/catch \(auditError\)/g) || [];
  assert.equal(guards.length, 2, "nii PDF kui DOCX rada vajavad oma väravat");
  const failures = source.match(/api\.chat\.export_audit_failed", 503/g) || [];
  assert.equal(failures.length, 2);

  // Värav peab olema ENNE faili tagastamist, mõlemal rajal.
  for (const marker of ["`${fileBase}.pdf`", "`${fileBase}.docx`"]) {
    const respond = source.indexOf(marker);
    const guard = source.lastIndexOf("await writeExportAudit();", respond);
    assert.ok(guard > 0 && guard < respond, `värav peab olema enne ${marker} tagastamist`);
  }
});

test("kohustuslik auditikirjutaja viskab kaardistamata sündmuse ja kirjutuse vea peale", async () => {
  const { writeDocumentAudit } = await import("../../lib/documents/audit.js");

  await assert.rejects(
    () => writeDocumentAudit("chat.definitely_not_mapped", { userId: "u1" }, { db: {} }),
    (error) => error?.code === "DOCUMENTS_AUDIT_UNMAPPED"
  );

  const exploding = {
    documentAudit: {
      create: async () => {
        throw new Error("DB maas");
      }
    }
  };
  await assert.rejects(
    () => writeDocumentAudit("chat.exported", {
      userId: "u1",
      conversationId: "c1",
      messageId: "m1",
      format: "pdf"
    }, { db: exploding }),
    /DB maas/
  );

  // NEGATIIVKONTROLL: korras kirjutus peab läbi minema, muidu tõendaks „viska alati" sama hästi.
  let written = null;
  const ok = {
    documentAudit: {
      create: async ({ data }) => {
        written = data;
        return { id: "audit-1" };
      }
    }
  };
  await writeDocumentAudit("chat.exported", {
    userId: "u1",
    conversationId: "c1",
    messageId: "m1",
    format: "pdf"
  }, { db: ok });
  assert.equal(written.action, "DOWNLOAD");
  assert.equal(written.meta.conversationId, "c1");
});
