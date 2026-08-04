// COLLAB-P4 — võrgustikujagamise kitsas esimene vertikaal.
//
// Rada: eelpöördumine → töötaja koostab külmutatud kokkuvõtte ühele
// teenuseosutajale → KLIENT kinnitab, mida jagatakse → saadetakse → avaneb
// kirjalik ruum → saaja näeb AINULT talle jagatut → saaja vastab.
//
// Kolm asja, mis on siin arhitektuur, mitte poliitika:
//
//   1. **Saaja peab olema platvormi kasutaja.** `recipientUserId` on
//      kohustuslik FK. E-posti kutset ega `userId: null` rada siin ei ole —
//      see hoiab lõigu O-CO-6-st (mittekasutajate andmed) väljas. P5 avab selle
//      raamlepingu väravaga, mitte siin.
//
//   2. **Ilma kliendi kinnituseta ei liigu miski.** Kinnitamata jagamist ei saa
//      saata ühegi koodirajaga; `AWAITING_CLIENT` on eraldi olek, mitte lipp.
//
//   3. **Kokkuvõte külmub kinnitamisel.** Kui töötaja teksti pärast kinnitust
//      muudab, langeb jagamine tagasi mustandiks ja klient peab uuesti
//      kinnitama. Muidu saaks kinnituse alt teksti välja vahetada.
//
// Mida saaja EI näe: lähte-eelpöördumist, kliendi teekonda, juhtumitöö
// artefakte, meetodipeeglit, tööheaolu. `recipientProjection()` on ainus
// lubatud kuju ja ta ehitatakse valgest nimekirjast, mitte kustutamise teel.

export const NetworkShareStatus = Object.freeze({
  DRAFT: "DRAFT",
  AWAITING_CLIENT: "AWAITING_CLIENT",
  CONFIRMED: "CONFIRMED",
  DECLINED: "DECLINED",
  SENT: "SENT",
  OPENED: "OPENED",
  RESPONDED: "RESPONDED",
  RECALLED: "RECALLED",
  ENDED: "ENDED"
});

// Enne avamist tohib töötaja jagamise tagasi võtta; pärast avamist mitte —
// loetud teksti ei saa lugemata teha. Sama loogika mis eelpöördumisel.
const RECALLABLE_STATUSES = new Set([NetworkShareStatus.SENT]);
const EDITABLE_STATUSES = new Set([
  NetworkShareStatus.DRAFT,
  NetworkShareStatus.AWAITING_CLIENT,
  NetworkShareStatus.CONFIRMED
]);

export class NetworkShareError extends Error {
  constructor(code) {
    super(code);
    this.name = "NetworkShareError";
    this.code = code;
  }
}

function fail(code) {
  throw new NetworkShareError(code);
}

function cleanText(value, { max = 4000 } = {}) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function toDateOnly(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function assertDraftFields({ summaryText, purpose, sharingBoundary, participationEndsOn, now }) {
  const summary = cleanText(summaryText, { max: 20000 });
  if (!summary) fail("network_share.summary_required");
  const why = cleanText(purpose, { max: 2000 });
  if (!why) fail("network_share.purpose_required");
  const boundary = cleanText(sharingBoundary, { max: 2000 });
  if (!boundary) fail("network_share.sharing_boundary_required");

  // Kaardistamise lõpp on KOHUSTUSLIK — „igavesti vaikimisi" on keelatud.
  const endsOn = toDateOnly(participationEndsOn);
  if (!endsOn) fail("network_share.participation_end_required");
  const today = toDateOnly(now);
  if (endsOn.getTime() < today.getTime()) fail("network_share.participation_end_in_past");

  return { summary, why, boundary, endsOn };
}

/**
 * Töötaja koostab jagamise mustandi.
 *
 * Saaja peab olema OLEMASOLEV kasutaja — see kontroll on lõigu õiguslik värav,
 * mitte mugavuskontroll.
 */
export async function createNetworkShare({
  prisma,
  workerId,
  sourcePreInquiryId,
  clientUserId,
  recipientUserId,
  summaryText,
  purpose,
  sharingBoundary,
  participationEndsOn,
  now = () => new Date()
}) {
  if (!workerId) fail("network_share.worker_required");
  if (!sourcePreInquiryId) fail("network_share.source_required");
  if (!clientUserId) fail("network_share.client_required");
  if (!recipientUserId) fail("network_share.recipient_required");
  if (clientUserId === recipientUserId) fail("network_share.client_cannot_be_recipient");
  if (workerId === clientUserId) fail("network_share.worker_cannot_be_client");

  const fields = assertDraftFields({
    summaryText,
    purpose,
    sharingBoundary,
    participationEndsOn,
    now: now()
  });

  const source = await prisma.preInquiry.findFirst({ where: { id: sourcePreInquiryId } });
  if (!source) fail("network_share.source_not_found");

  // O-CO-6 värav: mittekasutajale ei jagata. Kontroll on serveris, mitte
  // liideses — liides võib alati valetada.
  const recipient = await prisma.user.findFirst({ where: { id: recipientUserId } });
  if (!recipient) fail("network_share.recipient_not_a_user");
  const client = await prisma.user.findFirst({ where: { id: clientUserId } });
  if (!client) fail("network_share.client_not_a_user");

  return prisma.networkShare.create({
    data: {
      sourcePreInquiryId,
      workerId,
      clientUserId,
      recipientUserId,
      summaryText: fields.summary,
      purpose: fields.why,
      sharingBoundary: fields.boundary,
      participationEndsOn: fields.endsOn,
      status: NetworkShareStatus.DRAFT,
      createdAt: now(),
      updatedAt: now()
    }
  });
}

async function loadForWorker(prisma, { shareId, workerId }) {
  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) fail("network_share.not_found");
  if (share.workerId !== workerId) fail("network_share.forbidden");
  return share;
}

/**
 * Teksti muutmine. Kinnitatud jagamise muutmine TÜHISTAB kinnituse — muidu
 * saaks kliendi kinnituse alt teksti välja vahetada.
 */
export async function updateNetworkShareDraft({
  prisma,
  shareId,
  workerId,
  summaryText,
  purpose,
  sharingBoundary,
  participationEndsOn,
  now = () => new Date()
}) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (!EDITABLE_STATUSES.has(share.status)) fail("network_share.not_editable");

  const fields = assertDraftFields({
    summaryText: summaryText ?? share.summaryText,
    purpose: purpose ?? share.purpose,
    sharingBoundary: sharingBoundary ?? share.sharingBoundary,
    participationEndsOn: participationEndsOn ?? share.participationEndsOn,
    now: now()
  });

  return prisma.networkShare.update({
    where: { id: share.id },
    data: {
      summaryText: fields.summary,
      purpose: fields.why,
      sharingBoundary: fields.boundary,
      participationEndsOn: fields.endsOn,
      // Iga sisumuudatus viib tagasi mustandisse ja kustutab kinnituse.
      status: NetworkShareStatus.DRAFT,
      clientConfirmedAt: null,
      clientDeclinedAt: null,
      clientDecisionNote: null,
      updatedAt: now()
    }
  });
}

/** Töötaja saadab jagamise kliendile ülevaatamiseks. */
export async function submitToClient({ prisma, shareId, workerId, now = () => new Date() }) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (share.status !== NetworkShareStatus.DRAFT) fail("network_share.not_draft");
  return prisma.networkShare.update({
    where: { id: share.id },
    data: { status: NetworkShareStatus.AWAITING_CLIENT, updatedAt: now() }
  });
}

/**
 * Klient kinnitab või keeldub. Ainult klient ise — töötaja ei saa kliendi eest
 * kinnitada ühegi rajaga.
 */
export async function clientRespondToShare({
  prisma,
  shareId,
  clientUserId,
  decision,
  note = "",
  now = () => new Date()
}) {
  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) fail("network_share.not_found");
  if (share.clientUserId !== clientUserId) fail("network_share.forbidden");
  if (share.status !== NetworkShareStatus.AWAITING_CLIENT) fail("network_share.not_awaiting_client");

  const normalized = String(decision || "").trim().toUpperCase();
  if (!["CONFIRMED", "DECLINED"].includes(normalized)) fail("network_share.invalid_decision");

  const stamp = now();
  return prisma.networkShare.update({
    where: { id: share.id },
    data: {
      status: normalized === "CONFIRMED" ? NetworkShareStatus.CONFIRMED : NetworkShareStatus.DECLINED,
      clientConfirmedAt: normalized === "CONFIRMED" ? stamp : null,
      clientDeclinedAt: normalized === "DECLINED" ? stamp : null,
      clientDecisionNote: cleanText(note, { max: 2000 }) || null,
      updatedAt: stamp
    }
  });
}

/**
 * Saatmine. Ainus koht, kus jagamine saajani jõuab — ja ta nõuab kliendi
 * kinnitust. Ruum avaneb SIIN, mitte mustandi loomisel.
 */
export async function sendNetworkShare({
  prisma,
  shareId,
  workerId,
  createRoom,
  now = () => new Date()
}) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (share.status !== NetworkShareStatus.CONFIRMED) fail("network_share.client_confirmation_required");
  if (!share.clientConfirmedAt) fail("network_share.client_confirmation_required");

  const stamp = now();
  let roomId = share.roomId || null;
  if (!roomId && typeof createRoom === "function") {
    const room = await createRoom({ share });
    roomId = room?.id || null;
  }

  return prisma.networkShare.update({
    where: { id: share.id },
    data: { status: NetworkShareStatus.SENT, sentAt: stamp, roomId, updatedAt: stamp }
  });
}

/** Saaja avab. Avamine sulgeb tagasivõtmise akna. */
export async function markShareOpened({ prisma, shareId, recipientUserId, now = () => new Date() }) {
  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) fail("network_share.not_found");
  if (share.recipientUserId !== recipientUserId) fail("network_share.forbidden");
  if (share.status !== NetworkShareStatus.SENT) fail("network_share.not_sent");
  const stamp = now();
  return prisma.networkShare.update({
    where: { id: share.id },
    data: { status: NetworkShareStatus.OPENED, openedAt: stamp, updatedAt: stamp }
  });
}

/** Tagasivõtmine on võimalik ainult enne avamist. */
export async function recallNetworkShare({ prisma, shareId, workerId, now = () => new Date() }) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (!RECALLABLE_STATUSES.has(share.status)) fail("network_share.not_recallable");
  const stamp = now();
  return prisma.networkShare.update({
    where: { id: share.id },
    data: { status: NetworkShareStatus.RECALLED, recalledAt: stamp, updatedAt: stamp }
  });
}

/**
 * Ainus kuju, mille saaja näeb.
 *
 * Ehitatud VALGEST NIMEKIRJAST: uus veerg mudelis ei leki siia iseenesest.
 * Kustutamise teel ehitatud projektsioon oleks sama kood, aga vale suunaga —
 * unustatud `delete` on leke, unustatud lisamine on ainult puuduv väli.
 */
export function recipientProjection(share, { viewerUserId } = {}) {
  if (!share) return null;
  if (viewerUserId && share.recipientUserId !== viewerUserId) return null;
  if (![NetworkShareStatus.SENT, NetworkShareStatus.OPENED, NetworkShareStatus.RESPONDED].includes(share.status)) {
    return null;
  }
  return {
    id: share.id,
    summaryText: share.summaryText,
    purpose: share.purpose,
    sharingBoundary: share.sharingBoundary,
    participationEndsOn: share.participationEndsOn,
    status: share.status,
    sentAt: share.sentAt,
    roomId: share.roomId
  };
}

export const RECIPIENT_VISIBLE_FIELDS = Object.freeze([
  "id",
  "summaryText",
  "purpose",
  "sharingBoundary",
  "participationEndsOn",
  "status",
  "sentAt",
  "roomId"
]);
