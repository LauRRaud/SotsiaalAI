/**
 * KODUTEENUS K5-v — „võõras ukse taga" (kava II.6.8).
 *
 * Kui graafik toob kliendi juurde inimese, kes ei ole seal varem käinud, peab klient seda
 * ette teadma: eakas inimene ei ava võõrale ust, ja õigusega. Päevaplaan märgib sellise käigu
 * („esimest korda") ja hooldusjuht paneb kirja, kuidas kliendile teatati: helistati,
 * püsihooldaja ütles eelmisel käigul või ei jõutud. Töötaja näeb oma päevas: „klient ei tunne
 * sind; talle on teatatud". Kuidas uksest sisse saab, on püsikaardil („enne kui lähed").
 *
 * „KÄINUD" on töötaja, kellel on selle kliendi juures vähemalt üks käigu kirje, kirjutajana
 * või kaasas olnuna. Kliendi meeskonda kuulumine üksi ei loe: uue kliendi juurde läheb ka
 * püsihooldaja esimest korda.
 *
 * Ridu ei muudeta ega kustutata: uus märge lõpetab eelmise (`endedAt`). Märgib kliendi
 * hooldusjuht.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest } from "../org/errors.js";

import { assertHomeCareContext, membershipDisplayName, organizationTimeZone, requireClientCoordinator } from "./access.js";
import { CARE_FIRST_VISIT_OUTCOMES, HOME_CARE_LIMITS } from "./constants.js";
import { daysBetween, todayText } from "./decisions.js";
import { VISIT_RECORD } from "./provided.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay } from "./validation.js";

function pad(value) {
  return String(value).padStart(2, "0");
}

const pairKey = (clientId, membershipId) => `${clientId}:${membershipId}`;

/**
 * Esmakäigu seis käigu juures: `null`, kui töötaja on kliendi juures käinud; muidu teatamise
 * tulemus (või `null`, kui midagi ei ole märgitud) ja märkija. Puhas funktsioon.
 */
export function firstVisitState({ known, notice = null }) {
  if (known) return null;
  return { outcome: notice?.outcome || null, byName: notice?.createdByName || null };
}

/** Sisend: päev, töötaja ja tulemus. Päev on aknas „nädal tagasi kuni kuu ette". Puhas funktsioon. */
export function normalizeFirstVisit(rawInput, today) {
  const input = asObject(rawInput);
  const parts = normalizeIsoDay(input.day);
  if (!parts) throw badRequest("home_care.errors.first_visit_day");
  const day = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;
  const offset = daysBetween(today, day);
  if (offset < -HOME_CARE_LIMITS.VISIT_CHANGE_BACK_DAYS || offset > HOME_CARE_LIMITS.FIRST_VISIT_AHEAD_DAYS) throw badRequest("home_care.errors.first_visit_day");
  return {
    day,
    workerMembershipId: normalizeId(input.workerMembershipId, "home_care.errors.first_visit_worker"),
    outcome: normalizeEnum(input.outcome, CARE_FIRST_VISIT_OUTCOMES, "home_care.errors.first_visit_outcome")
  };
}

/**
 * Käikude juurde esmakäigu seis. `visits`: `{ clientId, workerMembershipId, day }`; tagastab
 * funktsiooni, mis annab käigu kohta `firstVisitState` tulemuse. Kaks päringut käikude hulga
 * kohta (käinud paarid ja kehtivad märked), mitte käigu kaupa.
 */
export async function loadFirstVisitReader(db, organizationId, visits) {
  const wanted = visits.filter((visit) => visit.clientId && visit.workerMembershipId);
  if (!wanted.length) return () => null;
  const clientIds = [...new Set(wanted.map((visit) => visit.clientId))];
  const workerIds = [...new Set(wanted.map((visit) => visit.workerMembershipId))];
  const days = [...new Set(wanted.map((visit) => visit.day))];

  const known = new Set();
  const asAuthor = await db.careClientEntry.groupBy({
    by: ["clientId", "authorMembershipId"],
    where: { organizationId, clientId: { in: clientIds }, authorMembershipId: { in: workerIds }, ...VISIT_RECORD },
    _count: { _all: true }
  });
  for (const row of asAuthor) known.add(pairKey(row.clientId, row.authorMembershipId));
  const asCompanion = await db.careClientEntry.groupBy({
    by: ["clientId", "companionMembershipId"],
    where: { organizationId, clientId: { in: clientIds }, companionMembershipId: { in: workerIds }, ...VISIT_RECORD },
    _count: { _all: true }
  });
  for (const row of asCompanion) known.add(pairKey(row.clientId, row.companionMembershipId));

  const notices = new Map();
  for (const row of await db.careFirstVisitNotice.findMany({
    where: { organizationId, endedAt: null, clientId: { in: clientIds }, workerMembershipId: { in: workerIds }, day: { in: days } },
    select: { clientId: true, workerMembershipId: true, day: true, outcome: true, createdByName: true }
  })) {
    notices.set(`${pairKey(row.clientId, row.workerMembershipId)}:${row.day}`, row);
  }
  return (visit) =>
    visit.clientId && visit.workerMembershipId
      ? firstVisitState({
          known: known.has(pairKey(visit.clientId, visit.workerMembershipId)),
          notice: notices.get(`${pairKey(visit.clientId, visit.workerMembershipId)}:${visit.day}`)
        })
      : null;
}

/** Märgib, kuidas kliendile teatati, et tuleb inimene, keda ta ei tunne. Uus märge lõpetab eelmise. Ainult hooldusjuht. */
export async function markFirstVisit(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const today = todayText(now, organizationTimeZone(context));
  const data = normalizeFirstVisit(input, today);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const worker = await tx.organizationMembership.findFirst({
      where: { id: data.workerMembershipId, organizationId, status: OrganizationMembershipStatus.ACTIVE },
      select: { id: true }
    });
    if (!worker) throw badRequest("home_care.errors.first_visit_worker");
    const membershipId = context.membership?.id || null;
    await tx.careFirstVisitNotice.updateMany({
      where: { clientId: id, workerMembershipId: data.workerMembershipId, day: data.day, endedAt: null },
      data: { endedAt: now, endedByMembershipId: membershipId }
    });
    const createdByName = await membershipDisplayName(tx, context);
    await tx.careFirstVisitNotice.create({
      data: { organizationId, clientId: id, ...data, createdByMembershipId: membershipId, createdByName, createdAt: now }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_FIRST_VISIT_MARKED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId, clientId: id, membershipId: data.workerMembershipId, day: data.day, change: data.outcome }
    });
    return { firstVisit: { outcome: data.outcome, byName: createdByName } };
  });
}
