import test from "node:test";
import assert from "node:assert/strict";

import {
  ASSESSMENT_REASON,
  LICENCE_PUBLIC_STATUS,
  assessServiceLicence,
  licenceInForce
} from "../../lib/mtr/assessment.js";
import { LICENCE_COVERAGE, LICENCE_REQUIREMENT } from "../../lib/mtr/licensedServices.js";
import { manualCheckAllowed, nextCheckAfter } from "../../lib/mtr/policy.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const FRESH = new Date("2026-08-05T09:00:00.000Z");

function licence(overrides = {}) {
  return {
    licenceNumber: "SEH000598",
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
  return { result: "OK", entityResolved: true, verifiedAt: FRESH, licences, ...overrides };
}

test("sidumata teenus ei tekita väidet ega päringut", () => {
  const result = assessServiceLicence({ serviceKey: null, now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
  assert.equal(result.requirementAtAssessment, LICENCE_REQUIREMENT.UNKNOWN);
  assert.equal(result.coverage, LICENCE_COVERAGE.UNCONFIRMED);

  /* Tundmatu võti käitub samamoodi — kataloogist puuduv rida ei ole otsus. */
  const unknown = assessServiceLicence({ serviceKey: "MIDAGI_MUUD", now: NOW });
  assert.equal(unknown.publicStatus, LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED);
});

test("loakohustuseta teenus ei vaja kontrolli", () => {
  const result = assessServiceLicence({ serviceKey: "TUGIISIK", now: NOW });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED);
  assert.equal(result.requirementAtAssessment, LICENCE_REQUIREMENT.NO_SHS_LICENCE_REQUIRED);
});

test("kontrollimata teenus ei ole sama mis kinnitamata", () => {
  const notChecked = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: null, now: NOW });
  assert.equal(notChecked.publicStatus, LICENCE_PUBLIC_STATUS.NOT_CHECKED);

  const failed = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: { result: "UNCONFIRMED", reason: "TIMEOUT" },
    now: NOW
  });
  assert.equal(failed.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(failed.reason, "TIMEOUT");
});

test("lahendamata identiteet ja vananenud kontroll ei tooda kunagi NOT_FOUND", () => {
  const unresolved = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([], { entityResolved: false }),
    now: NOW
  });
  assert.equal(unresolved.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(unresolved.reason, ASSESSMENT_REASON.IDENTITY_UNRESOLVED);

  const stale = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence()], { verifiedAt: new Date("2026-08-01T09:00:00.000Z") }),
    now: NOW
  });
  assert.equal(stale.publicStatus, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(stale.reason, ASSESSMENT_REASON.CHECK_STALE);
});

test("täpne liik annab VERIFIED ja salvestab ootuse koopiana", () => {
  const result = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence()]),
    now: NOW
  });

  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(result.coverage, LICENCE_COVERAGE.EXACT_MATCH);
  /* 3. põhimõte: ootus salvestatakse hindamise hetke kujul. */
  assert.equal(result.requirementAtAssessment, LICENCE_REQUIREMENT.REQUIRED);
  assert.equal(result.activityExpected, "Erihoolekandeteenus");
  assert.equal(result.activityTypeExpected, "Toetatud elamise teenus");
  assert.equal(result.catalogueVersion, "2026-08-05.2");
  assert.equal(result.consecutiveMissCount, 0);
});

test("liigita luba annab VERIFIED, aga ainult jämedal tasemel", () => {
  const result = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence({ activityType: null })]),
    now: NOW
  });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(result.coverage, LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY);
});

test("vale alateenuse luba ei kata teist alateenust", () => {
  const result = assessServiceLicence({
    serviceKey: "KOGUKONNAS_ELAMINE",
    check: okCheck([licence()]),
    now: NOW
  });
  assert.equal(result.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
  assert.equal(result.coverage, LICENCE_COVERAGE.NO_MATCH);
});

test("lõppenud või veel algamata luba ei kanna märgist", () => {
  assert.equal(licenceInForce(licence(), NOW), true);
  assert.equal(licenceInForce(licence({ valid: false }), NOW), false);
  assert.equal(licenceInForce(licence({ validFrom: "2027-01-01" }), NOW), false);
  assert.equal(
    licenceInForce(licence({ indefinite: false, validUntil: "2024-12-31" }), NOW),
    false,
    "lõppkuupäev lõpetab seisu kohe, sõltumata korjest"
  );
  assert.equal(
    licenceInForce(licence({ indefinite: false, validUntil: "2026-08-05" }), NOW),
    true,
    "lõpupäev ise on veel kehtiv"
  );

  const expired = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence({ indefinite: false, validUntil: "2024-12-31" })]),
    now: NOW
  });
  assert.equal(expired.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
});

test("kadunud luba ei kustuta märgist esimese kontrolliga", () => {
  const previous = { publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED, consecutiveMissCount: 0, coverage: LICENCE_COVERAGE.EXACT_MATCH };

  const first = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([]), previous, now: NOW });
  assert.equal(first.publicStatus, LICENCE_PUBLIC_STATUS.VERIFIED, "üks kapriis ei tee avalikku väidet");
  assert.equal(first.consecutiveMissCount, 1);
  assert.equal(first.reason, ASSESSMENT_REASON.PENDING_SECOND_CHECK);

  const second = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([]),
    previous: { ...previous, consecutiveMissCount: 1 },
    now: NOW
  });
  assert.equal(second.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
  assert.equal(second.consecutiveMissCount, 2);

  /* Kui varem märgist ei olnudki, ei ole midagi kaitsta. */
  const fresh = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([]), previous: null, now: NOW });
  assert.equal(fresh.publicStatus, LICENCE_PUBLIC_STATUS.NOT_FOUND);
});

test("positiivne seis kehtib lühima ankru järgi", () => {
  const indefinite = assessServiceLicence({ serviceKey: "TOETATUD_ELAMINE", check: okCheck([licence()]), now: NOW });
  /* Tähtajatu luba → ankruks jääb kontrolli värskus (72 h). */
  assert.equal(indefinite.publicStatusValidUntil.toISOString(), "2026-08-08T09:00:00.000Z");

  const ending = assessServiceLicence({
    serviceKey: "TOETATUD_ELAMINE",
    check: okCheck([licence({ indefinite: false, validUntil: "2026-08-06" })]),
    now: NOW
  });
  assert.equal(ending.publicStatusValidUntil.toISOString(), "2026-08-07T00:00:00.000Z", "luba lõpeb enne kontrolli vananemist");
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
