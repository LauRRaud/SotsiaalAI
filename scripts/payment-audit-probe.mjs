#!/usr/bin/env node
/**
 * SOL-PAY-08 sond — PÄRIS PostgreSQL, PÄRIS webhook, PÄRIS veasüst.
 *
 * MIDA SIIN TÕENDATAKSE. Kriteerium nõuab veasüstet, mis KATKESTAB auditirea
 * loomise ja tõendab kas kogu tehingu rollback'i või durable outbox'i. Seda ei
 * saa teha JS-i mock'iga: audit peab kukkuma seal, kus ta päriselt kirjutab —
 * andmebaasis. Sond paigaldab `DataAuditLog`-i peale AJUTISE trigger'i, mis
 * viskab erindi ainult selle sondi rea peale, ja mõõdab, mis makse ja tellimuse
 * seisust saab.
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: telemeetriakirje (`ChatLog`)
 * kirjutatakse GLOBAALSE kliendiga tehingu sees ja tehing pöördub tagasi — jälg
 * jääb alles ja kirjeldab muudatust, mida KUNAGI EI TOIMUNUD.
 *
 * Sond kirjutab ja koristab enda järelt (ka trigger'i). Väljumiskood 1 = leid.
 */
import crypto from "node:crypto";

const SECRET = "sol-pay-08-probe-secret";

process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-08-shop";
process.env.MAKSEKESKUS_API_BASE = "http://127.0.0.1:9/unused";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";

const { prisma } = await import("../lib/prisma.js");
const { logPaymentEvent } = await import("../lib/payments/observability.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [] };
let triggerArmed = false;

async function sendPaid(payment) {
  const json = JSON.stringify({
    message_type: "payment_return",
    reference: payment.providerPaymentId,
    status: "PAID",
    amount: "7.99",
    currency: "EUR"
  });
  const mac = crypto.createHash("sha512").update(`${json}${SECRET}`).digest("hex").toUpperCase();
  const response = await webhookPOST(
    new Request("https://probe.invalid/api/subscription/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ json, mac }).toString()
    })
  );
  return { status: response.status, body: await response.json() };
}

/** Veasüst PÄRIS andmebaasis: auditirida ei saa tekkida, punkt. */
async function armAuditTrigger(paymentId) {
  if (!/^[a-z0-9]+$/i.test(paymentId)) throw new Error("ootamatu paymentId kuju");
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sol_pay_08_probe_boom() RETURNS trigger AS $probe$
    BEGIN
      IF NEW."resourceId" = '${paymentId}' THEN
        RAISE EXCEPTION 'sol-pay-08 probe: audit write blocked';
      END IF;
      RETURN NEW;
    END;
    $probe$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER sol_pay_08_probe
    BEFORE INSERT ON "DataAuditLog"
    FOR EACH ROW EXECUTE FUNCTION sol_pay_08_probe_boom();
  `);
  triggerArmed = true;
}

async function disarmAuditTrigger() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS sol_pay_08_probe ON "DataAuditLog";`).catch(() => null);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS sol_pay_08_probe_boom();`).catch(() => null);
  triggerArmed = false;
}

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);

  try {
    const planDefinition = await prisma.planDefinition.findFirst({
      where: { role: "CLIENT", key: "client_monthly" },
      select: { id: true, key: true }
    });
    check("eeltingimus: CLIENT pakett on andmebaasis", Boolean(planDefinition));
    if (!planDefinition) throw new Error("client_monthly PlanDefinition puudub");

    const user = await prisma.user.create({
      data: { email: `sol-pay-08-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(user.id);

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        status: "NONE",
        plan: planDefinition.key,
        planDefinitionId: planDefinition.id,
        billingMode: "RECURRING",
        billingInterval: "MONTHLY"
      }
    });

    const payment = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: user.id,
        provider: "MAKSEKESKUS",
        kind: "SUBSCRIPTION_INITIAL",
        providerPaymentId: `mk_audit_${suffix}`,
        amount: "7.99",
        currency: "EUR",
        status: "INITIATED",
        raw: { flow: "subscription_init", locale: "et" }
      },
      select: { id: true, providerPaymentId: true }
    });

    // -------------------------------------------------------------------
    // 1. VEASÜST: auditirida ei saa tekkida.
    // -------------------------------------------------------------------
    await armAuditTrigger(payment.id);
    const blocked = await sendPaid(payment);
    const paymentAfterBlock = await prisma.payment.findUnique({ where: { id: payment.id } });
    const subscriptionAfterBlock = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const auditsAfterBlock = await prisma.dataAuditLog.count({ where: { resourceId: payment.id } });

    check("1. KANDEV: kirjutamata auditi korral EI jõustu ka makse",
      paymentAfterBlock.status === "INITIATED", paymentAfterBlock.status);
    check("1. KANDEV: ega õigus", subscriptionAfterBlock.status !== "ACTIVE" &&
      subscriptionAfterBlock.validUntil === null,
      `${subscriptionAfterBlock.status}/${subscriptionAfterBlock.validUntil}`);
    check("1. auditiridu ei jäänud", auditsAfterBlock === 0, `${auditsAfterBlock}`);
    check("1. webhook ei valeta edu", blocked.status === 500, `${blocked.status}`);

    // -------------------------------------------------------------------
    // 2. Trigger maha → sama sõnum jõustub tervikuna.
    // -------------------------------------------------------------------
    await disarmAuditTrigger();
    const applied = await sendPaid(payment);
    const paymentAfter = await prisma.payment.findUnique({ where: { id: payment.id } });
    const subscriptionAfter = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const audits = await prisma.dataAuditLog.findMany({ where: { resourceId: payment.id } });

    check("2. sama sõnum jõustab makse", paymentAfter.status === "PAID" && applied.status === 200,
      `${paymentAfter.status}/${applied.status}`);
    check("2. ja õiguse", subscriptionAfter.status === "ACTIVE" && Boolean(subscriptionAfter.validUntil),
      subscriptionAfter.status);
    check("2. KANDEV: otsusel on püsiv jälg", audits.length >= 1, `ridu ${audits.length}`);
    check("2. jälg nimetab teo ja tulemuse",
      audits.some(row => row.action === "payment.subscription_activate" && row.meta?.result === "active"),
      audits.map(row => row.action).join(","));
    check("2. jälg on seotud kasutajaga", audits.every(row => row.targetUserId === null || row.targetUserId === user.id));

    // -------------------------------------------------------------------
    // 3. NEGATIIVKONTROLL: vana kuju kirjutab jälje tehingust VÄLJA.
    // -------------------------------------------------------------------
    const legacyEvent = `sol_pay_08_legacy_${suffix}`;
    const legacySubscription = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    await prisma
      .$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: subscription.id },
          data: { status: "CANCELED", canceledAt: new Date() }
        });
        /* Täpselt vana muster: globaalne klient, tehingust väljas. Sond await'ib
           teda ainult selleks, et vaatlus oleks deterministlik — vana kood ei
           await'inud, mis tegi tagajärje veel juhuslikumaks. */
        await logPaymentEvent(legacyEvent, { subscriptionId: subscription.id, result: "canceled" });
        throw new Error("sol-pay-08 probe: rollback");
      })
      .catch(() => null);

    const legacyAfter = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const legacyTrace = await prisma.chatLog.count({ where: { event: legacyEvent } });

    check("3. NEGATIIVKONTROLL: vana jälg jääb alles ka siis, kui otsus pöördus tagasi",
      legacyTrace === 1 && legacyAfter.status === legacySubscription.status,
      `jälgi ${legacyTrace}, seis ${legacyAfter.status}`);
    await prisma.chatLog.deleteMany({ where: { event: legacyEvent } }).catch(() => null);
  } finally {
    if (triggerArmed) await disarmAuditTrigger();
    for (const id of created.userIds) {
      const payments = await prisma.payment.findMany({ where: { userId: id }, select: { id: true } });
      if (payments.length) {
        await prisma.dataAuditLog
          .deleteMany({ where: { resourceId: { in: payments.map(row => row.id) } } })
          .catch(() => null);
        await prisma.paymentEmailOutbox
          .deleteMany({ where: { paymentId: { in: payments.map(row => row.id) } } })
          .catch(() => null);
      }
      await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => null);
      const subscriptions = await prisma.subscription.findMany({ where: { userId: id }, select: { id: true } });
      if (subscriptions.length) {
        await prisma.dataAuditLog
          .deleteMany({ where: { resourceId: { in: subscriptions.map(row => row.id) } } })
          .catch(() => null);
      }
      await prisma.subscription.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.dataAuditLog.deleteMany({ where: { targetUserId: id } }).catch(() => null);
      await prisma.chatLog.deleteMany({ where: { userId: id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-08 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(async error => {
  console.error("[SOL-PAY-08 sond] katkes:", error);
  await disarmAuditTrigger().catch(() => null);
  process.exit(1);
});
