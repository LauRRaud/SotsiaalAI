#!/usr/bin/env node
/**
 * SOL-PAY-01 sond — PÄRIS PostgreSQL.
 *
 * MIDA SIIN TÕENDATAKSE. Leiu kandev väide ei ole „retry-loogika arvutab õigesti"
 * — see arvutas ka enne õigesti. Väide on, et **järgmine worker-jooks valib selle
 * tellimuse üles**. Seda saab tõendada ainult päris `WHERE`-klausliga päris
 * andmebaasi vastu: `npm test` mõõdab minu enda matcherit.
 *
 * Provideri kutset siin EI OLE ja teda ei ole vaja: leid on VALIKUS, mitte
 * laadimises. Sond kirjutab täpselt need seisud, mille marsruudi tõrkeharu
 * kirjutab (`planRenewalFailure`), ja küsib pärast igat sammu andmebaasilt, kas
 * rida on valitav.
 *
 * NEGATIIVKONTROLL on vana tõrkeharu transkriptsioon: maksemeetod `FAILED`
 * esimese tõrke peale. Pärast seda ei leia päring rida ÜLES — täpselt see, mille
 * tõttu korduskatse kunagi ei käivitunud.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import {
  getDueRecurringSubscriptionWhere,
  getRecurringMaxRetryCount,
  planRenewalFailure
} from "../lib/payments/recurring.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], subscriptionIds: [], billingMethodIds: [] };

/** Kas PÄRIS andmebaas annab selle tellimuse valikusse? */
async function isSelectable(subscriptionId, now) {
  const found = await prisma.subscription.findFirst({
    where: { id: subscriptionId, ...getDueRecurringSubscriptionWhere(now) },
    select: { id: true }
  });
  return Boolean(found);
}

async function main() {
  const suffix = randomUUID().slice(0, 8);
  const now = new Date("2026-07-19T00:00:00.000Z");

  try {
    const user = await prisma.user.create({
      data: { email: `sol-pay-01-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(user.id);

    const method = await prisma.billingMethod.create({
      data: {
        userId: user.id,
        provider: "MAKSEKESKUS",
        status: "ACTIVE",
        label: "probe",
        activatedAt: now
      }
    });
    created.billingMethodIds.push(method.id);

    /* DB CHECK `Subscription_normalized_plan_check`: mitte-NONE tellimusel PEAB
       olema `planDefinitionId`. Võtame olemasoleva paketi, et sond ei looks
       kõrvalist definitsiooni. */
    const planDefinition = await prisma.planDefinition.findFirst({ select: { id: true, key: true } });
    check("eeltingimus: andmebaasis on vähemalt üks pakett", Boolean(planDefinition));
    if (!planDefinition) throw new Error("PlanDefinition puudub — sond ei saa tellimust luua");

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        status: "ACTIVE",
        plan: planDefinition.key || "probe",
        planDefinitionId: planDefinition.id,
        billingMode: "RECURRING",
        billingInterval: "MONTHLY",
        billingMethodId: method.id,
        nextBilling: new Date("2026-07-18T00:00:00.000Z"),
        billingRetryCount: 0,
        cancelAtPeriodEnd: false
      }
    });
    created.subscriptionIds.push(subscription.id);

    check("algseis: tähtaeg käes → tellimus on valikus", await isSelectable(subscription.id, now));

    // -------------------------------------------------------------------
    // 1. TÕRGE #1 — täpselt see, mida marsruudi tõrkeharu kirjutab.
    // -------------------------------------------------------------------
    const applyFailure = async (row) => {
      const plan = planRenewalFailure({ retryCountBefore: row.billingRetryCount, failedAt: now });
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: plan.subscriptionStatus,
          pastDueSince: now,
          billingRetryCount: plan.retryCount,
          nextBilling: plan.cancel ? row.nextBilling : plan.nextRetryAt
        }
      });
      if (plan.billingMethodStatus) {
        await prisma.billingMethod.update({
          where: { id: method.id },
          data: { status: plan.billingMethodStatus }
        });
      }
      return plan;
    };

    let current = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const firstPlan = await applyFailure(current);
    current = await prisma.subscription.findUnique({ where: { id: subscription.id } });

    check("tõrge #1: tellimus on PAST_DUE", current.status === "PAST_DUE", current.status);
    check("tõrge #1: katsete loendur on 1", current.billingRetryCount === 1, `${current.billingRetryCount}`);
    const methodAfterFirst = await prisma.billingMethod.findUnique({ where: { id: method.id } });
    check(
      "tõrge #1: maksemeetod EI ole katki",
      methodAfterFirst.status === "ACTIVE",
      methodAfterFirst.status
    );
    check(
      "tõrge #1: enne korduskatse aega ei ole tellimus valikus",
      (await isSelectable(subscription.id, now)) === false
    );
    check(
      "KANDEV: korduskatse ajal ON tellimus valikus",
      await isSelectable(subscription.id, new Date(firstPlan.nextRetryAt.getTime() + 1000)),
      `korduskatse ${firstPlan.nextRetryAt.toISOString()}`
    );

    // -------------------------------------------------------------------
    // 2. NEGATIIVKONTROLL — vana tõrkeharu märkis meetodi kohe katkiseks.
    // -------------------------------------------------------------------
    await prisma.billingMethod.update({ where: { id: method.id }, data: { status: "FAILED" } });
    check(
      "negatiivkontroll: vana kuju (meetod FAILED) võtab tellimuse valikust VÄLJA",
      (await isSelectable(subscription.id, new Date(firstPlan.nextRetryAt.getTime() + 1000))) === false
    );
    await prisma.billingMethod.update({ where: { id: method.id }, data: { status: "ACTIVE" } });

    // -------------------------------------------------------------------
    // 3. KOGU JADA lõpuni: iga lubatud katse jõuab kohale, siis tühistus.
    // -------------------------------------------------------------------
    let attempts = 1; // tõrge #1 on juba tehtud
    let guard = 0;
    let clock = new Date(firstPlan.nextRetryAt.getTime() + 1000);
    while ((await isSelectable(subscription.id, clock)) && guard < 10) {
      guard += 1;
      attempts += 1;
      current = await prisma.subscription.findUnique({ where: { id: subscription.id } });
      const plan = await applyFailure(current);
      clock = plan.nextRetryAt
        ? new Date(plan.nextRetryAt.getTime() + 1000)
        : new Date(clock.getTime() + 86_400_000);
    }
    current = await prisma.subscription.findUnique({ where: { id: subscription.id } });
    const methodAtEnd = await prisma.billingMethod.findUnique({ where: { id: method.id } });

    check(
      "jada: kohale jõuab täpselt lubatud arv katseid",
      attempts === getRecurringMaxRetryCount(),
      `katseid ${attempts}, lubatud ${getRecurringMaxRetryCount()}`
    );
    check("jada: lõpp on CANCELED", current.status === "CANCELED", current.status);
    check("jada: maksemeetod märgitakse katkiseks alles loobumisel", methodAtEnd.status === "FAILED", methodAtEnd.status);
    check("jada: tühistatud tellimus ei ole enam valikus", (await isSelectable(subscription.id, clock)) === false);

    // -------------------------------------------------------------------
    // 4. TAASTUMINE — õnnestunud makse teeb tellimusest jälle tavalise.
    //    (`activateSubscriptionFromPayment` kirjutab täpselt need väljad.)
    // -------------------------------------------------------------------
    const recoveredAt = new Date("2026-09-19T00:00:00.000Z");
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: "ACTIVE",
        pastDueSince: null,
        billingRetryCount: 0,
        nextBilling: recoveredAt,
        canceledAt: null
      }
    });
    await prisma.billingMethod.update({ where: { id: method.id }, data: { status: "ACTIVE" } });
    check(
      "taastumine: õnnestunud makse järel on tellimus jälle valikus",
      await isSelectable(subscription.id, new Date(recoveredAt.getTime() + 1000))
    );
  } finally {
    for (const id of created.subscriptionIds) {
      await prisma.payment.deleteMany({ where: { subscriptionId: id } }).catch(() => null);
      await prisma.subscription.delete({ where: { id } }).catch(() => null);
    }
    for (const id of created.billingMethodIds) {
      await prisma.billingMethod.delete({ where: { id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-01 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-01 sond] katkes:", error);
  process.exit(1);
});
