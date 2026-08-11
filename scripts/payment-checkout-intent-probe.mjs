#!/usr/bin/env node
/**
 * SOL-PAY-03 sond — PÄRIS PostgreSQL, PÄRIS marsruut, PÄRIS võistlus.
 *
 * MIDA SIIN TÕENDATAKSE. Leiu kandev väide on „kaks paralleelset päringut võivad
 * mõlemad läbida" — seda ei saa tõendada fake'iga, sest fake ei kanna ei
 * nõuandelukku ega unikaalset indeksit. Sond käivitab päris `POST
 * /api/subscription/init` marsruudi päris andmebaasi vastu ja loeb kaks numbrit:
 * **mitu makserida tekkis** ja **mitu transaction-create'i provider nägi**.
 *
 * VÕISTLUS ON DETERMINISTLIK, mitte „mahtusid ühte sekundisse": kolmas tehing
 * hoiab sama nõuandelukku, mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad
 * ootavad, alles siis lastakse lukk lahti (`scripts/probe-race-harness.mjs`).
 *
 * NEGATIIVKONTROLL on vana kuju transkriptsioon: võtmeta read (`clientIntentKey`
 * NULL) lähevad andmebaasi mõlemad sisse — täpselt nii sai vana init avada kaks
 * tasutavat checkout'i. Sama kavatsuse võtmega põrkab teine rida unikaalsuse
 * vastu.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import crypto from "node:crypto";
import http from "node:http";

// ---------------------------------------------------------------------------
// Enne ühtegi importi.
// ---------------------------------------------------------------------------
const provider = { transactionCalls: 0 };

const server = http.createServer((req, res) => {
  provider.transactionCalls += 1;
  const id = `trx_${provider.transactionCalls}`;
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({ id, reference: null }));
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));

process.env.MAKSEKESKUS_API_BASE = `http://127.0.0.1:${server.address().port}`;
process.env.MAKSEKESKUS_API_KEY = "sol-pay-03-probe-secret";
process.env.MAKSEKESKUS_SHOP_ID = "sol-pay-03-shop";
process.env.MAKSEKESKUS_PUBLIC_KEY = "sol-pay-03-public";
process.env.MAKSEKESKUS_IFRAME_SCRIPT_URL = "https://probe.invalid/checkout.js";
process.env.SUBSCRIPTION_RECURRING_ENABLED = "true";
process.env.SUBSCRIPTION_CURRENCY = "EUR";
process.env.SUBSCRIPTION_INIT_RATE_LIMIT_MAX = "1000";
process.env.NEXTAUTH_URL = "http://probe.invalid";
process.env.NEXTAUTH_SECRET = "sol-pay-03-probe-nextauth-secret";

const { prisma } = await import("../lib/prisma.js");
const { encode } = await import("next-auth/jwt");
const { raceOnLockedRow } = await import("./probe-race-harness.mjs");
const { CHECKOUT_INTENT_LOCK_NAMESPACE } = await import("../lib/payments/checkoutIntent.js");
const { makeProviderPaymentId } = await import("../lib/payments/maksekeskus.js");
const { POST: initPOST } = await import("../app/api/subscription/init/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], subscriptionIds: [] };

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  let bearer = "";

  /** Päris marsruut, päris Request, päris seansitõend. */
  async function init(intentKey, { omitKey = false } = {}) {
    const response = await initPOST(
      new Request("http://probe.invalid/api/subscription/init", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${bearer}`
        },
        body: JSON.stringify({
          locale: "et",
          acceptedTerms: true,
          ...(omitKey ? {} : { idempotencyKey: intentKey })
        })
      })
    );
    return { status: response.status, body: await response.json() };
  }

  async function paymentRows(userId) {
    return prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { id: true, status: true, clientIntentKey: true, providerPaymentId: true, raw: true }
    });
  }

  try {
    const user = await prisma.user.create({
      data: { email: `sol-pay-03-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(user.id);
    bearer = await encode({
      token: { id: user.id, email: user.email, role: "CLIENT" },
      secret: process.env.NEXTAUTH_SECRET
    });

    // -------------------------------------------------------------------
    // 0. Võti on kohustuslik — võtmeta päring EI ole „tee uus tasuline asi".
    // -------------------------------------------------------------------
    const noKey = await init(null, { omitKey: true });
    check("0. võtmeta päring saab 400, mitte uue checkout'i",
      noKey.status === 400 && noKey.body?.messageKey === "api.subscription.checkout_intent_required",
      `${noKey.status} ${noKey.body?.messageKey}`);
    check("0. võtmeta päring ei jätnud makserida", (await paymentRows(user.id)).length === 0);

    // -------------------------------------------------------------------
    // 1. VÕISTLUS sama võtmega (topeltklõps).
    // -------------------------------------------------------------------
    const callsBeforeRace = provider.transactionCalls;
    const sameKey = `intent-${suffix}-a`;
    const race = await raceOnLockedRow({
      prisma,
      lockRow: (tx) =>
        tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHECKOUT_INTENT_LOCK_NAMESPACE}::int4, hashtext(${user.id})::int4)`,
      first: () => init(sameKey),
      second: () => init(sameKey),
      label: "1. sama võti",
      expect: (name, condition, detail) => check(name, condition, detail)
    });

    const raceStatuses = [race.resultA.value?.status, race.resultB.value?.status].sort();
    const rowsAfterRace = await paymentRows(user.id);
    check("1. KANDEV: võistlus jätab TÄPSELT ÜHE makserea", rowsAfterRace.length === 1,
      `ridu ${rowsAfterRace.length}`);
    check("1. KANDEV: provider nägi TÄPSELT ÜHT transaction-create'i",
      provider.transactionCalls - callsBeforeRace === 1,
      `kutseid ${provider.transactionCalls - callsBeforeRace}`);
    check("1. üks päring saab checkout'i, teine ausa 409", raceStatuses.join(",") === "200,409",
      raceStatuses.join(","));
    const conflict = [race.resultA.value, race.resultB.value].find(entry => entry?.status === 409);
    check("1. 409 nimetab pooleliolekut", conflict?.body?.messageKey === "api.subscription.checkout_in_progress",
      String(conflict?.body?.messageKey));
    check("1. tellimusi tekkis üks", (await prisma.subscription.count({ where: { userId: user.id } })) === 1);

    const winner = [race.resultA.value, race.resultB.value].find(entry => entry?.status === 200);
    created.subscriptionIds.push(
      ...(await prisma.subscription.findMany({ where: { userId: user.id }, select: { id: true } })).map(
        row => row.id
      )
    );

    // -------------------------------------------------------------------
    // 2. KANDEV: identne kordus tagastab SAMA checkout'i.
    // -------------------------------------------------------------------
    const callsBeforeRetry = provider.transactionCalls;
    const retry = await init(sameKey);
    check("2. KANDEV: sama võti tagastab sama checkout'i",
      retry.status === 200 &&
        retry.body?.transactionId === winner.body?.transactionId &&
        retry.body?.paymentId === winner.body?.paymentId,
      `${retry.body?.transactionId} vs ${winner.body?.transactionId}`);
    check("2. kordus ei telli teist provideritransaktsiooni",
      provider.transactionCalls === callsBeforeRetry);
    check("2. kordus ei loo teist makserida", (await paymentRows(user.id)).length === 1);
    check("2. vastus ütleb ausalt, et tegu on taaskasutusega", retry.body?.reused === true);

    // -------------------------------------------------------------------
    // 3. Teine vahekaart (teine võti) ei ava teist tasutavat checkout'i.
    // -------------------------------------------------------------------
    const callsBeforeTab = provider.transactionCalls;
    const otherTab = await init(`intent-${suffix}-b`);
    check("3. teine vahekaart saab SAMA checkout'i",
      otherTab.status === 200 && otherTab.body?.paymentId === winner.body?.paymentId,
      `${otherTab.status} ${otherTab.body?.paymentId}`);
    check("3. teine vahekaart ei telli teist provideritransaktsiooni",
      provider.transactionCalls === callsBeforeTab);
    check("3. makseridu on endiselt üks", (await paymentRows(user.id)).length === 1);

    // -------------------------------------------------------------------
    // 4. Lõppenud kavatsus: sama võti ei ärata surnud katset.
    // -------------------------------------------------------------------
    await prisma.payment.updateMany({
      where: { userId: user.id },
      data: { status: "CANCELED", failedAt: new Date() }
    });
    const spent = await init(sameKey);
    check("4. ära kasutatud võti saab 409, mitte vaikselt uue makse",
      spent.status === 409 && spent.body?.messageKey === "api.subscription.checkout_intent_used",
      `${spent.status} ${spent.body?.messageKey}`);

    const freshKey = `intent-${suffix}-c`;
    const callsBeforeFresh = provider.transactionCalls;
    const fresh = await init(freshKey);
    const rowsAfterFresh = await paymentRows(user.id);
    check("4. uus kavatsus saab uue checkout'i", fresh.status === 200 && fresh.body?.reused !== true,
      `${fresh.status}`);
    check("4. uus kavatsus tellib täpselt ühe uue transaktsiooni",
      provider.transactionCalls - callsBeforeFresh === 1);
    check("4. tühistatud katse ei kadunud kuhugi", rowsAfterFresh.length === 2,
      `ridu ${rowsAfterFresh.length}`);

    // -------------------------------------------------------------------
    // 5. VÕISTLUS KAHE ERI VÕTMEGA — seda ei lahenda võti, vaid lukk.
    // -------------------------------------------------------------------
    const raceUser = await prisma.user.create({
      data: { email: `sol-pay-03-race-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(raceUser.id);
    const raceBearer = await encode({
      token: { id: raceUser.id, email: raceUser.email, role: "CLIENT" },
      secret: process.env.NEXTAUTH_SECRET
    });
    const previousBearer = bearer;
    bearer = raceBearer;

    const callsBeforeTabRace = provider.transactionCalls;
    const tabRace = await raceOnLockedRow({
      prisma,
      lockRow: (tx) =>
        tx.$executeRaw`SELECT pg_advisory_xact_lock(${CHECKOUT_INTENT_LOCK_NAMESPACE}::int4, hashtext(${raceUser.id})::int4)`,
      first: () => init(`intent-${suffix}-tab1`),
      second: () => init(`intent-${suffix}-tab2`),
      label: "5. kaks vahekaarti",
      expect: (name, condition, detail) => check(name, condition, detail)
    });
    const raceRows = await paymentRows(raceUser.id);
    check("5. KANDEV: kaks ERI võtit korraga jätavad ÜHE makserea", raceRows.length === 1,
      `ridu ${raceRows.length}`);
    check("5. KANDEV: provider nägi ÜHT transaction-create'i",
      provider.transactionCalls - callsBeforeTabRace === 1,
      `kutseid ${provider.transactionCalls - callsBeforeTabRace}`);
    check("5. mõlemad päringud said vastuse", Boolean(tabRace.resultA.value && tabRace.resultB.value));
    created.subscriptionIds.push(
      ...(await prisma.subscription.findMany({ where: { userId: raceUser.id }, select: { id: true } })).map(
        row => row.id
      )
    );
    bearer = previousBearer;

    // -------------------------------------------------------------------
    // 6. NEGATIIVKONTROLL: vana kuju läheb andmebaasi ilma vastuseisuta.
    // -------------------------------------------------------------------
    const legacyUser = await prisma.user.create({
      data: { email: `sol-pay-03-legacy-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(legacyUser.id);
    const legacyRow = (extra = {}) => ({
      userId: legacyUser.id,
      provider: "MAKSEKESKUS",
      kind: "SUBSCRIPTION_INITIAL",
      providerPaymentId: makeProviderPaymentId(legacyUser.id),
      amount: "7.99",
      currency: "EUR",
      status: "INITIATED",
      ...extra
    });

    await prisma.payment.create({ data: legacyRow() });
    await prisma.payment.create({ data: legacyRow() });
    const legacyOpen = await prisma.payment.count({
      where: { userId: legacyUser.id, status: "INITIATED" }
    });
    check("6. NEGATIIVKONTROLL: vana kuju (võtmeta) lubab KAKS avatud checkout'i", legacyOpen === 2,
      `avatud ${legacyOpen}`);

    const sharedKey = `intent-${suffix}-legacy`;
    await prisma.payment.create({ data: legacyRow({ clientIntentKey: sharedKey }) });
    let duplicateBlocked = false;
    try {
      await prisma.payment.create({ data: legacyRow({ clientIntentKey: sharedKey }) });
    } catch (error) {
      duplicateBlocked = error?.code === "P2002";
    }
    check("6. sama kavatsuse võtmega teist rida andmebaas ei võta", duplicateBlocked);
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
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
    server.close();
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-PAY-03 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-PAY-03 sond] katkes:", error);
  server.close();
  process.exit(1);
});
