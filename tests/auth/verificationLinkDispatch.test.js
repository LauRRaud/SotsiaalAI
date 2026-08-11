import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  VERIFICATION_DISPATCH_LEASE_MS,
  VERIFICATION_DISPATCH_LOCK_NAMESPACE,
  dispatchVerificationLink
} from "../../lib/auth/verificationLinkDispatch.js";
import { hashVerificationToken } from "../../lib/auth/verificationTokens.js";

const IDENTIFIER = "password-reset:kaia@example.test";
const NOW = new Date("2026-08-11T12:00:00.000Z");
const EXPIRES = new Date("2026-08-11T13:00:00.000Z");

/**
 * Fake, mis modelleerib nõuandeluku MÕJU: `serialize: true` = kaks paralleelset tehingut ei
 * põimu. Ilma selle režiimita ei tõendaks paralleeltest midagi — fake'is, kus paralleelsust
 * pole, on iga võidujooksutest triviaalselt roheline (sama õppetund mis SOL-AUTH-09-l).
 */
function makeDb({ serialize = true, tokens = [], dispatch = null } = {}) {
  const state = {
    tokens: tokens.map((row) => ({ ...row })),
    dispatch: dispatch ? { ...dispatch } : null,
    locks: []
  };
  let chain = Promise.resolve();

  const tokenApi = {
    async create({ data }) {
      state.tokens.push({ ...data });
      return { ...data };
    },
    async deleteMany({ where }) {
      const keep = [];
      let count = 0;
      for (const row of state.tokens) {
        const sameIdentifier = row.identifier === where.identifier;
        const excluded = where.NOT?.token !== undefined && row.token === where.NOT.token;
        const targeted = where.token !== undefined ? row.token === where.token : true;
        if (sameIdentifier && targeted && !excluded) {
          count += 1;
        } else {
          keep.push(row);
        }
      }
      state.tokens = keep;
      return { count };
    }
  };

  const dispatchApi = {
    async findUnique({ where }) {
      if (!state.dispatch || state.dispatch.identifier !== where.identifier) return null;
      return { ...state.dispatch };
    },
    async upsert({ where, create, update }) {
      state.dispatch =
        state.dispatch && state.dispatch.identifier === where.identifier
          ? { ...state.dispatch, ...update }
          : { ...create };
      return { ...state.dispatch };
    },
    async updateMany({ where, data }) {
      const row = state.dispatch;
      if (
        !row ||
        row.identifier !== where.identifier ||
        row.tokenValue !== where.tokenValue ||
        (where.sentAt === null && row.sentAt)
      ) {
        return { count: 0 };
      }
      state.dispatch = { ...row, ...data };
      return { count: 1 };
    },
    async deleteMany({ where }) {
      const row = state.dispatch;
      if (
        !row ||
        row.identifier !== where.identifier ||
        row.tokenValue !== where.tokenValue ||
        (where.sentAt === null && row.sentAt)
      ) {
        return { count: 0 };
      }
      state.dispatch = null;
      return { count: 1 };
    }
  };

  const client = {
    state,
    verificationToken: tokenApi,
    verificationLinkDispatch: dispatchApi,
    async $transaction(fn) {
      const run = () =>
        fn({
          async $executeRaw(strings, ...values) {
            state.locks.push({ sql: strings.join("?"), values });
            return 1;
          },
          verificationToken: tokenApi,
          verificationLinkDispatch: dispatchApi
        });

      if (!serialize) return run();
      const result = chain.then(run, run);
      chain = result.catch(() => {});
      return result;
    }
  };

  return client;
}

/** Kaheosaline barjäär: mõlemad saatmised on korraga „teel", siis lastakse lahti. */
function makeBarrier(parties) {
  let arrived = 0;
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  return async () => {
    arrived += 1;
    if (arrived >= parties) release();
    await gate;
  };
}

const run = (db, deliver, options = {}) =>
  dispatchVerificationLink({
    db,
    identifier: IDENTIFIER,
    expires: EXPIRES,
    deliver,
    now: () => NOW,
    ...options
  });

test("saadab lingi, salvestab räsi ja rotreerib vanad alles PÄRAST tarnet", async () => {
  const db = makeDb({ tokens: [{ identifier: IDENTIFIER, token: "v2:old", expires: EXPIRES }] });
  const seen = [];

  const result = await run(db, async (rawToken) => {
    // Vana link peab tarne hetkel VEEL kehtima (SOL-AUTH-06/-13 järjekord).
    seen.push({ rawToken, tokensAtDelivery: db.state.tokens.map((row) => row.token) });
  });

  assert.equal(result.outcome, "sent");
  assert.equal(seen.length, 1);
  assert.ok(seen[0].tokensAtDelivery.includes("v2:old"), "vana token kadus juba enne saatmist");

  const stored = hashVerificationToken(seen[0].rawToken);
  assert.deepEqual(db.state.tokens.map((row) => row.token), [stored]);
  assert.notEqual(seen[0].rawToken, stored, "toorlink ei tohi olla see, mis ritta läheb");
  assert.equal(db.state.dispatch.tokenValue, stored);
  assert.deepEqual(db.state.dispatch.sentAt, NOW);
  assert.equal(db.state.locks.length, 2);
  assert.deepEqual(db.state.locks[0].values, [VERIFICATION_DISPATCH_LOCK_NAMESPACE, IDENTIFIER]);
});

test("kaks paralleelset päringut: üks kiri, üks kehtiv token", async () => {
  const db = makeDb();
  const delivered = [];
  let release;
  const inFlight = new Promise((resolve) => {
    release = resolve;
  });

  const deliver = async (rawToken) => {
    delivered.push(rawToken);
    await inFlight;
  };

  const pair = Promise.all([run(db, deliver), run(db, deliver)]);
  // Üks makrotakt: kõik mikrotaskid — sh teise päringu claim-tehing — on selleks ajaks läbi,
  // esimene saatja aga endiselt `deliver` sees. Just see aken oli leid.
  await new Promise((resolve) => setImmediate(resolve));
  release();

  const results = await pair;
  const outcomes = results.map((row) => row.outcome).sort();

  assert.deepEqual(outcomes, ["in_flight", "sent"]);
  assert.equal(delivered.length, 1, "teine päring saatis kirja, mida ta ei tohtinud saata");
  assert.equal(db.state.tokens.length, 1);
  assert.equal(
    db.state.tokens[0].token,
    hashVerificationToken(delivered[0]),
    "kehtima jäi mõni muu token kui see, mis kirjas välja läks"
  );
});

test("NEGATIIVKONTROLL: vana muster tapab samas harnessis mõlemad välja saadetud lingid", async () => {
  const db = makeDb();
  const barrier = makeBarrier(2);
  const delivered = [];

  // Vana rada täpselt nii, nagu ta marsruudis oli: create → send → deleteMany(NOT mina).
  const legacyDispatch = async () => {
    const stored = `v2:${delivered.length}-${Math.random().toString(36).slice(2)}`;
    await db.verificationToken.create({
      data: { identifier: IDENTIFIER, token: stored, expires: EXPIRES }
    });
    delivered.push(stored);
    await barrier();
    await db.verificationToken.deleteMany({ where: { identifier: IDENTIFIER, NOT: { token: stored } } });
    return { outcome: "sent" };
  };

  const results = await Promise.all([legacyDispatch(), legacyDispatch()]);

  assert.deepEqual(results.map((row) => row.outcome), ["sent", "sent"], "mõlemad raporteerisid edu");
  assert.equal(delivered.length, 2, "mõlemad kirjad läksid teele");
  assert.equal(db.state.tokens.length, 0, "vana muster jättis alles tokeni — leid oleks olematu");
});

test("tarnetõrge: liisung vabaneb kohe ja varem saadetud link jääb kehtima", async () => {
  const db = makeDb({ tokens: [{ identifier: IDENTIFIER, token: "v2:old", expires: EXPIRES }] });
  const failure = new Error("smtp down");

  const result = await run(db, async () => {
    throw failure;
  });

  assert.equal(result.outcome, "delivery_failed");
  assert.equal(result.error, failure);
  assert.ok(
    db.state.tokens.some((row) => row.token === "v2:old"),
    "varem saadetud link tapeti tarnetõrke peale"
  );
  assert.equal(db.state.tokens.length, 2, "ebaselge tarne ei tohi minu tokenit ära visata");
  assert.equal(db.state.dispatch, null, "liisung jäi kinni — kordus oleks akna taga lukus");

  // Kordus tohib kohe uuesti saata, ilma vananemisakent ootamata.
  const retry = await run(db, async () => {});
  assert.equal(retry.outcome, "sent");
  assert.equal(db.state.tokens.length, 1);
});

test("aegunud liisung võetakse üle, värske mitte", async () => {
  const stale = {
    identifier: IDENTIFIER,
    tokenValue: "v2:stale",
    claimedAt: new Date(NOW.getTime() - VERIFICATION_DISPATCH_LEASE_MS - 1),
    sentAt: null
  };
  const staleDb = makeDb({ dispatch: stale, tokens: [{ identifier: IDENTIFIER, token: "v2:stale", expires: EXPIRES }] });
  assert.equal((await run(staleDb, async () => {})).outcome, "sent");
  assert.equal(staleDb.state.tokens.length, 1);
  assert.notEqual(staleDb.state.tokens[0].token, "v2:stale");

  const freshDb = makeDb({
    dispatch: { ...stale, claimedAt: new Date(NOW.getTime() - VERIFICATION_DISPATCH_LEASE_MS + 1) },
    tokens: [{ identifier: IDENTIFIER, token: "v2:stale", expires: EXPIRES }]
  });
  let delivered = false;
  assert.equal((await run(freshDb, async () => { delivered = true; })).outcome, "in_flight");
  assert.equal(delivered, false);
  assert.deepEqual(freshDb.state.tokens.map((row) => row.token), ["v2:stale"]);
});

test("üle võetud liisung: kiri läks teele, aga rotatsiooni ma ei tee", async () => {
  const db = makeDb();

  const result = await run(db, async () => {
    // Vananemisaken möödus saatmise ajal ja keegi teine võttis identifikaatori üle.
    db.state.dispatch = {
      identifier: IDENTIFIER,
      tokenValue: "v2:someone-else",
      claimedAt: NOW,
      sentAt: null
    };
    db.state.tokens.push({ identifier: IDENTIFIER, token: "v2:someone-else", expires: EXPIRES });
  });

  assert.equal(result.outcome, "superseded");
  assert.equal(db.state.tokens.length, 2, "võõra omaniku token kustutati");
  assert.equal(db.state.dispatch.tokenValue, "v2:someone-else");
});

test("marsruut kasutab jagatud rada, mitte oma create/deleteMany paari", async () => {
  const source = await readFile(new URL("../../app/api/auth/password/reset/route.js", import.meta.url), "utf8");
  assert.match(source, /dispatchVerificationLink/);
  assert.doesNotMatch(source, /verificationToken\.create/);
  assert.doesNotMatch(source, /verificationToken\.deleteMany/);
});
