import assert from "node:assert/strict";
import test from "node:test";

import {
  PAYMENT_ARCHIVE_FIELDS,
  archiveUserPaymentsWithin,
  generateArchivedPayerRef
} from "../../lib/privacy/paymentArchive.js";

/* SOL-PAY-09. Leiu tuum ei ole see, et makse kustub „kogemata", vaid et
   AVALDATUD lubadus (privaatsustingimuste p 7.9, seitse aastat) võeti tagasi
   võõrvõtme reegliga, millest ükski logirida ei rääkinud. */

function store(rows) {
  const payments = rows.map((row) => ({ archivedAt: null, archivedPayerRef: null, archivedPlanCode: null, ...row }));
  return {
    payments,
    tx: {
      payment: {
        findMany: async ({ where, select }) => payments
          .filter((row) => row.userId === where.userId && (where.archivedAt !== null || row.archivedAt === null))
          .map((row) => (select?.subscription
            ? { id: row.id, subscription: row.subscription || null }
            : { id: row.id })),
        updateMany: async ({ where, data }) => {
          let count = 0;
          for (const row of payments) {
            if (row.id !== where.id) continue;
            if (where.archivedAt === null && row.archivedAt !== null) continue;
            Object.assign(row, data);
            count += 1;
          }
          return { count };
        }
      }
    }
  };
}

test("a deleted payer leaves the accounting record standing", async () => {
  const { payments, tx } = store([
    { id: "p1", userId: "user_1", subscription: { plan: "supervision_monthly" } },
    { id: "p2", userId: "user_1", subscription: null },
    { id: "p3", userId: "user_other", subscription: null }
  ]);

  const result = await archiveUserPaymentsWithin(tx, { userId: "user_1", now: new Date("2026-08-12T12:00:00Z") });

  assert.equal(result.archived, 2);
  assert.ok(result.payerRef, "pseudonüüm peab olema");

  const [p1, p2, p3] = payments;
  assert.equal(p1.archivedAt.toISOString(), "2026-08-12T12:00:00.000Z");
  /* Sama inimese maksed jäävad OMAVAHEL seotuks — muidu ei saa raamatupidaja
     neid ühe tehinguperena kokku lugeda. */
  assert.equal(p1.archivedPayerRef, p2.archivedPayerRef);
  /* Võõra maksja rida ei tohi liikuda. */
  assert.equal(p3.archivedAt, null);
  assert.equal(p3.archivedPayerRef, null);
});

test("what was sold is frozen as an internal code, never as a readable package name", async () => {
  const { payments, tx } = store([
    { id: "p1", userId: "user_1", subscription: { plan: "supervision_monthly" } }
  ]);

  await archiveUserPaymentsWithin(tx, { userId: "user_1" });

  /* Plaanikood loetakse ENNE kustutust, sest `Subscription` kaskaadib koos
     kasutajaga ja pärast seda ei ole teda kuskilt küsida. */
  assert.equal(payments[0].archivedPlanCode, "supervision_monthly");
  /* Ja ta on kood, mitte lause: „supervisioonipakett" tõendaks seitse aastat,
     et see inimene oli supervisioonis. */
  assert.equal(/\s/.test(payments[0].archivedPlanCode), false, "koodis ei ole tühikuid");
});

test("archiving is idempotent so one person's payments cannot split into two pseudonyms", async () => {
  const { payments, tx } = store([
    { id: "p1", userId: "user_1", subscription: null },
    { id: "p2", userId: "user_1", subscription: null }
  ]);

  const first = await archiveUserPaymentsWithin(tx, { userId: "user_1" });
  const second = await archiveUserPaymentsWithin(tx, { userId: "user_1" });

  assert.equal(first.archived, 2);
  assert.equal(second.archived, 0, "teine käik ei tohi midagi üle kirjutada");
  assert.equal(payments[0].archivedPayerRef, payments[1].archivedPayerRef);
});

test("the pseudonym is random, not derived — a leaked database cannot reverse it", () => {
  const refs = new Set(Array.from({ length: 200 }, () => generateArchivedPayerRef()));
  assert.equal(refs.size, 200, "kaks ühesugust viidet seoks võõrad inimesed kokku");
  for (const ref of refs) assert.match(ref, /^payer_[A-Za-z0-9_-]{20,}$/);
});

test("the retained composition lives in one named place", () => {
  assert.deepEqual([...PAYMENT_ARCHIVE_FIELDS], ["archivedAt", "archivedPayerRef", "archivedPlanCode"]);
});

/* NEGATIIVKONTROLL. Vana käitumine ei olnud „unustatud kustutus", vaid
   `ON DELETE CASCADE`: maksja kustutamine viis rea kaasa. Jäljendame mõlemat
   reeglit sama andmestiku peal ja nõuame, et nad annaksid ERI tulemuse. */
test("the previous cascade rule would have destroyed the record the terms promise", async () => {
  const rows = [{ id: "p1", userId: "user_1" }, { id: "p2", userId: "user_other" }];

  const cascade = rows.filter((row) => row.userId !== "user_1");
  assert.equal(cascade.length, 1, "vana reegel jättis alles ainult võõra rea");
  assert.equal(cascade.some((row) => row.id === "p1"), false, "maksekirje oli kadunud");

  const { payments, tx } = store(rows.map((row) => ({ ...row, subscription: null })));
  await archiveUserPaymentsWithin(tx, { userId: "user_1" });
  const survives = payments.find((row) => row.id === "p1");

  assert.ok(survives, "uue reegli all jääb rida alles");
  assert.ok(survives.archivedAt, "ja ta ütleb ise välja, et maksja on kustutatud");
  assert.notEqual(cascade.length, payments.length, "kaks reeglit ei tohi anda sama tulemust");
});
