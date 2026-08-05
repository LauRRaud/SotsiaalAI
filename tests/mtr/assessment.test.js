import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSESSMENT_REASON,
  LICENCE_PUBLIC_STATUS,
  assessServiceLicence,
  estonianDay,
  estonianDayEnd,
  licenceInForce,
  publicClaimIsCurrent
} from "../../lib/mtr/assessment.js";
import { LICENCE_COVERAGE, LICENCE_REQUIREMENT } from "../../lib/mtr/licensedServices.js";
import { manualCheckAllowed, nextCheckAfter } from "../../lib/mtr/policy.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const FRESH = new Date("2026-08-05T09:00:00.000Z");

function licence(overrides = {}) {
  return {
    number: "SEH000598",
    activity: "Erihoolekandeteenus",
    activityType: "Toetatud elamise teenus",
    validFrom: "2025-10-13",
    validUntil: null,
    indefinite: true,
    valid: true,
    ...overrides
  };
}

function okCheck(licences, overrides = {}) {
  return { id: "check-new", result: "OK", entityResolved: true, verifiedAt: FRESH, licences, ...overrides };
}

const verifiedPrevious = {
  publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
  coverage: LICENCE_COVERAGE.EXACT_MATCH,
  confirmedMissCount: 0,
  statusSourceCheckId: "check-old",
  coveringLicenceNumber: "SEH000598",
  publicStatusValidUntil: new Date("2026-08-08T09:00:00.000Z")
};

test("sidumata teenus ei tekita väidet, päringut ega seost kontrolliga", () => {
  const result = assessServiceLicence({ serviceKey: null, check: okCheck([licence()]), now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
  assert.equal(result.requirementAtAssessment, LICENCE_REQUIREMENT.UNKNOWN);
  assert.equal(result.lastAttemptCheckId, null, "seis ei tulene MTR-ist → seost ei looda");
  assert.equal(result.statusSourceCheckId, null);

  const unknown = assessServiceLicence({ serviceKey: "MIDAGI_MUUD", now: NOW });
  assert.equal(unknown.publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
});

test("loakohustuseta teenus ei seostu kontrolliga", () => {
  const result = assessServiceLicence({ serviceKey: "TUGIISIK", check: okCheck([licence()]), now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  assert.equal(result.lastAttemptCheckId, null);
  assert.equal(result.statusSourceCheckId, null);
});

test("kontrollimata teenus ei ole sama mis kinnitamata", () => {
  const notChecked = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: null, now: NOW });
  assert.equal(notChecked.publicStatus, LICENCE_PUBLIC_STATUS.NOT_CHECKED);

  const failed = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: { id: "c1", result: "UNCONFIRMED", reason: "TIMEOUT" },
    now: NOW
  });
  assert.equal(failed.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(failed.assessmentReason, "TIMEOUT");
});

test("lahendamata identiteet ja vananenud kontroll ei tooda kunagi NOT_FOUND", () => {
  const unresolved = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([], { entityResolved: false }),
    now: NOW
  });
  assert.equal(unresolved.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(unresolved.assessmentReason, ASSESSMENT_REASON.IDENTITY_UNRESOLVED);

  const stale = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence()], { verifiedAt: new Date("2026-08-01T09:00:00.000Z") }),
    now: NOW
  });
  assert.equal(stale.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(stale.assessmentReason, ASSESSMENT_REASON.CHECK_STALE);
});

test("täpne vaste annab VERIFIED, jäme vaste OMA seisu", () => {
  const exact = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([licence()]), now: NOW });
  assert.equal(exact.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(exact.coverage, LICENCE_COVERAGE.EXACT_MATCH);
  assert.equal(exact.statusSourceCheckId, "check-new");
  assert.equal(exact.coveringLicenceNumber, "SEH000598");
  assert.equal(exact.activityTypeExpected, "Toetatud elamise teenus");
  assert.equal(exact.catalogueVersion, "2026-08-05.2");
  assert.equal(exact.coverageScope, "ORGANISATION", "V1 märgis on organisatsiooni tasandi kontroll");

  /* Jäme vaste EI OLE `VERIFIED` — nii ei saa liides teda täpse märgisena
     renderdada ainult `publicStatus` põhjal. */
  const coarse = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence({ activityType: null })]),
    now: NOW
  });
  assert.equal(coarse.publicStatus, LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED);
  assert.equal(coarse.coverage, LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY);
});

test("loa kuupäevad on Eesti kalendripäevad, mitte UTC-hetked", () => {
  assert.equal(estonianDay(new Date("2026-08-05T22:00:00.000Z")), "2026-08-06", "22 UTC on Eestis juba järgmine päev");
  assert.equal(estonianDayEnd("2026-08-06").toISOString(), "2026-08-06T21:00:00.000Z");
  assert.equal(estonianDayEnd("2026-01-06").toISOString(), "2026-01-06T22:00:00.000Z", "talvel UTC+2");

  const endsToday = licence({ indefinite: false, validUntil: "2026-08-05" });
  assert.equal(licenceInForce(endsToday, new Date("2026-08-05T10:00:00.000Z")), true);
  /* Sama luba 22:00 UTC = Eestis 6. august kell 01:00 → enam ei kehti. */
  assert.equal(licenceInForce(endsToday, new Date("2026-08-05T22:00:00.000Z")), false);

  assert.equal(licenceInForce(licence({ valid: false }), NOW), false);
  assert.equal(licenceInForce(licence({ validFrom: "2027-01-01" }), NOW), false);
  assert.equal(licenceInForce(licence({ validFrom: new Date("2025-10-13T00:00:00.000Z") }), NOW), true, "Date-kuju");
});

test("esimene tühi vastus ei tooda avalikku negatiivset väidet", () => {
  /* Variant 1: KÕIK avalikud NOT_FOUND seisud vajavad kahte järjestikust
     edukat tühja vastust — ka siis, kui varem märgist ei olnudki. */
  const first = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([]), previous: null, now: NOW });
  assert.equal(first.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(first.assessmentReason, ASSESSMENT_REASON.PENDING_SECOND_CHECK);
  assert.equal(first.confirmedMissCount, 1);

  const second = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([]),
    previous: { publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED, confirmedMissCount: 1 },
    now: NOW
  });
  assert.equal(second.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
  assert.equal(second.confirmedMissCount, 2);
  assert.equal(second.statusSourceCheckId, "check-new");
});

test("kadunud luba: märgis püsib vana TÕENDI najal, mitte uue kontrolli najal", () => {
  const first = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([]),
    previous: verifiedPrevious,
    now: NOW
  });

  assert.equal(first.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(first.confirmedMissCount, 1);
  assert.equal(first.assessmentReason, ASSESSMENT_REASON.PENDING_SECOND_CHECK);
  /* KANDEV: tõend jääb VANA kontrolli külge, muidu kuvaks liides
     „kontrollitud 5. augustil" kontrolli pealt, mis luba EI leidnud. */
  assert.equal(first.statusSourceCheckId, "check-old");
  assert.equal(first.lastAttemptCheckId, "check-new");
  assert.equal(first.publicStatusValidUntil.toISOString(), "2026-08-08T09:00:00.000Z");
});

test("aegunud tõend ei hoia märgist püsti", () => {
  const expired = { ...verifiedPrevious, publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z") };
  const result = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([]), previous: expired, now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED, "vana tõend on aegunud, teda ei pikendata");
  assert.equal(result.statusSourceCheckId, null);
});

test("tehniline tõrge nullib puudumiste loenduri", () => {
  const result = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: { id: "c2", result: "UNCONFIRMED", reason: "TIMEOUT" },
    previous: { publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED, confirmedMissCount: 1 },
    now: NOW
  });
  /* „Kaks järjestikust EDUKAT registrivastust" — tõrkega eraldatud puudumised
     ei ole järjestikused. */
  assert.equal(result.confirmedMissCount, 0);

  /* Kehtiv tõend jääb tõrke ajal alles, aga loendur nullitakse. */
  const withEvidence = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: { id: "c2", result: "UNCONFIRMED", reason: "TIMEOUT" },
    previous: { ...verifiedPrevious, confirmedMissCount: 1 },
    now: NOW
  });
  assert.equal(withEvidence.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(withEvidence.statusSourceCheckId, "check-old");
  assert.equal(withEvidence.confirmedMissCount, 0);
});

test("vale alateenuse luba ei kata teist alateenust", () => {
  const result = assessServiceLicence({ serviceKey: "KOGUKONNAS_ELAMINE", check: okCheck([licence()]), previous: { confirmedMissCount: 1 }, now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
  assert.equal(result.coverage, LICENCE_COVERAGE.NO_MATCH);
});

test("positiivne seis kehtib lühima ankru järgi ja lugemisrada jõustab selle", () => {
  const indefinite = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([licence()]), now: NOW });
  assert.equal(indefinite.publicStatusValidUntil.toISOString(), "2026-08-08T09:00:00.000Z", "ankruks kontrolli värskus");

  const ending = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence({ indefinite: false, validUntil: "2026-08-06" })]),
    now: NOW
  });
  assert.equal(ending.publicStatusValidUntil.toISOString(), "2026-08-06T21:00:00.000Z", "luba lõpeb enne");

  assert.equal(publicClaimIsCurrent(ending, NOW), true);
  assert.equal(publicClaimIsCurrent(ending, new Date("2026-08-07T00:00:00.000Z")), false);
  assert.equal(publicClaimIsCurrent({ publicStatus: LICENCE_PUBLIC_STATUS.NOT_FOUND }, NOW), false);
  assert.equal(publicClaimIsCurrent(null, NOW), false);
});

test("korje rütm ja käsitsi jahtumine on konfiguratsioonist", () => {
  assert.equal(nextCheckAfter({ succeeded: true, now: NOW }).toISOString(), "2026-08-06T12:00:00.000Z");
  assert.equal(nextCheckAfter({ succeeded: false, consecutiveFailures: 0, now: NOW }).toISOString(), "2026-08-05T13:00:00.000Z");
  assert.equal(nextCheckAfter({ succeeded: false, consecutiveFailures: 1, now: NOW }).toISOString(), "2026-08-05T18:00:00.000Z");
  assert.equal(nextCheckAfter({ succeeded: false, consecutiveFailures: 9, now: NOW }).toISOString(), "2026-08-06T12:00:00.000Z");

  assert.equal(manualCheckAllowed({ lastAttemptAt: null, now: NOW }), true);
  assert.equal(manualCheckAllowed({ lastAttemptAt: new Date("2026-08-05T11:50:00.000Z"), now: NOW }), false);
  assert.equal(manualCheckAllowed({ lastAttemptAt: new Date("2026-08-05T11:40:00.000Z"), now: NOW }), true);
});
