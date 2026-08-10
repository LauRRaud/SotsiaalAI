#!/usr/bin/env node
/**
 * SOL-ORG-06 — sponsorluse kolm väljapääsu `PENDING`-ust, korraga.
 *
 *   npm run org:sponsor:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: tingimusliku `UPDATE`-i uuesti-
 * hindamist rea luku all. Fake-klient ei modelleeri seda — tema all „võidavad"
 * mõlemad võistlejad ja kood näeb korras välja.
 *
 * VÕISTLUS ON DETERMINISTLIK: kolmas tehing hoiab sponsorlusrea lukku, mõlemad
 * võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad, siis lukk lastakse
 * lahti ja Postgres annab ta ootejärjekorra järjekorras.
 *
 * MIS ON „KOHERENTNE LÕPPSEIS": sponsorluse olek ja tellimuse maksja
 * KIRJELDAVAD SAMA SÜNDMUST. `REVOKED` kutse all ei tohi olla organisatsiooni
 * makstud aktiivset tellimust ja `ACCEPTED` kutse all peab tellimus olema.
 *
 * Andmed: ainult `@sol-spons.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  acceptClientSponsorship,
  createClientSponsorship,
  declineClientSponsorship,
  revokeClientSponsorship
} from "../lib/org/sponsorship.js";

const SUFFIX = "@sol-spons.invalid";
const MARK = "(spons-sünteetiline)";
const NOW = new Date();

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function holdOpen(work) {
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const done = prisma.$transaction(async (tx) => {
    const value = await work(tx);
    await held;
    return value;
  }, { timeout: 30000 });
  return { release: () => release(), done };
}

function watch(promise) {
  const state = { settled: false, value: null, error: null };
  const wrapped = promise.then(
    (value) => { state.settled = true; state.value = value; return state; },
    (error) => { state.settled = true; state.error = error; return state; }
  );
  return { state, wrapped };
}

async function makeUser(local) {
  return prisma.user.create({
    data: {
      email: `${local}-${passed}${failed}-${Buffer.from(String(local)).toString("hex").slice(0, 6)}${SUFFIX}`,
      role: "CLIENT",
      emailVerified: NOW
    }
  });
}

/** Uus maja + uus pöörduja + uus ootel sponsorlus. */
async function freshSponsorship(label) {
  const org = await prisma.organization.create({
    data: {
      displayName: `Sponsormaja ${MARK}`,
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
  const admin = await makeUser(`admin-${label}`);
  const client = await makeUser(`client-${label}`);
  const { sponsorship, rawToken } = await createClientSponsorship(
    org.id,
    { actorUserId: admin.id, email: client.email },
    { db: prisma, now: NOW }
  );
  return { org, admin, client, sponsorship, rawToken };
}

/**
 * KOHERENTSUSKONTROLL: olek ja tellimus peavad kirjeldama sama sündmust.
 * Just see paar läks vana koodiga lahku.
 */
async function assertCoherent(label, sponsorshipId, userId) {
  const row = await prisma.organizationClientSponsorship.findUnique({ where: { id: sponsorshipId } });
  const subscription = await prisma.subscription.findFirst({ where: { userId } });
  const sponsored =
    subscription?.status === "ACTIVE" && subscription?.billingSource === "SPONSORED_BY_ORGANIZATION";

  if (row.status === "ACCEPTED") {
    expect(`${label}: ACCEPTED kutse all ON organisatsiooni makstud tellimus`, sponsored, JSON.stringify({ subscription }));
    expect(`${label}: tellimus viitab SAMALE kutsele`, subscription?.orgClientSponsorshipId === sponsorshipId);
  } else {
    expect(
      `${label}: ${row.status} kutse all EI OLE organisatsiooni makstud tellimust`,
      !sponsored,
      JSON.stringify({ status: row.status, billingSource: subscription?.billingSource })
    );
  }
  return row;
}

async function race(label, sponsorshipId, first, second) {
  const holder = holdOpen(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "OrganizationClientSponsorship" WHERE "id" = ${sponsorshipId} FOR UPDATE`;
  });
  await sleep(80);

  const a = watch(first());
  await sleep(120);
  const b = watch(second());
  await sleep(120);

  expect(`${label}: esimene võistleja OOTAB sponsorlusrea lukku`, a.state.settled === false);
  expect(`${label}: teine võistleja OOTAB sponsorlusrea lukku`, b.state.settled === false);

  holder.release();
  await holder.done;
  const [resultA, resultB] = await Promise.all([a.wrapped, b.wrapped]);
  return { resultA, resultB };
}

/** Täpselt üks võistleja tohib võita. */
function expectExactlyOneWinner(label, resultA, resultB) {
  const winners = [resultA, resultB].filter((result) => !result.error).length;
  expect(`${label}: täpselt üks võistleja võidab`, winners === 1, `võitjaid ${winners}`);
}

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const userIds = users.map((row) => row.id);
  if (userIds.length) await prisma.subscription.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.organizationClientSponsorship.deleteMany({
    where: { organization: { displayName: { contains: MARK } } }
  });
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
}

async function main() {
  console.log("SOL-ORG-06 — sponsorluse võistlused päris PostgreSQL-is\n");
  await purge();

  // === 1. ACCEPT vs REVOKE, vastuvõtmine EES ==============================
  {
    const { org, admin, client, sponsorship, rawToken } = await freshSponsorship("ar");
    const { resultA, resultB } = await race(
      "accept→revoke",
      sponsorship.id,
      () => acceptClientSponsorship(rawToken, { userId: client.id, userEmail: client.email }, { db: prisma, now: NOW }),
      () => revokeClientSponsorship(org.id, sponsorship.id, { actorUserId: admin.id }, { db: prisma, now: NOW })
    );
    expectExactlyOneWinner("accept→revoke", resultA, resultB);
    expect("accept→revoke: vastuvõtmine võidab", Boolean(resultA.value?.organizationId), String(resultA.error?.messageKey));
    expect(
      "accept→revoke: tagasivõtmine kukub, mitte ei kirjuta üle",
      resultB.error?.status === 409,
      String(resultB.error?.messageKey || resultB.value?.status)
    );
    const row = await assertCoherent("accept→revoke", sponsorship.id, client.id);
    expect("accept→revoke: lõppseis on ACCEPTED", row.status === "ACCEPTED", row.status);
  }

  // === 2. ACCEPT vs REVOKE, tagasivõtmine EES =============================
  {
    const { org, admin, client, sponsorship, rawToken } = await freshSponsorship("ra");
    const { resultA, resultB } = await race(
      "revoke→accept",
      sponsorship.id,
      () => revokeClientSponsorship(org.id, sponsorship.id, { actorUserId: admin.id }, { db: prisma, now: NOW }),
      () => acceptClientSponsorship(rawToken, { userId: client.id, userEmail: client.email }, { db: prisma, now: NOW })
    );
    expectExactlyOneWinner("revoke→accept", resultA, resultB);
    expect("revoke→accept: tagasivõtmine võidab", resultA.value?.status === "REVOKED", String(resultA.error?.messageKey));
    /* SEE ON LEID ISE: vana kood kirjutas tellimuse ENNE olekut, seega
       tagasivõetud kutse all jäi aktiivne organisatsiooni makstud tellimus. */
    expect(
      "revoke→accept: vastuvõtmine kukub",
      Boolean(resultB.error),
      String(resultB.value && JSON.stringify(resultB.value))
    );
    const row = await assertCoherent("revoke→accept", sponsorship.id, client.id);
    expect("revoke→accept: lõppseis on REVOKED", row.status === "REVOKED", row.status);
  }

  // === 3. ACCEPT vs DECLINE mõlemas ajastuses =============================
  for (const [label, order] of [
    ["accept→decline", "accept"],
    ["decline→accept", "decline"]
  ]) {
    const { client, sponsorship, rawToken } = await freshSponsorship(label.slice(0, 4));
    const accept = () =>
      acceptClientSponsorship(rawToken, { userId: client.id, userEmail: client.email }, { db: prisma, now: NOW });
    const decline = () =>
      declineClientSponsorship(rawToken, { userId: client.id, userEmail: client.email }, { db: prisma, now: NOW });
    const { resultA, resultB } = await race(
      label,
      sponsorship.id,
      order === "accept" ? accept : decline,
      order === "accept" ? decline : accept
    );
    expectExactlyOneWinner(label, resultA, resultB);
    const row = await assertCoherent(label, sponsorship.id, client.id);
    expect(
      `${label}: lõppseis on ${order === "accept" ? "ACCEPTED" : "DECLINED"}`,
      row.status === (order === "accept" ? "ACCEPTED" : "DECLINED"),
      row.status
    );
  }

  // === 4. KORDUV ACCEPT ===================================================
  {
    const { client, sponsorship, rawToken } = await freshSponsorship("aa");
    const accept = () =>
      acceptClientSponsorship(rawToken, { userId: client.id, userEmail: client.email }, { db: prisma, now: NOW });
    const { resultA, resultB } = await race("accept×2", sponsorship.id, accept, accept);
    expectExactlyOneWinner("accept×2", resultA, resultB);
    const row = await assertCoherent("accept×2", sponsorship.id, client.id);
    expect("accept×2: lõppseis on ACCEPTED", row.status === "ACCEPTED", row.status);

    const subscriptions = await prisma.subscription.count({ where: { userId: client.id } });
    expect("accept×2: kaks vastuvõtmist ei tee kahte tellimust", subscriptions === 1, `${subscriptions}`);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const leftUsers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  const leftOrgs = await prisma.organization.count({ where: { displayName: { contains: MARK } } });
  console.log(`  leftovers: ${leftUsers} users, ${leftOrgs} organizations`);
}

try {
  await main();
} catch (error) {
  failed += 1;
  console.error("\nUNCAUGHT", error);
} finally {
  await cleanup();
  await prisma.$disconnect();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
