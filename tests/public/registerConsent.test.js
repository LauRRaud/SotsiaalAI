import test from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../app/api/register/route.js";
import { REGISTRATION_OPEN } from "../../lib/publicRegistration.js";
import {
  buildRegistrationAcceptanceRows,
  GENERAL_ACCEPTANCE_TYPE,
  GUIDE_ACCEPTANCE_TYPE,
  GUIDE_DOCUMENT_KEY,
  PRIVACY_DOCUMENT_KEY,
  PRIVACY_VERSION,
  REGISTER_ACCEPTANCE_SOURCE,
  TERMS_DOCUMENT_KEY,
  TERMS_VERSION
} from "../../lib/legalDocuments.js";

function makeRequest(body, { ua = "test-agent", ip = "203.0.113.7" } = {}) {
  return {
    async json() {
      return body;
    },
    headers: {
      get(name) {
        const key = String(name || "").toLowerCase();
        if (key === "user-agent") return ua;
        if (key === "x-forwarded-for") return ip;
        return "";
      }
    },
    cookies: { get: () => undefined }
  };
}

function makeDb({ failCreateMany = false } = {}) {
  const calls = {
    txRuns: 0,
    userCreates: [],
    acceptanceCreateManyInTx: [],
    frameworkCreates: [],
    verificationTokens: [],
    outsideTxWrites: 0
  };
  let inTx = false;

  const db = {
    async $transaction(fn) {
      calls.txRuns += 1;
      inTx = true;
      try {
        const tx = {
          user: {
            async create(args) {
              calls.userCreates.push(args);
              return { id: "user-test-1", email: args.data.email };
            }
          },
          frameworkAcceptance: {
            async createMany(args) {
              if (!inTx) calls.outsideTxWrites += 1;
              if (failCreateMany) {
                throw new Error("acceptance write failed");
              }
              calls.acceptanceCreateManyInTx.push(args);
              return { count: args.data.length };
            },
            async create(args) {
              calls.frameworkCreates.push(args);
              return { id: "fw-1", ...args.data };
            }
          }
        };
        return await fn(tx);
      } finally {
        inTx = false;
      }
    },
    verificationToken: {
      async create(args) {
        calls.verificationTokens.push(args);
        return args;
      },
      async deleteMany() {
        return { count: 0 };
      }
    },
    user: {
      async update() {
        return {};
      }
    }
  };

  return { db, calls };
}

const VALID_BODY = {
  email: "uus.kasutaja@example.test",
  pin: "123456",
  role: "client",
  termsPrivacyAck: true,
  guideAck: true,
  locale: "et"
};

test("launch-lukk: suletud registreerimine tagastab ka käsitsi POST-ile 403 ega kirjuta midagi", async () => {
  assert.equal(REGISTRATION_OPEN, false, "avalik seis on SULETUD alates 27.07.2026 (omaniku otsus, maksetest tehtud); avamisel uuenda ka seda ootust");
  const { db, calls } = makeDb();
  const res = await POST(makeRequest(VALID_BODY), { db, registrationOpen: false });
  assert.equal(res.status, 403);
  const payload = await res.json();
  assert.equal(payload.code, "REGISTER_DISABLED");
  assert.equal(calls.txRuns, 0);
  assert.equal(calls.userCreates.length, 0);
});

test("avatud rada: puuduv terms/privacy nõustumine → 400 ilma kasutaja ega tõendita", async () => {
  const { db, calls } = makeDb();
  const res = await POST(
    makeRequest({ ...VALID_BODY, termsPrivacyAck: false, agree: false }),
    { db, registrationOpen: true }
  );
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.code, "AGREEMENT_REQUIRED");
  assert.equal(calls.txRuns, 0, "transaktsioonini ei tohi jõuda");
  assert.equal(calls.userCreates.length, 0);
  assert.equal(calls.acceptanceCreateManyInTx.length, 0);
});

test("avatud rada: kasutaja ja tõendikirjed luuakse SAMAS transaktsioonis", async () => {
  const { db, calls } = makeDb();
  const res = await POST(makeRequest(VALID_BODY), { db, registrationOpen: true });
  assert.equal(res.status, 201);
  assert.equal(calls.txRuns, 1);
  assert.equal(calls.userCreates.length, 1);
  assert.equal(calls.acceptanceCreateManyInTx.length, 1, "tõendikirjed peavad minema tx sees");
  assert.equal(calls.outsideTxWrites, 0);

  const rows = calls.acceptanceCreateManyInTx[0].data;
  const keys = rows.map((row) => row.frameworkKey).sort();
  assert.deepEqual(keys, [PRIVACY_DOCUMENT_KEY, TERMS_DOCUMENT_KEY, GUIDE_DOCUMENT_KEY].sort());
  for (const row of rows) {
    assert.equal(row.userId, "user-test-1");
    assert.equal(row.acceptanceSource, REGISTER_ACCEPTANCE_SOURCE);
    assert.equal(row.locale, "et");
    assert.equal(row.userAgent, "test-agent");
    assert.ok(row.frameworkVersion, "iga tõendikirje kannab versiooni");
    assert.ok(row.acceptedAt instanceof Date);
  }
});

test("avatud rada: tõendikirje ebaõnnestumine kukutab kogu registreerimise (aatomsus)", async () => {
  const { db, calls } = makeDb({ failCreateMany: true });
  const res = await POST(makeRequest(VALID_BODY), { db, registrationOpen: true });
  assert.equal(res.status, 500);
  assert.equal(calls.txRuns, 1);
  assert.equal(
    calls.verificationTokens.length,
    0,
    "e-posti kinnitusvoog ei tohi käivituda, kui transaktsioon kukkus"
  );
});

test("avatud rada: professionaalne roll ORG_IDENTIFIABLE ilma raamistiku kinnituseta → 400 serveris", async () => {
  const { db, calls } = makeDb();
  const res = await POST(
    makeRequest({
      ...VALID_BODY,
      role: "specialist",
      workerUse: "ORG_IDENTIFIABLE",
      frameworkAck: false
    }),
    { db, registrationOpen: true }
  );
  assert.equal(res.status, 400);
  const payload = await res.json();
  assert.equal(payload.code, "FRAMEWORK_ACK_REQUIRED");
  assert.equal(calls.txRuns, 0);
});

test("buildRegistrationAcceptanceRows: terms+privacy alati, juhend ainult kinnitusel", () => {
  const base = {
    userId: "u1",
    role: "CLIENT",
    locale: "ru",
    ipAddress: "198.51.100.4",
    userAgent: "ua"
  };

  const withoutGuide = buildRegistrationAcceptanceRows({ ...base, guideAck: false });
  assert.equal(withoutGuide.length, 2);
  assert.deepEqual(
    withoutGuide.map((row) => row.frameworkKey).sort(),
    [PRIVACY_DOCUMENT_KEY, TERMS_DOCUMENT_KEY].sort()
  );

  const withGuide = buildRegistrationAcceptanceRows({ ...base, guideAck: true });
  assert.equal(withGuide.length, 3);
  const guideRow = withGuide.find((row) => row.frameworkKey === GUIDE_DOCUMENT_KEY);
  assert.equal(guideRow.acceptanceType, GUIDE_ACCEPTANCE_TYPE);

  const termsRow = withGuide.find((row) => row.frameworkKey === TERMS_DOCUMENT_KEY);
  assert.equal(termsRow.frameworkVersion, TERMS_VERSION);
  assert.equal(termsRow.acceptanceType, GENERAL_ACCEPTANCE_TYPE);
  const privacyRow = withGuide.find((row) => row.frameworkKey === PRIVACY_DOCUMENT_KEY);
  assert.equal(privacyRow.frameworkVersion, PRIVACY_VERSION);

  assert.throws(() => buildRegistrationAcceptanceRows({ role: "CLIENT" }));
  assert.throws(() => buildRegistrationAcceptanceRows({ userId: "u1" }));
});
