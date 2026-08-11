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
/**
 * SOL-CHAT-04/-06: kui pöördel ON serveripoolne rida (`ChatTurn`), siis TEMA on tõde ja
 * sõnumitest tuletamine on ainult varuvariant vanadele vestlustele.
 *
 * Miks üldse varuvariant: `ChatTurn` tekkis 11.08.2026 migratsiooniga, seega enne seda loodud
 * vestlustel rida ei ole. Tuletus jääb nende jaoks alles ja on siin nimeliselt eristatud, et
 * hilisem lugeja ei arvaks, et kaks teed on kaks tõde.
 *
 * @param turn `{ status, updatedAt }` või `null`
 * @returns lõppseis või `null`, kui rida ei ole (siis loe `resolveRunStatus`).
 */
export function resolveRunStatusFromTurn(turn, { nowMs = Date.now(), leaseMs = 900_000 } = {}) {
  if (!turn) return null;
  const status = String(turn.status || "").trim().toUpperCase();
  if (TERMINAL_COMPLETION_STATUSES.has(status)) return status;
  if (status !== "RUNNING") return null;
  const beat = turn.updatedAt ? new Date(turn.updatedAt).getTime() : 0;
  const stalled = !Number.isFinite(beat) || nowMs - beat > Math.max(1, leaseMs);
  // Rippuma jäänud pööre ei ole „veel töös" — ta on surnud ja peab olema korratav.
  return stalled ? "ERROR" : "RUNNING";
}

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
