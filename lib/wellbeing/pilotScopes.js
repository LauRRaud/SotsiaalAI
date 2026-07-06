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
    role: user.role || null,
    isAdmin: Boolean(user.isAdmin),
    emailVerified: Boolean(user.emailVerified)
  };
}

export async function listWellbeingPilotScopes(options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const scopes = await prisma.wellbeingPilotScope.findMany({
    include: { viewers: true },
    orderBy: [{ active: "desc" }, { updatedAt: "desc" }]
  });
  return scopes.map(serializeWellbeingPilotScope);
}

export async function createWellbeingPilotScope(input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const normalized = normalizeWellbeingPilotScopeInput(input);
  const created = await prisma.wellbeingPilotScope.create({
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

  return serializeWellbeingPilotScope(created);
}

export async function addWellbeingPilotViewer(pilotScopeId, input = {}, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const scopeId = cleanText(pilotScopeId);
  const email = normalizeEmail(input.email);
  if (!scopeId || !email) {
    const error = new Error("wellbeing.pilot.viewer_email_required");
    error.status = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      isAdmin: true,
      emailVerified: true
    }
  });

  const viewer = await prisma.wellbeingPilotViewer.upsert({
    where: {
      pilotScopeId_email: {
        pilotScopeId: scopeId,
        email
      }
    },
    create: {
      pilotScopeId: scopeId,
      email,
      userId: user?.id || null
    },
    update: {
      userId: user?.id || null
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          role: true,
          isAdmin: true,
          emailVerified: true
        }
      }
    }
  });

  return serializeWellbeingPilotViewer(viewer);
}
