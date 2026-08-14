import assert from "node:assert/strict";
import test from "node:test";
import { setImmediate as tick } from "node:timers/promises";

import {
  SESSION_LOCK_NAMESPACE,
  SESSION_REVOKED,
  SESSION_USER_MISSING,
  authorizeCurrentAdminToken,
  createTrackedSessionForUser,
  refreshTokenAuthorization
} from "../../lib/auth/jwtAuthorization.js";
import { getActiveSessionMaxForUser } from "../../lib/auth/pin-login.js";

const NOW = new Date("2026-08-09T10:00:00.000Z");
const FUTURE = new Date("2026-09-09T10:00:00.000Z");

function baseUser(overrides = {}) {
  return {
    role: "SOCIAL_WORKER",
    isAdmin: true,
    sessionVersion: 4,
    accessSuspendedAt: null,
    subscriptions: [{ id: "sub-1" }],
    ...overrides
  };
}

function elevatedToken(overrides = {}) {
  return {
    id: "user-1",
    role: "SOCIAL_WORKER",
    isAdmin: true,
    sessionVersion: 4,
    sessionRecordId: "session-1",
    subActive: true,
    ...overrides
  };
}

/**
 * Minimaalne prisma-laadne test-DB. `userError`/`sessionError` süstivad
 * ootamatu (mitte-lepingulise) tõrke — täpselt selle, mille peale SOL-AUTH-01
 * nõuab fail-closed käitumist.
 */
function makeDb({
  user = baseUser(),
  trackedSessionActive = true,
  userError = null,
  sessionFindError = null,
  sessionCreateError = null
} = {}) {
  const calls = { userFindUnique: 0, sessionFindFirst: 0, transactions: 0 };
  return {
    calls,
    user: {
      async findUnique() {
        calls.userFindUnique += 1;
        if (userError) throw userError;
        return user ? { ...user } : null;
      }
    },
    session: {
      async findFirst() {
        calls.sessionFindFirst += 1;
        if (sessionFindError) throw sessionFindError;
        return trackedSessionActive ? { id: "session-1" } : null;
      }
    },
    async $transaction(fn) {
      calls.transactions += 1;
      if (sessionCreateError) throw sessionCreateError;
      return fn({
        async $executeRaw() {
          return 1;
        },
        session: {
          async deleteMany() {
            return { count: 0 };
          },
          async findMany() {
            return [];
          },
          async create() {
            return { id: "session-new" };
          }
        }
      });
    }
  };
}

function assertFailClosed(token) {
  assert.equal(token.role, "CLIENT", "roll peab langema madalaimale tasemele");
  assert.equal(token.isAdmin, false, "administraatoriõigus ei tohi tõrke ajal säilida");
  assert.equal(token.subActive, false, "tellimusõigus ei tohi tõrke ajal säilida");
  assert.equal(token.authDegraded, true, "langetatud seis peab olema tokenis nähtav");
}

test("õnnestunud värskendus võtab rolli, administraatoriõiguse ja tellimuse andmebaasist", async () => {
  const token = elevatedToken({ role: "CLIENT", isAdmin: false, subActive: false });
  const db = makeDb();

  const result = await refreshTokenAuthorization(token, { db, now: NOW });

  assert.deepEqual(result, { degraded: false });
  assert.equal(token.role, "SOCIAL_WORKER");
  assert.equal(token.isAdmin, true);
  assert.equal(token.subActive, true);
  assert.equal(token.authDegraded, undefined);
});

test("SOL-AUTH-01: kasutajapäringu ootamatu viga ei jäta vana rolli ega admin-õigust kehtima", async () => {
  const token = elevatedToken();
  const db = makeDb({ userError: new Error("ECONNREFUSED") });

  const result = await refreshTokenAuthorization(token, { db, now: NOW });

  assert.equal(result.degraded, true);
  assert.equal(result.error.message, "ECONNREFUSED");
  assertFailClosed(token);
});

test("SOL-AUTH-01: jälgitava sessiooni kontrolli ootamatu viga on samuti fail-closed", async () => {
  const token = elevatedToken();
  const db = makeDb({ sessionFindError: new Error("P1001: server unreachable") });

  const result = await refreshTokenAuthorization(token, { db, now: NOW });

  assert.equal(result.degraded, true);
  assertFailClosed(token);
  assert.equal(db.calls.sessionFindFirst, 1);
});

test("SOL-AUTH-01: jälgitava sessiooni loomise viga on fail-closed", async () => {
  const token = elevatedToken({ sessionRecordId: null });
  const db = makeDb({ sessionCreateError: new Error("deadlock detected") });

  const result = await refreshTokenAuthorization(token, { db, now: NOW });

  assert.equal(result.degraded, true);
  assertFailClosed(token);
  assert.equal(token.sessionRecordId, null);
});

test("langetatud token taastub järgmisel õnnestunud värskendusel", async () => {
  const token = elevatedToken();
  await refreshTokenAuthorization(token, { db: makeDb({ userError: new Error("ECONNREFUSED") }), now: NOW });
  assertFailClosed(token);

  const result = await refreshTokenAuthorization(token, { db: makeDb(), now: NOW });

  assert.deepEqual(result, { degraded: false });
  assert.equal(token.role, "SOCIAL_WORKER");
  assert.equal(token.isAdmin, true);
  assert.equal(token.authDegraded, undefined);
});

test("puuduv kasutaja ja tühistatud sessioon lõpetavad sessiooni endiselt", async () => {
  await assert.rejects(
    refreshTokenAuthorization(elevatedToken(), { db: makeDb({ user: null }), now: NOW }),
    /SESSION_USER_MISSING/
  );
  await assert.rejects(
    refreshTokenAuthorization(elevatedToken(), {
      db: makeDb({ user: baseUser({ accessSuspendedAt: NOW }) }),
      now: NOW
    }),
    new RegExp(SESSION_REVOKED)
  );
  await assert.rejects(
    refreshTokenAuthorization(elevatedToken(), {
      db: makeDb({ user: baseUser({ sessionVersion: 5 }) }),
      now: NOW
    }),
    new RegExp(SESSION_REVOKED)
  );
  await assert.rejects(
    refreshTokenAuthorization(elevatedToken(), {
      db: makeDb({ trackedSessionActive: false }),
      now: NOW
    }),
    new RegExp(SESSION_REVOKED)
  );
  assert.equal(SESSION_USER_MISSING, "SESSION_USER_MISSING");
});

test("suletud registreerimise eelvaade kontrollib administraatoriõigust alati värskest seisust", async () => {
  const currentAdmin = elevatedToken({ role: "CLIENT", isAdmin: false });
  assert.equal(
    await authorizeCurrentAdminToken(currentAdmin, { db: makeDb(), now: NOW }),
    true,
    "kehtiv administraator peab eelvaatesse pääsema"
  );

  const demoted = elevatedToken();
  assert.equal(
    await authorizeCurrentAdminToken(demoted, {
      db: makeDb({ user: baseUser({ role: "CLIENT", isAdmin: false }) }),
      now: NOW
    }),
    false,
    "vana JWT administraatoriväide ei tohi pärast rolli eemaldamist kehtida"
  );
  assert.equal(demoted.isAdmin, false);

  assert.equal(
    await authorizeCurrentAdminToken(elevatedToken(), {
      db: makeDb({ user: baseUser({ accessSuspendedAt: NOW }) }),
      now: NOW
    }),
    false,
    "peatatud konto peab samas päringus ligipääsu kaotama"
  );

  assert.equal(
    await authorizeCurrentAdminToken(elevatedToken(), {
      db: makeDb({ userError: new Error("db unavailable") }),
      now: NOW
    }),
    false,
    "värskuse kontrolli tõrge peab olema fail-closed"
  );
});

test("proxy kasutab suletud registreerimisel kanoniseeritud värsket administraatorikontrolli", async () => {
  const proxySource = await import("node:fs/promises").then(({ readFile }) =>
    readFile(new URL("../../proxy.js", import.meta.url), "utf8")
  );
  assert.match(proxySource, /authorizeCurrentAdminToken/u);
  assert.doesNotMatch(
    proxySource,
    /token\?\.isAdmin\s*===\s*true\s*\|\|/u,
    "toorest JWT rolliväidet ei tohi lõpliku otsusena kasutada"
  );
});

/**
 * SOL-AUTH-02 — sessioonide ülempiiri paralleelsus.
 *
 * Test-DB matkib PostgreSQL nõuandelukku: `pg_advisory_xact_lock` hoiab lukku
 * kuni tehingu lõpuni. `withAdvisoryLock: false` on negatiivkontroll — see
 * mudeldab lukustamata (parandus-eelset) rada ja peab ülempiiri ületama.
 */
function makeConcurrentSessionDb({ withAdvisoryLock = true } = {}) {
  const state = { sessions: [], nextId: 1 };
  const rawStatements = [];
  const locks = new Map();

  async function acquire(key) {
    while (locks.has(key)) {
      await locks.get(key);
    }
    let release;
    const held = new Promise(resolve => {
      release = resolve;
    });
    locks.set(key, held);
    return () => {
      locks.delete(key);
      release();
    };
  }

  return {
    state,
    rawStatements,
    async $transaction(fn) {
      const releases = [];
      const tx = {
        async $executeRaw(strings, ...values) {
          const statement = Array.isArray(strings) ? strings.join("?") : String(strings);
          rawStatements.push({ statement, values });
          if (!withAdvisoryLock) return 1;
          releases.push(await acquire(values.join(":")));
          return 1;
        },
        session: {
          async deleteMany({ where }) {
            await tick();
            const before = state.sessions.length;
            if (where?.id?.in) {
              state.sessions = state.sessions.filter(row => !where.id.in.includes(row.id));
            } else if (where?.expires?.lte) {
              state.sessions = state.sessions.filter(
                row => !(row.userId === where.userId && row.expires <= where.expires.lte)
              );
            }
            return { count: before - state.sessions.length };
          },
          async findMany({ where }) {
            await tick();
            return state.sessions
              .filter(row => row.userId === where.userId && row.expires > where.expires.gt)
              .sort((a, b) => a.expires - b.expires)
              .map(row => ({ id: row.id }));
          },
          async create({ data }) {
            await tick();
            const row = { id: `session-${state.nextId++}`, ...data };
            state.sessions.push(row);
            return { id: row.id };
          }
        }
      };
      try {
        return await fn(tx);
      } finally {
        releases.forEach(release => release());
      }
    }
  };
}

test("SOL-AUTH-02: kaks samaaegset sisselogimist ei ületa aktiivsete sessioonide ülempiiri", async () => {
  const user = { id: "user-1", role: "SOCIAL_WORKER", isAdmin: false };
  const maxSessions = getActiveSessionMaxForUser(user);
  const db = makeConcurrentSessionDb();

  db.state.sessions = Array.from({ length: maxSessions }, (_, index) => ({
    id: `old-${index}`,
    userId: user.id,
    expires: new Date(FUTURE.getTime() + index * 1000)
  }));

  await Promise.all([
    createTrackedSessionForUser(user, { db, now: NOW }),
    createTrackedSessionForUser(user, { db, now: NOW })
  ]);

  assert.equal(db.state.sessions.length, maxSessions);
  assert.ok(
    db.rawStatements.every(entry => /pg_advisory_xact_lock/.test(entry.statement)),
    "sessiooniloomine peab võtma nõuandeluku"
  );
  assert.deepEqual(db.rawStatements[0].values, [SESSION_LOCK_NAMESPACE, user.id]);
});

test("SOL-AUTH-02 negatiivkontroll: lukustamata rada ületab ülempiiri", async () => {
  const user = { id: "user-1", role: "SOCIAL_WORKER", isAdmin: false };
  const maxSessions = getActiveSessionMaxForUser(user);
  const db = makeConcurrentSessionDb({ withAdvisoryLock: false });

  db.state.sessions = Array.from({ length: maxSessions }, (_, index) => ({
    id: `old-${index}`,
    userId: user.id,
    expires: new Date(FUTURE.getTime() + index * 1000)
  }));

  await Promise.all([
    createTrackedSessionForUser(user, { db, now: NOW }),
    createTrackedSessionForUser(user, { db, now: NOW })
  ]);

  assert.ok(
    db.state.sessions.length > maxSessions,
    "ilma lukuta peab test ülempiiri ületamise nägema — muidu ei mõõda ta midagi"
  );
});
