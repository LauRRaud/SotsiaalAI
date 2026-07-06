export function normalizeConversationRole(role) {
  const normalized = String(role || "CLIENT").toUpperCase().trim();
  if (normalized === "ADMIN") return "SOCIAL_WORKER";
  if (normalized === "SERVICE_PROVIDER") return "SOCIAL_WORKER";
  return normalized === "SOCIAL_WORKER" || normalized === "CLIENT" ? normalized : "CLIENT";
}

export function resolveConversationListRoleFilter(roleParam, effectiveRole, isAdmin = false) {
  const normalizedParam = String(roleParam || "").toUpperCase().trim();
  if (normalizedParam === "ALL") return null;
  if (!normalizedParam && isAdmin) return null;
  return normalizedParam
    ? normalizeConversationRole(normalizedParam)
    : normalizeConversationRole(effectiveRole);
}

export function resolveConversationWriteRole({ requestedRole, effectiveRole, isAdmin, sessionRole }) {
  if (!isAdmin) return normalizeConversationRole(sessionRole);
  return requestedRole
    ? normalizeConversationRole(requestedRole)
    : normalizeConversationRole(effectiveRole);
}
