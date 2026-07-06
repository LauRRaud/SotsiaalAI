import prisma from "@/lib/prisma";
import { getAdminViewRoleFromCookies } from "@/lib/adminViewRole";
import { maybeRunRetentionCleanup } from "@/lib/retention";
const SIGNIN_REDIRECT = process.env.NEXT_PUBLIC_SIGNIN_REDIRECT || "/api/auth/signin?callbackUrl=/vestlus";
const SUBSCRIBE_REDIRECT = process.env.NEXT_PUBLIC_SUBSCRIBE_REDIRECT || "/tellimus";
export function isAdmin(principal) {
  if (!principal) return false;
  const role = String(principal.role || "").toUpperCase();
  return role === "ADMIN" || principal.isAdmin === true;
}
export function roleFromSession(session) {
  if (!session?.user) return "CLIENT";
  if (isAdmin(session.user)) return "ADMIN";
  const raw = String(session.user.role || "").toUpperCase();
  if (raw === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  return raw === "SOCIAL_WORKER" ? "SOCIAL_WORKER" : "CLIENT";
}
export function normalizeRole(role) {
  const r = String(role || "").toUpperCase();
  if (r === "ADMIN") return "SOCIAL_WORKER";
  if (r === "SERVICE_PROVIDER") return "SERVICE_PROVIDER";
  if (r === "SOCIAL_WORKER") return "SOCIAL_WORKER";
  return "CLIENT";
}
export function effectiveRoleFromSession(session) {
  return normalizeRole(roleFromSession(session));
}

export function resolveSessionRoleState(session, cookieSource) {
  const role = roleFromSession(session);
  const admin = isAdmin(session?.user);
  const adminViewRole = admin ? getAdminViewRoleFromCookies(cookieSource) : null;
  const effectiveRole = admin ? adminViewRole || "SOCIAL_WORKER" : normalizeRole(role);

  return {
    role,
    effectiveRole,
    isAdmin: admin,
    adminViewRole,
    isRoleViewActive: Boolean(adminViewRole)
  };
}
async function hasActiveSubscription(userId) {
  if (!userId) return false;
  const now = new Date();
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: "ACTIVE",
      OR: [{
        validUntil: null
      }, {
        validUntil: {
          gt: now
        }
      }]
    },
    select: {
      id: true
    }
  });
  return !!sub;
}
export async function requireSubscription(session, role, opts = {}) {
  await maybeRunRetentionCleanup();
  const signinRedirect = opts.signinRedirect || SIGNIN_REDIRECT;
  const subscribeRedirect = opts.subscribeRedirect || SUBSCRIBE_REDIRECT;
  if (!session) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
      redirect: signinRedirect
    };
  }
  if (isAdmin(session.user)) {
    return {
      ok: true,
      status: 200
    };
  }
  if (opts.allowWithoutSubscription === true) {
    return {
      ok: true,
      status: 200
    };
  }
  const effective = normalizeRole(role);
  if (effective === "SOCIAL_WORKER" || effective === "SERVICE_PROVIDER" || effective === "CLIENT") {
    const ok = await hasActiveSubscription(session.user.id);
    if (!ok) {
      return {
        ok: false,
        status: 402,
        message: "api.common.subscription_required",
        redirect: subscribeRedirect,
        requireSubscription: true
      };
    }
  }
  return {
    ok: true,
    status: 200
  };
}
export function assertAdmin(session, opts = {}) {
  const signinRedirect = opts.signinRedirect || SIGNIN_REDIRECT;
  if (!session?.user) {
    return {
      ok: false,
      status: 401,
      message: "api.common.unauthorized",
      redirect: signinRedirect
    };
  }
  if (!isAdmin(session.user)) {
    return {
      ok: false,
      status: 403,
      message: "api.common.forbidden"
    };
  }
  return {
    ok: true,
    status: 200
  };
}
