import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  enqueuePaymentEmail,
  isAmbiguousRetrySafe,
  mintOutboxMessageId,
  runPaymentEmailDelivery
} from "../../lib/payments/emailOutbox.js";

/* SOL-PAY-11 — EBAMÄÄRANE SAATMINE EI OLE PIME KORDUS.

   `Promise.race()` piiras ootamist, aga ei katkestanud SMTP tööd; lease-taaste
   tõstis `SENDING` rea `RETRY`-ks teadmata, mis juhtus. Uus katse saatis sama
   kirja uuesti ILMA püsiva sõnumitunnuseta — adressaadi jaoks TEINE kiri. */

const NOW = new Date("2026-08-12T12:00:00.000Z");
const LATER = new Date(NOW.getTime() + 6 * 60 * 60 * 1000);

// Ilma saatja aadressita märgib worker rea `SKIPPED`-iks ja siis ei mõõda see
// fail seda, mida ta mõõtma peab.
process.env.EMAIL_FROM = process.env.EMAIL_FROM || "probe@sotsiaalai.invalid";

function matchRow(row, where) {
  if (where.id && row.id !== where.id) return false;
  if (where.status?.in && !where.status.in.includes(row.status)) return false;
  if (typeof where.status === "string" && row.status !== where.status) return false;
  if (where.nextAttemptAt?.lte) {
    if (!row.nextAttemptAt) return false;
    if (new Date(row.nextAttemptAt) > new Date(where.nextAttemptAt.lte)) return false;
  }
  if (where.attempts?.lt !== undefined && !(Number(row.attempts) < where.attempts.lt)) return false;
  if (where.claimedAt && "lt" in where.claimedAt) {
    if (!row.claimedAt || new Date(row.claimedAt) >= new Date(where.claimedAt.lt)) return false;
  } else if (where.claimedAt instanceof Date) {
    if (Number(new Date(row.claimedAt)) !== Number(where.claimedAt)) return false;
  }
  return true;
}

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      row[key] = Number(row[key] || 0) + Number(value.increment);
    } else {
      row[key] = value;
    }
  }
}

function fakeDb() {
  const outbox = new Map();
  let seq = 0;
  return {
    outbox,
    paymentEmailOutbox: {
      async create({ data }) {
        if ([...outbox.values()].some(row => row.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const row = {
          id: `o${++seq}`,
          attempts: 0,
          claimedAt: null,
          sentAt: null,
          lastErrorCode: null,
          createdAt: NOW,
          ...data
        };
        outbox.set(row.id, row);
        return { ...row };
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const row of outbox.values()) {
          if (!matchRow(row, where)) continue;
          applyData(row, data);
          count += 1;
        }
        return { count };
      },
      async findMany({ where, take, select }) {
        const rows = [...outbox.values()]
          .filter(row => matchRow(row, where))
          .sort((a, b) => (a.id < b.id ? -1 : 1))
          .slice(0, take);
        // `select` on siin OLULINE: worker loeb lease-taastel `template` välja.
        if (!select) return rows.map(row => ({ ...row }));
        return rows.map(row =>
          Object.fromEntries(Object.keys(select).map(key => [key, row[key]]))
        );
      },
      async findUnique({ where }) {
        const row = outbox.get(where.id);
        return row ? { ...row } : null;
      }
    }
  };
}

function fakeMailer({ timeoutOnce = false } = {}) {
  const sent = [];
  let timedOut = false;
  return {
    sent,
    async sendMail(message) {
      sent.push(message);
      if (timeoutOnce && !timedOut) {
        timedOut = true;
        // SMTP ei katke — ta lihtsalt ei vasta enne timeout'i.
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { messageId: message.messageId };
    }
  };
}

async function seed(db, { template, dedupeKey }) {
  await enqueuePaymentEmail(db, {
    dedupeKey,
    template,
    toEmail: "guest@probe.invalid",
    locale: "et",
    payload: { joinToken: "tok", roomTitle: "Ruum", inviterName: "host@probe.invalid" },
    now: NOW
  });
  return [...db.outbox.values()].find(row => row.dedupeKey === dedupeKey);
}

test("sõnumitunnus sünnib koos reaga ja on püsiv", async () => {
  const db = fakeDb();
  const row = await seed(db, { template: "invite_sponsored", dedupeKey: "invite:pay_1" });
  assert.match(row.messageId, /^<[0-9a-f]{32}@sotsiaal\.ai>$/);
  assert.equal(mintOutboxMessageId("invite:pay_1"), row.messageId, "sama võti → sama tunnus");
  assert.notEqual(mintOutboxMessageId("invite:pay_2"), row.messageId);
});

test("KANDEV: korduskatse kannab SAMA sõnumitunnust", async () => {
  const db = fakeDb();
  const row = await seed(db, { template: "invite_sponsored", dedupeKey: "invite:pay_1" });
  const mailer = { sent: [], async sendMail(message) { this.sent.push(message); throw new Error("smtp down"); } };

  await runPaymentEmailDelivery({ db, now: NOW, mailer, baseUrl: "https://probe.invalid" });
  await runPaymentEmailDelivery({ db, now: LATER, mailer, baseUrl: "https://probe.invalid" });

  assert.equal(mailer.sent.length, 2, "teine katse toimus");
  assert.equal(mailer.sent[0].messageId, row.messageId);
  assert.equal(mailer.sent[1].messageId, row.messageId, "duplikaat on RFC mõttes SAMA kiri");
});

test("KANDEV: tundlik kiri ei lähe timeout'i järel pimedale kordusele", async () => {
  const db = fakeDb();
  await seed(db, { template: "sponsored_revoked", dedupeKey: "sponsored_revoked:pay_1" });
  const mailer = fakeMailer({ timeoutOnce: true });

  const first = await runPaymentEmailDelivery({
    db,
    now: NOW,
    mailer,
    timeoutMs: 5,
    baseUrl: "https://probe.invalid"
  });

  const row = [...db.outbox.values()][0];
  assert.equal(row.status, "AMBIGUOUS", "teadmatus on oma seis");
  assert.equal(row.nextAttemptAt, null, "ülevaatust ootav rida ei ajasta uut katset");
  assert.equal(row.lastErrorCode, "EMAIL_TIMEOUT");
  assert.equal(first.ambiguous, 1);
  assert.equal(first.review, 1);

  const second = await runPaymentEmailDelivery({
    db,
    now: LATER,
    mailer,
    baseUrl: "https://probe.invalid"
  });
  assert.equal(second.eligible, 0, "worker ei võta teda enam üles");
  assert.equal(mailer.sent.length, 1, "kasutaja ei saa teist maksekinnitust");
});

test("kandja-kiri korratakse teadmatuse järel — saamata link on suurem kahju", async () => {
  const db = fakeDb();
  await seed(db, { template: "invite_sponsored", dedupeKey: "invite:pay_2" });
  const mailer = fakeMailer({ timeoutOnce: true });

  const first = await runPaymentEmailDelivery({
    db,
    now: NOW,
    mailer,
    timeoutMs: 5,
    baseUrl: "https://probe.invalid"
  });
  const row = [...db.outbox.values()][0];
  assert.equal(row.status, "AMBIGUOUS");
  assert.ok(row.nextAttemptAt, "kandja-kiri saab järgmise katse");
  assert.equal(first.review, 0);

  const second = await runPaymentEmailDelivery({ db, now: LATER, mailer, baseUrl: "https://probe.invalid" });
  assert.equal(second.sent, 1);
  assert.equal(mailer.sent.length, 2);
  assert.equal(mailer.sent[0].messageId, mailer.sent[1].messageId, "sama kiri, mitte teine");
});

test("lease-taaste ei muutu pimedaks korduseks", async () => {
  const db = fakeDb();
  await seed(db, { template: "sponsored_revoked", dedupeKey: "customer:pay_3" });
  await seed(db, { template: "invite_sponsored", dedupeKey: "invite:pay_3" });
  // Mõlemad on „lennus" ja liisung on aegunud.
  for (const row of db.outbox.values()) {
    row.status = "SENDING";
    row.claimedAt = new Date(NOW.getTime() - 60 * 60 * 1000);
    row.attempts = 1;
  }

  const mailer = fakeMailer();
  const result = await runPaymentEmailDelivery({ db, now: NOW, mailer, baseUrl: "https://probe.invalid" });

  const rows = [...db.outbox.values()];
  const sensitive = rows.find(row => row.template === "sponsored_revoked");
  const carrier = rows.find(row => row.template === "invite_sponsored");

  assert.equal(sensitive.status, "AMBIGUOUS");
  assert.equal(sensitive.nextAttemptAt, null, "tundlik kiri ootab inimest");
  assert.equal(carrier.status !== "SENDING", true, "kandja-kiri liikus edasi");
  assert.equal(result.ambiguous, 2);
  assert.equal(result.review, 1);
  assert.equal(
    mailer.sent.every(message => Boolean(message.messageId)),
    true,
    "ükski katse ei lähe välja ilma püsiva tunnuseta"
  );
});

test("tavaline tõrge (mitte timeout) käitub nagu enne", async () => {
  const db = fakeDb();
  await seed(db, { template: "sponsored_revoked", dedupeKey: "customer:pay_4" });
  const mailer = { sent: [], async sendMail(message) { this.sent.push(message); throw new Error("smtp down"); } };

  const result = await runPaymentEmailDelivery({ db, now: NOW, mailer, baseUrl: "https://probe.invalid" });
  const row = [...db.outbox.values()][0];
  assert.equal(row.status, "RETRY", "selge tõrge EI ole teadmatus");
  assert.equal(result.retried, 1);
  assert.equal(result.ambiguous, 0);
});

test("kandja- ja uudisekirjade vahe on kirjas ühes kohas", () => {
  assert.equal(isAmbiguousRetrySafe("invite_sponsored"), true);
  assert.equal(isAmbiguousRetrySafe("invite_create"), true);
  assert.equal(isAmbiguousRetrySafe("invite_resend"), true);
  assert.equal(isAmbiguousRetrySafe("owner_webhook"), true);
  assert.equal(isAmbiguousRetrySafe("customer_confirmation"), false);
  assert.equal(isAmbiguousRetrySafe("sponsored_revoked"), false);
  assert.equal(isAmbiguousRetrySafe(undefined), false, "tundmatu mall on vaikimisi tundlik");
});

test("worker ei saada kunagi ilma sõnumitunnuseta", () => {
  const source = readFileSync(new URL("../../lib/payments/emailOutbox.js", import.meta.url), "utf8");
  assert.match(source, /messageId\s*$/m);
  assert.match(source, /transport\.sendMail\(\{[\s\S]*?messageId[\s\S]*?\}\)/);
  assert.match(source, /status: ambiguous \? "AMBIGUOUS"/);
});

test("FIELD turvakiri kasutab sama püsivat Message-ID-d ja ei lähe timeout'i järel pimedale kordusele", async () => {
  const db = fakeDb();
  await enqueuePaymentEmail(db, {
    dedupeKey: "field-safety:visit-1:resolved",
    template: "field_safety_resolved",
    toEmail: "trusted@probe.invalid",
    locale: "et",
    payload: { visitId: "visit-1", subject: "Lahenenud", text: "Olukord on lahenenud." },
    now: NOW
  });
  const mailer = fakeMailer({ timeoutOnce: true });
  await runPaymentEmailDelivery({ db, now: NOW, mailer, timeoutMs: 5, baseUrl: "https://probe.invalid" });
  const row = [...db.outbox.values()][0];
  assert.equal(row.status, "AMBIGUOUS");
  assert.equal(row.nextAttemptAt, null);
  assert.equal(mailer.sent[0].subject, "Lahenenud");
  assert.equal(mailer.sent[0].text, "Olukord on lahenenud.");
  await runPaymentEmailDelivery({ db, now: LATER, mailer, baseUrl: "https://probe.invalid" });
  assert.equal(mailer.sent.length, 1);
});
