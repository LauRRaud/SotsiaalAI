// Faili luba „Luba töörežiimis” siis, kui vana otsinguindeks on suletud.
//
// Viga (kinnitatud brauseris 10.10): loa äravõtmine paneb kirja vana otsingukoopia
// eemaldamise töö. Suletud indeksist ei saa midagi eemaldada, seega jäi töö igaveseks seisu
// „ebaõnnestus”, luba läks lukku ja uuesti lubamine vastas veaga 409. Luba, mis kord ära võeti,
// ei saanud enam tagasi anda.
//
// Reegel on sama mis konto kustutamisel (tests/deletion-with-retired-index.test.mjs): suletud
// indeks ei ole takistus, eemaldamise kohustus jääb kirja koos indeksi viitega.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DOCUMENT_RAG_ACTION, DOCUMENT_RAG_RESOURCE_TYPE,
  assertDocumentRagIngestReady, attemptDocumentRagRemoval, prepareDocumentRagPermissionChange,
} from '../lib/documents/ragPermission.js';
import { unfinishedRagRemoval } from '../lib/documents/ragRemovalState.js';
import { isRagRetiredFailure } from '../lib/privacy/ragDeletionResult.js';
import { deleteRagDocument } from '../lib/documents/ragService.js';
import { RAG_AVAILABLE } from '../lib/rag/retired.js';

const NOW = new Date('2026-10-10T09:00:00Z');
const OWNER = 'user-1';

/* Väike mälus andmebaas: ainult need tabelid ja päringud, mida loa muutmine kasutab. Iga
   kirjutus läheb logisse, et test näeks täpselt, mis ridu puudutati. */
function fakeDb(document) {
  const state = { document: { ...document }, jobs: [], audits: [], writes: [] };
  const matches = (job, where) =>
    (!where.action || job.action === where.action) &&
    (!where.resourceType || job.resourceType === where.resourceType) &&
    (!where.resourceId || job.resourceId === where.resourceId) &&
    (!where.externalRef || job.externalRef === where.externalRef) &&
    (!where.status?.in || where.status.in.includes(job.status));
  const tx = {
    dataDeletionJob: {
      findFirst: async ({ where }) => state.jobs.find((job) => matches(job, where)) || null,
      create: async ({ data }) => {
        const job = { id: `job-${state.jobs.length + 1}`, attempts: 0, ...data };
        state.jobs.push(job);
        state.writes.push('job:create');
        return job;
      },
      update: async ({ where, data }) => {
        const job = state.jobs.find((entry) => entry.id === where.id);
        const { attempts, ...rest } = data;
        Object.assign(job, rest);
        if (attempts?.increment) job.attempts += attempts.increment;
        state.writes.push('job:update');
        return job;
      },
    },
    dataAuditLog: {
      create: async ({ data }) => {
        state.audits.push(data);
        state.writes.push(`audit:${data.action}`);
        return data;
      },
    },
    userDocument: {
      findFirst: async () => state.document,
      update: async ({ data }) => {
        Object.assign(state.document, data);
        state.writes.push('document:update');
        return state.document;
      },
    },
  };
  return { state, tx, db: { ...tx, $transaction: async (run) => run(tx) } };
}

/* Marsruudi sammud: eelsamm ja loa kirjutus ühes tehingus, seejärel eemaldamise katse. */
async function setPermission(store, allowed, { ragAvailable, deleteIndex }) {
  const { state, tx, db } = store;
  const plan = prepareDocumentRagPermissionChange({
    document: state.document, nextAgentAllowed: allowed, metadata: state.document.metadata,
    actorUserId: OWNER, targetUserId: OWNER, now: NOW, ragAvailable,
  });
  const prepared = plan.prepareWithin ? await plan.prepareWithin(tx) : null;
  Object.assign(state.document, { agentAllowed: allowed }, prepared?.data || {});
  state.writes.push(`document:agentAllowed=${allowed}`);
  if (plan.removalRequested) await attemptDocumentRagRemoval({ document: state.document, actorUserId: OWNER, targetUserId: OWNER }, { db, deleteIndex, now: NOW });
  return plan;
}

const retiredIndex = async (externalRef) => deleteRagDocument(externalRef);
const newDocument = () => ({ id: 'doc-1', ownerId: OWNER, sha256: 'a'.repeat(8), agentAllowed: true, metadata: { note: 'jääb alles' } });

test('suletud indeks vastab, et eemaldada ei saa (mitte et eemaldamine õnnestus)', async () => {
  const result = await retiredIndex('agent::doc-1::aaaaaaaa');
  assert.equal(result.ok, false);
  assert.equal(isRagRetiredFailure(result), true);
  /* Marsruut ei anna indeksi seisu kaasa: reegel loeb selle samast kohast (`lib/rag/retired.js`). */
  const plan = prepareDocumentRagPermissionChange({ document: { id: 'doc-1', agentAllowed: false }, nextAgentAllowed: true, metadata: {}, actorUserId: OWNER, targetUserId: OWNER });
  assert.equal(plan.prepareWithin === null, !RAG_AVAILABLE);
});

test('suletud indeksi ajal saab loa ära võtta ja tagasi anda', async () => {
  const store = fakeDb(newDocument());
  const { state } = store;
  const retired = { ragAvailable: false, deleteIndex: retiredIndex };

  /* LOA ÄRAVÕTMINE: töö ja auditiread sünnivad nagu enne; eemaldamise kohustus jääb kirja. */
  await setPermission(store, false, retired);
  assert.equal(state.document.agentAllowed, false);
  assert.equal(state.jobs.length, 1);
  const [job] = state.jobs;
  assert.deepEqual(
    { action: job.action, resourceType: job.resourceType, resourceId: job.resourceId, externalRef: job.externalRef, status: job.status, lastErrorCode: job.lastErrorCode },
    { action: DOCUMENT_RAG_ACTION, resourceType: DOCUMENT_RAG_RESOURCE_TYPE, resourceId: 'doc-1', externalRef: 'agent::doc-1::aaaaaaaa', status: 'failed', lastErrorCode: 'rag_retired' },
  );
  /* Päris katset ei tehtud: katsete varu ei kulu (sama põhimõte mis kustutustööde kordajal). */
  assert.equal(job.attempts, 0);
  assert.deepEqual(state.document.metadata.ragRemoval, { status: 'failed', jobId: job.id, externalRef: job.externalRef, reason: 'rag_retired', checkedAt: NOW.toISOString() });
  assert.equal(state.document.metadata.note, 'jääb alles', 'muud metaandmed jäävad puutumata');
  assert.deepEqual(state.audits.map((row) => row.action), ['RAG_DELETE_REQUESTED', 'RAG_DELETE_PENDING']);
  /* Leht seda seisu takistuseks ei loe: luba ei ole lukus. */
  assert.equal(unfinishedRagRemoval(state.document.metadata.ragRemoval, { ragAvailable: false }), '');

  /* LOA TAGASIANDMINE: kirjutatakse ainult luba ise. Tööd, auditit ega eemaldamise seisu ei
     muudeta ega kustutata. */
  const before = { writes: state.writes.length, job: { ...job }, removal: { ...state.document.metadata.ragRemoval }, audits: state.audits.length };
  const plan = await setPermission(store, true, retired);
  assert.deepEqual({ removalRequested: plan.removalRequested, prepareWithin: plan.prepareWithin }, { removalRequested: false, prepareWithin: null });
  assert.equal(state.document.agentAllowed, true);
  assert.deepEqual(state.writes.slice(before.writes), ['document:agentAllowed=true']);
  assert.deepEqual({ ...state.jobs[0] }, before.job, 'eemaldamise töö jääb alles koos indeksi viitega');
  assert.deepEqual(state.document.metadata.ragRemoval, before.removal);
  assert.equal(state.audits.length, before.audits);

  /* UUS ÄRAVÕTMINE võtab sama töö uuesti kasutusele: teist tööd ei teki ja katseid ei kulu. */
  await setPermission(store, false, retired);
  assert.equal(state.jobs.length, 1);
  assert.equal(state.jobs[0].attempts, 0);
  assert.equal(state.jobs[0].status, 'failed');
  assert.equal(state.document.metadata.ragRemoval.jobId, job.id);
  await setPermission(store, true, retired);
  assert.equal(state.document.agentAllowed, true);
});

test('töötava indeksiga kehtib vana keeld: lõpetamata eemaldamise ajal luba tagasi ei anta', async () => {
  const store = fakeDb(newDocument());
  const { state } = store;
  const failing = { ragAvailable: true, deleteIndex: async () => ({ ok: false, reason: 'timeout' }) };

  await setPermission(store, false, failing);
  assert.equal(state.jobs[0].status, 'failed');
  /* Päris ebaõnnestunud katse kulutab katsete varu. */
  assert.equal(state.jobs[0].attempts, 1);
  assert.equal(unfinishedRagRemoval(state.document.metadata.ragRemoval, { ragAvailable: true }), 'failed');
  await assert.rejects(setPermission(store, true, failing), (error) => error.status === 409 && error.message === 'documents.errors.rag_removal_pending');

  /* Kui eemaldamine õnnestub, on töö tehtud ja luba saab tagasi anda. */
  const working = { ragAvailable: true, deleteIndex: async () => ({ ok: true }) };
  const fresh = fakeDb(newDocument());
  await setPermission(fresh, false, working);
  assert.equal(fresh.state.jobs[0].status, 'done');
  assert.equal(fresh.state.document.metadata.ragRemoval.status, 'done');
  assert.deepEqual(fresh.state.audits.map((row) => row.action), ['RAG_DELETE_REQUESTED', 'RAG_DELETE']);
  await setPermission(fresh, true, working);
  assert.equal(fresh.state.document.agentAllowed, true);
});

test('lõpetamata eemaldamisega faili ei saa indeksisse panna ka siis, kui luba on tagasi antud', async () => {
  /* See kaitse jääb alles ajaks, kui indeks tagasi tuleb: suletud indeksi ajal tagasi antud luba
     ei ava teed uue koopia tegemiseks enne, kui vana on eemaldatud. */
  const store = fakeDb(newDocument());
  await setPermission(store, false, { ragAvailable: false, deleteIndex: retiredIndex });
  await setPermission(store, true, { ragAvailable: false, deleteIndex: retiredIndex });
  await assert.rejects(assertDocumentRagIngestReady(store.state.document, { db: store.db }), (error) => error.status === 409 && error.message === 'documents.errors.rag_removal_pending');
  /* Fail, millel lõpetamata eemaldamist ei ole, on valmis. */
  assert.equal(await assertDocumentRagIngestReady({ id: 'doc-2', agentAllowed: true }, { db: fakeDb(newDocument()).db }), true);
});

test('muutmata luba ei kirjuta midagi', () => {
  for (const agentAllowed of [true, false]) {
    for (const ragAvailable of [true, false]) {
      const plan = prepareDocumentRagPermissionChange({ document: { id: 'doc-1', agentAllowed }, nextAgentAllowed: agentAllowed, metadata: {}, actorUserId: OWNER, targetUserId: OWNER, ragAvailable });
      assert.deepEqual(plan, { removalRequested: false, prepareWithin: null });
    }
  }
});
