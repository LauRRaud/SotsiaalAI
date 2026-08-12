// SK-V1 — kiireloomulise abipalve domeenikiht.
//
// Rada: inimene ütleb ISE, et olukord ei kannata hommikuni → neli välja →
// kriisilukk → laua valmiduskontroll → kirje läheb mehitatud lauale → laud
// loeb, võtab või põhjendatult keeldub → aegumine ei jäta kedagi vastuseta.
//
// Viis asja on siin arhitektuur, mitte poliitika:
//
//   1. **Kriisilukk on ESIMENE samm, mitte viimane kontroll.** Eluohu korral
//      kirjet EI TEKI — vorm ei liigu edasi ja inimene saab 112 ekraani.
//      Fail-safe: kui tuvastaja ise viskab vea, loeme selle kriisiks.
//   2. **Laud on lüliti.** `assertUsableDesk` on ainus värav pöördumise
//      loomiseni ja ta kontrollib laua valmidust serveris, mitte liideses.
//   3. **Lubadus külmutatakse.** `readingTimePromise` kopeeritakse tekstina
//      kirje külge. KOV võib homme oma lubadust muuta; see, mida sellele
//      inimesele öeldi, ei muutu.
//   4. **Vaikus ei ole vastus.** Keeldumine nõuab põhjust ja aegumine tekitab
//      nähtava lõpu. Ükski kirje ei saa jääda rippuma.
//   5. **AI ei triaaži.** Siin failis ei ole ühtegi skoori, järjekorranumbrit
//      ega masinhinnangut — järjekord on ajaline ja ainult ajaline.

import {
  detectCrisis as defaultDetectCrisis
} from "@/lib/chat/safety";
import { deskReadiness } from "@/lib/urgent/desk";

export const UrgentRequestStatus = Object.freeze({
  SENT: "SENT",
  READ: "READ",
  TAKEN: "TAKEN",
  DECLINED: "DECLINED",
  RESOLVED: "RESOLVED",
  EXPIRED: "EXPIRED",
  RECALLED: "RECALLED"
});

export const UrgentRequestEventKind = Object.freeze({
  CREATED: "CREATED",
  VIEWED: "VIEWED",
  READ_MARKED: "READ_MARKED",
  TAKEN: "TAKEN",
  DECLINED: "DECLINED",
  RESOLVED: "RESOLVED",
  RECALLED: "RECALLED",
  EXPIRED: "EXPIRED",
  HANDED_OVER: "HANDED_OVER",
  HANDOVER_ACCEPTED: "HANDOVER_ACCEPTED",
  CONVERTED: "CONVERTED"
});

export const UrgentRequestRecipientType = Object.freeze({
  KOV_CONTACT: "KOV_CONTACT",
  SERVICE_PROVIDER: "SERVICE_PROVIDER"
});

/** Olekud, milles laud VÕLGNEB veel vastust. Ainult neid saab aegumine puutuda. */
const AWAITING_STATUSES = new Set([UrgentRequestStatus.SENT, UrgentRequestStatus.READ]);
/** Lõppseisud — siit edasi ei liiguta. */
const TERMINAL_STATUSES = new Set([
  UrgentRequestStatus.DECLINED,
  UrgentRequestStatus.RESOLVED,
  UrgentRequestStatus.EXPIRED,
  UrgentRequestStatus.RECALLED
]);

export class UrgentRequestError extends Error {
  constructor(code) {
    super(code);
    this.name = "UrgentRequestError";
    this.code = code;
  }
}

function fail(code) {
  throw new UrgentRequestError(code);
}

function cleanText(value, { max = 4000 } = {}) {
  return String(value == null ? "" : value).trim().slice(0, max);
}

function hasEnoughDigits(value, minimum = 5) {
  return (String(value || "").match(/\d/g) || []).length >= minimum;
}

// --- Kriisilukk --------------------------------------------------------------

/**
 * Haru C (leping ptk 5): eluoht ei tekita järjekorda.
 *
 * Kaks päästikut, mõlemad fail-safe:
 *   - inimene vastas ise „jah, keegi on ohus";
 *   - `detectCrisis()` tabab teksti.
 *
 * Tuvastaja enda viga loetakse kriisiks. Halvim tulemus siin ei ole liiga sage
 * 112-ekraan, vaid eluohtlik olukord, mis jäi ootama, et keegi hommikul loeks.
 */
export function isEmergencyRoute({ situationVerbatim, safetyAnswer, detectCrisis = defaultDetectCrisis }) {
  if (safetyAnswer === true) return true;
  try {
    return detectCrisis(String(situationVerbatim || "")) === true;
  } catch {
    return true;
  }
}

// --- Laua värav --------------------------------------------------------------

async function loadDeskWithMemberCount(prisma, { municipalityId, recipientType }) {
  const desk = await prisma.urgentDesk.findFirst({
    where: { municipalityId, recipientType }
  });
  if (!desk) return { desk: null, activeMemberCount: 0 };
  const activeMemberCount = await prisma.urgentDeskMember.count({
    where: { deskId: desk.id, isActive: true }
  });
  return { desk, activeMemberCount };
}

/**
 * Kas selles piirkonnas on laud, mis tohib pöördumise vastu võtta?
 *
 * Seda kutsuvad NII avalik nähtavuspäring KUI loomine — üks reegel, kaks
 * kasutuskohta. Kui neid oleks kaks, läheks nad ühel päeval lahku ja nupp
 * jääks nähtavaks pärast seda, kui laud kinni pandi.
 */
export async function resolveUsableDesk({
  prisma,
  municipalityId,
  recipientType = UrgentRequestRecipientType.KOV_CONTACT,
  now = () => new Date()
}) {
  const region = cleanText(municipalityId, { max: 60 });
  if (!region) return { desk: null, ready: false, reasons: ["urgent_request.municipality_required"] };

  // Saajatüüp tuleb päringust, seega ta valideeritakse enne andmebaasi jõudmist.
  // Tundmatu väärtus ei tohi anda 500-t ega libiseda vaikimisi väärtusele —
  // ta on kinni, nagu iga muu teadmatus siin failis.
  const kind = cleanText(recipientType, { max: 40 }).toUpperCase();
  if (!Object.hasOwn(UrgentRequestRecipientType, kind)) {
    return { desk: null, ready: false, reasons: ["urgent_request.recipient_type_invalid"] };
  }

  const { desk, activeMemberCount } = await loadDeskWithMemberCount(prisma, {
    municipalityId: region,
    recipientType: kind
  });
  const readiness = deskReadiness(desk, { now: now(), activeMemberCount });
  return { desk, activeMemberCount, ready: readiness.ready, reasons: readiness.reasons };
}

async function assertUsableDesk(args) {
  const resolved = await resolveUsableDesk(args);
  // ÜKS veakood väljapoole. Admin näeb põhjusi oma vaates; pöördujale ei
  // kirjeldata, MIKS naabervalla laud kinni on — see ei ole tema info.
  if (!resolved.ready) fail("urgent_request.desk_not_available");
  return resolved.desk;
}

// --- Vastutusjälg ------------------------------------------------------------

async function recordEvent(prisma, { requestId, kind, actorId = null, note = "", at }) {
  return prisma.urgentRequestEvent.create({
    data: {
      requestId,
      kind,
      actorId: actorId || null,
      // Sisu siia EI kirjutata: rida ütleb, kes mida millal tegi.
      note: cleanText(note, { max: 2000 }) || null,
      createdAt: at
    }
  });
}

// --- Loomine -----------------------------------------------------------------

function expiryFrom(desk, at) {
  const hours = Number(desk.requestLifetimeHours) || 24;
  return new Date(at.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Inimene saadab kiireloomulise abipalve.
 *
 * Nupuvajutus ON nõusolek (leping 3.4): eraldi „kas nõustud edastamisega"
 * linnukest ei ole, sest inimene ise palub info edasi saata.
 */
export async function createUrgentRequest({
  prisma,
  authorId,
  municipalityId,
  recipientType = UrgentRequestRecipientType.KOV_CONTACT,
  situationVerbatim,
  contactName,
  contactPhone,
  safetyAnswer,
  detectCrisis = defaultDetectCrisis,
  now = () => new Date()
}) {
  const situation = cleanText(situationVerbatim, { max: 8000 });
  const name = cleanText(contactName, { max: 120 });
  const phone = cleanText(contactPhone, { max: 60 });

  // Kriisilukk ENNE valideerimist ja enne lauakontrolli. Eluohtlikus olukorras
  // ei tohi inimene saada veateadet puuduva välja kohta — ta peab saama
  // hädaabinumbri.
  if (isEmergencyRoute({ situationVerbatim: situation, safetyAnswer, detectCrisis })) {
    fail("urgent_request.emergency_route");
  }

  /* SOL-URG-03: vastamata ohuküsimus EI OLE vastus „ei". Vaikeväärtus `false` ja
     route'i `=== true` teisendus tähendasid koos seda, et puuduv, `null`, string või
     0 libises vaikselt eitusesse ja pöördumine läks tavajärjekorda. Siit edasi pääseb
     ainult OTSENE `false`; `true` on juba eespool hädaabirajale läinud, nagu ka
     tekstituvastaja tabamus. Teadmatus on siin kinni, mitte lahti — aga ta on
     VALIDEERIMISVIGA, mitte 112-ekraan: 112 antakse siis, kui midagi VIITAB ohule,
     mitte siis, kui vastus on lihtsalt puudu. */
  if (safetyAnswer !== false) fail("urgent_request.safety_answer_required");

  if (!authorId) fail("urgent_request.author_required");
  if (!situation) fail("urgent_request.situation_required");
  if (!name) fail("urgent_request.contact_name_required");
  if (!phone || !hasEnoughDigits(phone)) fail("urgent_request.contact_phone_required");

  const at = now();
  const desk = await assertUsableDesk({ prisma, municipalityId, recipientType, now });

  const created = await prisma.urgentRequest.create({
    data: {
      authorId,
      deskId: desk.id,
      municipalityId: desk.municipalityId,
      recipientType: desk.recipientType,
      situationVerbatim: situation,
      /* SOL-URG-04: AI-mustandit EI VÕETA kliendilt. Väli oli avalikust kehast
         läbi kirjutatav ja laua vaade märgistab ta „AI koostatud mustandiks" —
         muudetud klient sai seega panna oma teksti masina autoriteedi alla.
         Serveripoolset tootjat, kes kannaks mudelit, päritolu ja sisendiseost, ei
         ole olemas, seega väli JÄÄB TÜHJAKS kuni ta tekib. Tühi mustand on aus;
         tõendamata mustand ei ole. */
      assistantStructured: null,
      contactName: name,
      contactPhone: phone,
      safetyAnswer,
      status: UrgentRequestStatus.SENT,
      // Külmutatud lubadus: tekstina, mitte viitena.
      readingTimePromise: desk.readingTimePromise,
      sentAt: at,
      expiresAt: expiryFrom(desk, at),
      createdAt: at,
      updatedAt: at
    }
  });

  await recordEvent(prisma, {
    requestId: created.id,
    kind: UrgentRequestEventKind.CREATED,
    actorId: authorId,
    at
  });
  return created;
}

// --- Ligipääs ----------------------------------------------------------------

async function loadRequest(prisma, requestId) {
  const request = await prisma.urgentRequest.findFirst({ where: { id: String(requestId || "") } });
  if (!request) fail("urgent_request.not_found");
  return request;
}

/**
 * Kas see inimene istub selle laua taga?
 *
 * Laua omanik loeb mehitajaks — muidu jääks laud oma omanikule nähtamatuks.
 * Admin EI ole siin automaatselt sees: kiireloomuline abipalve on inimese
 * pöördumine KOV-ile, mitte platvormi sisevaade.
 */
export async function isDeskStaff(prisma, { deskId, userId }) {
  if (!deskId || !userId) return false;
  const desk = await prisma.urgentDesk.findFirst({ where: { id: deskId } });
  if (!desk) return false;
  if (desk.ownerUserId && desk.ownerUserId === userId) return true;
  const membership = await prisma.urgentDeskMember.findFirst({
    where: { deskId, userId, isActive: true }
  });
  return Boolean(membership);
}

async function loadForDeskStaff(prisma, { requestId, userId }) {
  const request = await loadRequest(prisma, requestId);
  const staff = await isDeskStaff(prisma, { deskId: request.deskId, userId });
  if (!staff) fail("urgent_request.forbidden");
  return request;
}

async function loadForAuthor(prisma, { requestId, userId }) {
  const request = await loadRequest(prisma, requestId);
  if (!request.authorId || request.authorId !== userId) fail("urgent_request.forbidden");
  return request;
}

// --- Laua toimingud ----------------------------------------------------------

/**
 * Vaatamine. Iga avamine jätab jälje ka siis, kui töötaja midagi ei teinud —
 * KOV-lepingu p 8 nõuab, et iga VAATAMINE oleks seotud inimese ja kellaajaga.
 */
export async function viewUrgentRequest({ prisma, requestId, userId, now = () => new Date() }) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.VIEWED,
    actorId: userId,
    at: now()
  });
  return request;
}

/** Laud märgib pöördumise loetuks. Siin täitub lugemisaja lubadus. */
export async function markUrgentRequestRead({ prisma, requestId, userId, now = () => new Date() }) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  if (request.status !== UrgentRequestStatus.SENT) fail("urgent_request.not_sent");
  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: { status: UrgentRequestStatus.READ, readAt: at, updatedAt: at }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.READ_MARKED,
    actorId: userId,
    at
  });
  return updated;
}

/** „Võtan." */
export async function takeUrgentRequest({ prisma, requestId, userId, note = "", now = () => new Date() }) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  if (!AWAITING_STATUSES.has(request.status)) fail("urgent_request.not_actionable");
  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: {
      status: UrgentRequestStatus.TAKEN,
      takenAt: at,
      readAt: request.readAt || at,
      updatedAt: at
    }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.TAKEN,
    actorId: userId,
    note,
    at
  });
  return updated;
}

/**
 * „Ei jõua." — E5 kohustuslik rada.
 *
 * Põhjus on NÕUTAV. Keeldumine ilma põhjuseta oleks vaikus teise nime all, ja
 * vaikus on siin halvim võimalik tulemus: inimene ei tea, kas ta ootab edasi
 * või peab kuhugi mujale minema.
 */
export async function declineUrgentRequest({ prisma, requestId, userId, reason, now = () => new Date() }) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  if (TERMINAL_STATUSES.has(request.status)) fail("urgent_request.not_actionable");
  const text = cleanText(reason, { max: 2000 });
  if (!text) fail("urgent_request.decline_reason_required");
  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: {
      status: UrgentRequestStatus.DECLINED,
      declinedAt: at,
      declineReason: text,
      readAt: request.readAt || at,
      updatedAt: at
    }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.DECLINED,
    actorId: userId,
    note: text,
    at
  });
  return updated;
}

/** Laud lõpetab töö selle pöördumisega. */
export async function resolveUrgentRequest({ prisma, requestId, userId, note = "", now = () => new Date() }) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  if (request.status !== UrgentRequestStatus.TAKEN) fail("urgent_request.not_taken");
  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: { status: UrgentRequestStatus.RESOLVED, resolvedAt: at, updatedAt: at }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.RESOLVED,
    actorId: userId,
    note,
    at
  });
  return updated;
}

// --- Inimese enda toimingud --------------------------------------------------

/**
 * Tagasivõtt. Sama loogika mis eelpöördumisel: kuni vastuvõtja ei ole kirja
 * avanud, saab pöördumise tagasi võtta. Loetud teksti ei saa lugemata teha.
 */
export async function recallUrgentRequest({ prisma, requestId, userId, now = () => new Date() }) {
  const request = await loadForAuthor(prisma, { requestId, userId });
  if (request.status !== UrgentRequestStatus.SENT) fail("urgent_request.not_recallable");
  if (request.readAt) fail("urgent_request.not_recallable");
  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: { status: UrgentRequestStatus.RECALLED, recalledAt: at, updatedAt: at }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.RECALLED,
    actorId: userId,
    at
  });
  return updated;
}

// --- Elutsükkel --------------------------------------------------------------

/**
 * Aegumine. Puutub AINULT neid kirjeid, mille kohta laud veel vastust võlgneb.
 * Võetud pöördumine ei aegu — töö käib.
 *
 * Aegumine ei ole vaikne: ta jätab sündmuse ja inimese vaates tekib nähtav lõpp
 * („keegi ei jõudnud lubatud aja jooksul vastata").
 */
export async function expireOverdueUrgentRequests({ prisma, now = () => new Date(), limit = 200 }) {
  const at = now();
  const due = await prisma.urgentRequest.findMany({
    where: {
      status: { in: [UrgentRequestStatus.SENT, UrgentRequestStatus.READ] },
      expiresAt: { lte: at }
    },
    take: limit
  });

  const expired = [];
  for (const request of due) {
    await prisma.urgentRequest.update({
      where: { id: request.id },
      data: { status: UrgentRequestStatus.EXPIRED, updatedAt: at }
    });
    await recordEvent(prisma, {
      requestId: request.id,
      kind: UrgentRequestEventKind.EXPIRED,
      actorId: null,
      at
    });
    expired.push(request.id);
  }
  return { expired, count: expired.length };
}

// --- Üleandmine --------------------------------------------------------------

/**
 * Vahetuse ja üksuse üleandmine (Soome kogemuse nõue 3).
 *
 * Öine juhtum peab jõudma hommikul õige üksuseni KOOS tegevuslooga, ja
 * üleandmine vajab VASTUVÕTUKINNITUST. Üleandmine üksi ei ole vastutuse
 * loovutamine — kuni vastuvõttev laud ei ole kinnitanud, vastutab endine.
 */
export async function handOverUrgentRequest({
  prisma,
  requestId,
  userId,
  targetDeskId,
  note = "",
  now = () => new Date()
}) {
  const request = await loadForDeskStaff(prisma, { requestId, userId });
  if (TERMINAL_STATUSES.has(request.status)) fail("urgent_request.not_actionable");
  const target = cleanText(targetDeskId, { max: 60 });
  if (!target) fail("urgent_request.handover_target_required");
  if (target === request.deskId) fail("urgent_request.handover_target_same");

  const targetDesk = await prisma.urgentDesk.findFirst({ where: { id: target } });
  if (!targetDesk) fail("urgent_request.handover_target_not_found");
  if (targetDesk.isActive !== true) fail("urgent_request.handover_target_inactive");

  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: {
      handoverDeskId: targetDesk.id,
      handedOverAt: at,
      handoverAcceptedAt: null,
      handoverNote: cleanText(note, { max: 2000 }) || null,
      updatedAt: at
    }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.HANDED_OVER,
    actorId: userId,
    note,
    at
  });
  return updated;
}

/**
 * Vastuvõttev üksus kinnitab. ALLES SIIN liigub juhtum uue laua kätte —
 * ja alles siis on endine laud vastutusest vaba.
 */
export async function acceptUrgentHandover({ prisma, requestId, userId, now = () => new Date() }) {
  const request = await loadRequest(prisma, requestId);
  if (!request.handoverDeskId) fail("urgent_request.no_handover");
  if (request.handoverAcceptedAt) fail("urgent_request.handover_already_accepted");

  const staff = await isDeskStaff(prisma, { deskId: request.handoverDeskId, userId });
  if (!staff) fail("urgent_request.forbidden");

  const at = now();
  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: {
      deskId: request.handoverDeskId,
      handoverAcceptedAt: at,
      updatedAt: at
    }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.HANDOVER_ACCEPTED,
    actorId: userId,
    at
  });
  return updated;
}

// --- Konversioon: esiuks → tuba ----------------------------------------------

/**
 * Kiireloomulisest abipalvest saab eelpöördumise, ilma et inimene peaks midagi
 * uuesti trükkima. Verbatim-tekst läheb `situation` väljale MUUTMATA — see on
 * konversiooni ainus mõte.
 *
 * Tekib MUSTAND, mitte saadetud eelpöördumine: konversioon ei tohi kellegi
 * eest midagi ära saata.
 */
export async function convertUrgentRequestToPreInquiry({
  prisma,
  requestId,
  userId,
  now = () => new Date()
}) {
  const request = await loadForAuthor(prisma, { requestId, userId });
  if (request.convertedPreInquiryId) fail("urgent_request.already_converted");

  const at = now();
  const preInquiry = await prisma.preInquiry.create({
    data: {
      authorId: request.authorId,
      recipientType: request.recipientType,
      situation: request.situationVerbatim,
      status: "DRAFT",
      createdAt: at,
      updatedAt: at
    }
  });

  const updated = await prisma.urgentRequest.update({
    where: { id: request.id },
    data: { convertedPreInquiryId: preInquiry.id, updatedAt: at }
  });
  await recordEvent(prisma, {
    requestId: request.id,
    kind: UrgentRequestEventKind.CONVERTED,
    actorId: userId,
    at
  });
  return { request: updated, preInquiry };
}

// --- Projektsioonid ----------------------------------------------------------

/**
 * Mida inimene oma pöördumise kohta näeb.
 *
 * `awaitingAnswer` on siin selleks, et „Minu jagamised" saaks eristada ootamist
 * lõppenud loost — inimene peab nägema, kas keegi veel vastab.
 */
export function authorProjection(request) {
  if (!request) return null;
  return {
    id: request.id,
    status: request.status,
    situationVerbatim: request.situationVerbatim,
    readingTimePromise: request.readingTimePromise,
    sentAt: request.sentAt,
    readAt: request.readAt,
    takenAt: request.takenAt,
    declinedAt: request.declinedAt,
    declineReason: request.declineReason,
    resolvedAt: request.resolvedAt,
    expiresAt: request.expiresAt,
    recalledAt: request.recalledAt,
    convertedPreInquiryId: request.convertedPreInquiryId || null,
    awaitingAnswer: AWAITING_STATUSES.has(request.status),
    canRecall: request.status === UrgentRequestStatus.SENT && !request.readAt
  };
}

/**
 * Mida laua taga istuv töötaja näeb.
 *
 * `situationVerbatim` ja `assistantStructured` on KAKS ERI VÄLJA ja kuvakiht
 * peab neid eristama. Masina mustandit ei esitata kunagi inimese ütlusena.
 */
export function deskProjection(request) {
  if (!request) return null;
  return {
    id: request.id,
    kind: "URGENT_REQUEST",
    status: request.status,
    situationVerbatim: request.situationVerbatim,
    assistantStructured: request.assistantStructured || null,
    contactName: request.contactName,
    contactPhone: request.contactPhone,
    readingTimePromise: request.readingTimePromise,
    sentAt: request.sentAt,
    readAt: request.readAt,
    takenAt: request.takenAt,
    declinedAt: request.declinedAt,
    declineReason: request.declineReason,
    resolvedAt: request.resolvedAt,
    expiresAt: request.expiresAt,
    handoverDeskId: request.handoverDeskId || null,
    handedOverAt: request.handedOverAt || null,
    handoverAcceptedAt: request.handoverAcceptedAt || null,
    handoverNote: request.handoverNote || null
  };
}

export const DESK_VISIBLE_FIELDS = Object.freeze([
  "id",
  "kind",
  "status",
  "situationVerbatim",
  "assistantStructured",
  "contactName",
  "contactPhone",
  "readingTimePromise",
  "sentAt",
  "readAt",
  "takenAt",
  "declinedAt",
  "declineReason",
  "resolvedAt",
  "expiresAt",
  "handoverDeskId",
  "handedOverAt",
  "handoverAcceptedAt",
  "handoverNote"
]);
