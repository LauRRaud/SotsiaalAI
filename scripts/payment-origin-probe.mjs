#!/usr/bin/env node
/**
 * SOL-PAY-04 sond — PÄRIS PostgreSQL, PÄRIS marsruudid.
 *
 * MIDA SIIN TÕENDATAKSE. Leiu kandev väide ei ole „väli saab õige väärtuse",
 * vaid see, mida see väli OTSUSTAB: `billingSource` on tühistamise värav ja
 * sponsori clawback'i filter. Seepärast käib sond läbi terve jada, mida
 * kriteerium nõuab — **aegunud sponsorlus → SELF checkout → PAID → cancel/refund**
 * — ja mõõdab lõpus KAKS asja: kes on maksja ja kas ta saab oma tellimuse
 * lõpetada.
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: sama rida jäetakse
 * `SPONSORED_BY_HOST` päritoluga (täpselt nii, nagu vana aktiveerimine ta jättis)
 * ja siis vajutatakse päris „lõpeta“. Vana vastus oli `ok`, aga ükski rida ei
 * liikunud — omamaksja tellimus uuenes edasi.
 *
 * Teine negatiivkontroll on sponsori tagasimakse: vana kuju all clawback'is
 * sponsori refund perioodi, mille eest maksis kasutaja ISE.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";
import http from "node:http";

const SECRET = "sol-pay-04-probe-secret";

const provider = { transactionCalls: 0 };
const server = http.createServer((req, res) => {
  provider.transactionCalls += 1;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id: `trx_${provider.transactionCalls}`, reference: null }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

process.env.MAKSEKESKUS_API_BASE = `http://127.0.0.1:${server.address().port}`;
process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-04-shop";
process.env.MAKSEKESKUS_PUBLIC_KEY = "sol-pay-04-public";
process.env.MAKSEKESKUS_IFRAME_SCRIPT_URL = "https://probe.invalid/checkout.js";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_INIT_RATE_LIMIT_MAX = "1000";
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";
process.env.NEXTAUTH_URL = "http://probe.invalid";
process.env.NEXTAUTH_SECRET = "sol-pay-04-probe-nextauth-secret";

const { prisma } = await import("../lib/prisma.js");
const { encode } = await import("next-auth/jwt");
const { POST: initPOST } = await import("../app/api/subscription/init/route.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");
const { DELETE: cancelDELETE } = await import("../app/api/subscription/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], roomIds: [], inviteIds: [] };

function bearerRequest(url, bearer, { method = "POST", body = null } = {}) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${bearer}`
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
}

/** Päris allkirjastatud webhook — payload kannab TÄPSELT seda, mida rida ootab. */
async function sendPaidWebhook(payment) {
  const json = JSON.stringify({
    message_type: "payment_return",
    reference: payment.providerPaymentId,
    status: "PAID",
    amount: String(payment.amount),
    currency: payment.currency
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

async function sendRefundWebhook(payment) {
  const json = JSON.stringify({
    message_type: "payment_return",
    reference: payment.providerPaymentId,
    status: "REFUNDED",
    amount: String(payment.amount),
    currency: payment.currency
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

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const past = new Date(Date.now() - 5 * 86_400_000);

  async function makeUser(label, role = "CLIENT") {
    const user = await prisma.user.create({
      data: { email: `sol-pay-04-${label}-${suffix}@probe.invalid`, role }
    });
    created.userIds.push(user.id);
    const bearer = await encode({
      token: { id: user.id, email: user.email, role },
      secret: process.env.NEXTAUTH_SECRET
    });
    return { user, bearer };
  }

  /** Aegunud sponsoreeritud tellimus — täpselt see seis, kus init makse lubab. */
  async function makeExpiredSponsored(userId, origin, planDefinitionId, planKey) {
    return prisma.subscription.create({
      data: {
        userId,
        status: "ACTIVE",
        plan: planKey,
        planDefinitionId,
        billingMode: "ONE_OFF",
        validUntil: past,
        ...origin
      }
    });
  }

  async function selfPayThrough(bearer, userId, intentKey) {
    const initResponse = await initPOST(
      bearerRequest("http://probe.invalid/api/subscription/init", bearer, {
        body: { locale: "et", acceptedTerms: true, idempotencyKey: intentKey }
      })
    );
    const initBody = await initResponse.json();
    const payment = await prisma.payment.findUnique({
      where: { id: initBody.paymentId },
      select: { id: true, providerPaymentId: true, amount: true, currency: true }
    });
    const webhook = await sendPaidWebhook(payment);
    return { initStatus: initResponse.status, initBody, payment, webhook };
  }

  async function cancel(bearer) {
    const response = await cancelDELETE(
      bearerRequest("http://probe.invalid/api/subscription", bearer, { method: "DELETE" })
    );
    return { status: response.status, body: await response.json() };
  }

  try {
    const planDefinition = await prisma.planDefinition.findFirst({
      where: { role: "CLIENT", key: "client_monthly" },
      select: { id: true, key: true }
    });
    check("eeltingimus: CLIENT pakett on andmebaasis", Boolean(planDefinition));
    if (!planDefinition) throw new Error("client_monthly PlanDefinition puudub");

    // -------------------------------------------------------------------
    // 1. HOSTI SPONSORLUS on aegunud → inimene maksab ise.
    // -------------------------------------------------------------------
    const host = await makeUser("host");
    const payer = await makeUser("payer");
    const room = await prisma.room.create({
      data: { ownerId: host.user.id, title: `sond ${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(room.id);
    const invite = await prisma.invite.create({
      data: {
        roomId: room.id,
        inviterId: host.user.id,
        inviteeEmail: payer.user.email,
        tokenHash: `sol-pay-04-hash-${suffix}`,
        status: "ACCEPTED",
        paymentMode: "SPONSORED_BY_HOST",
        sponsoredByUserId: host.user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
        maxUses: 1,
        useCount: 1
      },
      select: { id: true }
    });
    created.inviteIds.push(invite.id);

    const sponsored = await makeExpiredSponsored(
      payer.user.id,
      {
        billingSource: "SPONSORED_BY_HOST",
        sponsorUserId: host.user.id,
        inviteId: invite.id
      },
      planDefinition.id,
      planDefinition.key
    );

    check("1. algseis: maksjaks on host", sponsored.billingSource === "SPONSORED_BY_HOST");

    const hostFlow = await selfPayThrough(payer.bearer, payer.user.id, `intent-host-${suffix}`);
    check("1. omamakse checkout avaneb", hostFlow.initStatus === 200, `${hostFlow.initStatus}`);
    check("1. makse kinnitatakse", hostFlow.webhook.body?.status === "PAID",
      JSON.stringify(hostFlow.webhook.body?.status));

    const afterHostPay = await prisma.subscription.findUnique({ where: { id: sponsored.id } });
    check("1. KANDEV: maksja on nüüd inimene ise", afterHostPay.billingSource === "SELF",
      afterHostPay.billingSource);
    check("1. KANDEV: ükski sponsoriseos ei jää rippuma",
      afterHostPay.sponsorUserId === null &&
        afterHostPay.inviteId === null &&
        afterHostPay.sponsorOrganizationId === null &&
        afterHostPay.orgClientSponsorshipId === null,
      JSON.stringify({
        sponsorUserId: afterHostPay.sponsorUserId,
        inviteId: afterHostPay.inviteId
      }));
    check("1. tellimus on aktiivne ja periood pikenes",
      afterHostPay.status === "ACTIVE" && new Date(afterHostPay.validUntil) > new Date(),
      `${afterHostPay.status} ${afterHostPay.validUntil?.toISOString?.()}`);

    const ledger = await prisma.dataAuditLog.findFirst({
      where: { action: "subscription.billing_source_changed", resourceId: sponsored.id },
      orderBy: { createdAt: "desc" }
    });
    check("1. KANDEV: eelmise perioodi maksja jääb ledgerisse", Boolean(ledger));
    check("1. ledger kannab MÕLEMAT poolt",
      ledger?.meta?.from?.billingSource === "SPONSORED_BY_HOST" &&
        ledger?.meta?.from?.sponsorUserId === host.user.id &&
        ledger?.meta?.to?.billingSource === "SELF",
      JSON.stringify(ledger?.meta?.from || null));

    // -------------------------------------------------------------------
    // 2. KANDEV: omamaksja saab oma tellimuse lõpetada.
    // -------------------------------------------------------------------
    const canceled = await cancel(payer.bearer);
    const afterCancel = await prisma.subscription.findUnique({ where: { id: sponsored.id } });
    check("2. KANDEV: „lõpeta“ päriselt lõpetab", canceled.status === 200 && afterCancel.cancelAtPeriodEnd === true,
      `${canceled.status} cancelAtPeriodEnd=${afterCancel.cancelAtPeriodEnd}`);
    check("2. uut uuendusmakset ei alustata", afterCancel.nextBilling === null);

    // -------------------------------------------------------------------
    // 3. NEGATIIVKONTROLL: vana kuju (päritolu jäi sponsoreerituks).
    // -------------------------------------------------------------------
    await prisma.subscription.update({
      where: { id: sponsored.id },
      data: {
        billingSource: "SPONSORED_BY_HOST",
        sponsorUserId: host.user.id,
        inviteId: invite.id,
        cancelAtPeriodEnd: false,
        nextBilling: new Date(Date.now() + 20 * 86_400_000)
      }
    });
    const oldShapeCancel = await cancel(payer.bearer);
    const afterOldShapeCancel = await prisma.subscription.findUnique({ where: { id: sponsored.id } });
    check("3. NEGATIIVKONTROLL: vana kuju all ei lõpeta „lõpeta“ mitte midagi",
      afterOldShapeCancel.cancelAtPeriodEnd === false && afterOldShapeCancel.nextBilling !== null,
      `cancelAtPeriodEnd=${afterOldShapeCancel.cancelAtPeriodEnd}`);
    check("3. ja vastus ei valeta enam edu", oldShapeCancel.status === 409 &&
      oldShapeCancel.body?.messageKey === "api.subscription.cancel_not_self_paid",
      `${oldShapeCancel.status} ${oldShapeCancel.body?.messageKey}`);

    // -------------------------------------------------------------------
    // 4. SPONSORI TAGASIMAKSE ei tohi clawback'ida omamakstud perioodi.
    // -------------------------------------------------------------------
    const sponsorPayment = await prisma.payment.create({
      data: {
        userId: host.user.id,
        inviteId: invite.id,
        provider: "MAKSEKESKUS",
        kind: "INVITE_SPONSORED",
        providerPaymentId: `mk_sponsor_${suffix}`,
        amount: "7.99",
        currency: "EUR",
        status: "PAID",
        paidAt: past
      },
      select: { id: true, providerPaymentId: true, amount: true, currency: true }
    });

    // Vana kuju: rida kannab endiselt sponsori seost (nii jättis vana aktiveerimine).
    await prisma.subscription.update({
      where: { id: sponsored.id },
      data: { status: "ACTIVE", validUntil: new Date(Date.now() + 20 * 86_400_000) }
    });
    const refundOldShape = await sendRefundWebhook(sponsorPayment);
    const afterRefundOldShape = await prisma.subscription.findUnique({ where: { id: sponsored.id } });
    check("4. NEGATIIVKONTROLL: vana kuju all clawback'ib sponsori refund kogu perioodi",
      afterRefundOldShape.status === "CANCELED",
      `${afterRefundOldShape.status} (webhook ${refundOldShape.status})`);

    // Uus kuju: omamakse on päritolu ära vahetanud, sponsori refund ei puuduta teda.
    await prisma.payment.update({
      where: { id: sponsorPayment.id },
      data: { status: "PAID", refundedAt: null }
    });
    await prisma.subscription.update({
      where: { id: sponsored.id },
      data: {
        status: "ACTIVE",
        billingSource: "SELF",
        sponsorUserId: null,
        inviteId: null,
        canceledAt: null,
        validUntil: new Date(Date.now() + 20 * 86_400_000)
      }
    });
    const refundNewShape = await sendRefundWebhook(sponsorPayment);
    const afterRefundNewShape = await prisma.subscription.findUnique({ where: { id: sponsored.id } });
    check("4. KANDEV: omamakstud periood jääb sponsori tagasimakse järel alles",
      afterRefundNewShape.status === "ACTIVE",
      `${afterRefundNewShape.status} (webhook ${refundNewShape.status})`);

    // -------------------------------------------------------------------
    // 5. ORGANISATSIOONISPONSORLUS on aegunud → inimene maksab ise.
    // -------------------------------------------------------------------
    const orgPayer = await makeUser("orgpayer");
    const organization = await prisma.organization.create({
      /* Staatus jääb `DRAFT`: sond vajab ainult ID-d, mille peale tellimuse
         päritolu näitab. `ACTIVE` nõuaks verifitseerimist (CHECK) ja see ei ole
         siin mõõdetav asi. */
      data: {
        displayName: `Sond ${suffix}`,
        legalKind: "NGO"
      },
      select: { id: true }
    });
    const orgSponsored = await makeExpiredSponsored(
      orgPayer.user.id,
      {
        billingSource: "SPONSORED_BY_ORGANIZATION",
        sponsorOrganizationId: organization.id
      },
      planDefinition.id,
      planDefinition.key
    );

    const orgFlow = await selfPayThrough(orgPayer.bearer, orgPayer.user.id, `intent-org-${suffix}`);
    check("5. organisatsioonisponsorluse järel avaneb omamakse", orgFlow.initStatus === 200,
      `${orgFlow.initStatus}`);
    const afterOrgPay = await prisma.subscription.findUnique({ where: { id: orgSponsored.id } });
    check("5. KANDEV: maksja on nüüd inimene, mitte organisatsioon",
      afterOrgPay.billingSource === "SELF" &&
        afterOrgPay.sponsorOrganizationId === null &&
        afterOrgPay.orgClientSponsorshipId === null,
      `${afterOrgPay.billingSource}/${afterOrgPay.sponsorOrganizationId}`);
    const orgCancel = await cancel(orgPayer.bearer);
    check("5. ja ta saab tellimuse ise lõpetada", orgCancel.status === 200,
      `${orgCancel.status}`);

    const orgLedger = await prisma.dataAuditLog.findFirst({
      where: { action: "subscription.billing_source_changed", resourceId: orgSponsored.id }
    });
    check("5. organisatsiooni päritolu jääb ledgerisse",
      orgLedger?.meta?.from?.sponsorOrganizationId === organization.id,
      JSON.stringify(orgLedger?.meta?.from || null));

    await prisma.organization.delete({ where: { id: organization.id } }).catch(() => null);
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
      await prisma.dataAuditLog.deleteMany({ where: { targetUserId: id } }).catch(() => null);
    }
    for (const id of created.inviteIds) {
      await prisma.invite.deleteMany({ where: { id } }).catch(() => null);
    }
    for (const id of created.roomIds) {
      await prisma.roomMember.deleteMany({ where: { roomId: id } }).catch(() => null);
      await prisma.room.delete({ where: { id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
    server.close();
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-04 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-04 sond] katkes:", error);
  server.close();
  process.exit(1);
});
