import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  CHECKOUT_INTENT_LOCK_NAMESPACE,
  claimCheckoutIntent,
  getStoredCheckoutTransactionId,
  normalizeClientIntentKey
} from "../../lib/payments/checkoutIntent.js";

/* SOL-PAY-03 — ÜKS KAVATSUS = ÜKS TASUTAV CHECKOUT.

   Vana init lõi iga päringu peale uue juhusliku viitega makse ja uue
   provideritransaktsiooni. Topeltklõps või kaks vahekaarti võisid avada kaks
   tasutavat checkout'i ja mõlema tasumisel pikendas kumbki webhook sama tellimust
   veel kuu võrra.

   Fake mõõdab siin OTSUSTUSREEGLIT (mis outcome millise seisu peale). Päris
   võistlus, päris unikaalsus ja päris nõuandelukk on sondi töö
   (`npm run pay:checkout:probe`) — fake ei tõenda kunagi lukku. */

const NOW = new Date("2026-08-11T12:00:00.000Z");
const MIN = 60 * 1000;

function fakeDb(rows) {
  const locks = [];
  const db = {
    locks,
    created: [],
    async $transaction(fn) {
      return fn(db);
    },
    async $executeRaw(strings, ...values) {
      locks.push({ sql: strings.join("?"), values });
      return 1;
    },
    payment: {
      async findFirst({ where }) {
        const match = rows.find((row) => {
          if (row.userId !== where.userId) return false;
          if (where.clientIntentKey !== undefined && row.clientIntentKey !== where.clientIntentKey) {
            return false;
          }
          if (where.NOT?.clientIntentKey !== undefined && row.clientIntentKey === where.NOT.clientIntentKey) {
            return false;
          }
          if (where.status && row.status !== where.status) return false;
          if (where.kind && row.kind !== where.kind) return false;
          if (where.createdAt?.gte && row.createdAt < where.createdAt.gte) return false;
          return true;
        });
        return match ? { ...match } : null;
      }
    }
  };
  return db;
}

function openAttempt(overrides = {}) {
  return {
    id: "pay_open",
    userId: "u1",
    status: "INITIATED",
    kind: "SUBSCRIPTION_INITIAL",
    amount: "9.90",
    currency: "EUR",
    clientIntentKey: "intent-a",
    providerPaymentId: "mk_1",
    subscriptionId: "s1",
    createdAt: new Date(NOW.getTime() - MIN),
    raw: { transactionId: "trx-1" },
    ...overrides
  };
}

const EXPECTED = { amount: "9.90", currency: "EUR", kind: "SUBSCRIPTION_INITIAL" };

async function claim(rows, key, overrides = {}) {
  const db = fakeDb(rows);
  let createCalls = 0;
  const result = await claimCheckoutIntent({
    db,
    userId: "u1",
    clientIntentKey: key,
    expected: EXPECTED,
    now: NOW,
    createAttempt: async () => {
      createCalls += 1;
      return { id: "pay_new", providerPaymentId: "mk_new", subscriptionId: "s1", raw: {} };
    },
    ...overrides
  });
  return { ...result, createCalls, db };
}

test("võti on kohustuslik ja tema kuju on piiratud", () => {
  assert.equal(normalizeClientIntentKey("  abc-123_x  "), "abc-123_x");
  assert.equal(normalizeClientIntentKey(""), "");
  assert.equal(normalizeClientIntentKey(null), "");
  assert.equal(normalizeClientIntentKey("a b"), "", "tühik ei ole lubatud");
  assert.equal(normalizeClientIntentKey("x".repeat(129)), "", "ülipikk võti ei ole lubatud");
});

test("võtmeta claim viskab erindi, mitte ei loo uut makset", async () => {
  const db = fakeDb([]);
  await assert.rejects(
    () =>
      claimCheckoutIntent({
        db,
        userId: "u1",
        clientIntentKey: "",
        createAttempt: async () => ({ id: "must_not_happen" })
      }),
    (error) => error.code === "CHECKOUT_INTENT_REQUIRED"
  );
});

test("tühjal laual luuakse üks katse ja otsus käib kasutajapõhise luku all", async () => {
  const result = await claim([], "intent-a");
  assert.equal(result.outcome, "created");
  assert.equal(result.createCalls, 1);
  assert.equal(result.db.locks.length, 1, "nõuandelukk võeti");
  assert.match(result.db.locks[0].sql, /pg_advisory_xact_lock/);
  assert.equal(result.db.locks[0].values[0], CHECKOUT_INTENT_LOCK_NAMESPACE);
  assert.equal(result.db.locks[0].values[1], "u1");
});

test("KANDEV: sama võti tagastab sama checkout'i, mitte teist", async () => {
  const result = await claim([openAttempt()], "intent-a");
  assert.equal(result.outcome, "reused");
  assert.equal(result.createCalls, 0, "teist provideritransaktsiooni ei tellita");
  assert.equal(getStoredCheckoutTransactionId(result.payment), "trx-1");
});

test("KANDEV: teine vahekaart (teine võti) ei ava teist tasutavat checkout'i", async () => {
  const result = await claim([openAttempt()], "intent-b");
  assert.equal(result.outcome, "reused");
  assert.equal(result.createCalls, 0);
  assert.equal(result.payment.clientIntentKey, "intent-a", "tagasi tuleb JUBA avatud katse");
});

test("sama võti, aga võitja on veel provideri kutses → aus „pooleli“, mitte teine katse", async () => {
  const result = await claim([openAttempt({ raw: {} })], "intent-a");
  assert.equal(result.outcome, "in_progress");
  assert.equal(result.createCalls, 0);
});

test("teine võti, kui esimene on veel lennus → pooleli, mitte uus katse", async () => {
  const result = await claim([openAttempt({ raw: {} })], "intent-b");
  assert.equal(result.outcome, "in_progress");
  assert.equal(result.createCalls, 0);
});

test("checkout'ita rida, mis EI ole enam lennus, ei blokeeri uut kavatsust", async () => {
  const dead = openAttempt({ raw: {}, createdAt: new Date(NOW.getTime() - 20 * MIN) });
  const result = await claim([dead], "intent-b");
  assert.equal(result.outcome, "created", "surnud pooleliolek ei tohi kasutajat ummikusse jätta");
  assert.equal(result.createCalls, 1);
});

test("sama võti surnud pooleloleku peal on ÄRA KASUTATUD — klient mindib uue", async () => {
  const dead = openAttempt({ raw: {}, createdAt: new Date(NOW.getTime() - 20 * MIN) });
  const result = await claim([dead], "intent-a");
  assert.equal(result.outcome, "spent");
  assert.equal(result.createCalls, 0);
});

test("lõppenud ja ebamäärane katse on mõlemad ära kasutatud kavatsused", async () => {
  for (const status of ["PAID", "FAILED", "CANCELED", "REFUNDED", "RECONCILE_PENDING"]) {
    const result = await claim([openAttempt({ status })], "intent-a");
    assert.equal(result.outcome, "spent", status);
    assert.equal(result.createCalls, 0, status);
  }
});

test("avatud katse teise summaga on konflikt, mitte vaikne vale summa", async () => {
  const result = await claim([openAttempt({ amount: "29.90" })], "intent-b");
  assert.equal(result.outcome, "conflict");
  assert.equal(result.createCalls, 0);
});

test("aegunud avatud katse ei blokeeri uut kavatsust", async () => {
  const old = openAttempt({ createdAt: new Date(NOW.getTime() - 45 * MIN) });
  const result = await claim([old], "intent-b");
  assert.equal(result.outcome, "created");
  assert.equal(result.createCalls, 1);
});

test("checkout'i viide loetakse nii ülemiselt tasemelt kui pesastatud objektist", () => {
  assert.equal(getStoredCheckoutTransactionId({ raw: { transactionId: "a" } }), "a");
  assert.equal(getStoredCheckoutTransactionId({ raw: { checkout: { transactionId: "b" } } }), "b");
  assert.equal(getStoredCheckoutTransactionId({ raw: { checkout: { id: "c" } } }), "c");
  assert.equal(getStoredCheckoutTransactionId({ raw: null }), "");
  assert.equal(getStoredCheckoutTransactionId(null), "");
});

/* LEPING: marsruut ja klient peavad päriselt sellel rajal olema. Ilma nende
   väideteta tõendaks fail ainult iseennast. */
test("init-marsruut nõuab kliendi võtit ja loob makse claim'i sees", () => {
  const source = readFileSync(
    new URL("../../app/api/subscription/init/route.js", import.meta.url),
    "utf8"
  );
  assert.match(source, /normalizeClientIntentKey\(/);
  assert.match(source, /api\.subscription\.checkout_intent_required/);
  assert.match(source, /claimCheckoutIntent\(/);
  assert.match(source, /createAttempt: async \(tx\) =>/);
  assert.match(source, /clientIntentKey,/, "võti läheb makse reale");
  assert.ok(
    !/await prisma\.payment\.create\(/.test(source),
    "makse loomine peab käima lukustatud claim'i sees, mitte marsruudist otse"
  );
});

test("klient saadab stabiilse kavatsuse võtme", () => {
  const source = readFileSync(
    new URL("../../components/alalehed/TellimusBody.jsx", import.meta.url),
    "utf8"
  );
  assert.match(source, /resolveIntentKey\(/);
  assert.match(source, /idempotencyKey: checkoutIntentRef\.current\.key/);
});

test("skeem kannab kavatsuse veergu ja unikaalsust", () => {
  const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");
  assert.match(schema, /clientIntentKey\s+String\?/);
  assert.match(schema, /@@unique\(\[userId, clientIntentKey\]\)/);
  assert.match(schema, /RECONCILE_PENDING/);
});
