#!/usr/bin/env node
/**
 * SOL-PAY-02 sond — PÄRIS PostgreSQL, PÄRIS marsruudid, PÄRIS HTTP-provider.
 *
 * MIDA SIIN TÕENDATAKSE. Leiu kandev väide ei ole „klassifikaator tagastab õige
 * stringi" (seda mõõdab `npm test`), vaid see, et **ebamääraselt lõppenud kutse
 * järel jõuab hilisem PAID webhook ikka veel õiguse anda** ja et vahepeal EI
 * tehta teist laadimist. Seda saab mõõta ainult päris jadana: marsruut → provider
 * → andmebaas → webhook → andmebaas.
 *
 * VEASÜST ON PÄRIS. Provider on siin päris HTTP-server, mille vastust sond
 * juhib:
 *   · transaction-create 500 → ebamäärane (tema enda tõrge ei ütle tulemust);
 *   · charge'i peal ühendus katkeb → ebamäärane (vastust ei tulnud);
 *   · charge õnnestub, aga JÄRGMINE andmebaasikirjutus kukub → ebamäärane.
 *     See ei ole kunstlik erind: provider tagastab viite, mis põrkab olemasoleva
 *     rea unikaalsuse vastu, ja `payment.update` kukub päris `P2002`-ga;
 *   · transaction-create 402 → providerilt KINNITATUD eitus, terminaalne.
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: makse märgitakse `FAILED`-iks
 * (nagu tegi iga vana `catch`) ja seejärel saadetakse SAMA PAID webhook. Vastus
 * on 200 „ignored" ja tellimus ei liigu — raha on võetud, õigust ei ole.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";
import http from "node:http";

// ---------------------------------------------------------------------------
// Enne ühtegi importi: marsruudid loevad need väärtused mooduli laadimisel.
// ---------------------------------------------------------------------------
const SECRET = "sol-pay-02-probe-secret";
const JOB_KEY = "sol-pay-02-probe-job-key";

const provider = {
  mode: "ok",
  transactionCalls: 0,
  chargeCalls: 0,
  collisionReference: null
};

const server = http.createServer((req, res) => {
  const isCharge = /\/payments$/.test(req.url || "");
  const chunks = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    if (isCharge) provider.chargeCalls += 1;
    else provider.transactionCalls += 1;

    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };

    if (!isCharge) {
      if (provider.mode === "transaction_500") return send(500, { message: "provider is having a bad day" });
      if (provider.mode === "transaction_402") return send(402, { message: "card declined" });
      return send(200, { id: `trx_${provider.transactionCalls}`, reference: null });
    }

    if (provider.mode === "charge_drop") {
      // Vastust ei tule KUNAGI: ühendus katkeb keset laadimist.
      res.socket?.destroy();
      return undefined;
    }
    if (provider.mode === "charge_collision") {
      // Provider vastab edukalt, aga viide põrkab olemasoleva reaga → meie enda
      // `payment.update` kukub PÄRAST seda, kui raha võis juba liikuda.
      return send(200, { reference: provider.collisionReference });
    }
    return send(200, { status: "PENDING" });
  });
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const providerBase = `http://127.0.0.1:${server.address().port}`;

process.env.MAKSEKESKUS_API_BASE = providerBase;
process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-02-shop";
process.env.MAKSEKESKUS_PUBLIC_KEY = "sol-pay-02-public";
process.env.MAKSEKESKUS_WEBHOOK_URL = "https://probe.invalid/api/subscription/webhook";
process.env.MAKSEKESKUS_TIMEOUT_MS = "4000";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_RENEWAL_JOB_KEY = JOB_KEY;
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.PAYMENT_TOKEN_ENC_KEY = crypto.randomBytes(32).toString("hex");
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";

const { prisma } = await import("../lib/prisma.js");
const { encryptRecurringToken } = await import("../lib/payments/tokenCrypto.js");
const { getDueRecurringSubscriptionWhere, buildRecurringPaymentReference } = await import(
  "../lib/payments/recurring.js"
);
const { POST: renewalPOST } = await import("../app/api/jobs/subscription-renewals/route.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], subscriptionIds: [], billingMethodIds: [] };

/** Päris worker-jooks: sama marsruut, mille systemd-taimer kutsub. */
async function runRenewalJob() {
  const response = await renewalPOST(
    new Request("https://probe.invalid/api/jobs/subscription-renewals", {
      method: "POST",
      headers: { "x-subscription-renewal-key": JOB_KEY }
    })
  );
  return { status: response.status, body: await response.json() };
}

/** Päris allkirjastatud webhook — sama MAC, mida provider arvutab. */
async function sendWebhook(providerPaymentId, status) {
  const json = JSON.stringify({
    message_type: "payment_return",
    reference: providerPaymentId,
    status,
    amount: "9.90",
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

async function isSelectable(subscriptionId) {
  const found = await prisma.subscription.findFirst({
    where: { id: subscriptionId, ...getDueRecurringSubscriptionWhere(new Date()) },
    select: { id: true }
  });
  return Boolean(found);
}

async function setCycle(subscriptionId, nextBilling, patch = {}) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: { nextBilling, ...patch }
  });
}

async function paymentsOf(subscriptionId) {
  return prisma.payment.findMany({
    where: { subscriptionId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      providerPaymentId: true,
      attemptNumber: true,
      paidAt: true,
      raw: true
    }
  });
}

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);

  try {
    const planDefinition = await prisma.planDefinition.findFirst({ select: { id: true, key: true } });
    check("eeltingimus: andmebaasis on vähemalt üks pakett", Boolean(planDefinition));
    if (!planDefinition) throw new Error("PlanDefinition puudub");

    const user = await prisma.user.create({
      data: { email: `sol-pay-02-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(user.id);

    const encrypted = encryptRecurringToken("probe-recurring-token");
    const method = await prisma.billingMethod.create({
      data: {
        userId: user.id,
        provider: "MAKSEKESKUS",
        status: "ACTIVE",
        label: "probe",
        providerTokenCipher: encrypted.cipher,
        providerTokenKeyId: encrypted.keyId,
        activatedAt: new Date()
      }
    });
    created.billingMethodIds.push(method.id);

    const firstCycle = new Date(Date.now() - 3 * 86_400_000);
    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        plan: planDefinition.key || "probe",
        planDefinitionId: planDefinition.id,
        billingMode: "RECURRING",
        billingInterval: "MONTHLY",
        billingMethodId: method.id,
        validUntil: firstCycle,
        nextBilling: firstCycle,
        billingRetryCount: 0,
        cancelAtPeriodEnd: false
      }
    });
    created.subscriptionIds.push(subscription.id);

    check("algseis: tähtaeg käes → tellimus on valikus", await isSelectable(subscription.id));

    // -------------------------------------------------------------------
    // 1. VEASÜST: provideri 500 transaction-create'i peal.
    // -------------------------------------------------------------------
    provider.mode = "transaction_500";
    const runA = await runRenewalJob();
    const afterA = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const paymentsA = await paymentsOf(subscription.id);
    const ambiguous = paymentsA.find(row => row.status === "RECONCILE_PENDING");

    check("1. ebamäärane tulemus: makse EI ole FAILED", Boolean(ambiguous),
      paymentsA.map(row => row.status).join(",") || "ridu ei ole");
    check("1. marsruut ütleb tulemuse välja", runA.body?.results?.[0]?.action === "reconcile_pending",
      String(runA.body?.results?.[0]?.action));
    check("1. tellimuse seis EI muutu", afterA.status === "ACTIVE", afterA.status);
    check("1. katsete loendur EI liigu", afterA.billingRetryCount === 0, `${afterA.billingRetryCount}`);
    check("1. maksemeetodit ei märgita katkiseks",
      (await prisma.billingMethod.findUnique({ where: { id: method.id } })).status === "ACTIVE");

    // -------------------------------------------------------------------
    // 2. KANDEV: teadmata tulemusega katset EI korrata.
    // -------------------------------------------------------------------
    check("2. lahendamata katsega tellimus ei ole enam valikus",
      (await isSelectable(subscription.id)) === false);

    const transactionCallsBefore = provider.transactionCalls;
    const runB = await runRenewalJob();
    check("2. KANDEV: järgmine jooks ei laadi teist korda",
      provider.transactionCalls === transactionCallsBefore,
      `providerikutseid ${provider.transactionCalls - transactionCallsBefore}`);
    check("2. peatus on nähtav, mitte vaikne", Number(runB.body?.unresolvedBlocked || 0) >= 1,
      `unresolvedBlocked=${runB.body?.unresolvedBlocked}`);
    check("2. makseridu ei tekkinud juurde", (await paymentsOf(subscription.id)).length === paymentsA.length);

    // -------------------------------------------------------------------
    // 3. KANDEV: hilisem PAID webhook annab õiguse ikka veel.
    // -------------------------------------------------------------------
    const validUntilBefore = afterA.validUntil;
    const webhook = await sendWebhook(ambiguous.providerPaymentId, "PAID");
    const afterPaid = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const paymentsPaid = await paymentsOf(subscription.id);

    check("3. webhook võtab makse vastu", webhook.body?.updated === true && webhook.body?.status === "PAID",
      JSON.stringify({ updated: webhook.body?.updated, status: webhook.body?.status }));
    check("3. KANDEV: ÜKS makse", paymentsPaid.length === 1, `ridu ${paymentsPaid.length}`);
    check("3. KANDEV: ÜKS õigus — periood pikeneb täpselt korra",
      afterPaid.validUntil && new Date(afterPaid.validUntil) > new Date(validUntilBefore),
      `${validUntilBefore?.toISOString?.()} → ${afterPaid.validUntil?.toISOString?.()}`);
    check("3. tellimus on aktiivne ja loendur nullis",
      afterPaid.status === "ACTIVE" && afterPaid.billingRetryCount === 0,
      `${afterPaid.status}/${afterPaid.billingRetryCount}`);
    check("3. lahendatud katse ei blokeeri enam valikut",
      (await prisma.payment.count({
        where: { subscriptionId: subscription.id, status: "RECONCILE_PENDING" }
      })) === 0);

    // -------------------------------------------------------------------
    // 4. NEGATIIVKONTROLL: vana kuju (terminaalne FAILED) sama webhooki peal.
    // -------------------------------------------------------------------
    const oldShapeCycle = new Date(Date.now() - 2 * 86_400_000);
    await setCycle(subscription.id, oldShapeCycle, {
      status: "ACTIVE",
      billingRetryCount: 0,
      validUntil: oldShapeCycle
    });
    const oldShapeReference = buildRecurringPaymentReference(subscription.id, {
      nextBilling: oldShapeCycle,
      attemptNumber: 99
    });
    const oldShapePayment = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: user.id,
        provider: "MAKSEKESKUS",
        kind: "SUBSCRIPTION_RENEWAL",
        billingMethodId: method.id,
        providerPaymentId: oldShapeReference,
        amount: "9.90",
        currency: "EUR",
        // Täpselt see, mida vana `catch` kirjutas iga erandi peale.
        status: "FAILED",
        failedAt: new Date(),
        attemptNumber: 99,
        raw: { flow: "subscription_renewal_job", error: "timeout" }
      },
      select: { id: true, providerPaymentId: true }
    });
    const beforeOldShape = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const oldShapeWebhook = await sendWebhook(oldShapePayment.providerPaymentId, "PAID");
    const afterOldShape = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const oldShapeRow = await prisma.payment.findUnique({ where: { id: oldShapePayment.id } });

    check("4. NEGATIIVKONTROLL: vana kuju peal webhook EI anna õigust",
      oldShapeWebhook.body?.ignored === true && oldShapeRow.status === "FAILED",
      JSON.stringify({ ignored: oldShapeWebhook.body?.ignored, status: oldShapeRow.status }));
    check("4. NEGATIIVKONTROLL: vana kuju peal periood ei liigu",
      String(afterOldShape.validUntil) === String(beforeOldShape.validUntil),
      "makstud raha, ligipääsu ei ole");

    // -------------------------------------------------------------------
    // 5. VEASÜST: ühendus katkeb keset laadimist (vastust ei tule).
    // -------------------------------------------------------------------
    await prisma.payment.deleteMany({ where: { id: oldShapePayment.id } });
    const dropCycle = new Date(Date.now() - 86_400_000);
    await setCycle(subscription.id, dropCycle, { status: "ACTIVE", billingRetryCount: 0 });
    provider.mode = "charge_drop";
    const runDrop = await runRenewalJob();
    const dropPayment = (await paymentsOf(subscription.id)).find(
      row => row.status === "RECONCILE_PENDING"
    );
    check("5. katkenud ühendus keset laadimist jääb lahtiseks", Boolean(dropPayment),
      String(runDrop.body?.results?.[0]?.action));
    check("5. charge'i kutse jõudis päriselt providerini", provider.chargeCalls >= 1,
      `${provider.chargeCalls}`);
    await prisma.payment.deleteMany({ where: { subscriptionId: subscription.id, status: "RECONCILE_PENDING" } });

    // -------------------------------------------------------------------
    // 6. VEASÜST: charge õnnestub, MEIE järgmine kirjutus kukub (päris P2002).
    // -------------------------------------------------------------------
    const collisionCycle = new Date(Date.now() - 43_200_000);
    await setCycle(subscription.id, collisionCycle, { status: "ACTIVE", billingRetryCount: 0 });
    const collisionOwner = await prisma.payment.create({
      data: {
        subscriptionId: subscription.id,
        userId: user.id,
        provider: "MAKSEKESKUS",
        kind: "OTHER",
        providerPaymentId: `mk_probe_collision_${suffix}`,
        amount: "1.00",
        currency: "EUR",
        status: "PAID",
        paidAt: new Date()
      },
      select: { id: true, providerPaymentId: true }
    });
    provider.mode = "charge_collision";
    provider.collisionReference = collisionOwner.providerPaymentId;
    const runCollision = await runRenewalJob();
    const collisionPayment = (await paymentsOf(subscription.id)).find(
      row => row.status === "RECONCILE_PENDING"
    );
    const subscriptionAfterCollision = await prisma.subscription.findUnique({
      where: { id: subscription.id }
    });

    check("6. meie oma kirjutusviga PÄRAST laadimist jääb lahtiseks", Boolean(collisionPayment),
      String(runCollision.body?.results?.[0]?.action));
    check("6. rida hoiab oma algset viidet, mitte võõrast",
      collisionPayment?.providerPaymentId !== collisionOwner.providerPaymentId);
    check("6. tellimust ei märgitud tõrkeks", subscriptionAfterCollision.status === "ACTIVE",
      subscriptionAfterCollision.status);
    await prisma.payment.deleteMany({ where: { subscriptionId: subscription.id, status: "RECONCILE_PENDING" } });
    await prisma.payment.deleteMany({ where: { id: collisionOwner.id } });

    // -------------------------------------------------------------------
    // 7. NEGATIIVKONTROLL TEISES SUUNAS: kinnitatud eitus PEAB jääma lõplikuks.
    //    Ilma selleta oleks parandus lihtsalt „kõik on ebamäärane".
    // -------------------------------------------------------------------
    const declineCycle = new Date(Date.now() - 21_600_000);
    await setCycle(subscription.id, declineCycle, { status: "ACTIVE", billingRetryCount: 0 });
    provider.mode = "transaction_402";
    const runDecline = await runRenewalJob();
    const declinePayment = (await paymentsOf(subscription.id)).find(row => row.status === "FAILED");
    const afterDecline = await prisma.subscription.findUnique({ where: { id: subscription.id } });

    check("7. providerilt kinnitatud eitus on terminaalne FAILED", Boolean(declinePayment),
      String(runDecline.body?.results?.[0]?.action));
    check("7. eitus liigutab tellimuse korduskatse rajale",
      afterDecline.status === "PAST_DUE" && afterDecline.billingRetryCount === 1,
      `${afterDecline.status}/${afterDecline.billingRetryCount}`);
    check("7. järgmine katse on ajastatud TULEVIKKU",
      afterDecline.nextBilling && new Date(afterDecline.nextBilling) > new Date(),
      String(afterDecline.nextBilling));
    check("7. eitus ei blokeeri korduskatset",
      (await prisma.payment.count({
        where: { subscriptionId: subscription.id, status: "RECONCILE_PENDING" }
      })) === 0);
  } finally {
    for (const id of created.subscriptionIds) {
      const payments = await prisma.payment.findMany({ where: { subscriptionId: id }, select: { id: true } });
      if (payments.length) {
        await prisma.paymentEmailOutbox
          .deleteMany({ where: { paymentId: { in: payments.map(row => row.id) } } })
          .catch(() => null);
      }
      await prisma.payment.deleteMany({ where: { subscriptionId: id } }).catch(() => null);
      await prisma.subscription.delete({ where: { id } }).catch(() => null);
    }
    for (const id of created.userIds) {
      await prisma.payment.deleteMany({ where: { userId: id } }).catch(() => null);
    }
    for (const id of created.billingMethodIds) {
      await prisma.billingMethod.delete({ where: { id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
    server.close();
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-02 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-02 sond] katkes:", error);
  server.close();
  process.exit(1);
});
