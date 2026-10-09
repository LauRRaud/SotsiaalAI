// Konto kustutamine ja säilitusaja pühkimine siis, kui vana otsinguindeks on välja lülitatud.
//
// Viga: indeks lülitati välja 05.09.2026 ja dokumendi eemaldamine indeksist vastab sellest
// ajast alati „ei õnnestunud". Konto kustutamine ja pühkimine lugesid seda takistuseks:
// dokumendi fail kustutati, aga konto ega dokumendi rida ei kustunud kunagi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isRagRetiredFailure, ragDeletionBlocks } from '../lib/privacy/ragDeletionResult.js';
import { runUserDeletionCleanup } from '../lib/privacy/userDeletionOrchestrator.js';
import { sweepFieldRetention } from '../lib/field/retentionSweep.js';

const retired = { ok: false, pending: true, retired: true, externalRef: 'agent::doc-1::abc' };
const transient = { ok: false, pending: true, retired: false, externalRef: 'agent::doc-1::abc' };

test('väljalülitatud indeks ei ole takistus, muu ebaõnnestumine on', () => {
  assert.equal(isRagRetiredFailure({ ok: false, reason: 'rag_retired' }), true);
  assert.equal(isRagRetiredFailure({ ok: false, error: { code: 'RAG_RETIRED' } }), true);
  for (const other of [{ ok: false, reason: 'timeout' }, { ok: false, error: new Error('ECONNREFUSED') }, { ok: true }, null, undefined]) {
    assert.equal(isRagRetiredFailure(other), false);
  }
  assert.equal(ragDeletionBlocks({ ok: true }), false);
  assert.equal(ragDeletionBlocks({ ok: true, skipped: true }), false);
  assert.equal(ragDeletionBlocks(retired), false);
  /* Kõik muu peatab: ajutine rike, ebamäärane vastus, vastuse puudumine. */
  for (const blocking of [transient, { ok: false }, { ok: 'yes' }, { retired: 'yes' }, {}, null, undefined]) {
    assert.equal(ragDeletionBlocks(blocking), true, JSON.stringify(blocking));
  }
});

function accountCleanup(ragResult, { fileOk = true } = {}) {
  const calls = [];
  const run = runUserDeletionCleanup({
    targets: { documents: [{ id: 'doc-1' }, { id: 'doc-2' }], retainedDocuments: [], materialSubmissions: [], artifacts: [], preInquirySourceIds: [] },
    user: { email: 'lahkuja@example.invalid' },
    targetUserId: 'user-1',
    deleteRagReference: async (document) => { calls.push(`rag:${document.id}`); return ragResult; },
    deleteDocumentFile: async (document) => { calls.push(`file:${document.id}`); return { ok: fileOk }; },
    deleteMaterialFile: async () => ({ ok: true }),
    recordArtifact: async () => {},
    deleteVerificationTokens: async () => {},
    deleteChatLogs: async () => {},
    deleteUser: async (id) => { calls.push(`user:${id}`); return {}; }
  });
  return { calls, run };
}

test('konto kustutamine jõuab lõpuni, kui indeks on välja lülitatud', async () => {
  const { calls, run } = accountCleanup(retired);
  const result = await run;
  assert.equal(result.ok, true);
  assert.deepEqual(calls, ['rag:doc-1', 'file:doc-1', 'rag:doc-2', 'file:doc-2', 'user:user-1']);
});

test('konto kustutamine jääb ootele, kui indeksist eemaldamine päriselt ebaõnnestus või faili ei saanud kustutada', async () => {
  const failing = accountCleanup(transient);
  const result = await failing.run;
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures.map((item) => `${item.stage}:${item.resourceId}`), ['rag:doc-1', 'rag:doc-2']);
  assert.equal(failing.calls.some((call) => call.startsWith('user:')), false);

  const noFile = accountCleanup(retired, { fileOk: false });
  const fileResult = await noFile.run;
  assert.equal(fileResult.ok, false);
  assert.deepEqual(fileResult.failures.map((item) => item.stage), ['file', 'file']);
  assert.equal(noFile.calls.some((call) => call.startsWith('user:')), false);
});

function fieldSweep(ragResult, { fileOk = true } = {}) {
  const calls = [];
  const document = { id: 'audio-1', ownerId: 'user-1', storagePath: 'uploads/audio-1.m4a', sha256: 'a'.repeat(64) };
  const db = {
    fieldVisit: { deleteMany: async () => ({ count: 0 }) },
    fieldVisitAttachment: { findMany: async () => [{ document }] },
    userDocument: { deleteMany: async () => { calls.push('row'); return { count: 1 }; } },
    /* Auditirida kirjutatakse sama süstitud kliendiga. */
    dataAuditLog: { create: async () => ({}) }
  };
  const helpers = {
    deleteDocumentRagReference: async () => { calls.push('rag'); return ragResult; },
    deleteTrackedStorageFile: async () => { calls.push('file'); return { ok: fileOk }; },
    deleteStoredDocument: async () => {}
  };
  return { calls, run: sweepFieldRetention({ db, now: new Date('2026-10-09T08:00:00Z'), helpers }) };
}

test('toorheli pühkimine: väljalülitatud indeksiga kustuvad nii fail kui rida', async () => {
  const { calls, run } = fieldSweep(retired);
  const counts = await run;
  assert.deepEqual(calls, ['rag', 'file', 'row']);
  assert.equal(counts.fieldAudio, 1);
});

test('toorheli pühkimine: takistuse korral ei kustutata faili enne rida ära', async () => {
  /* Indeksi päris rike: faili ei puudutata, rida jääb terve dokumendina järgmist pühkimist ootama. */
  const blocked = fieldSweep(transient);
  const blockedCounts = await blocked.run;
  assert.deepEqual(blocked.calls, ['rag']);
  assert.equal(blockedCounts.fieldAudio, 0);
  /* Faili ei saanud kustutada: rida jääb alles. */
  const noFile = fieldSweep(retired, { fileOk: false });
  await noFile.run;
  assert.deepEqual(noFile.calls, ['rag', 'file']);
});

test('üldine dokumentide pühkimine ja indeksist eemaldamine kasutavad sama reeglit', () => {
  const retention = readFileSync(new URL('../lib/retention.js', import.meta.url), 'utf8');
  const loop = retention.slice(retention.indexOf('for (const document of staleDocuments)'));
  const check = loop.indexOf('if (ragDeletionBlocks(ragResult)) continue;');
  const file = loop.indexOf('await deleteTrackedStorageFile({');
  assert.ok(check > 0 && file > check, 'indeksi tulemust vaadatakse enne faili kustutamist');
  assert.equal(/!ragResult\.ok \|\| !fileResult\.ok/.test(retention), false);
  const deletion = readFileSync(new URL('../lib/privacy/documentDeletion.js', import.meta.url), 'utf8');
  assert.match(deletion, /return \{ ok: false, pending: true, retired: isRagRetiredFailure\(result\), externalRef, error: result\.error \}/);
});
