import assert from "node:assert/strict";
import test from "node:test";

import {
  INVITE_EMAIL_DELIVERY,
  deliverInviteEmail,
  inviteEmailDedupeKey
} from "../../lib/invites/inviteEmailDelivery.js";

/* SOL-INV-03 — KUTSE-KIRJA TULEMUS ÖELDAKSE VÄLJA.

   Vana kood lõi kutse, püüdis mailer'i vea kinni AINULT logiga ja vastas
   „loodud"; toortoken eemaldati vastusest, seega kasutaja ei saanud linki isegi
   käsitsi edasi saata. Need testid süstivad mailer'i vea ja mõõdavad kaht asja:
   mida vastus ÜTLEB ja mis jääb järjekorda alles. */

const RAW_TOKEN = "raw-join-token-do-not-log";
const TOKEN_HASH = "hashvalue0123456789abcdefghijklmnop";

function makeDb() {
  const rows = [];
  return {
    rows,
    paymentEmailOutbox: {
      create: async ({ data }) => {
        if (rows.some(row => row.dedupeKey === data.dedupeKey)) {
          throw Object.assign(new Error("duplicate"), { code: "P2002" });
        }
        const row = { id: `out_${rows.length + 1}`, ...data };
        rows.push(row);
        return row;
      },
      updateMany: async ({ where, data }) => {
        const matches = rows.filter(
          row => row.dedupeKey === where.dedupeKey
            && (where.status == null || row.status === where.status)
        );
        matches.forEach(row => Object.assign(row, data));
        return { count: matches.length };
      }
    }
  };
}

function stubMailer({ fail = false } = {}) {
  const sent = [];
  return {
    sent,
    sendMail: async (message) => {
      if (fail) throw Object.assign(new Error("smtp down"), { code: "ESOCKET" });
      sent.push(message);
      return { messageId: "1" };
    }
  };
}

const BASE = {
  kind: "create",
  inviteId: "inv_1",
  toEmail: "guest@example.test",
  tokenRaw: RAW_TOKEN,
  tokenHash: TOKEN_HASH,
  roomTitle: "Ruum",
  inviterName: "host@example.test",
  locale: "et",
  baseUrl: "https://app.test"
};

test.before(() => {
  process.env.EMAIL_FROM = "no-reply@example.test";
});

test("SOL-INV-03: õnnestunud saatmine annab `sent` ja võtab rea workeri käest ära", async () => {
  const db = makeDb();
  const mailer = stubMailer();

  const result = await deliverInviteEmail({ db, mailer, ...BASE });

  assert.equal(result, INVITE_EMAIL_DELIVERY.SENT);
  assert.equal(db.rows.length, 1, "püsiv delivery olek tekib ka õnnestumisel");
  assert.equal(db.rows[0].status, "SENT", "worker ei saada kolme minuti pärast teist kirja");
  assert.equal(mailer.sent.length, 1);
  assert.equal(mailer.sent[0].to, "guest@example.test");
  assert.match(mailer.sent[0].text, /join\?token=/, "kiri kannab liitumislinki");
});

test("SOL-INV-03: mailer'i viga annab `queued`, mitte vaikset edu", async () => {
  const db = makeDb();
  const mailer = stubMailer({ fail: true });

  const result = await deliverInviteEmail({ db, mailer, ...BASE });

  assert.equal(result, INVITE_EMAIL_DELIVERY.QUEUED);
  assert.equal(db.rows[0].status, "PENDING", "rida jääb järjekorda, worker proovib uuesti");
  assert.equal(db.rows[0].lastErrorCode, "ESOCKET");
  assert.equal(db.rows[0].inviteId, "inv_1", "delivery olek on kutse küljes");
});

test("SOL-INV-03: järjekorda panemata ja saatmata kiri on `failed`, mitte `queued`", async () => {
  const db = makeDb();
  db.paymentEmailOutbox.create = async () => {
    throw new Error("db down");
  };

  const result = await deliverInviteEmail({ db, mailer: stubMailer({ fail: true }), ...BASE });

  assert.equal(result, INVITE_EMAIL_DELIVERY.FAILED);
});

test("SOL-INV-03: sama võti ei saada teist kirja (idempotentsus)", async () => {
  const db = makeDb();
  const mailer = stubMailer();

  const first = await deliverInviteEmail({ db, mailer, ...BASE });
  const second = await deliverInviteEmail({ db, mailer, ...BASE });

  assert.equal(first, INVITE_EMAIL_DELIVERY.SENT);
  assert.equal(second, INVITE_EMAIL_DELIVERY.QUEUED, "kordus ei saada kohe — worker võis juba saata");
  assert.equal(mailer.sent.length, 1, "täpselt üks kiri");
  assert.equal(db.rows.length, 1, "täpselt üks järjekorrarida");
});

test("SOL-INV-03: kordussaatmine kasutab sama kutset ja oma malli", async () => {
  const db = makeDb();
  const mailer = stubMailer();

  const result = await deliverInviteEmail({
    db,
    mailer,
    ...BASE,
    kind: "resend",
    tokenHash: "rotated0123456789abcdefghijklmnop"
  });

  assert.equal(result, INVITE_EMAIL_DELIVERY.SENT);
  assert.equal(db.rows[0].template, "invite_resend");
  assert.equal(db.rows[0].inviteId, "inv_1", "sama kutse, mitte uus");
});

test("SOL-INV-03: dedupe-võti kannab tokeni RÄSI, mitte toortokenit", () => {
  const key = inviteEmailDedupeKey({ kind: "create", inviteId: "inv_1", tokenHash: TOKEN_HASH });

  assert.equal(key.includes(RAW_TOKEN), false);
  assert.match(key, /^invite_create:inv_1:/);
});

test("SOL-INV-03: toortoken jõuab kirja, aga mitte järjekorra võtmesse", async () => {
  const db = makeDb();
  const mailer = stubMailer();

  await deliverInviteEmail({ db, mailer, ...BASE });

  assert.equal(db.rows[0].dedupeKey.includes(RAW_TOKEN), false);
  assert.match(mailer.sent[0].text, new RegExp(RAW_TOKEN));
});

test("SOL-INV-03: puuduv EMAIL_FROM ei ole `sent`", async () => {
  const previous = process.env.EMAIL_FROM;
  delete process.env.EMAIL_FROM;
  const previousSmtp = process.env.SMTP_FROM;
  delete process.env.SMTP_FROM;
  try {
    const db = makeDb();
    const result = await deliverInviteEmail({ db, mailer: stubMailer(), ...BASE });
    assert.equal(result, INVITE_EMAIL_DELIVERY.QUEUED);
    assert.equal(db.rows[0].status, "PENDING");
  } finally {
    process.env.EMAIL_FROM = previous;
    if (previousSmtp) process.env.SMTP_FROM = previousSmtp;
  }
});
