#!/usr/bin/env node
/**
 * SOL-PAY-05 sond — PÄRIS PostgreSQL, PÄRIS webhook-marsruut, PÄRIS allkiri.
 *
 * MIDA SIIN TÕENDATAKSE. Iga sõnum siin kannab KEHTIVAT MAC-i — see ongi leiu
 * tuum: allkiri tõendab päritolu, mitte summat. Sond muudab kriteeriumi nõudel
 * **iga välja eraldi** (summa, valuuta, viide, merchant_data makse-ID) ja mõõdab
 * kaks asja: kas makse läks nähtavasse `REVIEW_REQUIRED` seisu ja kas tellimus
 * JÄI aktiveerimata.
 *
 * NEGATIIVKONTROLL on vana otsuse transkriptsioon: sama 0,01-eurose sõnumi peale
 * tehakse käsitsi see, mida vana kood tegi (`status = PAID` +
 * `activateSubscriptionFromPayment`) — ja mõõdetakse, et üks sent ostis terve
 * kuu. Ilma selleta oleks „kontroll töötab" lause ilma vastandita.
 *
 * POSITIIVKONTROLL on sama tähtis: täpselt vastav sõnum PEAB endiselt õiguse
 * andma, muidu oleks parandus lihtsalt „ei aktiveeri enam midagi".
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";

const SECRET = "sol-pay-05-probe-secret";

process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-05-shop";
process.env.MAKSEKESKUS_API_BASE = "http://127.0.0.1:9/unused";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";

const { prisma } = await import("../lib/prisma.js");
const { activateSubscriptionFromPayment } = await import("../lib/payments/subscriptionActivation.js");
const { getDueRecurringSubscriptionWhere } = await import("../lib/payments/recurring.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [] };

async function sendSigned(body) {
  const json = JSON.stringify(body);
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
      data: { email: `sol-pay-05-${suffix}@probe.invalid`, role: "CLIENT" }
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

    let counter = 0;
    /** Iga juhtum saab oma puutumata makse — muidu mõõdaks sond eelmise jälge. */
    async function freshPayment(kind = "SUBSCRIPTION_INITIAL") {
      counter += 1;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "NONE", validUntil: null, nextBilling: null, billingRetryCount: 0 }
      });
      return prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: user.id,
          provider: "MAKSEKESKUS",
          kind,
          providerPaymentId: `mk_verify_${suffix}_${counter}`,
          amount: "7.99",
          currency: "EUR",
          status: "INITIATED",
          raw: { flow: "subscription_init", locale: "et" }
        },
        select: { id: true, providerPaymentId: true, subscriptionId: true }
      });
    }

    function paidBody(payment, overrides = {}) {
      return {
        message_type: "payment_return",
        reference: payment.providerPaymentId,
        status: "PAID",
        amount: "7.99",
        currency: "EUR",
        merchant_data: JSON.stringify({
          flow: "subscription_init",
          paymentId: payment.id,
          subscriptionId: payment.subscriptionId
        }),
        ...overrides
      };
    }

    async function expectReview(label, overrides, expectedField) {
      const payment = await freshPayment();
      const response = await sendSigned(paidBody(payment, overrides));
      const row = await prisma.payment.findUnique({ where: { id: payment.id } });
      const sub = await prisma.subscription.findUnique({ where: { id: subscription.id } });

      check(`${label}: makse läheb ülevaatusesse`, row.status === "REVIEW_REQUIRED", row.status);
      check(`${label}: KANDEV — õigust EI anta`,
        sub.status !== "ACTIVE" && sub.validUntil === null,
        `${sub.status}/${sub.validUntil}`);
      check(`${label}: vastus nimetab, MIS ei klappinud`,
        response.body?.review === true && String(response.body?.mismatchedFields || "").includes(expectedField),
        `${response.body?.mismatchedFields}`);
      return { payment, row };
    }

    // -------------------------------------------------------------------
    // 1..4. IGA VÄLI ERALDI — kriteeriumi nõue.
    // -------------------------------------------------------------------
    const smaller = await expectReview("1. väiksem summa", { amount: "0.01" }, "amount");
    await expectReview("2. teine valuuta", { currency: "USD" }, "currency");
    /* Viite mittevastavus on ainus juhtum, mille jaoks sõnum peab meie rea ÜLES
       LEIDMA ja kandma ikkagi võõrast viidet: otsing käib `provider_payment_id`
       järgi, võrdlus `reference` järgi. Täpselt nii näeb välja vale
       transaction/reference sidumine. */
    const referenceCase = await freshPayment();
    const referenceResponse = await sendSigned(
      paidBody(referenceCase, {
        provider_payment_id: referenceCase.providerPaymentId,
        reference: `mk_foreign_${suffix}`
      })
    );
    const referenceRow = await prisma.payment.findUnique({ where: { id: referenceCase.id } });
    const referenceSub = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("3. võõras viide: makse läheb ülevaatusesse", referenceRow.status === "REVIEW_REQUIRED",
      referenceRow.status);
    check("3. võõras viide: KANDEV — õigust EI anta",
      referenceSub.status !== "ACTIVE" && referenceSub.validUntil === null,
      `${referenceSub.status}/${referenceSub.validUntil}`);
    check("3. võõras viide: vastus nimetab, MIS ei klappinud",
      String(referenceResponse.body?.mismatchedFields || "").includes("reference"),
      String(referenceResponse.body?.mismatchedFields));
    await expectReview(
      "4. võõras merchant_data makse-ID",
      { merchant_data: JSON.stringify({ flow: "subscription_init", paymentId: `pay_${suffix}` }) },
      "merchantData.paymentId"
    );

    // -------------------------------------------------------------------
    // 5. Ülevaatust ootav makse on NÄHTAV ja hoiab kordusmakset kinni.
    // -------------------------------------------------------------------
    const ownerMail = await prisma.paymentEmailOutbox.findFirst({
      where: { paymentId: smaller.payment.id, template: "owner_webhook" },
      select: { id: true, dedupeKey: true }
    });
    check("5. omanik saab ülevaatusest teate", Boolean(ownerMail), String(ownerMail?.dedupeKey || ""));

    const reviewCount = await prisma.payment.count({
      where: { userId: user.id, status: "REVIEW_REQUIRED" }
    });
    check("5. admini loendur näeb neid ridu", reviewCount === 4, `${reviewCount}`);

    const method = await prisma.billingMethod.create({
      data: { userId: user.id, provider: "MAKSEKESKUS", status: "ACTIVE", activatedAt: new Date() }
    });
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        billingMethodId: method.id,
        validUntil: new Date(Date.now() - 86_400_000),
        nextBilling: new Date(Date.now() - 86_400_000),
        cancelAtPeriodEnd: false
      }
    });
    const selectable = await prisma.subscription.findFirst({
      where: { id: subscription.id, ...getDueRecurringSubscriptionWhere(new Date()) },
      select: { id: true }
    });
    check("5. KANDEV: ülevaatust ootav makse hoiab kordusmakse valikut kinni", selectable === null);

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { billingMethodId: null }
    });
    await prisma.billingMethod.delete({ where: { id: method.id } }).catch(() => null);

    // -------------------------------------------------------------------
    // 6. POSITIIVKONTROLL: täpselt vastav sõnum annab õiguse edasi.
    // -------------------------------------------------------------------
    const goodPayment = await freshPayment();
    const goodResponse = await sendSigned(paidBody(goodPayment));
    const goodRow = await prisma.payment.findUnique({ where: { id: goodPayment.id } });
    const activated = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("6. POSITIIVKONTROLL: vastav sõnum annab endiselt kuu",
      goodRow.status === "PAID" &&
        activated.status === "ACTIVE" &&
        activated.validUntil &&
        new Date(activated.validUntil) > new Date(),
      `${goodRow.status}/${activated.status}/${activated.validUntil?.toISOString?.()}`);
    check("6. vastus ei ole ülevaatus", goodResponse.body?.review !== true);

    // -------------------------------------------------------------------
    // 7. NEGATIIVKONTROLL: vana otsus sama 0,01-eurose sõnumi peal.
    // -------------------------------------------------------------------
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "NONE", validUntil: null, nextBilling: null }
    });
    const beforeOldShape = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    await prisma.$transaction(async (tx) => {
      // Täpselt see, mida vana kood tegi: staatus mapiti ja õigus anti, ilma et
      // keegi oleks summat vaadanud.
      const updated = await tx.payment.update({
        where: { id: smaller.payment.id },
        data: { status: "PAID", paidAt: new Date(), amount: "0.01" },
        select: { id: true, userId: true, subscriptionId: true, paidAt: true }
      });
      await activateSubscriptionFromPayment(tx, updated);
    });
    const afterOldShape = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("7. NEGATIIVKONTROLL: vana otsus andis 0,01 € eest terve kuu",
      beforeOldShape.status !== "ACTIVE" &&
        afterOldShape.status === "ACTIVE" &&
        new Date(afterOldShape.validUntil) > new Date(),
      `${beforeOldShape.status} → ${afterOldShape.status}`);
  } finally {
    for (const id of created.userIds) {
      const payments = await prisma.payment.findMany({ where: { userId: id }, select: { id: true } });
      if (payments.length) {
        await prisma.paymentEmailOutbox
          .deleteMany({ where: { paymentId: { in: payments.map(row => row.id) } } })
          .catch(() => null);
      }
      await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.subscription.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.billingMethod.deleteMany({ where: { userId: id } }).catch(() => null);
      await prisma.dataAuditLog.deleteMany({ where: { targetUserId: id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-05 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-05 sond] katkes:", error);
  process.exit(1);
});
