/**
 * KODUTEENUS K1 — klient organisatsioonis: kirje, meeskond, püsikaart, avamine.
 *
 * Teenuse kuju on sama mis `lib/org/*`: esimene argument on organisatsiooni
 * kontekst (`resolveOrgAccessContext`), viimane `{ db, now, env }`. Marsruudis
 * ei ole äriloogikat. Iga muudatus ja selle auditirida on ühes tehingus.
 *
 * LOGISSE EI LÄHE kliendi nimi, aadress, kontakt, kaardirea ega põhjuse tekst.
 * Auditi `meta` kannab ainult ID-sid ja koode.
 */

import prisma from "@/lib/prisma";

import { OrgAuditAction, OrgAuditResource, writeOrgAudit } from "../org/audit.js";
import { OrganizationMembershipStatus } from "../org/constants.js";
import { badRequest, conflict, forbidden, notFound } from "../org/errors.js";

import {
  assertHomeCareContext,
  coordinatorScope,
  isCareWorker,
  isCoordinatorFor,
  membershipDisplayName,
  personName,
  reasonAccessValidUntil,
  recordClientOpen,
  requireClientAccess,
  requireClientCoordinator,
  visibleClientsWhere
} from "./access.js";
import {
  CARE_CLIENT_STATUSES,
  CareAccessBasis,
  CareClientStatus,
  HOME_CARE_COORDINATOR,
  HOME_CARE_LIMITS
} from "./constants.js";
import { hasHiddenConcernWithin, listEntriesWithin, markHandoversReadWithin } from "./entries.js";
import { listHistoriesWithin } from "./importedHistory.js";
import {
  asObject,
  normalizeAccessReasonInput,
  normalizeCardLineInput,
  normalizeClientInput,
  normalizeEnum,
  normalizeId,
  normalizeSearchQuery,
  normalizeStatusInput,
  normalizeVersion
} from "./validation.js";

const CLIENT_LIST_SELECT = Object.freeze({
  id: true,
  displayName: true,
  internalCode: true,
  address: true,
  status: true,
  statusNote: true,
  unitId: true
});

const CLIENT_DETAIL_SELECT = Object.freeze({
  id: true,
  organizationId: true,
  unitId: true,
  displayName: true,
  internalCode: true,
  address: true,
  contactPhone: true,
  contactNote: true,
  status: true,
  statusNote: true,
  statusChangedAt: true,
  version: true,
  createdAt: true,
  updatedAt: true
});

const CARD_LINE_SELECT = Object.freeze({ id: true, kind: true, text: true, position: true, createdAt: true });

function iso(value) {
  return value ? new Date(value).toISOString() : null;
}

function serializeListClient(row) {
  return {
    id: row.id,
    displayName: row.displayName,
    internalCode: row.internalCode || null,
    address: row.address || null,
    status: row.status,
    statusNote: row.statusNote || null,
    unitId: row.unitId || null
  };
}

function serializeClient(row) {
  return {
    id: row.id,
    unitId: row.unitId || null,
    displayName: row.displayName,
    internalCode: row.internalCode || null,
    address: row.address || null,
    contactPhone: row.contactPhone || null,
    contactNote: row.contactNote || null,
    status: row.status,
    statusNote: row.statusNote || null,
    statusChangedAt: iso(row.statusChangedAt),
    version: row.version,
    createdAt: iso(row.createdAt),
    updatedAt: iso(row.updatedAt)
  };
}

function serializeCardLine(row) {
  return { id: row.id, kind: row.kind, text: row.text, position: row.position, createdAt: iso(row.createdAt) };
}

/** Kas see inimene tohib hallata kliente selles üksuses (või kogu asutuses)? */
export function assertCoordinatorForUnit(context, unitId) {
  if (!isCoordinatorFor(context, unitId)) {
    throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  }
}

/**
 * Kaks samaaegset salvestust sama tunnusega: eelkontroll laseb mõlemad läbi ja
 * kaotaja saab andmebaasilt unikaalsusvea. See on 409, mitte 500. Püüame
 * VÄLJASPOOL tehingut, sest Postgres on vea järel tehingu juba katkestanud.
 */
async function withInternalCodeConflict(run) {
  try {
    return await run();
  } catch (error) {
    if (error?.code === "P2002") throw conflict("home_care.errors.internal_code_taken");
    throw error;
  }
}

/** Üksus peab kuuluma sellesse asutusse; kehast tulnud ID-d ei usaldata. */
export async function requireOrgUnit(tx, context, unitId) {
  if (!unitId) return null;
  const unit = await tx.organizationUnit.findFirst({
    where: { id: unitId, organizationId: context.organization.id, status: "ACTIVE" },
    select: { id: true }
  });
  if (!unit) throw badRequest("home_care.errors.invalid_unit");
  return unit.id;
}

/* -------------------------------------------------------------------------- */
/* Loend ja otsing                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Minu kliendid: hooldusjuhile tema skoobi kliendid, hooldajale need, kelle
 * meeskonnas ta on. Õiguseta liikmele TÜHI loend, mitte viga.
 */
export async function listClients(context, { status } = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const coordinator = Boolean(coordinatorScope(context));
  const scopeWhere = visibleClientsWhere(context);
  if (!scopeWhere) return { clients: [], isCoordinator: false, canSearch: false };

  const statuses = status
    ? [normalizeEnum(status, CARE_CLIENT_STATUSES, "home_care.errors.invalid_status")]
    : [CareClientStatus.ACTIVE, CareClientStatus.AWAY];

  const rows = await db.careClient.findMany({
    where: { ...scopeWhere, status: { in: statuses } },
    select: CLIENT_LIST_SELECT,
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: 500
  });
  return {
    clients: rows.map(serializeListClient),
    isCoordinator: coordinator,
    canSearch: coordinator || rows.length > 0 || (await isCareWorker(db, context))
  };
}

/**
 * Otsing nime järgi üle kogu asutuse. Ainult hooldajale (vt `isCareWorker`).
 * Tulemus kannab AINULT nime, seisu ja seda, kas leht avaneb kohe või põhjusega:
 * aadress, kontakt ja kaart avanevad alles lehel.
 */
export async function searchClients(context, input = {}, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const query = normalizeSearchQuery(asObject(input).q);
  if (!(await isCareWorker(db, context))) return { clients: [] };

  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;
  const rows = await db.careClient.findMany({
    where: {
      organizationId,
      status: { in: [CareClientStatus.ACTIVE, CareClientStatus.AWAY] },
      displayName: { contains: query, mode: "insensitive" }
    },
    select: {
      id: true,
      displayName: true,
      status: true,
      unitId: true,
      team: { where: { membershipId: membershipId || "", endedAt: null }, select: { id: true } }
    },
    orderBy: [{ displayName: "asc" }, { id: "asc" }],
    take: HOME_CARE_LIMITS.SEARCH_RESULTS
  });

  return {
    clients: rows.map((row) => ({
      id: row.id,
      displayName: row.displayName,
      status: row.status,
      needsReason: !(isCoordinatorFor(context, row.unitId) || row.team.length > 0)
    }))
  };
}

/**
 * Üksused, kuhu see hooldusjuht tohib klienti panna. Kogu asutuse hooldusjuht
 * võib jätta üksuse valimata; üksuse hooldusjuht peab valima oma alampuust.
 */
export async function listClientUnitOptions(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const scope = coordinatorScope(context);
  if (!scope) return { units: [], unitRequired: false };
  const rows = await db.organizationUnit.findMany({
    where: {
      organizationId: context.organization.id,
      status: "ACTIVE",
      ...(scope.wholeOrg ? {} : { id: { in: scope.unitIds } })
    },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 200
  });
  return { units: rows.map((row) => ({ id: row.id, name: row.name })), unitRequired: !scope.wholeOrg };
}

/* -------------------------------------------------------------------------- */
/* Kliendi loomine ja muutmine (hooldusjuht)                                   */
/* -------------------------------------------------------------------------- */

export async function createClient(context, input = {}, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const data = normalizeClientInput(input);
  assertCoordinatorForUnit(context, data.unitId || null);
  const organizationId = context.organization.id;

  return withInternalCodeConflict(() => db.$transaction(async (tx) => {
    const unitId = await requireOrgUnit(tx, context, data.unitId);

    if (data.internalCode) {
      const taken = await tx.careClient.findFirst({
        where: { organizationId, internalCode: data.internalCode },
        select: { id: true }
      });
      if (taken) throw conflict("home_care.errors.internal_code_taken");
    }

    return { client: await createClientRow(tx, context, data, unitId, { now }) };
  }));
}

/**
 * Kliendi rida ja selle auditirida ühes tehingus. Kasutavad üksiku kliendi
 * loomine ja nimekirja sissetoomine (`clientImport.js`): kliendi sünd peab
 * mõlemal teel jätma sama jälje. Õigust ja tunnuse kordumatust kontrollib kutsuja.
 */
export async function createClientRow(tx, context, data, unitId, { now = new Date() } = {}) {
  const organizationId = context.organization.id;
  const created = await tx.careClient.create({
    data: {
      organizationId,
      unitId,
      displayName: data.displayName,
      internalCode: data.internalCode || null,
      address: data.address || null,
      contactPhone: data.contactPhone || null,
      contactNote: data.contactNote || null,
      status: CareClientStatus.ACTIVE,
      statusChangedAt: now,
      createdByMembershipId: context.membership?.id || null
    },
    select: CLIENT_DETAIL_SELECT
  });

  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_CLIENT_CREATED,
    resourceType: OrgAuditResource.CARE_CLIENT,
    resourceId: created.id,
    meta: { organizationId, clientId: created.id, unitId }
  });
  return serializeClient(created);
}

export async function updateClient(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const version = normalizeVersion(asObject(input).version);
  const data = normalizeClientInput(input, { partial: true });
  const organizationId = context.organization.id;

  return withInternalCodeConflict(() => db.$transaction(async (tx) => {
    const { client } = await requireClientCoordinator(tx, context, id, { lock: true, now });
    /* Üksust kontrollime ainult siis, kui see MUUTUB. Arhiveeritud üksuses
       kliendi telefoninumbrit peab saama parandada ilma üksust vahetamata. */
    if (data.unitId !== undefined) {
      if ((data.unitId || null) === (client.unitId || null)) {
        delete data.unitId;
      } else {
        assertCoordinatorForUnit(context, data.unitId || null);
        data.unitId = await requireOrgUnit(tx, context, data.unitId);
      }
    }
    if (data.internalCode) {
      const taken = await tx.careClient.findFirst({
        where: { organizationId, internalCode: data.internalCode, NOT: { id } },
        select: { id: true }
      });
      if (taken) throw conflict("home_care.errors.internal_code_taken");
    }

    const result = await tx.careClient.updateMany({
      where: { id, organizationId, version },
      data: { ...data, version: { increment: 1 } }
    });
    if (result.count !== 1) {
      throw conflict("home_care.errors.version_conflict", { currentVersion: client.version });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_CLIENT_UPDATED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId, clientId: id }
    });
    const fresh = await tx.careClient.findFirst({ where: { id, organizationId }, select: CLIENT_DETAIL_SELECT });
    return { client: serializeClient(fresh) };
  }));
}

export async function setClientStatus(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const version = normalizeVersion(asObject(input).version);
  const { status, statusNote } = normalizeStatusInput(input);
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    const { client } = await requireClientCoordinator(tx, context, id, { lock: true, now });
    const result = await tx.careClient.updateMany({
      where: { id, organizationId, version },
      data: { status, statusNote, statusChangedAt: now, version: { increment: 1 } }
    });
    if (result.count !== 1) {
      throw conflict("home_care.errors.version_conflict", { currentVersion: client.version });
    }

    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_CLIENT_STATUS_CHANGED,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId, clientId: id, fromStatus: client.status, toStatus: status }
    });
    const fresh = await tx.careClient.findFirst({ where: { id, organizationId }, select: CLIENT_DETAIL_SELECT });
    return { client: serializeClient(fresh) };
  });
}

/* -------------------------------------------------------------------------- */
/* Kliendi leht                                                               */
/* -------------------------------------------------------------------------- */

async function loadTeam(tx, clientId) {
  const rows = await tx.careClientTeamMember.findMany({
    where: { clientId, endedAt: null },
    select: {
      id: true,
      membershipId: true,
      startedAt: true,
      membership: {
        select: {
          status: true,
          jobTitle: true,
          user: { select: { profile: { select: { firstName: true, lastName: true } } } }
        }
      }
    },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }]
  });
  return rows.map((row) => ({
    membershipId: row.membershipId,
    name: personName(row.membership),
    active: row.membership?.status === OrganizationMembershipStatus.ACTIVE,
    since: iso(row.startedAt)
  }));
}

async function loadCard(tx, clientId) {
  const rows = await tx.careClientCardLine.findMany({
    where: { clientId, endedAt: null },
    select: CARD_LINE_SELECT,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }]
  });
  return rows.map(serializeCardLine);
}

/** „Viimati avasid": iga töötaja viimane avamine, uuemad eespool. */
async function loadRecentOpeners(tx, clientId) {
  const rows = await tx.careClientAccess.findMany({
    where: { clientId },
    select: { membershipId: true, actorName: true, basis: true, createdAt: true },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 60
  });
  const seen = new Set();
  const openers = [];
  for (const row of rows) {
    if (seen.has(row.membershipId)) continue;
    seen.add(row.membershipId);
    openers.push({ name: row.actorName, basis: row.basis, at: iso(row.createdAt) });
    if (openers.length >= HOME_CARE_LIMITS.RECENT_OPENERS) break;
  }
  return openers;
}

/**
 * Avab kliendi lehe: kirje, püsikaart, meeskond, viimased avajad ja kirjete
 * esimene leht. AVAMISE JÄLG kirjutatakse samas tehingus enne sisu tagastamist;
 * kui jälge ei saa kirjutada, sisu ei väljastata.
 */
export async function openClient(context, clientId, { db = prisma, now = new Date(), env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");

  return db.$transaction(async (tx) => {
    const access = await requireClientAccess(tx, context, id, { now });
    await recordClientOpen(tx, context, access, { now });

    /* Järjest, mitte Promise.all: tehingul on üks ühendus. */
    const client = await tx.careClient.findFirst({
      where: { id, organizationId: context.organization.id },
      select: CLIENT_DETAIL_SELECT
    });
    const card = await loadCard(tx, id);
    const team = await loadTeam(tx, id);
    const openers = await loadRecentOpeners(tx, id);
    const entries = await listEntriesWithin(tx, context, access, {});
    await markHandoversReadWithin(tx, context, access, entries.items, { now });
    const talkToCoordinator = await hasHiddenConcernWithin(tx, context, access, { now });
    /* Varasem ajalugu teisest kohast: ainult loend, tekst laaditakse nõudmisel. */
    const histories = await listHistoriesWithin(tx, context, id);

    return {
      client: serializeClient(client),
      card,
      team,
      recentOpeners: openers,
      entries,
      histories,
      talkToCoordinator,
      access: {
        basis: access.basis,
        isCoordinator: access.isCoordinator,
        isTeam: access.isTeam,
        /* Kaarti muudavad meeskond ja hooldusjuht; põhjusega avaja loeb. */
        canEditCard: access.isCoordinator || access.isTeam,
        canWrite: Boolean(context.writable),
        membershipId: context.membership?.id || null
      }
    };
  });
}

/**
 * Meeskonda mittekuuluv hooldaja annab põhjuse ja saab loa, mis kehtib asutuse
 * kalendripäeva lõpuni. Luba on avamislogi rida; eraldi auditirida läheb ka
 * asutuse auditisse (ainult kood, mitte vabatekst).
 */
export async function openClientWithReason(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const { reasonCode, reason } = normalizeAccessReasonInput(input);
  const organizationId = context.organization.id;
  const membershipId = context.membership?.id;

  return db.$transaction(async (tx) => {
    const client = await tx.careClient.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true }
    });
    if (
      !client ||
      !membershipId ||
      client.status === CareClientStatus.ENDED ||
      !(await isCareWorker(tx, context))
    ) {
      throw notFound("home_care.errors.client_not_found");
    }

    const validUntil = reasonAccessValidUntil(context, now);
    await tx.careClientAccess.create({
      data: {
        organizationId,
        clientId: id,
        membershipId,
        actorName: await membershipDisplayName(tx, context),
        basis: CareAccessBasis.REASON,
        reasonCode,
        reason,
        validUntil,
        createdAt: now
      },
      select: { id: true }
    });
    await writeOrgAudit(tx, {
      actorUserId: context.userId,
      action: OrgAuditAction.HOME_CARE_CLIENT_OPENED_WITH_REASON,
      resourceType: OrgAuditResource.CARE_CLIENT,
      resourceId: id,
      meta: { organizationId, clientId: id, membershipId, reasonCode }
    });
    return { ok: true, validUntil: validUntil.toISOString() };
  });
}

/* -------------------------------------------------------------------------- */
/* Meeskond (hooldusjuht)                                                     */
/* -------------------------------------------------------------------------- */

export async function addTeamMember(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const membershipId = normalizeId(asObject(input).membershipId, "home_care.errors.invalid_member");
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });

    /* Liikmesus peab olema SELLE asutuse aktiivne liikmesus. Kehast tulnud ID
       üksi ei tõenda midagi. */
    const member = await tx.organizationMembership.findFirst({
      where: { id: membershipId, organizationId, status: OrganizationMembershipStatus.ACTIVE },
      select: { id: true }
    });
    if (!member) throw badRequest("home_care.errors.invalid_member");

    /* Kordus ei ole viga: osaline unikaalindeks lubab ühe aktiivse rea ja
       `skipDuplicates` jätab tehingu terveks (vt `lib/org/inbox.js`). */
    const { count } = await tx.careClientTeamMember.createMany({
      data: [
        {
          clientId: id,
          membershipId,
          startedAt: now,
          addedByMembershipId: context.membership?.id || null
        }
      ],
      skipDuplicates: true
    });
    if (count === 1) {
      await writeOrgAudit(tx, {
        actorUserId: context.userId,
        action: OrgAuditAction.HOME_CARE_TEAM_MEMBER_ADDED,
        resourceType: OrgAuditResource.CARE_CLIENT,
        resourceId: id,
        meta: { organizationId, clientId: id, membershipId }
      });
    }
    return { team: await loadTeam(tx, id) };
  });
}

export async function removeTeamMember(
  context,
  clientId,
  membershipId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const memberId = normalizeId(membershipId, "home_care.errors.invalid_member");
  const organizationId = context.organization.id;

  return db.$transaction(async (tx) => {
    await requireClientCoordinator(tx, context, id, { lock: true, now });
    const result = await tx.careClientTeamMember.updateMany({
      where: { clientId: id, membershipId: memberId, endedAt: null },
      data: { endedAt: now, endedByMembershipId: context.membership?.id || null }
    });
    if (result.count > 0) {
      await writeOrgAudit(tx, {
        actorUserId: context.userId,
        action: OrgAuditAction.HOME_CARE_TEAM_MEMBER_REMOVED,
        resourceType: OrgAuditResource.CARE_CLIENT,
        resourceId: id,
        meta: { organizationId, clientId: id, membershipId: memberId }
      });
    }
    return { team: await loadTeam(tx, id) };
  });
}

/** Liikmete valik meeskonna koostamiseks: ainult nimi, mitte liikmehalduse vaade. */
export async function listTeamCandidates(context, { db = prisma, env = process.env } = {}) {
  assertHomeCareContext(context, { env });
  if (!coordinatorScope(context)) {
    throw forbidden("org.errors.missing_capability", { capability: HOME_CARE_COORDINATOR });
  }
  const rows = await db.organizationMembership.findMany({
    where: { organizationId: context.organization.id, status: OrganizationMembershipStatus.ACTIVE },
    select: {
      id: true,
      jobTitle: true,
      user: { select: { profile: { select: { firstName: true, lastName: true } } } }
    },
    orderBy: [{ startedAt: "asc" }]
  });
  return { members: rows.map((row) => ({ membershipId: row.id, name: personName(row) })) };
}

/* -------------------------------------------------------------------------- */
/* Püsikaart „enne kui lähed"                                                  */
/* -------------------------------------------------------------------------- */

async function requireCardEditor(tx, context, clientId, now) {
  const access = await requireClientAccess(tx, context, clientId, { lock: true, now });
  /* Põhjusega avaja näeb kaarti, aga ei muuda seda: kaart on meeskonna ühine
     kokkulepe ja ühekordne asendaja ei tea, mis seal kehtib. */
  if (!access.isCoordinator && !access.isTeam) throw forbidden("home_care.errors.card_team_only");
  return access;
}

async function writeCardAudit(tx, context, clientId) {
  await writeOrgAudit(tx, {
    actorUserId: context.userId,
    action: OrgAuditAction.HOME_CARE_CARD_CHANGED,
    resourceType: OrgAuditResource.CARE_CLIENT,
    resourceId: clientId,
    meta: { organizationId: context.organization.id, clientId }
  });
}

export async function addCardLine(
  context,
  clientId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const data = normalizeCardLineInput(input);

  return db.$transaction(async (tx) => {
    await requireCardEditor(tx, context, id, now);
    const active = await tx.careClientCardLine.findMany({
      where: { clientId: id, endedAt: null },
      select: { position: true }
    });
    if (active.length >= HOME_CARE_LIMITS.CARD_LINES_MAX) {
      throw conflict("home_care.errors.card_full", { limit: HOME_CARE_LIMITS.CARD_LINES_MAX });
    }
    const position = active.reduce((max, row) => Math.max(max, row.position), -1) + 1;
    await tx.careClientCardLine.create({
      data: {
        clientId: id,
        kind: data.kind,
        text: data.text,
        position,
        addedByMembershipId: context.membership?.id || null,
        createdAt: now
      },
      select: { id: true }
    });
    await writeCardAudit(tx, context, id);
    return { card: await loadCard(tx, id) };
  });
}

/** Rea muutmine: vana rida lõpetatakse, uus tuleb samale kohale. */
export async function replaceCardLine(
  context,
  clientId,
  lineId,
  input = {},
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const line = normalizeId(lineId, "home_care.errors.card_line_not_found");
  const data = normalizeCardLineInput(input);

  return db.$transaction(async (tx) => {
    await requireCardEditor(tx, context, id, now);
    /* Vanem-ID ristkontroll: rida peab kuuluma SELLELE kliendile. */
    const current = await tx.careClientCardLine.findFirst({
      where: { id: line, clientId: id, endedAt: null },
      select: { id: true, position: true }
    });
    if (!current) throw notFound("home_care.errors.card_line_not_found");

    const ended = await tx.careClientCardLine.updateMany({
      where: { id: line, clientId: id, endedAt: null },
      data: { endedAt: now, endedByMembershipId: context.membership?.id || null }
    });
    if (ended.count !== 1) throw conflict("home_care.errors.card_changed");
    await tx.careClientCardLine.create({
      data: {
        clientId: id,
        kind: data.kind,
        text: data.text,
        position: current.position,
        addedByMembershipId: context.membership?.id || null,
        createdAt: now
      },
      select: { id: true }
    });
    await writeCardAudit(tx, context, id);
    return { card: await loadCard(tx, id) };
  });
}

export async function endCardLine(
  context,
  clientId,
  lineId,
  { db = prisma, now = new Date(), env = process.env } = {}
) {
  assertHomeCareContext(context, { env });
  const id = normalizeId(clientId, "home_care.errors.client_not_found");
  const line = normalizeId(lineId, "home_care.errors.card_line_not_found");

  return db.$transaction(async (tx) => {
    await requireCardEditor(tx, context, id, now);
    const ended = await tx.careClientCardLine.updateMany({
      where: { id: line, clientId: id, endedAt: null },
      data: { endedAt: now, endedByMembershipId: context.membership?.id || null }
    });
    if (ended.count !== 1) throw notFound("home_care.errors.card_line_not_found");
    await writeCardAudit(tx, context, id);
    return { card: await loadCard(tx, id) };
  });
}
