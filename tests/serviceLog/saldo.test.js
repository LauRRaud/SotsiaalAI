/**
 * TEENUSPÄEVIK-V1 E3 — saldo lepingutestid.
 *
 * Saldo on koht, kus viga maksab raha: üle suunatud mahu ei maksta. Iga test
 * siin kirjeldab ühte rahalist tagajärge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { checkOverrun, computeReferralBalance, monthKey } from "../../lib/serviceLog/saldo.js";
import { ALLOCATION_PERIOD, ENTRY_STATUS, SERVICE_UNIT } from "../../lib/serviceLog/constants.js";

const referral = {
  id: "ref-1",
  unit: SERVICE_UNIT.HOUR,
  allocatedQuantity: 40,
  allocationPeriod: ALLOCATION_PERIOD.MONTH
};

const entry = (over = {}) => ({
  referralId: "ref-1",
  unit: SERVICE_UNIT.HOUR,
  quantity: 10,
  date: "2026-08-10",
  status: ENTRY_STATUS.FINAL,
  ...over
});

test("kuu jääk on maht miinus kinnitatud ja mustandid", () => {
  const balance = computeReferralBalance(
    referral,
    [entry(), entry({ quantity: 5, status: ENTRY_STATUS.DRAFT })],
    { month: "2026-08" }
  );
  assert.equal(balance.allocated, 40);
  assert.equal(balance.used, 10);
  assert.equal(balance.pending, 5);
  assert.equal(balance.remaining, 25);
  assert.equal(balance.overrun, false);
});

test("TÜHISTATUD kirje ei söö kvooti", () => {
  // Muidu kaotaks osutaja mahu töö eest, mille ta ise tühistas.
  const balance = computeReferralBalance(
    referral,
    [entry(), entry({ quantity: 30, status: ENTRY_STATUS.VOID })],
    { month: "2026-08" }
  );
  assert.equal(balance.used, 10);
  assert.equal(balance.remaining, 30);
});

test("MUSTAND on jäägis eraldi nähtav, mitte peidetud", () => {
  /* Kui mustandit jäägist välja jätta, näeb osutaja vaba mahtu, mida tegelikult
     ei ole, ja avastab ülekulu alles kuu lõpus. */
  const balance = computeReferralBalance(referral, [entry({ quantity: 35, status: ENTRY_STATUS.DRAFT })], {
    month: "2026-08"
  });
  assert.equal(balance.used, 0);
  assert.equal(balance.pending, 35);
  assert.equal(balance.remaining, 5);
});

test("teise ühiku kirje ei tarbi mahtu", () => {
  // Tunnipõhine kirje ei tohi süüa kord-põhist kvooti.
  const balance = computeReferralBalance(
    referral,
    [entry({ unit: SERVICE_UNIT.SESSION, quantity: 20 })],
    { month: "2026-08" }
  );
  assert.equal(balance.used, 0);
  assert.equal(balance.entriesCounted, 0);
});

test("teise suunamise kirje ei tarbi mahtu", () => {
  const balance = computeReferralBalance(referral, [entry({ referralId: "ref-2", quantity: 20 })], {
    month: "2026-08"
  });
  assert.equal(balance.used, 0);
});

test("suunamiseta kirjet ei seota saldoga oletuse põhjal", () => {
  // Kui side ei ole kirja pandud, ei tohi saldo teda vaikselt ära süüa.
  const balance = computeReferralBalance(referral, [entry({ referralId: null, quantity: 20 })], {
    month: "2026-08"
  });
  assert.equal(balance.used, 0);
});

test("KUUPÕHINE maht taastub iga kuu", () => {
  const entries = [entry({ date: "2026-08-10" }), entry({ date: "2026-09-10" })];
  assert.equal(computeReferralBalance(referral, entries, { month: "2026-08" }).used, 10);
  assert.equal(computeReferralBalance(referral, entries, { month: "2026-09" }).used, 10);
});

test("PERIOODIPÕHINE maht ei taastu", () => {
  /* „40 h kuus" ja „40 h kokku" on eri asjad: esimene lubaks aasta jooksul
     480 h, teine 40. */
  const total = { ...referral, allocationPeriod: ALLOCATION_PERIOD.TOTAL };
  const entries = [entry({ date: "2026-08-10" }), entry({ date: "2026-09-10" })];
  const balance = computeReferralBalance(total, entries);
  assert.equal(balance.used, 20);
  assert.equal(balance.remaining, 20);
  assert.equal(balance.month, null);
});

test("määramata maht annab null-i, MITTE nulli", () => {
  // „Maht on määramata" ja „maht on otsas" on vastandlikud olukorrad.
  const balance = computeReferralBalance({ ...referral, allocatedQuantity: null }, [entry()], {
    month: "2026-08"
  });
  assert.equal(balance.allocated, null);
  assert.equal(balance.remaining, null);
  assert.equal(balance.overrun, false);
  assert.equal(balance.used, 10);
});

test("ületus on nähtav koos summaga", () => {
  const balance = computeReferralBalance(referral, [entry({ quantity: 45 })], { month: "2026-08" });
  assert.equal(balance.overrun, true);
  assert.equal(balance.remaining, -5);
  assert.equal(balance.overrunBy, 5);
});

/* --- ületamise hoiatus --------------------------------------------------- */

test("uus kirje, mis viib üle mahu, HOIATAB", () => {
  const result = checkOverrun(referral, [entry({ quantity: 35 })], {
    quantity: 10,
    date: "2026-08-20"
  });
  assert.equal(result.warn, true);
  assert.equal(result.wouldRemain, -5);
  assert.equal(result.overBy, 5);
});

test("hoiatus EI BLOKEERI — ta on number, mitte keeld", () => {
  /* Dokumenteerimata töö on halvem kui üle mahu dokumenteeritud töö. Osutaja
     peab nägema ületust ja ise otsustama, kas ta kirje kirja paneb ja KOV-iga
     räägib. */
  const result = checkOverrun(referral, [entry({ quantity: 40 })], { quantity: 5, date: "2026-08-20" });
  assert.equal(result.warn, true);
  assert.equal(typeof result.overBy, "number");
  assert.ok(!("blocked" in result));
});

test("mahu sees olev kirje ei hoiata", () => {
  const result = checkOverrun(referral, [entry()], { quantity: 5, date: "2026-08-20" });
  assert.equal(result.warn, false);
  assert.equal(result.wouldRemain, 25);
});

test("määramata mahu korral ei hoiata", () => {
  const result = checkOverrun({ ...referral, allocatedQuantity: null }, [], {
    quantity: 100,
    date: "2026-08-20"
  });
  assert.equal(result.warn, false);
  assert.equal(result.wouldRemain, null);
});

test("hoiatus arvestab kirje ENDA kuud, mitte jooksvat kuud", () => {
  // Tagantjärele sisestatud kirje peab minema oma kuu kvoodi arvele.
  const entries = [entry({ date: "2026-08-10", quantity: 38 })];
  assert.equal(checkOverrun(referral, entries, { quantity: 5, date: "2026-08-20" }).warn, true);
  assert.equal(checkOverrun(referral, entries, { quantity: 5, date: "2026-09-01" }).warn, false);
});

test("monthKey loeb kuupiiri UTC-s, nagu salvestuski", () => {
  assert.equal(monthKey("2026-08-01"), "2026-08");
  assert.equal(monthKey("2026-12-31"), "2026-12");
  assert.equal(monthKey(null), null);
  assert.equal(monthKey("sodi"), null);
});
