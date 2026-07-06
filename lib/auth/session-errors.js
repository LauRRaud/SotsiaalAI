const EXPECTED_SESSION_INVALIDATION_MESSAGES = new Set([
  "SESSION_REVOKED",
  "SESSION_USER_MISSING"
]);

export function isExpectedSessionInvalidationError(code, metadata) {
  if (code !== "JWT_SESSION_ERROR") return false;

  const candidates = [
    metadata?.error?.message,
    metadata?.error?.cause?.message,
    metadata?.cause?.message,
    metadata?.message
  ];

  return candidates.some((value) =>
    EXPECTED_SESSION_INVALIDATION_MESSAGES.has(String(value || ""))
  );
}
