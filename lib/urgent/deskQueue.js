// SK-V1 E4 — vastuvõtu laud ja KOONDVAADE.
//
// See fail on eraldi objekti hind, mille leping 3.1 ette ütles: kui SK-teade on
// oma mudel, ei jõua ta automaatselt sinna, kuhu eelpöördumised jõuavad. Ilma
// koondvaateta jääks lühike ärev teade sellesse postkasti, mida keegi ei ava.
//
// Kolm reeglit, mis on siin arhitektuur:
//
//   1. **Järjekord on ajaline ja AINULT ajaline.** Kaua oodanud on ees. Siin ei
//      ole skoori, prioriteeti ega masinhinnangut — inimeste järjestamine
//      tuvastuse alusel on triaaž ja seda platvorm ei tee.
//   2. **Kaks allikat, kaks eri lubadust, ja neid ei tohi kokku valada.**
//      Kiireloomuline abipalve kannab LUGEMISAJA lubadust; eelpöördumine ei
//      kanna ühtegi. Rida näitab oma lubadust või selle puudumist, mitte teise
//      rea oma.
//   3. **Vaade on ISIKULINE.** Kiireloomulised pöördumised tulevad lauast,
//      eelpöördumised tulevad sellest töötajast. Laua liikmelisus ei ava võõraid
//      eelpöördumisi ja eelpöördumise omamine ei ava lauda.

import { isDeskStaff, UrgentRequestError } from "@/lib/urgent/request";

export const DeskQueueKind = Object.freeze({
  URGENT_REQUEST: "URGENT_REQUEST",
  PRE_INQUIRY: "PRE_INQUIRY"
});

const URGENT_AWAITING = new Set(["SENT", "READ"]);

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function urgentRow(request, { now }) {
  const expiresAt = request.expiresAt ? new Date(request.expiresAt) : null;
  return {
    kind: DeskQueueKind.URGENT_REQUEST,
    id: request.id,
    receivedAt: iso(request.sentAt),
    status: request.status,
    awaitingAnswer: URGENT_AWAITING.has(request.status),
    // Ainult kiireloomulisel real on lubadus. Eelpöördumise real on ta `null`
    // ja kuvakiht EI TOHI seda tühja kohta teise rea väärtusega täita.
    readingTimePromise: request.readingTimePromise || null,
    overdue: Boolean(
      expiresAt && URGENT_AWAITING.has(request.status) && expiresAt.getTime() <= new Date(now).getTime()
    ),
    expiresAt: iso(request.expiresAt),
    readAt: iso(request.readAt),
    takenAt: iso(request.takenAt),
    contactName: request.contactName || null,
    // Nimekirjas ei ole sisu. Verbatim-tekst avaneb ainult üksikvaates, kus
    // avamine jätab vastutusjälje.
    handoverPending: Boolean(request.handoverDeskId && !request.handoverAcceptedAt)
  };
}

function preInquiryRow(inquiry) {
  return {
    kind: DeskQueueKind.PRE_INQUIRY,
    id: inquiry.id,
    receivedAt: iso(inquiry.sentAt),
    status: inquiry.status,
    awaitingAnswer: !inquiry.openedAt,
    // Eelpöördumine EI kanna lugemisaja lubadust. `null` on siin sisuline
    // vastus, mitte puuduv andmeväli.
    readingTimePromise: null,
    overdue: false,
    expiresAt: null,
    readAt: iso(inquiry.openedAt),
    takenAt: null,
    topic: inquiry.topic || null,
    handoverPending: false
  };
}

/**
 * Koondvaade: selle laua kiireloomulised abipalved JA selle töötaja
 * eelpöördumised ühes ajajärjestuses.
 */
export async function loadDeskQueue({ prisma, userId, deskId, now = () => new Date() }) {
  const staff = await isDeskStaff(prisma, { deskId, userId });
  if (!staff) throw new UrgentRequestError("urgent_request.forbidden");

  const at = now();
  const [requests, inquiries, incomingHandovers] = await Promise.all([
    prisma.urgentRequest.findMany({ where: { deskId }, orderBy: { sentAt: "asc" }, take: 200 }),
    prisma.preInquiry.findMany({
      where: { recipientOwnerId: userId, sentAt: { not: null }, recalledAt: null },
      orderBy: { sentAt: "asc" },
      take: 200,
      select: { id: true, topic: true, status: true, sentAt: true, openedAt: true }
    }),
    // Üleandmised, mis OOTAVAD selle laua kinnitust. Nad ei ole veel selle laua
    // omad — kuni kinnituseni vastutab endine laud — aga nad peavad olema
    // nähtavad, muidu ei jõua öine juhtum hommikuni kellegi ette.
    prisma.urgentRequest.findMany({
      where: { handoverDeskId: deskId, handoverAcceptedAt: null },
      orderBy: { handedOverAt: "asc" },
      take: 100
    })
  ]);

  const items = [
    ...requests.map((request) => urgentRow(request, { now: at })),
    ...inquiries.map(preInquiryRow)
  ].sort((a, b) => String(a.receivedAt || "").localeCompare(String(b.receivedAt || "")));

  return {
    deskId,
    // Kaua oodanud on ees. Ainus järjestus, mille platvorm inimestele annab.
    items,
    awaitingCount: items.filter((item) => item.awaitingAnswer).length,
    overdueCount: items.filter((item) => item.overdue).length,
    incomingHandovers: incomingHandovers.map((request) => ({
      id: request.id,
      handedOverAt: iso(request.handedOverAt),
      handoverNote: request.handoverNote || null,
      fromDeskId: request.deskId
    }))
  };
}

/**
 * Ühe pöördumise vastutusjälg: kes mida millal tegi.
 *
 * Sisu siin ei ole — read ütlevad toimingu ja tegija. Nii saab üleandmisel
 * näidata tegevuslugu ilma, et tegevusloo lugemine ise oleks sisu lugemine.
 */
export async function loadRequestTrail({ prisma, userId, requestId }) {
  const request = await prisma.urgentRequest.findFirst({ where: { id: String(requestId || "") } });
  if (!request) throw new UrgentRequestError("urgent_request.not_found");

  // Jälge tohib lugeda praegune laud VÕI see, kellele juhtum on üle antud.
  const [current, target] = await Promise.all([
    isDeskStaff(prisma, { deskId: request.deskId, userId }),
    request.handoverDeskId ? isDeskStaff(prisma, { deskId: request.handoverDeskId, userId }) : false
  ]);
  if (!current && !target) throw new UrgentRequestError("urgent_request.forbidden");

  const events = await prisma.urgentRequestEvent.findMany({
    where: { requestId: request.id },
    orderBy: { createdAt: "asc" },
    take: 500
  });
  return events.map((event) => ({
    id: event.id,
    kind: event.kind,
    actorId: event.actorId || null,
    note: event.note || null,
    at: iso(event.createdAt)
  }));
}
