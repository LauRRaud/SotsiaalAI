/**
 * TEENUSPÄEVIK-V1 E3 — suunamiste haldus.
 *
 * Suunamisotsus on KOV-i dokument, mille osutaja platvormile üle kannab. Ta
 * kannab mahtu ja perioodi ning tema järgi arveldatakse — seepärast on siin
 * kaks asja rangemad kui tavalisel CRUD-il:
 *
 * 1. ÜHIKUT JA MAHU LIIKI EI SAA MUUTA, kui suunamise all on juba kirjeid.
 *    „40 h kuus" -> „40 korda kokku" muutmine kirjutaks tagantjärele ümber
 *    kõigi olemasolevate kirjete tähenduse ja koos sellega juba esitatud
 *    aruande. Muutmiseks lõpetatakse vana suunamine ja luuakse uus — täpselt
 *    nagu KOV teeb uue otsuse.
 *
 * 2. LÕPETAMINE EI KUSTUTA. `ENDED` suunamise alla ei saa uut mahtu kirjutada,
 *    aga olemasolevad kirjed jäävad alles: nad on juba esitatud arve alus.
 */

import { prisma } from "@/lib/prisma";
import { assertServiceLogEnabled } from "./flags.js";
import { badRequest, conflict, notFound } from "./errors.js";
import {
  ALLOCATION_PERIOD,
  MAX_CLIENT_NAME_LENGTH,
  MAX_EXTERNAL_REF_LENGTH,
  MAX_NOTE_LENGTH,
  MAX_QUANTITY,
  REFERRAL_STATUS,
  SERVICE_UNIT,
  isAllocationPeriod,
  isServiceUnit
} from "./constants.js";
import { requireWritableProfile } from "./entries.js";
import { computeReferralBalance, monthKey } from "./saldo.js";

function text(value, maxLength) {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function toCalendarDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function parseAllocated(value) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > MAX_QUANTITY) {
    throw badRequest("service_log.errors.allocation_invalid");
  }
  return Math.round(parsed * 100) / 100;
}

export function serializeReferral(row, balance = null) {
  if (!row) return null;
  return {
    id: row.id,
    kovName: row.kovName,
    referralNumber: row.referralNumber || null,
    serviceId: row.serviceId || null,
    clientUserId: row.clientUserId || null,
    clientDisplayName: row.clientDisplayName || null,
    clientExternalRef: row.clientExternalRef || null,
    periodStart: row.periodStart ? row.periodStart.toISOString().slice(0, 10) : null,
    periodEnd: row.periodEnd ? row.periodEnd.toISOString().slice(0, 10) : null,
    unit: row.unit,
    allocatedQuantity:
      row.allocatedQuantity === null || row.allocatedQuantity === undefined
        ? null
        : Number(row.allocatedQuantity),
    allocationPeriod: row.allocationPeriod,
    goalsText: row.goalsText || null,
    status: row.status,
    balance,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null
  };
}

export async function createReferral(userId, input = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const kovName = text(input.kovName, MAX_CLIENT_NAME_LENGTH);
  if (!kovName) throw badRequest("service_log.errors.kov_required");

  const clientUserId = text(input.clientUserId, 64);
  const clientDisplayName = text(input.clientDisplayName, MAX_CLIENT_NAME_LENGTH);
  if (!clientUserId && !clientDisplayName) throw badRequest("service_log.errors.client_required");

  const unit = isServiceUnit(input.unit) ? input.unit : SERVICE_UNIT.HOUR;
  const allocationPeriod = isAllocationPeriod(input.allocationPeriod)
    ? input.allocationPeriod
    : ALLOCATION_PERIOD.MONTH;

  const periodStart = toCalendarDate(input.periodStart);
  const periodEnd = toCalendarDate(input.periodEnd);
  if (periodStart && periodEnd && periodEnd < periodStart) {
    throw badRequest("service_log.errors.period_invalid");
  }

  const serviceId = text(input.serviceId, 64);
  if (serviceId) {
    const service = await db.serviceProviderService.findFirst({
      where: { id: serviceId, providerProfileId: profile.id },
      select: { id: true }
    });
    if (!service) throw notFound("service_log.errors.service_not_found");
  }

  const row = await db.serviceReferral.create({
    data: {
      providerProfileId: profile.id,
      serviceId,
      kovName,
      referralNumber: text(input.referralNumber, MAX_EXTERNAL_REF_LENGTH),
      clientUserId,
      clientDisplayName,
      clientExternalRef: text(input.clientExternalRef, MAX_EXTERNAL_REF_LENGTH),
      periodStart,
      periodEnd,
      unit,
      allocatedQuantity: parseAllocated(input.allocatedQuantity),
      allocationPeriod,
      goalsText: text(input.goalsText, MAX_NOTE_LENGTH),
      status: REFERRAL_STATUS.ACTIVE
    }
  });
  return serializeReferral(row);
}

/**
 * Loend koos JÄÄGIGA. Saldo tuleb kaasa, sest DoD punkt 4 nõuab, et jääk oleks
 * ALATI nähtav — eraldi päring tähendaks, et mõni vaade unustab ta ära.
 */
export async function listReferrals(
  userId,
  { month = null, status = null, clientUserId = null, clientDisplayName = null } = {},
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const referrals = await db.serviceReferral.findMany({
    where: {
      providerProfileId: profile.id,
      ...(status ? { status } : {}),
      ...(clientUserId ? { clientUserId } : {}),
      ...(clientDisplayName ? { clientDisplayName } : {})
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500
  });
  if (!referrals.length) return [];

  const window = month || monthKey(now);
  const entries = await db.serviceEntry.findMany({
    where: {
      providerProfileId: profile.id,
      referralId: { in: referrals.map((row) => row.id) }
    },
    select: { referralId: true, unit: true, quantity: true, date: true, status: true },
    take: 5000
  });

  return referrals.map((row) =>
    serializeReferral(row, computeReferralBalance(row, entries, { month: window }))
  );
}

export async function getReferralBalance(
  userId,
  referralId,
  { month = null } = {},
  { db = prisma, env = process.env, now = new Date() } = {}
) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const referral = await db.serviceReferral.findFirst({
    where: { id: referralId, providerProfileId: profile.id }
  });
  if (!referral) throw notFound("service_log.errors.referral_not_found");

  const entries = await db.serviceEntry.findMany({
    where: { providerProfileId: profile.id, referralId: referral.id },
    select: { referralId: true, unit: true, quantity: true, date: true, status: true },
    take: 5000
  });
  return computeReferralBalance(referral, entries, { month: month || monthKey(now) });
}

export async function updateReferral(userId, referralId, patch = {}, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceReferral.findFirst({
    where: { id: referralId, providerProfileId: profile.id }
  });
  if (!existing) throw notFound("service_log.errors.referral_not_found");

  /* ÜHIKU JA MAHU LIIGI LUKK. Kui suunamise all on juba kirjeid, kirjutaks
     nende muutmine tagantjärele ümber olemasolevate kirjete tähenduse ja koos
     sellega juba esitatud aruande. Muutmiseks lõpetatakse vana ja luuakse uus —
     täpselt nagu KOV teeb uue otsuse. */
  const wantsUnitChange = isServiceUnit(patch.unit) && patch.unit !== existing.unit;
  const wantsPeriodKindChange =
    isAllocationPeriod(patch.allocationPeriod) && patch.allocationPeriod !== existing.allocationPeriod;

  if (wantsUnitChange || wantsPeriodKindChange) {
    const usedCount = await db.serviceEntry.count({ where: { referralId: existing.id } });
    if (usedCount > 0) throw conflict("service_log.errors.referral_locked_by_entries");
  }

  const periodStart =
    patch.periodStart !== undefined ? toCalendarDate(patch.periodStart) : existing.periodStart;
  const periodEnd = patch.periodEnd !== undefined ? toCalendarDate(patch.periodEnd) : existing.periodEnd;
  if (periodStart && periodEnd && periodEnd < periodStart) {
    throw badRequest("service_log.errors.period_invalid");
  }

  const row = await db.serviceReferral.update({
    where: { id: existing.id },
    data: {
      ...(patch.kovName !== undefined ? { kovName: text(patch.kovName, MAX_CLIENT_NAME_LENGTH) || existing.kovName } : {}),
      ...(patch.referralNumber !== undefined
        ? { referralNumber: text(patch.referralNumber, MAX_EXTERNAL_REF_LENGTH) }
        : {}),
      ...(patch.allocatedQuantity !== undefined
        ? { allocatedQuantity: parseAllocated(patch.allocatedQuantity) }
        : {}),
      ...(patch.goalsText !== undefined ? { goalsText: text(patch.goalsText, MAX_NOTE_LENGTH) } : {}),
      ...(wantsUnitChange ? { unit: patch.unit } : {}),
      ...(wantsPeriodKindChange ? { allocationPeriod: patch.allocationPeriod } : {}),
      periodStart,
      periodEnd
    }
  });
  return serializeReferral(row);
}

/**
 * Lõpetamine. EI KUSTUTA: olemasolevad kirjed on juba esitatud arve alus ja
 * peavad jääma. `ENDED` suunamise alla ei saa uut mahtu kirjutada — seda
 * jõustab `assertReferralIntegrity` kirje loomisel.
 */
export async function endReferral(userId, referralId, { db = prisma, env = process.env } = {}) {
  assertServiceLogEnabled(env);
  const profile = await requireWritableProfile(userId, { db });

  const existing = await db.serviceReferral.findFirst({
    where: { id: referralId, providerProfileId: profile.id },
    select: { id: true, status: true }
  });
  if (!existing) throw notFound("service_log.errors.referral_not_found");
  if (existing.status === REFERRAL_STATUS.ENDED) {
    throw conflict("service_log.errors.referral_already_ended");
  }

  const row = await db.serviceReferral.update({
    where: { id: existing.id },
    data: { status: REFERRAL_STATUS.ENDED }
  });
  return serializeReferral(row);
}
