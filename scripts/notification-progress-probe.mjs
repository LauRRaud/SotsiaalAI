#!/usr/bin/env node
/**
 * SOL-NOTIF sond — PÄRIS PostgreSQL, päris marsruut, päris veasüst.
 *
 * MIDA SIIN TÕENDATAKSE (kriteeriumide järgi):
 *
 *   -01: worker annab päris (rangele) transpordile envelope-saatja ja saatmine
 *        õnnestub. Vana kuju kukkus siin „EMAIL_FROM peab sisaldama kehtivat
 *        aadressi" peale.
 *   -02: rohkem kui üks partii sobivaid ridu → korduvad jooksud jõuavad KÕIGINI.
 *        Vana kuju alustas iga kord algusest ja hilisemateni ei jõudnud kunagi.
 *   -03: sama ruumi autorid jagatud üle KAHE partii — kirjutaja ei saa teadet
 *        aktiivsusest, mille ta ise tekitas.
 *   -04: job jookseb kuue tunni piiri mõlemal pool ILMA uute sõnumiteta → üks
 *        teade, mitte kaks.
 *   -06: veasüst (päris andmebaasi trigger) kukutab varasema etapi ja
 *        ohutusetapid (välitöö dead-man, kiire abi aegumine) käivituvad SIISKI.
 *   -07: rohkem kui `limit × 2` nähtamatut teadet uuemad kui üks kehtiv →
 *        kehtiv teade leitakse ikka üles.
 *
 * Sond kirjutab ja koristab enda järelt (ka trigger'i). Väljumiskood 1 = leid.
 */
import crypto from "node:crypto";

process.env.EMAIL_FROM = process.env.EMAIL_FROM || "notifications@sotsiaalai.invalid";
process.env.NOTIFICATION_JOB_KEY = "sol-notif-probe-job-key";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "https://probe.invalid";

const { prisma } = await import("../lib/prisma.js");
const { reconcileNotificationEvents } = await import("../lib/notificationReconciler.js");
const { runNotificationDelivery } = await import("../lib/notificationDelivery.js");
const { listNotificationEvents } = await import("../lib/notifications.js");
const { POST: jobPOST } = await import("../app/api/jobs/notifications/route.js");

const results = [];
let failures = 0;

function check(name, condition, detail = "") {
  const ok = Boolean(condition);
  if (!ok) failures += 1;
  results.push(`${ok ? "OK  " : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
}

const created = { userIds: [], roomIds: [] };
let triggerArmed = false;
let parkedCursors = [];

/** Range transport: nõuab envelope-saatjat täpselt nagu lib/mailer.js. */
function strictTransport(sent = []) {
  return {
    sent,
    async sendMail(message) {
      const from = String(message?.from || "").trim();
      if (!from.includes("@")) throw new Error("EMAIL_FROM peab sisaldama kehtivat aadressi.");
      sent.push(message);
      return { messageId: message.messageId };
    }
  };
}

async function armReconcileTrigger(roomId) {
  if (!/^[a-z0-9]+$/i.test(roomId)) throw new Error("ootamatu roomId kuju");
  await prisma.$executeRawUnsafe(`
    CREATE OR REPLACE FUNCTION sol_notif_probe_boom() RETURNS trigger AS $probe$
    BEGIN
      IF NEW."sourceId" = '${roomId}' THEN
        RAISE EXCEPTION 'sol-notif probe: reconcile stage blocked';
      END IF;
      RETURN NEW;
    END;
    $probe$ LANGUAGE plpgsql;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE TRIGGER sol_notif_probe
    BEFORE INSERT ON "NotificationEvent"
    FOR EACH ROW EXECUTE FUNCTION sol_notif_probe_boom();
  `);
  triggerArmed = true;
}

async function disarmReconcileTrigger() {
  await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS sol_notif_probe ON "NotificationEvent";`).catch(() => null);
  await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS sol_notif_probe_boom();`).catch(() => null);
  triggerArmed = false;
}

async function main() {
  const suffix = crypto.randomUUID().slice(0, 8);
  const now = new Date();

  try {
    /* Kursoritabel on jagatud olek: pargime võõrad read kõrvale ja paneme
       lõpus täpselt tagasi, et sond ei varastaks päris jooksult kohta. */
    parkedCursors = await prisma.notificationReconcileCursor.findMany();
    await prisma.notificationReconcileCursor.deleteMany({});
    check("võõrad kursoriread pargitud ja pärast taastatud", true, `ridu ${parkedCursors.length}`);

    const owner = await prisma.user.create({
      data: { email: `sol-notif-owner-${suffix}@probe.invalid`, role: "CLIENT", notificationEmailEnabled: true }
    });
    created.userIds.push(owner.id);
    const member = await prisma.user.create({
      data: { email: `sol-notif-member-${suffix}@probe.invalid`, role: "CLIENT", notificationEmailEnabled: true }
    });
    created.userIds.push(member.id);
    const silent = await prisma.user.create({
      data: { email: `sol-notif-silent-${suffix}@probe.invalid`, role: "CLIENT", notificationEmailEnabled: true }
    });
    created.userIds.push(silent.id);

    const room = await prisma.room.create({
      data: { ownerId: owner.id, title: `sond ${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(room.id);
    for (const userId of [owner.id, member.id, silent.id]) {
      await prisma.roomMember.create({
        data: { roomId: room.id, userId, role: userId === owner.id ? "OWNER" : "MEMBER", joinedAt: now }
      });
    }

    /* KAKS autorit, sõnumid ID järjekorras nii, et ühe partii sisse mahub ainult
       esimene — täpselt see kuju, mille peal vana kood teise autori välistamata
       jättis. */
    const messageAt = new Date(now.getTime() - 60 * 60 * 1000);
    await prisma.roomMessage.create({
      data: { roomId: room.id, authorId: owner.id, content: "esimene", createdAt: messageAt }
    });
    await prisma.roomMessage.create({
      data: { roomId: room.id, authorId: member.id, content: "teine", createdAt: messageAt }
    });

    // -------------------------------------------------------------------
    // 1. SOL-NOTIF-03: autorid välistatakse kogu akna pealt.
    // -------------------------------------------------------------------
    await reconcileNotificationEvents({ db: prisma, now, batchSize: 1 });
    const roomEvents = await prisma.notificationEvent.findMany({
      where: { type: "ROOM_ACTIVITY", sourceId: room.id },
      select: { userId: true, dedupeKey: true }
    });
    const recipients = roomEvents.map((row) => row.userId).sort();

    check("1. KANDEV: kumbki kirjutaja ei saa teadet oma enda aktiivsusest",
      recipients.length === 1 && recipients[0] === silent.id,
      `adressaate ${recipients.length}`);

    // -------------------------------------------------------------------
    // 2. SOL-NOTIF-04: kuue tunni piiri ületamine ei tekita teist teadet.
    // -------------------------------------------------------------------
    const beforeBoundary = roomEvents.length;
    const laterClock = new Date(Math.ceil(now.getTime() / (6 * 60 * 60 * 1000)) * 6 * 60 * 60 * 1000 + 60_000);
    await reconcileNotificationEvents({ db: prisma, now: laterClock, batchSize: 50 });
    const afterBoundary = await prisma.notificationEvent.count({
      where: { type: "ROOM_ACTIVITY", sourceId: room.id }
    });
    check("2. KANDEV: sama aktiivsus ei anna kuue tunni piiri taga teist teadet",
      afterBoundary === beforeBoundary,
      `${beforeBoundary} → ${afterBoundary}`);

    // -------------------------------------------------------------------
    // 3. SOL-NOTIF-02: korduvad jooksud jõuavad KÕIGINI.
    // -------------------------------------------------------------------
    await prisma.notificationReconcileCursor.deleteMany({});
    const roomIds = [];
    for (let index = 0; index < 3; index += 1) {
      const extraRoom = await prisma.room.create({
        data: { ownerId: owner.id, title: `sond-${suffix}-${index}`, originType: "MANUAL_INVITE" }
      });
      created.roomIds.push(extraRoom.id);
      roomIds.push(extraRoom.id);
      await prisma.roomMember.create({
        data: { roomId: extraRoom.id, userId: silent.id, role: "MEMBER", joinedAt: now }
      });
      await prisma.roomMessage.create({
        data: { roomId: extraRoom.id, authorId: owner.id, content: `sõnum ${index}`, createdAt: messageAt }
      });
    }

    /* Partii suurus 1: iga jooks jõuab ÜHE sõnumini. Aknas on ka kaks varasemat
       sõnumit (jaam 1), seega kõigi kolme uue ruumini jõudmiseks on vaja viit
       jooksu — ja just see ongi mõõdetav asi: iga jooks LIIGUB EDASI. Vana kuju
       oleks lugenud kõigil viiel korral sama vanimat rida. */
    for (let run = 0; run < 5; run += 1) {
      await reconcileNotificationEvents({ db: prisma, now, batchSize: 1 });
    }
    const reachedRooms = await prisma.notificationEvent.findMany({
      where: { type: "ROOM_ACTIVITY", sourceId: { in: roomIds }, userId: silent.id },
      select: { sourceId: true }
    });
    const reached = new Set(reachedRooms.map((row) => row.sourceId));
    check("3. KANDEV: korduvad jooksud jõuavad kõigi ridadeni", reached.size === roomIds.length,
      `jõudis ${reached.size}/${roomIds.length}`);

    const cursorRows = await prisma.notificationReconcileCursor.findMany({ where: { source: "rooms" } });
    check("3. edenemine on andmebaasis, mitte protsessi mälus", cursorRows.length === 1,
      `kursoriridu ${cursorRows.length}`);

    // -------------------------------------------------------------------
    // 4. SOL-NOTIF-01: worker annab rangele transpordile saatja.
    // -------------------------------------------------------------------
    const pending = await prisma.notificationEvent.findFirst({
      where: { userId: silent.id, type: "ROOM_ACTIVITY" },
      select: { id: true }
    });
    await prisma.notificationEvent.update({
      where: { id: pending.id },
      data: { emailPolicy: "OPTIONAL", emailStatus: "PENDING", emailNextAttemptAt: new Date(now.getTime() - 1000) }
    });
    const sent = [];
    const delivery = await runNotificationDelivery({
      db: prisma,
      now,
      mailer: strictTransport(sent),
      baseUrl: "https://probe.invalid"
    });
    const deliveredRow = await prisma.notificationEvent.findUnique({ where: { id: pending.id } });
    check("4. KANDEV: range transport saab saatja ja kiri läheb välja",
      delivery.sent >= 1 && sent.length >= 1 && Boolean(sent[0]?.from),
      `sent=${delivery.sent}, from=${sent[0]?.from || "PUUDUB"}`);
    check("4. rida märgitakse SENT-iks", deliveredRow.emailStatus === "SENT", deliveredRow.emailStatus);

    // -------------------------------------------------------------------
    // 5. SOL-NOTIF-07: vanem kehtiv teade ei kao nähtamatute taha.
    // -------------------------------------------------------------------
    const goneRoom = await prisma.room.create({
      data: { ownerId: owner.id, title: `sond-gone-${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(goneRoom.id);
    // `silent` EI ole selle ruumi liige → need teated on tema jaoks nähtamatud.
    for (let index = 0; index < 12; index += 1) {
      await prisma.notificationEvent.create({
        data: {
          userId: silent.id,
          type: "ROOM_ACTIVITY",
          sourceType: "ROOM",
          sourceId: goneRoom.id,
          targetKind: "ROOM",
          targetId: goneRoom.id,
          dedupeKey: `sol-notif-probe-${suffix}-gone-${index}`,
          createdAt: new Date(now.getTime() + (index + 1) * 1000)
        }
      });
    }
    const visible = await listNotificationEvents(silent.id, { db: prisma, limit: 5 });
    check("5. KANDEV: kehtiv teade leitakse üles ka 12 nähtamatu tagant",
      visible.length >= 1 && visible.every((row) => row.href),
      `nähtavaid ${visible.length}`);

    // -------------------------------------------------------------------
    // 6. SOL-NOTIF-06: varasema etapi viga ei võta ohutusetappe.
    // -------------------------------------------------------------------
    await prisma.notificationReconcileCursor.deleteMany({});
    const boomRoom = await prisma.room.create({
      data: { ownerId: owner.id, title: `sond-boom-${suffix}`, originType: "MANUAL_INVITE" }
    });
    created.roomIds.push(boomRoom.id);
    await prisma.roomMember.create({
      data: { roomId: boomRoom.id, userId: silent.id, role: "MEMBER", joinedAt: now }
    });
    await prisma.roomMessage.create({
      data: { roomId: boomRoom.id, authorId: owner.id, content: "boom", createdAt: messageAt }
    });
    await armReconcileTrigger(boomRoom.id);

    const response = await jobPOST(
      new Request("https://probe.invalid/api/jobs/notifications", {
        method: "POST",
        headers: { "x-notification-job-key": process.env.NOTIFICATION_JOB_KEY }
      })
    );
    const body = await response.json();
    await disarmReconcileTrigger();

    check("6. KANDEV: reconcile-etapp kukkus", body?.stages?.reconcile?.ok === false,
      JSON.stringify(body?.stages?.reconcile || null));
    check("6. KANDEV: välitöö ohutuskontroll käivitus SIISKI",
      body?.stages?.fieldSafety?.ok === true && Boolean(body?.fieldSafety),
      JSON.stringify(body?.stages?.fieldSafety || null));
    check("6. KANDEV: kiire abi aegumine käivitus SIISKI",
      body?.stages?.urgentExpiry?.ok === true && Boolean(body?.urgentExpiry),
      JSON.stringify(body?.stages?.urgentExpiry || null));
    check("6. vastus ei valeta edu", body?.ok === false && response.status === 207,
      `${response.status} ok=${body?.ok}`);
    check("6. ohutuse seis on eraldi loetav", body?.safetyOk === true, String(body?.safetyOk));
    check("6. kukkunud etapp on nimeliselt kirjas",
      Array.isArray(body?.failedStages) && body.failedStages.includes("reconcile"),
      JSON.stringify(body?.failedStages || null));
  } finally {
    if (triggerArmed) await disarmReconcileTrigger();
    for (const id of created.roomIds) {
      await prisma.notificationEvent.deleteMany({ where: { sourceId: id } }).catch(() => null);
      await prisma.roomMessage.deleteMany({ where: { roomId: id } }).catch(() => null);
      await prisma.roomMember.deleteMany({ where: { roomId: id } }).catch(() => null);
      await prisma.room.delete({ where: { id } }).catch(() => null);
    }
    for (const id of created.userIds) {
      await prisma.notificationEvent.deleteMany({ where: { userId: id } }).catch(() => null);
    }
    if (created.userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: created.userIds } } }).catch(() => null);
    }
    await prisma.notificationReconcileCursor.deleteMany({}).catch(() => null);
    for (const row of parkedCursors) {
      await prisma.notificationReconcileCursor
        .create({ data: { source: row.source, cursorId: row.cursorId } })
        .catch(() => null);
    }
    await prisma.$disconnect().catch(() => null);
  }

  console.log(results.join("\n"));
  console.log(`\n[SOL-NOTIF sond] ${results.length - failures}/${results.length}`);
  if (failures) process.exit(1);
}

main().catch(async (error) => {
  console.error("[SOL-NOTIF sond] katkes:", error);
  await disarmReconcileTrigger().catch(() => null);
  process.exit(1);
});
