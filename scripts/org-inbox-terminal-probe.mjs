#!/usr/bin/env node
/**
 * SOL-ORG-08 — terminalkirjel ei ole elavat määramist ega uut lugejat.
 *
 *   npm run org:inbox:probe
 *
 * KAKS ERI KÜSIMUST, mida ei tohi kokku ajada:
 *   1. **Seis** — kas suletud, tagasivõetud või tagasi lükatud kirjele saab
 *      tööd määrata, vastata või seda edasi anda? Vastus peab olema „ei" iga
 *      terminalseisu korral, mitte ainult selle korral, mida keegi katsetas.
 *   2. **Võistlus** — kas sulgemine ja määramine korraga võivad anda
 *      terminalkirje, millel on ikkagi elav vastutaja?
 *
 * VÕISTLUS ON DETERMINISTLIK: kolmas tehing hoiab kirje rea lukku, mõlemad
 * võistlejad käivitatakse ja MÕÕDETAKSE, et nad ootavad, siis lukk lastakse
 * lahti ja Postgres annab ta ootejärjekorra järjekorras.
 *
 * LÕPPINVARIANT on iga stsenaariumi järel sama: terminalseisus kirjel ei ole
 * ühtki `PENDING`/`ACCEPTED` määramist — ehk mitte ühtki uut lugejat.
 *
 * Andmed: ainult `@sol-inbox.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { resolveOrgAccessContext } from "../lib/org/accessContext.js";
import {
  assignWork,
  deliverPreInquiryToOrganization,
  handOverWork,
  recallInboxItemForSource,
  respondToAssignment,
  transitionInboxItem
} from "../lib/org/inbox.js";

const SUFFIX = "@sol-inbox.invalid";
const MARK = "(inbox-sünteetiline)";
const NOW = new Date();
const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_INBOX_ENABLED: "1", ORG_SEATS_ENABLED: "1" };

let passed = 0;
let failed = 0;
let seq = 0;

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
  seq += 1;
  return prisma.user.create({
    data: { email: `${local}-${seq}${SUFFIX}`, role: "SOCIAL_WORKER", emailVerified: NOW }
  });
}

async function context(userId, organizationId) {
  return resolveOrgAccessContext(
    { userId, requestedOrganizationId: organizationId },
    { db: prisma, env: ENV, now: NOW }
  );
}

/**
 * Uus maja, koordinaator (kes on ühtlasi määraja), kaks töötajat ja üks
 * kohale toimetatud pöördumine.
 */
async function freshInbox() {
  const org = await prisma.organization.create({
    data: {
      displayName: `Postkastimaja ${MARK}`,
      legalKind: "MUNICIPALITY",
      status: "ACTIVE",
      verifiedAt: NOW,
      activatedAt: NOW
    }
  });
  await prisma.organizationModule.create({
    data: {
      organizationId: org.id,
      moduleKey: "KOV_INTAKE",
      status: "ACTIVE",
      validFrom: new Date(NOW.getTime() - 60_000)
    }
  });

  const coordinator = await makeUser("coord");
  const coordMembership = await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: coordinator.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  for (const capability of ["INBOX_COORDINATOR", "WORK_ASSIGNER"]) {
    await prisma.organizationCapabilityGrant.create({
      data: {
        membershipId: coordMembership.id,
        capability,
        scopeType: "ORGANIZATION",
        validFrom: new Date(NOW.getTime() - 60_000)
      }
    });
  }

  const workerA = await makeUser("worker-a");
  const workerB = await makeUser("worker-b");
  const memberA = await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: workerA.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });
  const memberB = await prisma.organizationMembership.create({
    data: { organizationId: org.id, userId: workerB.id, status: "ACTIVE", seatRole: "SOCIAL_WORKER" }
  });

  const author = await makeUser("author");
  const inquiry = await prisma.preInquiry.create({
    data: {
      authorId: author.id,
      recipientType: "ORGANIZATION_INBOX",
      recipientOrganizationId: org.id,
      situation: `Olukorra kirjeldus ${MARK}`,
      status: "SENT",
      sentAt: NOW
    }
  });
  const item = await deliverPreInquiryToOrganization(
    { preInquiryId: inquiry.id, organizationId: org.id },
    { db: prisma, now: NOW }
  );

  return {
    org,
    inquiry,
    item,
    coordCtx: await context(coordinator.id, org.id),
    aCtx: await context(workerA.id, org.id),
    bCtx: await context(workerB.id, org.id),
    memberA,
    memberB
  };
}

/** Terminalkirjel ei tohi olla ühtki elavat määramist. */
async function assertNoLiveAssignment(label, itemId) {
  const item = await prisma.organizationInboxItem.findUnique({ where: { id: itemId } });
  const live = await prisma.organizationWorkAssignment.count({
    where: { inboxItemId: itemId, status: { in: ["PENDING", "ACCEPTED"] } }
  });
  expect(`${label}: terminalkirjel (${item.status}) ei ole elavat määramist`, live === 0, `elavaid ${live}`);
  return item;
}

async function race(label, itemId, first, second) {
  const holder = holdOpen(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "OrganizationInboxItem" WHERE "id" = ${itemId} FOR UPDATE`;
  });
  await sleep(80);

  const a = watch(first());
  await sleep(120);
  const b = watch(second());
  await sleep(120);

  expect(`${label}: esimene võistleja OOTAB kirje rea lukku`, a.state.settled === false);
  expect(`${label}: teine võistleja OOTAB kirje rea lukku`, b.state.settled === false);

  holder.release();
  await holder.done;
  const [resultA, resultB] = await Promise.all([a.wrapped, b.wrapped]);
  return { resultA, resultB };
}

async function purge() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  const orgIds = orgs.map((row) => row.id);
  if (orgIds.length) {
    const items = await prisma.organizationInboxItem.findMany({
      where: { organizationId: { in: orgIds } },
      select: { id: true }
    });
    const itemIds = items.map((row) => row.id);
    if (itemIds.length) {
      await prisma.organizationWorkAssignment.deleteMany({ where: { inboxItemId: { in: itemIds } } });
      await prisma.organizationInboxItem.deleteMany({ where: { id: { in: itemIds } } });
    }
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  }
  await prisma.preInquiry.deleteMany({ where: { situation: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-ORG-08 — terminalkirjel ei ole elavat vastutajat\n");
  await purge();

  // === 1. IGA TERMINALSEIS ERALDI ========================================
  /* „Suletud" ei ole üks seis, vaid kolm eri sündmust: organisatsioon lõpetas,
     organisatsioon lükkas tagasi, saatja võttis tagasi. Kõik kolm peavad
     andma sama vastuse. */
  for (const terminal of ["CLOSED", "REJECTED", "RECALLED"]) {
    const { org, inquiry, item, coordCtx, memberA } = await freshInbox();

    if (terminal === "RECALLED") {
      await recallInboxItemForSource(
        { sourceId: inquiry.id, sourceType: "PRE_INQUIRY" },
        { db: prisma, now: NOW }
      );
    } else if (terminal === "REJECTED") {
      await transitionInboxItem(coordCtx, item.id, { toStatus: "REJECTED" }, { db: prisma, now: NOW });
    } else {
      /* `CLOSED`-isse pääseb ainult `ASSIGNED`/`ACCEPTED` seisust — sulgemine
         eeldab, et keegi tööd tegi. Määrame ja siis sulgeme. */
      await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });
      await transitionInboxItem(coordCtx, item.id, { toStatus: "CLOSED" }, { db: prisma, now: NOW });
    }

    const row = await prisma.organizationInboxItem.findUnique({ where: { id: item.id } });
    expect(`${terminal}: kirje on selles seisus`, row.status === terminal, row.status);

    try {
      await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });
      bad(`${terminal}: määramine läks läbi`);
    } catch (error) {
      expect(
        `${terminal}: uut vastutajat ei saa määrata`,
        error?.status === 409 && error?.messageKey === "org.errors.inbox_item_terminal",
        `${error?.status} ${error?.messageKey}`
      );
    }
    await assertNoLiveAssignment(terminal, item.id);
    /* Organisatsioon on alles — sond ei tohi jätta poolikut maja. */
    expect(`${terminal}: maja jäi alles`, Boolean(await prisma.organization.findUnique({ where: { id: org.id } })));
  }

  // === 2. ASSIGN vs RECALL, mõlemas ajastuses ============================
  /* Tagasivõtmine on ainus lõpetamine, mis on lubatud IGAST seisust — seega on
     ta ainus, millega saab määramist mõlemas ajastuses ausalt võrrelda.
     Sulgemine nõuab `ASSIGNED`/`ACCEPTED` seisu ja käib allpool vastamise vastu. */
  for (const order of ["assign", "recall"]) {
    const label = order === "assign" ? "assign→recall" : "recall→assign";
    const { inquiry, item, coordCtx, memberA } = await freshInbox();

    const assign = () =>
      assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });
    const recall = () =>
      recallInboxItemForSource({ sourceId: inquiry.id, sourceType: "PRE_INQUIRY" }, { db: prisma, now: NOW });

    const { resultA, resultB } = await race(
      label,
      item.id,
      order === "assign" ? assign : recall,
      order === "assign" ? recall : assign
    );
    expect(`${label}: esimene võistleja õnnestub`, !resultA.error, String(resultA.error?.messageKey));
    if (order === "recall") {
      expect(
        `${label}: tagasivõtmise järel määramine KUKUB`,
        resultB.error?.messageKey === "org.errors.inbox_item_terminal",
        String(resultB.error?.messageKey || resultB.value?.id)
      );
    } else {
      expect(`${label}: tagasivõtmine õnnestub ka määratud tööl`, !resultB.error, String(resultB.error?.messageKey));
    }
    /* MÕLEMAS ajastuses sama lõppseis: kirje on tagasi võetud ja tal EI OLE
       vastutajat. Just see paar läks vana koodiga lahku. */
    const row = await assertNoLiveAssignment(label, item.id);
    expect(`${label}: lõppseis on RECALLED`, row.status === "RECALLED", row.status);
  }

  // === 2b. RESPOND vs CLOSE, mõlemas ajastuses ===========================
  for (const order of ["respond", "close"]) {
    const label = order === "respond" ? "respond→close" : "close→respond";
    const { item, coordCtx, aCtx, memberA } = await freshInbox();
    const assignment = await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });

    const respond = () => respondToAssignment(aCtx, assignment.id, { accept: true }, { db: prisma, now: NOW });
    const close = () => transitionInboxItem(coordCtx, item.id, { toStatus: "CLOSED" }, { db: prisma, now: NOW });

    const { resultA, resultB } = await race(
      label,
      item.id,
      order === "respond" ? respond : close,
      order === "respond" ? close : respond
    );
    expect(`${label}: esimene võistleja õnnestub`, !resultA.error, String(resultA.error?.messageKey));
    if (order === "close") {
      expect(
        `${label}: suletud kirjel ei saa tööd vastu võtta`,
        resultB.error?.messageKey === "org.errors.inbox_item_terminal",
        String(resultB.error?.messageKey || resultB.value?.status)
      );
    }
    const row = await assertNoLiveAssignment(label, item.id);
    expect(`${label}: lõppseis on CLOSED`, row.status === "CLOSED", row.status);
  }

  // === 3. RESPOND vs RECALL ==============================================
  {
    const { inquiry, item, coordCtx, aCtx, memberA } = await freshInbox();
    const assignment = await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await race(
      "recall→respond",
      item.id,
      () => recallInboxItemForSource({ sourceId: inquiry.id, sourceType: "PRE_INQUIRY" }, { db: prisma, now: NOW }),
      () => respondToAssignment(aCtx, assignment.id, { accept: true }, { db: prisma, now: NOW })
    );
    expect("recall→respond: tagasivõtmine õnnestub", !resultA.error, String(resultA.error?.messageKey));
    /* SEE ON LEID ISE: vastuvõtmine ei tohi tagasivõetud tööd tagasi ellu
       äratada. */
    expect(
      "recall→respond: vastuvõtmine KUKUB",
      Boolean(resultB.error),
      String(resultB.value && JSON.stringify(resultB.value))
    );
    await assertNoLiveAssignment("recall→respond", item.id);
  }

  // === 4. HANDOVER vs RESPOND — sama määramine, kaks otsust ==============
  /* Üleandmine EI tee kirjet terminaalseks, seega siin ei aita „terminalseisu"
     värav: ainus kaitse on määramise enda elususe tingimus. */
  {
    const { item, coordCtx, aCtx, memberA, memberB } = await freshInbox();
    const assignment = await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await race(
      "handover→respond",
      item.id,
      () => handOverWork(coordCtx, assignment.id, { toMembershipId: memberB.id }, { db: prisma, now: NOW }),
      () => respondToAssignment(aCtx, assignment.id, { accept: true }, { db: prisma, now: NOW })
    );
    expect("handover→respond: üleandmine õnnestub", !resultA.error, String(resultA.error?.messageKey));
    expect(
      "handover→respond: äraantud määramist ei saa enam vastu võtta",
      resultB.error?.messageKey === "org.errors.work_assignment_not_pending",
      String(resultB.error?.messageKey || resultB.value?.status)
    );

    const live = await prisma.organizationWorkAssignment.findMany({
      where: { inboxItemId: item.id, status: { in: ["PENDING", "ACCEPTED"] } },
      select: { id: true, assigneeMembershipId: true }
    });
    expect("handover→respond: elavaid määramisi on TÄPSELT ÜKS", live.length === 1, `${live.length}`);
    expect("handover→respond: elav määramine kuulub uuele vastutajale", live[0]?.assigneeMembershipId === memberB.id);
  }

  // === 5. KAKS ÜLEANDMIST SAMAST MÄÄRAMISEST =============================
  {
    const { item, coordCtx, memberA, memberB } = await freshInbox();
    const assignment = await assignWork(coordCtx, item.id, { assigneeMembershipId: memberA.id }, { db: prisma, now: NOW });
    const handover = () =>
      handOverWork(coordCtx, assignment.id, { toMembershipId: memberB.id }, { db: prisma, now: NOW });

    const { resultA, resultB } = await race("handover×2", item.id, handover, handover);
    const winners = [resultA, resultB].filter((result) => !result.error).length;
    expect("handover×2: täpselt üks üleandmine õnnestub", winners === 1, `võitjaid ${winners}`);
    expect(
      "handover×2: kaotaja saab konflikti, mitte unikaalindeksi viga",
      resultB.error?.messageKey === "org.errors.work_assignment_not_live",
      String(resultB.error?.messageKey || resultB.error?.code)
    );

    const live = await prisma.organizationWorkAssignment.count({
      where: { inboxItemId: item.id, status: { in: ["PENDING", "ACCEPTED"] } }
    });
    expect("handover×2: elavaid määramisi on TÄPSELT ÜKS", live === 1, `${live}`);
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
