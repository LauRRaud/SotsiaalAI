import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { LICENCE_PUBLIC_STATUS } from "../../lib/mtr/assessment.js";
import { LICENCE_COVERAGE } from "../../lib/mtr/licensedServices.js";
import { BADGE_TONE, BADGE_VISIBILITY, internalLicenceStatus, publicLicenceBadge } from "../../lib/mtr/statusText.js";

const NOW = new Date("2026-08-05T12:00:00.000Z");
const VALID_UNTIL = new Date("2026-08-08T09:00:00.000Z");

function assessment(overrides = {}) {
  return {
    publicStatus: LICENCE_PUBLIC_STATUS.VERIFIED,
    coverage: LICENCE_COVERAGE.EXACT_MATCH,
    publicStatusValidUntil: VALID_UNTIL,
    activityExpected: "Erihoolekandeteenus",
    verifiedAt: new Date("2026-08-05T09:00:00.000Z"),
    ...overrides
  };
}

function messageAt(locale, key) {
  const data = JSON.parse(fs.readFileSync(new URL(`../../messages/${locale}.json`, import.meta.url), "utf8"));
  return key.split(".").reduce((node, part) => (node == null ? node : node[part]), data);
}

test("täpne ja jäme vaste annavad ERI teksti", () => {
  const exact = publicLicenceBadge(assessment(), { now: NOW });
  assert.equal(exact.status, LICENCE_PUBLIC_STATUS.VERIFIED);
  assert.equal(exact.tone, BADGE_TONE.POSITIVE);
  assert.equal(exact.key, "service_provider_profile.licence.public.verified");
  assert.equal(exact.caveatKey, null);

  const coarse = publicLicenceBadge(
    assessment({ publicStatus: LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED, coverage: LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY }),
    { now: NOW }
  );
  assert.equal(coarse.key, "service_provider_profile.licence.public.activity_verified");
  assert.equal(coarse.params.activity, "Erihoolekandeteenus");
  assert.ok(coarse.caveatKey, "jäme vaste peab kandma hoiatust alaliigi kohta");
});

test("VERIFIED ilma täpse vasteta ei tohi anda täpset märgist", () => {
  /* Kaitse vale salvestuse vastu: kui seis ütleb VERIFIED, aga kaetus ei ole
     täpne, käitume ettevaatlikumast otsast. */
  const badge = publicLicenceBadge(assessment({ coverage: LICENCE_COVERAGE.ACTIVITY_MATCH_ONLY }), { now: NOW });
  assert.equal(badge.status, LICENCE_PUBLIC_STATUS.ACTIVITY_VERIFIED);
  assert.ok(badge.caveatKey);
});

test("aegunud tõend ei paista avalikult positiivsena", () => {
  const badge = publicLicenceBadge(assessment({ publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z") }), { now: NOW });
  assert.equal(badge.status, LICENCE_PUBLIC_STATUS.UNCONFIRMED);
  assert.equal(badge.tone, BADGE_TONE.NEUTRAL);
  assert.equal(badge.key, "service_provider_profile.licence.public.unconfirmed");
});

test("kolm ülejäänud seisu on avalikud ja neutraalsed", () => {
  for (const [status, key] of [
    [LICENCE_PUBLIC_STATUS.NO_SHS_LICENCE_REQUIRED, "no_licence_required"],
    [LICENCE_PUBLIC_STATUS.NOT_FOUND, "not_found"],
    [LICENCE_PUBLIC_STATUS.NOT_CHECKED, "unconfirmed"]
  ]) {
    const badge = publicLicenceBadge(assessment({ publicStatus: status, publicStatusValidUntil: null }), { now: NOW });
    assert.equal(badge.tone, BADGE_TONE.NEUTRAL, `${status} ei tohi olla positiivne`);
    assert.equal(badge.visibility, BADGE_VISIBILITY.PUBLIC);
    assert.equal(badge.key, `service_provider_profile.licence.public.${key}`);
  }
});

test("sidumata teenusel ei ole avalikku silti", () => {
  const badge = publicLicenceBadge(assessment({ publicStatus: LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED }), { now: NOW });
  assert.equal(badge.visibility, BADGE_VISIBILITY.INTERNAL_ONLY);
  assert.equal(badge.key, null, "silti ei ole ega tohi olla");
  assert.equal(publicLicenceBadge(null, { now: NOW }), null);
});

test("osutaja vaade ütleb põhjuse ja parandustee", () => {
  const unresolved = internalLicenceStatus(
    assessment({ publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED, assessmentReason: "IDENTITY_UNRESOLVED", publicStatusValidUntil: null }),
    { now: NOW }
  );
  assert.equal(unresolved.reasonKey, "service_provider_profile.licence.internal.reason.identity_unresolved");
  assert.equal(unresolved.actionKey, "service_provider_profile.licence.internal.action_fix_registry_code");

  const mapping = internalLicenceStatus(assessment({ publicStatus: LICENCE_PUBLIC_STATUS.SERVICE_MAPPING_REQUIRED }), { now: NOW });
  assert.equal(mapping.key, "service_provider_profile.licence.internal.mapping_required");
  assert.equal(mapping.actionKey, "service_provider_profile.licence.internal.action_map_service");

  const expired = internalLicenceStatus(assessment({ publicStatusValidUntil: new Date("2026-08-04T09:00:00.000Z") }), { now: NOW });
  assert.equal(expired.key, "service_provider_profile.licence.internal.expired");
  assert.equal(expired.actionKey, "service_provider_profile.licence.internal.action_recheck");

  assert.equal(internalLicenceStatus(null).key, "service_provider_profile.licence.internal.not_checked");
});

test("iga viidatud tõlkevõti on olemas kõigis kolmes keeles", () => {
  const keys = new Set();
  const collect = (badge) => {
    if (badge?.key) keys.add(badge.key);
    if (badge?.caveatKey) keys.add(badge.caveatKey);
    if (badge?.reasonKey) keys.add(badge.reasonKey);
    if (badge?.actionKey) keys.add(badge.actionKey);
  };

  for (const status of Object.values(LICENCE_PUBLIC_STATUS)) {
    collect(publicLicenceBadge(assessment({ publicStatus: status }), { now: NOW }));
    collect(internalLicenceStatus(assessment({ publicStatus: status }), { now: NOW }));
  }
  for (const reason of ["IDENTITY_UNRESOLVED", "CHECK_STALE", "PENDING_SECOND_CHECK", "INVALID_REGISTRY_CODE", "TIMEOUT"]) {
    collect(
      internalLicenceStatus(
        assessment({ publicStatus: LICENCE_PUBLIC_STATUS.UNCONFIRMED, assessmentReason: reason, publicStatusValidUntil: null }),
        { now: NOW }
      )
    );
  }

  assert.ok(keys.size >= 8, `oodatud vähemalt 8 võtit, saadi ${keys.size}`);
  for (const locale of ["et", "en", "ru"]) {
    for (const key of keys) {
      assert.equal(typeof messageAt(locale, key), "string", `${locale}: puudub ${key}`);
    }
  }
});
