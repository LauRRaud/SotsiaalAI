/* A4 E3 — teenuse loahinnang: kontrolli tulemusest avalikku seisu.

   See on koht, kus MTR-i vastus muutub lauseks, mida inimene teenusekaardil
   loeb. Kogu fail on PUHAS funktsioon — andmebaasi ta ei puutu, et iga
   üleminekut saaks testida ilma päris registri ja päris DB-ta.

   SEITSE SEISU, neist kolm tähendavad „me ei väida midagi":

     VERIFIED                  luba katab TÄPSELT selle teenuse
     ACTIVITY_VERIFIED         tegevusala luba on, alaliiki ei saanud kinnitada
     NO_SHS_LICENCE_REQUIRED   SHS ei nõua sellele teenusele tegevusluba
     NOT_FOUND                 kaks järjestikust edukat kontrolli, luba ei leitud
     UNCONFIRMED               ei saanud vastust, või alles esimene puudumine
     NOT_CHECKED               kontroll pole veel käinud
     SERVICE_MAPPING_REQUIRED  me ei tea, MIDA kontrollida — silti ei ole

   `VERIFIED` ja `ACTIVITY_VERIFIED` on TAHTLIKULT eri seisud, mitte sama seis
   eri kaetusega: nii ei saa liides renderdada täpset märgist ainult
   `publicStatus` põhjal ja jämeda vaste tekst on sunnitud olema teine.

   KAKS AJAREEGLIT, mida ilma nendeta ei ole:
     - loa kuupäevad on KALENDRIPÄEVAD Eesti ajavööndis, mitte UTC-hetked;
     - positiivne seis kannab `publicStatusValidUntil`-i, mille lugemisrada
       peab jõustama — märgis ei tohi rippuda üle loa lõpu ega üle kontrolli
       värskusakna, ka siis, kui korje pole veel jõudnud. */

import { estonianDayBounds } from "@/lib/time/estonianDay";

import { MTR_CHECK_POLICY, checkIsFresh } from "./policy.js";
import {
  LICENCE_COVERAGE,
  LICENCE_REQUIREMENT,
  LICENSED_SERVICE_CATALOGUE_VERSION,
  licenceCoverageForService,
  licenceRequirementFor
} from "./licensedServices.js";

const ESTONIA = "Europe/Tallinn";
const DAY_MS = 24 * 60 * 60 * 1000;

export const LICENCE_PUBLIC_STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  ACTIVITY_VERIFIED: "ACTIVITY_VERIFIED",
  NO_SHS_LICENCE_REQUIRED: "NO_SHS_LICENCE_REQUIRED",
  NOT_FOUND: "NOT_FOUND",
  UNCONFIRMED: "UNCONFIRMED",
  NOT_CHECKED: "NOT_CHECKED",
  SERVICE_MAPPING_REQUIRED: "SERVICE_MAPPING_REQUIRED"
});

/** Seisud, mis kannavad avalikku positiivset väidet. */
export const POSITIVE_STATUSES = Object.freeze([
  LICENCE_PUBLIC_STATUS.VERIFIED,
  LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED
]);

export const ASSESSMENT_REASON = Object.freeze({
  IDENTITY_UNRESOLVED: "IDENTITY_UNRESOLVED",
  CHECK_STALE: "CHECK_STALE",
  PENDING_SECOND_CHECK: "PENDING_SECOND_CHECK",
  EVIDENCE_EXPIRED: "EVIDENCE_EXPIRED"
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

/** Kalendripäev `YYYY-MM-DD` Eesti ajavööndis. */
export function estonianDay(value = new Date()) {
  const time = toTime(value);
  if (time === null) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ESTONIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date(time));
}

/** Loa kuupäev normaliseeritult: string jääb stringiks, `Date` loetakse UTC-päevana. */
function licenceDay(value) {
  if (!value) return null;
  if (typeof value === "string") return value.slice(0, 10);
  const time = toTime(value);
  if (time === null) return null;
  /* `@db.Date` tuleb tagasi UTC-keskööna — see ON kalendripäev, mitte hetk. */
  return new Date(time).toISOString().slice(0, 10);
}

/**
 * Hetk, mil Eesti kalendripäev `day` lõpeb.
 *
 * JAGATUD HELPERI PEAL, mitte oma arvutus. Vana kuju oli
 *
 *     base + DAY_MS - estonianOffsetMs(base)
 *
 * ja ta mõõtis nihke ÜHEL hetkel (UTC-kesköö) ning eeldas, et päev kestab
 * 24 tundi. DST-päevadel on mõlemad eeldused valed ja tulemus oli mõõdetult
 * tund nihkes:
 *
 *     29.03.2026   vana 22:00Z   õige 21:00Z   → luba kehtis tunni liiga kaua
 *     25.10.2026   vana 21:00Z   õige 22:00Z   → luba suri tunni liiga vara
 *
 * Kaks korda aastas ja tund korraga — aga see on loa KEHTIVUSE piir, ja
 * „peaaegu õige kehtivus" ei ole kehtivus. `estonianDayBounds().end` on juba
 * järgmise kalendripäeva kesköö, seega ta kannab 23- ja 25-tunnist päeva
 * iseenesest.
 */
export function estonianDayEnd(day) {
  const base = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(base)) return null;
  /* Keskpäev, mitte kesköö: nii jääb sisendhetk päeva sisse ka siis, kui see
     päev algab UTC eelmisel õhtul. Vastus on sama, sest bounds normaliseerib
     kalendripäevale. */
  return estonianDayBounds(new Date(base + DAY_MS / 2)).end;
}

/**
 * Kas luba on hindamise hetkel jõus.
 * Võrdlus käib KALENDRIPÄEVADES Eesti ajavööndis: luba kehtib oma lõpupäeva
 * lõpuni ja mitte hetkegi kauem.
 */
export function licenceInForce(licence, now = new Date()) {
  if (!licence?.valid) return false;
  const today = estonianDay(now);
  const from = licenceDay(licence.validFrom);
  if (!today || !from || from > today) return false;
  if (licence.indefinite) return true;
  const until = licenceDay(licence.validUntil);
  if (!until) return false;
  return until >= today;
}

function positiveEvidenceStillValid(previous, now) {
  if (!previous || !POSITIVE_STATUSES.includes(previous.publicStatus)) return false;
  const until = toTime(previous.publicStatusValidUntil);
  if (until === null) return false;
  return until > (toTime(now) ?? Date.now());
}

/**
 * Ühe osutaja teenuse loahinnang.
 *
 * @param serviceKey  seotud kataloogivõti; `null` = SIDUMATA
 * @param check       viimane kontroll: { id, result, reason, entityResolved, verifiedAt, licences }
 * @param previous    varasem hinnang: { publicStatus, coverage, confirmedMissCount,
 *                    publicStatusValidUntil, statusSourceCheckId, coveringLicenceNumber }
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
    assessmentReason: null,
    confirmedMissCount: 0,
    /* Kaks eri seost: mida viimati proovisime vs millel seis PÕHINEB. */
    lastAttemptCheckId: check?.id || null,
    statusSourceCheckId: null,
    coveringLicenceNumber: null,
    coverageScope: "ORGANISATION",
    publicStatusValidUntil: null
  };

  const mapping = serviceKey ? licenceRequirementFor({ serviceKey }) : null;

  /* 7. põhimõte: sidumata teenus ei tekita päringut ega avalikku väidet — ja
     ta ei seostu ka ühegi kontrolliga, sest ta seis ei tulene MTR-ist. */
  if (!mapping || mapping.requirement === LICENCE_REQUIREMENT.UNKNOWN) {
    return { ...base, lastAttemptCheckId: null };
  }

  const snapshot = {
    ...base,
    requirementAtAssessment: mapping.requirement,
    activityExpected: mapping.activity?.label || null,
    activityTypeExpected: mapping.activityType || null
  };

  /* Loakohustuseta teenuse seis ei tulene kontrollist — seost ei looda. */
  if (mapping.requirement === LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED) {
    return {
      ...snapshot,
      publicStatus: LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED,
      lastAttemptCheckId: null
    };
  }

  if (!check) {
    return { ...snapshot, publicStatus: LICENCE_PUBLIC_STATUS.NOT_CHECKED, lastAttemptCheckId: null };
  }

  const previousMisses = Number(previous?.confirmedMissCount) || 0;
  const keepPrevious = (reason) => ({
    ...snapshot,
    coverage: previous?.coverage || LICENCE_COVERAGE.UNCONFIRMED,
    publicStatus: previous.publicStatus,
    assessmentReason: reason,
    statusSourceCheckId: previous.statusSourceCheckId || null,
    coveringLicenceNumber: previous.coveringLicenceNumber || null,
    publicStatusValidUntil: previous.publicStatusValidUntil || null
  });

  /* Tehniline tõrge, lahendamata identiteet ja vananenud kontroll on kõik
     „me ei tea" — mitte „luba puudub". Loendur NULLITAKSE, sest mõiste on
     „kaks järjestikust EDUKAT registrivastust". */
  const technicalFailure = (reason) => {
    if (positiveEvidenceStillValid(previous, now)) return { ...keepPrevious(reason), confirmedMissCount: 0 };
    return {
      ...snapshot,
      publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      assessmentReason: reason,
      confirmedMissCount: 0
    };
  };

  if (check.result !== "OK") return technicalFailure(check.reason || null);
  if (!check.entityResolved) return technicalFailure(ASSESSMENT_REASON.IDENTITY_UNRESOLVED);
  if (!checkIsFresh({ verifiedAt: check.verifiedAt, now })) return technicalFailure(ASSESSMENT_REASON.CHECK_STALE);

  let best = { coverage: LICENCE_COVERAGE.NO_MATCH, licence: null };
  for (const licence of check.licences || []) {
    if (!licenceInForce(licence, now)) continue;
    const coverage = licenceCoverageForService(licence, serviceKey);
    if (COVERAGE_RANK[coverage] > COVERAGE_RANK[best.coverage]) best = { coverage, licence };
  }

  if (best.coverage === LICENCE_COVERAGE.EXACT_MATCH || best.coverage === LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY) {
    const until = licenceDay(best.licence?.validUntil);
    const licenceEnds = best.licence?.indefinite || !until ? Number.POSITIVE_INFINITY : estonianDayEnd(until)?.getTime();
    const checkExpires = (toTime(check.verifiedAt) ?? toTime(now) ?? Date.now()) + MTR_CHECK_POLICY.freshnessMs;
    return {
      ...snapshot,
      coverage: best.coverage,
      publicStatus:
        best.coverage === LICENCE_COVERAGE.EXACT_MATCH
          ? LICENCE_PUBLIC_STATUS.VERIFIED
          : LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED,
      confirmedMissCount: 0,
      statusSourceCheckId: check.id || null,
      coveringLicenceNumber: best.licence?.number || best.licence?.licenceNumber || null,
      /* Lühim ankur: kas kontroll vananeb või luba lõpeb. */
      publicStatusValidUntil: new Date(Math.min(checkExpires, licenceEnds ?? Number.POSITIVE_INFINITY))
    };
  }

  /* Edukas kontroll, kehtivat luba ei leitud. Avalik NEGATIIVNE väide nõuab
     KAHTE järjestikust edukat tühja vastust — ka siis, kui varem märgist ei
     olnudki. Kolmanda isiku kohta ei väideta midagi ühe päringu pealt. */
  const misses = previousMisses + 1;
  if (misses < MTR_CHECK_POLICY.missesBeforeNotFound) {
    if (positiveEvidenceStillValid(previous, now)) {
      return { ...keepPrevious(ASSESSMENT_REASON.PENDING_SECOND_CHECK), confirmedMissCount: misses };
    }
    return {
      ...snapshot,
      coverage: best.coverage,
      publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED,
      assessmentReason: ASSESSMENT_REASON.PENDING_SECOND_CHECK,
      confirmedMissCount: misses
    };
  }

  return {
    ...snapshot,
    coverage: best.coverage,
    publicStatus: LICENCE_PUBLIC_STATUS.NOT_FOUND,
    statusSourceCheckId: check.id || null,
    confirmedMissCount: misses
  };
}

/**
 * Kas salvestatud hinnangut tohib PRAEGU avalikult positiivsena kuvada.
 * Lugemisrada peab seda kutsuma — salvestatud `VERIFIED` ei ole igavene.
 */
export function publicClaimIsCurrent(assessment, now = new Date()) {
  if (!assessment || !POSITIVE_STATUSES.includes(assessment.publicStatus)) return false;
  const until = toTime(assessment.publicStatusValidUntil);
  if (until === null) return false;
  return until > (toTime(now) ?? Date.now());
}
