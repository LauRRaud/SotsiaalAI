import test from "node:test";
import assert from "node:assert/strict";

import {
  LABEL_SOURCE,
  RETENTION_STATE,
  RETENTION_TRANSITIONS,
  caseDisplayLabel,
  createCaseWorkAssist,
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

function fakeDb({ preInquiries = [], urgentRequests = [], users = [], assists = [] } = {}) {
  const calls = { userFindMany: 0 };
  return {
    calls,
    created: [],
    updated: [],
    preInquiry: {
      async findFirst({ where }) {
        return (
          preInquiries.find(
            (row) => row.id === where.id && (!where.recipientOwnerId || row.recipientOwnerId === where.recipientOwnerId)
          ) || null
        );
      },
      async findUnique({ where }) {
        return preInquiries.find((row) => row.id === where.id) || null;
      }
    },
    urgentRequest: {
      async findFirst({ where }) {
        return urgentRequests.find((row) => row.id === where.id) || null;
      },
      async findUnique({ where }) {
        return urgentRequests.find((row) => row.id === where.id) || null;
      }
    },
    user: {
      async findMany({ where }) {
        calls.userFindMany += 1;
        return users.filter((row) => where.id.in.includes(row.id));
      }
    },
    caseWorkAssist: {
      async create({ data }) {
        const row = { id: `case_${assists.length + 1}`, retentionState: "ACTIVE", clientErasedAt: null, ...data };
        assists.push(row);
        this.parent.created.push(row);
        return row;
      },
      async findFirst({ where }) {
        return (
          assists.find((row) => row.id === where.id && (!where.ownerUserId || row.ownerUserId === where.ownerUserId)) ||
          null
        );
      },
      async findUnique({ where }) {
        return assists.find((row) => row.id === where.id) || null;
      },
      async updateMany({ where, data }) {
        const matching = assists.filter(
          (row) =>
            row.id === where.id &&
            (!where.ownerUserId || row.ownerUserId === where.ownerUserId) &&
            (!where.retentionState || row.retentionState === where.retentionState)
        );
        for (const row of matching) Object.assign(row, data);
        return { count: matching.length };
      }
    }
  };
}

function db(options) {
  const instance = fakeDb(options);
  instance.caseWorkAssist.parent = instance;
  return instance;
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

test(
  "PÄRITOLU EI KEELA rada B — lähedase esitatud pöördumine",
  withFeatureOn(async () => {
    const database = db({ preInquiries: [{ id: "p1", recipientOwnerId: "w1", authorId: "naaber" }] });
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
    const database = db({ preInquiries: [{ id: "p1", recipientOwnerId: "w1", authorId: "u1" }] });
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
