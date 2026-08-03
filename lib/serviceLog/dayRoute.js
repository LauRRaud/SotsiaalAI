/**
 * TEENUSPÄEVIK E2c — PÄEVATEEKONNA TEENUSEKIHT.
 *
 * `dayRouteMachine.js` jääb PUHTAKS (üleminekud, kestused, koond). Siin on
 * ainus asi, mida seal olla ei tohi: andmebaas. See vahe hoiab „mis tohib
 * millele järgneda" testitavana ilma DB-ta — ja just see loogika otsustab,
 * kas arvele läheb päris või väljamõeldud sõiduaeg.
 *
 * NELI REEGLIT:
 *
 * 1. ÜKS AVATUD TÖÖPÄEV KORRAGA. Kaks paralleelset teekonda tähendaks, et
 *    „jooksev külastus" ei ole üheselt määratud ja üks nupp ei teaks, mida ta
 *    juhib. Andmebaasis on see osaline unikaalindeks, siin teenuse invariant.
 *
 * 2. IDEMPOTENTSUS ON KOHUSTUSLIK, MITTE MUGAVUS. Kui päring jõuab serverini,
 *    aga vastus kaob (levi kadus just siis), ei saa seade teada, kumb juhtus.
 *    Ta peab uuesti proovima. Ilma võtmeta tekiks ÜHEST külastusest kaks.
 *
 * 3. KÜLASTUS EI OLE TEENUSKIRJE. Ärajäänud ja tegemata külastus EI TOHI
 *    elada `ServiceEntry` tabelis — ta ei ole arve alusdokument. Kirje sünnib
 *    eraldi, inimese kinnitusel (leping: „töötaja kinnitatud külastus muutub
 *    teenuskirjeks, mitte vastupidi").
 *
 * 4. VÕÕRAS JA OLEMATU ID ANNAVAD MÕLEMAD 404. Sama mittepaljastav muster mis
 *    ülejäänud teenuspäevikul.
 */

import { prisma } from "@/lib/prisma";

import { assertServiceLogEnabled, isServiceLogLocationStampEnabled } from "./flags.js";
import { badRequest, conflict, notFound } from "./errors.js";
import { createEntry, requireWritableProfile, sanitizeLocationStamps } from "./entries.js";
import {
  ROUTE_STATUS,
  VISIT_ACTION,
  VISIT_STATUS,
  allowedActions,
  evaluateTransition,
  isActiveVisit,
  staleVisits,
  summarizeRoute,
  travelMinutesOf,
  serviceMinutesOf
} from "./dayRouteMachine.js";
import { MAX_CLIENT_NAME_LENGTH, MAX_EXTERNAL_REF_LENGTH } from "./constants.js";
import {
  buildDayNavigationUrl,
  buildLegs,
  buildNavigationUrl,
  buildWazeUrl,
  crossCheckLocation,
  summarizeMileage
} from "./mileage.js";
import { geocodeServiceMapAddress } from "@/lib/serviceMap/geocoding";
import { orderDistanceKm, suggestOrder } from "./routeOrder.js";
import { isRoutingEnabled, routeDay } from "./routing.js";

const MAX_ADDRESS_LENGTH = 300;
const MAX_REASON_LENGTH = 500;

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed.slice(0, maxLength) : null;
}

function toCalendarDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function serializeVisit(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    clientDisplayName: row.clientDisplayName || null,
    clientExternalRef: row.clientExternalRef || null,
    referralId: row.referralId || null,
    serviceId: row.serviceId || null,
    address: row.address || null,
    /* KOORDINAAT LÄHEB KAASA, sest kaart vajab teda. Ta EI OLE mõõdetud punkt
       — see on registri aadressi asukoht, mis on niikuinii avalik andmestik. */
    addressLat: row.addressLat ?? null,
    addressLng: row.addressLng ?? null,
    plannedStartAt: row.plannedStartAt?.toISOString?.() || null,
    sortOrder: row.sortOrder ?? 0,
    enRouteAt: row.enRouteAt?.toISOString?.() || null,
    arrivedAt: row.arrivedAt?.toISOString?.() || null,
    completedAt: row.completedAt?.toISOString?.() || null,
    cancelledAt: row.cancelledAt?.toISOString?.() || null,
    outcomeReason: row.outcomeReason || null,
    note: row.note || null,
    noteProvenance: row.noteProvenance || null,
    travelMinutes: travelMinutesOf(row),
    serviceMinutes: serviceMinutesOf(row),
    /* MILLISTE märete juures punkt PÄRISELT salvestus — koordinaate ennast
       loendisse ei anta. Vähem andmeid liikvel on vähem andmeid lekkida. */
    locationStampedAt: Object.keys(row.locationStamps || {}),
    serviceEntryId: row.serviceEntryId || null,
    /* E11 — ÜHE PUUTEGA NAVIGATSIOON. Link tuleb serverist, sest tema sisend
       (aadress või punkt) on serveri tõde; UI-s koostamine tähendaks, et kaks
       kohta teavad aadressi eelistusreeglit. */
    navigationUrl: buildNavigationUrl(row),
    /* Waze toetab AINULT üht sihti korraga — seepärast on ta külastuse juures,
       mitte päeva juures. Seda ei varjata. */
    wazeUrl: buildWazeUrl(row),
    /* RISTKONTROLL. Ühe punkti puhul EI OLE VÕIMALIK teada, kas ta on õige;
       kahe sõltumatu allika puhul on. Seade ütles Kopli, aadress on Tabasalus
       → üks neist on vale ja töötaja NÄEB seda enne, kui kirje läheb arvele.
       Koordinaate ennast me ei tagasta, ainult vahemaa ja otsuse. */
    locationCheck: crossCheckLocation(row),
    /* Nupud tulevad SERVERILT. Kui UI arvutaks lubatud toimingud ise, läheksid
       kaks reeglistikku ükskord lahku ja kasutaja näeks nuppu, mis annab 409. */
    actions: allowedActions(row.status)
  };
}

function serializeRoute(route, visits) {
  const summary = summarizeRoute(visits, { breakMinutes: route?.breakMinutes || 0 });
  return {
    id: route?.id || null,
    date: route?.date instanceof Date ? route.date.toISOString().slice(0, 10) : route?.date || null,
    status: route?.status || ROUTE_STATUS.OPEN,
    startedAt: route?.startedAt?.toISOString?.() || null,
    endedAt: route?.endedAt?.toISOString?.() || null,
    onBreak: Boolean(route?.breakStartedAt),
    breakStartedAt: route?.breakStartedAt?.toISOString?.() || null,
    summary
  };
}

/**
 * Avatud tööpäev VÕI uus. Ei võta parameetriks kuupäeva juhuslikult: öise
 * vahetuse päev algab eile ja tema sundimine tänasesse kuupäeva kaotaks
 * poolelioleva külastuse.
 */
export async function openRoute(userId, { date = null, now = new Date() } = {}, { db = prisma } = {}) {
  const profile = await requireWritableProfile(userId, { db });
  const existing = await db.serviceWorkRoute.findFirst({
    where: { providerProfileId: profile.id, workerUserId: userId, status: ROUTE_STATUS.OPEN }
  });
  if (existing) return existing;

  const day = toCalendarDate(date || now);
  if (!day) throw badRequest("service_log.errors.date_invalid");

  try {
    return await db.serviceWorkRoute.create({
      data: {
        providerProfileId: profile.id,
        workerUserId: userId,
        date: day,
        status: ROUTE_STATUS.OPEN,
        startedAt: now
      }
    });
  } catch (error) {
    /* Kaks samaaegset „alusta päeva" vajutust. Osaline unikaalindeks püüab
       teise kinni ja meie loeme olemasoleva — see EI OLE viga kasutaja jaoks. */
    if (error?.code === "P2002") {
      const raced = await db.serviceWorkRoute.findFirst({
        where: { providerProfileId: profile.id, workerUserId: userId, status: ROUTE_STATUS.OPEN }
      });
      if (raced) return raced;
    }
    throw error;
  }
}

export async function getDayRoute(
  userId,
  { date = null, now = new Date() } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const day = toCalendarDate(date || now);
  if (!day) throw badRequest("service_log.errors.date_invalid");

  /* AVATUD TÖÖPÄEV VÕITAB KUUPÄEVA. Kui töötaja vaatab telefoni kesköö järel,
     on tema pooleliolev päev tähtsam kui kalendri uus leht. */
  const route =
    (await db.serviceWorkRoute.findFirst({
      where: { providerProfileId: profile.id, workerUserId: userId, status: ROUTE_STATUS.OPEN }
    })) ||
    (await db.serviceWorkRoute.findFirst({
      where: { providerProfileId: profile.id, workerUserId: userId, date: day },
      orderBy: { createdAt: "desc" }
    }));

  const visits = route
    ? await db.serviceVisit.findMany({
        where: { routeId: route.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        take: 200
      })
    : [];

  const serialized = visits.map(serializeVisit);
  let legs = buildLegs(visits);

  /**
   * PÄRIS TEEPIKKUS, KUI MOOTOR ON OLEMAS.
   *
   * `buildLegs` annab „linnulennult × 1,3" — aus hinnang, aga hinnang. Ise
   * majutatud OSRM annab tegeliku teepikkuse ja -aja. Klientide koordinaadid ei
   * lahku serverist: mootor kuulab `127.0.0.1` peal.
   *
   * ÜKS PÄRING KOGU PÄEVA KOHTA ja ainult siis, kui KÕIGIL külastustel on punkt
   * — muidu ei lange mootori lõigud meie omadega kokku ja vale lõigu kilomeeter
   * satuks vale kliendi juurde. Osalise katte puhul jääb hinnang alles; see on
   * halvem number, aga õige koha peal.
   */
  const dayPoints = visits.map((visit) => {
    const measured = visit.locationStamps?.arrivedAt;
    if (measured && Number.isFinite(Number(measured.lat))) {
      return { lat: Number(measured.lat), lng: Number(measured.lng) };
    }
    return Number.isFinite(Number(visit.addressLat))
      ? { lat: Number(visit.addressLat), lng: Number(visit.addressLng) }
      : null;
  });

  if (isRoutingEnabled(env) && dayPoints.length > 1 && dayPoints.every(Boolean)) {
    const road = await routeDay(dayPoints, { env });
    if (road?.legs?.length === legs.length) {
      legs = legs.map((leg, index) => ({
        ...leg,
        km: road.legs[index].km,
        minutes: leg.minutes ?? road.legs[index].minutes,
        /* „road" on ainus allikas, mis EI OLE hinnang. */
        source: leg.source === "manual" ? "manual" : "road",
        /* Ei „road" ega „manual" ole hinnang: esimene on mõõdetud teepikkus,
           teine inimese kinnitatud arv. */
        estimated: false
      }));
    }
  }
  return {
    route: serializeRoute(route, visits),
    visits: serialized,
    /* JOOKSEV KÜLASTUS on see, mis on käigus. Neid saab olla ainult üks —
       teekonnal ei sõideta kahe kliendi juurde korraga. */
    currentVisitId: serialized.find((visit) => isActiveVisit(visit.status))?.id || null,
    /* TURVASIGNAAL. Mitte jälgimine: me ei tea, kus inimene on. Me teame
       ainult, et nupp jäi vajutamata kauemaks, kui ükski külastus kestab. */
    needsCheck: staleVisits(visits, { now }).map((visit) => visit.id),
    /* E12 — SÕIDUPÄEVIK ILMA ODOMEETRITA (omaniku otsus 03.08). Kaugus tuleb
       saabumispunktide vahelt; ilma punktita jääb lõik mõõtmata ja seda
       öeldakse VÄLJA, mitte ei asendata nulliga. */
    legs,
    mileage: summarizeMileage(legs),
    /* TERVE PÄEV NAVIGAATORIS. Meie kaart on ülevaade; sõites vajab inimene
       päris navigaatorit hääljuhiste ja liiklusinfoga. Üleandmine kannab
       tervet järelejäänud päeva, mitte ühte aadressi korraga. */
    dayNavigation: buildDayNavigationUrl(visits),
    /* JÄRJESTUSE SOOVITUS. Tagastatakse ALATI, rakendub AINULT vajutusega:
       automaatne ümberjärjestamine tähendaks, et töötaja avab hommikul
       telefoni ja tema päev on öösel ümber tehtud. */
    orderSuggestion: (() => {
      const suggestion = suggestOrder(visits);
      if (!suggestion.changed) return null;
      return { ...suggestion, currentKm: orderDistanceKm(visits) };
    })()
  };
}

export async function createVisit(
  userId,
  input = {},
  /* Geokodeerija käib sisse samamoodi nagu `db`: ilma selleta kutsuks ühiktest
     päris välist teenust ja tema aeglus näeks välja nagu loogikaviga. */
  { db = prisma, env = process.env, now = new Date(), geocodeAddress = geocodeServiceMapAddress } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const route = await openRoute(userId, { now }, { db });

  const clientRequestId = text(input.clientRequestId, 100);
  if (clientRequestId) {
    const existing = await db.serviceVisit.findFirst({
      where: { providerProfileId: profile.id, clientRequestId }
    });
    /* KORDUSSAATMINE ei ole viga: seade proovis uuesti, sest vastus kadus. */
    if (existing) return serializeVisit(existing);
  }

  const referralId = text(input.referralId, 64);
  if (referralId) {
    /* Võõra KOV-i suunamine EI TOHI oma külastust saada — sealt tekiks kirje,
       mis läheb valele KOV-ile arvesse. */
    const referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: { id: true }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
  }

  const data = {
    providerProfileId: profile.id,
    routeId: route.id,
    ownerUserId: userId,
    referralId: referralId || null,
    serviceId: text(input.serviceId, 64),
    clientDisplayName: text(input.clientDisplayName, MAX_CLIENT_NAME_LENGTH),
    clientExternalRef: text(input.clientExternalRef, MAX_EXTERNAL_REF_LENGTH),
    address: text(input.address, MAX_ADDRESS_LENGTH),
    status: VISIT_STATUS.PLANNED,
    plannedStartAt: input.plannedStartAt ? new Date(input.plannedStartAt) : null,
    sortOrder: Number.isFinite(Number(input.sortOrder)) ? Math.trunc(Number(input.sortOrder)) : 0,
    clientRequestId
  };

  /* AADRESS GEOKODEERITAKSE MAA-AMETI REGISTRIST (in-ADS) — sama kiht, mida
     Teenusekaart osutajate asukohtade jaoks juba ammu kasutab. Ta annab
     sõidulõigu kauguse ka siis, kui GPS-i luba puudub, ja ristkontrolli
     mõõdetud punktile.

     PARIMA TAHTE KAUPA: geokodeerija on väline teenus ja tema aeglus või tõrge
     EI TOHI külastuse lisamist blokeerida. Ebaõnnestumine jätab lihtsalt
     koordinaadid tühjaks — täpselt nagu enne seda funktsiooni. */
  if (data.address) {
    try {
      const geo = await geocodeAddress(data.address);
      if (geo?.latitude && geo?.longitude) {
        data.addressLat = geo.latitude;
        data.addressLng = geo.longitude;
        data.addressAdsId = geo.adsObjectId || null;
      }
    } catch {}
  }

  try {
    const created = await db.serviceVisit.create({ data });
    return serializeVisit(created);
  } catch (error) {
    /* VÕISTLUS: kaks samaaegset saatmist läbisid mõlemad eelkontrolli.
       Unikaalindeks on ainus koht, kus see kinni püütakse. */
    if (error?.code === "P2002" && clientRequestId) {
      const raced = await db.serviceVisit.findFirst({
        where: { providerProfileId: profile.id, clientRequestId }
      });
      if (raced) return serializeVisit(raced);
    }
    throw error;
  }
}

/** Veakood olekumasinast → HTTP-vastus. Üks koht, mitte iga marsruut eraldi. */
function transitionError(reason) {
  if (reason === "reason_required") return badRequest("service_log.errors.reason_required");
  if (reason === "timestamp_backwards") return badRequest("service_log.errors.stamp_order");
  if (reason === "timestamp_invalid") return badRequest("service_log.errors.date_invalid");
  /* Lubamatu üleminek on SEISUKONFLIKT, mitte vigane päring: kasutaja näeb
     kirjet ja tal on õigus teada, et seis on vahepeal muutunud. */
  return conflict("service_log.errors.transition_not_allowed");
}

export async function transitionVisit(
  userId,
  visitId,
  action,
  { at = null, reason = null, locationPoint = null } = {},
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const visit = await db.serviceVisit.findFirst({
    where: { id: String(visitId || ""), providerProfileId: profile.id }
  });
  if (!visit) throw notFound();

  const stamp = at ? new Date(at) : now;

  /* ASUKOHA LISAMINE ON OMA TOIMING, MITTE TEINE SAABUMINE.
     Esimene versioon saatis punkti teise `arrive` kutsega — ja see oli viga:
     `ARRIVED → ARRIVED` ei ole lubatud üleminek, seega punkt oleks alati
     kukkunud 409-ga ja asukohatempel ei oleks KUNAGI salvestunud. UI-s ei
     oleks seda näinud, sest tõrge neelati alla.

     Punkt saabub alati HILJEM kui tempel (GPS võib kesta 20 s), seega ta EI
     SAAgi tulla sama kutsega. Oma toiming ei muuda olekut ega ajatemplit. */
  if (action === "attach_location") {
    if (visit.status !== VISIT_STATUS.ARRIVED) throw conflict("service_log.errors.transition_not_allowed");
    if (!locationPoint || !isServiceLogLocationStampEnabled(env)) return serializeVisit(visit);
    const cleaned = sanitizeLocationStamps({ arrivedAt: locationPoint });
    if (!cleaned?.arrivedAt) return serializeVisit(visit);
    const stamped = await db.serviceVisit.update({
      where: { id: visit.id },
      data: { locationStamps: { ...(visit.locationStamps || {}), arrivedAt: cleaned.arrivedAt } }
    });
    return serializeVisit(stamped);
  }

  const verdict = evaluateTransition(visit, action, { at: stamp, reason });
  if (!verdict.ok) throw transitionError(verdict.reason);

  const data = { status: verdict.status };
  if (verdict.timestampField) data[verdict.timestampField] = stamp;
  if (reason) data.outcomeReason = text(reason, MAX_REASON_LENGTH);

  /* ASUKOHT AINULT SAABUMISEL ja ainult siis, kui lipp on sees. Server otsustab
     salvestamise, mitte klient: väljas lipuga ei salvestata punkti ka siis, kui
     brauser ta kätte sai. */
  if (
    action === VISIT_ACTION.ARRIVE &&
    locationPoint &&
    isServiceLogLocationStampEnabled(env)
  ) {
    const cleaned = sanitizeLocationStamps({ arrivedAt: locationPoint });
    if (cleaned?.arrivedAt) {
      data.locationStamps = { ...(visit.locationStamps || {}), arrivedAt: cleaned.arrivedAt };
    }
  }

  /* JOOKSVAID KÜLASTUSI ON ÜKS. Teise avamine sunniks nupu valima kahe vahel
     ja sõidulõigud läheksid segi. */
  if (isActiveVisit(verdict.status)) {
    const other = await db.serviceVisit.findFirst({
      where: {
        providerProfileId: profile.id,
        routeId: visit.routeId,
        status: { in: [VISIT_STATUS.EN_ROUTE, VISIT_STATUS.ARRIVED] },
        id: { not: visit.id }
      },
      select: { id: true }
    });
    if (other) throw conflict("service_log.errors.visit_already_active");
  }

  const updated = await db.serviceVisit.update({ where: { id: visit.id }, data });
  return serializeVisit(updated);
}

export async function setBreak(userId, { on }, { db = prisma, env = process.env, now = new Date() } = {}) {
  assertServiceLogEnabled(env);
  const route = await openRoute(userId, { now }, { db });

  if (on) {
    if (route.breakStartedAt) return serializeRoute(route, []);
    const updated = await db.serviceWorkRoute.update({
      where: { id: route.id },
      data: { breakStartedAt: now }
    });
    return serializeRoute(updated, []);
  }

  if (!route.breakStartedAt) return serializeRoute(route, []);
  /* Pausi minutid liidetakse, mitte ei kirjutata üle: päevas on rohkem kui üks
     paus ja teine ei tohi esimest kustutada. */
  const minutes = Math.max(0, Math.round((now.getTime() - route.breakStartedAt.getTime()) / 60000));
  const updated = await db.serviceWorkRoute.update({
    where: { id: route.id },
    data: { breakStartedAt: null, breakMinutes: (route.breakMinutes || 0) + minutes }
  });
  return serializeRoute(updated, []);
}

/**
 * Lõpetab tööpäeva.
 *
 * POOLELI KÜLASTUS BLOKEERIB. Päev, mis suletakse käigusoleva külastuse peal,
 * jätaks lahtise sõidulõigu ja turvasignaali sulgemata — ning töötaja saaks
 * hommikul teekonna, mis algab eilsest.
 */
export async function closeRoute(userId, { now = new Date() } = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const route = await db.serviceWorkRoute.findFirst({
    where: { providerProfileId: profile.id, workerUserId: userId, status: ROUTE_STATUS.OPEN }
  });
  if (!route) throw notFound();

  const active = await db.serviceVisit.findFirst({
    where: { routeId: route.id, status: { in: [VISIT_STATUS.EN_ROUTE, VISIT_STATUS.ARRIVED] } },
    select: { id: true }
  });
  if (active) throw conflict("service_log.errors.visit_still_open");

  const breakMinutes = route.breakStartedAt
    ? (route.breakMinutes || 0) + Math.max(0, Math.round((now.getTime() - route.breakStartedAt.getTime()) / 60000))
    : route.breakMinutes || 0;

  const updated = await db.serviceWorkRoute.update({
    where: { id: route.id },
    data: { status: ROUTE_STATUS.CLOSED, endedAt: now, breakStartedAt: null, breakMinutes }
  });
  const visits = await db.serviceVisit.findMany({ where: { routeId: route.id } });
  return serializeRoute(updated, visits);
}

/**
 * Eeltäide teenuskirje jaoks. KIRJET EI LOODA AUTOMAATSELT — külastus ei ole
 * alati arveldatav teenus ja arve alusdokument ei tohi tekkida ilma inimese
 * kinnituseta. Sama reegel mis Välitöö sillal (leping 8.4).
 */
export async function buildEntryDraftFromVisit(userId, visitId, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const visit = await db.serviceVisit.findFirst({
    where: { id: String(visitId || ""), providerProfileId: profile.id }
  });
  if (!visit) throw notFound();
  if (visit.status !== VISIT_STATUS.COMPLETED) throw conflict("service_log.errors.visit_not_completed");
  if (visit.serviceEntryId) throw conflict("service_log.errors.visit_already_billed");

  const minutes = serviceMinutesOf(visit);
  return {
    visitId: visit.id,
    date: visit.arrivedAt ? visit.arrivedAt.toISOString().slice(0, 10) : null,
    clientDisplayName: visit.clientDisplayName || null,
    clientExternalRef: visit.clientExternalRef || null,
    referralId: visit.referralId || null,
    serviceId: visit.serviceId || null,
    note: visit.note || null,
    noteProvenance: visit.noteProvenance || null,
    arrivedAt: visit.arrivedAt?.toISOString?.() || null,
    leftAt: visit.completedAt?.toISOString?.() || null,
    departedForVisitAt: visit.enRouteAt?.toISOString?.() || null,
    /* Kestus tuleb MÕÕDETUD minutitest, mitte ümardatud tundidest: ümardamine
       on kasutaja otsus, mitte serveri oma. */
    measuredMinutes: minutes,
    travelMinutes: travelMinutesOf(visit),
    locationStamps: visit.locationStamps || null
  };
}

/** Seob loodud teenuskirje külastuse külge. */
export async function linkEntryToVisit(userId, visitId, entryId, { db = prisma } = {}) {
  const profile = await requireWritableProfile(userId, { db });
  const visit = await db.serviceVisit.findFirst({
    where: { id: String(visitId || ""), providerProfileId: profile.id },
    select: { id: true, serviceEntryId: true }
  });
  if (!visit) throw notFound();
  if (visit.serviceEntryId) throw conflict("service_log.errors.visit_already_billed");
  const updated = await db.serviceVisit.update({
    where: { id: visit.id },
    data: { serviceEntryId: String(entryId) }
  });
  return serializeVisit(updated);
}

/**
 * Rakendab järjestuse. INIMESE VAJUTUSEGA, mitte automaatselt.
 *
 * ID-d peavad kuuluma TÄPSELT sellele teekonnale — võõra külastuse
 * sisselibistamine tähendaks, et teise inimese töö satub minu päeva.
 */
export async function applyOrder(userId, visitIds = [], { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const ids = (Array.isArray(visitIds) ? visitIds : []).map((id) => String(id || "")).filter(Boolean);
  if (!ids.length) throw badRequest("service_log.errors.invalid_input");

  const rows = await db.serviceVisit.findMany({
    where: { id: { in: ids }, providerProfileId: profile.id },
    select: { id: true, routeId: true }
  });
  if (rows.length !== ids.length) throw notFound();

  /* ÜKS TEEKOND. Kahe päeva külastuste segamine annaks järjekorra, mis ei
     tähenda kummalgi päeval midagi. */
  const routeIds = new Set(rows.map((row) => row.routeId));
  if (routeIds.size !== 1) throw badRequest("service_log.errors.invalid_input");

  await db.$transaction(
    ids.map((id, index) =>
      db.serviceVisit.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  return { ok: true, count: ids.length };
}

/**
 * KÜLASTUSEST TEENUSKIRJE — silla teine pool.
 *
 * MIS OLI KATKI. Päevateekond mõõtis kõik ära: kellaajad, kestuse, sõiduaja,
 * asukoha. Ja siis pidi töötaja SAMA TÖÖ veel kord käsitsi kirjena sisestama,
 * et ta arvele jõuaks. Mõõtmisest ei ole kasu, kui ta ei jõua sinna, kus
 * temaga midagi tehakse.
 *
 * KIRJET EI LOODA AUTOMAATSELT ja see jääb nii. Külastus ei ole alati
 * arveldatav teenus — ärajäänud käik, tutvumisvisiit, kliendi keeldumine. Arve
 * alusdokument ei tohi tekkida ilma inimese vajutuseta (sama reegel mis
 * Välitöö sillal, leping 8.4). Aga see vajutus peab olema ÜKS, mitte terve
 * vormi täitmine uuesti.
 *
 * ÜKS KÜLASTUS = ÜKS KIRJE. Teistkordne kutse annab sama kirje tagasi, mitte
 * teist — `serviceEntryId` on unikaalne ja kontroll on siin ainult kiirtee.
 */
export async function createEntryFromVisit(
  userId,
  visitId,
  { unit = null, quantity = null, clientRequestId = null } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const visit = await db.serviceVisit.findFirst({
    where: { id: String(visitId || ""), providerProfileId: profile.id }
  });
  if (!visit) throw notFound();
  if (visit.status !== VISIT_STATUS.COMPLETED) throw conflict("service_log.errors.visit_not_completed");
  if (visit.serviceEntryId) throw conflict("service_log.errors.visit_already_billed");

  const entry = await createEntry(
    userId,
    {
      date: (visit.arrivedAt || visit.completedAt || new Date()).toISOString().slice(0, 10),
      clientDisplayName: visit.clientDisplayName,
      clientExternalRef: visit.clientExternalRef,
      referralId: visit.referralId,
      serviceId: visit.serviceId,
      note: visit.note,
      noteProvenance: visit.noteProvenance,
      /* TEMPLID LÄHEVAD KAASA, mitte ainult tuletatud kogus: kirje peab kandma
         sedasama tõendit, mis külastusel oli — millal kohale jõuti ja millal
         lahkuti. Ilma nendeta ei saaks kirjet hiljem külastusega kokku viia. */
      departedForVisitAt: visit.enRouteAt?.toISOString?.() || null,
      arrivedAt: visit.arrivedAt?.toISOString?.() || null,
      leftAt: visit.completedAt?.toISOString?.() || null,
      locationStamps: visit.locationStamps || null,
      unit,
      /* Kogus jäetakse tühjaks, kui kutsuja teda ei anna: `resolveQuantity`
         tuletab ta templite vahelt. Nii ei sisesta töötaja seda, mida masin
         juba mõõtis. */
      quantity: quantity ?? undefined,
      clientRequestId: clientRequestId || `visit-entry-${visit.id}`
    },
    { db, env }
  );

  const linked = await db.serviceVisit.update({
    where: { id: visit.id },
    data: { serviceEntryId: entry.id }
  });
  return { entry, visit: serializeVisit(linked) };
}
