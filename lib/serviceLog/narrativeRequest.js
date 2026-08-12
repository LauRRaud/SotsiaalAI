/** SOL-SLOG-23 — hiline vastus tohib muuta ainult sama kliendi sama kuu vormi. */
export function narrativeRequestFingerprint({ referralId = "", month = "" } = {}) {
  return `${String(referralId || "")}::${String(month || "")}`;
}

export function isCurrentNarrativeRequest({
  requestId,
  activeRequestId,
  fingerprint,
  activeFingerprint
}) {
  return requestId === activeRequestId && fingerprint === activeFingerprint;
}
