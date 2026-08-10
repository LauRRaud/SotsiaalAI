#!/usr/bin/env node
/**
 * SOL-PRE-02 — tagasivõetud pöördumine ei anna sisu ega tööd.
 *
 *   npm run org:recall:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: reaLUKKU, READ COMMITTED
 * uuestihindamist ja kahte samaaegset kirjutajat sama postkastikirje peal.
 * Fake-Prisma ei modelleeri kumbagi — tema all läheks katkine kood roheliseks.
 *
 * VÕISTLUSED ON DETERMINISTLIKUD, mitte „käivita kaks korraga ja loodame".
 * Muster: hoia tehingut lahti, mis on luku juba võtnud, käivita teine pool,
 * mõõda et ta OOTAB, siis lase lukk lahti ja mõõda tulemust. `Promise.all`
 * üksi tõendaks ainult seda, et kaks asja mahtusid ühte sekundisse.
 *
 * Andmed: ainult `@sol-pre02.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import { resolveOrgAccessContext } from "../lib/org/accessContext.js";
import { activateModule, changeOrganizationStatus, createOrganization } from "../lib/org/organizations.js";
import { createUnit } from "../lib/org/structure.js";
import { grantCapability } from "../lib/org/members.js";
import { acceptInvite, createInvite } from "../lib/org/inviteService.js";
import {
  assignWork,
  getInboxItem,
  handOverWork,
  listInboxItems,
  recallInboxItemForSourceWithin,
  respondToAssignment,
  transitionInboxItem
} from "../lib/org/inbox.js";
import { createPreInquiry, recallPreInquiry } from "../lib/preInquiries.js";

const ENV = { ORG_WORKSPACE_ENABLED: "1", ORG_CREATION_ENABLED: "1", ORG_SEATS_ENABLED: "1", ORG_INBOX_ENABLED: "1" };
Object.assign(process.env, ENV);

const SUFFIX = "@sol-pre02.invalid";
const MARK = "(pre02-sünteetiline)";
const SECRET = "SALAJANE-OLUKORD-PRE02";
const URGENCY = "SAATJA-KIIRUSMÄRGE-PRE02";

let passed = 0;
let failed = 0;
const created = { userIds: [], organizationIds: [] };

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function expectReject(label, promise, predicate) {
  try {
    await promise;
    bad(label, "expected rejection, got success");
  } catch (error) {
    if (predicate && !predicate(error)) return bad(label, error?.messageKey || error?.code || error?.message);
    ok(label);
  }
}

async function makeUser(local, role) {
  const user = await prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role, emailVerified: new Date(), acceptsPreInquiries: false }
  });
  created.userIds.push(user.id);
  return user;
}

async function ctx(userId, organizationId) {
  return resolveOrgAccessContext(
    { userId, requestedOrganizationId: organizationId, productRole: "SOCIAL_WORKER" },
    { env: ENV }
  );
}

/** Saadab uue pöördumise organisatsiooni lauale ja annab kirje + pöördumise. */
async function deliverFresh(citizenId, organizationId, unitId, { topic }) {
  await createPreInquiry(citizenId, {
    recipientOrganizationId: organizationId,
    topic,
    situation: `${SECRET} — ${topic}`,
    status: "SENT"
  });
  const inquiry = await prisma.preInquiry.findFirst({
    where: { authorId: citizenId, topic },
    orderBy: { createdAt: "desc" }
  });
  const item = await prisma.organizationInboxItem.update({
    where: {
      organizationId_sourceType_sourceId: {
        organizationId,
        sourceType: "PRE_INQUIRY",
        sourceId: inquiry.id
      }
    },
    /* Kiireloomulisuse märge on saatja oma tekst. Kohaletoimetamise rada ei
       täida teda täna ise, aga väli ON API-s — seega paneme ta käsitsi peale,
       et tõendada, kas ta tagasivõtmise järel lekib. */
    data: { unitId, urgencyDeclaredBySender: URGENCY }
  });
  return { inquiry, item };
}

/** Tagasivõtmine ilma pöörduja rajata — vajalik luku-stsenaariumides. */
async function recallInsideTransaction(tx, inquiryId, now) {
  await tx.preInquiry.updateMany({
    where: { id: inquiryId, openedAt: null, recalledAt: null },
    data: { recalledAt: now, updatedAt: now }
  });
  await recallInboxItemForSourceWithin(tx, { sourceId: inquiryId }, { now });
}

async function purgeStale() {
  const orgs = await prisma.organization.findMany({
    where: { displayName: { contains: MARK } },
    select: { id: true }
  });
  for (const org of orgs) {
    await prisma.organizationWorkAssignment.deleteMany({ where: { inboxItem: { organizationId: org.id } } });
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: org.id } }
    });
  }
  await prisma.preInquiry.deleteMany({ where: { author: { email: { endsWith: SUFFIX } } } });
  await prisma.organization.deleteMany({ where: { displayName: { contains: MARK } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: SUFFIX } } });
}

async function main() {
  console.log("SOL-PRE-02 — recall means recalled\n");
  await purgeStale();

  const owner = await makeUser("owner", "SOCIAL_WORKER");
  const worker = await makeUser("worker", "SOCIAL_WORKER");
  const second = await makeUser("second", "SOCIAL_WORKER");
  const citizen = await makeUser("citizen", "CLIENT");

  const { organization: org } = await createOrganization({
    userId: owner.id,
    productRole: "SOCIAL_WORKER",
    displayName: `Y vald ${MARK}`,
    legalKind: "MUNICIPALITY"
  });
  created.organizationIds.push(org.id);
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, toStatus: "PENDING_VERIFICATION" });
  await changeOrganizationStatus(org.id, { actorUserId: owner.id, isPlatformAdmin: true, toStatus: "ACTIVE" });
  await activateModule(org.id, { actorUserId: owner.id, moduleKey: "KOV_INTAKE" });

  const team = await createUnit(org.id, { actorUserId: owner.id, name: "Tiim", type: "TEAM" });

  const invite = await createInvite(org.id, {
    actorUserId: owner.id,
    email: worker.email,
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "MEMBER",
    primaryUnitId: team.id
  });
  const workerMembership = (await acceptInvite(invite.rawToken, { userId: worker.id, userEmail: worker.email }))
    .membership;

  const invite2 = await createInvite(org.id, {
    actorUserId: owner.id,
    email: second.email,
    seatRole: "SOCIAL_WORKER",
    capabilityTemplate: "MEMBER",
    primaryUnitId: team.id
  });
  const secondMembership = (await acceptInvite(invite2.rawToken, { userId: second.id, userEmail: second.email }))
    .membership;

  const ownerMembership = await prisma.organizationMembership.findFirst({
    where: { organizationId: org.id, userId: owner.id, status: "ACTIVE" }
  });
  for (const capability of ["INBOX_COORDINATOR", "WORK_ASSIGNER"]) {
    await grantCapability(org.id, ownerMembership.id, {
      actorUserId: owner.id,
      capability,
      scopeType: "UNIT",
      scopeUnitId: team.id
    });
  }
  const coord = await ctx(owner.id, org.id);

  // === 1. NEGATIIVKONTROLL — ilma tagasivõtmiseta peab kõik töötada ========
  /* Ilma selleta ei tõenda ükski allolev keeld midagi: kood, mis keelab KÕIK,
     läbiks iga keelutesti. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Kontroll" });
    const opened = await getInboxItem(coord, item.id);
    expect("negative control — an ordinary item still carries the sender's package", opened.source?.situation?.includes(SECRET));
    expect("negative control — the sender's urgency note is visible", opened.urgencyDeclaredBySender === URGENCY);
    expect("negative control — nothing is withheld", opened.sourceWithheldReason === null);

    const afterOpen = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("negative control — opening stamps openedAt", Boolean(afterOpen.openedAt));

    const assignment = await assignWork(coord, item.id, { assigneeMembershipId: workerMembership.id });
    expect("negative control — work can be assigned", assignment.status === "PENDING");
    await respondToAssignment(await ctx(worker.id, org.id), assignment.id, { accept: true });
    const handed = await handOverWork(coord, assignment.id, { toMembershipId: secondMembership.id });
    expect("negative control — work can be handed over", handed.supersedesAssignmentId === assignment.id);
  }

  // === 2. TAGASIVÕETUD KIRJE DETAIL =======================================
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Tagasivõetud" });
    const before = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    await recallPreInquiry(citizen.id, inquiry.id, { expectedUpdatedAt: before.updatedAt });

    const detail = await getInboxItem(coord, item.id);
    expect("a recalled item returns NO source package", detail.source === null);
    expect("a recalled item names why the content is missing", detail.sourceWithheldReason === "RECALLED");
    expect("a recalled item carries the recall timestamp as history", detail.recalledAt instanceof Date);
    expect("a recalled item withholds the sender's urgency note", detail.urgencyDeclaredBySender === null);
    expect(
      "NOTHING in the whole detail response contains the sender's words",
      !JSON.stringify(detail).includes(SECRET) && !JSON.stringify(detail).includes(URGENCY)
    );

    const afterRead = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("opening a recalled item does NOT stamp openedAt", afterRead.openedAt === null);

    const row = await prisma.organizationInboxItem.findUnique({ where: { id: item.id } });
    expect("recall wipes the sender's urgency copy from the organisation's own table", row.urgencyDeclaredBySender === null);
    expect("the inbox item itself is RECALLED", row.status === "RECALLED");

    const history = await listInboxItems(coord, { includeClosed: true });
    const listed = history.find((entry) => entry.id === item.id);
    expect("the recalled item stays visible in the closed-history list", Boolean(listed));
    expect("the history list carries no sender text", listed && listed.urgencyDeclaredBySender === null);
    const open = await listInboxItems(coord);
    expect("the recalled item is gone from the working list", !open.some((entry) => entry.id === item.id));

    // Töörajad
    await expectReject(
      "assigning work on a recalled item is refused",
      assignWork(coord, item.id, { assigneeMembershipId: workerMembership.id }),
      (e) => e.status === 409 && e.messageKey === "org.errors.inbox_item_terminal"
    );
    expect(
      "no assignment row was created by the refused attempt",
      (await prisma.organizationWorkAssignment.count({ where: { inboxItemId: item.id } })) === 0
    );
    await expectReject(
      "a status transition on a recalled item is refused",
      transitionInboxItem(coord, item.id, { toStatus: "REVIEWING" }),
      (e) => e.status === 409 && e.messageKey === "org.errors.inbox_item_terminal"
    );
    await expectReject(
      "closing a recalled item is refused too — terminal is terminal",
      transitionInboxItem(coord, item.id, { toStatus: "CLOSED" }),
      (e) => e.status === 409
    );
  }

  // === 3. MÄÄRATUD TÖÖ, MIS SEEJÄREL TAGASI VÕETAKSE ======================
  /* Määramine ei ava paketti, seega tagasivõtmine on siin endiselt lubatud.
     See on päris stsenaarium: koordinaator jagas töö ära, pöörduja mõtles ümber. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Määratud" });
    const assignment = await assignWork(coord, item.id, { assigneeMembershipId: workerMembership.id });

    const before = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    await recallPreInquiry(citizen.id, inquiry.id, { expectedUpdatedAt: before.updatedAt });

    const closed = await prisma.organizationWorkAssignment.findUnique({ where: { id: assignment.id } });
    expect("recall ends the live assignment", closed.status === "ENDED");

    const assigneeCtx = await ctx(worker.id, org.id);
    await expectReject(
      "the assignee can no longer accept the work",
      respondToAssignment(assigneeCtx, assignment.id, { accept: true }),
      (e) => e.status === 409 && e.messageKey === "org.errors.inbox_item_terminal"
    );
    await expectReject(
      "the work cannot be handed over to anyone else",
      handOverWork(coord, assignment.id, { toMembershipId: secondMembership.id }),
      (e) => e.status === 409 && e.messageKey === "org.errors.inbox_item_terminal"
    );

    /* Määratud töötaja on kirje NÄHTAV isik ka pärast tagasivõtmist (tema
       määramine on ajalugu). Ta ei tohi näha sisu rohkem kui koordinaator. */
    const assigneeDetail = await getInboxItem(assigneeCtx, item.id).catch((e) => e);
    expect(
      "the former assignee sees no content either",
      assigneeDetail?.source === null || assigneeDetail?.status === 404,
      JSON.stringify(assigneeDetail?.source || assigneeDetail?.messageKey || null)
    );
  }

  // === 4. VÕISTLUS: tagasivõtmine JÕUAB ENNE avamist ======================
  /* Deterministlik: hoiame tehingut, mis on `PreInquiry` rea luku juba võtnud,
     ja käivitame avamise. Avamise `updateMany` peab OOTAMA — ja pärast luku
     vabanemist hindama tingimust uuesti, mitte kirjutama vana tõe pealt. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Võistlus-avamine" });

    let release;
    const held = new Promise((resolve) => { release = resolve; });
    let holderDone = false;
    const holder = prisma
      .$transaction(
        async (tx) => {
          await recallInsideTransaction(tx, inquiry.id, new Date());
          await held;
        },
        { timeout: 30000 }
      )
      .then(() => { holderDone = true; });

    await sleep(150);
    let openSettled = false;
    const openPromise = getInboxItem(coord, item.id).then(
      (value) => { openSettled = true; return value; },
      (error) => { openSettled = true; return error; }
    );
    await sleep(400);
    expect(
      "the open path BLOCKS on the row lock instead of racing past it",
      !openSettled && !holderDone
    );

    release();
    await holder;
    const detail = await openPromise;
    expect("after the recall commits, the open returns no content", detail?.source === null);
    expect("after the recall commits, the open names the reason", detail?.sourceWithheldReason === "RECALLED");
    const row = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("the losing open did NOT stamp openedAt", row.openedAt === null);
    expect("the recall stands", Boolean(row.recalledAt));
  }

  // === 5. VÕISTLUS: avamine JÕUAB ENNE tagasivõtmist ======================
  /* Vastupidine järjestus. Siin peab võitma AVAMINE: sisu läheb välja, sest
     keegi luges ta enne tagasivõtmist, ja pöörduja saab ausa 409 „juba avatud",
     mitte vaikse õnnestumise. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Võistlus-tagasivõtmine" });
    const before = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });

    const detail = await getInboxItem(coord, item.id);
    expect("the winning open receives the package", detail.source?.situation?.includes(SECRET));

    await expectReject(
      "the recall loses and says so — it does not silently succeed",
      recallPreInquiry(citizen.id, inquiry.id, { expectedUpdatedAt: before.updatedAt }),
      (e) => e.status === 409
    );
    const row = await prisma.preInquiry.findUnique({ where: { id: inquiry.id } });
    expect("the inquiry stays open, not recalled", Boolean(row.openedAt) && row.recalledAt === null);
    const itemRow = await prisma.organizationInboxItem.findUnique({ where: { id: item.id } });
    expect("the inbox item was not recalled behind the loser's back", itemRow.status !== "RECALLED");
  }

  // === 6. VÕISTLUS: määramine vs tagasivõtmine, mõlemad järjestused =======
  /* 6a. Tagasivõtmine võtab luku enne. Määramine peab ootama ja siis KUKKUMA. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Võistlus-määramine-A" });

    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const holder = prisma.$transaction(
      async (tx) => {
        await recallInsideTransaction(tx, inquiry.id, new Date());
        await held;
      },
      { timeout: 30000 }
    );

    await sleep(150);
    let assignSettled = false;
    const assignPromise = assignWork(coord, item.id, { assigneeMembershipId: workerMembership.id }).then(
      (value) => { assignSettled = true; return { okValue: value }; },
      (error) => { assignSettled = true; return { error }; }
    );
    await sleep(400);
    expect("the assign path BLOCKS on the inbox row lock", !assignSettled);

    release();
    await holder;
    const outcome = await assignPromise;
    expect(
      "recall-first: the assignment is refused as terminal",
      outcome.error?.status === 409 && outcome.error?.messageKey === "org.errors.inbox_item_terminal",
      outcome.error?.messageKey || "assign succeeded"
    );
    expect(
      "recall-first: NO live assignment exists on the recalled item",
      (await prisma.organizationWorkAssignment.count({
        where: { inboxItemId: item.id, status: { in: ["PENDING", "ACCEPTED"] } }
      })) === 0
    );
  }

  /* 6b. Määramine võtab luku enne. Tagasivõtmine peab ootama ja seejärel
     LÕPETAMA just tekkinud määramise — muidu jääks töö elama pöördumisele,
     mida enam ei ole. */
  {
    const { inquiry, item } = await deliverFresh(citizen.id, org.id, team.id, { topic: "Võistlus-määramine-B" });

    let release;
    const held = new Promise((resolve) => { release = resolve; });
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "OrganizationInboxItem" WHERE "id" = ${item.id} FOR UPDATE`;
        await tx.organizationWorkAssignment.create({
          data: {
            inboxItemId: item.id,
            assigneeMembershipId: workerMembership.id,
            status: "PENDING",
            assignedByUserId: owner.id,
            assignedAt: new Date()
          }
        });
        await tx.organizationInboxItem.update({
          where: { id: item.id },
          data: { status: "ASSIGNED", lastTransitionAt: new Date() }
        });
        await held;
      },
      { timeout: 30000 }
    );

    await sleep(150);
    let recallSettled = false;
    const recallPromise = prisma
      .$transaction(async (tx) => recallInsideTransaction(tx, inquiry.id, new Date()), { timeout: 30000 })
      .then(
        () => { recallSettled = true; return null; },
        (error) => { recallSettled = true; return error; }
      );
    await sleep(400);
    expect("the recall path BLOCKS behind the assigner's lock", !recallSettled);

    release();
    await holder;
    const recallError = await recallPromise;
    expect("assign-first: the recall still completes", !recallError, recallError?.message);
    expect(
      "assign-first: the assignment created under the lock is ENDED by the recall",
      (await prisma.organizationWorkAssignment.count({
        where: { inboxItemId: item.id, status: { in: ["PENDING", "ACCEPTED"] } }
      })) === 0
    );
    const row = await prisma.organizationInboxItem.findUnique({ where: { id: item.id } });
    expect("assign-first: the item ends RECALLED, not ASSIGNED", row.status === "RECALLED");
    const detail = await getInboxItem(coord, item.id);
    expect("assign-first: no content survives the race", detail.source === null);
  }
}

async function cleanup() {
  console.log("\ncleanup");
  for (const organizationId of created.organizationIds) {
    await prisma.organizationWorkAssignment.deleteMany({ where: { inboxItem: { organizationId } } });
    await prisma.dataAuditLog.deleteMany({
      where: { action: { startsWith: "org." }, meta: { path: ["organizationId"], equals: organizationId } }
    });
    await prisma.notificationEvent.deleteMany({ where: { workspaceId: organizationId } });
  }
  await prisma.notificationEvent.deleteMany({ where: { userId: { in: created.userIds } } });
  const inquiries = await prisma.preInquiry.deleteMany({ where: { authorId: { in: created.userIds } } });
  const orgs = created.organizationIds.length
    ? await prisma.organization.deleteMany({ where: { id: { in: created.organizationIds } } })
    : { count: 0 };
  const users = created.userIds.length
    ? await prisma.user.deleteMany({ where: { id: { in: created.userIds } } })
    : { count: 0 };
  console.log(`  removed ${orgs.count} organisations, ${users.count} users, ${inquiries.count} pre-inquiries`);
  console.log(
    `  leftovers: ${await prisma.organization.count({ where: { displayName: { contains: MARK } } })} organisations, ` +
      `${await prisma.user.count({ where: { email: { endsWith: SUFFIX } } })} users`
  );
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
