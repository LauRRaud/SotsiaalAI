import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { FIELD_PROVENANCE } from "../../lib/field/constants.js";
import {
  getFieldVisitDetail,
  putFieldVisitNote,
  performFieldVisitAction,
  handoverFieldVisit
} from "../../lib/field/service.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

const NOW = new Date("2026-07-18T12:00:00.000Z");
const SCHEMA = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
const SERVICE_SOURCE = readFileSync(new URL("../../lib/field/service.js", import.meta.url), "utf8");
const ATTACHMENTS_SOURCE = readFileSync(new URL("../../lib/field/attachments.js", import.meta.url), "utf8");

const SECRET_BODY = "Klient rääkis vägivallast kodus.";
const SECRET_LOCATION = "Kase talu, Väikeküla";
const SECRET_GOAL = "Kontrollida laste turvalisust";

function model(name) {
  const match = SCHEMA.match(new RegExp(`model ${name} \\{[\\s\\S]*?\\n\\}`, "u"));
  assert.ok(match, `schema declares model ${name}`);
  return match[0];
}

async function status(promise) {
  try {
    return { value: await promise, status: null };
  } catch (error) {
    return { value: null, status: error.status, message: error.message };
  }
}

test("the visit pack carries no pre-inquiry case content onto the device (doc 4.1 whitelist)", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ preInquiryId: "inq-1", goal: SECRET_GOAL, locationText: SECRET_LOCATION })],
    preInquiries: [
      {
        id: "inq-1",
        recipientOwnerId: "user-1",
        status: "SENT",
        nextContactOn: null,
        updatedAt: NOW,
        recalledAt: null,
        // None of the following may ever leave the server for the offline pack.
        topic: "Perevägivald",
        situation: "Pikk kirjeldus kliendi olukorrast.",
        generatedDraft: "AI koostatud mustand.",
        userEditedDraft: "Kasutaja muudetud mustand.",
        assessmentState: { risk: "high" },
        authorId: "user-9"
      }
    ]
  });

  const detail = await getFieldVisitDetail("user-1", "visit-1", { db });

  assert.deepEqual(Object.keys(detail.preInquiry).sort(), ["id", "nextContactOn", "status", "updatedAt"]);
  const serialized = JSON.stringify(detail);
  for (const leak of [
    "Perevägivald",
    "Pikk kirjeldus kliendi olukorrast.",
    "AI koostatud mustand.",
    "Kasutaja muudetud mustand.",
    "user-9",
    "high"
  ]) {
    assert.equal(serialized.includes(leak), false, `pack must not carry ${leak}`);
  }
});

test("field work never reaches the logs: no body, location text or goal is printed", async () => {
  const db = createFieldDb({
    visits: [makeVisit({ goal: SECRET_GOAL, locationText: SECRET_LOCATION })]
  });

  const captured = [];
  const original = { log: console.log, error: console.error, warn: console.warn, info: console.info };
  for (const level of Object.keys(original)) {
    console[level] = (...args) => {
      captured.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
    };
  }

  try {
    await putFieldVisitNote(
      "user-1",
      "visit-1",
      "fld-note-000001",
      { kind: "note", provenance: FIELD_PROVENANCE.KLIENDI_OELDUD, body: SECRET_BODY, revision: 1 },
      { db, now: NOW }
    );
    await performFieldVisitAction(
      "user-1",
      "visit-1",
      "arm_safety",
      {
        version: 1,
        deadlineAt: new Date(NOW.getTime() + 3600_000).toISOString(),
        contactEmail: "usaldus@example.test",
        instructions: SECRET_LOCATION
      },
      { db, now: NOW }
    );
    await handoverFieldVisit(
      "user-1",
      "visit-1",
      { clientActionId: "field-privacy-action-1", toArtifact: true },
      { db, now: NOW }
    );
    await status(getFieldVisitDetail("user-1", "missing-visit", { db }));
  } finally {
    for (const [level, fn] of Object.entries(original)) console[level] = fn;
  }

  const output = captured.join("\n");
  for (const secret of [SECRET_BODY, SECRET_LOCATION, SECRET_GOAL, "usaldus@example.test"]) {
    assert.equal(output.includes(secret), false, `logs must not contain ${secret}`);
  }
});

test("the audit trail records who did what, never the content", async () => {
  // Every logDataAudit call in the field service passes ids only — a meta
  // payload carrying note text would be a privacy regression.
  const metas = [...SERVICE_SOURCE.matchAll(/meta:\s*\{([^}]*)\}/gu)].map((match) => match[1]);
  assert.ok(metas.length > 0, "the service writes audit metadata");
  for (const meta of metas) {
    assert.match(meta.trim(), /^[A-Za-z]+Id(:\s*[A-Za-z.]+)?$/u, `audit meta must be id-only, saw: ${meta.trim()}`);
  }
  assert.equal(/action:\s*`?["'`]?field\.[a-z_]+/u.test(SERVICE_SOURCE), true);
});

test("a consent record must name a known consent kind and cannot be forged", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  const bad = await status(
    putFieldVisitNote(
      "user-1",
      "visit-1",
      "fld-consent-0001",
      { kind: "consent", provenance: FIELD_PROVENANCE.KLIENDI_KINNITATUD, body: "Nõusolek", consentKind: "telepathy", revision: 1 },
      { db, now: NOW }
    )
  );

  assert.equal(bad.status, 400);
  assert.equal(bad.message, "field.errors.invalid_consent_kind");
  assert.equal(db.store.notes.length, 0);
});

test("withdrawing consent is recorded, idempotent and visible to the UI", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-consent-0001",
    {
      kind: "consent",
      provenance: FIELD_PROVENANCE.KLIENDI_KINNITATUD,
      body: "Nõusolek pildistamiseks",
      consentKind: "photo",
      revision: 1
    },
    { db, now: NOW }
  );

  const withdrawn = await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-consent-0001",
    { withdrawConsent: true },
    { db, now: NOW }
  );
  assert.equal(withdrawn.withdrawn, true);
  assert.equal(withdrawn.note.consentWithdrawnAt, NOW.toISOString());

  // A second withdrawal keeps the original timestamp instead of resetting it.
  const later = new Date(NOW.getTime() + 60_000);
  const again = await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-consent-0001",
    { withdrawConsent: true },
    { db, now: later }
  );
  assert.equal(again.note.consentWithdrawnAt, NOW.toISOString());
});

test("withdrawing something that is not a consent record is a 404, not a silent success", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-note-000001",
    { kind: "note", provenance: FIELD_PROVENANCE.TOOTAJA_TAHELEPANEK, body: "Tavaline märge", revision: 1 },
    { db, now: NOW }
  );

  const failure = await status(
    putFieldVisitNote("user-1", "visit-1", "fld-note-000001", { withdrawConsent: true }, { db, now: NOW })
  );

  assert.equal(failure.status, 404);
  assert.equal(db.store.notes[0].consentWithdrawnAt, undefined);
});

test("a withdrawn consent no longer unlocks new uploads", () => {
  // The upload gate reads the consent record; a withdrawn one must not match.
  const gate = ATTACHMENTS_SOURCE.match(/async function assertConsent[\s\S]*?\n\}/u);
  assert.ok(gate, "attachments module keeps a consent gate");
  assert.match(gate[0], /kind:\s*FIELD_NOTE_KIND\.CONSENT/u);
  assert.match(gate[0], /consentKind:\s*expectedKind/u);
  assert.match(gate[0], /consentWithdrawnAt:\s*null/u);
  assert.match(gate[0], /consent_required/u);
});

test("attachment deletion uses a durable tombstone and restart reconciler", () => {
  const start = ATTACHMENTS_SOURCE.indexOf("export async function deleteFieldVisitAttachment");
  assert.ok(start > -1, "attachments module exposes a delete path");
  const remover = ATTACHMENTS_SOURCE.slice(start, ATTACHMENTS_SOURCE.indexOf("\nexport ", start + 1));

  assert.match(remover, /storageStatus:\s*"DELETE_PENDING"/u);
  assert.match(remover, /FIELD_FILE_ACTION\.DELETE/u);
  assert.match(remover, /reconcileFieldVisitFileJobs/u);
  assert.match(remover, /field\.errors\.delete_pending/u);
});

test("account deletion reaches every field model through declared cascades", () => {
  const visit = model("FieldVisit");
  const note = model("FieldVisitNote");
  const attachment = model("FieldVisitAttachment");

  // User -> FieldVisit -> notes/attachments all cascade, so deleting the
  // account removes the field layer with it.
  assert.match(visit, /owner\s+User\s+@relation\("FieldVisitOwner".*onDelete:\s*Cascade/u);
  assert.match(note, /visit\s+FieldVisit\s+@relation\(.*onDelete:\s*Cascade/u);
  assert.match(attachment, /visit\s+FieldVisit\s+@relation\(.*onDelete:\s*Cascade/u);

  // Cross-module links must NOT cascade: a deleted pre-inquiry or document
  // leaves an honest dangling marker rather than shredding the visit.
  assert.match(visit, /preInquiry\s+PreInquiry\?\s+@relation\(.*onDelete:\s*SetNull/u);
  assert.match(attachment, /document\s+UserDocument\?\s+@relation\(.*onDelete:\s*SetNull/u);
});

test("the item identity is unique per visit, so a replayed device item cannot fork", () => {
  assert.match(model("FieldVisitNote"), /@@unique\(\[visitId,\s*clientItemId\]\)/u);
  assert.match(model("FieldVisitAttachment"), /@@unique\(\[visitId,\s*clientItemId\]\)/u);
});
