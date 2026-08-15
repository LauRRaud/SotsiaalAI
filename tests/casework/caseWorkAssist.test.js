import test from "node:test";
import assert from "node:assert/strict";

import {
  LABEL_SOURCE,
  RETENTION_STATE,
  RETENTION_TRANSITIONS,
  caseDisplayLabel,
  createCaseWorkAssist,
  eraseCaseClientReference,
  resolveClientNames,
  updateCaseWorkAssist
} from "../../lib/casework/caseWorkAssist.js";
import { CASEWORK_FLAG_KEYS, isCaseWorkEnabled } from "../../lib/casework/flags.js";

/* Teenuskiht on värava taga (L19). Ilma selleta annaks IGA test 404 — ja see
   ongi õige käitumine, mida esimene test tõendab. */
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
 * Eelpöördumise adressaadifiltri hindaja (SOL-CW-11).
 *
 * SIIN ON PÄRISELT KOLM TINGIMUST, mitte ainult `recipientOwnerId`. Vana fake
 * ignoreeris `recalledAt`-i ja `sentAt`-i täielikult — seetõttu oleks iga
 * elutsükli-test läinud roheliseks ka siis, kui teenuskiht neid ei kontrolli.
 */
function matchesPreInquiryWhere(row, where = {}) {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.recipientOwnerId !== undefined && row.recipientOwnerId !== where.recipientOwnerId) return false;
  if (where.recalledAt === null && row.recalledAt != null) return false;
  if (Array.isArray(where.OR)) {
    const ok = where.OR.some((clause) => {
      if (clause.sentAt && "not" in clause.sentAt && clause.sentAt.not === null) return row.sentAt != null;
      if (clause.status !== undefined) return row.status === clause.status;
      return false;
    });
    if (!ok) return false;
  }
  return true;
}

/** Kiire abi pöördumise filter: seis + laua kuuluvus. */
function matchesUrgentWhere(row, where = {}, { deskMembership = true } = {}) {
  if (where.id !== undefined && row.id !== where.id) return false;
  if (where.status?.notIn && where.status.notIn.includes(row.status)) return false;
  if (where.desk && !deskMembership) return false;
  return true;
}

/**
 * Juhtumirea filter: skalaarne võrdsus. Katab nii `{id, ownerUserId}` kui
 * `{ownerUserId, clientActionId}` — viimast kasutab konfliktilahendaja.
 */
function matchesAssistWhere(row, where = {}) {
  return Object.entries(where).every(([field, value]) => row[field] === value);
}

/**
 * Unikaalsed indeksid (SOL-CW-12) — PÄRISELT, mitte kokkuleppeliselt.
 *
 * Ilma nendeta läheks iga idempotentsuse test roheliseks ka siis, kui
 * migratsiooni poleks olemas: teenuskiht PÜÜAB KINNI andmebaasi vastuse, ta ei
 * tekita seda ise. Fake, mis korduse vaikselt läbi laseks, tõendaks vastupidist.
 *
 * NULL EI PÕRKA, sama mis PostgreSQL-is: päritoluta juhtumid (rada B) ja
 * võtmeta vana klient jäävad piiranguta.
 */
const UNIQUE_INDEXES = Object.freeze([
  ["ownerUserId", "preInquiryId"],
  ["ownerUserId", "urgentRequestId"],
  ["ownerUserId", "clientActionId"]
]);

function assertUnique(rows, candidate) {
  for (const fields of UNIQUE_INDEXES) {
    if (fields.some((field) => candidate[field] === null || candidate[field] === undefined)) continue;
    if (!rows.some((row) => fields.every((field) => row[field] === candidate[field]))) continue;
    const error = new Error(`Unique constraint failed on the fields: (${fields.join(",")})`);
    error.code = "P2002";
    error.meta = { target: fields };
    throw error;
  }
}

function fakeDb({
  preInquiries = [],
  urgentRequests = [],
  users = [],
  assists = [],
  deskMembership = true,
  /** Kutsutakse ENNE iga `caseWorkAssist.create`-t — TOCTOU akna simuleerimiseks. */
  beforeCreate = null
} = {}) {
  const calls = { userFindMany: 0 };
  return {
    calls,
    created: [],
    updated: [],
    preInquiries,
    urgentRequests,
    assists,
    nextId: 1,
    /**
     * Tehing PÄRIS tagasiveeremisega — muidu ei tõendaks TOCTOU test midagi.
     *
     * Tagasiveeremine eemaldab TÄPSELT selles tehingus kirjutatud read. Varem
     * taastati hetktõmmis; see kustutaks paralleelse tehingu töö ja SOL-CW-12
     * paralleelsuse test mõõdaks fake'i artefakti, mitte koodi.
     */
    async $transaction(callback) {
      const parent = this;
      const journal = [];
      const tx = Object.create(parent);
      tx.caseWorkAssist = Object.create(parent.caseWorkAssist);
      tx.caseWorkAssist.journal = journal;
      try {
        return await callback(tx);
      } catch (error) {
        for (const row of journal) {
          const inStore = assists.indexOf(row);
          if (inStore >= 0) assists.splice(inStore, 1);
          const inCreated = parent.created.indexOf(row);
          if (inCreated >= 0) parent.created.splice(inCreated, 1);
        }
        throw error;
      }
    },
    preInquiry: {
      async findFirst({ where }) {
        return preInquiries.find((row) => matchesPreInquiryWhere(row, where)) || null;
      },
      async findUnique({ where }) {
        return preInquiries.find((row) => row.id === where.id) || null;
      }
    },
    urgentRequest: {
      async findFirst({ where }) {
        return urgentRequests.find((row) => matchesUrgentWhere(row, where, { deskMembership })) || null;
      },
      async findUnique({ where }) {
        return urgentRequests.find((row) => row.id === where.id) || null;
      }
    },
    beforeCreate,
    user: {
      async findMany({ where }) {
        calls.userFindMany += 1;
        return users.filter((row) => where.id.in.includes(row.id));
      }
    },
    caseWorkAssist: {
      async create({ data }) {
        /* TOCTOU aken: siin jõuab saatja pöördumise tagasi võtta VÕI teine
           päring sama võtmega ette. */
        if (this.parent.beforeCreate) await this.parent.beforeCreate(this.parent);
        const row = {
          id: `case_${this.parent.nextId}`,
          retentionState: "ACTIVE",
          clientErasedAt: null,
          preInquiryId: null,
          urgentRequestId: null,
          clientActionId: null,
          ...data
        };
        /* Indeks kontrollib SIIN, INSERT'i hetkel — täpselt nagu Postgres. */
        assertUnique(assists, row);
        this.parent.nextId += 1;
        assists.push(row);
        this.parent.created.push(row);
        this.journal?.push(row);
        return row;
      },
      async findFirst({ where }) {
        return assists.find((row) => matchesAssistWhere(row, where)) || null;
      },
      async findUnique({ where }) {
        return assists.find((row) => row.id === where.id) || null;
      },
      async updateMany({ where, data }) {
        const matching = assists.filter((row) => matchesAssistWhere(row, where));
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      }
    },
    caseWorkClientErasureAudit: {
      async create({ data }) {
        return data;
      }
    }
  };
}

function db(options) {
  const instance = fakeDb(options);
  instance.caseWorkAssist.parent = instance;
  return instance;
}

/** Kehtivalt saadetud eelpöördumine — vaikeseis, millest juhtumi TOHIB luua. */
function sentPreInquiry(overrides = {}) {
  return {
    id: "p1",
    recipientOwnerId: "w1",
    authorId: "u1",
    status: "SENT",
    sentAt: new Date("2026-08-01T10:00:00.000Z"),
    recalledAt: null,
    ...overrides
  };
}

/* ── Kuvanimi (L10) ──────────────────────────────────────────────────────── */

test("kustutatud kliendiviide võidab KÕIK, ka lahendatud kliendinime", () => {
  const label = caseDisplayLabel(
    { clientErasedAt: new Date(), clientUserId: "u1", clientDisplayName: "Ema", clientExternalRef: "REF" },
    "Mari Tamm"
  );
  assert.equal(label.source, LABEL_SOURCE.ERASED);
  assert.equal(label.text, null);
  assert.equal(label.labelKey, "casework.label.erased_client");
});

test("rada A juhtum kuvab lahendatud nime, MITTE nimetut", () => {
  const label = caseDisplayLabel({ clientUserId: "u1", clientDisplayName: null, clientExternalRef: null }, "Mari Tamm");
  assert.equal(label.source, LABEL_SOURCE.CLIENT_ACCOUNT);
  assert.equal(label.text, "Mari Tamm");
});

test("rada A ilma lahendatud nimeta annab nimetu juhtumi, mitte vana nime", () => {
  const label = caseDisplayLabel({ clientUserId: "u1", clientDisplayName: null, clientExternalRef: null }, null);
  assert.equal(label.source, LABEL_SOURCE.UNTITLED);
  assert.equal(label.labelKey, "casework.label.untitled");
});

test("rada B: kuvanimi enne välisviidet, välisviide enne nimetut", () => {
  assert.equal(caseDisplayLabel({ clientDisplayName: "perearst R", clientExternalRef: "REF" }).source, LABEL_SOURCE.DISPLAY_NAME);
  assert.equal(caseDisplayLabel({ clientExternalRef: "REF" }).source, LABEL_SOURCE.EXTERNAL_REF);
  assert.equal(caseDisplayLabel({}).source, LABEL_SOURCE.UNTITLED);
});

test("nimede lahendus käib HULGI ja kustutatud viitega ridu ei küsita", async () => {
  const database = db({ users: [{ id: "u1", profile: { firstName: "Mari", lastName: "Tamm" } }] });
  const names = await resolveClientNames(
    [
      { clientUserId: "u1", clientErasedAt: null },
      { clientUserId: "u1", clientErasedAt: null },
      { clientUserId: "u2", clientErasedAt: new Date() }
    ],
    { db: database }
  );
  assert.equal(database.calls.userFindMany, 1, "N rida ei tohi teha N päringut");
  assert.equal(names.get("u1"), "Mari Tamm");
  assert.equal(names.has("u2"), false, "kustutatud viite nime ei küsita");
});

test("kliendiviite kustutus ei avalda ega muuda võõra omaniku juhtumit", async () => {
  const victimCase = {
    id: "victim-case",
    ownerUserId: "victim-worker",
    clientUserId: "client-1",
    clientDisplayName: "Klient",
    clientExternalRef: "REF-1",
    clientErasedAt: null
  };
  const database = db({ assists: [victimCase] });

  await assert.rejects(
    () =>
      eraseCaseClientReference({
        ownerUserId: "attacker-worker",
        caseWorkAssistId: victimCase.id,
        actorUserId: "attacker-worker",
        reason: "worker_request",
        db: database
      }),
    (error) => error?.status === 404
  );
  assert.equal(victimCase.clientUserId, "client-1");
  assert.equal(victimCase.clientErasedAt, null);
});

/* ── Retention (L14) ─────────────────────────────────────────────────────── */

test("retention on ühesuunaline ja ARCHIVED on lõppseis", () => {
  assert.deepEqual(RETENTION_TRANSITIONS[RETENTION_STATE.ACTIVE], [RETENTION_STATE.READ_ONLY]);
  assert.deepEqual(RETENTION_TRANSITIONS[RETENTION_STATE.READ_ONLY], [RETENTION_STATE.ARCHIVED]);
  assert.deepEqual(RETENTION_TRANSITIONS[RETENTION_STATE.ARCHIVED], []);
  for (const from of Object.keys(RETENTION_TRANSITIONS)) {
    assert.equal(RETENTION_TRANSITIONS[from].includes(RETENTION_STATE.ACTIVE), false, `${from} → ACTIVE on keelatud`);
  }
});

/* ── Aktiveerimisvärav (L19) ─────────────────────────────────────────────── */

test("värav on vaikimisi VÄLJAS ja väljas väravaga käitub funktsioon nagu olematu", async () => {
  assert.equal(isCaseWorkEnabled({}), false);
  assert.equal(isCaseWorkEnabled({ CASEWORK_V1_ENABLED: "1" }), true);

  const previous = process.env[CASEWORK_FLAG_KEYS.ENABLED];
  delete process.env[CASEWORK_FLAG_KEYS.ENABLED];
  try {
    await assert.rejects(() => createCaseWorkAssist({ ownerUserId: "w1", db: db() }), (error) => {
      /* 404, MITTE 403: väljas värav tähendab „ei ole olemas", ja 403 kinnitaks
         funktsiooni olemasolu. */
      assert.equal(error.status, 404);
      return true;
    });
  } finally {
    if (previous !== undefined) process.env[CASEWORK_FLAG_KEYS.ENABLED] = previous;
  }
});

/* ── Kliendi kaks rada (L11) ─────────────────────────────────────────────── */

test(
  "klient: rada A ja rada B korraga on keelatud",
  withFeatureOn(async () => {
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", clientUserId: "u1", clientDisplayName: "Ema", db: db() }),
      (error) => error.status === 400 && error.messageKey === "casework.errors.client_track_conflict"
    );
  })
);

test(
  "klient: rada B kuvanimi ja välisviide koos on lubatud",
  withFeatureOn(async () => {
    const row = await createCaseWorkAssist({
      ownerUserId: "w1",
      clientDisplayName: "perearst R",
      clientExternalRef: "REF-1",
      db: db()
    });
    assert.equal(row.clientDisplayName, "perearst R");
    assert.equal(row.clientExternalRef, "REF-1");
  })
);

/* ── Päritolu (L12) ──────────────────────────────────────────────────────── */

test(
  "päritolu: mõlemat korraga ei saa määrata",
  withFeatureOn(async () => {
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", urgentRequestId: "r1", db: db() }),
      (error) => error.messageKey === "casework.errors.origin_conflict"
    );
  })
);

test(
  "päritolu peab olema omaniku NÄHTAVAS skoobis — võõras annab 404",
  withFeatureOn(async () => {
    const database = db({ preInquiries: [{ id: "p1", recipientOwnerId: "keegi-teine", authorId: "u1" }] });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", db: database }),
      (error) => error.status === 404
    );
  })
);

/* ── SOL-CW-11: päritolu elutsükkel ──────────────────────────────────────── */

test(
  "SOL-CW-11: saatmata (DRAFT) eelpöördumisest ei saa juhtumit luua",
  withFeatureOn(async () => {
    /* Fake-DB kontroll auditis lõi juhtumi eelpöördumisest, mille seis oli
       `DRAFT` ja `recalledAt` määratud. Mustandit ei ole töötajale antud. */
    const database = db({
      preInquiries: [sentPreInquiry({ status: "DRAFT", sentAt: null })]
    });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", db: database }),
      (error) => error.status === 404 && error.messageKey === "casework.errors.origin_not_found"
    );
    assert.equal(database.created.length, 0);
  })
);

test(
  "SOL-CW-11: tagasivõetud eelpöördumisest ei saa juhtumit luua",
  withFeatureOn(async () => {
    const database = db({
      preInquiries: [sentPreInquiry({ recalledAt: new Date("2026-08-02T09:00:00.000Z") })]
    });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", db: database }),
      (error) => error.status === 404
    );
    assert.equal(database.created.length, 0);
  })
);

test(
  "SOL-CW-11: saadetud eelpöördumine töötab kõigis hilisemates seisudes",
  withFeatureOn(async () => {
    /* `DOWNLOADED` ja `ARCHIVED` on SAADETUD pöördumise hilisemad seisud —
       nende keelamine tähendaks, et töötaja ei saa juhtumit teha tööst, mille
       ta juba vastu võttis. */
    for (const status of ["SENT", "READY", "DOWNLOADED", "ARCHIVED"]) {
      const database = db({ preInquiries: [sentPreInquiry({ status })] });
      const row = await createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", db: database });
      assert.equal(row.preInquiryId, "p1", `${status}: juhtum jäi loomata`);
    }
  })
);

test(
  "SOL-CW-11: tagasivõetud kiire abi pöördumisest ei saa juhtumit luua, RESOLVED ja EXPIRED saab",
  withFeatureOn(async () => {
    const recalled = db({ urgentRequests: [{ id: "r1", authorId: "u1", status: "RECALLED" }] });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", urgentRequestId: "r1", db: recalled }),
      (error) => error.status === 404
    );
    assert.equal(recalled.created.length, 0);

    /* TEADLIK OTSUS: laud näeb neid endiselt oma järjekorras, seega juhtumi
       loomise keeld tekitaks kaks eri tõde. */
    for (const status of ["SENT", "READ", "TAKEN", "DECLINED", "RESOLVED", "EXPIRED"]) {
      const database = db({ urgentRequests: [{ id: "r1", authorId: "u1", status }] });
      const row = await createCaseWorkAssist({ ownerUserId: "w1", urgentRequestId: "r1", db: database });
      assert.equal(row.urgentRequestId, "r1", `${status}: juhtum jäi loomata`);
    }
  })
);

test(
  "SOL-CW-11: võõra laua kiire abi pöördumine annab 404",
  withFeatureOn(async () => {
    const database = db({
      urgentRequests: [{ id: "r1", authorId: "u1", status: "SENT" }],
      deskMembership: false
    });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", urgentRequestId: "r1", db: database }),
      (error) => error.status === 404
    );
  })
);

test(
  "SOL-CW-11: kontrolli ja loomise VAHEL toimunud tagasivõtt veeretab juhtumi tagasi",
  withFeatureOn(async () => {
    /* TOCTOU. Enne parandust olid kontroll ja loomine eraldi päringud: juhtum
       sündis sisust, mille saatja oli vahepeal tagasi võtnud, ja API vastas
       eduga. */
    const database = db({
      preInquiries: [sentPreInquiry()],
      beforeCreate: (store) => {
        store.preInquiries[0].recalledAt = new Date("2026-08-02T09:00:00.000Z");
      }
    });

    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", db: database }),
      (error) => error.status === 404
    );
    assert.equal(database.assists.length, 0, "juhtum jäi alles, kuigi päritolu võeti tagasi");
    assert.equal(database.created.length, 0);
  })
);

test(
  "SOL-CW-11: päritoluta juhtum ei tee järelkontrolli ega kuku selle taha",
  withFeatureOn(async () => {
    /* Rada B (ilma päritoluta) peab jääma tööle täpselt nagu enne. */
    const database = db({});
    const row = await createCaseWorkAssist({ ownerUserId: "w1", clientDisplayName: "naaber", db: database });
    assert.equal(row.preInquiryId, null);
    assert.equal(row.urgentRequestId, null);
    assert.equal(row.clientDisplayName, "naaber");
    assert.equal(database.created.length, 1);
  })
);

/* ── SOL-CW-12: idempotentsus ja üks juhtum lähteobjekti kohta ───────────── */

const KEY_A = "11111111-1111-4111-8111-111111111111";
const KEY_B = "22222222-2222-4222-8222-222222222222";

test(
  "SOL-CW-12: sama võti ja sama sisu annavad SAMA juhtumi, mitte teist",
  withFeatureOn(async () => {
    /* Topeltklõps ja võrgu korduskatse. Enne parandust tegi teine kutse
       tingimusteta uue rea ja töö jagunes kahe tõe vahel ilma ühegi veata. */
    const database = db({});
    const payload = { ownerUserId: "w1", clientDisplayName: "naaber", clientActionId: KEY_A, db: database };

    const first = await createCaseWorkAssist(payload);
    /* SUURTÄHTEDEGA sama võti on SAMA võti — normaliseerimata jääks korduskaitse
       kliendi kirjapildi hooleks. */
    const retry = await createCaseWorkAssist({ ...payload, clientActionId: KEY_A.toUpperCase() });

    assert.equal(retry.id, first.id, "korduskatse tegi teise juhtumi");
    assert.equal(database.assists.length, 1);
    assert.equal(database.created.length, 1, "teine rida kirjutati andmebaasi");
  })
);

test(
  "SOL-CW-12: sama võti ERI sisuga on 409, mitte vaikne teine juhtum",
  withFeatureOn(async () => {
    /* Sama reegel mis kopeerimisauditil (SOL-CW-06): vana võti uue sisu all on
       uus tegu ja seda ei tohi esimeseks juhtumiks tõlkida. */
    const database = db({});
    const first = await createCaseWorkAssist({
      ownerUserId: "w1",
      clientDisplayName: "naaber",
      clientActionId: KEY_A,
      db: database
    });

    await assert.rejects(
      () =>
        createCaseWorkAssist({
          ownerUserId: "w1",
          clientDisplayName: "hoopis teine inimene",
          clientActionId: KEY_A,
          db: database
        }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.create_action_key_conflict"
    );

    assert.equal(database.assists.length, 1);
    assert.equal(database.assists[0].clientDisplayName, "naaber", "esimese juhtumi sisu muutus");
    assert.equal(first.clientDisplayName, "naaber");
  })
);

test(
  "SOL-CW-12: kaks PARALLEELSET päringut sama võtmega jätavad ühe juhtumi",
  withFeatureOn(async () => {
    /* Barjäär hoiab MÕLEMAD kutsed kinni kuni hetkeni, mil mõlemad on kõik
       eelkontrollid läbinud. Just seda olukorda eelkontroll ei püüa — jõustaja
       peab olema indeks. */
    let release;
    const bothArrived = new Promise((resolve) => {
      release = resolve;
    });
    let arrived = 0;
    const database = db({
      beforeCreate: async () => {
        arrived += 1;
        if (arrived === 2) release();
        await bothArrived;
      }
    });

    const call = () =>
      createCaseWorkAssist({ ownerUserId: "w1", clientDisplayName: "naaber", clientActionId: KEY_A, db: database });
    const [left, right] = await Promise.all([call(), call()]);

    assert.equal(arrived, 2, "teine päring ei jõudnudki kirjutuseni");
    assert.equal(left.id, right.id, "kaks paralleelset päringut andsid kaks eri juhtumit");
    assert.equal(database.assists.length, 1);
  })
);

test(
  "SOL-CW-12: samast lähteobjektist teine juhtum annab 409, mitte teise juhtumi",
  withFeatureOn(async () => {
    /* Omaniku otsus 09.08.2026: üks juhtum lähteobjekti kohta. Teine katse on
       TEADLIK tegu (uus võti) ja peab olema nähtav, mitte vaikselt esimeseks
       juhtumiks tõlgitud. */
    const database = db({ preInquiries: [sentPreInquiry()] });
    await createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", clientActionId: KEY_A, db: database });

    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", clientActionId: KEY_B, db: database }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.origin_already_has_case"
    );

    assert.equal(database.assists.length, 1);
  })
);

test(
  "SOL-CW-12: piirang on OMANIKUPÕHINE — kaks töötajat sama pöördumisest",
  withFeatureOn(async () => {
    /* Sama laua kaks töötajat teevad oma juhtumi. Piirang on
       `(ownerUserId, lähteobjekt)`, mitte lähteobjekt üksi — vastasel juhul
       lukustaks esimene töötaja pöördumise kõigi teiste eest. */
    const database = db({ urgentRequests: [{ id: "r1", status: "SENT", authorId: "u1" }] });

    const mine = await createCaseWorkAssist({ ownerUserId: "w1", urgentRequestId: "r1", db: database });
    const theirs = await createCaseWorkAssist({ ownerUserId: "w2", urgentRequestId: "r1", db: database });

    assert.notEqual(mine.id, theirs.id);
    assert.equal(database.assists.length, 2);
  })
);

test(
  "SOL-CW-12: NULL ei põrka — päritoluta ja võtmeta juhtumeid võib olla mitu",
  withFeatureOn(async () => {
    /* Rada B ja vana klient, kes võtit ei saada. PostgreSQL loeb NULL-id
       eristuvaks; kui fake seda ei teeks, keelaks piirang tavalise töö ära. */
    const database = db({});
    const first = await createCaseWorkAssist({ ownerUserId: "w1", clientDisplayName: "naaber", db: database });
    const second = await createCaseWorkAssist({ ownerUserId: "w1", clientDisplayName: "perearst", db: database });

    assert.notEqual(first.id, second.id);
    assert.equal(database.assists.length, 2);
  })
);

test(
  "SOL-CW-12: vigase kujuga loomistunnus on 400, mitte 500",
  withFeatureOn(async () => {
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", clientActionId: "mitte-uuid", db: db() }),
      (error) => error.status === 400 && error.messageKey === "casework.errors.create_action_key_invalid"
    );
  })
);

test(
  "PÄRITOLU EI KEELA rada B — lähedase esitatud pöördumine",
  withFeatureOn(async () => {
    const database = db({ preInquiries: [sentPreInquiry({ authorId: "naaber" })] });
    const row = await createCaseWorkAssist({
      ownerUserId: "w1",
      preInquiryId: "p1",
      clientDisplayName: "tütar",
      db: database
    });
    assert.equal(row.preInquiryId, "p1");
    assert.equal(row.clientDisplayName, "tütar");
  })
);

test(
  "rada A tohib olla AINULT päritoluobjekti autor",
  withFeatureOn(async () => {
    const database = db({ preInquiries: [sentPreInquiry({ authorId: "u1" })] });
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", clientUserId: "voeras", db: database }),
      (error) => error.messageKey === "casework.errors.client_account_not_origin_author"
    );
    const row = await createCaseWorkAssist({ ownerUserId: "w1", preInquiryId: "p1", clientUserId: "u1", db: database });
    assert.equal(row.clientUserId, "u1");
  })
);

test(
  "päritolu on muutumatu — update keeldub",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "ACTIVE" }] });
    await assert.rejects(
      () => updateCaseWorkAssist({ ownerUserId: "w1", id: "case_1", patch: { preInquiryId: "p2" }, db: database }),
      (error) => error.messageKey === "casework.errors.origin_immutable"
    );
  })
);

/* ── STAR-i viide (L6) ───────────────────────────────────────────────────── */

test(
  "STAR: mõlemad või kumbki, ja ainult STAR2",
  withFeatureOn(async () => {
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", externalSystem: "STAR2", db: db() }),
      (error) => error.messageKey === "casework.errors.external_reference_incomplete"
    );
    await assert.rejects(
      () => createCaseWorkAssist({ ownerUserId: "w1", externalReference: "X-1", db: db() }),
      (error) => error.messageKey === "casework.errors.external_reference_incomplete"
    );
    await assert.rejects(
      () =>
        createCaseWorkAssist({ ownerUserId: "w1", externalSystem: "STAR3", externalReference: "X-1", db: db() }),
      (error) => error.messageKey === "casework.errors.external_system_unsupported"
    );
    const row = await createCaseWorkAssist({
      ownerUserId: "w1",
      externalSystem: "STAR2",
      externalReference: "X-1",
      db: db()
    });
    assert.equal(row.externalSystem, "STAR2");
  })
);

/* ── Kirjutuskeeld (L14) ─────────────────────────────────────────────────── */

test(
  "READ_ONLY juhtumit ei muudeta — tingimuslik update annab 409",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "w1", retentionState: "READ_ONLY" }] });
    await assert.rejects(
      () => updateCaseWorkAssist({ ownerUserId: "w1", id: "case_1", patch: { nextContactAt: null }, db: database }),
      (error) => error.status === 409 && error.messageKey === "casework.errors.not_active"
    );
  })
);

test(
  "võõras juhtum annab 404, mitte 403",
  withFeatureOn(async () => {
    const database = db({ assists: [{ id: "case_1", ownerUserId: "keegi-teine", retentionState: "ACTIVE" }] });
    await assert.rejects(
      () => updateCaseWorkAssist({ ownerUserId: "w1", id: "case_1", patch: { nextContactAt: null }, db: database }),
      (error) => error.status === 404
    );
  })
);
