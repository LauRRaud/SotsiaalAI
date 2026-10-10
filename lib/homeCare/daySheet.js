/**
 * KODUTEENUS K5-t — päevaleht paberil (kava II.6.15 „prindi päevaleht", II.6.12 kriisivaade).
 *
 * Hooldusjuht prindib ühe töötaja või kõigi töötajate päeva: kui telefon on katki, võrku ei
 * ole või on kriis, peab töö käima paberi pealt ja kirjed tehakse päevikusse hiljem. Leht
 * tehakse samast päevaplaanist, mida hooldusjuht ekraanil näeb (tema skoobis), ja juurde
 * loetakse see, mida töötaja ukse taga vajab: telefon, „enne kui lähed" read, võti, kava
 * toimingud. Ära jäetud käike lehel ei ole.
 *
 * Midagi ei salvestata peale auditirea (kes, mis päeva kohta ja mitu käiku printis): paber
 * kannab isikuandmeid ja selle väljaandmine peab olema hiljem näha. Ainult hooldusjuht.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest } from "../org/errors.js";

import { CarePlanStatus, CarePlannedState } from "./constants.js";
import { getDayPlan } from "./dayPlan.js";
import { renderDaySheetHtml } from "./daySheetDocument.js";
import { asObject, normalizeOptionalId } from "./validation.js";

/**
 * Päevaplaanist lehed: iga töötaja käigud kellaaja järgi, ära jäetud käigud välja. Lahtise
 * takistuse teatega töötaja käigud on plaanis teate juures; lehel on need tema nime all.
 * `withUnassigned`: tegijata ja puuduva tegijaga käigud omaette lehena lõpus. Puhas funktsioon.
 */
export function sheetsOfPlan(plan, { membershipId = null, withUnassigned = true } = {}) {
  const live = (visits) => (visits || []).filter((visit) => visit.state !== CarePlannedState.CANCELLED);
  const byWorker = new Map();
  const add = (id, name, visits) => {
    if (!byWorker.has(id)) byWorker.set(id, { membershipId: id, workerName: name || "", visits: [] });
    byWorker.get(id).visits.push(...live(visits));
  };
  for (const worker of plan.workers || []) add(worker.membershipId, worker.name, worker.visits);
  for (const obstacle of plan.obstacles || []) add(obstacle.membershipId, obstacle.name, obstacle.visits);

  let sheets = [...byWorker.values()];
  if (membershipId) sheets = sheets.filter((sheet) => sheet.membershipId === membershipId);
  sheets = sheets
    .map((sheet) => ({ ...sheet, visits: [...sheet.visits].sort((a, b) => a.startMinute - b.startMinute) }))
    .filter((sheet) => sheet.visits.length)
    .sort((a, b) => a.workerName.localeCompare(b.workerName, "et"));
  if (!membershipId && withUnassigned) {
    const open = [...live(plan.unassigned), ...live(plan.uncovered)].sort((a, b) => a.startMinute - b.startMinute);
    if (open.length) sheets.push({ membershipId: null, workerName: null, visits: open });
  }
  return sheets;
}

/** Päevaleht prinditava dokumendina: `day` ja soovi korral `membershipId` (ühe töötaja leht). */
export async function getDaySheet(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  const body = asObject(input);
  const membershipId = normalizeOptionalId(body.membershipId, "home_care.errors.day_sheet_worker");
  /* `getDayPlan` kontrollib mooduli, hooldusjuhi õiguse ja skoobi. */
  const plan = await getDayPlan(context, { day: body.day }, { db, now, env });
  const sheets = sheetsOfPlan(plan, { membershipId });
  if (!sheets.length) throw badRequest("home_care.errors.day_sheet_empty");

  const organizationId = context.organization.id;
  const clientIds = [...new Set(sheets.flatMap((sheet) => sheet.visits.map((visit) => visit.client.id)))];
  const phones = new Map(
    (await db.careClient.findMany({ where: { organizationId, id: { in: clientIds } }, select: { id: true, contactPhone: true } })).map((row) => [row.id, row.contactPhone || null])
  );
  const cardOf = new Map();
  for (const row of await db.careClientCardLine.findMany({
    where: { clientId: { in: clientIds }, endedAt: null },
    select: { clientId: true, kind: true, text: true },
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  })) {
    if (!cardOf.has(row.clientId)) cardOf.set(row.clientId, []);
    cardOf.get(row.clientId).push({ kind: row.kind, text: row.text });
  }
  const planOf = new Map();
  for (const row of await db.carePlan.findMany({
    where: { clientId: { in: clientIds }, status: CarePlanStatus.ACTIVE },
    select: { clientId: true, lines: { select: { activityName: true, position: true }, orderBy: { position: "asc" } } }
  })) {
    planOf.set(row.clientId, row.lines.map((line) => line.activityName).filter(Boolean));
  }

  const html = renderDaySheetHtml({
    organizationName: context.organization.displayName || "",
    day: plan.day,
    weekday: plan.weekday,
    locale: context.organization.defaultLocale || "et",
    sheets: sheets.map((sheet) => ({
      workerName: sheet.workerName,
      visits: sheet.visits.map((visit) => ({
        startMinute: visit.startMinute,
        plannedMinutes: visit.plannedMinutes,
        clientName: visit.client.displayName,
        address: visit.client.address || null,
        phone: phones.get(visit.client.id) || null,
        priority: visit.priority || null,
        note: visit.note || null,
        key: visit.key || null,
        cardLines: cardOf.get(visit.client.id) || [],
        activities: planOf.get(visit.client.id) || [],
        /* Kliendi kavas on ravimitoiming (käigu ravimiseis on olemas ainult siis). */
        medication: Boolean(visit.medication)
      }))
    }))
  });

  const visitCount = sheets.reduce((sum, sheet) => sum + sheet.visits.length, 0);
  await writeOrgAudit(db, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_DAY_SHEET_ISSUED,
    resourceType: OrgAuditResource.CARE_DAY_SHEET,
    resourceId: organizationId,
    /* Ainult arvud ja (ühe töötaja lehe puhul) töötaja liikmesus: kliendid ja aadressid auditisse ei lähe. */
    meta: { organizationId, membershipId: membershipId || undefined, day: plan.day, rowCount: visitCount, clientCount: clientIds.length }
  });
  return { html, day: plan.day, sheetCount: sheets.length, visitCount };
}
