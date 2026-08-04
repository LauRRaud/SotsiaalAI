import assert from "node:assert/strict";
import test from "node:test";

import {
  adminDeskProjection,
  DESK_VERIFICATION_MAX_AGE_DAYS,
  DeskBlockReason,
  deskReadiness,
  isDeskReady,
  publicDeskProjection,
  PUBLIC_DESK_FIELDS
} from "../../lib/urgent/desk.js";
import { NOW, READY_DESK } from "./fakePrisma.js";

const options = { now: NOW, activeMemberCount: 1 };

function desk(overrides = {}) {
  return { ...READY_DESK, ...overrides };
}

test("valmis laud avab piirkonna ja ei kanna ühtegi takistust", () => {
  const readiness = deskReadiness(desk(), options);
  assert.equal(readiness.ready, true);
  assert.deepEqual(readiness.reasons, []);
  assert.equal(isDeskReady(desk(), options), true);
});

test("lauda ei ole -> piirkond on kinni, mitte 'vaikimisi lahti'", () => {
  const readiness = deskReadiness(null, options);
  assert.equal(readiness.ready, false);
  assert.deepEqual(readiness.reasons, [DeskBlockReason.MISSING]);
});

test("mehitamata laud ei avane ka siis, kui ta on 'aktiivne'", () => {
  // Teadmatus = kinni. Ilma mehitajata ei ole kellelegi vaatamist omistada.
  const readiness = deskReadiness(desk(), { now: NOW, activeMemberCount: 0 });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.UNSTAFFED));
});

test("mehitajate arvu puudumisel loetakse laud mehitamata (fail-closed)", () => {
  const readiness = deskReadiness(desk(), { now: NOW });
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.UNSTAFFED));
});

test("väljalülitatud laud on kinni", () => {
  const readiness = deskReadiness(desk({ isActive: false }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.INACTIVE));
});

test("Estkeeri õppetund: päevane värav sulgeb öise raja", () => {
  // Kui pöördumine peab käima päevase sotsiaaltöötaja kaudu, ei ole see
  // kiireloomuline rada ja seda ei tohi inimesele sellisena näidata.
  const readiness = deskReadiness(desk({ directContactAllowed: false }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.DIRECT_CONTACT_NOT_ALLOWED));
});

test("lugemisajata laud ei ole laud", () => {
  const readiness = deskReadiness(desk({ readingTimePromise: "   " }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.READING_TIME_MISSING));
});

test("112 piirita laud ei ole laud", () => {
  const readiness = deskReadiness(desk({ emergencyBoundary: "" }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.EMERGENCY_BOUNDARY_MISSING));
});

test("inimesele nähtavad tingimused on kõik kohustuslikud", () => {
  const blank = desk({
    publicName: "",
    openingHours: "",
    whoMayContact: "",
    costToPerson: "",
    contactChannel: ""
  });
  const readiness = deskReadiness(blank, options);
  assert.equal(readiness.ready, false);
  for (const reason of [
    DeskBlockReason.PUBLIC_NAME_MISSING,
    DeskBlockReason.OPENING_HOURS_MISSING,
    DeskBlockReason.WHO_MAY_CONTACT_MISSING,
    DeskBlockReason.COST_MISSING,
    DeskBlockReason.CONTACT_CHANNEL_MISSING
  ]) {
    assert.ok(readiness.reasons.includes(reason), `puudu: ${reason}`);
  }
});

test("kinnitamata laud on kinni", () => {
  const readiness = deskReadiness(desk({ lastVerifiedAt: null }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.NEVER_VERIFIED));
});

test("aegunud kinnitus sulgeb laua — vana lubadus ei ole lubadus", () => {
  const stale = new Date(NOW.getTime() - (DESK_VERIFICATION_MAX_AGE_DAYS + 1) * 24 * 60 * 60 * 1000);
  const readiness = deskReadiness(desk({ lastVerifiedAt: stale }), options);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.reasons.includes(DeskBlockReason.VERIFICATION_STALE));

  const fresh = new Date(NOW.getTime() - (DESK_VERIFICATION_MAX_AGE_DAYS - 1) * 24 * 60 * 60 * 1000);
  assert.equal(deskReadiness(desk({ lastVerifiedAt: fresh }), options).ready, true);
});

test("mõistetamatu aegumisaken sulgeb laua", () => {
  for (const hours of [0, -3, 500, null, "kaks"]) {
    const readiness = deskReadiness(desk({ requestLifetimeHours: hours }), options);
    assert.ok(
      readiness.reasons.includes(DeskBlockReason.LIFETIME_INVALID),
      `${hours} oleks pidanud laua sulgema`
    );
  }
});

test("avalik projektsioon on valge nimekiri: partneri sisemine korraldus ei leki", () => {
  const projection = publicDeskProjection(desk());
  assert.deepEqual(Object.keys(projection).sort(), [...PUBLIC_DESK_FIELDS].sort());
  assert.equal("ownerUserId" in projection, false);
  assert.equal("lastVerifiedAt" in projection, false);
  assert.equal("isActive" in projection, false);
  assert.equal("directContactAllowed" in projection, false);
});

test("avalik projektsioon ütleb inimesele hinna ja eelhindamise tingimuse välja", () => {
  // Estkeeri õppetund nr 5: sama nime all oli ühes vallas tasuline ja teises
  // tasuta teenus, ja inimene ei saanud teada, kas tal on õigus pöörduda.
  const projection = publicDeskProjection(desk({ costToPerson: "Tasuta.", preAssessmentRequired: true }));
  assert.equal(projection.costToPerson, "Tasuta.");
  assert.equal(projection.preAssessmentRequired, true);
  assert.equal(projection.whoMayContact, READY_DESK.whoMayContact);
});

test("admini projektsioon näitab, MIS on puudu", () => {
  const projection = adminDeskProjection(desk({ isActive: false, lastVerifiedAt: null }), options);
  assert.equal(projection.ready, false);
  assert.ok(projection.blockReasons.includes(DeskBlockReason.INACTIVE));
  assert.ok(projection.blockReasons.includes(DeskBlockReason.NEVER_VERIFIED));
  assert.equal(projection.ownerUserId, "desk_owner");
  assert.equal(projection.activeMemberCount, 1);
});
