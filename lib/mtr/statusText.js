/* A4 E5 — seisust tekstiks. AINUS koht, kus otsustatakse, mida inimene loeb.

   Miks eraldi kiht: `publicStatus` üksi EI TOHI määrata märgist. Jäme vaste
   (`ACTIVITY_VERIFIED`) peab kandma teist teksti kui täpne, ja aegunud
   positiivne seis ei tohi üldse positiivsena paista. Kui iga vaade tõlgiks
   seise ise, ununeks see varem või hiljem ühes kohas ära.

   NELI AVALIKKU TEKSTI (omaniku sõnastus 05.08) + üks ainult sisemine:

     VERIFIED           „Tegevusluba MTR-is kontrollitud {kuupäev}"
     ACTIVITY_VERIFIED  „{tegevusala} tegevusluba MTR-is kontrollitud {kuupäev}"
                        + hoiatus, et alaliiki register ei näita
     NO_SHS_...         „…ei ole MTR-is kontrollitavat sotsiaalteenuse
                        tegevusluba nõutud"
     NOT_FOUND          „MTR-ist ei leitud kontrolli ajal sellele teenusele
                        kehtivat tegevusluba"
     UNCONFIRMED /      „Tegevusloa staatust ei saanud MTR-is kinnitada"
     NOT_CHECKED

   `SERVICE_MAPPING_REQUIRED` ei ole avalik: sildita on aus, sest me ei tea,
   MIDA kontrollida. Osutaja ja admin näevad selgitust ja parandusteed.

   TOON ei ole kunagi „negatiivne": punast värvi, hüüumärki ega ähvardavat
   kujundust ei ole üheski seisus (omaniku otsus 05.08). */

import { LICENCE_PUBLIC_STATUS, POSITIVE_STATUSES, publicClaimIsCurrent } from "./assessment.js";
import { LICENCE_COVERAGE } from "./licensedServices.js";

const PREFIX = "service_provider_profile.licence";

export const BADGE_TONE = Object.freeze({
  POSITIVE: "POSITIVE",
  NEUTRAL: "NEUTRAL"
});

export const BADGE_VISIBILITY = Object.freeze({
  PUBLIC: "PUBLIC",
  INTERNAL_ONLY: "INTERNAL_ONLY"
});

function neutral(key, extra = {}) {
  return {
    status: extra.status || null,
    tone: BADGE_TONE.NEUTRAL,
    visibility: BADGE_VISIBILITY.PUBLIC,
    key: `${PREFIX}.public.${key}`,
    params: {},
    caveatKey: null,
    ...extra
  };
}

/**
 * Avalik märgis ühe teenuse kohta.
 *
 * Võtab TERVE hinnangu, mitte seisu: nii ei saa kutsuja täpset märgist
 * jämeda vaste pealt kokku panna. Aegunud positiivne seis langeb ise
 * „ei saanud kinnitada" peale.
 */
export function publicLicenceBadge(assessment, { now = new Date() } = {}) {
  if (!assessment?.publicStatus) return null;
  const status = assessment.publicStatus;

  if (status === LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED) {
    return {
      status,
      tone: BADGE_TONE.NEUTRAL,
      visibility: BADGE_VISIBILITY.INTERNAL_ONLY,
      key: null,
      params: {},
      caveatKey: null
    };
  }

  if (POSITIVE_STATUSES.includes(status)) {
    /* Aegunud tõend ei ole tõend. Sama reegel elab ka lugemisrajal — siin on
       ta teist korda, sest märgise renderdaja võib saada andmed mujalt. */
    if (!publicClaimIsCurrent(assessment, now)) {
      return neutral("unconfirmed", { status: LICENCE_PUBLIC_STATUS.UNCONFIRMED });
    }
    const date = assessment.verifiedAt || assessment.statusSource?.verifiedAt || null;
    /* Kaitse: `VERIFIED` ilma täpse vasteta käitub jämeda vastena. Nii ei saa
       vale salvestus muutuda liiga tugevaks lubaduseks. */
    const exact = status === LICENCE_PUBLIC_STATUS.VERIFIED && assessment.coverage === LICENCE_COVERAGE.EXACT_MATCH;
    if (exact) {
      return {
        status: LICENCE_PUBLIC_STATUS.VERIFIED,
        tone: BADGE_TONE.POSITIVE,
        visibility: BADGE_VISIBILITY.PUBLIC,
        key: `${PREFIX}.public.verified`,
        params: { date },
        caveatKey: null
      };
    }
    return {
      status: LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED,
      tone: BADGE_TONE.POSITIVE,
      visibility: BADGE_VISIBILITY.PUBLIC,
      key: `${PREFIX}.public.activity_verified`,
      params: { date, activity: assessment.activityExpected || "" },
      caveatKey: `${PREFIX}.public.activity_verified_caveat`
    };
  }

  if (status === LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED) {
    return neutral("no_licence_required", { status });
  }
  if (status === LICENCE_PUBLIC_STATUS.NOT_FOUND) {
    return neutral("not_found", { status });
  }
  return neutral("unconfirmed", { status: LICENCE_PUBLIC_STATUS.UNCONFIRMED });
}

/**
 * Osutaja ja admini vaade: seis + PÕHJUS + parandustee.
 * Siin tohib öelda seda, mida avalikult ei öelda — sh „teenus ei ole seotud".
 */
export function internalLicenceStatus(assessment, { now = new Date() } = {}) {
  if (!assessment?.publicStatus) {
    return { status: LICENCE_PUBLIC_STATUS.NOT_CHECKED, key: `${PREFIX}.internal.not_checked`, reasonKey: null, actionKey: null };
  }
  const status = assessment.publicStatus;
  const reason = assessment.assessmentReason || assessment.lastAttempt?.licenceReason || assessment.lastAttempt?.entityReason || null;

  if (status === LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED) {
    return {
      status,
      key: `${PREFIX}.internal.mapping_required`,
      reasonKey: null,
      actionKey: `${PREFIX}.internal.action_map_service`
    };
  }
  if (POSITIVE_STATUSES.includes(status) && !publicClaimIsCurrent(assessment, now)) {
    return {
      status: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      key: `${PREFIX}.internal.expired`,
      reasonKey: `${PREFIX}.internal.reason.check_stale`,
      actionKey: `${PREFIX}.internal.action_recheck`
    };
  }
  if (status === LICENCE_PUBLIC_STATUS.NOT_FOUND) {
    return {
      status,
      key: `${PREFIX}.internal.not_found`,
      reasonKey: null,
      actionKey: `${PREFIX}.internal.action_fix_registry_code`
    };
  }
  if (status === LICENCE_PUBLIC_STATUS.UNCONFIRMED || status === LICENCE_PUBLIC_STATUS.NOT_CHECKED) {
    const known = ["IDENTITY_UNRESOLVED", "CHECK_STALE", "PENDING_SECOND_CHECK", "INVALID_REGISTRY_CODE", "TIMEOUT"];
    return {
      status,
      key: `${PREFIX}.internal.${status === LICENCE_PUBLIC_STATUS.NOT_CHECKED ? "not_checked" : "unconfirmed"}`,
      reasonKey: reason && known.includes(reason) ? `${PREFIX}.internal.reason.${reason.toLowerCase()}` : null,
      actionKey:
        reason === "IDENTITY_UNRESOLVED" || reason === "INVALID_REGISTRY_CODE"
          ? `${PREFIX}.internal.action_fix_registry_code`
          : `${PREFIX}.internal.action_recheck`
    };
  }
  return { status, key: `${PREFIX}.internal.no_licence_required`, reasonKey: null, actionKey: null };
}
