import { effectiveRoleFromSession, isAdmin, requireSubscription } from "@/lib/authz"

const MATERIAL_UPLOAD_ROLES = new Set(["SOCIAL_WORKER", "SERVICE_PROVIDER"])

export async function requireMaterialUploadAccess(session, { subscriptionGate = requireSubscription } = {}) {
  if (!session?.user?.id) {
    return { ok: false, status: 401, message: "api.common.unauthorized" }
  }
  if (isAdmin(session.user)) return { ok: true, status: 200, role: "SOCIAL_WORKER", admin: true }

  const role = effectiveRoleFromSession(session)
  if (!MATERIAL_UPLOAD_ROLES.has(role)) {
    return { ok: false, status: 403, message: "api.common.forbidden" }
  }
  const subscription = await subscriptionGate(session, role)
  return subscription.ok ? { ...subscription, role, admin: false } : subscription
}

export function requireMaterialReadAccess(session) {
  if (!session?.user?.id) {
    return { ok: false, status: 401, message: "api.common.unauthorized" }
  }
  return {
    ok: true,
    status: 200,
    userId: String(session.user.id),
    admin: isAdmin(session.user)
  }
}
