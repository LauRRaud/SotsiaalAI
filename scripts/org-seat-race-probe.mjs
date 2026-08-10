#!/usr/bin/env node
/**
 * SOL-ORG-05 — kohaplaani limiit ja lõpetamine paralleelse kohaandmise all.
 *
 *   npm run org:seat:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: rea lukku, luku ootejärjekorda ja
 * READ COMMITTED uuestihindamist. Fake-klient ei modelleeri ühtki neist — tema
 * all läheks ka katkine kood roheliseks.
 *
 * VÕISTLUS ON DETERMINISTLIK, MITTE „mahtusid ühte sekundisse". Retsept:
 *   1. kolmas tehing võtab plaanirea luku ja HOIAB seda;
 *   2. mõlemad võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad;
 *   3. lukk lastakse lahti — Postgres annab ta ootejärjekorra järjekorras,
 *      seega võistlejate järjekord on see, mille meie valisime;
 *   4. mõõdetakse lõppseisu.
 * Kumbki ajastus jooksutatakse eraldi ja mõlemas peab kehtima sama invariant.
 *
 * KAKS INVARIANTI, mida ükski ajastus rikkuda ei tohi:
 *   A. `usedSeats <= seatLimit`
 *   B. lõpetatud plaanil EI OLE aktiivseid kohti
 *
 * Andmed: ainult `@sol-seat.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { assignSeat, createSeatPlan, endSeatPlan, updateSeatLimit } from "../lib/org/seats.js";
import { resolveOrgAccessContext } from "../lib/org/accessContext.js";

const SUFFIX = "@sol-seat.invalid";
const MARK = "(seat-sünteetiline)";
const NOW = new Date();
const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_SEATS_ENABLED: "1" };

let passed = 0;
let failed = 0;

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Hoiab tehingut lahti, kuni `release()` kutsutakse. */
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

/** Käivitab lubaduse ja ütleb, kas ta on juba lõppenud. */
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
    data: { email: `${local}-${Math.random().toString(36).slice(2, 8)}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW }
  });
}

async function makeOrg() {
  return prisma.organization.create({
    data: {
      displayName: `Kohamaja ${MARK}`,
      legalKind: "COMPANY",
      status: "ACTIVE",
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
}

async function addMember(org, user) {
  return prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: user.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
}

/** Uus maja + plaan + `seated` juba istuvat liiget + üks vaba kandidaat. */
async function freshScenario({ seatLimit, seated }) {
  const org = await makeOrg();
  const admin = await makeUser("admin");
  await addMember(org, admin);
  const plan = await createSeatPlan(
    org.id,
    { actorUserId: admin.id, seatRole: "SOCIAL_WORKER", seatLimit },
    { db: prisma }
  );
  for (let index = 0; index < seated; index += 1) {
    const sitting = await addMember(org, await makeUser(`sitting-${index}`));
    await assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: sitting.id }, { db: prisma });
  }
  const candidate = await addMember(org, await makeUser("candidate"));
  return { org, admin, plan, candidate };
}

/** Mõlemad invariandid korraga. */
async function assertInvariants(label, planId) {
  const plan = await prisma.organizationSeatPlan.findUnique({ where: { id: planId } });
  const used = await prisma.organizationSeatAssignment.count({
    where: { seatPlanId: planId, status: "ACTIVE" }
  });
  expect(`${label}: usedSeats <= seatLimit`, used <= plan.seatLimit, `used=${used} limit=${plan.seatLimit}`);
  if (plan.status === "ENDED") {
    expect(`${label}: lõpetatud plaanil ei ole aktiivseid kohti`, used === 0, `used=${used}`);
  }
  return { plan, used };
}

/**
 * Käivitab kaks võistlejat NII, et lukujärjekord on meie valitud.
 *
 * `first` alustab ja jõuab lukku ootama enne, kui `second` üldse käivitub;
 * mõlemad ootavad kolmandat, kes lukku hoiab. Kui kumbki EI OOTAKS, ei oleks
 * see test võistlus vaid kaks järjestikust kutset — seepärast mõõdame ootamist.
 */
async function race(label, planId, first, second) {
  const holder = holdOpen(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "OrganizationSeatPlan" WHERE "id" = ${planId} FOR UPDATE`;
  });
  await sleep(80);

  const a = watch(first());
  await sleep(120);
  const b = watch(second());
  await sleep(120);

  expect(`${label}: esimene võistleja OOTAB plaanirea lukku`, a.state.settled === false);
  expect(`${label}: teine võistleja OOTAB plaanirea lukku`, b.state.settled === false);

  holder.release();
  await holder.done;
  const [resultA, resultB] = await Promise.all([a.wrapped, b.wrapped]);
  return { resultA, resultB };
}

const isConflict = (state, key) =>
  state.error?.status === 409 && (!key || state.error?.messageKey === key);

async function purge() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  const orgIds = orgs.map((row) => row.id);
  if (orgIds.length) {
    const plans = await prisma.organizationSeatPlan.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true }
    });
    const planIds = plans.map((row) => row.id);
    if (planIds.length) {
      await prisma.organizationSeatAssignment.deleteMany({ where: { seatPlanId: { in: planIds } } });
      await prisma.organizationSeatPlan.deleteMany({ where: { id: { in: planIds } } });
    }
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-ORG-05 — kohaplaani võistlused päris PostgreSQL-is\n");
  await purge();

  // === 1. ASSIGN vs LIMIT DECREASE, kohaandmine EES ========================
  {
    const { org, admin, plan, candidate } = await freshScenario({ seatLimit: 2, seated: 1 });
    const { resultA, resultB } = await race(
      "assign→limit",
      plan.id,
      () => assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: candidate.id }, { db: prisma }),
      () => updateSeatLimit(org.id, plan.id, { actorUserId: admin.id, seatLimit: 1 }, { db: prisma })
    );
    expect("assign→limit: kohaandmine õnnestub (limiit oli veel 2)", Boolean(resultA.value?.id), String(resultA.error?.messageKey));
    /* SEE ON LEID ISE: vana kood luges limiiti ENNE lukku ja langetus läks läbi
       ka siis, kui vahepeal oli koht juurde tulnud. */
    expect(
      "assign→limit: limiidi langetus KUKUB, sest kohti on juba rohkem",
      isConflict(resultB, "org.errors.seat_limit_below_used"),
      String(resultB.error?.messageKey || resultB.value?.seatLimit)
    );
    await assertInvariants("assign→limit", plan.id);
  }

  // === 2. ASSIGN vs LIMIT DECREASE, langetus EES ===========================
  {
    const { org, admin, plan, candidate } = await freshScenario({ seatLimit: 2, seated: 1 });
    const { resultA, resultB } = await race(
      "limit→assign",
      plan.id,
      () => updateSeatLimit(org.id, plan.id, { actorUserId: admin.id, seatLimit: 1 }, { db: prisma }),
      () => assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: candidate.id }, { db: prisma })
    );
    expect("limit→assign: langetus õnnestub", resultA.value?.seatLimit === 1, String(resultA.error?.messageKey));
    expect(
      "limit→assign: kohaandmine KUKUB uue limiidi vastu, mitte vana vastu",
      isConflict(resultB, "org.errors.seat_limit_reached"),
      String(resultB.error?.messageKey || resultB.value?.id)
    );
    await assertInvariants("limit→assign", plan.id);
  }

  // === 3. ASSIGN vs END PLAN, kohaandmine EES ==============================
  {
    const { org, admin, plan, candidate } = await freshScenario({ seatLimit: 5, seated: 1 });
    const { resultA, resultB } = await race(
      "assign→end",
      plan.id,
      () => assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: candidate.id }, { db: prisma }),
      () => endSeatPlan(org.id, plan.id, { actorUserId: admin.id, reason: "proov" }, { db: prisma })
    );
    expect("assign→end: kohaandmine õnnestub (plaan oli veel aktiivne)", Boolean(resultA.value?.id));
    expect("assign→end: plaan lõpetatakse", resultB.value?.status === "ENDED", String(resultB.error?.messageKey));
    /* Just siin sündis vana koodiga rippuv koht: `updateMany` jooksis enne, kui
       kohaandmine oma rea sisse kirjutas, ja uus koht jäi lõpetatud plaani alla. */
    await assertInvariants("assign→end", plan.id);
  }

  // === 4. ASSIGN vs END PLAN, lõpetamine EES ==============================
  {
    const { org, admin, plan, candidate } = await freshScenario({ seatLimit: 5, seated: 1 });
    const { resultA, resultB } = await race(
      "end→assign",
      plan.id,
      () => endSeatPlan(org.id, plan.id, { actorUserId: admin.id, reason: "proov" }, { db: prisma }),
      () => assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: candidate.id }, { db: prisma })
    );
    expect("end→assign: plaan lõpetatakse", resultA.value?.status === "ENDED");
    expect(
      "end→assign: kohaandmine KUKUB lõpetatud plaani vastu",
      isConflict(resultB, "org.errors.seat_plan_not_active"),
      String(resultB.error?.messageKey || resultB.value?.id)
    );
    await assertInvariants("end→assign", plan.id);
  }

  // === 5. MAKSJA NÕUAB KEHTIVAT VANEMPLAANI ===============================
  /* Rida tehakse otse, sest teenuskiht ei loo seda seisu enam ise — aga
     ajaloos võib ta olemas olla ja maksjatõde ei tohi selle peale lahku minna. */
  {
    const { org, admin, plan } = await freshScenario({ seatLimit: 3, seated: 0 });
    const seated = await addMember(org, await makeUser("payer"));
    const membershipUser = await prisma.organizationMembership.findUnique({
      where: { id: seated.id },
      select: { userId: true }
    });
    await assignSeat(org.id, { actorUserId: admin.id, seatPlanId: plan.id, membershipId: seated.id }, { db: prisma });

    const before = await resolveOrgAccessContext(
      { userId: membershipUser.userId, requestedOrganizationId: org.id },
      { db: prisma, env: ENV, now: NOW }
    );
    expect("aktiivse plaani all on maksja ORGANIZATION", before.payerSource === "ORGANIZATION", before.payerSource);

    /* Plaan lõpetatakse KIRJE tasemel, kohta puutumata — täpselt see vastuoluline
       seis, mille vana kood võistlusega tekitas. */
    await prisma.organizationSeatPlan.update({
      where: { id: plan.id },
      data: { status: "ENDED", validUntil: new Date(NOW.getTime() - 1000) }
    });
    const after = await resolveOrgAccessContext(
      { userId: membershipUser.userId, requestedOrganizationId: org.id },
      { db: prisma, env: ENV, now: NOW }
    );
    expect("lõpetatud plaani all EI OLE maksja ORGANIZATION", after.payerSource !== "ORGANIZATION", after.payerSource);
    expect("lõpetatud plaani all ei ole ka kohta kontekstis", after.seat === null, JSON.stringify(after.seat));

    /* AEGUNUD, aga veel ACTIVE plaan on sama küsimus teisest otsast: `validUntil`
       möödas tähendab, et tellimus on läbi, ka siis kui keegi pole plaani veel
       lõpetanud. */
    await prisma.organizationSeatPlan.update({
      where: { id: plan.id },
      data: { status: "ACTIVE", validUntil: new Date(NOW.getTime() - 1000) }
    });
    const expired = await resolveOrgAccessContext(
      { userId: membershipUser.userId, requestedOrganizationId: org.id },
      { db: prisma, env: ENV, now: NOW }
    );
    expect("aegunud plaan ei tee organisatsioonist maksjat", expired.payerSource !== "ORGANIZATION", expired.payerSource);
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
