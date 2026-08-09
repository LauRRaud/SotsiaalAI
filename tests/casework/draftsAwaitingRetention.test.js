/**
 * SOL-CW-03 — laud on TEGEVUSloend, mitte arhiiv.
 *
 * READ_ONLY ja ARCHIVED juhtumi mustandit ei saa enam muuta ega üle kanda
 * (`withActiveCaseLock` keeldub), seega tema kuvamine „STAR2-sse kandmist
 * ootavana" lubaks tööd, mida kasutaja ei saa lõpetada. Kaks õde-lugejat
 * (`listOpenMissingInfoForOwner`, `listUpcomingContacts`) filtreerivad juba
 * `retentionState: ACTIVE` — kolmas jäi maha.
 *
 * Test kasutab test-DB-d, mis OSKAB seost lahendada. Olemasoleva
 * `caseWorkDraft.test.js` fake teeb ainult pinnapealse võrdluse ega näeks
 * pesastatud `caseWorkAssist` filtrit üldse — roheline test seal ei tõendaks
 * midagi.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import { listDraftsAwaitingTransfer } from "../../lib/casework/caseWorkDraft.js";

const OWNER = "worker_a";
const STRANGER = "worker_b";

function withFeatureOn(fn) {
  return async (...args) => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    process.env[CASEWORK_FLAG_KEYS.ENABLED] = "1";
    try {
      return await fn(...args);
    } finally {
      if (previous === undefined) delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
      else process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  };
}

/** Test-DB, mis lahendab `caseWorkAssist` seose päriselt. */
function db({ assists = [], drafts = [] } = {}) {
  const seenWhere = [];
  const byId = new Map(assists.map((row) => [row.id, row]));
  return {
    seenWhere,
    caseWorkDraft: {
      async findMany({ where = {}, take }) {
        seenWhere.push(where);
        const relation = where.caseWorkAssist || {};
        const notIn = where.transferState?.notIn || [];
        const rows = drafts.filter((draft) => {
          const parent = byId.get(draft.caseWorkAssistId);
          if (!parent) return false;
          if (relation.ownerUserId !== undefined && parent.ownerUserId !== relation.ownerUserId) return false;
          if (relation.retentionState !== undefined && parent.retentionState !== relation.retentionState) {
            return false;
          }
          return !notIn.includes(draft.transferState);
        });
        return typeof take === "number" ? rows.slice(0, take) : rows;
      }
    }
  };
}

const ASSISTS = [
  { id: "case_active", ownerUserId: OWNER, retentionState: "ACTIVE" },
  { id: "case_readonly", ownerUserId: OWNER, retentionState: "READ_ONLY" },
  { id: "case_archived", ownerUserId: OWNER, retentionState: "ARCHIVED" },
  { id: "case_stranger", ownerUserId: STRANGER, retentionState: "ACTIVE" }
];

const DRAFTS = [
  { id: "draft_active", caseWorkAssistId: "case_active", transferState: "VALMIS_ULEKANDEKS" },
  { id: "draft_active_early", caseWorkAssistId: "case_active", transferState: "MUSTAND" },
  { id: "draft_readonly", caseWorkAssistId: "case_readonly", transferState: "VALMIS_ULEKANDEKS" },
  { id: "draft_archived", caseWorkAssistId: "case_archived", transferState: "KONTROLLITUD" },
  { id: "draft_stranger", caseWorkAssistId: "case_stranger", transferState: "MUSTAND" },
  { id: "draft_done", caseWorkAssistId: "case_active", transferState: "ULE_KANTUD" },
  { id: "draft_declined", caseWorkAssistId: "case_active", transferState: "EI_KANTA" }
];

test(
  "SOL-CW-03: laual on AINULT aktiivse vanemjuhtumi mustandid",
  withFeatureOn(async () => {
    const store = db({ assists: ASSISTS, drafts: DRAFTS });
    const { items } = await listDraftsAwaitingTransfer({ ownerUserId: OWNER, db: store });
    const ids = items.map((row) => row.id).sort();

    assert.deepEqual(ids, ["draft_active", "draft_active_early"]);
    assert.ok(!ids.includes("draft_readonly"), "READ_ONLY juhtumi mustand ei tohi tegevuslauale jääda");
    assert.ok(!ids.includes("draft_archived"), "ARCHIVED juhtumi mustand ei tohi tegevuslauale jääda");
    assert.ok(!ids.includes("draft_stranger"), "võõra omaniku mustand ei tohi lekkida");
  })
);

test(
  "SOL-CW-03: terminaalsed seisud jäävad endiselt välja",
  withFeatureOn(async () => {
    /* Säilitusfilter ei tohi vana lepingut ära süüa: `ULE_KANTUD` on kohale
       jõudnud ja `EI_KANTA` on teadlik lõpp. */
    const store = db({ assists: ASSISTS, drafts: DRAFTS });
    const { items } = await listDraftsAwaitingTransfer({ ownerUserId: OWNER, db: store });
    for (const id of ["draft_done", "draft_declined"]) {
      assert.ok(!items.some((row) => row.id === id), `${id} ei tohi ootel mustandite hulka kuuluda`);
    }
  })
);

test(
  "SOL-CW-03: päring küsib säilitusseisu andmebaasilt, mitte ei filtreeri vastuse peal",
  withFeatureOn(async () => {
    /* Vastuse peal filtreerimine tähendaks, et `take` piir täitub arhiveeritud
       ridadega ja aktiivsed jäävad välja — sama nälgimismuster nagu SOL-CW-07. */
    const store = db({ assists: ASSISTS, drafts: DRAFTS });
    await listDraftsAwaitingTransfer({ ownerUserId: OWNER, db: store });
    assert.equal(store.seenWhere.length, 1);
    assert.deepEqual(store.seenWhere[0].caseWorkAssist, {
      ownerUserId: OWNER,
      retentionState: "ACTIVE"
    });
  })
);

test(
  "SOL-CW-03 negatiivkontroll: säilitusfiltrita päring laseks arhiveeritud mustandid läbi",
  withFeatureOn(async () => {
    /* Sama test-DB parandus-eelse where-kujuga. Kui see rida läheks roheliseks
       ka ilma vaheta, ei mõõdaks ülemine test midagi. */
    const store = db({ assists: ASSISTS, drafts: DRAFTS });
    const leaked = await store.caseWorkDraft.findMany({
      where: {
        caseWorkAssist: { ownerUserId: OWNER },
        transferState: { notIn: ["ULE_KANTUD", "EI_KANTA"] }
      }
    });
    const ids = leaked.map((row) => row.id);
    assert.ok(ids.includes("draft_readonly"), "negatiivkontroll ei reprodutseerinud leidu");
    assert.ok(ids.includes("draft_archived"), "negatiivkontroll ei reprodutseerinud leidu");
  })
);
