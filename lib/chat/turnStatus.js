// Aus vestluspöörde elutsükkel (T03 E2).
//
// Üks tõeallikas lõppseisu (COMPLETED / ERROR / ABORTED) lugemiseks ja jooksva pöörde
// staatuse tuletamiseks. Serveripööre kirjutab iga lõppseisu markeri assistendisõnumi
// `metadata.completionStatus`-esse; hüdreerimine ja /api/chat/run loevad selle siit ega
// tuleta aktiivsust ainult heuristikast „viimane sõnum oli kasutajalt".

export const TERMINAL_COMPLETION_STATUSES = new Set(["COMPLETED", "ERROR", "ABORTED"]);

export function normalizeCompletionStatus(value, fallback = "COMPLETED") {
  const normalized = String(value || "").trim().toUpperCase();
  return TERMINAL_COMPLETION_STATUSES.has(normalized) ? normalized : fallback;
}

/**
 * Tuletab jooksva vestluse staatuse viimase pöörde põhjal.
 *
 * - Kui viimane sõnum on assistendilt: tagasta selle salvestatud completionStatus
 *   (COMPLETED / ERROR / ABORTED). Nii eristub aus lõppseis, mitte alati „COMPLETED".
 * - Kui viimane sõnum on kasutajalt: pööre on aktiivne (RUNNING). Kui aga viimasest
 *   tegevusest on möödas rohkem kui stallMs (server suri enne lõppmarkeri kirjutamist),
 *   tagasta ERROR — nii ei jää olek igavesse RUNNING-usse.
 * - Muidu IDLE.
 */
export function resolveRunStatus({
  latestTurnRole,
  metadata = null,
  lastActivityMs = 0,
  nowMs = 0,
  stallMs = 180_000
} = {}) {
  const role = String(latestTurnRole || "").trim().toUpperCase();
  if (role === "ASSISTANT") {
    return normalizeCompletionStatus(metadata?.completionStatus, "COMPLETED");
  }
  if (role === "USER") {
    const activity = Number(lastActivityMs);
    const now = Number(nowMs);
    const stalled =
      Number.isFinite(activity) && activity > 0 &&
      Number.isFinite(now) && now > 0 &&
      now - activity > Math.max(1, Number(stallMs) || 0);
    return stalled ? "ERROR" : "RUNNING";
  }
  return "IDLE";
}
