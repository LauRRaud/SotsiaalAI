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

import { createHash } from "node:crypto";

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

// JTA-V1 (E1) — jagamised, mis OOTAVAD TÖÖTAJA TEGU.
//
// MIKS SIIN, MITTE LAUAS (JTA leping L10): omanikupiir on `workerId` ja ta peab
// elama koos mudeliga. Enne seda elas nimekirja päring `app/api/network-shares/
// route.js`-i sees ja moodulil ei olnud ühtegi lugejat — laud oleks pidanud
// kirjutama oma `findMany`-t, mis on täpselt 04.08 IDOR-i muster.
//
// „OOTAB TEGU" EI OLE SAMA MIS „AKTIIVNE". `SENT`, `OPENED` ja `RESPONDED` on
// töös, aga töötaja poolel ei ole neis midagi teha — pall on saajal. Laual on
// mõtet ainult neil, kus järgmine samm on töötaja oma:
//   DRAFT           → koosta lõpuni
//   AWAITING_CLIENT → klient ei ole veel otsustanud (jälgi)
//   CONFIRMED       → klient kinnitas, saatmine on tegemata
//   DECLINED        → klient keeldus, vaja otsust
// Kui laud näitaks kõiki, muutuks ta nimekirjaks, mida keegi läbi ei vaata.
const WORKER_ACTIONABLE_STATUSES = Object.freeze([
  NetworkShareStatus.DRAFT,
  NetworkShareStatus.AWAITING_CLIENT,
  NetworkShareStatus.CONFIRMED,
  NetworkShareStatus.DECLINED
]);

// VALITUD VÄLJAD, MITTE TERVE RIDA. Loend on kaardi jaoks: „see ootab sinu
// tegu". `summaryText`, `purpose` ja `sharingBoundary` on kliendi sisu ja
// nemad avanevad jagamise enda vaates, kus nende lugemine on teadlik tegu.
// Ilma `select`-ita kannaks iga uus veerg end siia loendisse ise — ja sealt
// edasi kõikjale, kus loendit kasutatakse.
const WORKER_ACTIONABLE_SELECT = Object.freeze({
  id: true,
  status: true,
  updatedAt: true
});

export async function listWorkerActionableShares({ prisma, workerId, limit = 50 } = {}) {
  const owner = typeof workerId === "string" && workerId.trim() ? workerId.trim() : "";
  if (!owner || !prisma) return [];
  const take = Math.min(Math.max(Number(limit) || 50, 1), 200);
  const rows = await prisma.networkShare.findMany({
    where: { workerId: owner, status: { in: WORKER_ACTIONABLE_STATUSES } },
    select: WORKER_ACTIONABLE_SELECT,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take
  });
  return rows || [];
}

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

function isTransactionConflict(error) {
  return error?.code === "P2034";
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

/**
 * Kaasamise lõpp on kuupäev, mitte kellaaeg: lõppkuupäeva enda jooksul on
 * ligipääs veel elus ja järgmisel UTC päeval enam mitte. Sama otsust kasutavad
 * saatmine, detail, ruumivärav ja sweep — muidu tekiks neli eri „täna".
 */
export function isNetworkShareParticipationActive(share, { now = new Date() } = {}) {
  const endsOn = toDateOnly(share?.participationEndsOn);
  const today = toDateOnly(now);
  return Boolean(endsOn && today && endsOn.getTime() >= today.getTime());
}

function assertParticipationActive(share, stamp) {
  if (!isNetworkShareParticipationActive(share, { now: stamp })) {
    fail("network_share.participation_ended");
  }
}

async function assertExternalFrameworkAcceptances({ share, hasFrameworkAcceptance, db }) {
  if (share?.clientUserId) return;
  if (typeof hasFrameworkAcceptance !== "function") {
    fail("network_share.framework_check_unavailable");
  }
  const [workerOk, recipientOk] = await Promise.all([
    hasFrameworkAcceptance(share.workerId, { db }),
    hasFrameworkAcceptance(share.recipientUserId, { db })
  ]);
  if (!workerOk) fail("network_share.worker_framework_agreement_required");
  if (!recipientOk) fail("network_share.recipient_framework_agreement_required");
}

/**
 * Väljade eraldaja kanoonilises stringis. `\x1E` (record separator) on valitud
 * kahel põhjusel: teda ei saa kasutaja tekstis olla, ja ta on Postgresi
 * `text`-is lubatud — erinevalt `\x00`-st, mille peale `convert_to` kukuks.
 */
const CONTENT_SEPARATOR = String.fromCharCode(0x1e);

/**
 * SISU RÄSI — SOL-NET-01/-02 kandev primitiiv.
 *
 * Eraldaja on `\x1E` (record separator): teda ei saa kasutaja tekstis olla,
 * aga ta on Postgresi `text`-is lubatud (erinevalt `\x00`-st). Ilma eraldajata
 * annaksid „ab" + „c" ja „a" + „bc" sama räsi ja kaks eri jagamist näeksid
 * välja ühesugused.
 *
 * SAMA STRING ARVUTATAKSE MIGRATSIOONIS SQL-is
 * (`20260810180000_sol_net_01_02_content_hash`). Kui muudad siin midagi,
 * muutub iga olemasoleva rea kinnitus kehtetuks — see ei ole vormistusdetail.
 */
export function computeShareContentHash({ summaryText, purpose, sharingBoundary, participationEndsOn }) {
  const day = toDateOnly(participationEndsOn);
  const canonical = [
    String(summaryText ?? ""),
    String(purpose ?? ""),
    String(sharingBoundary ?? ""),
    day ? day.toISOString().slice(0, 10) : ""
  ].join(CONTENT_SEPARATOR);
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * TINGIMUSLIK KIRJUTUS — üks võitja, mitte kaks.
 *
 * Kogu selle faili vana muster oli „loe rida → kontrolli mälus → kirjuta
 * `where:{id}`". See on TOCTOU: kontrollitav olek on kirjutamise hetkeks juba
 * möödas. `updateMany` viib kontrolli WHERE-i sisse, kus teda hindab andmebaas
 * rea luku all — kaks paralleelset toimingut ei saa mõlemad `count === 1`
 * saada. Kaotaja saab nimelise vea, mitte vaikse ülekirjutuse.
 *
 * `count !== 1` katab ka `0` ja teoreetilise `>1` — viimane tähendaks, et
 * WHERE ei olnud unikaalne, ja see on viga, mitte edu.
 */
async function commitOnce(db, { id, where, data, conflictCode }) {
  const result = await db.networkShare.updateMany({ where: { id, ...where }, data });
  if (!result || result.count !== 1) fail(conflictCode);
  return db.networkShare.findFirst({ where: { id } });
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
      contentHash: computeShareContentHash({
        summaryText: fields.summary,
        purpose: fields.why,
        sharingBoundary: fields.boundary,
        participationEndsOn: fields.endsOn
      }),
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

  return commitOnce(prisma, {
    id: share.id,
    /* Muutmine kirjutab AINULT selle versiooni peale, mille ta luges. Kaks
       paralleelset muutmist ei saa enam teineteist vaikselt ära kaotada, ja
       muutmine ei saa mööda minna kinnitusest, mis vahepeal saabus. */
    where: { status: share.status, contentHash: share.contentHash },
    data: {
      summaryText: fields.summary,
      purpose: fields.why,
      sharingBoundary: fields.boundary,
      participationEndsOn: fields.endsOn,
      contentHash: computeShareContentHash({
        summaryText: fields.summary,
        purpose: fields.why,
        sharingBoundary: fields.boundary,
        participationEndsOn: fields.endsOn
      }),
      // Iga sisumuudatus viib tagasi mustandisse ja kustutab kinnituse.
      status: NetworkShareStatus.DRAFT,
      clientConfirmedAt: null,
      clientDeclinedAt: null,
      clientDecisionNote: null,
      /* Kinnitustõend kustub koos kinnitusega. Kui ta jääks, viitaks ta
         tekstile, mida reas enam ei ole. */
      confirmedContentHash: null,
      updatedAt: now()
    },
    conflictCode: "network_share.concurrent_change"
  });
}

/** Töötaja saadab jagamise kliendile ülevaatamiseks. */
export async function submitToClient({ prisma, shareId, workerId, now = () => new Date() }) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (share.status !== NetworkShareStatus.DRAFT) fail("network_share.not_draft");
  return commitOnce(prisma, {
    id: share.id,
    /* Sisu ei tohi ülevaatamisele saatmise ja selle lugemise vahel muutuda:
       klient peab nägema seda teksti, mille töötaja saatis. */
    where: { status: NetworkShareStatus.DRAFT, contentHash: share.contentHash },
    data: { status: NetworkShareStatus.AWAITING_CLIENT, updatedAt: now() },
    conflictCode: "network_share.concurrent_change"
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
  /**
   * Räsi, mida klient EKRAANIL NÄGI. Valikuline, aga kui ta tuleb, on ta
   * tugevam tõend kui serveri enda lugemine millisekund tagasi: ta ütleb, et
   * kinnitatav tekst on see, mille peale inimene vaatas. Ilma temata jääb
   * alles tingimuslik kirjutus, mis katab võistluse, aga mitte „klient luges
   * lehte tund aega tagasi" juhtumit.
   */
  expectedContentHash = null,
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
  if (expectedContentHash && expectedContentHash !== share.contentHash) {
    fail("network_share.content_changed");
  }

  const stamp = now();
  const confirming = normalized === "CONFIRMED";
  return commitOnce(prisma, {
    id: share.id,
    /* SOL-NET-01 SÜDA. Kinnitus kirjutatakse AINULT sellele reale, mis on
       endiselt `AWAITING_CLIENT` JA kannab endiselt seda teksti, mida klient
       luges. Kui töötaja jõudis vahepeal muuta, langeb tingimus andmebaasis ja
       klient saab nimelise vea — mitte olukorra, kus tema nõusolek ripub uue
       teksti küljes. */
    where: { status: NetworkShareStatus.AWAITING_CLIENT, contentHash: share.contentHash },
    data: {
      status: confirming ? NetworkShareStatus.CONFIRMED : NetworkShareStatus.DECLINED,
      clientConfirmedAt: confirming ? stamp : null,
      clientDeclinedAt: confirming ? null : stamp,
      clientDecisionNote: cleanText(note, { max: 2000 }) || null,
      clientConfirmationMethod: ClientConfirmationMethod.IN_APP,
      clientConfirmationAttestedById: null,
      // MIDA kinnitati — mitte ainult ET kinnitati.
      confirmedContentHash: confirming ? share.contentHash : null,
      updatedAt: stamp
    },
    conflictCode: "network_share.content_changed"
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
  hasFrameworkAcceptance = null,
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
  const confirming = normalized === "CONFIRMED";
  const run = async (tx) => {
    // SOL-NET-06: loomisel kehtinud raamleping ei ole püsiv volitus. Mõlemad
    // professionaalid peavad olema ka otsuse üleandmise hetkel kehtiva raami all.
    await assertExternalFrameworkAcceptances({ share, hasFrameworkAcceptance, db: tx });
    return commitOnce(tx, {
      id: share.id,
      /* Ülekantud kinnitus on nõrgem TÕEND, aga mitte nõrgem SEOS: ka tema
         viitab konkreetsele tekstile. Vastasel juhul saaks töötaja kanda üle
         kliendi „jah" ja seejärel teksti vahetada. */
      where: { status: NetworkShareStatus.AWAITING_CLIENT, contentHash: share.contentHash },
      data: {
        status: confirming ? NetworkShareStatus.CONFIRMED : NetworkShareStatus.DECLINED,
        clientConfirmedAt: confirming ? stamp : null,
        clientDeclinedAt: confirming ? null : stamp,
        clientDecisionNote: cleanText(note, { max: 2000 }) || null,
        clientConfirmationMethod: normalizedMethod,
        clientConfirmationAttestedById: workerId,
        confirmedContentHash: confirming ? share.contentHash : null,
        updatedAt: stamp
      },
      conflictCode: "network_share.content_changed"
    });
  };
  try {
    return typeof prisma.$transaction === "function"
      ? await prisma.$transaction(run, { isolationLevel: "Serializable" })
      : await run(prisma);
  } catch (error) {
    if (isTransactionConflict(error)) fail("network_share.content_changed");
    throw error;
  }
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
  createOutbox = null,
  hasFrameworkAcceptance = null,
  now = () => new Date()
}) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (share.status !== NetworkShareStatus.CONFIRMED) fail("network_share.client_confirmation_required");
  if (!share.clientConfirmedAt) fail("network_share.client_confirmation_required");
  /* SOL-NET-02: kinnitus peab käima SELLE teksti kohta, mida me saadame. Olek
     `CONFIRMED` üksi ei ütle seda — ta ütleb ainult, et KUNAGI kinnitati. */
  if (!share.contentHash || share.confirmedContentHash !== share.contentHash) {
    fail("network_share.confirmation_stale");
  }

  const stamp = now();
  assertParticipationActive(share, stamp);

  /* JÄRJEKORD ON SIIN SISULINE, mitte stiil (SOL-NET-02 + SOL-NET-03).
     1. NÕUA rida tingimuslikult endale — pärast seda ei saa ükski paralleelne
        muutmine enam sama rida teise seisu viia;
     2. alles siis loo ruum.
     Vana järjekord (ruum enne olekut) tekitas kaks viga korraga: kaotanud
     saatmine jõudis ruumi luua ja liikmed sisse panna, ning ruumi loomise
     tõrge jättis jagamise `CONFIRMED`-iks, ruum aga alles.
     Kõik ühes tehingus: kui ruumi loomine kukub, keerdub ka `SENT` tagasi. */
  const run = async (tx) => {
    // SOL-NET-06: kontroll on TEHINGU SEES. Kui leping kadus pärast mustandi
    // loomist või kinnitamist, ei teki SENT-i, ruumi ega teavituse outbox'i.
    await assertExternalFrameworkAcceptances({ share, hasFrameworkAcceptance, db: tx });
    assertParticipationActive(share, stamp);
    const claimed = await tx.networkShare.updateMany({
      where: {
        id: share.id,
        status: NetworkShareStatus.CONFIRMED,
        contentHash: share.contentHash,
        confirmedContentHash: share.contentHash
      },
      data: { status: NetworkShareStatus.SENT, sentAt: stamp, updatedAt: stamp }
    });
    if (!claimed || claimed.count !== 1) fail("network_share.concurrent_change");

    let roomId = share.roomId || null;
    if (!roomId && typeof createRoom === "function") {
      const room = await createRoom({ share, db: tx });
      roomId = room?.id || null;
      if (roomId) {
        await tx.networkShare.update({ where: { id: share.id }, data: { roomId } });
      }
    }
    const sent = await tx.networkShare.findFirst({ where: { id: share.id } });
    if (typeof createOutbox === "function") {
      await createOutbox({ share: sent, db: tx, now: stamp });
    }
    return sent;
  };

  /* Ühiktesti fake-klient ei paku `$transaction`-it. Tema all jääb alles kogu
     tingimuslik loogika; ATOMAARSUS ise on päris andmebaasi omadus ja teda
     tõendab `npm run net:share:probe`, mitte ühiktest. */
  try {
    return typeof prisma.$transaction === "function"
      ? await prisma.$transaction(run, { isolationLevel: "Serializable" })
      : await run(prisma);
  } catch (error) {
    if (isTransactionConflict(error)) fail("network_share.concurrent_change");
    throw error;
  }
}

/** Saaja avab. Avamine sulgeb tagasivõtmise akna. */
export async function markShareOpened({ prisma, shareId, recipientUserId, now = () => new Date() }) {
  const share = await prisma.networkShare.findFirst({ where: { id: shareId } });
  if (!share) fail("network_share.not_found");
  if (share.recipientUserId !== recipientUserId) fail("network_share.forbidden");
  const stamp = now();
  assertParticipationActive(share, stamp);
  if ([NetworkShareStatus.OPENED, NetworkShareStatus.RESPONDED].includes(share.status)) return share;
  if (share.status !== NetworkShareStatus.SENT) fail("network_share.not_sent");
  /* Avamine ja tagasivõtmine võistlevad sama rea peal: mõlemad lähtuvad
     seisust `SENT`. Tingimuslik kirjutus otsustab, kumb võitis — vana kood
     lubas mõlemal „õnnestuda" ja viimane kirjutaja määras tulemuse. */
  return commitOnce(prisma, {
    id: share.id,
    where: { status: NetworkShareStatus.SENT },
    data: { status: NetworkShareStatus.OPENED, openedAt: stamp, updatedAt: stamp },
    conflictCode: "network_share.not_sent"
  });
}

/** Tagasivõtmine on võimalik ainult enne avamist. */
export async function recallNetworkShare({ prisma, shareId, workerId, now = () => new Date() }) {
  const share = await loadForWorker(prisma, { shareId, workerId });
  if (!RECALLABLE_STATUSES.has(share.status)) fail("network_share.not_recallable");
  const stamp = now();
  /* Sama võistlus teiselt poolt: kui saaja jõudis vahepeal avada, ei tohi
     tagasivõtmine „õnnestuda" — loetud teksti ei saa lugemata teha. */
  const run = async (tx) => {
    const recalled = await commitOnce(tx, {
      id: share.id,
      where: { status: share.status },
      data: { status: NetworkShareStatus.RECALLED, recalledAt: stamp, updatedAt: stamp },
      conflictCode: "network_share.not_recallable"
    });
    // Ruum sündis saatmisega, seega tagasivõtmine peab eemaldama vähemalt
    // AVAMATA saaja päris liikmesuse samas tehingus. Muidu oleks RECALL ainult
    // jagamise rea lipp ja otselink jääks toimima.
    if (share.roomId && tx.roomMember?.updateMany) {
      await tx.roomMember.updateMany({
        where: { roomId: share.roomId, userId: share.recipientUserId, leftAt: null },
        data: { leftAt: stamp }
      });
    }
    return recalled;
  };
  return typeof prisma.$transaction === "function" ? prisma.$transaction(run) : run(prisma);
}

/**
 * Ainus kuju, mille saaja näeb.
 *
 * Ehitatud VALGEST NIMEKIRJAST: uus veerg mudelis ei leki siia iseenesest.
 * Kustutamise teel ehitatud projektsioon oleks sama kood, aga vale suunaga —
 * unustatud `delete` on leke, unustatud lisamine on ainult puuduv väli.
 */
export function recipientProjection(share, { viewerUserId, now = new Date() } = {}) {
  if (!share) return null;
  if (viewerUserId && share.recipientUserId !== viewerUserId) return null;
  if (!isNetworkShareParticipationActive(share, { now })) return null;
  if (![NetworkShareStatus.OPENED, NetworkShareStatus.RESPONDED].includes(share.status)) {
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

/** Postkasti ümbrik: teadmine, et midagi saabus, ilma jagatud sisuta. */
export function recipientInboxProjection(share, { viewerUserId, now = new Date() } = {}) {
  if (!share || share.recipientUserId !== viewerUserId) return null;
  if (!isNetworkShareParticipationActive(share, { now })) return null;
  if (![NetworkShareStatus.SENT, NetworkShareStatus.OPENED, NetworkShareStatus.RESPONDED].includes(share.status)) {
    return null;
  }
  return {
    id: share.id,
    status: share.status,
    sentAt: share.sentAt,
    participationEndsOn: share.participationEndsOn
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
