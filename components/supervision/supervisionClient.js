import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";

/**
 * Supervisiooni V0 UI jagatud kliendikiht (Q2.6 olekulepingud). Üks koht, kus
 * HTTP-olek tõlgitakse kasutaja lauseks: 401 → „logi sisse", 404 → ühetaoline
 * „ei leitud või pole ligipääsu" (server EI erista võõrast ja olematut —
 * Q2.4 ühetaolise-404 reegel peab paistma ka UI-s), 409 → konflikt.
 */

/** `?ala=` püsiankrud (Q2.6 navigeerimisleping). U2 „Jätka siit" sihib neid. */
export const SUPERVISION_AREAS = Object.freeze({
  KONTRAKT: "kontrakt",
  EESKAMBER: "eeskamber",
  KOHTUMISED: "kohtumised",
  KOKKUVOTTED: "kokkuvotted",
  KAPP: "kapp"
});

export const SUPERVISION_AREA_LIST = Object.freeze([
  SUPERVISION_AREAS.KONTRAKT,
  SUPERVISION_AREAS.EESKAMBER,
  SUPERVISION_AREAS.KOHTUMISED,
  SUPERVISION_AREAS.KOKKUVOTTED,
  SUPERVISION_AREAS.KAPP
]);

export function normalizeArea(value) {
  const area = String(value || "").trim().toLowerCase();
  return SUPERVISION_AREA_LIST.includes(area) ? area : SUPERVISION_AREAS.KONTRAKT;
}

/**
 * Ala-ankur → `supervision.nav.*` tõlkevõti. Ankrud on eestikeelsed URL-osad
 * (püsivad, Q2.8 „Jätka siit" sihib neid), tõlkevõtmed inglisekeelsed — seos
 * elab siin, et sakiriba ja süvalingid ei saaks lahku triivida.
 */
export const SUPERVISION_AREA_NAV_KEYS = Object.freeze({
  [SUPERVISION_AREAS.KONTRAKT]: "contract",
  [SUPERVISION_AREAS.EESKAMBER]: "eeskamber",
  [SUPERVISION_AREAS.KOHTUMISED]: "meetings",
  [SUPERVISION_AREAS.KOKKUVOTTED]: "summaries",
  [SUPERVISION_AREAS.KAPP]: "kapp"
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
