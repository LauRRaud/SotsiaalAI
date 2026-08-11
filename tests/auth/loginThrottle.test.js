import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  LOGIN_THROTTLE_LOCK_NAMESPACE,
  PIN_THROTTLE_EMAIL_SCOPE,
  clearLoginThrottle,
  consumeLoginThrottle,
  pruneExpiredLoginThrottles,
  throttleSubjectForEmail
} from "../../lib/auth/loginThrottle.js";
import { DECOY_PIN_HASH, authenticatePinAttempt } from "../../lib/auth/pinLoginAttempt.js";
import { getTrustedRequestIp } from "../../lib/request-ip.js";

const NOW = new Date("2026-08-11T12:00:00.000Z");
const now = () => NOW;

/**
 * Fake, mis modelleerib nõuandeluku MÕJU: lukustamata režiimis loevad paralleelsed kutsed
 * sama seisu. Ilma selle režiimita oleks „limiit peab paralleelselt paika" roheline fake'i
 * vastu, kus paralleelsust pole — sama õppetund mis SOL-AUTH-02-l.
 */
function makeDb({ serialize = true } = {}) {
  const rows = new Map();
  const calls = { locks: [], reads: 0, writes: 0 };
  let chain = Promise.resolve();

  const client = {
    calls,
    rows,
    async $transaction(fn) {
      const run = () =>
        fn({
          async $executeRaw(strings, ...values) {
            calls.locks.push({ sql: strings.join("?"), values });
            return 1;
          },
          authThrottleCounter: {
            async findUnique({ where }) {
              calls.reads += 1;
              const { scope, subject } = where.scope_subject;
              const row = rows.get(`${scope}:${subject}`);
              return row ? { ...row } : null;
            },
            async upsert({ where, create, update }) {
              calls.writes += 1;
              const { scope, subject } = where.scope_subject;
              const key = `${scope}:${subject}`;
              const next = rows.has(key) ? { ...rows.get(key), ...update } : { scope, subject, ...create };
              rows.set(key, next);
              return { ...next };
            }
          }
        });

      if (!serialize) return run();
      const result = chain.then(run, run);
      chain = result.catch(() => {});
      return result;
    },
    authThrottleCounter: {
      async deleteMany({ where }) {
        let count = 0;
        for (const [key, row] of [...rows]) {
          const scopeMatch = !where.scope || row.scope === where.scope;
          const subjectMatch = !where.subject || row.subject === where.subject;
          const expired = where.windowEndsAt ? row.windowEndsAt < where.windowEndsAt.lt : true;
          if (scopeMatch && subjectMatch && expired) {
            rows.delete(key);
            count += 1;
          }
        }
        return { count };
      }
    },
    user: {
      async findUnique() {
        return null;
      }
    }
  };

  return client;
}

const consume = (db, subject, limit = 3, overrides = {}) =>
  consumeLoginThrottle({
    db,
    scope: PIN_THROTTLE_EMAIL_SCOPE,
    subject,
    limit,
    windowMs: 15 * 60 * 1000,
    lockMs: 15 * 60 * 1000,
    now,
    ...overrides
  });

// === SOL-AUTH-09: loendur ====================================================

test("loenduri lukk on kasutajapõhine nõuandelukk ja ta võetakse ENNE lugemist", async () => {
  const db = makeDb();
  await consume(db, "subject-1");

  assert.equal(db.calls.locks.length, 1);
  assert.match(db.calls.locks[0].sql, /pg_advisory_xact_lock/u);
  assert.equal(db.calls.locks[0].values[0], LOGIN_THROTTLE_LOCK_NAMESPACE);
  assert.equal(db.calls.locks[0].values[1], `${PIN_THROTTLE_EMAIL_SCOPE}:subject-1`);
});

test("limiit lukustab ja lukk annab ausa retryAfter'i", async () => {
  const db = makeDb();
  const results = [];
  for (let index = 0; index < 5; index += 1) results.push(await consume(db, "subject-1"));

  assert.deepEqual(
    results.map((row) => row.allowed),
    [true, true, true, false, false]
  );
  assert.equal(results[3].reason, "locked");
  assert.equal(results[3].retryAfterSec, 15 * 60);
});

test("negatiivkontroll: ilma serialiseerimiseta ületavad paralleelsed katsed limiidi", async () => {
  const locked = makeDb({ serialize: true });
  const unlocked = makeDb({ serialize: false });

  const lockedAllowed = (await Promise.all(Array.from({ length: 6 }, () => consume(locked, "s"))))
    .filter((row) => row.allowed).length;
  const unlockedAllowed = (await Promise.all(Array.from({ length: 6 }, () => consume(unlocked, "s"))))
    .filter((row) => row.allowed).length;

  assert.equal(lockedAllowed, 3);
  assert.equal(unlockedAllowed, 6, "lukustamata fake peab limiidist üle laskma — muidu ei mõõda ülemine test midagi");
});

test("aegunud lukk avab uue akna ja õnnestumine vabastab loenduri", async () => {
  const db = makeDb();
  for (let index = 0; index < 4; index += 1) await consume(db, "subject-1");
  assert.equal((await consume(db, "subject-1")).allowed, false);

  const later = new Date(NOW.getTime() + 16 * 60 * 1000);
  const afterLock = await consume(db, "subject-1", 3, { now: () => later });
  assert.equal(afterLock.allowed, true, "lukk ei tohi jääda igaveseks");

  await clearLoginThrottle({ db, scope: PIN_THROTTLE_EMAIL_SCOPE, subject: "subject-1" });
  assert.equal(db.rows.size, 0);
});

test("subjekt on e-posti räsi, mitte e-post — ja ta normaliseerub", () => {
  const subject = throttleSubjectForEmail("  Keegi@Näide.EE ");
  assert.match(subject, /^[0-9a-f]{64}$/u);
  assert.equal(subject, throttleSubjectForEmail("keegi@näide.ee"));
  assert.ok(!subject.includes("näide"));
});

test("aegunud loendurid on koristatavad, lukus olevad mitte", async () => {
  const db = makeDb();
  await consume(db, "subject-1");
  const pruned = await pruneExpiredLoginThrottles({ db, now: () => new Date(NOW.getTime() + 16 * 60 * 1000) });
  assert.equal(pruned, 1);
});

// === SOL-AUTH-09: usaldatud IP ==============================================

test("IP tuleb ainult konfigureeritud edge-päisest ja ainult tema viimasest väärtusest", () => {
  const previous = process.env.TRUSTED_PROXY_IP_HEADER;
  const headers = new Headers({
    "x-real-ip": "198.51.100.7",
    "x-forwarded-for": "203.0.113.9, 198.51.100.7"
  });

  try {
    delete process.env.TRUSTED_PROXY_IP_HEADER;
    assert.equal(getTrustedRequestIp(headers), null, "ilma konfiguratsioonita ei usaldata ühtki päist");

    process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
    assert.equal(getTrustedRequestIp(headers), "198.51.100.7");

    // Kliendi kirjutatud esimene väärtus ei tohi võita: edge lisab enda nähtu LÕPPU.
    process.env.TRUSTED_PROXY_IP_HEADER = "x-forwarded-for";
    assert.equal(getTrustedRequestIp(headers), "198.51.100.7");

    // Spoofitud päis, mida konfiguratsioon ei nimeta, ei anna uut bucket'it.
    process.env.TRUSTED_PROXY_IP_HEADER = "x-real-ip";
    assert.equal(getTrustedRequestIp(new Headers({ "cf-connecting-ip": "203.0.113.9" })), null);
    assert.equal(getTrustedRequestIp(new Headers({ "x-real-ip": "not-an-ip" })), null);
  } finally {
    if (previous === undefined) delete process.env.TRUSTED_PROXY_IP_HEADER;
    else process.env.TRUSTED_PROXY_IP_HEADER = previous;
  }
});

// === SOL-AUTH-10: üks vastus ja üks ajastus =================================

function makeAuthDb(user) {
  const db = makeDb();
  db.user = {
    async findUnique({ where }) {
      return user && user.email === where.email ? { ...user } : null;
    }
  };
  return db;
}

const settings = {
  email: { limit: 3, windowMs: 60_000, lockMs: 60_000 },
  ip: { limit: 3, windowMs: 60_000, lockMs: 60_000 }
};

test("tundmatu e-post, peatatud konto ja vale PIN annavad sama tulemuse", async () => {
  const user = { id: "u1", email: "keegi@näide.ee", passwordHash: "hash:1234", accessSuspendedAt: null };

  const wrongPin = await authenticatePinAttempt({
    db: makeAuthDb(user),
    email: user.email,
    pin: "9999",
    compare: async () => false,
    settings,
    now
  });
  const unknown = await authenticatePinAttempt({
    db: makeAuthDb(null),
    email: "kadunud@näide.ee",
    pin: "9999",
    compare: async () => false,
    settings,
    now
  });
  const suspended = await authenticatePinAttempt({
    db: makeAuthDb({ ...user, accessSuspendedAt: NOW }),
    email: user.email,
    pin: "1234",
    compare: async () => true,
    settings,
    now
  });

  for (const result of [wrongPin, unknown, suspended]) {
    assert.equal(result.outcome, "invalid");
  }
  // Põhjus on olemas — aga ainult serveri jaoks; marsruut ei kanna teda vastusesse.
  assert.deepEqual(
    [wrongPin.reason, unknown.reason, suspended.reason],
    ["wrong_pin", "unknown_email", "no_usable_credential"]
  );
});

test("bcrypt jookseb ka siis, kui kontot ei ole — ajastus on osa vastusest", async () => {
  const compared = [];
  const compare = async (pin, hash) => {
    compared.push(hash);
    return false;
  };

  await authenticatePinAttempt({ db: makeAuthDb(null), email: "kadunud@näide.ee", pin: "9999", compare, settings, now });
  await authenticatePinAttempt({
    db: makeAuthDb({ id: "u1", email: "on@näide.ee", passwordHash: "hash:1234", accessSuspendedAt: null }),
    email: "on@näide.ee",
    pin: "9999",
    compare,
    settings,
    now
  });

  assert.equal(compared.length, 2, "tundmatu konto rada ei tohi bcryptist mööda minna");
  assert.equal(compared[0], DECOY_PIN_HASH);
  assert.equal(compared[1], "hash:1234");
  assert.match(DECOY_PIN_HASH, /^\$2b\$12\$/u, "peibutusräsi cost peab olema sama, mis päris PIN-idel");
});

test("lukustus tuleb ENNE andmebaasi- ja bcrypt-tööd ning kehtib ka tundmatule aadressile", async () => {
  const db = makeAuthDb(null);
  let compares = 0;
  const compare = async () => {
    compares += 1;
    return false;
  };

  const outcomes = [];
  for (let index = 0; index < 5; index += 1) {
    outcomes.push(
      (await authenticatePinAttempt({ db, email: "kadunud@näide.ee", pin: "9999", compare, settings, now })).outcome
    );
  }

  assert.deepEqual(outcomes, ["invalid", "invalid", "invalid", "rate_limited", "rate_limited"]);
  assert.equal(compares, 3, "lukustatud katse ei tohi bcrypti üldse kutsuda");
});

test("õige PIN nullib loenduri", async () => {
  const user = { id: "u1", email: "on@näide.ee", passwordHash: "hash:1234", accessSuspendedAt: null };
  const db = makeAuthDb(user);

  await authenticatePinAttempt({ db, email: user.email, pin: "9999", compare: async () => false, settings, now });
  assert.equal(db.rows.size, 1);

  const okResult = await authenticatePinAttempt({
    db,
    email: user.email,
    pin: "1234",
    compare: async () => true,
    settings,
    now
  });

  assert.equal(okResult.outcome, "ok");
  assert.equal(okResult.user.id, "u1");
  assert.equal(db.rows.size, 0, "õnnestumine peab loenduri vabastama");
});

// === Marsruudi ja liidese leping ============================================

test("login-step1 ei erista enam tundmatut e-posti valest PIN-ist", async () => {
  const route = await readFile(
    new URL("../../app/api/auth/login-step1/route.js", import.meta.url),
    "utf8"
  );

  assert.match(route, /authenticatePinAttempt/u);
  assert.doesNotMatch(route, /EMAIL_NOT_FOUND|PIN_INCORRECT/u);
  assert.match(route, /INVALID_CREDENTIALS/u);
  // Turvaotsus ei tohi tulla kliendi kirjutatavast päisest.
  assert.match(route, /getTrustedRequestIp/u);

  const modal = await readFile(new URL("../../components/LoginModal.jsx", import.meta.url), "utf8");
  assert.doesNotMatch(
    modal,
    /code === "EMAIL_NOT_FOUND"/u,
    "liides ei tohi tundmatut e-posti eraldi märkida — see oli serveri oraakli nähtav ots"
  );
});
