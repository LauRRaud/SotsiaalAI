import { createHash } from "node:crypto";

import { prisma as defaultPrisma } from "../prisma.js";

const DEFAULT_MINIMUM_GROUP_SIZE = 3;
const allowedScopeTypes = new Set(["municipality", "organization", "role_group"]);

function splitList(value) {
  if (Array.isArray(value)) return value;
  return String(value || "").split(",");
}

function compactUnique(values, normalize = (value) => value) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function cleanText(value) {
  const text = String(value || "").trim();
  return text || null;
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeMinimumGroupSize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_MINIMUM_GROUP_SIZE;
  const integer = Math.trunc(number);
  return integer >= DEFAULT_MINIMUM_GROUP_SIZE ? integer : DEFAULT_MINIMUM_GROUP_SIZE;
}

function normalizeRoleGroups(value) {
  return compactUnique(splitList(value), (item) => String(item || "").trim());
}

function normalizeViewerEmails(value) {
  return compactUnique(splitList(value), normalizeEmail);
}

function normalizeScopeType(value) {
  const scopeType = String(value || "role_group").trim();
  return allowedScopeTypes.has(scopeType) ? scopeType : "role_group";
}

export function normalizeWellbeingPilotScopeInput(input = {}) {
  const name = cleanText(input.name);
  if (!name) {
    const error = new Error("wellbeing.pilot.name_required");
    error.status = 400;
    throw error;
  }

  const roleGroups = normalizeRoleGroups(input.roleGroups);
  if (roleGroups.length === 0) {
    const error = new Error("wellbeing.pilot.role_group_missing");
    error.status = 400;
    throw error;
  }

  return {
    name,
    scopeType: normalizeScopeType(input.scopeType),
    municipalityId: cleanText(input.municipalityId),
    organizationId: cleanText(input.organizationId),
    roleGroups,
    viewerEmails: normalizeViewerEmails(input.viewerEmails),
    minimumGroupSize: normalizeMinimumGroupSize(input.minimumGroupSize),
    active: input.active == null ? true : Boolean(input.active),
    startsAt: normalizeDate(input.startsAt),
    endsAt: normalizeDate(input.endsAt)
  };
}

export function serializeWellbeingPilotScope(scope = {}) {
  const viewers = Array.isArray(scope.viewers) ? scope.viewers : [];
  const viewerEmails = Array.isArray(scope.viewerEmails)
    ? compactUnique(scope.viewerEmails, normalizeEmail)
    : compactUnique(viewers.map((viewer) => viewer.email), normalizeEmail);
  return {
    id: scope.id,
    name: scope.name,
    scopeType: scope.scopeType || "role_group",
    municipalityId: scope.municipalityId || null,
    organizationId: scope.organizationId || null,
    roleGroups: Array.isArray(scope.roleGroups) ? scope.roleGroups : [],
    minimumGroupSize: normalizeMinimumGroupSize(scope.minimumGroupSize),
    active: scope.active !== false,
    startsAt: scope.startsAt || null,
    endsAt: scope.endsAt || null,
    viewerEmails
  };
}

export function serializeWellbeingPilotAccessScope(scope = {}) {
  const serialized = serializeWellbeingPilotScope(scope);
  return {
    id: serialized.id,
    name: serialized.name,
    scopeType: serialized.scopeType,
    municipalityId: serialized.municipalityId,
    organizationId: serialized.organizationId,
    roleGroups: serialized.roleGroups,
    minimumGroupSize: serialized.minimumGroupSize
  };
}

export function serializeWellbeingPilotViewer(viewer = {}) {
  const user = viewer.user || {};
  return {
    id: viewer.id,
    pilotScopeId: viewer.pilotScopeId,
    userId: viewer.userId || null,
    email: normalizeEmail(viewer.email || user.email),
    claimedAt: viewer.claimedAt || null,
    role: user.role || null,
    isAdmin: Boolean(user.isAdmin),
    emailVerified: Boolean(user.emailVerified)
  };
}

/* SOL-WB-13: „millise skoobi ja künnisega" peab olema hiljem TÕENDATAV, ka siis,
   kui skoopi on vahepeal muudetud. Räsi on kanooniline: väljad järjestatud,
   väärtused normaliseeritud, seega sama konfiguratsioon annab alati sama
   versiooni. Sama muster mis `conditionsHash` kiire abi laual (SOL-URG-12). */
export function wellbeingPilotScopeVersion(scope = {}) {
  const canonical = {
    name: String(scope.name ?? ""),
    scopeType: String(scope.scopeType ?? "role_group"),
    municipalityId: String(scope.municipalityId ?? ""),
    organizationId: String(scope.organizationId ?? ""),
    roleGroups: [...(Array.isArray(scope.roleGroups) ? scope.roleGroups : [])].sort(),
    minimumGroupSize: normalizeMinimumGroupSize(scope.minimumGroupSize),
    active: scope.active !== false,
    startsAt: scope.startsAt ? new Date(scope.startsAt).toISOString() : "",
    endsAt: scope.endsAt ? new Date(scope.endsAt).toISOString() : ""
  };
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

export const WELLBEING_PILOT_AUDIT_ACTIONS = Object.freeze({
  SCOPE_CREATED: "WELLBEING_PILOT_SCOPE_CREATED",
  SCOPE_UPDATED: "WELLBEING_PILOT_SCOPE_UPDATED",
  VIEWER_ADDED: "WELLBEING_PILOT_VIEWER_ADDED",
  VIEWER_REVOKED: "WELLBEING_PILOT_VIEWER_REVOKED",
  VIEWER_CLAIMED: "WELLBEING_PILOT_VIEWER_CLAIMED"
});

function requireActor(actorUserId) {
  const actor = String(actorUserId || "").trim();
  if (!actor) {
    /* SOL-WB-13: tegija on KOHUSTUSLIK. Vaikimisi `null` oleks tähendanud
       „keegi andis kellelegi ligipääsu" — ja täpselt see seis oli enne, sest
       marsruut teadis administraatorit, aga ei andnud teda teenusele edasi. */
    const error = new Error("wellbeing.pilot.actor_required");
    error.status = 400;
    throw error;
  }
  return actor;
}

/* Jälg kirjutatakse PÕHIMUUDATUSEGA SAMAS tehingus: kui audit kukub, ei muutu
   ka õigus. Sisu (koond, arvud, inimeste vastused) siia EI lähe — rida ütleb,
   kes kellele millise skoobi ja künnisega ligipääsu andis või ära võttis. */
async function recordPilotAudit(tx, { action, actorUserId, scopeId, targetUserId = null, meta = {} }) {
  return tx.dataAuditLog.create({
    data: {
      actorUserId,
      targetUserId,
      action,
      resourceType: "WellbeingPilotScope",
      resourceId: scopeId,
      meta
    }
  });
}

export async function listWellbeingPilotScopes(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const scopes = await prisma.wellbeingPilotScope.findMany({
    include: { viewers: true },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
  });
  return scopes.map(serializeWellbeingPilotScope);
}

function inTransaction(prisma, callback) {
  if (typeof prisma?.$transaction !== "function") return callback(prisma);
  return prisma.$transaction(callback);
}

export async function createWellbeingPilotScope(input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const actorUserId = requireActor(options.actorUserId);
  const normalized = normalizeWellbeingPilotScopeInput(input);

  return inTransaction(prisma, async (tx) => {
    const created = await tx.wellbeingPilotScope.create({
      data: {
        name: normalized.name,
        scopeType: normalized.scopeType,
        municipalityId: normalized.municipalityId,
        organizationId: normalized.organizationId,
        roleGroups: normalized.roleGroups,
        minimumGroupSize: normalized.minimumGroupSize,
        active: normalized.active,
        startsAt: normalized.startsAt,
        endsAt: normalized.endsAt,
        viewers: {
          create: normalized.viewerEmails.map((email) => ({ email }))
        }
      },
      include: { viewers: true }
    });

    const scope = serializeWellbeingPilotScope(created);
    await recordPilotAudit(tx, {
      action: WELLBEING_PILOT_AUDIT_ACTIONS.SCOPE_CREATED,
      actorUserId,
      scopeId: scope.id,
      meta: {
        scopeVersion: wellbeingPilotScopeVersion(scope),
        scopeType: scope.scopeType,
        minimumGroupSize: scope.minimumGroupSize,
        roleGroups: scope.roleGroups,
        viewerCount: scope.viewerEmails.length
      }
    });
    return scope;
  });
}

/**
 * SOL-WB-12: skoobi muutmine ja deaktiveerimine.
 *
 * Deaktiveerimine on eraldi rada AINULT nime poolest — ta on sama muudatus
 * (`active: false`) ja käib sama jälje kaudu. Ligipääs kaob KOHE, sest
 * `resolveWellbeingPilotAccess` küsib `active: true` iga päringu peale;
 * vahemälu, mida oleks vaja tühjendada, ei ole.
 */
export async function updateWellbeingPilotScope(pilotScopeId, input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const actorUserId = requireActor(options.actorUserId);
  const scopeId = cleanText(pilotScopeId);
  if (!scopeId) {
    const error = new Error("wellbeing.pilot.scope_missing");
    error.status = 400;
    throw error;
  }

  return inTransaction(prisma, async (tx) => {
    const current = await tx.wellbeingPilotScope.findUnique({
      where: { id: scopeId },
      include: { viewers: true }
    });
    if (!current) {
      const error = new Error("wellbeing.pilot.scope_not_found");
      error.status = 404;
      throw error;
    }

    /* Ainult antud väljad muutuvad: `PATCH`, mitte vaikne täisasendus.
       Puuduv väli tähendab „ära puutu", mitte „tühjenda". */
    const data = {};
    if (input.name !== undefined) {
      const name = cleanText(input.name);
      if (!name) {
        const error = new Error("wellbeing.pilot.name_required");
        error.status = 400;
        throw error;
      }
      data.name = name;
    }
    if (input.roleGroups !== undefined) {
      const roleGroups = normalizeRoleGroups(input.roleGroups);
      if (roleGroups.length === 0) {
        const error = new Error("wellbeing.pilot.role_group_missing");
        error.status = 400;
        throw error;
      }
      data.roleGroups = roleGroups;
    }
    if (input.minimumGroupSize !== undefined) data.minimumGroupSize = normalizeMinimumGroupSize(input.minimumGroupSize);
    if (input.active !== undefined) data.active = Boolean(input.active);
    if (input.startsAt !== undefined) data.startsAt = normalizeDate(input.startsAt);
    if (input.endsAt !== undefined) data.endsAt = normalizeDate(input.endsAt);
    if (input.scopeType !== undefined) data.scopeType = normalizeScopeType(input.scopeType);
    if (input.municipalityId !== undefined) data.municipalityId = cleanText(input.municipalityId);
    if (input.organizationId !== undefined) data.organizationId = cleanText(input.organizationId);

    if (Object.keys(data).length === 0) {
      const error = new Error("wellbeing.pilot.nothing_to_update");
      error.status = 400;
      throw error;
    }

    const updated = await tx.wellbeingPilotScope.update({
      where: { id: scopeId },
      data,
      include: { viewers: true }
    });

    const before = serializeWellbeingPilotScope(current);
    const scope = serializeWellbeingPilotScope(updated);
    await recordPilotAudit(tx, {
      action: WELLBEING_PILOT_AUDIT_ACTIONS.SCOPE_UPDATED,
      actorUserId,
      scopeId,
      meta: {
        /* Kaks versiooni: mille pealt ja mille peale. Väärtusi ennast ei ole
           vaja — muutunud väljade NIMED ütlevad, mida vaadata. */
        fromScopeVersion: wellbeingPilotScopeVersion(before),
        scopeVersion: wellbeingPilotScopeVersion(scope),
        changedFields: Object.keys(data).sort(),
        minimumGroupSize: scope.minimumGroupSize,
        active: scope.active
      }
    });
    return scope;
  });
}

const VIEWER_USER_SELECT = Object.freeze({
  id: true,
  email: true,
  role: true,
  isAdmin: true,
  emailVerified: true
});

export async function addWellbeingPilotViewer(pilotScopeId, input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const actorUserId = requireActor(options.actorUserId);
  const scopeId = cleanText(pilotScopeId);
  const email = normalizeEmail(input.email);
  if (!scopeId || !email) {
    const error = new Error("wellbeing.pilot.viewer_email_required");
    error.status = 400;
    throw error;
  }

  return inTransaction(prisma, async (tx) => {
    const user = await tx.user.findUnique({ where: { email }, select: VIEWER_USER_SELECT });

    /* Konto olemasolul seotakse rida kohe (`claimedAt`): siis kaob ta koos
       kontoga ja e-post ei ole enam iseseisev võti. Konto puudumisel jääb rida
       kutseks ja seotakse esimesel kasutamisel. */
    const claimedAt = user?.id ? new Date() : null;
    const viewer = await tx.wellbeingPilotViewer.upsert({
      where: { pilotScopeId_email: { pilotScopeId: scopeId, email } },
      create: { pilotScopeId: scopeId, email, userId: user?.id || null, claimedAt },
      update: { userId: user?.id || null, claimedAt },
      include: { user: { select: VIEWER_USER_SELECT } }
    });

    await recordPilotAudit(tx, {
      action: WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_ADDED,
      actorUserId,
      scopeId,
      targetUserId: user?.id || null,
      /* E-post on siin SIHT, mitte sisu: ilma temata ei ole tuvastatav, kellele
         ligipääs anti, ja see on kogu jälje mõte. */
      meta: { viewerEmail: email, bound: Boolean(user?.id) }
    });

    return serializeWellbeingPilotViewer(viewer);
  });
}

/**
 * SOL-WB-12: ligipääsu ÄRAVÕTMINE. Ligipääs on luba, mitte ajalugu — rida
 * kustub ja jälg jääb auditisse. Toimib nii seotud (`userId`) kui sidumata
 * (ainult e-post) rea peal, sest võti on skoop + aadress.
 */
export async function removeWellbeingPilotViewer(pilotScopeId, input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const actorUserId = requireActor(options.actorUserId);
  const scopeId = cleanText(pilotScopeId);
  const email = normalizeEmail(input.email);
  if (!scopeId || !email) {
    const error = new Error("wellbeing.pilot.viewer_email_required");
    error.status = 400;
    throw error;
  }

  return inTransaction(prisma, async (tx) => {
    const existing = await tx.wellbeingPilotViewer.findUnique({
      where: { pilotScopeId_email: { pilotScopeId: scopeId, email } },
      include: { user: { select: VIEWER_USER_SELECT } }
    });
    if (!existing) {
      const error = new Error("wellbeing.pilot.viewer_not_found");
      error.status = 404;
      throw error;
    }

    await tx.wellbeingPilotViewer.delete({
      where: { pilotScopeId_email: { pilotScopeId: scopeId, email } }
    });
    await recordPilotAudit(tx, {
      action: WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_REVOKED,
      actorUserId,
      scopeId,
      targetUserId: existing.userId || null,
      meta: { viewerEmail: email, wasClaimed: Boolean(existing.claimedAt) }
    });

    return { revoked: true, viewer: serializeWellbeingPilotViewer(existing) };
  });
}

/**
 * SOL-WB-12: kutse lunastamine. E-posti rida seotakse esimesel kasutamisel
 * konkreetse kontoga; pärast seda e-post enam ei sobitu, seega kustutatud konto
 * aadressile hiljem loodud uus konto ei päri vana vaataja õigust.
 *
 * Kutsuja on lugemisrada, seega tõrge EI TOHI ligipääsu katkestada: sidumata
 * rida töötab edasi täpselt nagu enne, lihtsalt sidumine proovitakse uuesti.
 */
export async function claimWellbeingPilotViewer(viewerId, userId, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const id = cleanText(viewerId);
  const boundUserId = cleanText(userId);
  if (!id || !boundUserId) return null;

  return inTransaction(prisma, async (tx) => {
    /* Tingimuslik: `claimedAt: null` WHERE-is tähendab, et kaks samaaegset
       päringut ei saa rida kaks korda siduda ega teineteise sidumist üle
       kirjutada. */
    const claimed = await tx.wellbeingPilotViewer.updateMany({
      where: { id, claimedAt: null },
      data: { userId: boundUserId, claimedAt: new Date() }
    });
    if (Number(claimed?.count) !== 1) return null;

    const viewer = await tx.wellbeingPilotViewer.findUnique({ where: { id } });
    await recordPilotAudit(tx, {
      action: WELLBEING_PILOT_AUDIT_ACTIONS.VIEWER_CLAIMED,
      /* Lunastaja on siin ise tegija: keegi teine seda sammu ei tee. */
      actorUserId: boundUserId,
      scopeId: viewer?.pilotScopeId || null,
      targetUserId: boundUserId,
      meta: { viewerEmail: normalizeEmail(viewer?.email) }
    });
    return viewer;
  });
}
