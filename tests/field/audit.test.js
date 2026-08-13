import test from "node:test";
import assert from "node:assert/strict";

import { FIELD_PROVENANCE } from "../../lib/field/constants.js";
import { deleteFieldVisitAttachment } from "../../lib/field/attachments.js";
import { handoverFieldVisit, performFieldVisitAction, putFieldVisitNote } from "../../lib/field/service.js";
import { logDataAudit, writeDataAudit } from "../../lib/privacy/audit.js";
import { createFieldDb, makeVisit } from "../helpers/fieldDb.mjs";

/**
 * SOL-FIELD-03 — KOHUSTUSLIK AUDIT KUULUB PÕHITEHINGUSSE.
 *
 * Vana kood tegi põhikirjutuse süstitud `db`-s ja kutsus siis `logDataAudit()`
 * ILMA sama kliendita. Audit kirjutas alati moodulitaseme globaalse ühenduse
 * kaudu ja neelas iga vea. Tagajärg oli kahekordne:
 *
 *  - TOODANGUS: nõusoleku tagasivõtmine, turvatoiming, üleandmine või manuse
 *    kustutamine võis õnnestuda ilma ühegi tõendita, kes seda tegi.
 *  - TESTIDES: fake-DB-ga roheline test proovis vaikselt PÄRIS andmebaasi
 *    kirjutada, logis ühendusvea ja jäi ikka roheliseks. Olemasolev „audit
 *    trail" test on allika-regex ja annaks rohelise ka täiesti puuduva
 *    auditirea korral.
 *
 * Need testid mõõdavad KIRJET, mitte lähteteksti: iga kohustuslik rada peab
 * jätma rea SÜSTITUD hoidlasse, ja veasüst peab põhitoimingu tagasi pöörama.
 */

const NOW = new Date("2026-08-10T09:00:00.000Z");

const consentNote = (overrides = {}) => ({
  id: "note-consent",
  visitId: "visit-1",
  clientItemId: "fld-consent-0001",
  revision: 1,
  kind: "consent",
  provenance: FIELD_PROVENANCE.KLIENDI_KINNITATUD,
  body: "Nõusolek pildistamiseks.",
  contentSha256: "sha",
  consentKind: "photo",
  consentSubject: "Klient",
  consentForm: "suuline",
  consentWithdrawnAt: null,
  aiConfirmedAt: null,
  conflictState: null,
  conflictRevision: null,
  conflictBody: null,
  conflictProvenance: null,
  deviceCreatedAt: NOW,
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides
});

const attachmentRow = (overrides = {}) => ({
  id: "att-1",
  visitId: "visit-1",
  clientItemId: "fld-photo-000001",
  documentId: "doc-1",
  document: { id: "doc-1", ownerId: "user-1", storagePath: "uploads/sol-field-03-puudub-ketalt.bin" },
  ...overrides
});

/** Veasüst: audit kukub, kõik muu töötab. */
function breakAudit(db) {
  db.dataAuditLog.create = async () => {
    throw new Error("audit_write_failed");
  };
}

/**
 * Veasüsti tõrge peab olema AUDITI oma.
 *
 * `assert.rejects(promise)` üksi rahuldub SUVALISE veaga — kirjutasin selle
 * testi esimest korda nii ja üks „leid ise" test läks roheliseks hoopis
 * `invalid_transition` 409 pealt, mis ei puutu auditisse üldse. Kontroll, mis
 * ei nimeta oodatavat viga, ei mõõda midagi.
 */
async function rejects(promise) {
  await assert.rejects(promise, /audit_write_failed/);
}

/* NEGATIIVKONTROLL KÕIGE EES: iga allolev „tagasi pööratud" väide oleks tühi,
   kui fake-hoidla tehing ei pööraks midagi tagasi. Varem ta ei pööranudki. */
test("fake-hoidla tehing PÄRISELT pöörab tagasi — muidu ei mõõda ükski test allpool midagi", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });

  await assert.rejects(
    db.$transaction(async (tx) => {
      await tx.fieldVisit.updateMany({ where: { id: "visit-1" }, data: { status: "CLOSED" } });
      throw new Error("nurjus");
    })
  );

  assert.equal(db.store.visits[0].status, "IN_PROGRESS", "tehing pidi muudatuse unustama");
});

/* Sulgeda saab AINULT `WRAP_UP` pealt — seisumasin ütleb nii. Kui seda mitte
   arvestada, kukub kutse 409-ga ja veasüsti test läheb roheliseks põhjusel, mis
   ei puutu auditisse. */
test("visiidi sulgemine jätab tõendi SÜSTITUD hoidlasse, mitte kuhugi mujale", async () => {
  const db = createFieldDb({ visits: [makeVisit({ status: "WRAP_UP" })] });

  await performFieldVisitAction("user-1", "visit-1", "close", { version: 1 }, { db, now: NOW });

  assert.equal(db.store.visits[0].status, "CLOSED");
  assert.equal(db.store.auditLog.length, 1, "tõend peab olema samas hoidlas, kus põhikirjutus");
  const row = db.store.auditLog[0];
  assert.equal(row.action, "field.visit_close");
  assert.equal(row.actorUserId, "user-1");
  assert.equal(row.resourceType, "FIELD_VISIT");
  assert.equal(row.resourceId, "visit-1");
});

test("SEE ON LEID ISE: kui tõendit ei saa kirjutada, ei tohi visiit vaikselt sulguda", async () => {
  const db = createFieldDb({ visits: [makeVisit({ status: "WRAP_UP" })] });
  breakAudit(db);

  await rejects(performFieldVisitAction("user-1", "visit-1", "close", { version: 1 }, { db, now: NOW }));

  assert.equal(db.store.visits[0].status, "WRAP_UP", "seis pidi tagasi tulema");
  assert.equal(db.store.visits[0].version, 1, "ka versiooniloendur pidi tagasi tulema");
  assert.equal(db.store.auditLog.length, 0);
});

test("turvatoiming on sama piir: arm_safety kirjutab tõendi, veasüst pöörab relvastuse tagasi", async () => {
  const db = createFieldDb({ visits: [makeVisit()] });
  const payload = {
    version: 1,
    deadlineAt: new Date(NOW.getTime() + 3600 * 1000).toISOString(),
    contactEmail: "kontakt@näidis.test",
    contactName: "Kolleeg"
  };

  await performFieldVisitAction("user-1", "visit-1", "arm_safety", payload, { db, now: NOW });
  assert.equal(db.store.auditLog.at(-1).action, "field.visit_arm_safety");
  assert.ok(db.store.visits[0].safetyArmedAt, "turvatoiming pidi jõustuma");

  const broken = createFieldDb({ visits: [makeVisit()] });
  breakAudit(broken);
  await rejects(performFieldVisitAction("user-1", "visit-1", "arm_safety", payload, { db: broken, now: NOW }));
  assert.equal(broken.store.visits[0].safetyArmedAt, null);
});

/* Auditita rajad EI TOHI tehingut nõuda — muidu oleks parandus vaikne
   jõudluskulu igale klahvivajutusele. */
test("auditita toiming (confirm_arrival) töötab edasi ega kirjuta tõendirida", async () => {
  const db = createFieldDb({ visits: [makeVisit({ status: "PLANNED" })] });

  await performFieldVisitAction("user-1", "visit-1", "confirm_arrival", { version: 1 }, { db, now: NOW });

  assert.ok(db.store.visits[0].arrivedConfirmedAt);
  assert.equal(db.store.auditLog.length, 0);
});

test("nõusoleku tagasivõtmine: tõend on kirjas ja veasüst jätab nõusoleku KEHTIMA", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [consentNote()] });

  await putFieldVisitNote(
    "user-1",
    "visit-1",
    "fld-consent-0001",
    { withdrawConsent: true },
    { db, now: NOW }
  );
  assert.ok(db.store.notes[0].consentWithdrawnAt);
  assert.equal(db.store.auditLog.at(-1).action, "field.consent_withdrawn");

  const broken = createFieldDb({ visits: [makeVisit()], notes: [consentNote()] });
  breakAudit(broken);
  await rejects(
    putFieldVisitNote("user-1", "visit-1", "fld-consent-0001", { withdrawConsent: true }, { db: broken, now: NOW })
  );
  assert.equal(
    broken.store.notes[0].consentWithdrawnAt,
    null,
    "pool tehtud tagasivõtmine ilma tõendita on halvem kui tehtud tagasivõtmine"
  );
});

test("üleandmine artefakti: tõend sünnib SAMAS tehingus mustandi ja templiga", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [consentNote({ kind: "note" })] });

  await handoverFieldVisit("user-1", "visit-1", { clientActionId: "field-audit-artifact-1", toArtifact: true }, { db, now: NOW });

  assert.equal(db.store.artifacts.length, 1);
  const row = db.store.auditLog.at(-1);
  assert.equal(row.action, "field.handover_artifact");
  assert.equal(row.meta.artifactId, db.store.artifacts[0].id, "tõend peab nimetama, MIS artefakt sündis");
});

test("üleandmise veasüst ei jäta maha ei mustandit ega templit", async () => {
  const db = createFieldDb({ visits: [makeVisit()], notes: [consentNote({ kind: "note" })] });
  breakAudit(db);

  const failed = await handoverFieldVisit("user-1", "visit-1", { clientActionId: "field-audit-artifact-2", toArtifact: true }, { db, now: NOW });

  assert.equal(db.store.artifacts.length, 0, "mustand pidi tagasi tulema");
  assert.equal(db.store.visits[0].handoverArtifactAt, null);
  assert.equal(failed.handover.targets.artifact.status, "FAILED");
});

/* AUS PIIR, mis on koodis kommentaarina kirjas: eelpöördumise töövoog commit'ib
   OMA tehingu ja teda ei saa siia sisse mähkida. Atomaarne on välitöö enda
   kirjutus — tempel ja tema tõend. */
test("üleandmine eelpöördumisse: tempel ja tõend käivad koos, töövoog jääb väljapoole", async () => {
  const seed = () => ({
    visits: [makeVisit({ preInquiryId: "inq-1" })],
    preInquiries: [{ id: "inq-1", recipientOwnerId: "user-1", recalledAt: null, receiverNote: null, updatedAt: NOW }]
  });
  const workflow = async (userId, inquiryId, patch) => ({ id: inquiryId, ...patch });

  const db = createFieldDb(seed());
  await handoverFieldVisit(
    "user-1",
    "visit-1",
    { clientActionId: "field-audit-inquiry-1", toPreInquiry: true, preInquiryNote: "Külastus tehtud." },
    { db, now: NOW, workflow }
  );
  assert.ok(db.store.visits[0].handoverPreInquiryAt);
  assert.equal(db.store.auditLog.at(-1).action, "field.handover_pre_inquiry");

  const broken = createFieldDb(seed());
  breakAudit(broken);
  const brokenResult = await handoverFieldVisit(
    "user-1",
    "visit-1",
    { clientActionId: "field-audit-inquiry-2", toPreInquiry: true, preInquiryNote: "Külastus tehtud." },
    { db: broken, now: NOW, workflow }
  );
  assert.equal(broken.store.visits[0].handoverPreInquiryAt, null);
  assert.equal(brokenResult.handover.targets.preInquiry.status, "FAILED");
});

test("manuse kustutus: tõend on kirjas ja veasüst jätab rea alles", async () => {
  const db = createFieldDb({
    visits: [makeVisit()],
    attachments: [attachmentRow()],
    documents: [{ id: "doc-1", ownerId: "user-1", storagePath: "uploads/sol-field-03-puudub-ketalt.bin" }]
  });

  await deleteFieldVisitAttachment("user-1", "visit-1", "fld-photo-000001", { db });
  assert.equal(db.store.attachments.length, 0);
  assert.equal(db.store.documents.length, 0);
  assert.equal(db.store.auditLog.at(-1).action, "field.attachment_deleted");

  const broken = createFieldDb({
    visits: [makeVisit()],
    attachments: [attachmentRow()],
    documents: [{ id: "doc-1", ownerId: "user-1", storagePath: "uploads/sol-field-03-puudub-ketalt.bin" }]
  });
  breakAudit(broken);
  await assert.rejects(
    deleteFieldVisitAttachment("user-1", "visit-1", "fld-photo-000001", { db: broken }),
    (error) => error.status === 503 && error.message === "field.errors.delete_pending"
  );
  assert.equal(broken.store.attachments.length, 1, "rida pidi tagasi tulema");
  assert.equal(broken.store.documents.length, 1);
  assert.equal(broken.store.attachments[0].storageStatus, "DELETE_PENDING");
  assert.equal(broken.store.deletionJobs[0].status, "failed");
});

/* Kohustuslikku kirjet ei tohi saada „täidetuks" kirjaveaga. */
test("writeDataAudit keeldub tühjast tegevusest ja kirjutab AINULT antud kliendiga", async () => {
  const db = createFieldDb({});

  await assert.rejects(writeDataAudit({ db, action: "  " }), /action is required/);
  assert.equal(db.store.auditLog.length, 0);

  await writeDataAudit({ db, action: "field.test", actorUserId: "user-1" });
  assert.equal(db.store.auditLog.length, 1);
});

test("best-effort rada jääb best-effort'iks: viga neelatakse ja tagastatakse null", async () => {
  const db = createFieldDb({});
  breakAudit(db);

  assert.equal(await logDataAudit({ db, action: "field.safety_escalated" }), null);
  assert.equal(await logDataAudit({ db: createFieldDb({}), action: "   " }), null);
});
