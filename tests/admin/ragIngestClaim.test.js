/**
 * SOL-RAGADMIN-03 — ingest'i lukk on atomaarne, tähtajaline ja taastuv.
 *
 * MIDA SIIN TÕENDATAKSE. Ingest kontrollis LOETUD objektilt, kas seis on
 * `INGESTING`, ja seadis seisu hiljem TINGIMUSETA `update`-iga. Kaks päringut
 * läbisid mõlemad eelkontrolli. Katkestus pärast seisu muutmist jättis rea
 * igaveseks `INGESTING`-usse, sest sünkroniseerija säilitas seda seisu alati. Ja
 * kui DB lõpu-update kukkus pärast ÕNNESTUNUD RAG-kirjutust, märgiti rida
 * `ERROR`-iks, kuigi dokument oli teenuses aktiivne.
 *
 * TESTI KUJU TULEB KRITEERIUMIST: „testid peavad katma kaks paralleelset
 * käivitust, katkestuse pärast claim'i ja DB vea pärast edukat RAG vastust."
 * Seepärast on siin maailmamudel (rida + RAG-dokumendid + jooksvad ingest'id) ja
 * iga stsenaarium lõpeb SAMA kontrolliga — `assertInvariant()`.
 *
 * INVARIANT ON KOLMEOSALINE, iga osa leiu enda peegel:
 *   1. korraga jookseb ÜKS ingest
 *   2. `INGESTED` ⇒ dokument ON RAG-is
 *   3. `ERROR` ⇒ dokumenti EI OLE RAG-is
 * Klausel 3 kehtib selles mudelis, sest iga stsenaarium algab TÜHJAST RAG-ist:
 * seega „dokument on olemas" saab tulla ainult sellest katsest endast.
 *
 * NEGATIIVKONTROLLID ON SISSE EHITATUD: sama süst käib läbi ka VANA raja
 * (`legacyIngest`) ja seal peab invariant KATKEMA — nii paralleelsuse kui
 * ERROR-valeväite peal.
 *
 * MIDA SEE FAIL EI TÕENDA: et PostgreSQL kahe samaaegse `UPDATE ... WHERE` vahel
 * võitja välja valib. Fake hindab minu `where`-puud, mitte andmebaasi semantikat.
 * Selle jaoks on `npm run kov:claim:probe`.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  claimIngestLease,
  clearedIngestClaim,
  finishIngestClaim,
  hasLiveIngestClaim,
  ingestClaimConflictError,
  INGEST_LANES,
  INGEST_LEASE_MS,
  isIngestClaimExpired,
  releaseIngestClaimWithError
} from "../../lib/admin/rag/ingestClaim.js";
import {
  INGEST_INTERRUPTED,
  RAG_PRESENCE,
  reconcileStaleIngestClaim
} from "../../lib/admin/rag/ingestReconcile.js";

const lane = INGEST_LANES.KOV_WEB;
const DOC_ID = "kov-harku";
const NOW = new Date("2026-08-09T12:00:00.000Z");
const ROW_ID = "kov_1";

/** Maailm: üks admini rida + RAG-i dokumendid + parasjagu jooksvad ingest'id. */
function world({ status = "READY", claimId = null, claimedAt = null, ragDocs = [] } = {}) {
  return {
    row: {
      id: ROW_ID,
      ingestStatus: status,
      ingestClaimId: claimId,
      ingestClaimedAt: claimedAt,
      lastIngestError: null,
      lastIngestedAt: null,
      ragDocId: DOC_ID
    },
    ragDocs: new Set(ragDocs),
    running: new Set(),
    /* Tipp, mitte hetkeseis: „korraga jookseb üks" on väide AJA KOHTA ja
       lõppseisus on jooksjaid alati null. */
    peakRunning: 0
  };
}

function enter(state, token) {
  state.running.add(token);
  state.peakRunning = Math.max(state.peakRunning, state.running.size);
}

function leave(state, token) {
  state.running.delete(token);
}

function assertInvariant(state, label) {
  assert.ok(
    state.peakRunning <= 1,
    `${label}: korraga jooksis ${state.peakRunning} ingest'i sama doc_id peal`
  );
  if (state.row.ingestStatus === "INGESTED") {
    assert.ok(
      state.ragDocs.has(state.row.ragDocId),
      `${label}: DB ütleb INGESTED, aga RAG-is dokumenti ei ole`
    );
  }
  if (state.row.ingestStatus === "ERROR") {
    assert.ok(
      !state.ragDocs.has(state.row.ragDocId),
      `${label}: DB ütleb ERROR, aga dokument ON RAG-is aktiivne`
    );
  }
}

/**
 * Fake-delegaat, mis hindab PÄRISELT seda `where`-puud, mille protokoll ehitab.
 * Delegaat, mis `where`-i ignoreeriks, oleks selle leiu juures kasutu — kogu
 * parandus ON tingimus.
 */
function delegateFor(state) {
  const matchesLeaf = (row, field, condition) => {
    if (condition === null) return row[field] === null;
    if (condition && typeof condition === "object") {
      if ("not" in condition) return row[field] !== condition.not;
      if ("lt" in condition) {
        const value = row[field];
        if (!value) return false;
        return new Date(value).getTime() < new Date(condition.lt).getTime();
      }
      throw new Error(`fake ei tunne tingimust: ${JSON.stringify(condition)}`);
    }
    return row[field] === condition;
  };

  const matches = (row, where) =>
    Object.entries(where).every(([key, condition]) => {
      if (key === "OR") return condition.some(branch => matches(row, branch));
      return matchesLeaf(row, key, condition);
    });

  return {
    async updateMany({ where, data }) {
      if (!matches(state.row, where)) return { count: 0 };
      Object.assign(state.row, data);
      return { count: 1 };
    }
  };
}

/** UUS rada, sama kuju mis `ingestKovEntryBySlug`-il. */
async function runIngest(state, { failAt = null, now = NOW, leaseMs = INGEST_LEASE_MS, hold = null } = {}) {
  const delegate = delegateFor(state);
  const claim = await claimIngestLease({ delegate, id: ROW_ID, lane, docId: DOC_ID, now, leaseMs });
  if (!claim.ok) return { ok: false, reason: claim.reason, conflict: ingestClaimConflictError() };

  enter(state, claim.claimId);
  let ragWriteCompleted = false;
  try {
    if (hold) await hold();
    enter(state, claim.claimId);
    if (failAt === "before_rag") {
      const error = new Error("rag.md is empty");
      error.status = 400;
      throw error;
    }

    state.ragDocs.add(DOC_ID);
    ragWriteCompleted = true;

    if (failAt === "after_rag") throw new Error("DB ei vastanud");

    const finished = await finishIngestClaim({
      delegate,
      id: ROW_ID,
      lane,
      claimId: claim.claimId,
      docId: DOC_ID,
      ingestedAt: now
    });
    if (!finished.ok) {
      const error = new Error("claim was taken over");
      error.code = "ingest_claim_lost";
      throw error;
    }
    return { ok: true, claimId: claim.claimId };
  } catch (error) {
    if (!ragWriteCompleted) {
      await releaseIngestClaimWithError({
        delegate,
        id: ROW_ID,
        lane,
        claimId: claim.claimId,
        message: String(error.message),
        docId: DOC_ID
      });
    }
    return { ok: false, error, ragWriteCompleted, claimId: claim.claimId };
  } finally {
    leave(state, claim.claimId);
  }
}

/**
 * VANA rada, sõna-sõnalt nii nagu ta enne SOL-RAGADMIN-03 oli: eelkontroll
 * LOETUD objektilt, seejärel tingimusteta kirjutus.
 */
function legacyRead(state) {
  return { ...state.row };
}
async function legacyIngest(state, snapshot, { failAt = null, hold = null } = {}) {
  if (snapshot.ingestStatus === "INGESTING") return { ok: false, reason: "in_progress" };

  /* Tingimusteta update — siin ei hoia miski kinni. */
  state.row.ingestStatus = "INGESTING";
  state.row.lastIngestError = null;
  const token = `legacy_${state.running.size + 1}_${state.peakRunning}`;
  enter(state, token);

  try {
    if (hold) await hold();
    enter(state, token);
    state.ragDocs.add(DOC_ID);
    if (failAt === "after_rag") throw new Error("DB ei vastanud");
    state.row.ingestStatus = "INGESTED";
    state.row.lastIngestedAt = NOW;
    return { ok: true };
  } catch (error) {
    /* Vana `catch`: märgi ERROR-iks — ka siis, kui RAG-kirjutus JUBA õnnestus. */
    state.row.ingestStatus = "ERROR";
    state.row.lastIngestError = String(error.message);
    return { ok: false, error };
  } finally {
    leave(state, token);
  }
}

/* ── 1. tavajuht ─────────────────────────────────────────────────────────── */

test("SOL-RAGADMIN-03: õnnestunud ingest võtab luku, kirjutab tulemuse ja vabastab lease'i", async () => {
  const state = world();

  const result = await runIngest(state);

  assert.equal(result.ok, true);
  assert.equal(state.row.ingestStatus, "INGESTED");
  assert.equal(state.row.ingestClaimId, null, "lease jäi vabastamata");
  assert.equal(state.row.ingestClaimedAt, null);
  assert.deepEqual(state.row.lastIngestedAt, NOW);
  assertInvariant(state, "1");
});

/* ── 2. kaks paralleelset käivitust — leiu tuum ─────────────────────────── */

test("SOL-RAGADMIN-03: kaks paralleelset ingest'i — teine ei pääse sisse", async () => {
  const state = world();

  /* Mõlemad käivituvad enne, kui kumbki lõpetab: `hold` hoiab esimest kinni
     täpselt sel hetkel, kus vanal rajal oli aken. */
  const gate = () => new Promise(resolve => setImmediate(resolve));
  const [first, second] = await Promise.all([
    runIngest(state, { hold: gate }),
    runIngest(state, { hold: gate })
  ]);

  const winners = [first, second].filter(result => result.ok);
  assert.equal(winners.length, 1, "sama rea peale pääses kaks ingest'i");
  assert.equal([first, second].find(result => !result.ok).reason, "ingest_in_progress");
  assert.equal(state.row.ingestStatus, "INGESTED");
  assertInvariant(state, "2");
});

test("SOL-RAGADMIN-03: NEGATIIVKONTROLL — VANA rada laseb mõlemad sisse", async () => {
  const state = world();
  const gate = () => new Promise(resolve => setImmediate(resolve));

  /* Mõlemad loevad rea ENNE, kui kumbki kirjutab — täpselt see aken, mida vana
     kood endas kandis. */
  const snapshotA = legacyRead(state);
  const snapshotB = legacyRead(state);
  await Promise.all([
    legacyIngest(state, snapshotA, { hold: gate }),
    legacyIngest(state, snapshotB, { hold: gate })
  ]);

  assert.equal(state.peakRunning, 2, "vana rada EI lasknud kahte sisse — süst ei reprodutseeri leidu");
  assert.throws(
    () => assertInvariant(state, "negatiiv"),
    /korraga jooksis 2 ingest'i/u
  );
});

/* ── 3. katkestus pärast claim'i ─────────────────────────────────────────── */

test("SOL-RAGADMIN-03: katkestus pärast claim'i EI jäta lukku igaveseks", async () => {
  /* Protsess suri: rida on INGESTING, lease jäi püsti ja keegi teda ei vabasta. */
  const claimedAt = new Date(NOW.getTime() - INGEST_LEASE_MS - 1000);
  const state = world({ status: "INGESTING", claimId: "surnud", claimedAt });

  assert.equal(hasLiveIngestClaim(state.row, lane, { now: NOW }), false, "surnud lukk paistab elusana");
  const result = await runIngest(state, { now: NOW });

  assert.equal(result.ok, true, "aegunud lukku ei saanud varastada");
  assert.equal(state.row.ingestStatus, "INGESTED");
  assertInvariant(state, "3");
});

test("SOL-RAGADMIN-03: ELUS lease blokeerib ja tema tähtaeg on tegelik piir", async () => {
  const claimedAt = new Date(NOW.getTime() - 60_000);
  const state = world({ status: "INGESTING", claimId: "elus", claimedAt });

  assert.equal(hasLiveIngestClaim(state.row, lane, { now: NOW }), true);
  const blocked = await runIngest(state, { now: NOW });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.conflict.status, 409, "hõivatud rada peab andma 409, mitte 400");

  /* Sama lukk üks millisekund pärast tähtaega on varastatav. */
  const later = new Date(claimedAt.getTime() + INGEST_LEASE_MS);
  assert.equal(isIngestClaimExpired(claimedAt, { now: later }), true);
  assertInvariant(state, "4");
});

test("SOL-RAGADMIN-03: enne parandust tekkinud ummik (lease puudub) on varastatav", async () => {
  /* Vana rida kannab INGESTING seisu, aga mitte lease'i — backfill'i ei ole ja
     `null` peab tähendama „omanikku ei ole teada", mitte „igavesti kinni". */
  const state = world({ status: "INGESTING", claimId: null, claimedAt: null });

  assert.equal(isIngestClaimExpired(null, { now: NOW }), true);
  const result = await runIngest(state, { now: NOW });

  assert.equal(result.ok, true);
  assertInvariant(state, "5");
});

/* ── 4. DB viga pärast ÕNNESTUNUD RAG-kirjutust ─────────────────────────── */

test("SOL-RAGADMIN-03: DB tõrge pärast RAG-kirjutust EI märgi rida ERROR-iks", async () => {
  const state = world();

  const result = await runIngest(state, { failAt: "after_rag" });

  assert.equal(result.ok, false);
  assert.equal(result.ragWriteCompleted, true);
  assert.ok(state.ragDocs.has(DOC_ID), "RAG-kirjutust ei toimunudki — stsenaarium ei mõõda leidu");
  assert.notEqual(state.row.ingestStatus, "ERROR", "ERROR on siin VALE VÄIDE: dokument on RAG-is");
  assert.equal(state.row.ingestStatus, "INGESTING", "rida peab jääma ootele, kuni lepitus küsib RAG-ist tõe");
  assert.equal(state.row.ingestClaimId, result.claimId, "lease vabastati enne, kui tõde on teada");
  assertInvariant(state, "6");
});

test("SOL-RAGADMIN-03: NEGATIIVKONTROLL — VANA rada ütles ERROR, kuigi dokument oli RAG-is", async () => {
  const state = world();

  await legacyIngest(state, legacyRead(state), { failAt: "after_rag" });

  assert.equal(state.row.ingestStatus, "ERROR");
  assert.ok(state.ragDocs.has(DOC_ID));
  assert.throws(
    () => assertInvariant(state, "negatiiv"),
    /DB ütleb ERROR, aga dokument ON RAG-is/u,
    "vana rada EI rikkunud invarianti — süst ei reprodutseeri leidu"
  );
});

test("SOL-RAGADMIN-03: ootele jäänud rida saab lepituse kaudu tõe kätte", async () => {
  const state = world();
  await runIngest(state, { failAt: "after_rag" });

  /* Lease aegub ja lepitus küsib RAG-ist, mis päriselt sai. */
  const later = new Date(NOW.getTime() + INGEST_LEASE_MS + 1000);
  const result = await reconcileStaleIngestClaim({
    delegate: delegateFor(state),
    row: state.row,
    lane,
    now: later,
    readPresence: async () => ({ presence: RAG_PRESENCE.PRESENT, lastIngested: later })
  });

  assert.equal(result.reconciled, true);
  assert.equal(state.row.ingestStatus, "INGESTED");
  assert.equal(state.row.ingestClaimId, null);
  assert.deepEqual(state.row.lastIngestedAt, later);
  assertInvariant(state, "7");
});

/* ── 5. tõrge ENNE RAG-kirjutust ────────────────────────────────────────── */

test("SOL-RAGADMIN-03: tõrge enne RAG-kirjutust vabastab luku ja märgib ausalt ERROR", async () => {
  const state = world();

  const result = await runIngest(state, { failAt: "before_rag" });

  assert.equal(result.ok, false);
  assert.equal(result.ragWriteCompleted, false);
  assert.equal(state.row.ingestStatus, "ERROR");
  assert.equal(state.row.lastIngestError, "rag.md is empty");
  assert.equal(state.row.ingestClaimId, null, "tõrge jättis luku kinni");
  assert.ok(!state.ragDocs.has(DOC_ID));
  assertInvariant(state, "8");

  /* Ja järgmine katse pääseb kohe sisse — ERROR ei ole lukk. */
  const retry = await runIngest(state);
  assert.equal(retry.ok, true);
  assertInvariant(state, "8b");
});

/* ── 6. lõppseis kuulub claim'i omanikule ───────────────────────────────── */

test("SOL-RAGADMIN-03: varastatud claim'iga ei kirjutata lõppseisu", async () => {
  const state = world();
  const delegate = delegateFor(state);
  const mine = await claimIngestLease({ delegate, id: ROW_ID, lane, docId: DOC_ID, now: NOW });

  /* Lease aegus ja töö läks kellelegi teisele. */
  const later = new Date(NOW.getTime() + INGEST_LEASE_MS + 1000);
  const theirs = await claimIngestLease({ delegate, id: ROW_ID, lane, docId: DOC_ID, now: later });
  assert.equal(theirs.ok, true);

  state.ragDocs.add(DOC_ID);
  const finished = await finishIngestClaim({ delegate, id: ROW_ID, lane, claimId: mine.claimId, docId: DOC_ID });

  assert.equal(finished.ok, false);
  assert.equal(finished.reason, "claim_lost");
  assert.equal(state.row.ingestClaimId, theirs.claimId, "zombi kirjutas üle uue omaniku claim'i");
  assert.equal(state.row.ingestStatus, "INGESTING");
  assertInvariant(state, "9");
});

test("SOL-RAGADMIN-03: zombi tõrge ei märgi teise omaniku tööd ERROR-iks", async () => {
  const state = world();
  const delegate = delegateFor(state);
  const mine = await claimIngestLease({ delegate, id: ROW_ID, lane, docId: DOC_ID, now: NOW });
  const later = new Date(NOW.getTime() + INGEST_LEASE_MS + 1000);
  await claimIngestLease({ delegate, id: ROW_ID, lane, docId: DOC_ID, now: later });

  const released = await releaseIngestClaimWithError({
    delegate,
    id: ROW_ID,
    lane,
    claimId: mine.claimId,
    message: "zombi tõrge"
  });

  assert.equal(released.ok, false);
  assert.equal(state.row.ingestStatus, "INGESTING");
  assert.equal(state.row.lastIngestError, null);
  assertInvariant(state, "10");
});

/* ── 7. lepitus ei oleta ────────────────────────────────────────────────── */

test("SOL-RAGADMIN-03: lepitus märgib puuduva dokumendi ausalt katkestuseks", async () => {
  const claimedAt = new Date(NOW.getTime() - INGEST_LEASE_MS - 1000);
  const state = world({ status: "INGESTING", claimId: "surnud", claimedAt });

  const result = await reconcileStaleIngestClaim({
    delegate: delegateFor(state),
    row: state.row,
    lane,
    now: NOW,
    readPresence: async () => ({ presence: RAG_PRESENCE.MISSING, lastIngested: null })
  });

  assert.equal(result.reconciled, true);
  assert.equal(state.row.ingestStatus, "ERROR");
  assert.equal(state.row.lastIngestError, INGEST_INTERRUPTED, "põhjus peab olema kood, mitte erindi teade");
  assert.equal(state.row.ingestClaimId, null);
  assertInvariant(state, "11");
});

test("SOL-RAGADMIN-03: kui RAG ei vasta, EI OTSUSTA lepitus midagi", async () => {
  /* Just „märgi ERROR-iks ja loodame" oli see viga, mis ütles adminile, et
     dokumenti ei ole, kuigi ta oli teenuses aktiivne. */
  const claimedAt = new Date(NOW.getTime() - INGEST_LEASE_MS - 1000);
  const state = world({ status: "INGESTING", claimId: "surnud", claimedAt });

  const result = await reconcileStaleIngestClaim({
    delegate: delegateFor(state),
    row: state.row,
    lane,
    now: NOW,
    readPresence: async () => ({ presence: RAG_PRESENCE.UNKNOWN, lastIngested: null })
  });

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, "presence_unknown");
  assert.equal(state.row.ingestStatus, "INGESTING");
  assertInvariant(state, "12");

  /* JA SEE EI OLE UMMIK: lease on läbi, seega järgmine ingest saab luku. */
  const retry = await runIngest(state, { now: NOW });
  assert.equal(retry.ok, true, "unknown-vastus muutis luku ummikuks");
  assertInvariant(state, "12b");
});

test("SOL-RAGADMIN-03: lepitus ei puutu ELUSAT ingest'i", async () => {
  const state = world({ status: "INGESTING", claimId: "elus", claimedAt: new Date(NOW.getTime() - 1000) });
  let asked = 0;

  const result = await reconcileStaleIngestClaim({
    delegate: delegateFor(state),
    row: state.row,
    lane,
    now: NOW,
    readPresence: async () => {
      asked += 1;
      return { presence: RAG_PRESENCE.MISSING, lastIngested: null };
    }
  });

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, "claim_live");
  assert.equal(asked, 0, "elusa ingest'i pärast käidi RAG-ist küsimas");
  assert.equal(state.row.ingestStatus, "INGESTING");
  assertInvariant(state, "13");
});

test("SOL-RAGADMIN-03: lepitus ei kirjuta üle rida, mille claim vahepeal vahetus", async () => {
  const claimedAt = new Date(NOW.getTime() - INGEST_LEASE_MS - 1000);
  const state = world({ status: "INGESTING", claimId: "surnud", claimedAt });
  const snapshot = { ...state.row };

  /* Keegi jõudis vahepeal luku endale võtta. */
  await claimIngestLease({ delegate: delegateFor(state), id: ROW_ID, lane, docId: DOC_ID, now: NOW });

  const result = await reconcileStaleIngestClaim({
    delegate: delegateFor(state),
    row: snapshot,
    lane,
    now: NOW,
    readPresence: async () => ({ presence: RAG_PRESENCE.MISSING, lastIngested: null })
  });

  assert.equal(result.reconciled, false);
  assert.equal(result.reason, "claim_lost");
  assert.equal(state.row.ingestStatus, "INGESTING", "lepitus lõi elusa ingest'i maha");
  assertInvariant(state, "14");
});

/* ── 8. rajad ei sega üksteist ──────────────────────────────────────────── */

test("SOL-RAGADMIN-03: KOV veeb ja RT on eraldi lukud, organisatsioon oma tabelis", async () => {
  /* Kolm rada, üks protokoll — aga mitte üks lukk: RT ingest ei tohi blokeerida
     veebi ingest'i. */
  assert.notEqual(INGEST_LANES.KOV_WEB.claimId, INGEST_LANES.KOV_RT.claimId);
  assert.notEqual(INGEST_LANES.KOV_WEB.claimedAt, INGEST_LANES.KOV_RT.claimedAt);
  assert.deepEqual(clearedIngestClaim(INGEST_LANES.KOV_RT), {
    rtIngestClaimId: null,
    rtIngestClaimedAt: null
  });

  const state = world({ status: "READY" });
  state.row.rtIngestStatus = "INGESTING";
  state.row.rtIngestClaimId = "rt-elus";
  state.row.rtIngestClaimedAt = NOW;

  const web = await claimIngestLease({ delegate: delegateFor(state), id: ROW_ID, lane, docId: DOC_ID, now: NOW });
  assert.equal(web.ok, true, "RT lukk blokeeris veebiraja");
  assert.equal(state.row.rtIngestClaimId, "rt-elus", "veebiraja claim puutus RT lease'i");
});
