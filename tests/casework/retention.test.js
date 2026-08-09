/**
 * JTA-V1 (E7) — säilituse JÕUSTAMISE leping.
 *
 * SEE SVIIT EI TESTI KUUPÄEVA ARVUTAMIST. v1 tegi täpselt seda ja tulemus oli
 * otsus ilma mehhanismita: valem oli õige, keegi ei käivitanud teda ja midagi ei
 * kustunud. Siin testitakse, MIS PÄRISELT KAOB ja mis alles jääb.
 *
 * KOLM VIGA, MIS KATKEVAD VAIKSELT:
 *
 *   1. KELL NULLIB END (v2 päris viga). Hoiatus kirjutas auditisse uue
 *      `ARCHIVED` rea ja kell hakkas otsast peale — 12 kuust sai 23. Ükski
 *      veateade ei tekkinud; juhtum lihtsalt ei kustunud kunagi.
 *   2. HOIATUS KORDUB. Kordumatus tuleb teavituskihi `dedupeKey`-st, mitte
 *      säilitustöö omast jäljest — ja seda peab tõendama TEINE käivitus.
 *   3. PURGE VÕTAB KAASA TÕENDI. Kustuda tohib SISU; mustandi rida,
 *      ülekande fakt ja väljade loend peavad üle elama.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { CASEWORK_FLAG_KEYS } from "../../lib/casework/flags.js";
import {
  PURGE_REASON,
  RETENTION_MONTHS,
  WARNING_DAYS,
  addMonths,
  archiveWorkingMaterial,
  deletionDueAt,
  findCasesDueForDeletion,
  findCasesDueForWarning,
  findDraftsDueForPurge,
  getCaseRetentionClock,
  purgeDraftContent,
  purgeDueAt,
  runRetention,
  warningDueAt
} from "../../lib/casework/retention.js";

const OWNER = "worker_a";
const CASE_ID = "case_1";
const NOW = new Date("2027-06-15T09:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

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

/** Kuupäev, mis on täpselt `months` kuud ja `days` päeva TAGASI `NOW`-st. */
function ago({ months = 0, days = 0 } = {}) {
  return new Date(addMonths(NOW, -months).getTime() - days * DAY_MS);
}

function db({
  assists = [],
  drafts = [],
  fields = [],
  preps = [],
  prepFields = [],
  questions = [],
  audits = [],
  notifications = [],
  events = []
} = {}) {
  let sequence = 0;
  const nextId = (prefix) => `${prefix}_${++sequence}`;

  const matches = (row, where = {}) =>
    Object.entries(where).every(([key, value]) => {
      if (value === undefined) return true;
      if (value === null) return row[key] === null || row[key] === undefined;
      if (value && typeof value === "object" && !(value instanceof Date)) {
        if ("not" in value) {
          if (value.not === null) {
            if (row[key] === null || row[key] === undefined) return false;
          } else if (row[key] === value.not) {
            return false;
          }
        }
        if ("lte" in value && !(row[key] && new Date(row[key]) <= new Date(value.lte))) return false;
        if ("gt" in value && !(row[key] && new Date(row[key]) > new Date(value.gt))) return false;
        if ("in" in value && !value.in.includes(row[key])) return false;
        return true;
      }
      if (value instanceof Date) return row[key] && new Date(row[key]).getTime() === value.getTime();
      return row[key] === value;
    });

  const collection = (rows, prefix) => ({
    async create({ data }) {
      const row = { id: nextId(prefix), createdAt: new Date(), updatedAt: new Date(), ...data };
      rows.push(row);
      return row;
    },
    async findFirst({ where = {} }) {
      return rows.find((row) => matches(row, where)) || null;
    },
    async findUnique({ where = {} }) {
      return rows.find((row) => Object.entries(where).every(([key, value]) => row[key] === value)) || null;
    },
    /**
     * `orderBy` ja `skip` on siin PÄRISELT, mitte kaunistuseks.
     *
     * Ilma nendeta „läbiks" iga lehitsev päring testi ka siis, kui ta annab
     * alati sama esimese lehe — ja just seda viga SOL-CW-07 kirjeldab. Fake,
     * mis ignoreerib `skip`-i, teeb nälgimise nähtamatuks.
     */
    async findMany({ where = {}, take, skip = 0, orderBy }) {
      let found = rows.filter((row) => matches(row, where));
      const order = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
      for (const rule of [...order].reverse()) {
        const [key, direction] = Object.entries(rule)[0] || [];
        if (!key) continue;
        found = [...found].sort((a, b) => {
          const left = a[key] instanceof Date ? a[key].getTime() : a[key];
          const right = b[key] instanceof Date ? b[key].getTime() : b[key];
          if (left === right) return 0;
          const compared = left < right ? -1 : 1;
          return direction === "desc" ? -compared : compared;
        });
      }
      const offset = Number.isInteger(skip) && skip > 0 ? skip : 0;
      const sliced = found.slice(offset);
      return typeof take === "number" ? sliced.slice(0, take) : sliced;
    },
    async updateMany({ where = {}, data }) {
      const found = rows.filter((row) => matches(row, where));
      for (const row of found) Object.assign(row, data, { updatedAt: new Date() });
      return { count: found.length };
    },
    async deleteMany({ where = {} }) {
      const keep = rows.filter((row) => !matches(row, where));
      const removed = rows.length - keep.length;
      rows.length = 0;
      rows.push(...keep);
      return { count: removed };
    }
  });

  const caseWorkAssist = collection(assists, "case");
  const baseDeleteMany = caseWorkAssist.deleteMany;
  caseWorkAssist.deleteMany = async ({ where = {} }) => {
    const doomed = assists.filter((row) => matches(row, where)).map((row) => row.id);
    const result = await baseDeleteMany({ where });
    /* KASKAAD (L15) — päris andmebaasis teeb seda FK, siin peab fake teda
       jäljendama. Ilma selleta „tõendaks" test kustutust, mis jätab lapsed
       rippuma, ja kaskaadi katkemine paistaks välja alles sondis. */
    for (const caseId of doomed) {
      const doomedDrafts = drafts.filter((row) => row.caseWorkAssistId === caseId).map((row) => row.id);
      const doomedPreps = preps.filter((row) => row.caseWorkAssistId === caseId).map((row) => row.id);
      for (const list of [
        [fields, (row) => doomedDrafts.includes(row.draftId)],
        [drafts, (row) => row.caseWorkAssistId === caseId],
        [prepFields, (row) => doomedPreps.includes(row.meetingPrepId)],
        [questions, (row) => doomedPreps.includes(row.meetingPrepId)],
        [preps, (row) => row.caseWorkAssistId === caseId],
        [audits, (row) => row.caseWorkAssistId === caseId],
        [events, (row) => row.caseWorkAssistId === caseId]
      ]) {
        const [rows, doomedRow] = list;
        const keep = rows.filter((row) => !doomedRow(row));
        rows.length = 0;
        rows.push(...keep);
      }
    }
    return result;
  };

  const notificationEvent = collection(notifications, "notification");
  const baseNotificationCreate = notificationEvent.create;
  notificationEvent.create = async ({ data }) => {
    /* `dedupeKey` on UNIKAALNE INDEKS — just tema kannab hoiatuse kordumatust
       (L17), mitte säilitustöö oma kontroll. */
    if (notifications.some((row) => row.dedupeKey === data.dedupeKey)) {
      const error = new Error("Unique constraint failed");
      error.code = "P2002";
      throw error;
    }
    return baseNotificationCreate({ data });
  };

  const database = {
    assists,
    drafts,
    fields,
    preps,
    prepFields,
    questions,
    audits,
    notifications,
    events,
    async $transaction(callback) {
      if (typeof callback === "function") return callback(database);
      return Promise.all(callback);
    },
    caseWorkAssist,
    caseWorkDraft: collection(drafts, "draft"),
    caseWorkDraftField: collection(fields, "field"),
    caseWorkMeetingPrep: collection(preps, "prep"),
    caseWorkMeetingPrepField: collection(prepFields, "prep_field"),
    caseWorkQuestion: collection(questions, "question"),
    caseWorkRetentionAudit: collection(audits, "audit"),
    caseWorkTransferEvent: collection(events, "event"),
    notificationEvent,
    user: {
      async findUnique() {
        return { id: OWNER, notificationEmailEnabled: false };
      }
    }
  };

  return database;
}

/** Arhiveeritud juhtum koos PÄRIS üleminekureaga (L17). */
function archivedCase({ id = CASE_ID, archivedAt }) {
  return {
    assist: { id, ownerUserId: OWNER, retentionState: "ARCHIVED" },
    audit: {
      id: `audit_${id}`,
      caseWorkAssistId: id,
      ownerUserId: OWNER,
      actorUserId: OWNER,
      fromState: "READ_ONLY",
      toState: "ARCHIVED",
      reason: "lõpetatud",
      createdAt: archivedAt
    }
  };
}

/* ── valem ──────────────────────────────────────────────────────────────── */

test("hoiatus on `deletionAt − 30 päeva`, mitte 11 kuud (v3 parandus)", () => {
  /* Kalendrikuu on 28–31 päeva. „11 kuud" annaks akna, mis sõltub sellest,
     millal juhtum arhiveeriti — lubadus anti PÄEVADES. */
  for (const iso of ["2026-01-31T00:00:00.000Z", "2026-02-28T12:00:00.000Z", "2026-07-15T23:30:00.000Z"]) {
    const archivedAt = new Date(iso);
    const deletion = deletionDueAt(archivedAt);
    const warning = warningDueAt(archivedAt);
    assert.equal((deletion.getTime() - warning.getTime()) / DAY_MS, WARNING_DAYS, `aken ei ole 30 päeva: ${iso}`);
  }
});

test("12 kuud liidetakse KALENDRIS ja liigaasta ei veere kuust välja", () => {
  assert.equal(purgeDueAt(new Date("2028-02-29T10:00:00.000Z")).toISOString(), "2029-02-28T10:00:00.000Z");
  assert.equal(purgeDueAt(new Date("2026-03-31T10:00:00.000Z")).toISOString(), "2027-03-31T10:00:00.000Z");
  assert.equal(addMonths(new Date("2026-01-31T00:00:00.000Z"), RETENTION_MONTHS).toISOString(), "2027-01-31T00:00:00.000Z");
});

/* ── töö 1: mustandi sisu purge ─────────────────────────────────────────── */

test(
  "purge kustutab SISU ja jätab rea, ülekande fakti ning väljade loendi alles",
  withFeatureOn(async () => {
    const transferredAt = ago({ months: RETENTION_MONTHS + 1 });
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ARCHIVED" }],
      drafts: [
        {
          id: "draft_old",
          caseWorkAssistId: CASE_ID,
          draftType: "EESMARGI_SONASTUS",
          transferState: "ULE_KANTUD",
          transferredAt,
          contentPurgedAt: null,
          contentPurgeReason: null
        }
      ],
      fields: [
        { id: "f1", draftId: "draft_old", fieldKey: "EESMARK", text: "kliendi sisu", provenance: "KLIENDI_OELDUD" }
      ],
      events: [
        {
          id: "e1",
          caseWorkAssistId: CASE_ID,
          draftId: "draft_old",
          ownerUserId: OWNER,
          kind: "MARKED_AS_TRANSFERRED",
          fieldKeys: ["EESMARK"]
        }
      ]
    });

    const due = await findDraftsDueForPurge({ now: NOW, db: store });
    assert.equal(due.length, 1);

    const result = await purgeDraftContent({ draftId: "draft_old", now: NOW, db: store });
    assert.equal(result.purged, true);
    assert.equal(result.fields, 1);

    assert.equal(store.fields.length, 0, "sisu ei kustunud");
    assert.equal(store.drafts.length, 1, "mustandi rida kustus koos sisuga");
    assert.equal(store.drafts[0].contentPurgeReason, PURGE_REASON.RETENTION_AFTER_TRANSFER);
    assert.equal(store.events.length, 1, "ülekande tõend kustus");
    assert.deepEqual(store.events[0].fieldKeys, ["EESMARK"], "väljade loend kustus koos sisuga");
  })
);

test(
  "purge ei puuduta kandmata mustandit ega seda, kelle 12 kuud ei ole täis",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      drafts: [
        {
          id: "draft_fresh",
          caseWorkAssistId: CASE_ID,
          transferState: "ULE_KANTUD",
          transferredAt: ago({ months: 3 }),
          contentPurgedAt: null
        },
        {
          id: "draft_never",
          caseWorkAssistId: CASE_ID,
          transferState: "MUSTAND",
          transferredAt: null,
          contentPurgedAt: null
        },
        {
          id: "draft_declined",
          caseWorkAssistId: CASE_ID,
          transferState: "EI_KANTA",
          transferredAt: null,
          contentPurgedAt: null
        }
      ]
    });

    const due = await findDraftsDueForPurge({ now: NOW, db: store });
    assert.equal(due.length, 0, "kandmata või värske mustand sattus purge-nimekirja");
  })
);

test(
  "purge on kordumatu: teine käivitus ei leia sama rida",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ARCHIVED" }],
      drafts: [
        {
          id: "draft_old",
          caseWorkAssistId: CASE_ID,
          transferState: "ULE_KANTUD",
          transferredAt: ago({ months: RETENTION_MONTHS + 1 }),
          contentPurgedAt: null
        }
      ],
      fields: [{ id: "f1", draftId: "draft_old", fieldKey: "EESMARK", text: "sisu" }]
    });

    await purgeDraftContent({ draftId: "draft_old", now: NOW, db: store });
    const second = await purgeDraftContent({ draftId: "draft_old", now: NOW, db: store });

    assert.equal(second.purged, false, "teine käivitus väitis, et tema kustutas");
    assert.equal((await findDraftsDueForPurge({ now: NOW, db: store })).length, 0);
  })
);

/* ── töö 2 ja 3: hoiatus ja kustutus ────────────────────────────────────── */

test(
  "kell käib PÄRIS üleminekust, mitte viimasest auditireast (v2 kella viga)",
  withFeatureOn(async () => {
    const archivedAt = ago({ months: RETENTION_MONTHS, days: 1 });
    const { assist, audit } = archivedCase({ archivedAt });
    const store = db({
      assists: [assist],
      audits: [
        audit,
        /* v2 kirjutas hoiatuse hetkel UUE `ARCHIVED` rea ja kell nullis end.
           See rida on siin MEELEGA ja ta on uuem — kui jõustaja loeks
           „viimast", ei kustuks juhtum kunagi. */
        {
          id: "audit_late",
          caseWorkAssistId: CASE_ID,
          ownerUserId: OWNER,
          actorUserId: OWNER,
          fromState: "ARCHIVED",
          toState: "ARCHIVED",
          reason: "retention_warning_sent",
          createdAt: ago({ months: 1 })
        }
      ]
    });

    const due = await findCasesDueForDeletion({ now: NOW, db: store });
    assert.equal(due.length, 1, "kell nullis end hilisema auditirea peale");
  })
);

test(
  "hoiatus läheb ÜKS kord ja EI KIRJUTA auditisse ühtegi rida (L17)",
  withFeatureOn(async () => {
    const { assist, audit } = archivedCase({ archivedAt: ago({ months: RETENTION_MONTHS, days: -15 }) });
    const store = db({ assists: [assist], audits: [audit] });

    const auditsBefore = store.audits.length;

    const first = await runRetention({ now: NOW, db: store });
    const second = await runRetention({ now: NOW, db: store });
    const third = await runRetention({ now: NOW, db: store });

    assert.equal(first.warningsSent, 1);
    assert.equal(second.warningsSent, 0, "hoiatus läks teist korda");
    assert.equal(third.warningsSent, 0);
    assert.equal(store.notifications.length, 1);

    /* L17 KANDEV KONTROLL: auditiridade arv enne ja pärast kolme käivitust on
       sama. Säilitustöö ei tohi väita üleminekut, mida ei toimunud. */
    assert.equal(store.audits.length, auditsBefore, "säilitustöö kirjutas auditisse");
  })
);

test(
  "hoiatuse aken on TÄPSELT 30 päeva: 31 päeva enne on vara, üle piiri on hilja",
  withFeatureOn(async () => {
    /* Kolm juhtumit, kolm eri kohta ajajoonel. Ilma piirideta hoiataks töö kas
       liiga vara (ja kordaks seda kuu aega) või liiga hilja (ja juhtum kustuks
       enne, kui omanik teada sai). */
    const early = archivedCase({ id: "case_early", archivedAt: ago({ months: RETENTION_MONTHS, days: -31 }) });
    const inWindow = archivedCase({ id: "case_window", archivedAt: ago({ months: RETENTION_MONTHS, days: -5 }) });
    const late = archivedCase({ id: "case_late", archivedAt: ago({ months: RETENTION_MONTHS, days: 1 }) });

    const store = db({
      assists: [early.assist, inWindow.assist, late.assist],
      audits: [early.audit, inWindow.audit, late.audit]
    });

    const due = await findCasesDueForWarning({ now: NOW, db: store });
    assert.deepEqual(
      due.map((row) => row.caseWorkAssistId),
      ["case_window"]
    );
  })
);

/* ── SOL-CW-07: hoiatuste nälgimine ─────────────────────────────────────── */

/** `count` juhtumit hoiatusaknas, vanimast uuemani. */
function warningWindowCases(count) {
  const assists = [];
  const audits = [];
  for (let index = 0; index < count; index += 1) {
    /* Vanim ees: `days: -1 - index` tähendab, et index 0 on kustutuspiirile
       kõige lähemal ja tuleb `orderBy createdAt asc` järgi esimesena. */
    const seeded = archivedCase({
      id: `case_${String(index).padStart(2, "0")}`,
      archivedAt: ago({ months: RETENTION_MONTHS, days: -1 - index })
    });
    assists.push(seeded.assist);
    audits.push(seeded.audit);
  }
  return { assists, audits };
}

test(
  "SOL-CW-07: juba hoiatatud read ei täida batch'i — korduvad käivitused jõuavad kõigini",
  withFeatureOn(async () => {
    /* Auditis kirjeldatud stsenaarium: hoiatusaknas on rohkem kõlblikke ridu
       kui batch'i suurus. Enne parandust tõi iga käivitus samad vanimad read
       ja töö raporteeris ausalt „0 hoiatust", sest kõik olid duplikaadid —
       uuemad juhtumid ei saanud hoiatust enne, kui vanad kustutusaknasse
       liikusid. */
    const { assists, audits } = warningWindowCases(7);
    const store = db({ assists, audits });

    const first = await runRetention({ now: NOW, batch: 3, db: store });
    const second = await runRetention({ now: NOW, batch: 3, db: store });
    const third = await runRetention({ now: NOW, batch: 3, db: store });

    assert.equal(first.warningsSent, 3);
    assert.equal(second.warningsSent, 3, "teine käivitus tõi samad juba hoiatatud read");
    assert.equal(third.warningsSent, 1, "kolmas käivitus ei jõudnud sabani");

    const warnedCases = store.notifications.map((row) => row.sourceId).sort();
    assert.equal(warnedCases.length, 7, "iga juhtum peab saama TÄPSELT ühe hoiatuse");
    assert.deepEqual(warnedCases, assists.map((row) => row.id).sort());

    const fourth = await runRetention({ now: NOW, batch: 3, db: store });
    assert.equal(fourth.warningsSent, 0, "neljas käivitus hoiatas kedagi teist korda");
    assert.equal(store.notifications.length, 7);
  })
);

test(
  "SOL-CW-07: üks käivitus täidab batch'i HOIATAMATA ridadega, mitte duplikaatidega",
  withFeatureOn(async () => {
    const { assists, audits } = warningWindowCases(6);
    const store = db({ assists, audits });

    /* Kaks vanimat on juba hoiatatud — nemad ei tohi batch'i kohti võtta. */
    await runRetention({ now: NOW, batch: 2, db: store });
    assert.equal(store.notifications.length, 2);

    const due = await findCasesDueForWarning({ now: NOW, limit: 3, db: store });
    assert.equal(due.length, 3, "juba hoiatatud read täitsid batch'i");
    assert.deepEqual(
      due.map((row) => row.caseWorkAssistId),
      ["case_02", "case_03", "case_04"]
    );
  })
);

test(
  "SOL-CW-07: hoiatatud juhtumi vahepealne kustumine ei lõpeta lehitsemist ennatlikult",
  withFeatureOn(async () => {
    /* `alive` pikkus ei kõlba „allikas otsas" otsuseks: temast on kustutatud
       juhtumid juba välja filtreeritud. Kui lehitsemine seda mõõdaks, jääks
       saba leidmata. */
    const { assists, audits } = warningWindowCases(5);
    /* Esimene auditirida on olemas, aga juhtum ise on kustunud. */
    const store = db({ assists: assists.slice(1), audits });

    const due = await findCasesDueForWarning({ now: NOW, limit: 2, db: store });
    assert.deepEqual(
      due.map((row) => row.caseWorkAssistId),
      ["case_01", "case_02"]
    );
  })
);

test(
  "hoiatuse saatmine EI NIHUTA kustutuse aega (v2 vea otsene regressioonitest)",
  withFeatureOn(async () => {
    const archivedAt = ago({ months: RETENTION_MONTHS, days: -15 });
    const { assist, audit } = archivedCase({ archivedAt });
    const store = db({ assists: [assist], audits: [audit] });

    const before = deletionDueAt(archivedAt).toISOString();
    await runRetention({ now: NOW, db: store });
    const clock = await getCaseRetentionClock({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store });

    assert.equal(clock.deletionAt.toISOString(), before, "hoiatus lükkas kustutust edasi");
  })
);

test(
  "kustutus viib KASKAADIS lapsed ja hoiatust enam ei saadeta",
  withFeatureOn(async () => {
    const { assist, audit } = archivedCase({ archivedAt: ago({ months: RETENTION_MONTHS, days: 2 }) });
    const store = db({
      assists: [assist],
      audits: [audit],
      drafts: [{ id: "d1", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null }],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "sisu" }],
      events: [{ id: "e1", caseWorkAssistId: CASE_ID, draftId: "d1", ownerUserId: OWNER, kind: "COPIED_FOR_STAR2" }]
    });

    const result = await runRetention({ now: NOW, db: store });

    assert.equal(result.casesDeleted, 1);
    assert.equal(result.warningsSent, 0, "üle piiri läinud juhtum sai hoiatuse, mitte kustutuse");
    assert.equal(store.assists.length, 0);
    assert.equal(store.drafts.length, 0, "mustand jäi rippuma");
    assert.equal(store.fields.length, 0, "väljad jäid rippuma");
    assert.equal(store.audits.length, 0, "auditirida jäi rippuma");
    assert.equal(store.events.length, 0, "ülekandesündmus jäi rippuma");
  })
);

test(
  "juhtum, mille keegi vahepeal tagasi tõi, EI kustu",
  withFeatureOn(async () => {
    const { assist, audit } = archivedCase({ archivedAt: ago({ months: RETENTION_MONTHS, days: 2 }) });
    const store = db({ assists: [{ ...assist, retentionState: "READ_ONLY" }], audits: [audit] });

    const result = await runRetention({ now: NOW, db: store });
    assert.equal(result.casesDeleted, 0);
    assert.equal(store.assists.length, 1);
  })
);

test(
  "värav väljas → 0 tööd ja 0 kirjutust",
  async () => {
    const { assist, audit } = archivedCase({ archivedAt: ago({ months: RETENTION_MONTHS, days: 2 }) });
    const store = db({
      assists: [assist],
      audits: [audit],
      drafts: [
        {
          id: "d1",
          caseWorkAssistId: CASE_ID,
          transferState: "ULE_KANTUD",
          transferredAt: ago({ months: RETENTION_MONTHS + 1 }),
          contentPurgedAt: null
        }
      ],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "sisu" }]
    });

    const result = await runRetention({ now: NOW, db: store });
    assert.equal(result.disabled, true);
    assert.equal(store.assists.length, 1);
    assert.equal(store.fields.length, 1);
    assert.equal(store.notifications.length, 0);
  }
);

test(
  "kuiv käivitus loendab, aga ei kirjuta",
  withFeatureOn(async () => {
    const { assist, audit } = archivedCase({ archivedAt: ago({ months: RETENTION_MONTHS, days: 2 }) });
    const store = db({ assists: [assist], audits: [audit] });

    const result = await runRetention({ now: NOW, dryRun: true, db: store });
    assert.equal(result.casesDeleted, 1);
    assert.equal(store.assists.length, 1, "kuiv käivitus kustutas juhtumi");
    assert.equal(store.notifications.length, 0);
  })
);

test(
  "ühe rea tõrge ei peata partiid",
  withFeatureOn(async () => {
    const first = archivedCase({ id: "case_broken", archivedAt: ago({ months: RETENTION_MONTHS, days: 3 }) });
    const second = archivedCase({ id: "case_ok", archivedAt: ago({ months: RETENTION_MONTHS, days: 2 }) });
    const store = db({ assists: [first.assist, second.assist], audits: [first.audit, second.audit] });

    const original = store.caseWorkAssist.deleteMany;
    store.caseWorkAssist.deleteMany = async (args) => {
      if (args?.where?.id === "case_broken") throw new Error("DB kukkus");
      return original(args);
    };

    const result = await runRetention({ now: NOW, db: store, logger: { error: () => {} } });

    assert.equal(result.failed, 1);
    assert.equal(result.casesDeleted, 1, "teine juhtum jäi esimese tõrke taha kinni");
    assert.ok(store.assists.some((row) => row.id === "case_broken"));
    assert.ok(!store.assists.some((row) => row.id === "case_ok"));
  })
);

/* ── loendus pinnale ────────────────────────────────────────────────────── */

test(
  "kell on pinnal nähtav kogu 12 kuu jooksul ja tuleb SAMAST valemist",
  withFeatureOn(async () => {
    const archivedAt = ago({ months: 2 });
    const { assist, audit } = archivedCase({ archivedAt });
    const store = db({ assists: [assist], audits: [audit] });

    const clock = await getCaseRetentionClock({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store });
    assert.equal(clock.deletionAt.toISOString(), deletionDueAt(archivedAt).toISOString());
    assert.equal(clock.warningAt.toISOString(), warningDueAt(archivedAt).toISOString());
    assert.ok(clock.daysLeft > 250 && clock.daysLeft < 320, `ootamatu loendus: ${clock.daysLeft}`);
  })
);

test(
  "aktiivsel juhtumil EI OLE kella ja võõras ei saa teda küsida",
  withFeatureOn(async () => {
    const store = db({ assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }] });

    const clock = await getCaseRetentionClock({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store });
    assert.equal(clock.deletionAt, null);

    await assert.rejects(
      getCaseRetentionClock({ ownerUserId: "worker_b", caseWorkAssistId: CASE_ID, now: NOW, db: store }),
      (error) => error.status === 404
    );
  })
);

/* ── O-JTA-5 rada C ─────────────────────────────────────────────────────── */

test(
  "rada C kustutab KANDMATA mustandite sisu ja jätab juhtumi tööle",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      drafts: [
        { id: "d_draft", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null, contentPurgedAt: null },
        { id: "d_declined", caseWorkAssistId: CASE_ID, transferState: "EI_KANTA", transferredAt: null, contentPurgedAt: null },
        {
          id: "d_transferred",
          caseWorkAssistId: CASE_ID,
          transferState: "ULE_KANTUD",
          transferredAt: ago({ months: 2 }),
          contentPurgedAt: null
        }
      ],
      fields: [
        { id: "f1", draftId: "d_draft", fieldKey: "EESMARK", text: "kliendi sisu" },
        { id: "f2", draftId: "d_declined", fieldKey: "TEGEVUS", text: "kliendi sisu" },
        { id: "f3", draftId: "d_transferred", fieldKey: "EESMARK", text: "STAR-i läinud sisu" }
      ]
    });

    const result = await archiveWorkingMaterial({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      now: NOW,
      db: store
    });

    assert.equal(result.drafts, 2);
    assert.equal(result.fields, 2);

    /* ÜLEKANTUD MUSTANDIT SEE TEGU EI PUUDUTA: tema sisu on automaatse kella all
       ja tema enneaegne kustutus viiks tõendi ära enne, kui STAR-i kanne on
       kinnitatud. */
    assert.deepEqual(
      store.fields.map((row) => row.draftId),
      ["d_transferred"]
    );
    assert.equal(store.drafts.length, 3, "rada C kustutas mustandi rea");
    assert.equal(
      store.drafts.find((row) => row.id === "d_draft").contentPurgeReason,
      PURGE_REASON.WORKER_ARCHIVED_WORKING_MATERIAL
    );
    assert.equal(store.drafts.find((row) => row.id === "d_transferred").contentPurgedAt, null);
    assert.equal(store.assists[0].retentionState, "ACTIVE", "rada C arhiveeris juhtumi");
  })
);

test(
  "rada C ei tööta kirjutuskaitstud juhtumis ega tühjalt",
  withFeatureOn(async () => {
    const locked = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "READ_ONLY" }],
      drafts: [{ id: "d1", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null, contentPurgedAt: null }],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "sisu" }]
    });
    await assert.rejects(
      archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: locked }),
      (error) => error.status === 409
    );
    assert.equal(locked.fields.length, 1);

    const empty = db({ assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }] });
    await assert.rejects(
      archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: empty }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.working_material_empty"
    );

    const stranger = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      drafts: [{ id: "d1", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null, contentPurgedAt: null }],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "sisu" }]
    });
    await assert.rejects(
      archiveWorkingMaterial({ ownerUserId: "worker_b", caseWorkAssistId: CASE_ID, now: NOW, db: stranger }),
      (error) => error.status === 404
    );
    assert.equal(stranger.fields.length, 1);
  })
);

test(
  "rada C on kordumatu: teine vajutus ei leia enam midagi",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      drafts: [{ id: "d1", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null, contentPurgedAt: null }],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "sisu" }]
    });

    await archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store });
    await assert.rejects(
      archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store }),
      (error) => error.status === 409
    );
  })
);

/* ── O-JTA-6: rada C katab ka ettevalmistused ───────────────────────────── */

test(
  "O-JTA-6: rada C kustutab ka ettevalmistuse sisu, AGA jätab konteineri ja seosed",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      drafts: [
        { id: "d1", caseWorkAssistId: CASE_ID, transferState: "MUSTAND", transferredAt: null, contentPurgedAt: null }
      ],
      fields: [{ id: "f1", draftId: "d1", fieldKey: "EESMARK", text: "kliendi sisu" }],
      preps: [
        { id: "p1", caseWorkAssistId: CASE_ID, meetingAt: ago({ months: 20 }), contentPurgedAt: null },
        { id: "p2", caseWorkAssistId: CASE_ID, meetingAt: null, contentPurgedAt: null }
      ],
      prepFields: [
        { id: "pf1", meetingPrepId: "p1", fieldKey: "GOAL", text: "kaks aastat vana kliendi sisu" },
        { id: "pf2", meetingPrepId: "p2", fieldKey: "AGENDA", text: "kliendi sisu" }
      ],
      questions: [{ id: "q1", meetingPrepId: "p1", kind: "CLARIFYING_QUESTION", text: "kliendi sisu" }]
    });

    const result = await archiveWorkingMaterial({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      now: NOW,
      db: store
    });

    assert.deepEqual(result, { drafts: 1, fields: 1, preps: 2, prepFields: 2, questions: 1 });

    /* SISU KAOB. See on O-JTA-5 motiveeriv näide — kaks aastat vana
       ettevalmistus, milles on kliendi sisu ja mida keegi ei ole avanud. */
    assert.equal(store.prepFields.length, 0, "ettevalmistuse väljad jäid alles");
    assert.equal(store.questions.length, 0, "ettevalmistuse küsimused jäid alles");

    /* KONTEINER JÄÄB. Terve rea kustutamine annaks mustandiga võrreldes
       vastuolulise elutsükli ja viiks ära info, et ettevalmistus üldse toimus —
       märge, mis talle viitab, kaotaks oma seose. */
    assert.equal(store.preps.length, 2, "ettevalmistuse rida kustus koos sisuga");
    for (const prep of store.preps) {
      assert.ok(prep.contentPurgedAt, "purge'i märk puudub");
      assert.equal(prep.contentPurgeReason, PURGE_REASON.WORKER_ARCHIVED_WORKING_MATERIAL);
    }
  })
);

test(
  "O-JTA-6: ainult ettevalmistustega juhtumis tegu TÖÖTAB (ei ole enam tühi)",
  withFeatureOn(async () => {
    /* Enne O-JTA-6-t andis see juht 409 „midagi ei ole" — kuigi kliendi sisu
       oli olemas, lihtsalt vales tabelis. */
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      preps: [{ id: "p1", caseWorkAssistId: CASE_ID, contentPurgedAt: null }],
      prepFields: [{ id: "pf1", meetingPrepId: "p1", fieldKey: "GOAL", text: "kliendi sisu" }]
    });

    const result = await archiveWorkingMaterial({
      ownerUserId: OWNER,
      caseWorkAssistId: CASE_ID,
      now: NOW,
      db: store
    });
    assert.equal(result.preps, 1);
    assert.equal(result.prepFields, 1);
    assert.equal(store.prepFields.length, 0);
  })
);

test(
  "O-JTA-6: juba purge'itud ettevalmistust ei võeta teist korda ette",
  withFeatureOn(async () => {
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      preps: [{ id: "p1", caseWorkAssistId: CASE_ID, contentPurgedAt: null }],
      prepFields: [{ id: "pf1", meetingPrepId: "p1", fieldKey: "GOAL", text: "sisu" }]
    });

    await archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store });
    await assert.rejects(
      archiveWorkingMaterial({ ownerUserId: OWNER, caseWorkAssistId: CASE_ID, now: NOW, db: store }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.working_material_empty"
    );
  })
);

test(
  "O-JTA-6: automaatne säilitustöö EI PUUDUTA ettevalmistusi",
  withFeatureOn(async () => {
    /* Ettevalmistusel ei ole kella — ta ei lähe kuhugi üle. Kui taustatöö
       hakkaks teda purge'ima, tekiks vaikne kustutus täpselt sellel rajal,
       mille kogu mõte on, et inimene teeb teo. Sama reeglit jõustab `CHECK`. */
    const store = db({
      assists: [{ id: CASE_ID, ownerUserId: OWNER, retentionState: "ACTIVE" }],
      preps: [{ id: "p1", caseWorkAssistId: CASE_ID, meetingAt: ago({ months: 36 }), contentPurgedAt: null }],
      prepFields: [{ id: "pf1", meetingPrepId: "p1", fieldKey: "GOAL", text: "väga vana kliendi sisu" }]
    });

    const result = await runRetention({ now: NOW, db: store });

    assert.equal(result.draftsPurged, 0);
    assert.equal(store.prepFields.length, 1, "säilitustöö kustutas ettevalmistuse sisu");
    assert.equal(store.preps[0].contentPurgedAt, null);
  })
);
