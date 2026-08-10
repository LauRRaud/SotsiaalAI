#!/usr/bin/env node
/**
 * SOL-NET-01 ja SOL-NET-02 — kinnitus viitab tekstile, mitte reale.
 *
 *   npm run net:share:probe
 *
 * MIDA SEE TÕENDAB, mida `npm test` ei saa: rea lukku, READ COMMITTED
 * uuestihindamist ja tehingu tagasikeeramist. Fake-klient ei modelleeri ühtki
 * neist — tema all läheks ka katkine kood roheliseks.
 *
 * VÕISTLUSED ON DETERMINISTLIKUD: hoia tehingut, mis on rea luku juba võtnud,
 * käivita teine pool, MÕÕDA ET TA OOTAB, lase lukk lahti, mõõda tulemust.
 * `Promise.all` tõendaks ainult seda, et kaks asja mahtusid ühte sekundisse.
 *
 * Andmed: ainult `@sol-net.invalid` sünteetilised kontod; skript koristab lõpus.
 */

import prisma from "../lib/prisma.js";
import {
  clientRespondToShare,
  computeShareContentHash,
  createNetworkShare,
  sendNetworkShare,
  submitToClient,
  updateNetworkShareDraft
} from "../lib/network/share.js";
import { createRoomForNetworkShare } from "../lib/network/shareRoom.js";

const SUFFIX = "@sol-net.invalid";
const CONFIRMED_TEXT = "KINNITATUD-TEKST-NET";
const SWAPPED_TEXT = "VAHETATUD-TEKST-NET";

let passed = 0;
let failed = 0;
const created = { userIds: [], shareIds: [], roomIds: [] };

const ok = (label) => { passed += 1; console.log(`  PASS  ${label}`); };
const bad = (label, detail) => { failed += 1; console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`); };
const expect = (label, cond, detail) => (cond ? ok(label) : bad(label, detail));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function makeUser(local, role) {
  const user = await prisma.user.create({
    data: { email: `${local}${SUFFIX}`, role, emailVerified: new Date(), acceptsPreInquiries: false }
  });
  created.userIds.push(user.id);
  return user;
}

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

async function purge() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: SUFFIX } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  if (ids.length) {
    const shares = await prisma.networkShare.findMany({
      where: { workerId: { in: ids } },
      select: { id: true, roomId: true }
    });
    const roomIds = shares.map((s) => s.roomId).filter(Boolean);
    await prisma.networkShare.deleteMany({ where: { workerId: { in: ids } } });
    if (roomIds.length) await prisma.room.deleteMany({ where: { id: { in: roomIds } } });
    await prisma.room.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.preInquiry.deleteMany({ where: { authorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
  }
}

let worker;
let client;
let recipient;

/** Uus jagamine seisus AWAITING_CLIENT. */
async function freshAwaiting(label) {
  const source = await prisma.preInquiry.create({
    data: {
      authorId: client.id,
      recipientOwnerId: worker.id,
      recipientType: "SERVICE_PROVIDER",
      status: "SENT",
      topic: `NET probe ${label}`,
      situation: "Sünteetiline lähtepöördumine võistlusprobe jaoks.",
      sentAt: new Date()
    }
  });
  const share = await createNetworkShare({
    prisma,
    workerId: worker.id,
    sourcePreInquiryId: source.id,
    recipientUserId: recipient.id,
    summaryText: `${CONFIRMED_TEXT} (${label})`,
    purpose: "Võlanõustaja kaasamine.",
    sharingBoundary: "Ainult võlaolukorra kokkuvõte.",
    participationEndsOn: "2026-12-31"
  });
  created.shareIds.push(share.id);
  await submitToClient({ prisma, shareId: share.id, workerId: worker.id });
  return prisma.networkShare.findUnique({ where: { id: share.id } });
}

async function main() {
  console.log("SOL-NET-01/-02 — kinnitus viitab tekstile\n");
  await purge();

  worker = await makeUser("worker", "SOCIAL_WORKER");
  client = await makeUser("client", "CLIENT");
  recipient = await makeUser("recipient", "SERVICE_PROVIDER");

  // === 0. NEGATIIVKONTROLL — terve rada peab endiselt lõpuni töötama ======
  {
    const share = await freshAwaiting("kontroll");
    const confirmed = await clientRespondToShare({
      prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED"
    });
    expect("negatiivkontroll — kinnitus õnnestub", confirmed.status === "CONFIRMED");
    expect(
      "negatiivkontroll — kinnitus salvestab MILLE ta kinnitas",
      confirmed.confirmedContentHash === confirmed.contentHash && Boolean(confirmed.contentHash)
    );
    const sent = await sendNetworkShare({
      prisma,
      shareId: share.id,
      workerId: worker.id,
      createRoom: ({ share: s, db }) => createRoomForNetworkShare({ share: s, db })
    });
    if (sent.roomId) created.roomIds.push(sent.roomId);
    expect("negatiivkontroll — saatmine õnnestub ja avab ruumi", sent.status === "SENT" && Boolean(sent.roomId));
    const members = await prisma.roomMember.count({ where: { roomId: sent.roomId } });
    expect("negatiivkontroll — ruumis on kolm osapoolt", members === 3, `${members}`);
  }

  // === 1. SOL-NET-01: muutmine JÕUAB ENNE kinnitust =======================
  {
    const share = await freshAwaiting("edit-enne-kinnitust");
    const holder = holdOpen((tx) =>
      updateNetworkShareDraft({
        prisma: tx, shareId: share.id, workerId: worker.id, summaryText: SWAPPED_TEXT
      })
    );
    await sleep(150);

    const confirm = watch(
      clientRespondToShare({ prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" })
    );
    await sleep(400);
    expect("kinnitus OOTAB rea luku taga, ei jookse mööda", !confirm.state.settled);

    holder.release();
    await holder.done;
    const result = await confirm.wrapped;

    expect(
      "muutmine enne: kinnitus lükatakse tagasi nimelise veaga",
      result.error?.code === "network_share.content_changed",
      result.error?.code || "kinnitus õnnestus"
    );
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    expect("muutmine enne: rida jääb mustandiks", row.status === "DRAFT", row.status);
    expect("muutmine enne: kinnitusaeg puudub", row.clientConfirmedAt === null);
    expect("muutmine enne: kinnitustõend puudub", row.confirmedContentHash === null);
    expect("muutmine enne: reas on UUS tekst", row.summaryText === SWAPPED_TEXT);
    expect(
      "muutmine enne: räsi vastab reas olevale tekstile",
      row.contentHash === computeShareContentHash(row)
    );
  }

  // === 2. SOL-NET-01 vastupidi: kinnitus JÕUAB ENNE muutmist ==============
  {
    const share = await freshAwaiting("kinnitus-enne-editi");
    const holder = holdOpen((tx) =>
      clientRespondToShare({ prisma: tx, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" })
    );
    await sleep(150);

    const edit = watch(
      updateNetworkShareDraft({ prisma, shareId: share.id, workerId: worker.id, summaryText: SWAPPED_TEXT })
    );
    await sleep(400);
    expect("muutmine OOTAB kinnituse luku taga", !edit.state.settled);

    holder.release();
    await holder.done;
    const result = await edit.wrapped;

    expect(
      "kinnitus enne: vana vaate pealt muutmine lükatakse tagasi",
      result.error?.code === "network_share.concurrent_change",
      result.error?.code || "muutmine õnnestus"
    );
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    expect("kinnitus enne: kinnitus jääb kehtima", row.status === "CONFIRMED");
    expect("kinnitus enne: tekst on see, mida klient kinnitas", row.summaryText.startsWith(CONFIRMED_TEXT));
    expect("kinnitus enne: tõend katab reas oleva teksti", row.confirmedContentHash === row.contentHash);
  }

  // === 3. SOL-NET-02: muutmine JÕUAB ENNE saatmist ========================
  {
    const share = await freshAwaiting("edit-enne-saatmist");
    await clientRespondToShare({ prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" });
    const roomsBefore = await prisma.room.count();

    const holder = holdOpen((tx) =>
      updateNetworkShareDraft({
        prisma: tx, shareId: share.id, workerId: worker.id, summaryText: SWAPPED_TEXT
      })
    );
    await sleep(150);

    const send = watch(
      sendNetworkShare({
        prisma,
        shareId: share.id,
        workerId: worker.id,
        createRoom: ({ share: s, db }) => createRoomForNetworkShare({ share: s, db })
      })
    );
    await sleep(400);
    expect("saatmine OOTAB rea luku taga", !send.state.settled);

    holder.release();
    await holder.done;
    const result = await send.wrapped;

    expect(
      "muutmine enne: saatmine lükatakse tagasi",
      result.error?.code === "network_share.concurrent_change",
      result.error?.code || "saatmine õnnestus"
    );
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    expect("muutmine enne: SENT rida EI TEKKINUD", row.status !== "SENT", row.status);
    expect("muutmine enne: saatmisaega ei ole", row.sentAt === null);
    const roomsAfter = await prisma.room.count();
    expect(
      "muutmine enne: kaotanud saatmine ei jätnud orbu ruumi",
      roomsAfter === roomsBefore,
      `${roomsBefore} -> ${roomsAfter}`
    );
  }

  // === 4. SOL-NET-02/-03: ruumi loomise tõrge keerab SENT-i tagasi ========
  {
    const share = await freshAwaiting("ruumi-torge");
    await clientRespondToShare({ prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" });
    const roomsBefore = await prisma.room.count();

    let threw = false;
    try {
      await sendNetworkShare({
        prisma,
        shareId: share.id,
        workerId: worker.id,
        createRoom: async () => { throw new Error("INJECTED_ROOM_FAILURE"); }
      });
    } catch {
      threw = true;
    }
    expect("ruumi tõrge jõuab kutsujani, mitte ei vaiki", threw);
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    expect("ruumi tõrge: jagamine EI jää SENT olekusse", row.status === "CONFIRMED", row.status);
    expect("ruumi tõrge: saatmisaeg keerati tagasi", row.sentAt === null);
    const roomsAfter = await prisma.room.count();
    expect("ruumi tõrge: ruume ei lisandunud", roomsAfter === roomsBefore);
  }

  // === 5. SOL-NET-02: aegunud kinnitus ei saada ===========================
  {
    const share = await freshAwaiting("aegunud-kinnitus");
    await clientRespondToShare({ prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" });
    // Sisu vahetatakse mööda domeenikihist — nii nagu teeks tulevane kood, mis
    // unustab kinnituse nullida. Invariant peab pidama ka siis.
    await prisma.networkShare.update({
      where: { id: share.id },
      data: { summaryText: SWAPPED_TEXT, contentHash: computeShareContentHash({
        summaryText: SWAPPED_TEXT,
        purpose: "Võlanõustaja kaasamine.",
        sharingBoundary: "Ainult võlaolukorra kokkuvõte.",
        participationEndsOn: "2026-12-31"
      }) }
    });

    let code = null;
    try {
      await sendNetworkShare({
        prisma, shareId: share.id, workerId: worker.id,
        createRoom: ({ share: s, db }) => createRoomForNetworkShare({ share: s, db })
      });
    } catch (error) {
      code = error?.code || null;
    }
    expect("kinnitus, mis ei kata reas olevat teksti, ei saada midagi", code === "network_share.confirmation_stale", code);
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    expect("aegunud kinnitus: rida ei liikunud SENT-i", row.status === "CONFIRMED");
  }

  // === 6. SOL-NET-03: kaks paralleelset saatmist annavad ÜHE ruumi ========
  {
    const share = await freshAwaiting("kaks-saatmist");
    await clientRespondToShare({ prisma, shareId: share.id, clientUserId: client.id, decision: "CONFIRMED" });
    const roomsBefore = await prisma.room.count();

    const port = ({ share: s, db }) => createRoomForNetworkShare({ share: s, db });
    const both = await Promise.allSettled([
      sendNetworkShare({ prisma, shareId: share.id, workerId: worker.id, createRoom: port }),
      sendNetworkShare({ prisma, shareId: share.id, workerId: worker.id, createRoom: port })
    ]);
    const winners = both.filter((r) => r.status === "fulfilled");
    expect("kaks saatmist: täpselt üks võidab", winners.length === 1, `${winners.length} võitjat`);
    const roomsAfter = await prisma.room.count();
    expect("kaks saatmist: tekkis TÄPSELT üks ruum", roomsAfter === roomsBefore + 1, `${roomsBefore} -> ${roomsAfter}`);
    const row = await prisma.networkShare.findUnique({ where: { id: share.id } });
    if (row.roomId) created.roomIds.push(row.roomId);
    expect("kaks saatmist: jagamine viitab olemasolevale ruumile", Boolean(row.roomId));
  }
}

async function cleanup() {
  console.log("\ncleanup");
  await purge();
  const leftUsers = await prisma.user.count({ where: { email: { endsWith: SUFFIX } } });
  const leftRooms = created.roomIds.length
    ? await prisma.room.count({ where: { id: { in: created.roomIds } } })
    : 0;
  console.log(`  leftovers: ${leftUsers} users, ${leftRooms} rooms`);
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
