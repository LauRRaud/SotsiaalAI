/**
 * SOL-CW-08 — vigane päringuparameeter on KLIENDI viga, mitte serveri oma.
 *
 * `GET /api/casework/cases` edastab URL-i suvalise `retentionState` väärtuse
 * teenuskihti, kust ta jõudis valideerimata Prisma enum-filtrisse. Prisma
 * viskas oma vea ja veakaardistus muutis selle 500-ks: API leping katki ja
 * veaseire täis päringuid, mille tegelik põhjus on trükiviga.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import { RETENTION_STATE, listCaseWorkAssists } from "../../lib/casework/caseWorkAssist.js";

const OWNER = "worker_a";

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

function db() {
  const seenWhere = [];
  return {
    seenWhere,
    caseWorkAssist: {
      async findMany({ where }) {
        seenWhere.push(where);
        return [];
      }
    },
    user: {
      async findMany() {
        return [];
      }
    }
  };
}

async function expectBadRequest(promise) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, 400, `oodatud 400, saadi ${error.status} (${error.messageKey})`);
    assert.equal(error.messageKey, "casework.errors.retention_unknown");
    return true;
  });
}

test(
  "SOL-CW-08: tundmatu retentionState annab 400, mitte 500 — ja andmebaasi ei puututa",
  withFeatureOn(async () => {
    for (const value of ["DELETED", "aktiivne", "ACTIVE; DROP", "0", "  "]) {
      const store = db();
      if (value.trim() === "") continue;
      await expectBadRequest(listCaseWorkAssists({ ownerUserId: OWNER, retentionState: value, db: store }));
      assert.equal(store.seenWhere.length, 0, `"${value}": vigane väärtus jõudis päringusse`);
    }
  })
);

test(
  "SOL-CW-08: väiketähtedega väärtust EI normaliseerita vaikselt",
  withFeatureOn(async () => {
    /* Vaikne normaliseerimine tähendaks, et kaks eri URL-i annavad sama
       tulemuse ja klient ei saa kunagi teada, et ta küsis vale asja. */
    await expectBadRequest(listCaseWorkAssists({ ownerUserId: OWNER, retentionState: "active", db: db() }));
  })
);

test(
  "SOL-CW-08: kõik kolm lubatud seisu lähevad filtrisse",
  withFeatureOn(async () => {
    for (const state of Object.values(RETENTION_STATE)) {
      const store = db();
      await listCaseWorkAssists({ ownerUserId: OWNER, retentionState: state, db: store });
      assert.equal(store.seenWhere.length, 1);
      assert.equal(store.seenWhere[0].retentionState, state);
      assert.equal(store.seenWhere[0].ownerUserId, OWNER);
    }
  })
);

test(
  "SOL-CW-08: puuduv või tühi parameeter ei lisa filtrit",
  withFeatureOn(async () => {
    for (const value of [null, undefined, "", "   "]) {
      const store = db();
      await listCaseWorkAssists({ ownerUserId: OWNER, retentionState: value, db: store });
      assert.equal(store.seenWhere.length, 1);
      assert.ok(
        !Object.prototype.hasOwnProperty.call(store.seenWhere[0], "retentionState"),
        `${JSON.stringify(value)} lisas filtri, kuigi ei tohiks`
      );
    }
  })
);
