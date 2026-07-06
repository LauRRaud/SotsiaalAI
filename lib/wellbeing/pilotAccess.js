import { prisma as defaultPrisma } from "../prisma.js";
import { serializeWellbeingPilotAccessScope } from "./pilotScopes.js";

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAdminSession(session) {
  const role = String(session?.user?.role || "").toUpperCase();
  return Boolean(session?.user?.isAdmin) || role === "ADMIN";
}

async function resolveSessionEmail(session, prisma) {
  const sessionEmail = normalizeEmail(session?.user?.email);
  if (sessionEmail) return sessionEmail;

  const userId = String(session?.user?.id || "").trim();
  if (!userId) return "";
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });
  return normalizeEmail(user?.email);
}

function accessError(message, status = 403) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text || seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

async function findActivePilotScopesForViewer({ prisma, session, email, now }) {
  if (!prisma?.wellbeingPilotScope?.findMany) return [];

  const viewerOr = [];
  const userId = String(session?.user?.id || "").trim();
  if (userId) viewerOr.push({ userId });
  if (email) viewerOr.push({ email });
  if (viewerOr.length === 0) return [];

  try {
    const scopes = await prisma.wellbeingPilotScope.findMany({
      where: {
        active: true,
        viewers: {
          some: {
            OR: viewerOr
          }
        },
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] }
        ]
      },
      include: { viewers: true },
      orderBy: [{ updatedAt: "desc" }]
    });
    return scopes.map(serializeWellbeingPilotAccessScope);
  } catch (error) {
    if (error?.code === "P2021" || error?.code === "P2022") return [];
    throw error;
  }
}

export async function resolveWellbeingPilotAccess(session, options = {}) {
  const prisma = options.prisma || defaultPrisma;
  const env = options.env || process.env;

  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
      allowedRoleGroups: []
    };
  }

  if (isAdminSession(session)) {
    return {
      ok: true,
      status: 200,
      isAdmin: true,
      allowedRoleGroups: [],
      pilotScopes: []
    };
  }

  const email = await resolveSessionEmail(session, prisma);
  const pilotScopes = await findActivePilotScopesForViewer({
    prisma,
    session,
    email,
    now: options.now instanceof Date ? options.now : new Date(options.now || Date.now())
  });
  if (pilotScopes.length > 0) {
    return {
      ok: true,
      status: 200,
      isAdmin: false,
      allowedRoleGroups: unique(pilotScopes.flatMap((scope) => scope.roleGroups || [])),
      pilotScopes
    };
  }

  const allowedEmails = splitCsv(env.WELLBEING_PILOT_VIEWER_EMAILS).map(normalizeEmail);
  if (!email || !allowedEmails.includes(email)) {
    return {
      ok: false,
      status: 403,
      message: "wellbeing.pilot.forbidden",
      allowedRoleGroups: []
    };
  }

  const allowedRoleGroups = splitCsv(env.WELLBEING_PILOT_ROLE_GROUPS);
  if (allowedRoleGroups.length === 0) {
    return {
      ok: false,
      status: 403,
      message: "wellbeing.pilot.role_group_missing",
      allowedRoleGroups: []
    };
  }

  return {
    ok: true,
    status: 200,
    isAdmin: false,
    allowedRoleGroups,
    pilotScopes: []
  };
}

export function resolveWellbeingPilotAggregateFilters(filters = {}, access = {}) {
  if (!access?.ok) {
    throw accessError(access?.message || "wellbeing.pilot.forbidden", access?.status || 403);
  }

  const normalized = {
    pilotId: String(filters.pilotId || "").trim(),
    roleGroup: String(filters.roleGroup || "").trim(),
    workflowType: String(filters.workflowType || "").trim() || null,
    periodStart: filters.periodStart || null,
    periodEnd: filters.periodEnd || null,
    aggregationLevel: String(filters.aggregationLevel || "role_group").trim() || "role_group"
  };

  if (access.isAdmin) {
    const { pilotId, ...adminFilters } = normalized;
    return pilotId ? normalized : adminFilters;
  }

  const pilotScopes = Array.isArray(access.pilotScopes) ? access.pilotScopes : [];
  if (pilotScopes.length > 0) {
    const selectedScope = normalized.pilotId
      ? pilotScopes.find((scope) => scope.id === normalized.pilotId)
      : pilotScopes[0];
    if (!selectedScope) {
      throw accessError("wellbeing.pilot.scope_forbidden", 403);
    }

    const allowedRoleGroups = Array.isArray(selectedScope.roleGroups) ? selectedScope.roleGroups : [];
    if (allowedRoleGroups.length === 0) {
      throw accessError("wellbeing.pilot.role_group_missing", 403);
    }

    const requestedRoleGroup = normalized.roleGroup || allowedRoleGroups[0];
    if (!allowedRoleGroups.includes(requestedRoleGroup)) {
      throw accessError("wellbeing.pilot.role_group_forbidden", 403);
    }

    return {
      ...normalized,
      pilotId: selectedScope.id,
      roleGroup: requestedRoleGroup,
      minimumGroupSize: selectedScope.minimumGroupSize
    };
  }

  const allowedRoleGroups = Array.isArray(access.allowedRoleGroups) ? access.allowedRoleGroups : [];
  if (allowedRoleGroups.length === 0) {
    throw accessError("wellbeing.pilot.role_group_missing", 403);
  }

  const requestedRoleGroup = normalized.roleGroup || allowedRoleGroups[0];
  if (!allowedRoleGroups.includes(requestedRoleGroup)) {
    throw accessError("wellbeing.pilot.role_group_forbidden", 403);
  }

  return {
    roleGroup: requestedRoleGroup,
    workflowType: normalized.workflowType,
    periodStart: normalized.periodStart,
    periodEnd: normalized.periodEnd,
    aggregationLevel: normalized.aggregationLevel
  };
}
