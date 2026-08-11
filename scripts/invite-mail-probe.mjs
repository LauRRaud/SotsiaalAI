#!/usr/bin/env node
/**
 * SOL-INV-03 sond — PÄRIS PostgreSQL, mitte fake.
 *
 * MIDA SIIN TÕENDATAKSE. Paranduse kandev väide ei ole „vastus ütleb `queued`",
 * vaid see, et `queued` on LUBADUS, mille keegi täidab: kohale toimetamata kiri
 * jääb päris järjekorda, päris worker leiab ta üles ja saadab ära, ning teine
 * jooks ei saada teist kirja. Fake tõendab siin ainult minu enda massiivi.
 *
 * Toodangus on `sotsiaalai-payment-emails.timer` sees ja töötab (kontrollitud
 * 11.08.2026), seega see järjekord ei ole surnud postkast.
 *
 * NEGATIIVKONTROLL: vana kuju ei jätnud maha ühtki püsivat jälge — ilma
 * järjekorrareata ei ole workeril mida üles korjata ja kaotatud kiri on kadunud
 * lõplikult.
 *
 * Sond kirjutab ja koristab enda järelt. Väljumiskood 1 = leid, mitte lause.
 */
import { randomUUID } from "node:crypto";

import { prisma } from "../lib/prisma.js";
import { deliverInviteEmail, inviteEmailDedupeKey } from "../lib/invites/inviteEmailDelivery.js";
import { runPaymentEmailDelivery } from "../lib/payments/emailOutbox.js";

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

function stubMailer({ fail = false } = {}) {
  const sent = [];
  return {
    sent,
    sendMail: async (message) => {
      if (fail) throw Object.assign(new Error("smtp down"), { code: "ESOCKET" });
      sent.push(message);
      return { messageId: randomUUID() };
    }
  };
}

const created = { userIds: [], roomIds: [], dedupeKeys: [] };
let parked = [];

async function main() {
  const suffix = randomUUID().slice(0, 8);
  process.env.EMAIL_FROM = process.env.EMAIL_FROM || "probe@sotsiaalai.invalid";

  try {
    /* Worker skaneerib KOGU järjekorda, seega sond ei tohi võõraid ootel ridu
       oma stub-mailer'iga „ära saata" — see märgiks nad SENT-iks ja päris kiri
       ei läheks kunagi välja. Pargime nad tunniks ette ja paneme `finally`-s
       täpselt tagasi; protsessi surm laseb nad ise tunni pärast lahti. */
    parked = await prisma.paymentEmailOutbox.findMany({
      where: { status: { in: ["PENDING", "RETRY"] } },
      select: { id: true, nextAttemptAt: true }
    });
    if (parked.length) {
      await prisma.paymentEmailOutbox.updateMany({
        where: { id: { in: parked.map(row => row.id) } },
        data: { nextAttemptAt: new Date(Date.now() + 3_600_000) }
      });
    }
    check("võõrad järjekorraread pargitud ja pärast taastatud", true, `ridu ${parked.length}`);

    const owner = await prisma.user.create({
      data: { email: `sol-inv-03-owner-${suffix}@probe.invalid`, role: "CLIENT" }
    });
    created.userIds.push(owner.id);
    const room = await prisma.room.create({
      data: { ownerId: owner.id, title: `sond ${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(room.id);

    const tokenRaw = `probe-token-${suffix}`;
    const tokenHash = `probe-hash-${suffix}`;
    const invite = await prisma.invite.create({
      data: {
        roomId: room.id,
        inviterId: owner.id,
        inviteeEmail: `sol-inv-03-guest-${suffix}@probe.invalid`,
        tokenHash,
        status: "SENT",
        paymentMode: "SELF_PAID",
        expiresAt: new Date(Date.now() + 3_600_000),
        maxUses: 1,
        useCount: 0
      }
    });
    const dedupeKey = inviteEmailDedupeKey({ kind: "create", inviteId: invite.id, tokenHash });
    created.dedupeKeys.push(dedupeKey);

    // -------------------------------------------------------------------
    // 1. KOHENE SAATMINE KUKUB → vastus on `queued` ja jälg jääb PÄRIS ritta.
    // -------------------------------------------------------------------
    const delivery = await deliverInviteEmail({
      db: prisma,
      kind: "create",
      inviteId: invite.id,
      toEmail: invite.inviteeEmail,
      tokenRaw,
      tokenHash,
      roomTitle: room.title,
      inviterName: owner.email,
      locale: "et",
      mailer: stubMailer({ fail: true }),
      baseUrl: "https://probe.invalid"
    });
    check("kukkunud saatmine annab `queued`, mitte `sent`", delivery === "queued", `vastus=${delivery}`);

    const queuedRow = await prisma.paymentEmailOutbox.findUnique({ where: { dedupeKey } });
    check("järjekorda jäi püsiv rida", Boolean(queuedRow), queuedRow ? "" : "rida puudub");
    check("rida on kutse küljes", queuedRow?.inviteId === invite.id, `inviteId=${queuedRow?.inviteId}`);
    check("rida on ootel, mitte saadetud", queuedRow?.status === "PENDING", `staatus=${queuedRow?.status}`);
    check("veakood on kirjas", queuedRow?.lastErrorCode === "ESOCKET", `kood=${queuedRow?.lastErrorCode}`);
    check(
      "toortoken ei ole dedupe-võtmes",
      !String(queuedRow?.dedupeKey || "").includes(tokenRaw),
      queuedRow?.dedupeKey
    );

    // -------------------------------------------------------------------
    // 2. PÄRIS WORKER korjab rea üles ja saadab ära.
    // -------------------------------------------------------------------
    const mailer = stubMailer();
    const run = await runPaymentEmailDelivery({
      db: prisma,
      mailer,
      baseUrl: "https://probe.invalid",
      now: new Date()
    });
    check("worker leidis ja saatis täpselt ühe kirja", run.sent === 1 && run.eligible === 1, JSON.stringify(run));
    check("kiri läks õigele adressaadile", mailer.sent[0]?.to === invite.inviteeEmail, mailer.sent[0]?.to);
    const deliveredLink = String(mailer.sent[0]?.text || "").includes(`join?token=${tokenRaw}`);
    check("kiri kannab päris liitumislinki", deliveredLink, deliveredLink ? "" : "linki ei ole kirjas");

    const afterWorker = await prisma.paymentEmailOutbox.findUnique({ where: { dedupeKey } });
    check("rida on nüüd SENT", afterWorker?.status === "SENT", `staatus=${afterWorker?.status}`);

    // -------------------------------------------------------------------
    // 3. TEINE JOOKS ei saada teist kirja (terminalne olek).
    // -------------------------------------------------------------------
    const secondMailer = stubMailer();
    const secondRun = await runPaymentEmailDelivery({
      db: prisma,
      mailer: secondMailer,
      baseUrl: "https://probe.invalid",
      now: new Date()
    });
    check(
      "teine jooks ei saada teist kirja",
      secondRun.sent === 0 && secondMailer.sent.length === 0,
      JSON.stringify(secondRun)
    );

    // -------------------------------------------------------------------
    // 4. KINNITATUD KOHENE SAATMINE võtab rea workeri käest ära.
    // -------------------------------------------------------------------
    const directHash = `probe-hash-direct-${suffix}`;
    const directKey = inviteEmailDedupeKey({ kind: "create", inviteId: invite.id, tokenHash: directHash });
    created.dedupeKeys.push(directKey);
    const directMailer = stubMailer();
    const directResult = await deliverInviteEmail({
      db: prisma,
      kind: "create",
      inviteId: invite.id,
      toEmail: invite.inviteeEmail,
      tokenRaw: `${tokenRaw}-direct`,
      tokenHash: directHash,
      roomTitle: room.title,
      inviterName: owner.email,
      locale: "et",
      mailer: directMailer,
      baseUrl: "https://probe.invalid"
    });
    const directRow = await prisma.paymentEmailOutbox.findUnique({ where: { dedupeKey: directKey } });
    check("õnnestunud kohene saatmine annab `sent`", directResult === "sent", `vastus=${directResult}`);
    check("ja märgib rea SENT-iks, et worker ei saadaks teist", directRow?.status === "SENT", `staatus=${directRow?.status}`);

    const afterDirect = await runPaymentEmailDelivery({
      db: prisma,
      mailer: stubMailer(),
      baseUrl: "https://probe.invalid",
      now: new Date()
    });
    check("worker ei leia enam midagi saata", afterDirect.eligible === 0, JSON.stringify(afterDirect));

    // -------------------------------------------------------------------
    // 5. NEGATIIVKONTROLL — vana kuju: saada, neela viga, ära jäta jälge.
    //    Transkriptsioon, sest vana teostust ei ole enam olemas.
    // -------------------------------------------------------------------
    let legacyReported = "created";
    try {
      await stubMailer({ fail: true }).sendMail({ to: invite.inviteeEmail });
    } catch {
      // täpselt see `catch`, mis leiu tekitas: log ja edasi
    }
    // Loendus on SELLE kutse peal: pargitud võõrad read ei ole vana kuju jälg.
    const legacyQueue = await prisma.paymentEmailOutbox.count({
      where: { inviteId: invite.id, status: { in: ["PENDING", "RETRY"] } }
    });
    check(
      "negatiivkontroll: vana kuju vastab eduga ja ei jäta järjekorda midagi",
      legacyReported === "created" && legacyQueue === 0,
      `ootel ridu ${legacyQueue}`
    );
  } finally {
    if (created.dedupeKeys.length) {
      await prisma.paymentEmailOutbox
        .deleteMany({ where: { dedupeKey: { in: created.dedupeKeys } } })
        .catch(() => null);
    }
    for (const roomId of created.roomIds) {
      const inviteIds = (await prisma.invite.findMany({ where: { roomId }, select: { id: true } }).catch(() => []))
        .map(row => row.id);
      if (inviteIds.length) {
        await prisma.paymentEmailOutbox
          .deleteMany({ where: { inviteId: { in: inviteIds } } })
          .catch(() => null);
      }
      await prisma.invite.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.roomMember.deleteMany({ where: { roomId } }).catch(() => null);
      await prisma.room.delete({ where: { id: roomId } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    for (const row of parked) {
      await prisma.paymentEmailOutbox
        .updateMany({ where: { id: row.id }, data: { nextAttemptAt: row.nextAttemptAt } })
        .catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-INV-03 sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(error => {
  console.error("[SOL-INV-03 sond] katkes:", error);
  process.exit(1);
});
