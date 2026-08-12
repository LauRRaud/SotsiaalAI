import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { runNotificationDelivery } from "../../lib/notificationDelivery.js";

const NOW = new Date("2026-07-14T12:00:00.000Z");

/* SOL-NOTIF-01: worker ei andnud `sendMail`-ile `from` välja üldse ja päris
   transport katkestab tema puudumisel — fake-mailer võttis suvalise objekti
   vastu ega näinud sellest midagi. Saatja tuleb nüüd konfiguratsioonist, seega
   ta peab siin olemas olema; puuduva saatja rada on eraldi testis. */
process.env.EMAIL_FROM = "notifications@sotsiaal.ai";

function deliveryDb({ emailEnabled = true, attempts = 0 } = {}) {
  const event = {
    id: "event-1", userId: "user-1", type: "NEXT_CONTACT_DUE",
    emailPolicy: "OPTIONAL", emailStatus: "PENDING", emailAttempts: attempts,
    emailNextAttemptAt: new Date("2026-07-14T11:00:00.000Z"), emailClaimedAt: null,
    emailMessageId: "notification.stable@sotsiaal.ai",
    user: { id: "user-1", email: "person@example.test", notificationEmailEnabled: emailEnabled }
  };
  const client = {
    notificationEvent: {
      async findMany({ where }) {
        if (!["PENDING", "RETRY"].includes(event.emailStatus)) return [];
        if (event.emailAttempts >= where.emailAttempts.lt) return [];
        return [{ id: event.id }];
      },
      async findUnique({ where }) {
        return where.id === event.id ? structuredClone(event) : null;
      },
      async updateMany({ where, data }) {
        if (where.emailStatus === "SENDING" && event.emailStatus === "SENDING" && where.emailClaimedAt?.getTime() === event.emailClaimedAt?.getTime()) {
          Object.assign(event, structuredClone(data));
          return { count: 1 };
        }
        if (where.emailStatus?.in && where.emailStatus.in.includes(event.emailStatus)) {
          event.emailStatus = data.emailStatus;
          event.emailClaimedAt = data.emailClaimedAt;
          event.emailAttempts += Number(data.emailAttempts?.increment || 0);
          event.emailLastErrorCode = data.emailLastErrorCode;
          return { count: 1 };
        }
        return { count: 0 };
      }
    },
    frameworkAcceptance: {
      async findFirst() { return { locale: "en" }; }
    }
  };
  return { client, event };
}

test("parallel delivery workers claim once and reuse the stable Message-ID", async () => {
  const db = deliveryDb();
  const sent = [];
  const mailer = { async sendMail(message) { sent.push(message); } };
  const [first, second] = await Promise.all([
    runNotificationDelivery({ db: db.client, now: NOW, mailer, baseUrl: "https://sotsiaal.ai" }),
    runNotificationDelivery({ db: db.client, now: NOW, mailer, baseUrl: "https://sotsiaal.ai" })
  ]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].messageId, "notification.stable@sotsiaal.ai");
  assert.equal(db.event.emailStatus, "SENT");
  assert.equal(first.sent + second.sent, 1);
  assert.doesNotMatch(sent[0].text, /person@example|inquiry text|room message/iu);
  // SOL-NOTIF-01: KANDEV — envelope-saatja on olemas, muidu päris transport katkeb.
  assert.equal(sent[0].from, "notifications@sotsiaal.ai");
});

/* Päris `getMailer()` annab seadistamata keskkonnas „transport is not configured"
   ja katkeb ENNE saatja kontrolli — seega ta ei tõendaks siin midagi. Kasutame
   kriteeriumi teist haru: RANGE transport, mis nõuab envelope-saatjat täpselt
   nagu `lib/mailer.js`, ja lisaks väide, et see nõue seal päriselt on. */
function strictTransport(sent = []) {
  return {
    sent,
    async sendMail(message) {
      const from = String(message?.from || "").trim();
      const address = from.includes("<") ? from.slice(from.indexOf("<") + 1, from.indexOf(">")) : from;
      if (!address.includes("@")) {
        throw new Error("EMAIL_FROM peab sisaldama kehtivat aadressi.");
      }
      sent.push(message);
      return { messageId: message.messageId };
    }
  };
}

test("SOL-NOTIF-01: range transport saab worker'ilt saatja ja saatmine õnnestub", async () => {
  const db = deliveryDb();
  const sent = [];
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, baseUrl: "https://sotsiaal.ai", mailer: strictTransport(sent)
  });
  assert.equal(result.sent, 1, "vana kuju kukkus siin envelope-saatja puudumise tõttu");
  assert.equal(sent[0].from, "notifications@sotsiaal.ai");
  assert.equal(db.event.emailStatus, "SENT");
});

test("SOL-NOTIF-01: nõue elab päris transpordis ja saatja tuleb ühest kohast", async () => {
  const mailerSource = await readFile(new URL("../../lib/mailer.js", import.meta.url), "utf8");
  assert.match(mailerSource, /EMAIL_FROM peab sisaldama kehtivat aadressi/);
  assert.match(mailerSource, /export function resolveMailFrom/);

  const deliverySource = await readFile(new URL("../../lib/notificationDelivery.js", import.meta.url), "utf8");
  assert.match(deliverySource, /resolveMailFrom\(\)/);
  assert.match(deliverySource, /transport\.sendMail\(\{[\s\S]*?from,/);
});

test("SOL-NOTIF-01: puuduv saatja ei jää lõputusse korduskatsesse", async () => {
  const previous = process.env.EMAIL_FROM;
  const previousSmtp = process.env.SMTP_FROM;
  process.env.EMAIL_FROM = "";
  process.env.SMTP_FROM = "";
  try {
    const db = deliveryDb();
    let sends = 0;
    const result = await runNotificationDelivery({
      db: db.client, now: NOW, baseUrl: "https://sotsiaal.ai",
      mailer: { async sendMail() { sends += 1; } }
    });
    assert.equal(sends, 0);
    assert.equal(result.skippedSender, 1);
    assert.equal(db.event.emailStatus, "SKIPPED_NO_RECIPIENT");
    assert.equal(db.event.emailLastErrorCode, "EMAIL_FROM_MISSING");
    assert.equal(db.event.emailNextAttemptAt, null, "konfiguratsioonivea kordamine ei aita kedagi");
  } finally {
    process.env.EMAIL_FROM = previous;
    process.env.SMTP_FROM = previousSmtp;
  }
});

test("a fresh opt-out skips optional mail after claim", async () => {
  const db = deliveryDb({ emailEnabled: false });
  let sends = 0;
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, baseUrl: "https://sotsiaal.ai",
    mailer: { async sendMail() { sends += 1; } }
  });
  assert.equal(sends, 0);
  assert.equal(result.skippedPreference, 1);
  assert.equal(db.event.emailStatus, "SKIPPED_PREFERENCE");
});

/* SOL-NOTIF-05: vana test lukustas just selle vea — timeout märgiti `RETRY`-ks,
   kuigi `withTimeout` ei katkesta SMTP tööd ja kiri võis kohale jõuda. SAMA
   teadmatus läks lease-taastel `UNKNOWN`-i; üks ebamäärane tulemus ei tohi kahte
   eri asja tähendada. */
test("SOL-NOTIF-05: timeout on TEADMATUS, mitte korduskatse", async () => {
  const db = deliveryDb();
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, timeoutMs: 5, baseUrl: "https://sotsiaal.ai",
    mailer: { sendMail() { return new Promise(() => {}); } }
  });
  assert.equal(result.ambiguous, 1);
  assert.equal(result.retried, 0, "pimedat kordust ei toimu");
  assert.equal(db.event.emailStatus, "UNKNOWN");
  assert.equal(db.event.emailLastErrorCode, "EMAIL_TIMEOUT");
  assert.equal(db.event.emailNextAttemptAt, null, "uut katset ei ajastata");
});

test("SOL-NOTIF-05: selge SMTP-tõrge käitub endiselt korduskatsena", async () => {
  const db = deliveryDb();
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, baseUrl: "https://sotsiaal.ai",
    mailer: { async sendMail() { throw Object.assign(new Error("smtp down"), { code: "ESOCKET" }); } }
  });
  assert.equal(result.retried, 1);
  assert.equal(result.ambiguous, 0);
  assert.equal(db.event.emailStatus, "RETRY");
  assert.ok(db.event.emailNextAttemptAt > NOW);
});

test("dry-run changes nothing and sends nothing", async () => {
  const db = deliveryDb();
  const before = structuredClone(db.event);
  let sends = 0;
  const result = await runNotificationDelivery({
    db: db.client, now: NOW, dryRun: true,
    mailer: { async sendMail() { sends += 1; } }
  });
  assert.equal(result.eligible, 1);
  assert.equal(sends, 0);
  assert.deepEqual(db.event, before);
});

test("job route is fail-closed, timing-safe, bounded, and returns counters only", async () => {
  const route = await readFile(new URL("../../app/api/jobs/notifications/route.js", import.meta.url), "utf8");
  assert.match(route, /if \(!key\) return false/u);
  assert.match(route, /timingSafeEqual/u);
  assert.match(route, /Math\.min\([^\n]+100/u);
  assert.doesNotMatch(route, /emailMessageId|inviteeEmail|selectedRecipientEmail/u);
});
