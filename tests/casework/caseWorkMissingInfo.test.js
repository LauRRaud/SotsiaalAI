import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE } from "../../lib/workspaces/provenance.js";
import {
  MISSING_INFO_STATUS,
  MISSING_INFO_STATUSES,
  addMissingInfo,
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

function db({ assists = [], items = [] } = {}) {
  return {
    items,
    caseWorkAssist: {
      async findFirst({ where }) {
        return assists.find((row) => row.id === where.id && row.ownerUserId === where.ownerUserId) || null;
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
      async findFirst({ where }) {
        return items.find((row) => row.id === where.id && row.caseWorkAssistId === where.caseWorkAssistId) || null;
      }
    }
  };
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
