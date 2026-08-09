/**
 * JTA-V1 (E3) — kohtumise ettevalmistuse teenusleping.
 *
 * KANDEV ASI, MIDA SIIN TÕENDATAKSE, ON PÄRITOLU JÕUSTAMINE. Leping lubab, et
 * AI mustandi märgist ei saa vaikselt maha võtta — ja see lubadus katkeb kahel
 * eri viisil, mis näevad välja ühesugused:
 *
 *   1. `PATCH` võtab `provenance` välja vastu ja kirjutab ta üle
 *   2. `confirm-provenance` lubab suunda inimene → masin
 *
 * Mõlemad on siin nimeliselt, sest kumbki neist ei anna veateadet ega
 * kukkumist: nad lihtsalt kaotavad märgise ära.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { PROVENANCE } from "../../lib/workspaces/provenance.js";
import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import {
  PREP_FIELD_KEY,
  QUESTION_KIND,
  addQuestion,
  confirmFieldProvenance,
  confirmQuestionProvenance,
  createMeetingPrep,
  deleteMeetingPrep,
  getMeetingPrep,
  listActiveMeetingPrepsForOwner,
  listMeetingPreps,
  removeQuestion,
  setPrepField,
  updateMeetingPrep,
  updateQuestion
} from "../../lib/casework/caseWorkMeetingPrep.js";

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

/**
 * Fake-db, mis jäljendab KOLME asja: omanikupiiri, vanema tingimuslikku
 * update'i (L14 jõustaja) ja `provenance`-tingimusega update'i, mille peal
 * seisab kogu kinnitamise garantii.
 *
 * `beforeTransaction` on aken: temaga saab test lasta „teisel tehingul" vahele
 * jõuda täpselt sealt, kus vana `loe → kontrolli → kirjuta` muster katki oli.
 */
function db({
  assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
  preps = [],
  fields = [],
  questions = [],
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
      const key = where.meetingPrepId_fieldKey;
      const existing = rows.find((row) => row.meetingPrepId === key.meetingPrepId && row.fieldKey === key.fieldKey);
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
    preps,
    fields,
    questions,
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
    caseWorkMeetingPrep: collection(preps, "prep"),
    caseWorkMeetingPrepField: collection(fields, "field"),
    caseWorkQuestion: collection(questions, "question", { ordinal: 0 })
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

/* ── ligipääs ───────────────────────────────────────────────────────────── */

test(
  "võõra juhtumi ettevalmistus annab 404, mitte 403",
  withFeatureOn(async () => {
    const store = db();
    /* 403 ütleks „selline juhtum on olemas, aga sina ei tohi" — ja koos sildiga
       oleks see fakt inimese kohta. */
    await rejects(
      createMeetingPrep({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, db: store }),
      404,
      "casework.errors.not_found"
    );
    await rejects(listMeetingPreps({ ownerUserId: STRANGER, caseWorkAssistId: CASE_ID, db: store }), 404);
  })
);

test(
  "kirjutuskaitstud juhtumi ettevalmistus ei muutu (409)",
  withFeatureOn(async () => {
    const store = db({ assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "READ_ONLY" }] });
    await rejects(
      createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }),
      409,
      "casework.errors.not_active"
    );
    assert.equal(store.preps.length, 0);
  })
);

test(
  "L14 jõustub KIRJUTUSE SEES: vahepealne siire tapab kirjutuse",
  withFeatureOn(async () => {
    const assists = [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }];
    /* Täpselt see aken, kus vana `loe → kontrolli → kirjuta` muster katki oli. */
    const store = db({
      assists,
      beforeTransaction: () => {
        assists[0].retentionState = "READ_ONLY";
      }
    });
    await rejects(createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 409);
    assert.equal(store.preps.length, 0);
  })
);

test(
  "prep peab kuuluma SELLESSE juhtumisse — ristkontroll",
  withFeatureOn(async () => {
    const store = db({
      assists: [
        { id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" },
        { id: "case_2", ownerUserId: OWNER, retentionState: "ACTIVE" }
      ]
    });
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: "case_2", db: store });

    /* Ilma ristkontrollita loeks „oma juhtum + võõras prep" ettevalmistust,
       mille juhtumi ID kutsuja ise valis. */
    await rejects(
      getMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store }),
      404
    );
    await rejects(
      setPrepField({
        ownerUserId: OWNER,
        caseWorkAssistId: CASE_ID,
        meetingPrepId: prep.id,
        fieldKey: PREP_FIELD_KEY.GOAL,
        text: "x",
        provenance: PROVENANCE.TOOTAJA_TAHELEPANEK,
        db: store
      }),
      404
    );
  })
);

/* ── valideerimine ──────────────────────────────────────────────────────── */

test(
  "päritoluta väli ega küsimus ei salvestu",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    for (const provenance of [null, "", "   ", "VALE", "ai_mustand"]) {
      await rejects(
        setPrepField({ ...base, fieldKey: PREP_FIELD_KEY.GOAL, text: "x", provenance }),
        400,
        "casework.errors.provenance_unknown"
      );
      await rejects(
        addQuestion({ ...base, kind: QUESTION_KIND.CLARIFYING_QUESTION, text: "x", provenance }),
        400,
        "casework.errors.provenance_unknown"
      );
    }
    assert.equal(store.fields.length, 0);
    assert.equal(store.questions.length, 0);
  })
);

test(
  "tundmatu fieldKey, kind või kohtumise aeg → 400",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    await rejects(
      setPrepField({ ...base, fieldKey: "SUMMARY", text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
      400,
      "casework.errors.prep_field_key_unknown"
    );
    await rejects(
      addQuestion({ ...base, kind: "NOTE", text: "x", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
      400,
      "casework.errors.question_kind_unknown"
    );
    await rejects(
      createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingAt: "eile", db: store }),
      400,
      "casework.errors.meeting_at_invalid"
    );
  })
);

/* ── päritolu jõustamine ────────────────────────────────────────────────── */

test(
  "PATCH koos `provenance` väljaga EI MUUDA märgist",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    await setPrepField({
      ...base,
      fieldKey: PREP_FIELD_KEY.PLAIN_LANGUAGE_NOTES,
      text: "AI koostatud selgitus",
      provenance: PROVENANCE.AI_MUSTAND
    });

    /* SEE ON SELLE TESTI PÕHJUS: teksti parandamine ei tohi märgist maha võtta.
       Kutsuja saadab `provenance` kaasa — teenuskiht peab teda EIRAMA. */
    const updated = await setPrepField({
      ...base,
      fieldKey: PREP_FIELD_KEY.PLAIN_LANGUAGE_NOTES,
      text: "Töötaja parandas sõnastust",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });

    assert.equal(updated.text, "Töötaja parandas sõnastust");
    assert.equal(updated.provenance, PROVENANCE.AI_MUSTAND, "märgis kadus teksti uuendusega");

    const question = await addQuestion({
      ...base,
      kind: QUESTION_KIND.CLARIFYING_QUESTION,
      text: "AI küsimus",
      provenance: PROVENANCE.AI_MUSTAND
    });
    const patched = await updateQuestion({
      ...base,
      questionId: question.id,
      text: "Töötaja sõnastas ümber",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });
    assert.equal(patched.provenance, PROVENANCE.AI_MUSTAND, "küsimuse märgis kadus uuendusega");
  })
);

test(
  "kinnitamine käib AI_MUSTAND → inimene ja ainult selles suunas",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    await setPrepField({
      ...base,
      fieldKey: PREP_FIELD_KEY.GOAL,
      text: "AI mustand",
      provenance: PROVENANCE.AI_MUSTAND
    });

    const confirmed = await confirmFieldProvenance({
      ...base,
      fieldKey: PREP_FIELD_KEY.GOAL,
      from: PROVENANCE.AI_MUSTAND,
      to: PROVENANCE.TOOTAJA_TAHELEPANEK
    });
    assert.equal(confirmed.provenance, PROVENANCE.TOOTAJA_TAHELEPANEK);

    /* TAGASITEED EI OLE: see kirjutaks inimese kinnituse ümber. */
    await rejects(
      confirmFieldProvenance({
        ...base,
        fieldKey: PREP_FIELD_KEY.GOAL,
        from: PROVENANCE.TOOTAJA_TAHELEPANEK,
        to: PROVENANCE.AI_MUSTAND
      }),
      400,
      "casework.errors.provenance_confirm_target"
    );

    /* Inimese märgise „kinnitamine" teiseks inimese märgiseks ei ole kinnitus. */
    await rejects(
      confirmFieldProvenance({
        ...base,
        fieldKey: PREP_FIELD_KEY.GOAL,
        from: PROVENANCE.TOOTAJA_TAHELEPANEK,
        to: PROVENANCE.AMETLIKULT_KONTROLLITUD
      }),
      400,
      "casework.errors.provenance_confirm_source"
    );
  })
);

test(
  "kinnitamine vale `from`-iga annab 409, mitte vaikset üle kirjutamist",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    const question = await addQuestion({
      ...base,
      kind: QUESTION_KIND.CLAIM_TO_VERIFY,
      text: "Väide",
      provenance: PROVENANCE.AI_MUSTAND
    });

    await confirmQuestionProvenance({
      ...base,
      questionId: question.id,
      from: PROVENANCE.AI_MUSTAND,
      to: PROVENANCE.KLIENDI_KINNITATUD
    });

    /* TEINE SAMAAEGNE KINNITUS: `from` ei klapi enam, seega ta EI VÕIDA.
       Ilma tingimusliku update'ita kirjutaks ta esimese kinnituse üle. */
    await rejects(
      confirmQuestionProvenance({
        ...base,
        questionId: question.id,
        from: PROVENANCE.AI_MUSTAND,
        to: PROVENANCE.TOOTAJA_TOLGENDUS
      }),
      409,
      "casework.errors.provenance_conflict"
    );

    const [row] = store.questions;
    assert.equal(row.provenance, PROVENANCE.KLIENDI_KINNITATUD, "esimene kinnitus kirjutati üle");
  })
);

/* ── elutsükkel ─────────────────────────────────────────────────────────── */

test(
  "DELETE kaks korda: teine annab 404",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    assert.deepEqual(await deleteMeetingPrep(base), { ok: true });
    await rejects(deleteMeetingPrep(base), 404);
  })
);

test(
  "üks rida välja kohta — teine kirjutus uuendab, ei lisa",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    await setPrepField({ ...base, fieldKey: PREP_FIELD_KEY.AGENDA, text: "a", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK });
    await setPrepField({ ...base, fieldKey: PREP_FIELD_KEY.AGENDA, text: "b", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK });

    assert.equal(store.fields.length, 1);
    assert.equal(store.fields[0].text, "b");
  })
);

test(
  "kohtumise aja saab eemaldada, mitte ainult määrata",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingAt: "2026-08-20T09:00:00.000Z",
      db: store
    });
    assert.ok(prep.meetingAt instanceof Date);

    /* Tühi väärtus tähendab „eemalda", mitte „jäta" — aeg võib ka ära jääda. */
    const cleared = await updateMeetingPrep({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      meetingPrepId: prep.id,
      meetingAt: null,
      db: store
    });
    assert.equal(cleared.meetingAt, null);
  })
);

test(
  "küsimuse eemaldamine on juhtumipiiri sees",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    const question = await addQuestion({
      ...base,
      kind: QUESTION_KIND.CLARIFYING_QUESTION,
      text: "Küsimus",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });

    await rejects(removeQuestion({ ...base, ownerUserId: STRANGER, questionId: question.id }), 404);
    assert.equal(store.questions.length, 1);

    assert.deepEqual(await removeQuestion({ ...base, questionId: question.id }), { ok: true });
    assert.equal(store.questions.length, 0);
  })
);

test(
  "värav väljas: ükski operatsioon ei tööta ja vastus on 404",
  async () => {
    const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
    delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
    try {
      const store = db();
      await rejects(createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
      await rejects(listMeetingPreps({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store }), 404);
      assert.equal(store.preps.length, 0);
    } finally {
      if (previous !== undefined) process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
    }
  }
);

test(
  "kinnitamine: 404 KÄIB suunakontrolli ees (leitud päris sessioonidega 08.08)",
  withFeatureOn(async () => {
    const store = db();
    const prep = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: prep.id, db: store };

    /* VÕÕRAS TÖÖTAJA saab 404 ka siis, kui ta keha on „vale suunaga". Vana
       järjekord andis talle 400 `provenance_confirm_source`, kuigi kõik teised
       operatsioonid vastasid samale inimesele 404 — ja just sellised erisused
       on need, mille pealt mustrit otsima hakatakse. */
    await rejects(
      confirmFieldProvenance({
        ...base,
        ownerUserId: STRANGER,
        fieldKey: PREP_FIELD_KEY.GOAL,
        from: PROVENANCE.TOOTAJA_TAHELEPANEK,
        to: PROVENANCE.KLIENDI_KINNITATUD
      }),
      404
    );

    /* OMANIKULE oli vana vastus eksitav: olematu välja kinnitamine ütles
       „ainult AI mustandit saab kinnitada", kuigi tegelik põhjus oli, et välja
       ei ole. Ta oleks parandanud `from` väärtust ja saanud sama vastuse. */
    await rejects(
      confirmFieldProvenance({
        ...base,
        fieldKey: PREP_FIELD_KEY.GOAL,
        from: PROVENANCE.TOOTAJA_TAHELEPANEK,
        to: PROVENANCE.KLIENDI_KINNITATUD
      }),
      404
    );

    /* Ja kui rida ON olemas, tuleb suunaviga ikka välja. */
    await setPrepField({
      ...base,
      fieldKey: PREP_FIELD_KEY.GOAL,
      text: "x",
      provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
    });
    await rejects(
      confirmFieldProvenance({
        ...base,
        fieldKey: PREP_FIELD_KEY.GOAL,
        from: PROVENANCE.TOOTAJA_TAHELEPANEK,
        to: PROVENANCE.KLIENDI_KINNITATUD
      }),
      400,
      "casework.errors.provenance_confirm_source"
    );
  })
);

/* ── O-JTA-6: purge'itud ettevalmistus ──────────────────────────────────── */

test(
  "O-JTA-6: purge'itud ettevalmistusse ei kirjutata uut sisu",
  withFeatureOn(async () => {
    const store = db({
      preps: [{ id: "prep_purged", caseWorkAssistId: CASE_ID, contentPurgedAt: new Date(), contentPurgeReason: "WORKER_ARCHIVED_WORKING_MATERIAL" }]
    });
    const base = { ownerUserId: OWNER, caseWorkAssistId: CASE_ID, meetingPrepId: "prep_purged", db: store };

    /* KANDEV ASI: `contentPurgedAt` on AVALDUS, et selle ettevalmistuse kliendi
       sisu on kustutatud. Kui sinna saaks kohe uue välja kirjutada, oleks see
       avaldus vale ja ekraanil seisaks korraga „arhiveeritud" ja sisu. */
    await rejects(
      setPrepField({ ...base, fieldKey: "GOAL", text: "uus sisu", provenance: PROVENANCE.TOOTAJA_TAHELEPANEK }),
      409,
      "casework.errors.prep_content_purged"
    );
    await rejects(
      addQuestion({
        ...base,
        kind: "CLARIFYING_QUESTION",
        text: "uus küsimus",
        provenance: PROVENANCE.TOOTAJA_TAHELEPANEK
      }),
      409,
      "casework.errors.prep_content_purged"
    );

    assert.equal(store.fields.length, 0, "purge'itud ettevalmistusse tekkis väli");
    assert.equal(store.questions.length, 0, "purge'itud ettevalmistusse tekkis küsimus");

    /* 409, MITTE 404: ettevalmistus on kasutajale nähtav ja takistus on seisund,
       mitte ligipääs. Uus kohtumine = uus ettevalmistus (O-JTA-3). */
    const fresh = await createMeetingPrep({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, db: store });
    assert.ok(fresh.id);
    assert.equal(fresh.contentPurgedAt ?? null, null);
  })
);

/* ── SOL-CW-13: laua ettevalmistuste lugeja ─────────────────────────────── */

/**
 * Fake laua lugejale — PÄRISELT filtrit hindav, mitte ridu tagastav.
 *
 * Ülemine `db()` fake võrdleb `where` välju lamedalt ega oskaks pesastatud
 * `caseWorkAssist: { ownerUserId, retentionState }` filtrit ega `OR`-i
 * tõlgendada: ta laseks KÕIK read läbi ja iga allolev test läheks roheliseks
 * ka siis, kui lugeja skoopi ega elutsüklit ei kontrolli. See on sama lõks,
 * mille SOL-CW-11 fake-DB juures juba maha võttis.
 */
function deskDb({ assists = [], preps = [], users = [] } = {}) {
  const byCase = new Map(assists.map((row) => [row.id, row]));

  const matches = (prep, where) => {
    const parent = byCase.get(prep.caseWorkAssistId);
    const scope = where.caseWorkAssist;
    if (scope) {
      if (!parent) return false;
      if (scope.ownerUserId !== undefined && parent.ownerUserId !== scope.ownerUserId) return false;
      if (scope.retentionState !== undefined && parent.retentionState !== scope.retentionState) return false;
    }
    if (where.contentPurgedAt === null && (prep.contentPurgedAt ?? null) !== null) return false;
    if (Array.isArray(where.OR)) {
      const ok = where.OR.some((clause) => {
        if ("meetingAt" in clause && clause.meetingAt === null) return (prep.meetingAt ?? null) === null;
        if (clause.meetingAt?.gte) return prep.meetingAt && prep.meetingAt.getTime() >= clause.meetingAt.gte.getTime();
        return false;
      });
      if (!ok) return false;
    }
    return true;
  };

  /** `nulls: "last"` PÄRISELT: ilma selleta ei tõendaks järjestustest midagi. */
  const compare = (left, right) => {
    const a = left.meetingAt ? left.meetingAt.getTime() : null;
    const b = right.meetingAt ? right.meetingAt.getTime() : null;
    if (a === null && b !== null) return 1;
    if (a !== null && b === null) return -1;
    if (a !== null && b !== null && a !== b) return a - b;
    const ua = left.updatedAt ? left.updatedAt.getTime() : 0;
    const ub = right.updatedAt ? right.updatedAt.getTime() : 0;
    if (ua !== ub) return ub - ua;
    return left.id < right.id ? 1 : -1;
  };

  const store = {
    calls: { userFindMany: 0 },
    caseWorkMeetingPrep: {
      async findMany({ where, select, orderBy, take }) {
        store.seenSelect = select;
        store.seenOrderBy = orderBy;
        const rows = preps.filter((row) => matches(row, where)).sort(compare);
        const page = typeof take === "number" ? rows.slice(0, take) : rows;
        return page.map((row) => {
          const parent = byCase.get(row.caseWorkAssistId) || null;
          return {
            id: row.id,
            caseWorkAssistId: row.caseWorkAssistId,
            meetingAt: row.meetingAt ?? null,
            updatedAt: row.updatedAt ?? null,
            caseWorkAssist: parent
              ? {
                  clientUserId: parent.clientUserId ?? null,
                  clientDisplayName: parent.clientDisplayName ?? null,
                  clientExternalRef: parent.clientExternalRef ?? null,
                  clientErasedAt: parent.clientErasedAt ?? null
                }
              : null
          };
        });
      }
    },
    user: {
      async findMany({ where }) {
        store.calls.userFindMany += 1;
        return users.filter((row) => where.id.in.includes(row.id));
      }
    }
  };
  return store;
}

const DAY_START = new Date("2026-08-09T00:00:00.000Z");

function prepRow(overrides = {}) {
  return {
    id: "prep_1",
    caseWorkAssistId: CASE_ID,
    meetingAt: new Date("2026-08-10T09:00:00.000Z"),
    contentPurgedAt: null,
    updatedAt: new Date("2026-08-09T08:00:00.000Z"),
    ...overrides
  };
}

function activeCase(overrides = {}) {
  return { id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE", ...overrides };
}

test(
  "SOL-CW-13: juhtum ILMA ettevalmistuseta ei tekita lauale rida",
  withFeatureOn(async () => {
    /* Vana teostus kuvas iga aktiivse juhtumi ettevalmistustööna — just seda
       see test keelab. */
    const store = deskDb({ assists: [activeCase()], preps: [] });
    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(items, []);
  })
);

test(
  "SOL-CW-13: mitu ettevalmistust — lähim kohtumine ees, ajata plaan viimane",
  withFeatureOn(async () => {
    const store = deskDb({
      assists: [activeCase(), activeCase({ id: "case_2" })],
      preps: [
        prepRow({ id: "prep_kaugem", meetingAt: new Date("2026-08-20T09:00:00.000Z") }),
        prepRow({ id: "prep_ajata", meetingAt: null }),
        prepRow({ id: "prep_lahim", caseWorkAssistId: "case_2", meetingAt: new Date("2026-08-09T15:00:00.000Z") })
      ]
    });

    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(
      items.map((row) => row.id),
      ["prep_lahim", "prep_kaugem", "prep_ajata"],
      "laud on tööjärg: lähim kohtumine ees ja ajata plaan ei tohi ette upuda"
    );
    assert.equal(items[0].caseWorkAssistId, "case_2");
  })
);

test(
  "SOL-CW-13: purge'itud ettevalmistus ei ole laual tööjärg",
  withFeatureOn(async () => {
    /* Marker jääb juhtumi pinnale (O-JTA-6), aga laual ei ole tal midagi öelda:
       töötaja arhiveeris töömaterjali ise. */
    const store = deskDb({
      assists: [activeCase()],
      preps: [
        prepRow({ id: "prep_purged", contentPurgedAt: new Date("2026-08-08T10:00:00.000Z") }),
        prepRow({ id: "prep_elus" })
      ]
    });
    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(items.map((row) => row.id), ["prep_elus"]);
  })
);

test(
  "SOL-CW-13: võõra omaniku ettevalmistus ei jõua lauale",
  withFeatureOn(async () => {
    const store = deskDb({
      assists: [activeCase(), activeCase({ id: "case_voeras", ownerUserId: STRANGER })],
      preps: [prepRow({ id: "prep_minu" }), prepRow({ id: "prep_voeras", caseWorkAssistId: "case_voeras" })]
    });
    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(items.map((row) => row.id), ["prep_minu"]);

    const empty = await listActiveMeetingPrepsForOwner({ ownerUserId: "", from: DAY_START, db: store });
    assert.deepEqual(empty.items, [], "omanikuta kutse ei tohi anda kellegi ridu");
  })
);

test(
  "SOL-CW-13: READ_ONLY ja ARCHIVED juhtumi ettevalmistus on laualt läinud",
  withFeatureOn(async () => {
    /* Sama reegel mis mustanditel (SOL-CW-03): mida keegi enam muuta ei tohi,
       ei ole tööjärg. */
    const store = deskDb({
      assists: [
        activeCase(),
        activeCase({ id: "case_ro", retentionState: "READ_ONLY" }),
        activeCase({ id: "case_arh", retentionState: "ARCHIVED" })
      ],
      preps: [
        prepRow({ id: "prep_aktiivne" }),
        prepRow({ id: "prep_ro", caseWorkAssistId: "case_ro" }),
        prepRow({ id: "prep_arh", caseWorkAssistId: "case_arh" })
      ]
    });
    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(items.map((row) => row.id), ["prep_aktiivne"]);
  })
);

test(
  "SOL-CW-13: möödunud kohtumine kaob, TÄNANE jääb terveks päevaks",
  withFeatureOn(async () => {
    /* Piir on päeva ALGUS, mitte `now`: kell 09:00 algav kohtumine ei tohi
       laualt kaduda 09:01, kui töötaja alles istub selles. */
    const store = deskDb({
      assists: [activeCase()],
      preps: [
        prepRow({ id: "prep_eile", meetingAt: new Date("2026-08-08T09:00:00.000Z") }),
        prepRow({ id: "prep_tana_hommikul", meetingAt: new Date("2026-08-09T09:00:00.000Z") })
      ]
    });
    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.deepEqual(items.map((row) => row.id), ["prep_tana_hommikul"]);

    /* Ilma piirita EI filtreerita midagi — piir tuleb kutsujalt, mitte lugejalt. */
    const all = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, db: store });
    assert.equal(all.items.length, 2);
  })
);

test(
  "SOL-CW-13: silt tuleb JUHTUMILT ja kustutatud kliendiviide võidab",
  withFeatureOn(async () => {
    const store = deskDb({
      assists: [
        activeCase({ id: "case_nimi", clientUserId: "u1" }),
        activeCase({ id: "case_kustutatud", clientUserId: "u1", clientErasedAt: new Date("2026-08-01T00:00:00.000Z") })
      ],
      preps: [
        prepRow({ id: "prep_nimi", caseWorkAssistId: "case_nimi", meetingAt: new Date("2026-08-09T10:00:00.000Z") }),
        prepRow({
          id: "prep_kustutatud",
          caseWorkAssistId: "case_kustutatud",
          meetingAt: new Date("2026-08-09T11:00:00.000Z")
        })
      ],
      users: [{ id: "u1", profile: { firstName: "Mari", lastName: "Tamm" } }]
    });

    const { items } = await listActiveMeetingPrepsForOwner({ ownerUserId: OWNER, from: DAY_START, db: store });
    assert.equal(items[0].label.text, "Mari Tamm");
    assert.equal(items[1].label.labelKey, "casework.label.erased_client");
    assert.equal(items[1].label.text, null, "kustutatud kliendiviite nime ei tohi laual kuvada");
    assert.equal(store.calls.userFindMany, 1, "N rida ei tohi teha N päringut");
  })
);

test(
  "SOL-CW-13: deskriptor ei kanna ettevalmistuse SISU ja limiit peab",
  withFeatureOn(async () => {
    const store = deskDb({
      assists: [activeCase()],
      preps: [
        prepRow({ id: "prep_a", meetingAt: new Date("2026-08-09T10:00:00.000Z") }),
        prepRow({ id: "prep_b", meetingAt: new Date("2026-08-09T11:00:00.000Z") }),
        prepRow({ id: "prep_c", meetingAt: new Date("2026-08-09T12:00:00.000Z") })
      ]
    });

    const { items } = await listActiveMeetingPrepsForOwner({
      ownerUserId: OWNER,
      from: DAY_START,
      limit: 2,
      db: store
    });
    assert.equal(items.length, 2);
    assert.deepEqual(Object.keys(items[0]).sort(), ["caseWorkAssistId", "id", "label", "meetingAt", "updatedAt"]);

    /* Väljavalik on osa lepingust: pesastatud juhtum toob AINULT sildi väljad. */
    assert.deepEqual(Object.keys(store.seenSelect.caseWorkAssist.select).sort(), [
      "clientDisplayName",
      "clientErasedAt",
      "clientExternalRef",
      "clientUserId"
    ]);
  })
);
