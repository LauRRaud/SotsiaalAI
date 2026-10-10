/**
 * KODUTEENUS K6-e — kliendi kuuleht (kava II.6.9: „kuu kokkuvõte ei ole allkiri").
 *
 * Koduteenuse saajal ei ole ekraani ja tema allkirja iga käigu alla keegi ei küsi. Selle
 * asemel saab ta kord kuus lehe: „Septembris käisime teie juures 9 korral, kokku 11 tundi;
 * kui see ei klapi, helistage." See on teatavaks tegemine: inimene ja tema lähedane näevad,
 * mida asutus on kirja pannud, ja saavad vaidlustada enne, kui arvud linnale lähevad.
 *
 * Lehed koostab hooldusjuht (oma ulatuses) kuu lehelt kõigi klientide kohta korraga või
 * kliendi lehelt ühe kohta. Leht tehakse päevikust nii, nagu see koostamise hetkel on:
 * tühistamata käigu kirjed, „uks ei avanenud" ja „keeldus abist" juhtumid ning päevaplaanis
 * ette ära jäetud käigud. Midagi ei salvestata; väljaandmisest jääb auditirida ilma nimedeta.
 * Telefoninumbri annab koostaja kaasa nagu külmkapilehel; seda ei hoita.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, forbidden, notFound } from "../org/errors.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { monthRange, monthText, resolveCallMonth, shiftMonth } from "./calls.js";
import { CareEntryKind, CareVisitChangeKind, HOME_CARE_COORDINATOR, HOME_CARE_LIMITS } from "./constants.js";
import { todayText } from "./decisions.js";
import { renderMonthStatementsHtml } from "./monthStatementDocument.js";
import { phoneHref } from "./phone.js";
import { MISSED_VISIT_TYPES, VISIT_RECORD } from "./provided.js";
import { asObject, normalizeId, normalizeLine } from "./validation.js";

const PHONE_PATTERN = /^[0-9+() -]+$/;

function dayLabel(day) {
  const [year, month, date] = day.split("-");
  return `${date}.${month}.${year}`;
}

/** `AAAA-KK`, „previous" (viimane lõppenud kuu), „current" või tühi (= käesolev kuu). */
export function resolveStatementMonth(value, now, timeZone) {
  if (value === "previous") return shiftMonth(resolveCallMonth(null, now, timeZone), -1);
  if (value === "current") return resolveCallMonth(null, now, timeZone);
  return resolveCallMonth(value, now, timeZone);
}

/**
 * Read klientide kaupa lehtedeks. `clients` annab järjekorra; käigud ja ära jäänud käigud on
 * lehel päeva järgi. Sama päeva ära jäänud käik ja juhtum jäävad mõlemad sisse: need on kaks
 * eri asja (üks öeldi ette ära, teisel mindi kohale). Puhas funktsioon.
 */
export function buildStatements(clients, { visits = [], missed = [], cancelled = [] } = {}) {
  const sheets = new Map(clients.map((client) => [client.id, { clientId: client.id, clientName: client.displayName, visits: [], notHappened: [] }]));
  for (const row of visits) sheets.get(row.clientId)?.visits.push({ day: row.day, minutes: row.minutes ?? null, workerName: row.workerName || null });
  for (const row of missed) sheets.get(row.clientId)?.notHappened.push({ day: row.day, reason: row.type });
  for (const row of cancelled) sheets.get(row.clientId)?.notHappened.push({ day: row.day, reason: row.reason || "OTHER" });
  const byDay = (a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0);
  return [...sheets.values()].map((sheet) => ({ ...sheet, visits: sheet.visits.sort(byDay), notHappened: sheet.notHappened.sort(byDay) }));
}

function normalizePart(value) {
  if (value === undefined || value === null || value === "") return 1;
  const part = Number(value);
  if (!Number.isInteger(part) || part < 1) throw badRequest("home_care.errors.month_statement_part");
  return part;
}

export async function getMonthStatements(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const body = asObject(input);
  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const month = resolveStatementMonth(body.month, now, timeZone);
  const name = monthText(month.year, month.month);
  const fromDay = `${name}-01`;
  const lastDay = `${name}-${String(new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()).padStart(2, "0")}`;
  const today = todayText(now, timeZone);
  if (fromDay > today) throw badRequest("home_care.errors.month_statement_future");

  const phone = normalizeLine(body.phone, HOME_CARE_LIMITS.REFERRAL_PHONE_MAX) || null;
  if (phone && (!PHONE_PATTERN.test(phone) || !phoneHref(phone))) throw badRequest("home_care.errors.referral_phone_invalid");
  const clientId = body.clientId === undefined || body.clientId === null || body.clientId === "" ? null : normalizeId(body.clientId, "home_care.errors.client_not_found");
  const part = normalizePart(body.part);

  const unitScope = scope.wholeOrg ? {} : { unitId: { in: scope.unitIds } };
  const clientScope = scope.wholeOrg ? {} : { client: unitScope };
  const entryWhere = { organizationId, occurredAt: monthRange(month, timeZone), retractedAt: null };
  const missedWhere = { kind: CareEntryKind.INCIDENT, incidentType: { in: [...MISSED_VISIT_TYPES] } };
  const cancelledWhere = { organizationId, kind: CareVisitChangeKind.CANCELLED, day: { gte: fromDay, lte: lastDay } };

  let clients;
  let parts = 1;
  if (clientId) {
    /* Ühe kliendi leht tehakse ka siis, kui sel kuul ei käidud: ka see on teadmine, mida inimene saab vaidlustada. */
    const row = await db.careClient.findFirst({ where: { id: clientId, organizationId, ...unitScope }, select: { id: true, displayName: true } });
    if (!row) throw notFound("home_care.errors.client_not_found");
    if (part !== 1) throw badRequest("home_care.errors.month_statement_part");
    clients = [row];
  } else {
    /* Kõigi kohta korraga: ainult kliendid, kellel sel kuul oli käik või ära jäänud käik. */
    const withEntries = await db.careClientEntry.groupBy({
      by: ["clientId"],
      where: { ...entryWhere, ...clientScope, OR: [{ OR: VISIT_RECORD.OR }, missedWhere] }
    });
    const withCancelled = await db.careVisitChange.groupBy({ by: ["clientId"], where: { ...cancelledWhere, ...clientScope } });
    const ids = [...new Set([...withEntries, ...withCancelled].map((row) => row.clientId))];
    if (!ids.length) throw badRequest("home_care.errors.month_statement_empty");
    const all = await db.careClient.findMany({
      where: { organizationId, ...unitScope, id: { in: ids } },
      select: { id: true, displayName: true },
      orderBy: [{ displayName: "asc" }, { id: "asc" }]
    });
    const size = HOME_CARE_LIMITS.MONTH_STATEMENT_CLIENTS;
    parts = Math.max(1, Math.ceil(all.length / size));
    if (part > parts) throw badRequest("home_care.errors.month_statement_part");
    clients = all.slice((part - 1) * size, part * size);
  }

  const ids = clients.map((client) => client.id);
  const visitRows = await db.careClientEntry.findMany({
    where: { ...entryWhere, clientId: { in: ids }, OR: VISIT_RECORD.OR },
    select: { clientId: true, occurredAt: true, visitMinutes: true, authorName: true },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.MONTH_STATEMENT_ROWS_MAX + 1
  });
  /* Poolikut lehte välja ei anta: kui ridu on üle piiri, tehakse lehed kliendi kaupa. */
  if (visitRows.length > HOME_CARE_LIMITS.MONTH_STATEMENT_ROWS_MAX) throw badRequest("home_care.errors.month_statement_too_large");
  const missedRows = await db.careClientEntry.findMany({
    where: { ...entryWhere, clientId: { in: ids }, ...missedWhere },
    select: { clientId: true, occurredAt: true, incidentType: true },
    orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.MONTH_STATEMENT_ROWS_MAX
  });
  const cancelledRows = await db.careVisitChange.findMany({
    where: { ...cancelledWhere, clientId: { in: ids } },
    select: { clientId: true, day: true, reason: true },
    orderBy: [{ day: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.MONTH_STATEMENT_ROWS_MAX
  });

  const statements = buildStatements(clients, {
    visits: visitRows.map((row) => ({ clientId: row.clientId, day: todayText(row.occurredAt, timeZone), minutes: row.visitMinutes, workerName: row.authorName })),
    missed: missedRows.map((row) => ({ clientId: row.clientId, day: todayText(row.occurredAt, timeZone), type: row.incidentType })),
    cancelled: cancelledRows
  });
  const html = renderMonthStatementsHtml({
    organizationName: context.organization.displayName || "",
    month: name,
    phone,
    composedOn: dayLabel(today),
    locale: context.organization.defaultLocale || "et",
    statements
  });

  await writeOrgAudit(db, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_MONTH_STATEMENT_ISSUED,
    resourceType: OrgAuditResource.CARE_MONTH_STATEMENT,
    resourceId: organizationId,
    /* Ainult kuu ja arvud (ühe kliendi lehe puhul kliendi ID): nimed ja lehe sisu auditisse ei lähe. */
    meta: { organizationId, clientId: clientId || undefined, month: name, rowCount: visitRows.length, clientCount: clients.length }
  });
  return { html, month: name, clientCount: clients.length, part, parts };
}
