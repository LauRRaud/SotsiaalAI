#!/usr/bin/env node
/**
 * SOL-PAY-10 sond — PÄRIS PostgreSQL, PÄRIS marsruudid, deterministlik võistlus.
 *
 * MIDA SIIN TÕENDATAKSE. Kriteerium nõuab võistlust `token_return` callback'i ja
 * PAID webhooki vahel ning tõendust, et alles jääb ÜKS aktiivne rida ja ÜKS
 * krüptitud token. Sond loeb täpselt neid kahte numbrit päris andmebaasist.
 *
 * VÕISTLUS ON DETERMINISTLIK (`scripts/probe-race-harness.mjs`): kolmas tehing
 * hoiab sama kasutajapõhist nõuandelukku, mõlemad võistlejad käivitatakse ja
 * MÕÕDETAKSE, et nad ootavad, alles siis lastakse lukk lahti.
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: kaks rada kirjutavad mandaadi
 * ilma jagatud lukuta ja ilma unikaalsuseta — andmebaas võtab MÕLEMAD read vastu
 * (nüüd tõrjub unikaalsus teise, seega negatiivkontroll mõõdab piiret ennast).
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";

const SECRET = "sol-pay-10-probe-secret";

process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-10-shop";
process.env.MAKSEKESKUS_API_BASE = "http://127.0.0.1:9/unused";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";
process.env.PAYMENT_TOKEN_ENC_KEY = crypto.randomBytes(32).toString("hex");

const { prisma } = await import("../lib/prisma.js");
const { raceOnLockedRow } = await import("./probe-race-harness.mjs");
const { BILLING_METHOD_LOCK_NAMESPACE } = await import("../lib/payments/billingMethodClaim.js");
const { readBillingMethodRecurringToken } = await import("../lib/payments/tokenCrypto.js");
const { POST: callbackPOST } = await import("../app/api/subscription/callback/route.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [] };

function signedBody(body) {
  const json = JSON.stringify(body);
  const mac = crypto.createHash("sha512").update(`${json}${SECRET}`).digest("hex").toUpperCase();
  return new URLSearchParams({ json, mac }).toString();
}

async function sendCallback(body) {
  const response = await callbackPOST(
    new Request("https://probe.invalid/api/subscription/callback", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: signedBody(body)
    })
  );
  return { status: response.status };
}

async function sendWebhook(body) {
  const response = await webhookPOST(
    new Request("https://probe.invalid/api/subscription/webhook", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: signedBody(body)
    })
  );
  return { status: response.status, body: await response.json() };
}

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const mandateId = `mandate_${suffix}`;

  try {
    const planDefinition = await prisma.planDefinition.findFirst({
      where: { role: "CLIENT", key: "client_monthly" },
      select: { id: true, key: true }
    });
    check("eeltingimus: CLIENT pakett on andmebaasis", Boolean(planDefinition));
    if (!planDefinition) throw new Error("client_monthly PlanDefinition puudub");

    const user = await prisma.user.create({
      data: { email: `sol-pay-10-${suffix}@probe.invalid`, role: "CLIENT" }
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
        providerPaymentId: `mk_mandate_${suffix}`,
        amount: "7.99",
        currency: "EUR",
        status: "INITIATED",
        raw: { flow: "subscription_init", locale: "et" }
      },
      select: { id: true, providerPaymentId: true }
    });

    const tokenPayload = {
      message_type: "token_return",
      reference: payment.providerPaymentId,
      status: "PAID",
      amount: "7.99",
      currency: "EUR",
      token: { id: `tok_${suffix}`, multiuse: true, valid_until: "2027-01-01T00:00:00Z" },
      mandate_id: mandateId,
      card: { brand: "VISA", last4: "4242" }
    };
    const webhookPayload = {
      message_type: "payment_return",
      reference: payment.providerPaymentId,
      status: "PAID",
      amount: "7.99",
      currency: "EUR",
      token: { id: `tok_${suffix}`, multiuse: true, valid_until: "2027-01-01T00:00:00Z" },
      mandate_id: mandateId
    };

    // -------------------------------------------------------------------
    // 1. VÕISTLUS: token_return callback vs PAID webhook.
    // -------------------------------------------------------------------
    const race = await raceOnLockedRow({
      prisma,
      lockRow: (tx) =>
        tx.$executeRaw`SELECT pg_advisory_xact_lock(${BILLING_METHOD_LOCK_NAMESPACE}::int4, hashtext(${user.id})::int4)`,
      first: () => sendCallback(tokenPayload),
      second: () => sendWebhook(webhookPayload),
      label: "1. callback vs webhook",
      expect: (name, condition, detail) => check(name, condition, detail)
    });

    const methods = await prisma.billingMethod.findMany({ where: { userId: user.id } });
    const activeMethods = methods.filter(row => row.status === "ACTIVE");
    const subscriptionAfter = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const paymentAfter = await prisma.payment.findUnique({ where: { id: payment.id } });

    check("1. KANDEV: alles jääb TÄPSELT ÜKS maksevahendi rida", methods.length === 1,
      `ridu ${methods.length}`);
    check("1. KANDEV: ja täpselt üks aktiivne", activeMethods.length === 1, `${activeMethods.length}`);
    check("1. mõlemad rajad said vastuse", Boolean(race.resultA.value && race.resultB.value));
    check("1. tellimus ja makse osutavad SAMALE reale",
      subscriptionAfter.billingMethodId === methods[0]?.id &&
        paymentAfter.billingMethodId === methods[0]?.id,
      `${subscriptionAfter.billingMethodId} / ${paymentAfter.billingMethodId}`);

    // -------------------------------------------------------------------
    // 2. Üks krüptitud token, mis on ka päriselt loetav.
    // -------------------------------------------------------------------
    const method = methods[0];
    check("2. KANDEV: mandaat on krüptitud, mitte plaintekstis",
      Boolean(method?.providerTokenCipher) && method?.providerToken === null);
    const readBack = readBillingMethodRecurringToken(method);
    check("2. sama token on dekrüptitav", readBack.token === `tok_${suffix}`, String(readBack.source));
    check("2. mandaadi ID on rea küljes", method.providerMandateId === mandateId,
      String(method.providerMandateId));

    // -------------------------------------------------------------------
    // 3. NEGATIIVKONTROLL: teine rida sama mandaadiga ei mahu andmebaasi.
    // -------------------------------------------------------------------
    let duplicateBlocked = false;
    try {
      await prisma.billingMethod.create({
        data: {
          userId: user.id,
          provider: "MAKSEKESKUS",
          status: "ACTIVE",
          providerMandateId: mandateId,
          providerTokenCipher: method.providerTokenCipher,
          providerTokenKeyId: method.providerTokenKeyId
        }
      });
    } catch (error) {
      duplicateBlocked = error?.code === "P2002";
    }
    check("3. NEGATIIVKONTROLL: teist rida sama mandaadiga andmebaas ei võta", duplicateBlocked);

    check("3. mandaadita read ei ole duplikaadid", await (async () => {
      const a = await prisma.billingMethod.create({
        data: { userId: user.id, provider: "MAKSEKESKUS", status: "PENDING" }
      });
      const b = await prisma.billingMethod.create({
        data: { userId: user.id, provider: "MAKSEKESKUS", status: "PENDING" }
      });
      await prisma.billingMethod.deleteMany({ where: { id: { in: [a.id, b.id] } } });
      return true;
    })());

    // -------------------------------------------------------------------
    // 4. Kordus ei tekita uut rida.
    // -------------------------------------------------------------------
    await sendCallback(tokenPayload);
    await sendWebhook(webhookPayload);
    const afterRepeat = await prisma.billingMethod.count({ where: { userId: user.id } });
    check("4. kordus ei loo uut mandaadirida", afterRepeat === 1, `ridu ${afterRepeat}`);
  } finally {
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
      await prisma.subscription.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.billingMethod.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.dataAuditLog.deleteMany({ where: { targetUserId: id } }).catch(() => null);
      await prisma.chatLog.deleteMany({ where: { userId: id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-10 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-10 sond] katkes:", error);
  process.exit(1);
});
