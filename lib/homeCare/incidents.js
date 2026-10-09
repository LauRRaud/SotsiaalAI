/**
 * KODUTEENUS K1-b — erijuhtumite register ja juhtumi käik.
 *
 * REGISTER on hooldusjuhi vaade: kõik erijuhtumid tema skoobis, lahtised ees.
 * Kaebused ja tänud on samas registris oma liigina.
 *
 * KÄIK (`CareIncidentUpdate`) on juhtumi ajajoon pärast kirja panemist:
 * täiendused, seisumuutused ja vastutaja määramised. Kirjet ennast täiendusega
 * ei muudeta; käiku lisandub uus rida ja read on muutmatud.
 *
 * KES MIDA NÄEB. Hooldusjuht näeb kogu käiku. Autor näeb oma täiendusi, aga
 * mitte hooldusjuhi ridu: seal võib olla info, mis ei ole kogu meeskonna jaoks
 * (kellele teatati, keda kahtlustatakse). Teised meeskonnaliikmed näevad
 * erijuhtumit päevikus, käiku mitte.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";
import { decodePageCursor, descendingCursorWhere, normalizePageSize, toCursorPage } from "../org/pagination.js";
import { localDateTimeToUtc, shiftLocalDate } from "../time/estonianDay.js";

import {
  assertHomeCareContext,
  coordinatorScope,
  membershipDisplayName,
  organizationTimeZone,
  recordClientOpen,
  requireClientAccess,
  requireClientCoordinator
} from "./access.js";
import {
  CARE_INCIDENT_FILTERS,
  CARE_INCIDENT_TYPES,
  CareClientStatus,
  CareEntryKind,
  CareIncidentFilter,
  CareIncidentStatus,
  CareIncidentUpdateKind,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { ENTRY_SELECT, requireVisibleEntry, serializeEntry } from "./entries.js";
import { listCoordinatorMemberships, notifyCoordinatorsOfEntry, notifyIncidentAssignee } from "./notify.js";
import { asObject, normalizeEnum, normalizeId, normalizeIsoDay, normalizeOptionalId, normalizeText } from "./validation.js";

const UPDATE_SELECT = Object.freeze({
  id: true,
  kind: true,
  text: true,
  fromStatus: true,
  toStatus: true,
  assigneeName: true,
  actorName: true,
  byCoordinator: true,
  createdAt: true
});

function serializeUpdate(row) {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text || null,
    fromStatus: row.fromStatus || null,
    toStatus: row.toStatus || null,
    assigneeName: row.assigneeName || null,
    actorName: row.actorName,
    byCoordinator: Boolean(row.byCoordinator),
    createdAt: new Date(row.createdAt).toISOString()
  };
}

function statusWhere(filter) {
  if (filter === CareIncidentFilter.CLOSED) return { incidentStatus: CareIncidentStatus.CLOSED };
  if (filter === CareIncidentFilter.ACTIVE) {
    return { incidentStatus: { in: [CareIncidentStatus.OPEN, CareIncidentStatus.IN_REVIEW] } };
  }
  return {};
}

function dayRangeWhere(context, from, to) {
  const timeZone = organizationTimeZone(context);
  const fromDay = normalizeIsoDay(from);
  const toDay = normalizeIsoDay(to);
  if (!fromDay && !toDay) return {};
  const range = {};
  if (fromDay) range.gte = localDateTimeToUtc(fromDay, timeZone);
  if (toDay) range.lt = localDateTimeToUtc(shiftLocalDate(toDay, 1), timeZone);
  if (range.gte && range.lt && range.gte >= range.lt) throw badRequest("home_care.errors.invalid_date");
  return { occurredAt: range };
}

/**
 * Erijuhtumite register hooldusjuhi skoobis. Tühistatud erijuhtumid registris ei
 * ole (need on kliendi päevikus ja parandusjäljes).
 */
export async function listIncidents(context, rawQuery = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });

  const query = asObject(rawQuery);
  const filter = normalizeEnum(query.status, CARE_INCIDENT_FILTERS, "home_care.errors.invalid_incident_status", {
    fallback: CareIncidentFilter.ACTIVE
  });
  const type = query.type
    ? normalizeEnum(query.type, CARE_INCIDENT_TYPES, "home_care.errors.invalid_incident_type")
    : null;
  const clientId = normalizeOptionalId(query.clientId, "home_care.errors.client_not_found");
  const pageSize = normalizePageSize(query.take, HOME_CARE_LIMITS.INCIDENTS_PAGE, HOME_CARE_LIMITS.ENTRIES_PAGE_MAX);
  const cursor = decodePageCursor(query.cursor, { dateKeys: ["occurredAt"], stringKeys: ["id"] });

  const organizationId = context.organization.id;
  const base = {
    organizationId,
    kind: CareEntryKind.INCIDENT,
    retractedAt: null,
    ...(scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } })
  };
  const and = [statusWhere(filter), dayRangeWhere(context, query.from, query.to)];
  if (type) and.push({ incidentType: type });
  if (clientId) and.push({ clientId });
  const cursorWhere = descendingCursorWhere(cursor, ["occurredAt", "id"]);
  if (cursorWhere) and.push(cursorWhere);

  const rows = await db.careClientEntry.findMany({
    where: { ...base, AND: and },
    select: {
      ...ENTRY_SELECT,
      client: { select: { id: true, displayName: true, status: true } },
      _count: { select: { reads: true, incidentUpdates: true } }
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });
  const page = toCursorPage(rows, pageSize, (row) => ({ occurredAt: row.occurredAt, id: row.id }));

  /* Loendurid on kogu skoobi kohta, mitte filtri kohta: vahekaardi pealkiri
     „Lahtised (3)" peab kehtima ka siis, kui parajasti vaadatakse suletuid. */
  const grouped = await db.careClientEntry.groupBy({
    by: ["incidentStatus"],
    where: base,
    _count: { _all: true }
  });
  const counts = { OPEN: 0, IN_REVIEW: 0, CLOSED: 0 };
  for (const row of grouped) {
    const key = row.incidentStatus || CareIncidentStatus.OPEN;
    if (key in counts) counts[key] += row._count._all;
  }

  const viewerMembershipId = context.membership?.id || null;
  return {
    items: page.items.map((row) => ({
      ...serializeEntry(row, { viewerMembershipId }),
      client: { id: row.client.id, displayName: row.client.displayName, status: row.client.status },
      updateCount: row._count?.incidentUpdates ?? 0
    })),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
    counts,
    filter
  };
}

/** Erijuhtum SELLE kliendi all, mida see vaataja näeb. Muu on 404 või 400. */
async function requireIncident(tx, context, access, entryId) {
  const entry = await requireVisibleEntry(tx, context, access, entryId);
  if (entry.kind !== CareEntryKind.INCIDENT) throw badRequest("home_care.errors.not_an_incident");
  return entry;
}

function isAuthor(context, entry) {
  return Boolean(entry.authorMembershipId && entry.authorMembershipId === context.membership?.id);
}

/** Juhtumi käik. Hooldusjuht näeb kõike, autor ainult oma täiendusi. */
export async function getIncidentTrail(
  context,
  clientId,
  entryId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireIncident(tx, context, access, entryKey);
    if (!access.isCoordinator && !isAuthor(context, entry)) throw forbidden("home_care.errors.entry_not_editable");
    await recordClientOpen(tx, context, access, { now });

    const rows = await tx.careIncidentUpdate.findMany({
      where: {
        entryId: entry.id,
        clientId: id,
        ...(access.isCoordinator ? {} : { byCoordinator: false, actorMembershipId: context.membership?.id || "" })
      },
      select: UPDATE_SELECT,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }]
    });
    return {
      entry: serializeEntry(entry, { viewerMembershipId: context.membership?.id || null }),
      updates: rows.map(serializeUpdate),
      isCoordinator: access.isCoordinator
    };
  });
}

/**
 * Täiendus erijuhtumile: autor või hooldusjuht. Kirje tekst ei muutu; uus info
 * läheb käiku. Autori täienduse kohta saab hooldusjuht teate.
 */
export async function addIncidentUpdate(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env, notify = notifyCoordinatorsOfEntry } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const text = normalizeText(asObject(input).text, HOME_CARE_LIMITS.INCIDENT_UPDATE_MAX, { required: true });
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  const result = await db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireIncident(tx, context, access, entryKey);
    if (!access.isCoordinator && !isAuthor(context, entry)) throw forbidden("home_care.errors.entry_not_editable");
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    if (access.client.status === CareClientStatus.ENDED && !access.isCoordinator) {
      throw conflict("home_care.errors.client_ended");
    }

    const row = await tx.careIncidentUpdate.create({
      data: {
        organizationId,
        clientId: id,
        entryId: entry.id,
        kind: CareIncidentUpdateKind.NOTE,
        text,
        actorMembershipId: membershipId,
        actorName: await membershipDisplayName(tx, context),
        byCoordinator: access.isCoordinator,
        createdAt: now
      },
      select: UPDATE_SELECT
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_INCIDENT_UPDATED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id }
    });
    return { update: serializeUpdate(row), byCoordinator: access.isCoordinator, unitId: access.client.unitId || null };
  });

  if (!result.byCoordinator && notify) {
    await notify(
      {
        entryId: entryKey,
        organizationId,
        unitId: result.unitId,
        kind: CareEntryKind.INCIDENT,
        actorMembershipId: membershipId,
        /* Iga täiendus on omaette teade: muidu jääks teine täiendus esimese
           teate varju. */
        dedupeSuffix: `update:${result.update.id}`
      },
      { db, now }
    );
  }
  return { update: result.update };
}

/** Kes saab selle kliendi erijuhtumi eest vastutada: hooldusjuhid, kelle skoobis klient on. */
export async function listIncidentAssignees(
  context,
  clientId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    const coordinators = await listCoordinatorMemberships(tx, {
      organizationId: context.organization.id,
      unitId: access.client.unitId || null,
      now
    });
    return {
      assignees: coordinators
        .map((row) => ({ membershipId: row.membershipId, name: row.name }))
        .sort((a, b) => a.name.localeCompare(b.name, "et"))
    };
  });
}

/**
 * Vastutaja määramine. Vastutaja peab olema hooldusjuht, kelle skoobis klient on:
 * muidu jääks juhtum inimese kätte, kes seda avada ei saa. `membershipId: null`
 * võtab vastutaja maha.
 */
export async function assignIncident(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env, notify = notifyIncidentAssignee } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const assigneeId = normalizeOptionalId(asObject(input).membershipId, "home_care.errors.invalid_member");
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  const result = await db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    const entry = await requireIncident(tx, context, access, entryKey);
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    if ((entry.incidentAssigneeMembershipId || null) === assigneeId) {
      return { entry: serializeEntry(entry, { viewerMembershipId: membershipId }), changed: false, updateId: null };
    }

    let assigneeName = null;
    if (assigneeId) {
      const coordinators = await listCoordinatorMemberships(tx, {
        organizationId,
        unitId: access.client.unitId || null,
        now
      });
      const assignee = coordinators.find((row) => row.membershipId === assigneeId);
      if (!assignee) throw badRequest("home_care.errors.invalid_member");
      assigneeName = assignee.name || null;
    }

    const changed = await tx.careClientEntry.updateMany({
      where: {
        id: entry.id,
        clientId: id,
        retractedAt: null,
        incidentAssigneeMembershipId: entry.incidentAssigneeMembershipId || null
      },
      data: { incidentAssigneeMembershipId: assigneeId, incidentAssigneeName: assigneeName }
    });
    if (changed.count !== 1) throw conflict("home_care.errors.entry_changed");

    const update = await tx.careIncidentUpdate.create({
      data: {
        organizationId,
        clientId: id,
        entryId: entry.id,
        kind: CareIncidentUpdateKind.ASSIGNED,
        assigneeMembershipId: assigneeId,
        assigneeName,
        actorMembershipId: membershipId,
        actorName: await membershipDisplayName(tx, context),
        byCoordinator: true,
        createdAt: now
      },
      select: { id: true }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_INCIDENT_ASSIGNED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id, membershipId: assigneeId }
    });

    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: membershipId }), changed: true, updateId: update.id };
  });

  if (result.changed && assigneeId && notify) {
    await notify(
      {
        entryId: entryKey,
        organizationId,
        assigneeMembershipId: assigneeId,
        actorMembershipId: membershipId,
        dedupeSuffix: `assigned:${result.updateId}`
      },
      { db, now }
    );
  }
  return { entry: result.entry };
}

/**
 * Üks erijuhtum registri kujul (kliendiga). Kasutab registrileht, kui see
 * avatakse teavitusest ja juhtum ei pruugi olla esimesel lehel.
 */
export async function getIncident(context, entryId, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");

  const row = await db.careClientEntry.findFirst({
    where: {
      id: entryKey,
      organizationId: context.organization.id,
      kind: CareEntryKind.INCIDENT,
      ...(scope.wholeOrg ? {} : { client: { unitId: { in: scope.unitIds } } })
    },
    select: {
      ...ENTRY_SELECT,
      client: { select: { id: true, displayName: true, status: true } },
      _count: { select: { reads: true, incidentUpdates: true } }
    }
  });
  if (!row) throw notFound("home_care.errors.entry_not_found");
  return {
    ...serializeEntry(row, { viewerMembershipId: context.membership?.id || null }),
    client: { id: row.client.id, displayName: row.client.displayName, status: row.client.status },
    updateCount: row._count?.incidentUpdates ?? 0
  };
}

/**
 * Kuhu teavituse link viib. Teavituse aadressis on ainult kirje ID; siin
 * otsustatakse SELLE vaataja õiguse järgi, kas ja kuhu ta jõuab. Avamisjälge
 * siin ei kirjutata: selle kirjutab sihtleht.
 *
 * @returns {{ clientId: string, kind: string, isCoordinator: boolean }}
 */
export async function locateEntryForViewer(context, entryId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");

  return db.$transaction(async (tx) => {
    const found = await tx.careClientEntry.findFirst({
      where: { id: entryKey, organizationId: context.organization.id },
      select: { clientId: true }
    });
    if (!found) throw notFound("home_care.errors.entry_not_found");
    const access = await requireClientAccess(tx, context, found.clientId, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    return { clientId: entry.clientId, kind: entry.kind, isCoordinator: access.isCoordinator };
  });
}
