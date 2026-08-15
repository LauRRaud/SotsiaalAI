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

/* SOL-URG-01 — MIKS SIIN ON KAKS PÄRINGUT, MITTE ÜKS `take: 200`.
 *
 * Vana järjekord küsis KÕIK selle laua pöördumised vanimast alates ja lõikas
 * 200 peal. Lõpetatud, tagasi võetud ja aegunud read jäid valikusse igaveseks,
 * seega niipea kui laual on ajaloos 200 vanemat rida, ei jõudnud 201. abipalve
 * enam KUNAGI kellegi ette. Inimesele on antud lugemisaja lubadus ja see
 * lubadus kadus vaikides — ilma veateate, tühja ekraani või ühegi märgita.
 *
 * Parandus ei ole suurem `take`. Suurem number lükkab sama vaikse kadumise
 * lihtsalt edasi. Vastust ootavad ja pooleliolevad kirjed on nüüd OMA päring,
 * mis ei jaga mahtu ajalooga; ajalugu on eraldi ja lehekülgitav.
 *
 * See EI OLE triaaž (mooduli reegel 1). Me ei järjesta inimesi hinnangu ega
 * kiireloomulisuse järgi — töö ja ajalugu on eri asjad, nagu postkast ja
 * arhiiv. Ajaline järjestus kehtib mõlema sees muutmata kujul.
 */
const URGENT_ACTIVE_STATUSES = ["SENT", "READ", "TAKEN"];
const URGENT_HISTORY_STATUSES = ["DECLINED", "RESOLVED", "EXPIRED", "RECALLED"];

/* Aktiivsete lagi on OHUTUSVENTIIL, mitte lehekülg. Kui laud selle täidab, on
   midagi katki (ummistus või kuritarvitus) ja vastus on `activeTruncated`, mitte
   vaikne lõikamine — vt SOL-CALL-06 sama õppetund teisest otsast: väide, mida ei
   saa tõendada, ei tohi näha välja nagu fakt. */
const ACTIVE_CEILING = 500;
const HISTORY_PAGE_SIZE = 50;
const INCOMING_HANDOVER_CEILING = 100;

/**
 * SOL-URG-01 — ajalugu on ASC ja nihkepõhine, mitte DESC.
 *
 * Nihkepaginatsioon on ebastabiilne siis, kui uued read tulevad loendi ETTE:
 * iga lisandumine nihutab kõiki lehti ja lugeja näeb sama rida kaks korda või
 * ei näe üldse. Ajalugu kasvab ainult LÕPUST (lõpetatud pöördumine on alati
 * vanem kui järgmine lõpetatav), seega ASC-järjestuses ei nihuta uus rida ühtegi
 * juba loetud lehte. Sama suund kehtib ka mooduli põhilubaduses „kaua oodanud on
 * ees" — kaks eri järjestust ühes vaates oleks omaette lõks.
 */
function historyOrder() {
  // `id` on tie-breaker: sama millisekundi kaks rida peavad saama TÄIELIKU
  // järjestuse, muidu võib nihe neid vahetada ja üks rida kaob lehtede vahele.
  return [{ sentAt: "asc" }, { id: "asc" }];
}

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
export async function loadDeskQueue({
  prisma,
  userId,
  deskId,
  now = () => new Date(),
  historyOffset = 0,
  historyPageSize = HISTORY_PAGE_SIZE
}) {
  const staff = await isDeskStaff(prisma, { deskId, userId });
  if (!staff) throw new UrgentRequestError("urgent_request.forbidden");

  const at = now();
  const skip = Number.isInteger(historyOffset) && historyOffset > 0 ? historyOffset : 0;
  const pageSize = Number.isInteger(historyPageSize) && historyPageSize > 0
    ? Math.min(historyPageSize, HISTORY_PAGE_SIZE)
    : HISTORY_PAGE_SIZE;

  const inquiryScope = { recipientOwnerId: userId, sentAt: { not: null }, recalledAt: null };
  const inquirySelect = { id: true, topic: true, status: true, sentAt: true, openedAt: true };

  const [
    activeRequests,
    activeInquiries,
    historyRequests,
    historyInquiries,
    incomingHandovers,
    awaitingRequests,
    awaitingInquiries,
    overdueRequests,
    historyRequestTotal,
    historyInquiryTotal
  ] = await Promise.all([
    /* 1. TÖÖ. Vastust ootavad ja pooleliolevad kirjed, oma päring, oma maht.
          Nad ei jaga ühtegi kohta ajalooga — just see jagamine oli leid. */
    prisma.urgentRequest.findMany({
      where: { deskId, status: { in: URGENT_ACTIVE_STATUSES } },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: ACTIVE_CEILING + 1
    }),
    prisma.preInquiry.findMany({
      where: { ...inquiryScope, status: { not: "ARCHIVED" } },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: ACTIVE_CEILING + 1,
      select: inquirySelect
    }),
    // 2. AJALUGU. Eraldi, lehekülgitav, ei mahu kunagi töö ette.
    prisma.urgentRequest.findMany({
      where: { deskId, status: { in: URGENT_HISTORY_STATUSES } },
      orderBy: historyOrder(),
      skip,
      take: pageSize
    }),
    prisma.preInquiry.findMany({
      where: { ...inquiryScope, status: "ARCHIVED" },
      orderBy: historyOrder(),
      skip,
      take: pageSize,
      select: inquirySelect
    }),
    // Üleandmised, mis OOTAVAD selle laua kinnitust. Nad ei ole veel selle laua
    // omad — kuni kinnituseni vastutab endine laud — aga nad peavad olema
    // nähtavad, muidu ei jõua öine juhtum hommikuni kellegi ette.
    prisma.urgentRequest.findMany({
      where: {
        handoverDeskId: deskId,
        handoverAcceptedAt: null,
        status: { in: URGENT_ACTIVE_STATUSES }
      },
      orderBy: { handedOverAt: "asc" },
      take: INCOMING_HANDOVER_CEILING + 1
    }),
    /* 3. LOENDURID TULEVAD ANDMEBAASIST, mitte lehelt. Vana kood luges nad
          samast kärbitud massiivist, seega ka number valetas koos loendiga —
          „0 ootab" oli võimalik siis, kui ootas 40. Loendur, mis mõõdab lehte,
          mõõdab meie lehekülje suurust, mitte tööd. */
    prisma.urgentRequest.count({ where: { deskId, status: { in: ["SENT", "READ"] } } }),
    prisma.preInquiry.count({ where: { ...inquiryScope, openedAt: null } }),
    prisma.urgentRequest.count({
      where: { deskId, status: { in: ["SENT", "READ"] }, expiresAt: { lte: at } }
    }),
    prisma.urgentRequest.count({ where: { deskId, status: { in: URGENT_HISTORY_STATUSES } } }),
    prisma.preInquiry.count({ where: { ...inquiryScope, status: "ARCHIVED" } })
  ]);

  const activeTruncated =
    activeRequests.length > ACTIVE_CEILING || activeInquiries.length > ACTIVE_CEILING;
  const byReceivedAt = (a, b) => String(a.receivedAt || "").localeCompare(String(b.receivedAt || ""));

  const active = [
    ...activeRequests.slice(0, ACTIVE_CEILING).map((request) => urgentRow(request, { now: at })),
    ...activeInquiries.slice(0, ACTIVE_CEILING).map(preInquiryRow)
  ].sort(byReceivedAt);

  const history = [
    ...historyRequests.map((request) => urgentRow(request, { now: at })),
    ...historyInquiries.map(preInquiryRow)
  ].sort(byReceivedAt);

  const historyTotal = historyRequestTotal + historyInquiryTotal;

  return {
    deskId,
    /* Kaua oodanud on ees — töö sees ja ajaloo sees eraldi. `items` hoiab
       ühilduvuse olemasoleva vaatega ja kannab sama lubadust: mis on ees, seda
       on kõige kauem oodatud. Uus rida on ESIMESEL lehel definitsiooni järgi,
       mitte õnne pärast. */
    items: [...active, ...history],
    active,
    history,
    activeTruncated,
    historyOffset: skip,
    historyPageSize: pageSize,
    historyTotal,
    hasMoreHistory: skip + history.length < historyTotal,
    awaitingCount: awaitingRequests + awaitingInquiries,
    overdueCount: overdueRequests,
    incomingHandoversTruncated: incomingHandovers.length > INCOMING_HANDOVER_CEILING,
    incomingHandovers: incomingHandovers.slice(0, INCOMING_HANDOVER_CEILING).map((request) => ({
      id: request.id,
      handedOverAt: iso(request.handedOverAt),
      handoverNote: request.handoverNote || null,
      fromDeskId: request.deskId
    }))
  };
}

/**
 * SOL-URG-01 — sama valik, teine väljundikuju.
 *
 * `GET /api/urgent-requests?role=desk` kordas TÄPSELT sama `orderBy: sentAt asc`
 * + `take: 200` mustrit oma failis. Kaks koopiat ühest valikureeglist lahknevad
 * esimese muudatusega — sedasama maksid juba SOL-CALL-05 ja SOL-RAGADMIN-01/02.
 * Valik elab nüüd ühes kohas; kutsuja otsustab ainult, mis kujul ta ridu tahab.
 */
export async function selectDeskRequests({
  prisma,
  deskId,
  historyOffset = 0,
  historyPageSize = HISTORY_PAGE_SIZE
}) {
  const skip = Number.isInteger(historyOffset) && historyOffset > 0 ? historyOffset : 0;
  const pageSize = Number.isInteger(historyPageSize) && historyPageSize > 0
    ? Math.min(historyPageSize, HISTORY_PAGE_SIZE)
    : HISTORY_PAGE_SIZE;

  const [active, history, historyTotal] = await Promise.all([
    prisma.urgentRequest.findMany({
      where: { deskId, status: { in: URGENT_ACTIVE_STATUSES } },
      orderBy: [{ sentAt: "asc" }, { id: "asc" }],
      take: ACTIVE_CEILING + 1
    }),
    prisma.urgentRequest.findMany({
      where: { deskId, status: { in: URGENT_HISTORY_STATUSES } },
      orderBy: historyOrder(),
      skip,
      take: pageSize
    }),
    prisma.urgentRequest.count({ where: { deskId, status: { in: URGENT_HISTORY_STATUSES } } })
  ]);

  return {
    rows: [...active.slice(0, ACTIVE_CEILING), ...history],
    activeTruncated: active.length > ACTIVE_CEILING,
    historyOffset: skip,
    historyPageSize: pageSize,
    historyTotal,
    hasMoreHistory: skip + history.length < historyTotal
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
