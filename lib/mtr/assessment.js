/* A4 E3 — teenuse loahinnang: kontrolli tulemusest avalikku seisu.

   See on koht, kus MTR-i vastus muutub lauseks, mida inimene teenusekaardil
   loeb. Kogu fail on PUHAS funktsioon — andmebaasi ta ei puutu, et iga
   üleminekut saaks testida ilma päris registri ja päris DB-ta.

   KUUS SEISU, kolm neist tähendavad „me ei väida midagi":

     VERIFIED                  luba on olemas ja katab selle teenuse
     NO_SHS_LICENCE_REQUIRED   SHS ei nõua sellele teenusele tegevusluba
     NOT_FOUND                 kontroll õnnestus, kehtivat luba ei leitud
     UNCONFIRMED               teadsime, mida küsida, aga ei saanud vastust
     NOT_CHECKED               kontroll pole veel käinud
     SERVICE_MAPPING_REQUIRED  me ei tea, MIDA kontrollida — silti ei ole

   `SERVICE_MAPPING_REQUIRED` ja `UNCONFIRMED` ei ole sama asi ja neid ei tohi
   ühte valada: ainult teine on registri või võrgu probleem. */

import { MTR_CHECK_POLICY, checkIsFresh } from "./policy.js";
import {
  LICENCE_COVERAGE,
  LICENCE_REQUIREMENT,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  licenceCoverageForService,
  licenceRequirementFor
} from "./licensedServices.js";

export const LICENCE_PUBLIC_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  NO_SHS_LICENCE_REQUIRED: "NO_SHS_LICENCE_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  UNCONFIRMED: "UNCONFIRMED",
  NOT_CHECKED: "NOT_CHECKED",
  SERVICE_MAPPING_REQUIRED: "SERVICE_MAPPING_REQUIRED"
});

export const ASSESSMENT_REASON = Object.freeze({
  IDENTITY_UNRESOLVED: "IDENTITY_UNRESOLVED",
  CHECK_STALE: "CHECK_STALE",
  PENDING_SECOND_CHECK: "PENDING_SECOND_CHECK"
});

const COVERAGE_RANK = {
  [LICENCE_COVERAGE.EXACT_MATCH]: 3,
  [LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY]: 2,
  [LICENCE_COVERAGE.NO_MATCH]: 1,
  [LICENCE_COVERAGE.UNCONFIRMED]: 0
};

function toTime(value) {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

/** Kas luba on hindamise hetkel jõus. Lõppkuupäev lõpetab seisu KOHE. */
export function licenceInForce(licence, now = new Date()) {
  if (!licence?.valid) return false;
  const current = toTime(now) ?? Date.now();
  const from = toTime(licence.validFrom);
  if (from === null || from > current) return false;
  if (licence.indefinite) return true;
  const until = toTime(licence.validUntil);
  if (until === null) return false;
  /* Lõppkuupäev on kaasa arvatud — päev, mil luba lõpeb, on veel kehtiv. */
  return until + 24 * 60 * 60 * 1000 > current;
}

/**
 * Ühe osutaja teenuse loahinnang.
 *
 * @param serviceKey  seotud kataloogivõti; `null` = SIDUMATA
 * @param check       viimane kontroll: { result, reason, entityResolved, verifiedAt, licences }
 * @param previous    varasem hinnang: { publicStatus, consecutiveMissCount }
 */
export function assessServiceLicence({ serviceKey = null, check = null, previous = null, now = new Date() } = {}) {
  const base = {
    serviceKey: serviceKey || null,
    catalogueVersion: LICENSED_SERVICE_CATALOGUE_VERSION,
    requirementAtAssessment: LICENCE_REQUIREMENT.UNKNOWN,
    activityExpected: null,
    activityTypeExpected: null,
    coverage: LICENCE_COVERAGE.UNCONFIRMED,
    publicStatus: LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED,
    consecutiveMissCount: 0,
    reason: null,
    coveringLicence: null,
    publicStatusValidUntil: null
  };

  const mapping = serviceKey ? licenceRequirementFor({ serviceKey }) : null;

  /* 7. põhimõte: sidumata teenus ei tekita päringut ega avalikku väidet.
     Sama kehtib tundmatu võtme kohta — kataloogist puuduv rida ei ole otsus. */
  if (!mapping || mapping.requirement === LICENCE_REQUIREMENT.UNKNOWN) return base;

  const previousMisses = Number(previous?.consecutiveMissCount) || 0;
  const snapshot = {
    ...base,
    requirementAtAssessment: mapping.requirement,
    activityExpected: mapping.activity?.label || null,
    activityTypeExpected: mapping.activityType || null
  };

  if (mapping.requirement === LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED) {
    return { ...snapshot, publicStatus: LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED };
  }

  if (!check) return { ...snapshot, publicStatus: LICENCE_PUBLIC_STATUS.NOT_CHECKED };

  /* Tehniline tõrge, lahendamata identiteet ja vananenud kontroll on kõik
     „me ei tea" — mitte „luba puudub". Erinevus on ainult põhjuses. */
  if (check.result !== "OK") {
    return {
      ...snapshot,
      publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      reason: check.reason || null,
      consecutiveMissCount: previousMisses
    };
  }
  if (!check.entityResolved) {
    return {
      ...snapshot,
      publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      reason: ASSESSMENT_REASON.IDENTITY_UNRESOLVED,
      consecutiveMissCount: previousMisses
    };
  }
  if (!checkIsFresh({ verifiedAt: check.verifiedAt, now })) {
    return {
      ...snapshot,
      publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      reason: ASSESSMENT_REASON.CHECK_STALE,
      consecutiveMissCount: previousMisses
    };
  }

  let best = { coverage: LICENCE_COVERAGE.NO_MATCH, licence: null };
  for (const licence of check.licences || []) {
    if (!licenceInForce(licence, now)) continue;
    const coverage = licenceCoverageForService(licence, serviceKey);
    if (COVERAGE_RANK[coverage] > COVERAGE_RANK[best.coverage]) best = { coverage, licence };
  }

  const covers =
    best.coverage === LICENCE_COVERAGE.EXACT_MATCH || best.coverage === LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY;

  if (covers) {
    const until = toTime(best.licence?.validUntil);
    return {
      ...snapshot,
      coverage: best.coverage,
      publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
      consecutiveMissCount: 0,
      coveringLicence: best.licence,
      /* Positiivne seis kehtib lühima ankru järgi: kas kontroll vananeb või
         luba lõpeb — kumb enne tuleb. */
      publicStatusValidUntil: new Date(
        Math.min(
          (toTime(check.verifiedAt) ?? toTime(now) ?? Date.now()) + MTR_CHECK_POLICY.freshnessMs,
          best.licence?.indefinite || until === null ? Number.POSITIVE_INFINITY : until + 24 * 60 * 60 * 1000
        )
      )
    };
  }

  /* Edukas kontroll, kehtivat luba ei leitud. Avalik seis muutub alles teisel
     järjestikusel korral — ühekordne registrikapriis ei tohi kolmanda isiku
     kohta avalikku väidet toota. */
  const misses = previousMisses + 1;
  if (previous?.publicStatus === LICENCE_PUBLIC_STATUS.VERIFIED && misses < MTR_CHECK_POLICY.missesBeforeNotFound) {
    return {
      ...snapshot,
      coverage: previous?.coverage || LICENCE_COVERAGE.UNCONFIRMED,
      publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
      consecutiveMissCount: misses,
      reason: ASSESSMENT_REASON.PENDING_SECOND_CHECK
    };
  }

  return {
    ...snapshot,
    coverage: best.coverage,
    publicStatus: LICENCE_PUBLIC_STATUS.NOT_FOUND,
    consecutiveMissCount: misses
  };
}
