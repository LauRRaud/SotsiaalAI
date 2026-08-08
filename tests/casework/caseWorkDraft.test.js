/**
 * JTA-V1 (E5) — STAR2 mustandi ahela teenusleping.
 *
 * KANDEV ASI: `ULE_KANTUD`-ini viib TÄPSELT ÜKS TEE (L19). See lubadus katkeb
 * vaikselt — mustand jõuab lõppseisu, säilituskell hakkab käima ja ühtegi
 * tõendit ülekande kohta ei ole. Ükski veateade ei tekiks.
 *
 * Teine samasugune: kaks samaaegset siiret. Ilma tingimusliku update'ita
 * (L6) võidavad mõlemad ja teine kirjutab esimese üle.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE, STAR2_TRANSFER_STATE } from "../../lib/workspaces/provenance.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import { transitionDraftStateTx } from "../../lib/casework/draftTransition.js";
import {
  DRAFT_TYPE,
  DRAFT_TYPES,
  createDraft,
  getDraft,
  isDraftType,
  listDrafts,
  removeField,
  setField,
  transitionDraft
} from "../../lib/casework/caseWorkDraft.js";

const OWNER = "worker_a";
const STRANGER = "worker_b";
const CASE_ID = "case_1";

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

function db({
  assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
  drafts = [],
  fields = [],
  beforeTransaction = null
} = {}) {
  let sequence = 0;
  const nextId = (prefix) => `${prefix}_${++sequence}`;
  const matchWhere = (row, where) =>
    Object.entries(where).every(([key, value]) => (value === undefined ? true : row[key] === value));

  const collection = (rows, prefix, defaults = {}) => ({
    async create({ data }) {
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...defaults, ...data };
      rows.push(row);
      return row;
    },
    async findFirst({ where }) {
      return rows.find((row) => matchWhere(row, where)) || null;
    },
    async findMany({ where = {} }) {
      return rows.filter((row) => matchWhere(row, where));
    },
    async updateMany({ where, data }) {
      const matching = rows.filter((row) => matchWhere(row, where));
      for (const row of matching) Object.assign(row, data, { updatedAt: new Date() });
      return { count: matching.length };
    },
    async deleteMany({ where }) {
      const keep = rows.filter((row) => !matchWhere(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    },
    async upsert({ where, create, update }) {
      const key = where.draftId_fieldKey;
      const existing = rows.find((row) => row.draftId === key.draftId && row.fieldKey === key.fieldKey);
      if (existing) {
        Object.assign(existing, update, { updatedAt: new Date() });
        return existing;
      }
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...create };
      rows.push(row);
      return row;
    }
  });

  const database = {
    drafts,
    fields,
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
    caseWorkDraft: collection(drafts, "draft", {
      transferState: "MUSTAND",
      reviewKind: null,
      transferredAt: null,
      contentPurgedAt: null
    }),
    caseWorkDraftField: collection(fields, "field")
  };

  return database;
}

async function rejects(promise, status, messageKey) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.status, status, `oodatud ${status}, saadi ${error.status} (${error.messageKey})`);
    if (messageKey) assert.equal(error.messageKey, messageKey);
    return true;
  });
}

async function seed(store, { draftType = DRAFT_TYPE.EESMARGI_SONASTUS } = {}) {
  const draft = await createDraft({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftType, db: store });
  return { draft, base: { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftId: draft.id, db: store } };
}

/** Viib mustandi seisu `target`-ini ainult lubatud siirete kaudu. */
async function advanceTo(base, target) {
  const road = ["MUSTAND", "VAJAB_KONTROLLI", "KONTROLLITUD", "VALMIS_ULEKANDEKS"];
  for (let i = 0; road[i] !== target; i += 1) {
    await transitionDraft({ ...base, expectedFrom: road[i], to: road[i + 1] });
  }
}

/* ── sõnastik ───────────────────────────────────────────────────────────── */

test("kaheksa elementi ptk 4.5 järjekorras", () => {
  assert.equal(DRAFT_TYPES.length, 8);
  assert.equal(DRAFT_TYPES[0], DRAFT_TYPE.POORDUMISE_KOKKUVOTE);
  assert.equal(DRAFT_TYPES[7], DRAFT_TYPE.TEENUSE_SUUNAMISE_ALUS);
  assert.equal(isDraftType("MUU"), false);
});

test("olekumasinat ei dubleerita — primitiiv EI OLE mustandimooduli avalik eksport", async () => {
  /* L19: primitiivil on täpselt kaks kutsujat. Kolmas kutsuja oleks kolmas uks
     olekumasinasse — ja just see uks jääks testimata. */
  const draftModule = await import("../../lib/casework/caseWorkDraft.js");
  assert.equal(draftModule.transitionDraftStateTx, undefined, "primitiiv on avalik eksport");
  assert.equal(typeof transitionDraftStateTx, "function", "primitiiv puudub oma moodulist");
});

/* ── olekusiire ─────────────────────────────────────────────────────────── */

test(
  "ebaseaduslik üleminek annab 400 ja seis EI MUUTU",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    /* `MUSTAND → KONTROLLITUD` hüppab ptk 2.2 teelt maha. */
    await rejects(
      transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "KONTROLLITUD" }),
      400,
      "casework.errors.transfer_transition_illegal"
    );
    assert.equal(store.drafts[0].transferState, "MUSTAND");

    await rejects(
      transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "MIDAGI" }),
      400,
      "casework.errors.transfer_state_unknown"
    );
  })
);

test(
  "kaks samaaegset üleminekut: üks õnnestub, teine 409",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "VAJAB_KONTROLLI" });

    /* SEE ON L6 MÕTE. Teine kutse kannab AEGUNUD `expectedFrom`-i: ilma
       tingimusliku update'ita kirjutaks ta esimese üle ja mustand hüppaks
       `VAJAB_KONTROLLI`-st mööda. */
    await rejects(
      transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "EI_KANTA" }),
      409,
      "casework.errors.transfer_state_conflict"
    );
    assert.equal(store.drafts[0].transferState, "VAJAB_KONTROLLI");
  })
);

test(
  "L19: `to = ULE_KANTUD` annab 400 ja seis EI MUUTU",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);
    await advanceTo(base, "VALMIS_ULEKANDEKS");

    /* KANDEV TEST. Ilma selle keeluta jõuaks mustand `ULE_KANTUD`-i ILMA
       auditireata, ja L7 säilituskell hakkaks käima tõendita ülekande peal. */
    await rejects(
      transitionDraft({ ...base, expectedFrom: "VALMIS_ULEKANDEKS", to: "ULE_KANTUD" }),
      400,
      "casework.errors.use_mark_transferred"
    );
    assert.equal(store.drafts[0].transferState, "VALMIS_ULEKANDEKS");
    assert.equal(store.drafts[0].transferredAt, null, "transferredAt sai väärtuse ilma ülekandeta");
  })
);

test(
  "primitiiv paneb `ULE_KANTUD` korral `transferredAt` SAMAS kutses",
  withFeatureOn(async () => {
    const store = db();
    const { draft } = await seed(store);
    store.drafts[0].transferState = "VALMIS_ULEKANDEKS";

    /* E6 `markTransferred()` kutsub täpselt seda. DB CHECK nõuab, et
       `transferredAt` ja `ULE_KANTUD` käiksid koos — muidu ei hakkaks
       säilituskell kunagi käima. */
    await transitionDraftStateTx(store, {
      draftId: draft.id,
      expectedFrom: "VALMIS_ULEKANDEKS",
      to: STAR2_TRANSFER_STATE.ULE_KANTUD
    });

    assert.equal(store.drafts[0].transferState, "ULE_KANTUD");
    assert.ok(store.drafts[0].transferredAt instanceof Date);
  })
);

test(
  "`reviewKind` elab AINULT `VAJAB_KONTROLLI` seisus",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "VAJAB_KONTROLLI", reviewKind: "KLIENDIGA" });
    assert.equal(store.drafts[0].reviewKind, "KLIENDIGA");

    /* Edasi liikudes NULLITAKSE — vastasel juhul jääks „kontrolliti kliendiga"
       rippuma mustandi külge, mis on ammu edasi liikunud, ja lugeja usuks teda. */
    await transitionDraft({ ...base, expectedFrom: "VAJAB_KONTROLLI", to: "KONTROLLITUD" });
    assert.equal(store.drafts[0].reviewKind, null);

    /* Mujal kui `VAJAB_KONTROLLI` siirdel EIRATAKSE `reviewKind` vaikselt —
       teda ei valideerita, sest ta ei jõua kuhugi. Nii ei kuku legaalne siire
       ära põhjusel, mis teda ei puuduta. */
    const moved = await transitionDraft({
      ...base,
      expectedFrom: "KONTROLLITUD",
      to: "VALMIS_ULEKANDEKS",
      reviewKind: "MUU"
    });
    assert.equal(moved.transferState, "VALMIS_ULEKANDEKS");
    assert.equal(moved.reviewKind, null);
  })
);

test(
  "tundmatu `reviewKind` annab 400",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);
    await rejects(
      transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "VAJAB_KONTROLLI", reviewKind: "MUU" }),
      400,
      "casework.errors.review_kind_unknown"
    );
    assert.equal(store.drafts[0].transferState, "MUSTAND");
  })
);

/* ── väljad ja kirjutuskaitse ───────────────────────────────────────────── */

test(
  "terminaalse mustandi väli ei muutu (409)",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);
    await transitionDraft({ ...base, expectedFrom: "MUSTAND", to: "EI_KANTA" });

    for (const call of [
      setField({ ...base, fieldKey: "EESMARK", text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
      removeField({ ...base, fieldKey: "EESMARK" })
    ]) {
      await rejects(call, 409, "casework.errors.draft_terminal");
    }
    assert.equal(store.fields.length, 0);
  })
);

test(
  "PUT koos `provenance` väljaga EI MUUDA märgist",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await setField({ ...base, fieldKey: "EESMARK", text: "AI mustand", provenance: PROVENANCE.AI_MUSTAND });
    const updated = await setField({
      ...base,
      fieldKey: "EESMARK",
      text: "töötaja parandas",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });

    assert.equal(updated.text, "töötaja parandas");
    assert.equal(updated.provenance, PROVENANCE.AI_MUSTAND, "märgis kadus teksti uuendusega");
    assert.equal(store.fields.length, 1, "upsert lõi teise rea");
  })
);

test(
  "välja võti on MASINVÕTI, mitte sisuväli",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    for (const key of ["eesmark", "Eesmärk", "MINU VÕTI", "1EESMARK", "", "  ", "A".repeat(65)]) {
      await rejects(
        setField({ ...base, fieldKey: key, text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
        400,
        "casework.errors.draft_field_key_invalid"
      );
    }
    assert.equal(store.fields.length, 0);

    const ok = await setField({ ...base, fieldKey: "EESMARK_2", text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK });
    assert.equal(ok.fieldKey, "EESMARK_2");
  })
);

test(
  "päritoluta või tundmatu tüübiga mustand ei salvestu",
  withFeatureOn(async () => {
    const store = db();
    await rejects(
      createDraft({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftType: "MUU", db: store }),
      400,
      "casework.errors.draft_type_unknown"
    );

    const { base } = await seed(store);
    for (const provenance of [null, "", "VALE"]) {
      await rejects(
        setField({ ...base, fieldKey: "EESMARK", text: "x", provenance }),
        400,
        "casework.errors.provenance_unknown"
      );
    }
  })
);

test(
  "loomisel EI SAA anda seisu — iga element algab MUSTAND-ist",
  withFeatureOn(async () => {
    const store = db();
    const draft = await createDraft({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      draftType: DRAFT_TYPE.TEGEVUS,
      transferState: "ULE_KANTUD",
      transferredAt: new Date(),
      db: store
    });
    assert.equal(draft.transferState, "MUSTAND");
    assert.equal(store.drafts[0].transferredAt, null);
  })
);

/* ── ligipääs ───────────────────────────────────────────────────────────── */

test(
  "võõra juhtumi mustand annab 404, mitte 403",
  withFeatureOn(async () => {
    const store = db();
    const { base } = await seed(store);

    await rejects(createDraft({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, draftType: DRAFT_TYPE.TEGEVUS, db: store }), 404);
    await rejects(listDrafts({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, db: store }), 404);
    await rejects(getDraft({ ...base, ownerUserId: STRANGER }), 404);
    await rejects(transitionDraft({ ...base, ownerUserId: STRANGER, expectedFrom: "MUSTAND", to: "EI_KANTA" }), 404);
    assert.equal(store.drafts[0].transferState, "MUSTAND");
  })
);

test(
  "olematu mustandi siire annab 404, MITTE 400 — 404 käib valideerimise ees",
  withFeatureOn(async () => {
    const store = db();
    await seed(store);
    /* Sama õppetund mis E3 `confirm-provenance`-il: võõras objekt ei tohi anda
       teistsugust viga kui olematu objekt. */
    await rejects(
      transitionDraft({
        ownerUserId: OWNER,
        caseWorkAssistId: CASE_ID,
        draftId: "puudub",
        expectedFrom: "MUSTAND",
        to: "KONTROLLITUD",
        db: store
      }),
      404
    );
  })
);

test(
  "kirjutuskaitstud juhtumi mustand ei muutu (409) ja L14 jõustub kirjutuse SEES",
  withFeatureOn(async () => {
    const readOnly = db({ assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "READ_ONLY" }] });
    await rejects(
      createDraft({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftType: DRAFT_TYPE.TEGEVUS, db: readOnly }),
      409
    );

    const assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }];
    const racing = db({
      assists,
      beforeTransaction: () => {
        assists[0].retentionState = "READ_ONLY";
      }
    });
    await rejects(
      createDraft({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftType: DRAFT_TYPE.TEGEVUS, db: racing }),
      409
    );
    assert.equal(racing.drafts.length, 0);
  })
);

test("värav väljas: ükski operatsioon ei tööta ja vastus on 404", async () => {
  const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
  delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
  try {
    const store = db();
    await rejects(createDraft({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, draftType: DRAFT_TYPE.TEGEVUS, db: store }), 404);
    await rejects(listDrafts({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
    assert.equal(store.drafts.length, 0);
  } finally {
    if (previous !== undefined) process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
  }
});
