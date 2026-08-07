import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE } from "../../lib/workspaces/provenance.js";
import {
  MISSING_INFO_STATUS,
  MISSING_INFO_STATUSES,
  addMissingInfo,
  removeMissingInfo,
  setMissingInfoStatus
} from "../../lib/casework/caseWorkMissingInfo.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";

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

/**
 * Fake-db, mis jäljendab kaht asja: OMANIKUPIIRI ja VANEMA TINGIMUSLIKKU
 * UPDATE'i. Teine neist on L14 jõustaja (`withActiveCaseLock`) — kui ta ei ole
 * kirjutuse enda sees, jääb `READ_ONLY` juhtumi laps muudetavaks.
 *
 * `beforeTransaction` on aken: temaga saab test lasta „teisel tehingul" vahele
 * jõuda täpselt sealt, kus vana `loe → kontrolli → kirjuta` muster katki oli.
 */
function db({ assists = [], items = [], beforeTransaction = null } = {}) {
  const database = {
    items,
    assists,
    async $transaction(callback) {
      if (beforeTransaction) await beforeTransaction();
      return callback(database);
    },
    caseWorkAssist: {
      async findFirst({ where }) {
        return assists.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null;
      },
      async updateMany({ where }) {
        const matching = assists.filter(
          (row) =>
            row.id === where.id &&
            row.ownerUserId === where.ownerUserId &&
            (where.retentionState === undefined || row.retentionState === where.retentionState)
        );
        return { count: matching.length };
      }
    },
    caseWorkMissingInfo: {
      async create({ data }) {
        const row = { id: `mi_${items.length + 1}`, status: "OPEN", resolvedAt: null, ...data };
        items.push(row);
        return row;
      },
      async updateMany({ where, data }) {
        const matching = items.filter((row) => row.id === where.id && row.caseWorkAssistId === where.caseWorkAssistId);
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      },
      async deleteMany({ where }) {
        const keep = items.filter(
          (row) => !(row.id === where.id && row.caseWorkAssistId === where.caseWorkAssistId)
        );
        const removed = items.length - keep.length;
        items.length = 0;
        items.push(...keep);
        return { count: removed };
      },
      async findFirst({ where }) {
        return items.find((row) => row.id === where.id && row.caseWorkAssistId === where.caseWorkAssistId) || null;
      }
    }
  };
  return database;
}

const ACTIVE_CASE = { id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" };

test("staatuseid on täpselt kolm", () => {
  assert.deepEqual([...MISSING_INFO_STATUSES].sort(), ["NOT_APPLICABLE", "OPEN", "RESOLVED"]);
});

test(
  "L5: tundmatu päritolu lükatakse tagasi, tuntud võetakse vastu",
  withFeatureOn(async () => {
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "Puudub tõend",
          provenance: "TOOTAJA_ARVAMUS",
          db: db({ assists: [ACTIVE_CASE] })
        }),
      (error) => error.status === 400 && error.messageKey === "casework.errors.provenance_unknown"
    );

    const row = await addMissingInfo({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      text: "Puudub tõend",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK,
      db: db({ assists: [ACTIVE_CASE] })
    });
    assert.equal(row.provenance, PROVENANCE.TOOTAJA_TAHELEPANEK);
  })
);

test(
  "tekst on kohustuslik ja piiratud pikkusega",
  withFeatureOn(async () => {
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "   ",
          provenance: PROVENANCE.DOKUMENDIST,
          db: db({ assists: [ACTIVE_CASE] })
        }),
      (error) => error.messageKey === "casework.errors.missing_info_text_required"
    );
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "x".repeat(2001),
          provenance: PROVENANCE.DOKUMENDIST,
          db: db({ assists: [ACTIVE_CASE] })
        }),
      (error) => error.messageKey === "casework.errors.missing_info_text_too_long"
    );
  })
);

test(
  "staatuse invariant kehtib MÕLEMAS suunas ja `resolvedAt` tuleb serverist",
  withFeatureOn(async () => {
    const database = db({ assists: [ACTIVE_CASE] });
    const created = await addMissingInfo({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      text: "Vajab kliendiga kontrollimist",
      provenance: PROVENANCE.KLIENDI_OELDUD,
      db: database
    });
    assert.equal(created.status, MISSING_INFO_STATUS.OPEN);
    assert.equal(created.resolvedAt, null);

    const resolved = await setMissingInfoStatus({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      itemId: created.id,
      status: MISSING_INFO_STATUS.RESOLVED,
      db: database
    });
    assert.ok(resolved.resolvedAt instanceof Date, "`resolvedAt` määratakse serveris");

    const reopened = await setMissingInfoStatus({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      itemId: created.id,
      status: MISSING_INFO_STATUS.OPEN,
      db: database
    });
    /* Kirje, mis on korraga lahtine ja lahendatud, jätaks loenduri kahe tõe
       vahele — tagasi avamine peab `resolvedAt`-i nullima. */
    assert.equal(reopened.resolvedAt, null);
  })
);

test(
  "tundmatu staatus lükatakse tagasi",
  withFeatureOn(async () => {
    await assert.rejects(
      () =>
        setMissingInfoStatus({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          itemId: "mi_1",
          status: "POOLELI",
          db: db({ assists: [ACTIVE_CASE] })
        }),
      (error) => error.messageKey === "casework.errors.missing_info_status_unknown"
    );
  })
);

test(
  "L14: READ_ONLY juhtumi puuduva info loendit ei muudeta",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "READ_ONLY" }] });
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "Uus punkt",
          provenance: PROVENANCE.DOKUMENDIST,
          db: database
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );
  })
);

/* ────────────────────────────────────────────────────────────────────────────
   L14 VÕISTLUS — jõustaja peab olema KIRJUTUSE SEES

   Vana kuju oli `requireActiveCase()` → eraldi päring, ja alles siis kirjutus.
   Kahe vahele mahtus `transitionRetention()`:

       A: kontroll → ACTIVE
       B: READ_ONLY (commit)
       A: create / update / delete            ← kirjutuskaitse juba jõus

   Need testid lasevad B-l täpselt sinna vahele jõuda. Vana koodi peal nad
   KUKUVAD — seal ei olnud tehingut, kuhu B saanuks mahtuda, ja kirjutus läks
   läbi. Uue peal peab iga kolm rada andma 409 ja MITTE ühtegi muudetud rida.
   ──────────────────────────────────────────────────────────────────────────── */

function racingCase() {
  const parent = { id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" };
  /* B commit'ib kohe, kui A on oma tehingu alustanud. */
  const commitRetention = () => {
    parent.retentionState = "READ_ONLY";
  };
  return { parent, commitRetention };
}

test(
  "VÕISTLUS: vahepealne retention-siire tapab LISAMISE, mitte ei kaota",
  withFeatureOn(async () => {
    const { parent, commitRetention } = racingCase();
    const database = db({ assists: [parent], beforeTransaction: commitRetention });

    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "Uus punkt",
          provenance: PROVENANCE.DOKUMENDIST,
          db: database
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );

    assert.equal(database.items.length, 0, "kirjutuskaitstud juhtumisse tekkis ikkagi rida");
  })
);

test(
  "VÕISTLUS: vahepealne retention-siire tapab STAATUSE MUUTMISE",
  withFeatureOn(async () => {
    const { parent, commitRetention } = racingCase();
    const database = db({ assists: [parent] });

    const created = await addMissingInfo({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      text: "Vajab kontrollimist",
      provenance: PROVENANCE.DOKUMENDIST,
      db: database
    });

    const racing = db({ assists: [parent], items: database.items, beforeTransaction: commitRetention });
    await assert.rejects(
      () =>
        setMissingInfoStatus({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          itemId: created.id,
          status: MISSING_INFO_STATUS.RESOLVED,
          db: racing
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );

    assert.equal(racing.items[0].status, MISSING_INFO_STATUS.OPEN, "staatus muutus kirjutuskaitse all");
    assert.equal(racing.items[0].resolvedAt, null);
  })
);

test(
  "VÕISTLUS: vahepealne retention-siire tapab KUSTUTAMISE",
  withFeatureOn(async () => {
    const { parent, commitRetention } = racingCase();
    const database = db({ assists: [parent] });

    const created = await addMissingInfo({
      ownerUserId: "w1",
      caseWorkAssistId: "case_1",
      text: "Kustutamiseks",
      provenance: PROVENANCE.DOKUMENDIST,
      db: database
    });

    const racing = db({ assists: [parent], items: database.items, beforeTransaction: commitRetention });
    await assert.rejects(
      () =>
        removeMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          itemId: created.id,
          db: racing
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );

    assert.equal(racing.items.length, 1, "rida kustus kirjutuskaitse all");
  })
);

test(
  "lukk eristab võõra juhtumi (404) ja kirjutuskaitstud oma juhtumi (409)",
  withFeatureOn(async () => {
    /* Mõlemad kukuvad samas kohas — tingimuslikus update'is —, aga põhjus ei
       tohi ühte sulada: 403/409 võõra juhtumi peal kinnitaks tema olemasolu. */
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "punkt",
          provenance: PROVENANCE.DOKUMENDIST,
          db: db({ assists: [{ id: "case_1", ownerUserId: "keegi-teine", retentionState: "ACTIVE" }] })
        }),
      (error) => error.status === 404
    );

    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "punkt",
          provenance: PROVENANCE.DOKUMENDIST,
          db: db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ARCHIVED" }] })
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );
  })
);

test(
  "võõra juhtumi puuduva info loend annab 404",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "keegi-teine", retentionState: "ACTIVE" }] });
    await assert.rejects(
      () =>
        addMissingInfo({
          ownerUserId: "w1",
          caseWorkAssistId: "case_1",
          text: "Uus punkt",
          provenance: PROVENANCE.DOKUMENDIST,
          db: database
        }),
      (error) => error.status === 404
    );
  })
);
