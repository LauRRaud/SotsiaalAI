/**
 * TEENUSPÄEVIK-V1 E2 — teenuskirje teenuskiht.
 *
 * Kolm asja, mis siin on teadlikud ja mida ei tohi „mugavamaks" teha:
 *
 * 1. OMANIKU SKOOP ON KÕVA. Iga lugemine ja kirjutamine käib läbi
 *    `requireWritableProfile`, mis seob kirje osutaja profiiliga. Võõras ID ja
 *    olematu ID annavad MÕLEMAD 404 (vt errors.js).
 *
 * 2. ELUTSÜKKEL ON `DRAFT → FINAL → (VOID)` (omaniku otsus 02.08).
 *    MUSTANDIT tohib kustutada: ta ei ole veel millegi alus, ja eksisisestuse
 *    kustutamine teeb voo inimlikuks. KINNITATUD kirje on arve alusdokument —
 *    teda ei kustutata ega kirjutata vaikselt üle. Parandus nõuab PÕHJUST ja
 *    jätab jälje (`ServiceEntryCorrection`, RPS § 10); tühistus jätab rea
 *    alles. Hard-delete avaneb alles pärast säilitustähtaega, mis arvutatakse
 *    KIRJENDAMISE majandusaasta lõpust (RPS § 12), mitte teenuse kuupäevast.
 *
 *    ÕIGUSLIK EELDUS, mis vajab juristi kinnitust enne avamist: majandusaasta
 *    = kalendriaasta. Vt `computeRetentionEnd`.
 *
 * 3. ORGANIZATION-REŽIIMI PROFIIL EI OLE VEEL TOETATUD. Org-profiilil ei ole
 *    isiklikku omanikku (T25 viil C) ja „kes tohib tema nimel kirjeid teha" on
 *    org-capability küsimus, mille leping paigutab E10 alla (graafik EELDAB
 *    org-kihi aktiveerimist). Kuni selleni vastab org-profiil 404-ga —
 *    fail-closed, mitte poolik õigus.
 */

import { prisma } from "@/lib/prisma";
import { PROVIDER_OWNERSHIP_MODE } from "@/lib/org/profileRecipient";
import { assertServiceLogEnabled, isServiceLogLocationStampEnabled } from "./flags.js";
import { badRequest, conflict, notFound } from "./errors.js";
import {
  ENTRY_STATUS,
  MAX_CLIENT_NAME_LENGTH,
  MAX_EXTERNAL_REF_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_QUANTITY,
  MAX_WORKER_NAME_LENGTH,
  REFERRAL_STATUS,
  SERVICE_UNIT,
  VISIT_STAMP_ORDER,
  isProvenance,
  isServiceUnit
} from "./constants.js";
import { checkOverrun } from "./saldo.js";
import {
  deriveServiceSelection,
  deriveTravelMinutes,
  resolveQuantity,
  validateStampOrder
} from "./entryDerivation.js";

/** Raamatupidamise seaduse säilitusaeg aastates. */
export const RETENTION_YEARS = 7;

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * `Boolean("false")` on JavaScriptis `true`. JSON-kehas saabuv string `"false"`
 * oleks seega märkinud kliendi kinnituse OLEMASOLEVAKS — kinnitus, mida keegi
 * ei andnud, arve alusdokumendil.
 */
function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on";
}

/**
 * Rahaline tehing (mall B: kliendi raha kasutamine poeskäigul). Negatiivne ega
 * `NaN` summa ei tohi kirjesse jõuda — ta liidetaks kuuaruande summasse ja
 * rikuks selle vaikselt.
 */
function parseMoney(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw badRequest("service_log.errors.money_invalid");
  if (parsed > MAX_QUANTITY) throw badRequest("service_log.errors.money_invalid");
  return Math.round(parsed * 100) / 100;
}

function normalizeProvenance(value) {
  const clean = text(value, 64);
  if (!clean) return null;
  if (!isProvenance(clean)) throw badRequest("service_log.errors.provenance_invalid");
  return clean;
}

/**
 * Tegevused tulevad teenuse KATALOOGIST (mall B nõue: valik loetelust, mitte
 * vabatekst). Kataloogiväline väärtus jäetakse välja — vabatekst tegevuse
 * pähe muudaks hoolduspäeviku linnukesed mõttetuks ja aruande võrreldamatuks.
 */
function normalizeActivities(input, catalog) {
  if (!Array.isArray(input)) return [];
  const allowed = new Set(Array.isArray(catalog) ? catalog : []);
  const seen = new Set();
  const clean = [];
  for (const item of input) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value || seen.has(value)) continue;
    if (allowed.size && !allowed.has(value)) continue;
    seen.add(value);
    clean.push(value);
    if (clean.length >= 50) break;
  }
  return clean;
}

/**
 * Kalendripäev ilma kellaajata. Skeemis on `date` `@db.Date` just selleks, et
 * kuuaruande piir ei nihkuks ajavööndiga — normaliseerime UTC keskööle, et
 * sama kuupäev tähendaks kõigis kihtides sama päeva.
 */
function toCalendarDate(value) {
  const date = toDate(value);
  if (!date) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Leiab profiili, mille nimel kasutaja tohib kirjeid teha.
 *
 * ADMIN ei ole siin erand: platvormi admin ei kirjuta kellegi teise arve
 * alusdokumente. Tema rada on lugemine haldusvaadetes, mitte sisestus.
 */
export async function requireWritableProfile(userId, { db = prisma } = {}) {
  if (!userId) throw notFound();
  const profile = await db.serviceProviderProfile.findFirst({
    where: { ownerId: userId, ownershipMode: PROVIDER_OWNERSHIP_MODE.SOLO },
    select: { id: true, ownershipMode: true }
  });
  if (!profile) throw notFound("service_log.errors.profile_not_found");
  return profile;
}

export function serializeEntry(row) {
  if (!row) return null;
  return {
    id: row.id,
    date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : row.date,
    serviceId: row.serviceId || null,
    referralId: row.referralId || null,
    clientUserId: row.clientUserId || null,
    clientDisplayName: row.clientDisplayName || null,
    clientExternalRef: row.clientExternalRef || null,
    unit: row.unit,
    quantity: row.quantity === null || row.quantity === undefined ? null : Number(row.quantity),
    activities: row.activities || [],
    moneyAmount:
      row.moneyAmount === null || row.moneyAmount === undefined ? null : Number(row.moneyAmount),
    moneyNote: row.moneyNote || null,
    workerName: row.workerName || null,
    note: row.note || null,
    noteProvenance: row.noteProvenance || null,
    departedForVisitAt: row.departedForVisitAt?.toISOString?.() || null,
    arrivedAt: row.arrivedAt?.toISOString?.() || null,
    leftAt: row.leftAt?.toISOString?.() || null,
    returnedAt: row.returnedAt?.toISOString?.() || null,
    travelMinutes: deriveTravelMinutes(row),
    /* MILLISTE MÄRETE juures asukohapunkt PÄRISELT salvestus. Leping (E2b)
       nõuab, et töötaja näeb, kas punkt salvestati — ja seda teab ainult
       server: kui lüliti on väljas, ei salvestata punkti ka siis, kui brauser
       ta kätte sai. Koordinaate ENNAST siin ei tagastata: nimekirja jaoks piisab
       teadmisest, ET punkt on, ja vähem andmeid liikvel on vähem andmeid lekkida. */
    locationStampedAt: Object.keys(row.locationStamps || {}),
    /* Paeritolu on osa dokumendist: kust see kirje tuli. */
    sourceFieldVisitId: row.sourceFieldVisitId || null,
    status: row.status || ENTRY_STATUS.DRAFT,
    finalizedAt: row.finalizedAt?.toISOString?.() || null,
    voidedAt: row.voidedAt?.toISOString?.() || null,
    voidReason: row.voidReason || null,
    retentionEndsAt: computeRetentionEnd(row)?.toISOString?.() || null,
    confirmedManually: Boolean(row.confirmedManually),
    confirmedByClientAt: row.confirmedByClientAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null
  };
}

/**
 * Kliendi kaks rada: platvormi kasutaja VÕI väline nimi. Üks neist on
 * kohustuslik — ilma kliendita ei ole kirjel aruandes kohta, sest mall A
 * grupeerib read kliendi kaupa.
 */
function normalizeClient(input) {
  const clientUserId = text(input.clientUserId, 64);
  const clientDisplayName = text(input.clientDisplayName, MAX_CLIENT_NAME_LENGTH);
  const clientExternalRef = text(input.clientExternalRef, MAX_EXTERNAL_REF_LENGTH);
  if (!clientUserId && !clientDisplayName) {
    throw badRequest("service_log.errors.client_required");
  }
  return { clientUserId, clientDisplayName, clientExternalRef };
}

/**
 * ASUKOHATEMPLITE VALGE NIMEKIRI.
 *
 * Lubadus on „punktid, mitte jada" (leping ptk 6b). Ilma selle funktsioonita
 * oli see lubadus AINULT kommentaar: `input.locationStamps` salvestati toore
 * JSON-ina, seega klient sai saata piiramatu arvu punkte, lisavälju või terve
 * asukohajälje — täpselt selle, mille välistamine on kogu positsioneeringu
 * alus.
 *
 * Kolm piiri, kõik serveris:
 *   1. AINULT neli tuntud tempelvõtit (`departedForVisitAt` jne);
 *   2. igaühe kohta TÄPSELT ÜKS punkt, mitte massiiv;
 *   3. punktis ainult `lat`, `lng`, `acc`, `at` — tundmatu väli ei jõua DB-ni.
 */
export function sanitizeLocationStamps(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const clean = {};
  for (const key of VISIT_STAMP_ORDER) {
    const point = input[key];
    if (!point || typeof point !== "object" || Array.isArray(point)) continue;
    const lat = Number(point.lat);
    const lng = Number(point.lng);
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) continue;
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) continue;
    const entry = { lat, lng };
    const acc = Number(point.acc);
    if (Number.isFinite(acc) && acc >= 0) entry.acc = Math.round(acc);
    const at = toDate(point.at);
    if (at) entry.at = at.toISOString();
    clean[key] = entry;
  }
  return Object.keys(clean).length ? clean : null;
}

/**
 * @param existingLocationStamps varem salvestatud templid. Väljas lüliti
 *   tähendab „uusi ei võeta vastu", MITTE „olemasolevad kustutatakse":
 *   varem oli PATCH koos välja lülitatud lipuga vaikne andmekadu.
 */
function normalizeStamps(input, { locationStampEnabled, existingLocationStamps = null }) {
  const stamps = {};
  for (const key of VISIT_STAMP_ORDER) stamps[key] = toDate(input[key]);

  const order = validateStampOrder(stamps);
  if (!order.ok) throw badRequest(order.messageKey, order.detail);

  /* Asukohatempel on lüliti taga. Kui lüliti on VÄLJAS, ei salvestata uut ka
     siis, kui klient ta päringus kaasa saatis — värav on serveris, mitte UI-s. */
  /* PUNKT KUULUB SUENDMUSE JUURDE, MITTE VABALT KIRJE KUELGE.
     DoD 10: „maksimaalselt UKS punkt TEADLIKU SUENDMUSE kohta". Ilma selle
     filtrita voetakse vastu punkt maerke kohta, mida ei toimunudki — kirjel
     oleks asukoht „lahkumise juures", kuigi lahkumist ei ole kunagi maergitud.
     Stsenaariumikontroll leidis selle produktsiooni-eelselt; uekski varasem
     test ei puuednud, sest nad saatsid punkte ainult olemasolevate templitega. */
  const cleanedPoints = locationStampEnabled ? sanitizeLocationStamps(input.locationStamps) : null;
  const boundPoints = cleanedPoints
    ? Object.fromEntries(Object.entries(cleanedPoints).filter(([key]) => Boolean(stamps[key])))
    : null;
  const locationStamps = locationStampEnabled
    ? (boundPoints && Object.keys(boundPoints).length ? boundPoints : null) ?? existingLocationStamps
    : existingLocationStamps;
  return { stamps, locationStamps };
}

/**
 * SUUNAMISE TERVIKLIKKUS.
 *
 * Varem kontrolliti ainult, et suunamine kuulub samale PROFIILILE. Sellest ei
 * piisa: sünteetiline proov salvestas `client-b` kirje `client-a` suunamise
 * alla. Tagajärg ei ole kosmeetiline — vale suunamine rikub saldo, KOV-i
 * aruande ja arve lisa, ja avastatakse alles siis, kui KOV maksmata jätab.
 *
 * Neli tingimust, kõik kohustuslikud.
 */
function assertReferralIntegrity(referral, { client, serviceId, unit, date, requireActive = true }) {
  if (!referral) throw notFound("service_log.errors.referral_not_found");

  /* 1. SAMA KLIENT. Platvormi kasutaja rada ja välise nime rada on eraldi —
        kumbki ei tohi teise vastu sobituda. */
  const sameClient = client.clientUserId
    ? referral.clientUserId === client.clientUserId
    : Boolean(client.clientDisplayName) &&
      referral.clientDisplayName === client.clientDisplayName;
  if (!sameClient) throw badRequest("service_log.errors.referral_client_mismatch");

  /* 2. AKTIIVNE — AINULT UUE MAHU KIRJUTAMISEL.
        Lõppenud suunamise alla ei tohi uut tööd lisada. AGA parandus peab
        töötama ka pärast lõpetamist: lõpparve parandus tehakse peaaegu alati
        siis, kui suunamine on juba lõppenud. Varem viskas PATCH siin
        `referral_not_active` ja parandusrada oli kinni just seal, kus teda
        kõige rohkem vaja on. */
  if (requireActive && referral.status !== REFERRAL_STATUS.ACTIVE) {
    throw badRequest("service_log.errors.referral_not_active");
  }

  /* 3. KEHTIV SELLEL KUUPÄEVAL. Suunamisotsus kannab perioodi; väljaspool
        perioodi tehtud töö ei ole selle otsuse alusel arveldatav. */
  if (referral.periodStart && date < referral.periodStart) {
    throw badRequest("service_log.errors.referral_date_outside_period");
  }
  if (referral.periodEnd && date > referral.periodEnd) {
    throw badRequest("service_log.errors.referral_date_outside_period");
  }

  /* 4. SAMA TEENUS JA SAMA ÜHIK. Suunamise ühik on see, mille järgi KOV
        arveldab — kirje teises ühikus annaks aruandes vale numbri. */
  if (referral.serviceId && serviceId && referral.serviceId !== serviceId) {
    throw badRequest("service_log.errors.referral_service_mismatch");
  }
  if (referral.unit && unit && referral.unit !== unit) {
    throw badRequest("service_log.errors.referral_unit_mismatch");
  }
}

/**
 * Mida kasutajalt üldse küsida. Kutsub UI enne vormi näitamist; siin, sest
 * reeglid peavad olema serveri tõde, mitte kliendi oletus.
 */
export async function getEntryDefaults(
  userId,
  { clientUserId = null, clientDisplayName = null } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const clientWhere = clientUserId
    ? { clientUserId }
    : clientDisplayName
      ? { clientDisplayName }
      : null;

  const [activeReferrals, providerServices, lastEntry] = await Promise.all([
    clientWhere
      ? db.serviceReferral.findMany({
          where: { providerProfileId: profile.id, status: "ACTIVE", ...clientWhere },
          /* `kovName` ja otsuse number tulevad KAASA, sest kui UI peab
             küsima, mille vahel valida, peab kasutaja neid eristada saama.
             Ilma nendeta oli `askReferral: true` küsimus ilma valikuteta ja
             kirje salvestus suunamiseta — väljaspool KOV-i eksporti ja
             väljaspool saldot. */
          select: { id: true, serviceId: true, unit: true, kovName: true, referralNumber: true }
        })
      : Promise.resolve([]),
    db.serviceProviderService.findMany({
      where: { providerProfileId: profile.id, status: "PUBLISHED" },
      select: { id: true, name: true, activityCatalog: true, defaultUnit: true }
    }),
    clientWhere
      ? db.serviceEntry.findFirst({
          where: { providerProfileId: profile.id, ...clientWhere },
          orderBy: { date: "desc" },
          select: { serviceId: true, unit: true }
        })
      : Promise.resolve(null)
  ]);

  const selection = deriveServiceSelection({
    activeReferrals,
    providerServices,
    lastUsedServiceId: lastEntry?.serviceId || null,
    lastUsedUnit: lastEntry?.unit || null
  });

  return {
    ...selection,
    /* Ühik EI saa siin vaikimisi HOUR-iks muutuda. Kui teda ei ole kuskilt
       tuletada, jääb `unit` null-iks ja `askUnit` ütleb UI-le, et küsi. Varem
       kirjutas see rida `|| SERVICE_UNIT.HOUR` ja tegi korra-põhisest teenusest
       vaikselt tunnipõhise. */
    unit: selection.unit,
    askUnit: Boolean(selection.askUnit),
    /* Valikud tulevad KAASA otsusega. „Küsi" ilma valikuteta on kasutajale
       ummiktee ja tema ainus väljapääs on jätta suunamine määramata. */
    referrals: activeReferrals,
    services: providerServices,
    activityCatalog:
      providerServices.find((service) => service.id === selection.serviceId)?.activityCatalog || []
  };
}

/**
 * IDEMPOTENTSUSVÕTI. Võrguta sisestuse juures on kordussaatmine NORMAALNE, mitte
 * erand: kui päring jõudis serverini, aga vastus kadus, EI SAA seade teada,
 * kumb juhtus, ja proovib uuesti. Ilma võtmeta tekiks kaks arve alusdokumenti
 * ühest tehtud tööst — ja need on kinnitatuna sellised, mida ei tohi lihtsalt
 * ära kustutada.
 */
const MAX_CLIENT_REQUEST_ID = 64;
const MAX_SOURCE_VISIT_ID = 64;

async function findByClientRequestId(db, providerProfileId, clientRequestId) {
  if (!clientRequestId) return null;
  return db.serviceEntry.findFirst({
    where: { providerProfileId, clientRequestId }
  });
}

/**
 * EELKONTROLL EI OLE PIISAV. Kaks seadet (või sama seade kahes vahekaardis)
 * võivad jõuda kontrollini enne, kui kumbki on kirjutanud — siis läbib mõlemad
 * ja unikaalindeks püüab teise. See EI OLE viga, vaid sama kordussaatmine, mis
 * lihtsalt jõudis kohale samal hetkel; vastus peab olema sama kirje.
 *
 * `create` on TAHTLIKULT transaktsiooni VÄLJAS: PostgreSQL katkestab piirangu
 * rikkumisel terve transaktsiooni (25P02), seega transaktsiooni sees ei saaks
 * seda P2002-t üldse kinni püüda ja teha järelpäringut (T25 õppetund).
 */
async function createEntryRow(db, args) {
  const { providerProfileId, clientRequestId, sourceFieldVisitId } = args.data;
  try {
    return await db.serviceEntry.create(args);
  } catch (error) {
    if (error?.code !== "P2002") throw error;

    /* KAKS UNIKAALSUST, KAKS ERI TÄHENDUST — ja nad ei tohi segamini minna.
       `clientRequestId` kordumine on KORDUSSAATMINE: vasta vana kirjega.
       `sourceFieldVisitId` kordumine on TEINE KIRJE SAMAST KÜLASTUSEST: see on
       kasutaja viga, mida ta peab nägema, mitte vaikselt sama kirje tagasi
       saama. */
    if (clientRequestId) {
      const existing = await findByClientRequestId(db, providerProfileId, clientRequestId);
      if (existing) return existing;
    }
    if (sourceFieldVisitId) {
      const fromVisit = await db.serviceEntry.findFirst({
        where: { providerProfileId, sourceFieldVisitId }
      });
      if (fromVisit) throw conflict("service_log.errors.visit_already_used");
    }
    throw error;
  }
}

export async function createEntry(userId, input = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  /* KORDUSSAATMINE VASTAB VANA KIRJEGA, mitte veaga. Kutsuja jaoks on tulemus
     sama, mis esmasaatmisel — ta ei pea vahet teadma ega uuesti proovima. */
  const clientRequestId = text(input.clientRequestId, MAX_CLIENT_REQUEST_ID);
  /* LÄHTEKÜLASTUS. Üks külastus annab ÜHE kirje: unikaalsus on andmebaasis,
     mitte kontrollis siin — kaks vahekaarti võivad mõlemad kontrolli läbida. */
  const sourceFieldVisitId = text(input.sourceFieldVisitId, MAX_SOURCE_VISIT_ID);
  const replayed = await findByClientRequestId(db, profile.id, clientRequestId);
  if (replayed) return { ...serializeEntry(replayed), overrun: null, replayed: true };

  const client = normalizeClient(input);
  const { stamps, locationStamps } = normalizeStamps(input, {
    locationStampEnabled: isServiceLogLocationStampEnabled(env)
  });

  const unit = isServiceUnit(input.unit) ? input.unit : SERVICE_UNIT.HOUR;
  const quantity = resolveQuantity({
    quantity: input.quantity,
    arrivedAt: stamps.arrivedAt,
    leftAt: stamps.leftAt,
    unit
  });
  if (!quantity.ok) throw badRequest(quantity.messageKey);

  const date = toCalendarDate(input.date) || toCalendarDate(stamps.arrivedAt);
  if (!date) throw badRequest("service_log.errors.date_required");

  const noteProvenance = normalizeProvenance(input.noteProvenance);
  const moneyAmount = parseMoney(input.moneyAmount);

  /* Suunamine ja teenus peavad kuuluma SAMALE profiilile — ja suunamine ka
     samale kliendile, samale teenusele, samale ühikule ning kehtima sellel
     kuupäeval. Vt `assertReferralIntegrity`. */
  const referralId = text(input.referralId, 64);
  const serviceId = text(input.serviceId, 64);
  if (referralId) {
    const referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: {
        id: true,
        clientUserId: true,
        clientDisplayName: true,
        serviceId: true,
        unit: true,
        status: true,
        periodStart: true,
        periodEnd: true
      }
    });
    assertReferralIntegrity(referral, { client, serviceId, unit, date });
  }
  let activityCatalog = [];
  if (serviceId) {
    const service = await db.serviceProviderService.findFirst({
      where: { id: serviceId, providerProfileId: profile.id },
      select: { id: true, activityCatalog: true }
    });
    if (!service) throw notFound("service_log.errors.service_not_found");
    activityCatalog = service.activityCatalog || [];
  }

  /* ÜLETAMISE HOIATUS (DoD punkt 4). Arvutatakse ENNE salvestamist, aga EI
     BLOKEERI: dokumenteerimata töö on halvem kui üle mahu dokumenteeritud töö.
     Osutaja näeb numbrit ja otsustab ise, kas ta räägib KOV-iga. */
  let overrun = null;
  if (referralId) {
    const referralRow = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: {
        id: true,
        unit: true,
        allocatedQuantity: true,
        allocationPeriod: true
      }
    });
    const siblings = await db.serviceEntry.findMany({
      where: { providerProfileId: profile.id, referralId },
      select: { referralId: true, unit: true, quantity: true, date: true, status: true },
      take: 5000
    });
    overrun = checkOverrun(referralRow, siblings, { quantity: quantity.quantity, date });
  }

  const row = await createEntryRow(db, {
    data: {
      providerProfileId: profile.id,
      ownerUserId: userId,
      clientRequestId,
      sourceFieldVisitId,
      referralId,
      serviceId,
      ...client,
      date,
      ...stamps,
      locationStamps,
      unit,
      quantity: quantity.quantity,
      activities: normalizeActivities(input.activities, activityCatalog),
      moneyAmount,
      moneyNote: text(input.moneyNote, MAX_NOTE_LENGTH),
      workerName: text(input.workerName, MAX_WORKER_NAME_LENGTH),
      note: text(input.note, MAX_NOTE_LENGTH),
      noteProvenance,
      confirmedManually: parseBoolean(input.confirmedManually)
    }
  });

  /* Hoiatus tuleb kirjega KOOS. Eraldi päring tähendaks, et mõni kutsuja
     unustab ta küsida ja ületus jääb märkamata just seal, kus ta maksab. */
  return { ...serializeEntry(row), overrun: overrun?.warn ? overrun : null };
}

export async function listEntries(
  userId,
  { from = null, to = null, clientUserId = null, clientDisplayName = null, take = 200 } = {},
  { db = prisma, env = process.env } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const fromDate = toCalendarDate(from);
  const toDateValue = toCalendarDate(to);

  const rows = await db.serviceEntry.findMany({
    where: {
      providerProfileId: profile.id,
      ...(clientUserId ? { clientUserId } : {}),
      ...(clientDisplayName ? { clientDisplayName } : {}),
      ...(fromDate || toDateValue
        ? {
            date: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDateValue ? { lte: toDateValue } : {})
            }
          }
        : {})
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: Math.min(Math.max(Number(take) || 200, 1), 1000)
  });

  return rows.map(serializeEntry);
}

export async function updateEntry(userId, entryId, patch = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id }
  });
  if (!existing) throw notFound();

  if (existing.status === ENTRY_STATUS.VOID) throw conflict("service_log.errors.already_void");

  const merged = { ...existing, ...patch };
  const { stamps, locationStamps } = normalizeStamps(merged, {
    locationStampEnabled: isServiceLogLocationStampEnabled(env),
    // Väljas lüliti ei tohi olemasolevaid templeid kustutada — see oli vaikne
    // andmekadu iga PATCH-i juures, mis tehti pärast lipu väljalülitamist.
    existingLocationStamps: existing.locationStamps || null
  });

  const unit = isServiceUnit(patch.unit) ? patch.unit : existing.unit;
  const quantity = resolveQuantity({
    quantity: patch.quantity !== undefined ? patch.quantity : existing.quantity,
    arrivedAt: stamps.arrivedAt,
    leftAt: stamps.leftAt,
    unit
  });
  if (!quantity.ok) throw badRequest(quantity.messageKey);

  /* MUUTMINE PEAB KORDAMA SAMU KONTROLLE MIS LOOMINE.
     Varem kontrolliti suunamise klienti, teenust, ühikut ja perioodi AINULT
     loomisel — muutmisel sai kuupäeva või ühikut vahetada nii, et kirje väljus
     suunamise perioodist või läks teise ühiku alla. Tagajärg oli sama, mis
     valel loomisel: töö kadus saldost või läks vale KOV-i arvele, ainult
     hiljem ja märkamatumalt. */
  const nextDate =
    patch.date !== undefined ? toCalendarDate(patch.date) || existing.date : existing.date;
  if (existing.referralId) {
    const referral = await db.serviceReferral.findFirst({
      where: { id: existing.referralId, providerProfileId: profile.id },
      select: {
        id: true,
        clientUserId: true,
        clientDisplayName: true,
        serviceId: true,
        unit: true,
        status: true,
        periodStart: true,
        periodEnd: true
      }
    });
    assertReferralIntegrity(referral, {
      client: {
        clientUserId: existing.clientUserId,
        clientDisplayName: existing.clientDisplayName
      },
      serviceId: existing.serviceId,
      unit,
      date: nextDate,
      // Parandus ei ole uus maht — vt `assertReferralIntegrity` punkt 2.
      requireActive: false
    });
  }

  const data = {
    ...stamps,
    locationStamps,
    unit,
    quantity: quantity.quantity,
    ...(patch.note !== undefined ? { note: text(patch.note, MAX_NOTE_LENGTH) } : {}),
    ...(patch.workerName !== undefined
      ? { workerName: text(patch.workerName, MAX_WORKER_NAME_LENGTH) }
      : {}),
    ...(patch.date !== undefined ? { date: toCalendarDate(patch.date) || existing.date } : {}),
    ...(patch.confirmedManually !== undefined
      ? { confirmedManually: parseBoolean(patch.confirmedManually) }
      : {}),
    ...(patch.moneyAmount !== undefined ? { moneyAmount: parseMoney(patch.moneyAmount) } : {}),
    ...(patch.moneyNote !== undefined ? { moneyNote: text(patch.moneyNote, MAX_NOTE_LENGTH) } : {}),
    ...(patch.noteProvenance !== undefined
      ? { noteProvenance: normalizeProvenance(patch.noteProvenance) }
      : {})
  };

  /* KINNITATUD KIRJE PARANDUS ON JÄLGITAV (RPS § 10).
     Varem kirjutas PATCH väärtused lihtsalt üle: puudus põhjus, eelmine
     väärtus ja ajalugu — üle kirjutatud number on sama kadunud kui kustutatud
     rida, ainult vaiksemalt. Mustandi muutmine jääb vabaks: ta ei ole veel
     millegi alus. */
  if (existing.status === ENTRY_STATUS.FINAL) {
    const changedFields = [];
    const previousValues = {};
    for (const [field, next] of Object.entries(data)) {
      const before = existing[field];
      const same =
        before instanceof Date && next instanceof Date
          ? before.getTime() === next.getTime()
          : String(before ?? "") === String(next ?? "");
      if (same) continue;
      changedFields.push(field);
      previousValues[field] = before instanceof Date ? before.toISOString() : (before ?? null);
    }

    if (!changedFields.length) return serializeEntry(existing);

    /* PÕHJUST NÕUAB PARANDUS, MITTE IGA MUUDATUS.
       `confirmedManually` on märge selle kohta, et VÄLINE klient kirjutas
       paberile alla — see ei muuda ühtegi arvestatavat fakti (kogust, ühikut,
       kuupäeva, klienti) ja tavaline töökäik on just „kinnita kirje → märgi
       paberil kinnitatuks". Põhjuse nõudmine tegi selle järjekorra võimatuks:
       kasutaja oleks pidanud allkirja märkimist PÕHJENDAMA.

       Piir on kitsas ja tahtlik: põhjuseta tohib muutuda AINULT kinnituse
       märge. Iga muu väli — ka koos kinnitusega samas päringus — nõuab endiselt
       põhjust ja jätab paranduskirje (RPS § 10). */
    const CONFIRMATION_ONLY = new Set(["confirmedManually"]);
    const onlyConfirmation = changedFields.every((field) => CONFIRMATION_ONLY.has(field));

    const reason = text(patch.reason, MAX_NOTE_LENGTH);
    if (!reason && !onlyConfirmation) throw badRequest("service_log.errors.reason_required");

    if (onlyConfirmation) {
      /* Jälg jääb ka siin, aga ta on kirje enda peal (`confirmedManually`),
         mitte paranduslogis: parandust ei toimunud. */
      return serializeEntry(await db.serviceEntry.update({ where: { id: existing.id }, data }));
    }

    const [row] = await db.$transaction([
      db.serviceEntry.update({ where: { id: existing.id }, data }),
      db.serviceEntryCorrection.create({
        data: {
          entryId: existing.id,
          actorUserId: userId,
          reason,
          previousValues,
          changedFields
        }
      })
    ]);
    return serializeEntry(row);
  }

  const row = await db.serviceEntry.update({ where: { id: existing.id }, data });
  return serializeEntry(row);
}

/** Parandusjälje lugemine. Kirje omanik näeb, mis ja miks muutus. */
export async function listEntryCorrections(userId, entryId, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });
  const entry = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id },
    select: { id: true }
  });
  if (!entry) throw notFound();

  const rows = await db.serviceEntryCorrection.findMany({
    where: { entryId: entry.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      changedFields: true,
      previousValues: true,
      createdAt: true,
      actorUserId: true
    }
  });
  return rows.map((row) => ({
    id: row.id,
    reason: row.reason,
    changedFields: row.changedFields || [],
    previousValues: row.previousValues || {},
    createdAt: row.createdAt?.toISOString?.() || null,
    actorUserId: row.actorUserId || null
  }));
}

/**
 * SÄILITUSTÄHTAJA LÕPP — RPS § 12.
 *
 * Tähtaeg algab selle MAJANDUSAASTA LÕPUST, mil tehing kirjendati, mitte
 * teenuse osutamise kuupäevast. Varem oli ankruks teenuse kuupäev ja see lubas
 * kustutamise kuni ligi aasta liiga vara — tagantjärele sisestatud kirjel
 * veelgi varem.
 *
 * EELDUS, mis vajab juristi kinnitust enne avamist: majandusaasta = kalendriaasta.
 * See on Eestis tavaline, aga MITTE kohustuslik; kui osutaja majandusaasta on
 * nihkes, on see arvutus liiga varajane. Seepärast on aasta salvestatud
 * kirjele (`recordedFiscalYear`) — nihkes aasta toe lisamine ei nõua siis
 * olemasolevate ridade ümberarvutamist.
 */
export function computeRetentionEnd(entry) {
  const recordedYear =
    Number.isInteger(entry?.recordedFiscalYear) && entry.recordedFiscalYear > 0
      ? entry.recordedFiscalYear
      : (toDate(entry?.finalizedAt) || toDate(entry?.createdAt) || toDate(entry?.date))?.getUTCFullYear();
  if (!recordedYear) return null;
  // Majandusaasta lõpp + 7 aastat.
  return new Date(Date.UTC(recordedYear + 1 + RETENTION_YEARS, 0, 1));
}

/**
 * Kustutamise värav, omaniku otsuse järgi (02.08): mustandit tohib kustutada,
 * kinnitatud kirjet mitte.
 *
 * MUSTAND on veel dokument-eelne — ta ei ole millegi alus, seega eksisisestuse
 * kustutamine on lubatud ja lühike aken teeb voo inimlikuks. KINNITATUD kirje
 * on arve alusdokument: teda parandatakse (`updateEntry` põhjusega) või
 * tühistatakse (`voidEntry`), ja hard-delete avaneb alles pärast
 * säilitustähtaega.
 */
export function isEntryDeletable(entry, { now = new Date() } = {}) {
  if (!entry) return false;
  if (entry.status === ENTRY_STATUS.DRAFT) return true;
  const retentionEnd = computeRetentionEnd(entry);
  if (!retentionEnd) return false;
  return now.getTime() >= retentionEnd.getTime();
}

/**
 * Kinnitamine. Siin ja ainult siin sünnib „kirjendamise" hetk, mille järgi
 * säilitustähtaeg arvutatakse.
 */
export async function finalizeEntry(userId, entryId, { db = prisma, env = process.env, now = new Date() } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id },
    select: { id: true, status: true }
  });
  if (!existing) throw notFound();
  if (existing.status !== ENTRY_STATUS.DRAFT) {
    throw conflict("service_log.errors.already_final");
  }

  const row = await db.serviceEntry.update({
    where: { id: existing.id },
    data: {
      status: ENTRY_STATUS.FINAL,
      finalizedAt: now,
      recordedFiscalYear: now.getUTCFullYear()
    }
  });
  return serializeEntry(row);
}

/**
 * Tühistamine — kinnitatud kirje „kustutamise" asendaja. Rida jääb alles ja
 * kannab põhjust; aruandest ta välja jääb, aga jälg ei kao.
 */
export async function voidEntry(userId, entryId, { reason, db = prisma, env = process.env, now = new Date() } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const cleanReason = text(reason, MAX_NOTE_LENGTH);
  if (!cleanReason) throw badRequest("service_log.errors.reason_required");

  const existing = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id },
    select: { id: true, status: true }
  });
  if (!existing) throw notFound();
  if (existing.status === ENTRY_STATUS.VOID) throw conflict("service_log.errors.already_void");

  const row = await db.serviceEntry.update({
    where: { id: existing.id },
    data: { status: ENTRY_STATUS.VOID, voidedAt: now, voidReason: cleanReason }
  });
  return serializeEntry(row);
}

export async function deleteEntry(userId, entryId, { db = prisma, env = process.env, now = new Date() } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id },
    select: {
      id: true,
      date: true,
      createdAt: true,
      status: true,
      finalizedAt: true,
      recordedFiscalYear: true
    }
  });
  if (!existing) throw notFound();

  if (!isEntryDeletable(existing, { now })) {
    /* 409, mitte 404: kasutaja NÄEB kirjet ja tal on õigus teada, miks ta seda
       kustutada ei saa. Vaikne keeldumine õpetaks teda uuesti proovima. */
    throw conflict("service_log.errors.retention_locked", { retentionYears: RETENTION_YEARS });
  }

  await db.serviceEntry.delete({ where: { id: existing.id } });
  return { id: existing.id, deleted: true };
}
