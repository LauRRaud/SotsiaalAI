// COLLAB-P4 — võrgustikujagamise kitsas esimene vertikaal.
//
// Rada: eelpöördumine → töötaja koostab külmutatud kokkuvõtte ühele
// teenuseosutajale → KLIENT kinnitab, mida jagatakse → saadetakse → avaneb
// kirjalik ruum → saaja näeb AINULT talle jagatut → saaja vastab.
//
// Neli asja, mis on siin arhitektuur, mitte poliitika:
//
//   1. **Saaja peab olema platvormi kasutaja.** `recipientUserId` on
//      kohustuslik FK. Jagamine läheb ainult inimesele, kes on juba platvormil
//      ja seega raamlepingu all.
//
//   2. **Klient EI PEA olema kasutaja** (omanik 04.08). Võrgustikutöö on
//      sotsiaaltöötaja tööülesanne ja klient saab info nagunii hiljem —
//      kasutajaks olemist ei saa nõuda, aga võimaldada võib. Kaks rada:
//        - **kasutaja** → kinnitab ise, meetod `IN_APP`;
//        - **väline** → töötaja kannab kinnituse üle, meetod `IN_PERSON` /
//          `PHONE` / `WRITTEN`, ja see on NÕRGEM tõend, mis jääb eristatavaks.
//      Väline rada käitleb mittekasutaja andmeid, seega nõuab ta **kehtivat
//      raamlepingut nii töötajal kui saajal** (O-CO-6, omanik 04.08).
//
//   3. **Ilma kliendi kinnituseta ei liigu miski.** Kinnitamata jagamist ei saa
//      saata ühegi koodirajaga; `AWAITING_CLIENT` on eraldi olek, mitte lipp.
//
//   4. **Kokkuvõte külmub kinnitamisel.** Kui töötaja teksti pärast kinnitust
//      muudab, langeb jagamine tagasi mustandiks ja klient peab uuesti
//      kinnitama. Muidu saaks kinnituse alt teksti välja vahetada.
//
// Mida saaja EI näe: lähte-eelpöördumist, kliendi teekonda, juhtumitöö
// artefakte, meetodipeeglit, tööheaolu. `recipientProjection()` on ainus
// lubatud kuju ja ta ehitatakse valgest nimekirjast, mitte kustutamise teel.

export const ClientConfirmationMethod = Object.freeze({
  IN_APP: "IN_APP",
  IN_PERSON: "IN_PERSON",
  PHONE: "PHONE",
  WRITTEN: "WRITTEN"
});

// Ainus meetod, mille puhul klient ise vajutas. Kõik ülejäänud on töötaja
// ülekantud kinnitus ja neid ei tohi esitada kliendi enda toiminguna.
const ATTESTED_METHODS = new Set([
  ClientConfirmationMethod.IN_PERSON,
  ClientConfirmationMethod.PHONE,
  ClientConfirmationMethod.WRITTEN
]);

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
  clientUserId = null,
  clientDisplayName = "",
  clientExternalRef = "",
  recipientUserId,
  summaryText,
  purpose,
  sharingBoundary,
  participationEndsOn,
  /**
   * Port: `(userId) => Promise<boolean>` — kas sellel inimesel on kehtiv
   * allkirjastatud raamleping. Nõutav AINULT välise kliendi rajal. Port, mitte
   * otseimport, et domeenikihti saaks testida ilma andmebaasita.
   */
  hasFrameworkAcceptance = null,
  now = () => new Date()
}) {
  if (!workerId) fail("network_share.worker_required");
  if (!sourcePreInquiryId) fail("network_share.source_required");
  if (!recipientUserId) fail("network_share.recipient_required");

  const fields = assertDraftFields({
    summaryText,
    purpose,
    sharingBoundary,
    participationEndsOn,
    now: now()
  });

  const source = await prisma.preInquiry.findFirst({ where: { id: sourcePreInquiryId } });
  if (!source) fail("network_share.source_not_found");

  // IDOR-värav (leitud päris sessiooniga 04.08, testid seda ei püüdnud).
  // Varem kontrolliti ainult, et pöördumine EKSISTEERIB — seega sai iga töötaja
  // võtta suvalise pöördumise ID ja siduda jagamise võõra kliendi identiteediga.
  // Klient oleks saanud kinnitustaotluse juhtumi kohta, mille selle töötajaga
  // tal seost ei ole. Jagamist tohib teha ainult see, kellele pöördumine tuli.
  if (!source.recipientOwnerId || source.recipientOwnerId !== workerId) {
    fail("network_share.source_forbidden");
  }

  // Klient TULETATAKSE lähte-eelpöördumisest, mitte liidesest. Pöördumise
  // autor ONGI see inimene, kelle loost kokkuvõte tehakse — kui liides tohiks
  // kliendi ise nimetada, saaks töötaja kogemata siduda kokkuvõtte vale
  // inimesega. Sama põhimõte, mis marsruudikihis: identiteet tuleb tõeallikast,
  // mitte päringust.
  const derivedClientUserId = clientUserId || source.authorId || null;
  const displayName = cleanText(clientDisplayName, { max: 120 });
  const externalRef = cleanText(clientExternalRef, { max: 120 });
  // Autorita pöördumine = klient ei ole (või ei ole enam) platvormi kasutaja.
  const isExternalClient = !derivedClientUserId;
  if (isExternalClient && !displayName) fail("network_share.client_required");
  if (derivedClientUserId && derivedClientUserId === recipientUserId) fail("network_share.client_cannot_be_recipient");
  if (derivedClientUserId && derivedClientUserId === workerId) fail("network_share.worker_cannot_be_client");

  // Saaja peab olema kasutaja. Kontroll on serveris, mitte liideses — liides
  // võib alati valetada.
  const recipient = await prisma.user.findFirst({ where: { id: recipientUserId } });
  if (!recipient) fail("network_share.recipient_not_a_user");

  if (derivedClientUserId) {
    const client = await prisma.user.findFirst({ where: { id: derivedClientUserId } });
    if (!client) fail("network_share.client_not_a_user");
  } else {
    // O-CO-6 värav: väline klient tähendab mittekasutaja isikuandmeid. Neid
    // tohib käidelda ainult siis, kui raamleping on allkirjastatud NII töötajal
    // kui saajal (omanik 04.08). Ilma kontrollita rada ei avane.
    if (typeof hasFrameworkAcceptance !== "function") {
      fail("network_share.framework_check_unavailable");
    }
    const [workerOk, recipientOk] = await Promise.all([
      hasFrameworkAcceptance(workerId),
      hasFrameworkAcceptance(recipientUserId)
    ]);
    if (!workerOk) fail("network_share.worker_framework_agreement_required");
    if (!recipientOk) fail("network_share.recipient_framework_agreement_required");
  }

  return prisma.networkShare.create({
    data: {
      sourcePreInquiryId,
      workerId,
      clientUserId: derivedClientUserId,
      clientDisplayName: displayName || null,
      clientExternalRef: externalRef || null,
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
  // Väline klient ei saa siia rajale tulla — tal ei ole kontot, millega
  // autentida. Tema otsus käib `attestClientDecision` kaudu ja saab teise
  // meetodimärke.
  if (!share.clientUserId) fail("network_share.client_is_external");
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
      clientConfirmationMethod: ClientConfirmationMethod.IN_APP,
      clientConfirmationAttestedById: null,
      updatedAt: stamp
    }
  });
}

/**
 * Töötaja kannab välise kliendi otsuse üle: klient ütles selle näost näkku,
 * telefonis või kirjalikult.
 *
 * See on TEADLIKULT nõrgem tõend kui kliendi enda vajutus ja jääb kirjes
 * eristatavaks (`clientConfirmationMethod` + `clientConfirmationAttestedById`).
 * Sama piir, mis kehtib AI mustandi ja inimese ütluse vahel: platvorm ei esita
 * kunagi ühe inimese ülekannet teise inimese enda toiminguna.
 *
 * Kontoga kliendi eest EI SAA keegi kinnitada — see rada on talle suletud.
 */
export async function attestClientDecision({
  prisma,
  shareId,
  workerId,
  decision,
  method,
  note = "",
  now = () => new Date()
}) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (share.clientUserId) fail("network_share.client_must_confirm_themselves");
  if (share.status !== NetworkShareStatus.AWAITING_CLIENT) fail("network_share.not_awaiting_client");

  const normalized = String(decision || "").trim().toUpperCase();
  if (!["CONFIRMED", "DECLINED"].includes(normalized)) fail("network_share.invalid_decision");

  const normalizedMethod = String(method || "").trim().toUpperCase();
  if (!ATTESTED_METHODS.has(normalizedMethod)) fail("network_share.attested_method_required");

  const stamp = now();
  return prisma.networkShare.update({
    where: { id: share.id },
    data: {
      status: normalized === "CONFIRMED" ? NetworkShareStatus.CONFIRMED : NetworkShareStatus.DECLINED,
      clientConfirmedAt: normalized === "CONFIRMED" ? stamp : null,
      clientDeclinedAt: normalized === "DECLINED" ? stamp : null,
      clientDecisionNote: cleanText(note, { max: 2000 }) || null,
      clientConfirmationMethod: normalizedMethod,
      clientConfirmationAttestedById: workerId,
      updatedAt: stamp
    }
  });
}

/**
 * Kas see kinnitus on kliendi enda toiming või töötaja ülekanne?
 * Kuvakiht peab neid eristama — number ilma tõendiväärtuseta on eksitav.
 */
export function isClientOwnConfirmation(share) {
  return Boolean(share?.clientUserId) && share?.clientConfirmationMethod === ClientConfirmationMethod.IN_APP;
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
