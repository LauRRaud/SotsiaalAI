/**
 * KODUTEENUS K1 — kliendi päevik.
 *
 * KIRJET EI KUSTUTATA. Parandus ja tühistus kirjutavad asendatud sisu
 * `CareClientEntryRevision`-i ENNE muudatust samas tehingus (muster:
 * `lib/casework/caseWorkMeetingNote.js`), põhjus on kohustuslik.
 *
 * KORDUSSAATMINE EI TEKITA TEIST KIRJET. Seade genereerib `clientRequestId`
 * enne esimest katset ja hoiab seda korduskatsel; sama võti + sama sisu annab
 * sama kirje, sama võti + muu sisu on 409. Sama alus kannab hiljem võrguta tööd.
 *
 * NÄHTAVUS. `coordinatorOnly` kirjet näevad autor ja hooldusjuht. Filter on
 * päringu `where`-is, mitte järelkontroll.
 */

import { Prisma } from "../../generated/prisma/client.ts";
import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";
import { decodePageCursor, descendingCursorWhere, normalizePageSize, toCursorPage } from "../org/pagination.js";
import { localDateTimeToUtc, shiftLocalDate } from "../time/estonianDay.js";

import {
  assertHomeCareContext,
  membershipDisplayName,
  personName,
  requireClientAccess,
  requireClientCoordinator
} from "./access.js";
import {
  CARE_ENTRY_KINDS,
  COORDINATOR_ONLY_INCIDENT_TYPES,
  CareAccessBasis,
  CareClientStatus,
  CareEntryKind,
  CareIncidentStatus,
  CareRevisionKind,
  HOME_CARE_LIMITS
} from "./constants.js";
import {
  entryRequestHash,
  normalizeEntryInput,
  normalizeEnum,
  normalizeId,
  normalizeIncidentStatusInput,
  normalizeIsoDay,
  normalizeReason,
  normalizeRequestId
} from "./validation.js";

const ENTRY_SELECT = Object.freeze({
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
  companionMembershipId: true,
  companionName: true,
  incidentType: true,
  incidentAssessment: true,
  incidentActions: true,
  incidentStatus: true,
  incidentResolvedAt: true,
  incidentResolutionNote: true,
  revision: true,
  retractedAt: true,
  clientRequestId: true,
  requestSha256: true,
  createdAt: true,
  _count: { select: { reads: true } }
});

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

/**
 * Kas kirje kirjutati märgatavalt pärast sündmust? Arvutatakse SERVERIS:
 * võrdluseks on seadme kirjutamisaeg (võrguta järjekorras oodanud kirje ei ole
 * hiline), selle puudumisel serveri oma.
 */
function writtenLater(row) {
  const writtenAt = row.deviceCreatedAt || row.createdAt;
  if (!writtenAt || !row.occurredAt) return false;
  return new Date(writtenAt).getTime() - new Date(row.occurredAt).getTime() > HOME_CARE_LIMITS.WRITTEN_LATER_MS;
}

export function serializeEntry(row, { viewerMembershipId = null } = {}) {
  const retracted = Boolean(row.retractedAt);
  return {
    id: row.id,
    clientId: row.clientId,
    kind: row.kind,
    contactMode: row.contactMode,
    /* Tühistatud kirje tekst ei ole aktiivsel pinnal; see on parandusjäljes. */
    text: retracted ? null : row.text,
    coordinatorOnly: Boolean(row.coordinatorOnly),
    occurredAt: iso(row.occurredAt),
    createdAt: iso(row.createdAt),
    writtenLater: writtenLater(row),
    authorName: row.authorName,
    isMine: Boolean(viewerMembershipId && row.authorMembershipId === viewerMembershipId),
    companionMembershipId: row.companionMembershipId || null,
    companionName: row.companionName || null,
    incident:
      row.kind === CareEntryKind.INCIDENT
        ? {
            type: row.incidentType,
            assessment: retracted ? null : row.incidentAssessment || null,
            actions: Array.isArray(row.incidentActions) ? row.incidentActions : [],
            status: row.incidentStatus || CareIncidentStatus.OPEN,
            resolvedAt: iso(row.incidentResolvedAt),
            resolutionNote: row.incidentResolutionNote || null
          }
        : null,
    revision: row.revision,
    corrected: row.revision > 1 && !retracted,
    retractedAt: iso(row.retractedAt),
    readCount: row._count?.reads ?? 0
  };
}

/** Mida see vaataja kliendi päevikust näeb. */
function visibilityWhere(context, access) {
  if (access.isCoordinator) return {};
  const membershipId = context.membership?.id || "";
  return { OR: [{ coordinatorOnly: false }, { authorMembershipId: membershipId }] };
}

function dayRangeWhere(context, { from, to }) {
  const timeZone = context.organization.timezone || undefined;
  const fromDay = normalizeIsoDay(from);
  const toDay = normalizeIsoDay(to);
  if (!fromDay && !toDay) return {};
  const range = {};
  if (fromDay) range.gte = localDateTimeToUtc(fromDay, timeZone);
  /* „Kuni" on kaasav kalendripäev: piir on JÄRGMISE päeva algus asutuse
     ajavööndis, mitte +24 h (kellakeeramise päev on 23 või 25 tundi). */
  if (toDay) range.lt = localDateTimeToUtc(shiftLocalDate(toDay, 1), timeZone);
  if (range.gte && range.lt && range.gte >= range.lt) throw badRequest("home_care.errors.invalid_date");
  return { occurredAt: range };
}

/**
 * Kirjete leht juba avatud tehingus. Õigus on otsustatud kutsuja poolel
 * (`access` tuleb `requireClientAccess`-ist).
 */
export async function listEntriesWithin(tx, context, access, query = {}) {
  const pageSize = normalizePageSize(query.take, HOME_CARE_LIMITS.ENTRIES_PAGE, HOME_CARE_LIMITS.ENTRIES_PAGE_MAX);
  const cursor = decodePageCursor(query.cursor, { dateKeys: ["occurredAt"], stringKeys: ["id"] });
  const kind = query.kind ? normalizeEnum(query.kind, CARE_ENTRY_KINDS, "home_care.errors.invalid_entry_kind") : null;

  const and = [visibilityWhere(context, access), dayRangeWhere(context, query)];
  const cursorWhere = descendingCursorWhere(cursor, ["occurredAt", "id"]);
  if (cursorWhere) and.push(cursorWhere);

  const rows = await tx.careClientEntry.findMany({
    where: {
      clientId: access.client.id,
      organizationId: context.organization.id,
      ...(kind ? { kind } : {}),
      AND: and
    },
    select: ENTRY_SELECT,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: pageSize + 1
  });

  const page = toCursorPage(rows, pageSize, (row) => ({ occurredAt: row.occurredAt, id: row.id }));
  const viewerMembershipId = context.membership?.id || null;
  return {
    items: page.items.map((row) => serializeEntry(row, { viewerMembershipId })),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor
  };
}

export async function listEntries(context, clientId, query = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const page = await listEntriesWithin(tx, context, access, query);
    await markHandoversReadWithin(tx, context, access, page.items, { now });
    return page;
  });
}

/**
 * Lugemismärk teatele järgmisele. Hooldusjuhi lugemist EI LOETA: küsimus on,
 * kas teade jõudis järgmise hooldajani, mitte kas juht seda nägi.
 */
export async function markHandoversReadWithin(tx, context, access, items, { now = new Date() } = {}) {
  const membershipId = context.membership?.id;
  if (!membershipId || access.basis === CareAccessBasis.COORDINATOR) return 0;
  const unread = items.filter(
    (item) => item.kind === CareEntryKind.HANDOVER && !item.isMine && !item.retractedAt
  );
  if (!unread.length) return 0;
  const { count } = await tx.careClientEntryRead.createMany({
    data: unread.map((item) => ({ entryId: item.id, membershipId, readAt: now })),
    skipDuplicates: true
  });
  return count;
}

async function resolveCompanion(tx, context, companionMembershipId) {
  if (!companionMembershipId) return { companionMembershipId: null, companionName: null };
  if (companionMembershipId === context.membership?.id) throw badRequest("home_care.errors.invalid_companion");
  const row = await tx.organizationMembership.findFirst({
    where: {
      id: companionMembershipId,
      organizationId: context.organization.id,
      status: OrganizationMembershipStatus.ACTIVE
    },
    select: { id: true, jobTitle: true, user: { select: { profile: { select: { firstName: true, lastName: true } } } } }
  });
  if (!row) throw badRequest("home_care.errors.invalid_companion");
  return { companionMembershipId: row.id, companionName: personName(row) || null };
}

function isCoordinatorOnly(data) {
  if (data.kind === CareEntryKind.CONCERN) return true;
  return data.kind === CareEntryKind.INCIDENT && COORDINATOR_ONLY_INCIDENT_TYPES.includes(data.incidentType);
}

/**
 * Lisab kirje. Kirjutada tohib igaüks, kes klienti parajasti näeb (meeskond,
 * hooldusjuht, täna põhjusega avanud asendaja): käigu teinud inimene peab
 * saama selle kirja panna.
 */
export async function createEntry(context, clientId, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeEntryInput(input, { now });
  const clientRequestId = normalizeRequestId(input.clientRequestId);
  const requestSha256 = entryRequestHash(id, data);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  if (!membershipId) throw notFound("home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    /* Lõpetatud teenuse päevik on loetav. Hilinenud viimase kirje lisab
       hooldusjuht, et lõpetatud kliendi alla ei tekiks märkamatult uut tööd.
       ERAND on kordussaatmine: kirje, mis salvestus enne lõpetamist ja mille
       vastus seadmeni ei jõudnud, peab ka nüüd vastama „salvestatud". */
    if (access.client.status === CareClientStatus.ENDED && !access.isCoordinator) {
      const repeat = clientRequestId
        ? await tx.careClientEntry.findFirst({
            where: { authorMembershipId: membershipId, clientRequestId },
            select: ENTRY_SELECT
          })
        : null;
      if (!repeat || repeat.clientId !== id || repeat.requestSha256 !== requestSha256) {
        throw conflict("home_care.errors.client_ended");
      }
      return { entry: serializeEntry(repeat, { viewerMembershipId: membershipId }), created: false };
    }
    const companion = await resolveCompanion(tx, context, data.companionMembershipId);
    const authorName = await membershipDisplayName(tx, context);

    const row = {
      organizationId,
      clientId: id,
      authorMembershipId: membershipId,
      authorName,
      kind: data.kind,
      contactMode: data.contactMode,
      text: data.text,
      coordinatorOnly: isCoordinatorOnly(data),
      occurredAt: data.occurredAt,
      deviceCreatedAt: data.deviceCreatedAt,
      companionMembershipId: companion.companionMembershipId,
      companionName: companion.companionName,
      incidentType: data.incidentType,
      incidentAssessment: data.incidentAssessment,
      incidentActions: data.incidentActions ?? undefined,
      incidentStatus: data.kind === CareEntryKind.INCIDENT ? CareIncidentStatus.OPEN : null,
      clientRequestId,
      requestSha256,
      createdAt: now
    };

    if (!clientRequestId) {
      const created = await tx.careClientEntry.create({ data: row, select: ENTRY_SELECT });
      return { entry: serializeEntry(created, { viewerMembershipId: membershipId }), created: true };
    }

    /* IDEMPOTENTSUS ON KIRJUTAMISE TULEMUS, mitte eelnev lugemine (vt
       `lib/org/inbox.js`): `create` + `catch (P2002)` keeraks Postgresis kogu
       tehingu katki. `skipDuplicates` jätab tehingu terveks ja `count` ütleb,
       kas see päring kirjutas. Otsing sisaldab AUTORIT, muidu saaks võõra
       võtmega kätte võõra kirje. */
    const { count } = await tx.careClientEntry.createMany({ data: [row], skipDuplicates: true });
    const stored = await tx.careClientEntry.findFirst({
      where: { authorMembershipId: membershipId, clientRequestId },
      select: ENTRY_SELECT
    });
    if (!stored) throw conflict("home_care.errors.save_failed");
    if (count === 0 && (stored.clientId !== id || stored.requestSha256 !== requestSha256)) {
      throw conflict("home_care.errors.idempotency_conflict");
    }
    return { entry: serializeEntry(stored, { viewerMembershipId: membershipId }), created: count === 1 };
  });
}

/** Kirje, mida see vaataja näeb, SELLE kliendi all. Muu on 404. */
async function requireVisibleEntry(tx, context, access, entryId) {
  const entry = await tx.careClientEntry.findFirst({
    where: {
      id: entryId,
      clientId: access.client.id,
      organizationId: context.organization.id,
      AND: [visibilityWhere(context, access)]
    },
    select: ENTRY_SELECT
  });
  if (!entry) throw notFound("home_care.errors.entry_not_found");
  return entry;
}

/** Parandada ja tühistada tohib autor ise ja hooldusjuht. */
function assertEntryEditor(context, access, entry) {
  const isAuthor = entry.authorMembershipId && entry.authorMembershipId === context.membership?.id;
  if (!isAuthor && !access.isCoordinator) throw forbidden("home_care.errors.entry_not_editable");
}

function revisionSnapshot(entry) {
  const snapshot = {};
  if (entry.companionName) snapshot.companionName = entry.companionName;
  if (entry.incidentType) snapshot.incidentType = entry.incidentType;
  if (entry.incidentAssessment) snapshot.incidentAssessment = entry.incidentAssessment;
  if (entry.incidentActions) snapshot.incidentActions = entry.incidentActions;
  if (entry.coordinatorOnly) snapshot.coordinatorOnly = true;
  return Object.keys(snapshot).length ? snapshot : undefined;
}

async function writeRevision(tx, context, entry, { kind, reason, now }) {
  await tx.careClientEntryRevision.create({
    data: {
      entryId: entry.id,
      clientId: entry.clientId,
      kind,
      text: entry.text,
      entryKind: entry.kind,
      contactMode: entry.contactMode,
      occurredAt: entry.occurredAt,
      snapshot: revisionSnapshot(entry),
      revision: entry.revision,
      reason,
      actorMembershipId: context.membership.id,
      actorName: await membershipDisplayName(tx, context),
      createdAt: now
    },
    select: { id: true }
  });
}

export async function correctEntry(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const reason = normalizeReason(input.reason);
  const data = normalizeEntryInput(input, { now });
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    /* Erijuhtumi liiki ei saa parandusega tavaliseks kirjeks muuta ega
       vastupidi: registri rida ei tohi vaikselt kaduda ega tekkida. */
    if ((entry.kind === CareEntryKind.INCIDENT) !== (data.kind === CareEntryKind.INCIDENT)) {
      throw badRequest("home_care.errors.incident_kind_fixed");
    }
    /* Muutmata „kaasas" jääb alles ka siis, kui kolleegi liikmesus on vahepeal
       lõppenud: parandus ei tohi kirjelt ajaloolist fakti maha võtta. */
    const companion =
      data.companionMembershipId && data.companionMembershipId === entry.companionMembershipId
        ? { companionMembershipId: entry.companionMembershipId, companionName: entry.companionName }
        : await resolveCompanion(tx, context, data.companionMembershipId);

    await writeRevision(tx, context, entry, { kind: CareRevisionKind.CORRECTION, reason, now });
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, revision: entry.revision, retractedAt: null },
      data: {
        kind: data.kind,
        contactMode: data.contactMode,
        text: data.text,
        coordinatorOnly: isCoordinatorOnly(data),
        occurredAt: data.occurredAt,
        companionMembershipId: companion.companionMembershipId,
        companionName: companion.companionName,
        incidentType: data.incidentType,
        incidentAssessment: data.incidentAssessment,
        /* JSON-veeru tühjendamine vajab selget DbNull-i; `undefined` jätaks vana
           väärtuse alles ja parandus ei eemaldaks eksikombel märgitud sammu. */
        incidentActions: data.incidentActions ?? Prisma.DbNull,
        revision: entry.revision + 1
      }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_ENTRY_CORRECTED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }) };
  });
}

export async function retractEntry(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const reason = normalizeReason(input.reason);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");

    await writeRevision(tx, context, entry, { kind: CareRevisionKind.RETRACTION, reason, now });
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, revision: entry.revision, retractedAt: null },
      data: { retractedAt: now, revision: entry.revision + 1 }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_ENTRY_RETRACTED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }) };
  });
}

/** Kirje parandusjälg autorile ja hooldusjuhile. */
export async function listEntryRevisions(
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
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    assertEntryEditor(context, access, entry);
    const rows = await tx.careClientEntryRevision.findMany({
      where: { entryId: entry.id, clientId: id },
      select: {
        id: true,
        kind: true,
        text: true,
        entryKind: true,
        contactMode: true,
        occurredAt: true,
        revision: true,
        reason: true,
        actorName: true,
        createdAt: true
      },
      orderBy: [{ revision: "desc" }, { id: "desc" }]
    });
    return {
      revisions: rows.map((row) => ({
        id: row.id,
        kind: row.kind,
        text: row.text,
        entryKind: row.entryKind,
        contactMode: row.contactMode,
        occurredAt: iso(row.occurredAt),
        revision: row.revision,
        reason: row.reason,
        actorName: row.actorName,
        createdAt: iso(row.createdAt)
      }))
    };
  });
}

/** Erijuhtumi seisu muudab hooldusjuht. */
export async function setIncidentStatus(
  context,
  clientId,
  entryId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const entryKey = normalizeId(entryId, "home_care.errors.entry_not_found");
  const { status, note } = normalizeIncidentStatusInput(input);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const access = await requireClientCoordinator(tx, context, id, { now });
    const entry = await requireVisibleEntry(tx, context, access, entryKey);
    if (entry.kind !== CareEntryKind.INCIDENT) throw badRequest("home_care.errors.not_an_incident");
    if (entry.retractedAt) throw conflict("home_care.errors.entry_retracted");
    const fromStatus = entry.incidentStatus || CareIncidentStatus.OPEN;
    if (fromStatus === status) {
      return { entry: serializeEntry(entry, { viewerMembershipId: context.membership?.id || null }) };
    }

    const closing = status === CareIncidentStatus.CLOSED;
    const result = await tx.careClientEntry.updateMany({
      where: { id: entry.id, clientId: id, incidentStatus: entry.incidentStatus, retractedAt: null },
      data: {
        incidentStatus: status,
        incidentResolvedAt: closing ? now : null,
        incidentResolvedByMembershipId: closing ? context.membership?.id || null : null,
        incidentResolutionNote: note ?? (closing ? null : entry.incidentResolutionNote)
      }
    });
    if (result.count !== 1) throw conflict("home_care.errors.entry_changed");

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_INCIDENT_STATUS_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT_ENTRY,
      resourceId: entry.id,
      meta: { organizationId, clientId: id, entryId: entry.id, fromStatus, toStatus: status }
    });
    const fresh = await tx.careClientEntry.findFirst({ where: { id: entry.id, clientId: id }, select: ENTRY_SELECT });
    return { entry: serializeEntry(fresh, { viewerMembershipId: context.membership?.id || null }) };
  });
}

/**
 * Kas kliendil on värske mure, mida see vaataja ei näe? Siis näitab leht rida
 * „enne käiku räägi hooldusjuhiga" (kava II.6.7), ilma sisu avaldamata.
 */
export async function hasHiddenConcernWithin(tx, context, access, { now = new Date() } = {}) {
  if (access.isCoordinator) return false;
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const row = await tx.careClientEntry.findFirst({
    where: {
      clientId: access.client.id,
      organizationId: context.organization.id,
      kind: CareEntryKind.CONCERN,
      retractedAt: null,
      createdAt: { gte: since },
      NOT: { authorMembershipId: context.membership?.id || "" }
    },
    select: { id: true }
  });
  return Boolean(row);
}
