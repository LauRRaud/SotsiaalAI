import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * Supervisiooni V0 UI jagatud kliendikiht (Q2.6 olekulepingud). Üks koht, kus
 * HTTP-olek tõlgitakse kasutaja lauseks: 401 → „logi sisse", 404 → ühetaoline
 * „ei leitud või pole ligipääsu" (server EI erista võõrast ja olematut —
 * Q2.4 ühetaolise-404 reegel peab paistma ka UI-s), 409 → konflikt.
 */

/**
 * `?ala=` püsiankrud (Q2.6 navigeerimisleping). U2 „Jätka siit" ja teavitused
 * sihivad neid (lib/supervision/notifications.js), seega neid väärtusi ei muudeta.
 * Protsessi laua kõik osad (need viis ja hiljem lisandunud) ning nende nimed on
 * failis ./process/processRows.js; sakiriba, mille jaoks siin olid ala loend ja
 * tõlkevõtmete seos, enam ei ole.
 */
export const SUPERVISION_AREAS = Object.freeze({
  KONTRAKT: "kontrakt",
  EESKAMBER: "eeskamber",
  KOHTUMISED: "kohtumised",
  KOKKUVOTTED: "kokkuvotted",
  KAPP: "kapp"
});

/**
 * Ühtne päring: ei viska, vaid tagastab {ok, status, payload}. Nii saab iga
 * vaade 409-i eraldi käsitleda (uuestilaadimine), mitte üldise veana kuvada.
 */
export async function supervisionRequest(url, { method = "GET", body, signal } = {}) {
  const response = await fetch(url, {
    method,
    cache: "no-store",
    signal,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok && payload?.ok !== false, status: response.status, payload };
}

export function isConflict(status) {
  return status === 409;
}

/** HTTP-olek → kasutaja lause. */
export function supervisionMessage({ status, payload, t, fallbackKey = "supervision.errors.load_failed" }) {
  if (status === 401) return t("supervision.common.loginRequired");
  if (status === 404) return t("supervision.common.notFound");
  return resolveApiMessage({ payload, t, fallbackKey });
}
