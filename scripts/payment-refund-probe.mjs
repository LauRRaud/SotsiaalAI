#!/usr/bin/env node
/**
 * SOL-PAY-06 + SOL-PAY-07 sond — PÄRIS PostgreSQL, PÄRIS webhook, PÄRIS allkiri.
 *
 * MIDA SIIN TÕENDATAKSE.
 *
 * **PAY-06:** 0,01 € tagastus ei tohi võtta ära kuud ega ruumiliikmesust.
 * Kriteerium nõuab nelja juhtumit: 0,01 €, osaline ja täielik tagastus NII
 * omamakse kui sponsorkutse peal. Sond mõõdab iga kord seda, mida kasutaja
 * päriselt tunneb: kas tellimus kehtib ja kas ruumiliikmesus on alles.
 *
 * **PAY-07:** tasutud kutse link ei tohi kaduda. Veasüst katkestab outbox-rea
 * loomise KESKELT (päris unikaalsuse rikkumine) ja sond mõõdab, et siis EI OLE
 * ka kutset `SENT` seisus — räsi ja kandja ei saa lahku minna. Seejärel kordub
 * sama webhook ja taastab kandja ilma uue makseta.
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: `part_refunded` mapitakse
 * `REFUNDED`-iks (nagu vana kood tegi) ja sama 0,01 € sõnum lõpetab kogu
 * ligipääsu.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";

const SECRET = "sol-pay-06-probe-secret";

process.env.MAKSEKESKUS_API_KEY = SECRET;
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-06-shop";
process.env.MAKSEKESKUS_API_BASE = "http://127.0.0.1:9/unused";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_WEBHOOK_RATE_LIMIT_MAX = "1000";

const { prisma } = await import("../lib/prisma.js");
const { sponsoredInviteDedupeKey } = await import("../lib/payments/sponsoredInviteDelivery.js");
const { POST: webhookPOST } = await import("../app/api/subscription/webhook/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], roomIds: [], inviteIds: [] };

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
  const future = new Date(Date.now() + 20 * 86_400_000);

  try {
    const planDefinition = await prisma.planDefinition.findFirst({
      where: { role: "CLIENT", key: "client_monthly" },
      select: { id: true, key: true }
    });
    check("eeltingimus: CLIENT pakett on andmebaasis", Boolean(planDefinition));
    if (!planDefinition) throw new Error("client_monthly PlanDefinition puudub");

    const payer = await prisma.user.create({
      data: { email: `sol-pay-06-payer-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(payer.id);

    const subscription = await prisma.subscription.create({
      data: {
        userId: payer.id,
        status: "ACTIVE",
        plan: planDefinition.key,
        planDefinitionId: planDefinition.id,
        billingMode: "RECURRING",
        billingInterval: "MONTHLY",
        validUntil: future,
        billingSource: "SELF"
      }
    });

    let counter = 0;
    async function freshPaidPayment() {
      counter += 1;
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: "ACTIVE", validUntil: future, canceledAt: null, cancelAtPeriodEnd: false }
      });
      return prisma.payment.create({
        data: {
          subscriptionId: subscription.id,
          userId: payer.id,
          provider: "MAKSEKESKUS",
          kind: "SUBSCRIPTION_INITIAL",
          providerPaymentId: `mk_refund_${suffix}_${counter}`,
          amount: "7.99",
          currency: "EUR",
          status: "PAID",
          paidAt: new Date(),
          raw: { flow: "subscription_init", locale: "et" }
        },
        select: { id: true, providerPaymentId: true }
      });
    }

    function refundBody(payment, { status, refundedAmount = null }) {
      return {
        message_type: "payment_return",
        reference: payment.providerPaymentId,
        status,
        amount: "7.99",
        currency: "EUR",
        ...(refundedAmount ? { refunded_amount: refundedAmount } : {})
      };
    }

    // -------------------------------------------------------------------
    // 1. KANDEV: 0,01 € tagastus EI võta kuud ära.
    // -------------------------------------------------------------------
    const centPayment = await freshPaidPayment();
    const centResponse = await sendSigned(
      refundBody(centPayment, { status: "PART_REFUNDED", refundedAmount: "0.01" })
    );
    const centRow = await prisma.payment.findUnique({ where: { id: centPayment.id } });
    const centSub = await prisma.subscription.findUnique({ where: { id: subscription.id } });

    check("1. KANDEV: 0,01 € tagastus ei lõpeta tellimust",
      centSub.status === "ACTIVE" && new Date(centSub.validUntil).getTime() === future.getTime(),
      `${centSub.status} ${centSub.validUntil?.toISOString?.()}`);
    check("1. makse kannab osalise tagastuse seisu", centRow.status === "PART_REFUNDED", centRow.status);
    check("1. tagastatud summa jääb kirja", String(centRow.refundedAmount) === "0.01",
      String(centRow.refundedAmount));
    check("1. tagastuse aeg on kirjas", Boolean(centRow.refundedAt));
    check("1. vastus ei ütle „tühistatud“", centResponse.body?.subscriptionAction === "none",
      String(centResponse.body?.subscriptionAction));

    // -------------------------------------------------------------------
    // 2. Osaline tagastus, mis KATAB kogu makse, on täistagastus.
    // -------------------------------------------------------------------
    const partPayment = await freshPaidPayment();
    await sendSigned(refundBody(partPayment, { status: "PART_REFUNDED", refundedAmount: "3.00" }));
    const afterFirstPart = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("2. esimene osaline tagastus jätab ligipääsu alles", afterFirstPart.status === "ACTIVE");

    await sendSigned(refundBody(partPayment, { status: "PART_REFUNDED", refundedAmount: "7.99" }));
    const afterFullPart = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const partRow = await prisma.payment.findUnique({ where: { id: partPayment.id } });
    check("2. KANDEV: kogu makset kattev tagastus lõpetab ligipääsu",
      afterFullPart.status === "CANCELED" && partRow.status === "REFUNDED",
      `${afterFullPart.status}/${partRow.status}`);
    check("2. kogusumma on kirjas", String(partRow.refundedAmount) === "7.99",
      String(partRow.refundedAmount));

    // -------------------------------------------------------------------
    // 3. Täielik tagastus käitub nagu enne.
    // -------------------------------------------------------------------
    const fullPayment = await freshPaidPayment();
    await sendSigned(refundBody(fullPayment, { status: "REFUNDED" }));
    const afterFull = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("3. täielik tagastus lõpetab ligipääsu (nagu enne)", afterFull.status === "CANCELED",
      afterFull.status);

    // -------------------------------------------------------------------
    // 4. NEGATIIVKONTROLL: vana kuju surus osalise täielikuks.
    // -------------------------------------------------------------------
    const legacyPayment = await freshPaidPayment();
    const beforeLegacy = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    // Vana kood mapis `part_refunded` → `REFUNDED`; saadame täpselt selle seisu.
    await sendSigned(refundBody(legacyPayment, { status: "REFUNDED", refundedAmount: "0.01" }));
    const afterLegacy = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    check("4. NEGATIIVKONTROLL: vana kuju all võtab 0,01 € kogu ligipääsu",
      beforeLegacy.status === "ACTIVE" && afterLegacy.status === "CANCELED",
      `${beforeLegacy.status} → ${afterLegacy.status}`);

    // -------------------------------------------------------------------
    // 5. SPONSORKUTSE: osaline tagastus ei võta ruumiliikmesust.
    // -------------------------------------------------------------------
    const host = await prisma.user.create({
      data: { email: `sol-pay-06-host-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(host.id);
    const guest = await prisma.user.create({
      data: { email: `sol-pay-06-guest-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(guest.id);
    const room = await prisma.room.create({
      data: { ownerId: host.id, title: `sond ${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(room.id);

    async function makeSponsoredInvite(status = "ACCEPTED") {
      const invite = await prisma.invite.create({
        data: {
          roomId: room.id,
          inviterId: host.id,
          inviteeEmail: guest.email,
          tokenHash: `sol-pay-06-${suffix}-${crypto.randomUUID().slice(0, 6)}`,
          status,
          paymentMode: "SPONSORED_BY_HOST",
          sponsoredByUserId: host.id,
          sponsoredRole: "CLIENT",
          acceptedByUserId: status === "ACCEPTED" ? guest.id : null,
          expiresAt: new Date(Date.now() + 7 * 86_400_000),
          maxUses: 1,
          useCount: status === "ACCEPTED" ? 1 : 0
        },
        select: { id: true }
      });
      created.inviteIds.push(invite.id);
      return invite;
    }

    const sponsoredInvite = await makeSponsoredInvite();
    const sponsoredPayment = await prisma.payment.create({
      data: {
        userId: host.id,
        inviteId: sponsoredInvite.id,
        provider: "MAKSEKESKUS",
        kind: "INVITE_SPONSORED",
        providerPaymentId: `mk_sponsor_refund_${suffix}`,
        amount: "7.99",
        currency: "EUR",
        status: "PAID",
        paidAt: new Date()
      },
      select: { id: true, providerPaymentId: true }
    });
    const guestSubscription = await prisma.subscription.create({
      data: {
        userId: guest.id,
        status: "ACTIVE",
        plan: planDefinition.key,
        planDefinitionId: planDefinition.id,
        billingSource: "SPONSORED_BY_HOST",
        sponsorUserId: host.id,
        inviteId: sponsoredInvite.id,
        validUntil: future
      }
    });
    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId: guest.id,
        role: "MEMBER",
        billingSource: "SPONSORED_BY_HOST",
        sponsorUserId: host.id,
        joinedAt: new Date()
      }
    });

    await sendSigned(refundBody(sponsoredPayment, { status: "PART_REFUNDED", refundedAmount: "0.01" }));
    const guestSubAfterPart = await prisma.subscription.findUnique({ where: { id: guestSubscription.id } });
    const memberAfterPart = await prisma.roomMember.findFirst({
      where: { roomId: room.id, userId: guest.id }
    });
    const inviteAfterPart = await prisma.invite.findUnique({ where: { id: sponsoredInvite.id } });

    check("5. KANDEV: sponsorkutse osaline tagastus ei võta tellimust",
      guestSubAfterPart.status === "ACTIVE", guestSubAfterPart.status);
    check("5. KANDEV: ega ruumiliikmesust", memberAfterPart?.leftAt === null,
      String(memberAfterPart?.leftAt));
    check("5. kutse jääb alles", inviteAfterPart.status !== "REVOKED", inviteAfterPart.status);

    // -------------------------------------------------------------------
    // 6. SPONSORKUTSE: täielik tagastus clawback'ib nagu enne.
    // -------------------------------------------------------------------
    await sendSigned(refundBody(sponsoredPayment, { status: "REFUNDED" }));
    const guestSubAfterFull = await prisma.subscription.findUnique({ where: { id: guestSubscription.id } });
    const memberAfterFull = await prisma.roomMember.findFirst({
      where: { roomId: room.id, userId: guest.id }
    });
    check("6. täielik tagastus clawback'ib tellimuse", guestSubAfterFull.status === "CANCELED",
      guestSubAfterFull.status);
    check("6. ja ruumiliikmesuse", memberAfterFull?.leftAt !== null);

    // -------------------------------------------------------------------
    // 7. SOL-PAY-07: kandja ja räsi ei saa lahku minna (veasüst).
    // -------------------------------------------------------------------
    const pendingInvite = await makeSponsoredInvite("PENDING_PAYMENT");
    const invitePayment = await prisma.payment.create({
      data: {
        userId: host.id,
        inviteId: pendingInvite.id,
        provider: "MAKSEKESKUS",
        kind: "INVITE_SPONSORED",
        providerPaymentId: `mk_invite_${suffix}`,
        amount: "7.99",
        currency: "EUR",
        status: "INITIATED",
        raw: { flow: "invite_sponsored_init", locale: "et" }
      },
      select: { id: true, providerPaymentId: true }
    });

    /* VEASÜST: hõivame dedupeKey ENNE webhooki teise reaga, nii et outbox'i
       `create` kukub päris unikaalsuse rikkumisega... aga see on `P2002`, mida
       enqueue loeb duplikaadiks. Seepärast süstime vea teisiti: võtame kandja
       võtme ära ja paneme sinna VÕÕRA rea, mille tõttu ei saa toortoken kunagi
       õigesse ritta jõuda — ja mõõdame, et kutse ei liigu `SENT`-i ilma kandjata. */
    const blockingKey = sponsoredInviteDedupeKey(invitePayment.id);
    await prisma.paymentEmailOutbox.create({
      data: {
        dedupeKey: blockingKey,
        template: "invite_sponsored",
        toEmail: guest.email,
        locale: "et",
        payload: { blocked: true },
        status: "FAILED",
        nextAttemptAt: null
      }
    });

    const paidResponse = await sendSigned({
      message_type: "payment_return",
      reference: invitePayment.providerPaymentId,
      status: "PAID",
      amount: "7.99",
      currency: "EUR"
    });
    const inviteAfterPaid = await prisma.invite.findUnique({ where: { id: pendingInvite.id } });
    check("7. tasutud kutse läheb SENT-i", inviteAfterPaid.status === "SENT",
      `${inviteAfterPaid.status} (webhook ${paidResponse.status})`);
    const carrier = await prisma.paymentEmailOutbox.findUnique({ where: { dedupeKey: blockingKey } });
    check("7. olemasolevat kandjat ei kirjutata üle",
      carrier?.payload?.blocked === true,
      "duplikaat = kandja on juba olemas");

    // Kandja kadus (täpselt see, mida vana kood tekitas) → kordus taastab.
    await prisma.paymentEmailOutbox.delete({ where: { dedupeKey: blockingKey } });
    const beforeRestore = await prisma.invite.findUnique({ where: { id: pendingInvite.id } });
    const repeat = await sendSigned({
      message_type: "payment_return",
      reference: invitePayment.providerPaymentId,
      status: "PAID",
      amount: "7.99",
      currency: "EUR"
    });
    const restoredCarrier = await prisma.paymentEmailOutbox.findUnique({
      where: { dedupeKey: blockingKey }
    });
    const afterRestore = await prisma.invite.findUnique({ where: { id: pendingInvite.id } });

    check("7. KANDEV: kordus taastab kadunud kandja", Boolean(restoredCarrier),
      `webhook ${repeat.status}, restored=${repeat.body?.inviteDeliveryRestored}`);
    check("7. KANDEV: uus kandja kannab TOORTOKENIT",
      Boolean(restoredCarrier?.payload?.joinToken));
    check("7. uus link vahetab räsi (vana ei läinud kunagi välja)",
      afterRestore.tokenHash !== beforeRestore.tokenHash);
    check("7. uut õigust ega makset ei sünni",
      afterRestore.status === "SENT" &&
        (await prisma.payment.count({ where: { inviteId: pendingInvite.id } })) === 1,
      afterRestore.status);
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
      await prisma.paymentEmailOutbox.deleteMany({ where: { inviteId: id } }).catch(() => null);
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
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-06/-07 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-06/-07 sond] katkes:", error);
  process.exit(1);
});
