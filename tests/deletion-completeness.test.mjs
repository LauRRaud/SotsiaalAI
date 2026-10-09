// Audit F-ERR-01 ja F-ERR-03 — kustutamine ei jää poolikuks nii, et inimesele öeldakse
// „kustutatud", aga osa tema andmetest on alles ja neid ei leia enam keegi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deleteDocumentFileAndRecord } from '../lib/documents/deleteDocumentRecord.js';
import { deleteWellbeingRecordForUser } from '../lib/wellbeing/records.js';

/* ---------- F-ERR-03: dokumendi fail ja rida ---------- */

function documentSteps({ file = { ok: true }, record = { id: 'doc-1' } } = {}) {
  const calls = [];
  const steps = {
    calls,
    /* Muudetav, et ka `undefined` saaks faili kustutuse vastuseks olla. */
    fileResult: file,
    deleteFile: async () => {
      calls.push('file');
      if (steps.fileResult instanceof Error) throw steps.fileResult;
      return steps.fileResult;
    },
    deleteRecord: async () => {
      calls.push('record');
      if (record instanceof Error) throw record;
      return record;
    }
  };
  return steps;
}

test('F-ERR-03: fail kustutatakse enne rida ja rida ainult siis, kui fail on läinud', async () => {
  const steps = documentSteps();
  assert.deepEqual(await deleteDocumentFileAndRecord(steps), { id: 'doc-1' });
  assert.deepEqual(steps.calls, ['file', 'record']);
  /* Failita dokument (salvestusteed ei ole): kustutada ei ole midagi ja rida läheb. */
  const skipped = documentSteps({ file: { ok: true, skipped: true } });
  await deleteDocumentFileAndRecord(skipped);
  assert.deepEqual(skipped.calls, ['file', 'record']);
});

test('F-ERR-03: kui faili ei saanud kustutada (või kustutustööd luua), jääb rida alles', async () => {
  const cause = new Error('deletion_job_create_failed');
  const steps = documentSteps({ file: { ok: false, error: cause, jobId: null } });
  await assert.rejects(
    deleteDocumentFileAndRecord(steps),
    (error) => error.status === 503 && error.message === 'documents.errors.delete_failed' && error.cause === cause
  );
  assert.deepEqual(steps.calls, ['file']);
  /* Ainult selge „õnnestus" loeb: ebamäärane vastus ei luba rida kustutada. */
  for (const unclear of [undefined, null, {}, { ok: 'yes' }, { ok: 1 }, { skipped: true }]) {
    const vague = documentSteps();
    vague.fileResult = unclear;
    await assert.rejects(deleteDocumentFileAndRecord(vague), (error) => error.status === 503, JSON.stringify(unclear));
    assert.deepEqual(vague.calls, ['file']);
  }
  /* Ka visatud viga jätab rea alles. */
  const thrown = documentSteps({ file: new Error('EACCES') });
  await assert.rejects(deleteDocumentFileAndRecord(thrown), /EACCES/);
  assert.deepEqual(thrown.calls, ['file']);
});

test('F-ERR-03: rea kustutuse viga jõuab kutsujani (rida jääb nähtavaks ja kordus on võimalik)', async () => {
  const steps = documentSteps({ record: new Error('P2025') });
  await assert.rejects(deleteDocumentFileAndRecord(steps), /P2025/);
  assert.deepEqual(steps.calls, ['file', 'record']);
});

test('F-ERR-03: dokumendi kustutamise marsruut kasutab seda järjekorda ja kirjutab auditi pärast kustutust', () => {
  const route = readFileSync(new URL('../app/api/documents/[id]/route.js', import.meta.url), 'utf8');
  const helper = route.indexOf('await deleteDocumentFileAndRecord({');
  assert.ok(helper > 0);
  /* Fail kustutatakse rea järgi, mis on alles (mitte kustutatud rea vastuse järgi). */
  assert.match(route, /storagePath: existing\.storagePath,\s+deleteFile: deleteStoredDocument/);
  /* „Kustutatud" auditiread tulevad pärast kustutust, mitte enne. */
  assert.ok(route.indexOf('action: "DOCUMENT_DELETE"') > helper);
  assert.ok(route.indexOf('logDocumentsAudit("document.deleted"') > helper);
  /* Faili viga on aus 503, mitte „kustutatud". */
  assert.match(route, /error\?\.status === 503[\s\S]{0,400}errorJson\("documents\.errors\.delete_failed", 503, locale\)/);
  /* Vana järjekord (rida enne, fail pärast, viga ainult logisse) ei ole enam kuskil kasutusel. */
  const helperSource = readFileSync(new URL('../lib/documents/deleteDocumentRecord.js', import.meta.url), 'utf8');
  assert.equal(/deleteDocumentRecordAndFile|onFileDeleteError/.test(route + helperSource), false);
});

/* ---------- F-ERR-01: tööheaolu kirje ja selle mustandid ---------- */

function wellbeingDb({ transactional = true } = {}) {
  const state = {
    records: [{ id: 'rec-1', ownerUserId: 'owner-1' }],
    drafts: [
      { id: 'd1', userId: 'owner-1', sourceRecordId: 'rec-1' },
      { id: 'd2', userId: 'owner-1', sourceRecordId: 'rec-1' },
      { id: 'd3', userId: 'owner-1', sourceRecordId: 'rec-other' },
      { id: 'd4', userId: 'someone-else', sourceRecordId: 'rec-1' }
    ],
    failDrafts: false,
    clients: []
  };
  const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value);
  const client = (name) => ({
    wellbeingRecord: {
      deleteMany: async ({ where }) => {
        state.clients.push(`${name}:record`);
        const before = state.records.length;
        state.records = state.records.filter((row) => !matches(row, where));
        return { count: before - state.records.length };
      }
    },
    wellbeingOutputDraft: {
      deleteMany: async ({ where }) => {
        state.clients.push(`${name}:drafts`);
        if (state.failDrafts) throw new Error('SYNTHETIC_DB_FAILURE');
        const before = state.drafts.length;
        state.drafts = state.drafts.filter((row) => !matches(row, where));
        return { count: before - state.drafts.length };
      }
    }
  });
  const db = client('outer');
  if (transactional) {
    /* Tehing: viga taastab seisu, nagu andmebaas teeb. */
    db.$transaction = async (work) => {
      const snapshot = { records: [...state.records], drafts: [...state.drafts] };
      try {
        return await work(client('tx'));
      } catch (error) {
        state.records = snapshot.records;
        state.drafts = snapshot.drafts;
        throw error;
      }
    };
  }
  return { db, state };
}

test('F-ERR-01: mustandite kustutuse viga pöörab ka kirje kustutuse tagasi ja kordus teeb mõlemad', async () => {
  const { db, state } = wellbeingDb();
  state.failDrafts = true;
  await assert.rejects(deleteWellbeingRecordForUser('owner-1', 'rec-1', { prisma: db, deleteDrafts: true }), /SYNTHETIC_DB_FAILURE/);
  /* Kirje on alles: inimesele ei öeldud „kustutatud" ja midagi ei jäänud poolikuks. */
  assert.equal(state.records.length, 1);
  assert.equal(state.drafts.length, 4);

  state.failDrafts = false;
  const retry = await deleteWellbeingRecordForUser('owner-1', 'rec-1', { prisma: db, deleteDrafts: true });
  assert.deepEqual(retry, { deleted: true, count: 1, draftsDeleted: 2 });
  assert.equal(state.records.length, 0);
  /* Alles jäävad teise kirje mustand ja teise inimese mustand. */
  assert.deepEqual(state.drafts.map((row) => row.id), ['d3', 'd4']);
  /* Mõlemad kustutused käisid tehingu kliendi kaudu, mitte välise kaudu. */
  assert.equal(state.clients.some((entry) => entry.startsWith('outer:')), false);
});

test('F-ERR-01: valik jääb teadlikuks ja omaniku piir samaks', async () => {
  /* Ilma valikuta mustandeid ei puudutata. */
  const kept = wellbeingDb();
  assert.deepEqual(await deleteWellbeingRecordForUser('owner-1', 'rec-1', { prisma: kept.db }), { deleted: true, count: 1, draftsDeleted: 0 });
  assert.equal(kept.state.drafts.length, 4);
  assert.equal(kept.state.clients.some((entry) => entry.endsWith(':drafts')), false);

  /* Võõras kirje: midagi ei kustu, ka mitte kutsuja enda mustandid. */
  const foreign = wellbeingDb();
  assert.deepEqual(await deleteWellbeingRecordForUser('someone-else', 'rec-1', { prisma: foreign.db, deleteDrafts: true }), { deleted: false, count: 0, draftsDeleted: 0 });
  assert.equal(foreign.state.records.length, 1);
  assert.equal(foreign.state.drafts.length, 4);

  /* Kutsuja, kes on juba tehingu sees (kliendil ei ole oma tehingut), jookseb otse. */
  const inner = wellbeingDb({ transactional: false });
  assert.deepEqual(await deleteWellbeingRecordForUser('owner-1', 'rec-1', { prisma: inner.db, deleteDrafts: true }), { deleted: true, count: 1, draftsDeleted: 2 });
});
