/**
 * TEENUSPÄEVIK-V1 E2 — teenuskirje teenuskiht.
 *
 * Kolm asja, mis siin on teadlikud ja mida ei tohi „mugavamaks" teha:
 *
 * 1. OMANIKU SKOOP ON KÕVA. Iga lugemine ja kirjutamine käib läbi
 *    `requireWritableProfile`, mis seob kirje osutaja profiiliga. Võõras ID ja
 *    olematu ID annavad MÕLEMAD 404 (vt errors.js).
 *
 * 2. KUSTUTAMINE ON PIIRATUD. Teenuskirje on arve alusdokument
 *    (raamatupidamise seadus, 7 aastat). `deleteEntry` keeldub, kuni see aeg
 *    täis ei ole. **LAHTINE OMANIKU KÜSIMUS:** see tähendab, et ka viie minuti
 *    vanune eksikirje ei ole kustutatav. Parandusrada on `updateEntry`, mis on
 *    raamatupidamislikult õige (dokumenti parandatakse, mitte ei kaotata), aga
 *    lühike parandusaken kohe pärast sisestust oleks kasutajale lahkem. Seda EI
 *    OLE siin, sest leping (ptk 8.5, 8.9) ütleb ainult „keeld <7a" ja
 *    parandusakna pikkus on tooteotsus, mitte tehniline detail.
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
  MAX_CLIENT_NAME_LENGTH,
  MAX_EXTERNAL_REF_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_WORKER_NAME_LENGTH,
  SERVICE_UNIT,
  VISIT_STAMP_ORDER,
  isProvenance,
  isServiceUnit
} from "./constants.js";
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

function normalizeStamps(input, { locationStampEnabled }) {
  const stamps = {};
  for (const key of VISIT_STAMP_ORDER) stamps[key] = toDate(input[key]);

  const order = validateStampOrder(stamps);
  if (!order.ok) throw badRequest(order.messageKey, order.detail);

  /* Asukohatempel on lüliti taga. Kui lüliti on VÄLJAS, ei salvestata teda ka
     siis, kui klient ta päringus kaasa saatis — värav on serveris, mitte UI-s. */
  const locationStamps = locationStampEnabled ? input.locationStamps || null : null;
  return { stamps, locationStamps };
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
          select: { id: true, serviceId: true, unit: true }
        })
      : Promise.resolve([]),
    db.serviceProviderService.findMany({
      where: { providerProfileId: profile.id, status: "PUBLISHED" },
      select: { id: true, name: true, activityCatalog: true }
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
    lastUsedServiceId: lastEntry?.serviceId || null
  });

  return {
    ...selection,
    unit: selection.unit || lastEntry?.unit || SERVICE_UNIT.HOUR,
    services: providerServices,
    activityCatalog:
      providerServices.find((service) => service.id === selection.serviceId)?.activityCatalog || []
  };
}

export async function createEntry(userId, input = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

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

  const noteProvenance = text(input.noteProvenance, 64);
  if (noteProvenance && !isProvenance(noteProvenance)) {
    throw badRequest("service_log.errors.provenance_invalid");
  }

  /* Suunamine ja teenus peavad kuuluma SAMALE profiilile. Ilma selle
     kontrollita saaks kirje viidata võõrale suunamisele ja rikkuda teise
     osutaja saldot. */
  const referralId = text(input.referralId, 64);
  if (referralId) {
    const referral = await db.serviceReferral.findFirst({
      where: { id: referralId, providerProfileId: profile.id },
      select: { id: true }
    });
    if (!referral) throw notFound("service_log.errors.referral_not_found");
  }
  const serviceId = text(input.serviceId, 64);
  if (serviceId) {
    const service = await db.serviceProviderService.findFirst({
      where: { id: serviceId, providerProfileId: profile.id },
      select: { id: true }
    });
    if (!service) throw notFound("service_log.errors.service_not_found");
  }

  const row = await db.serviceEntry.create({
    data: {
      providerProfileId: profile.id,
      ownerUserId: userId,
      referralId,
      serviceId,
      ...client,
      date,
      ...stamps,
      locationStamps,
      unit,
      quantity: quantity.quantity,
      activities: Array.isArray(input.activities)
        ? input.activities.filter((item) => typeof item === "string").slice(0, 50)
        : [],
      moneyAmount:
        input.moneyAmount === undefined || input.moneyAmount === null || input.moneyAmount === ""
          ? null
          : Number(input.moneyAmount),
      moneyNote: text(input.moneyNote, MAX_NOTE_LENGTH),
      workerName: text(input.workerName, MAX_WORKER_NAME_LENGTH),
      note: text(input.note, MAX_NOTE_LENGTH),
      noteProvenance,
      confirmedManually: Boolean(input.confirmedManually)
    }
  });

  return serializeEntry(row);
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

  const merged = { ...existing, ...patch };
  const { stamps, locationStamps } = normalizeStamps(merged, {
    locationStampEnabled: isServiceLogLocationStampEnabled(env)
  });

  const unit = isServiceUnit(patch.unit) ? patch.unit : existing.unit;
  const quantity = resolveQuantity({
    quantity: patch.quantity !== undefined ? patch.quantity : existing.quantity,
    arrivedAt: stamps.arrivedAt,
    leftAt: stamps.leftAt,
    unit
  });
  if (!quantity.ok) throw badRequest(quantity.messageKey);

  const row = await db.serviceEntry.update({
    where: { id: existing.id },
    data: {
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
        ? { confirmedManually: Boolean(patch.confirmedManually) }
        : {})
    }
  });

  return serializeEntry(row);
}

/**
 * Kustutamise värav. Vt mooduli päist: see EI OLE mugavusfunktsioon, vaid
 * raamatupidamise seaduse säilitusaeg. Parandusrada on `updateEntry`.
 */
export function isEntryDeletable(entry, { now = new Date() } = {}) {
  const created = toDate(entry?.date) || toDate(entry?.createdAt);
  if (!created) return false;
  const retentionEnd = new Date(created);
  retentionEnd.setUTCFullYear(retentionEnd.getUTCFullYear() + RETENTION_YEARS);
  return now.getTime() >= retentionEnd.getTime();
}

export async function deleteEntry(userId, entryId, { db = prisma, env = process.env, now = new Date() } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceEntry.findFirst({
    where: { id: entryId, providerProfileId: profile.id },
    select: { id: true, date: true, createdAt: true }
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
