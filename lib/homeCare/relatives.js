/**
 * KODUTEENUS K5-k — kliendi lähedased ja jagamisaste (kava II.6.8).
 *
 * Lähedane helistab ja küsib, kuidas emal läheb. Hooldaja ja hooldusjuht peavad teadma,
 * mida klient on lubanud sellele inimesele rääkida. Kokkulepe tehakse kliendiga ilma
 * lähedaseta ja iga lähedase kohta eraldi, kolmes astmes:
 *   1: saab teada, kas käidi;
 *   2: ka seda, mida koos tehti;
 *   3: lisaks võtab hooldusjuht ühendust, kui hooldajad on märganud muutust.
 * Juures on rida „sellest ma ei taha, et räägitaks" ja päev, millal klient kokkulepet
 * viimati kinnitas. Üle küsitakse vähemalt kord poole aasta jooksul.
 *
 * Loevad kliendi meeskond ja hooldusjuht (ka põhjusega avaja: just asendaja võtab kõne
 * vastu); muudab hooldusjuht. Ridu ei muudeta ega kustutata: muudatus lõpetab rea ja
 * teeb uue. Päeviku teksti siit perele ei liigu: see on reegel inimesele, mitte automaat.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, notFound } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_SHARING_LEVELS, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { phoneHref } from "./phone.js";
import { asObject, normalizeId, normalizeIsoDay, normalizeLine } from "./validation.js";

const PHONE_PATTERN = /^[0-9+() -]+$/;

function pad(value) {
  return String(value).padStart(2, "0");
}

/** Sisendi kuju: nimi ja aste kohustuslikud; päev vaikimisi täna, tulevikus ei saa olla. Puhas funktsioon. */
export function normalizeRelative(rawInput, today) {
  const input = asObject(rawInput);
  const name = normalizeLine(input.name, HOME_CARE_LIMITS.RELATIVE_NAME_MAX, { required: true, errorKey: "home_care.errors.relative_name_required" });
  const level = Number(input.level);
  if (!CARE_SHARING_LEVELS.includes(level)) throw badRequest("home_care.errors.relative_level_required");
  const phone = normalizeLine(input.phone, HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) || null;
  if (phone && (!PHONE_PATTERN.test(phone) || !phoneHref(phone))) throw badRequest("home_care.errors.referral_phone_invalid");
  const parts = normalizeIsoDay(input.agreedOn);
  const agreedOn = parts ? `${parts.year}-${pad(parts.month)}-${pad(parts.day)}` : today;
  if (agreedOn > today) throw badRequest("home_care.errors.relative_day_future");
  return {
    name,
    relation: normalizeLine(input.relation, HOME_CARE_LIMITS.RELATIVE_RELATION_MAX) || null,
    phone,
    level,
    noTell: normalizeLine(input.noTell, HOME_CARE_LIMITS.RELATIVE_NO_TELL_MAX) || null,
    agreedOn
  };
}

/** Kas kokkulepe tuleb kliendilt üle küsida: viimasest kinnitusest on möödas üle poole aasta. Puhas funktsioon. */
export function relativeReviewState(agreedOn, today) {
  const days = daysBetween(agreedOn, today);
  return { days, due: days > HOME_CARE_LIMITS.RELATIVE_REVIEW_DAYS };
}

const RELATIVE_SELECT = Object.freeze({ id: true, clientId: true, name: true, relation: true, phone: true, level: true, noTell: true, agreedOn: true });

function serialize(row, today) {
  return {
    id: row.id,
    name: row.name,
    relation: row.relation || null,
    phone: row.phone || null,
    level: row.level,
    noTell: row.noTell || null,
    agreedOn: row.agreedOn,
    reviewDue: relativeReviewState(row.agreedOn, today).due
  };
}

/** Kliendi lähedased kliendi lehele: madalama astmega enne ei järjestata, järjekord on lisamise oma. */
export async function loadRelativesWithin(tx, clientId, today) {
  const rows = await tx.careClientRelative.findMany({ where: { clientId, endedAt: null }, select: RELATIVE_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.map((row) => serialize(row, today));
}

/** Tähtaegade lehele: kokkulepped, mis tuleb kliendilt üle küsida, kõige vanem ees. */
export async function loadRelativesDue(db, organizationId, clientWhere, today) {
  const rows = await db.careClientRelative.findMany({
    where: { organizationId, endedAt: null, client: clientWhere },
    select: { ...RELATIVE_SELECT, client: { select: { id: true, displayName: true, status: true } } },
    orderBy: [{ agreedOn: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.DEADLINE_CLIENTS_MAX
  });
  return rows
    .map((row) => ({ key: row.id, client: row.client, name: row.name, relation: row.relation || null, agreedOn: row.agreedOn, ...relativeReviewState(row.agreedOn, today) }))
    .filter((item) => item.due);
}

async function writeRelativeAudit(tx, context, clientId, change) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_RELATIVE_CHANGED,
    resourceType: OrgAuditResource.CARE_CLIENT,
    resourceId: clientId,
    meta: { organizationId: context.organization.id, clientId, change }
  });
}

/**
 * Lisab lähedase või asendab olemasoleva rea (`relativeId`): vana rida lõpeb, uus tekib.
 * Sama teed pidi kinnitatakse kokkulepe uuesti (uus `agreedOn`). Ainult hooldusjuht.
 */
export async function saveRelative(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const body = asObject(input);
  const replaceId = body.relativeId === undefined || body.relativeId === null || body.relativeId === "" ? null : normalizeId(body.relativeId, "home_care.errors.relative_not_found");
  const data = normalizeRelative(body, today);

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const membershipId = context.membership?.id || null;
    if (replaceId) {
      const ended = await tx.careClientRelative.updateMany({ where: { id: replaceId, clientId: id, endedAt: null }, data: { endedAt: now, endedByMembershipId: membershipId } });
      if (ended.count !== 1) throw notFound("home_care.errors.relative_not_found");
    } else {
      const open = await tx.careClientRelative.count({ where: { clientId: id, endedAt: null } });
      if (open >= HOME_CARE_LIMITS.RELATIVES_MAX) throw badRequest("home_care.errors.relatives_too_many", { limit: HOME_CARE_LIMITS.RELATIVES_MAX });
    }
    await tx.careClientRelative.create({
      data: { ...data, organizationId: context.organization.id, clientId: id, createdByMembershipId: membershipId, createdByName: await membershipDisplayName(tx, context), createdAt: now }
    });
    await writeRelativeAudit(tx, context, id, replaceId ? "changed" : "added");
    return { relatives: await loadRelativesWithin(tx, id, today) };
  });
}

/** Eemaldab lähedase (klient võttis loa tagasi või inimest enam ei ole). Rida jääb ajalukku lõpuga. */
export async function endRelative(context, clientId, relativeId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const rowId = normalizeId(relativeId, "home_care.errors.relative_not_found");
  const today = todayText(now, organizationTimeZone(context));

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const ended = await tx.careClientRelative.updateMany({ where: { id: rowId, clientId: id, endedAt: null }, data: { endedAt: now, endedByMembershipId: context.membership?.id || null } });
    if (ended.count !== 1) throw notFound("home_care.errors.relative_not_found");
    await writeRelativeAudit(tx, context, id, "removed");
    return { relatives: await loadRelativesWithin(tx, id, today) };
  });
}
