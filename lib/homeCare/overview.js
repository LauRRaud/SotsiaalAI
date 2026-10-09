/**
 * KODUTEENUS K1 — hooldusjuhi ülevaade.
 *
 * Kolm küsimust, millele juht hommikul vastust vajab (kava II.8 „Kiht 1"):
 *   1. mida on kirjutatud pärast eilset;
 *   2. millised teated järgmisele ei ole ühegi hooldajani jõudnud;
 *   3. millised erijuhtumid on lahtised.
 *
 * Skoop on hooldusjuhi oma (kogu asutus või tema üksuste alampuu). Ülevaade
 * loeb oma tabeleid; teenuspäeviku päevatahvlit see ei laienda.
 */

import prisma from "@/lib/prisma";

import { forbidden } from "../org/errors.js";
import { localDateTimeToUtc, shiftLocalDate, zonedParts } from "../time/estonianDay.js";

import { assertHomeCareContext, coordinatorScope, organizationTimeZone } from "./access.js";
import { CareEntryKind, CareIncidentStatus, HOME_CARE_COORDINATOR } from "./constants.js";
import { serializeEntry } from "./entries.js";

const OVERVIEW_ENTRY_SELECT = Object.freeze({
  id: true,
  clientId: true,
  authorMembershipId: true,
  authorName: true,
  kind: true,
  contactMode: true,
  text: true,
  coordinatorOnly: true,
  occurredAt: true,
  deviceCreatedAt: true,
  companionName: true,
  incidentType: true,
  incidentAssessment: true,
  incidentActions: true,
  incidentStatus: true,
  incidentResolvedAt: true,
  incidentResolutionNote: true,
  revision: true,
  retractedAt: true,
  createdAt: true,
  client: { select: { id: true, displayName: true, status: true } },
  _count: { select: { reads: true } }
});

const HANDOVER_WINDOW_DAYS = 14;
const RECENT_LIMIT = 100;
const LIST_LIMIT = 100;

function withClient(row, viewerMembershipId) {
  return {
    ...serializeEntry(row, { viewerMembershipId }),
    client: { id: row.client.id, displayName: row.client.displayName, status: row.client.status }
  };
}

/** Eilse päeva algus asutuse ajavööndis (mitte „praegu miinus 24 tundi"). */
export function startOfYesterday(now, timeZone) {
  const today = zonedParts(now, timeZone);
  return localDateTimeToUtc(shiftLocalDate({ year: today.year, month: today.month, day: today.day }, -1), timeZone);
}

export async function getCoordinatorOverview(context, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const organizationId = context.organization.id;
  const timeZone = organizationTimeZone(context);
  const viewerMembershipId = context.membership?.id || null;
  const clientScope = scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } };
  const base = { organizationId, ...clientScope };

  const since = startOfYesterday(now, timeZone);
  const recent = await db.careClientEntry.findMany({
    where: { ...base, createdAt: { gte: since } },
    select: OVERVIEW_ENTRY_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: RECENT_LIMIT + 1
  });

  const handoverSince = new Date(now.getTime() - HANDOVER_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const unreadHandovers = await db.careClientEntry.findMany({
    where: {
      ...base,
      kind: CareEntryKind.HANDOVER,
      retractedAt: null,
      createdAt: { gte: handoverSince },
      reads: { none: {} }
    },
    select: OVERVIEW_ENTRY_SELECT,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: LIST_LIMIT
  });

  const openIncidents = await db.careClientEntry.findMany({
    where: {
      ...base,
      kind: CareEntryKind.INCIDENT,
      retractedAt: null,
      incidentStatus: { in: [CareIncidentStatus.OPEN, CareIncidentStatus.IN_REVIEW] }
    },
    select: OVERVIEW_ENTRY_SELECT,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: LIST_LIMIT
  });

  return {
    since: since.toISOString(),
    recent: recent.slice(0, RECENT_LIMIT).map((row) => withClient(row, viewerMembershipId)),
    recentHasMore: recent.length > RECENT_LIMIT,
    unreadHandovers: unreadHandovers.map((row) => withClient(row, viewerMembershipId)),
    openIncidents: openIncidents.map((row) => withClient(row, viewerMembershipId))
  };
}
