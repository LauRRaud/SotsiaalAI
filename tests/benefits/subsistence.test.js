import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCountedIncome,
  calculateFamilySubsistenceLimit,
  calculateHousingNormCost,
  estimateSubsistenceBenefit,
  socallyJustifiedAreaM2
} from "../../lib/benefits/subsistence.js";
import { resolveSubsistenceRates } from "../../lib/benefits/subsistenceRates.js";

const IN_2026 = new Date("2026-08-04T00:00:00Z");

// --- Toimetulekupiir (SHS § 131 lg 3-5) --------------------------------------

test("üksi elava inimese toimetulekupiir on 2026. aastal 220 eurot", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 1, minors: 0 }, IN_2026);
  assert.equal(limit.total, 220);
  assert.deepEqual(limit.breakdown, [{ role: "FIRST_MEMBER", count: 1, unit: 220 }]);
});

test("teine täisealine on 80% ja alaealine 120% esimese liikme piirist", () => {
  const rates = resolveSubsistenceRates(IN_2026);
  assert.equal(rates.additionalAdult, Math.round(rates.firstMember * 0.8));
  assert.equal(rates.minor, Math.round(rates.firstMember * 1.2));
});

test("kahe täiskasvanu ja kahe lapsega pere piir on 220 + 176 + 2 x 264", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 2, minors: 2 }, IN_2026);
  assert.equal(limit.total, 220 + 176 + 264 + 264);
  assert.equal(limit.total, 924);
});

test("alaealine ei muutu kunagi 'teiseks täisealiseks' — täisealisteta pere esimene liige on laps", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 0, minors: 2 }, IN_2026);
  // Esimene liige täismääras (220), teine laps lapse määras (264).
  assert.equal(limit.total, 220 + 264);
  assert.equal(limit.breakdown.some((row) => row.role === "ADDITIONAL_ADULT"), false);
});

test("2025. aasta kuupäev annab 2025. aasta määra, mitte tänase", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 1 }, new Date("2025-06-01T00:00:00Z"));
  assert.equal(limit.total, 200);
});

test("tühi pere ei anna piiri", () => {
  assert.equal(calculateFamilySubsistenceLimit({ adults: 0, minors: 0 }, IN_2026).total, 0);
});

// --- Eluruumi norm (elamuseadus § 7 lg 2, SHS § 133 lg 5) --------------------

test("sotsiaalselt põhjendatud norm on 18 m2 liikme kohta pluss 15 m2 pere kohta", () => {
  assert.equal(socallyJustifiedAreaM2({ members: 1 }), 33);
  assert.equal(socallyJustifiedAreaM2({ members: 4 }), 87);
});

test("üksi elav pensionär või osalise töövõimega inimene saab kuni 51 m2", () => {
  assert.equal(socallyJustifiedAreaM2({ members: 1, singleOccupantExtendedNorm: true }), 51);
  // Erisus kehtib ainult üksi elavale — kahekesi elades jääb tavanorm.
  assert.equal(socallyJustifiedAreaM2({ members: 2, singleOccupantExtendedNorm: true }), 51);
});

test("normist väiksemat eluruumi ei kärbita", () => {
  const housing = calculateHousingNormCost({
    costs: { rent: 300, electricity: 60 },
    members: 1,
    dwellingAreaM2: 30
  });
  assert.equal(housing.areaRatio, 1);
  assert.equal(housing.total, 360);
});

test("normist suurema eluruumi puhul kärbitakse ainult PINNAST sõltuvad kulud", () => {
  // Üksi elav inimene, norm 33 m2, tegelik 66 m2 -> suhe 0,5.
  const housing = calculateHousingNormCost({
    costs: { rent: 400, electricity: 60, wasteRemoval: 10 },
    members: 1,
    dwellingAreaM2: 66
  });
  assert.equal(housing.areaRatio, 0.5);
  const rent = housing.lines.find((line) => line.key === "rent");
  const electricity = housing.lines.find((line) => line.key === "electricity");
  const waste = housing.lines.find((line) => line.key === "wasteRemoval");
  assert.equal(rent.counted, 200);
  // Elekter ja jäätmevedu ei sõltu korteri suurusest — neid ei poolitata.
  assert.equal(electricity.counted, 60);
  assert.equal(waste.counted, 10);
  assert.equal(housing.total, 270);
});

test("tundmatu kululiik jäetakse vaikselt kõrvale, mitte ei lisata summasse", () => {
  const housing = calculateHousingNormCost({
    costs: { rent: 100, internet: 30, netflix: 12 },
    members: 1,
    dwellingAreaM2: 20
  });
  assert.equal(housing.total, 100);
  assert.equal(housing.lines.length, 1);
});

// --- Sissetulek (SHS § 133 lg 1) --------------------------------------------

test("makstud elatis ja täitemenetluses kinnipeetu arvatakse sissetulekust maha", () => {
  const income = calculateCountedIncome({
    netIncome: 900,
    paidMaintenance: 200,
    enforcementWithheld: 150
  });
  assert.equal(income.total, 550);
});

test("mahaarvamised ei vii sissetulekut miinusesse", () => {
  const income = calculateCountedIncome({ netIncome: 100, paidMaintenance: 500 });
  assert.equal(income.total, 0);
});

// --- Terviktehe --------------------------------------------------------------

test("terviktehe: piir + eluaseme normkulu - sissetulek", () => {
  const result = estimateSubsistenceBenefit({
    adults: 1,
    minors: 0,
    netIncome: 150,
    housingCosts: { rent: 200, electricity: 40 },
    dwellingAreaM2: 30,
    effectiveDate: IN_2026
  });
  // 220 + 240 - 150 = 310
  assert.equal(result.subsistenceLimit.total, 220);
  assert.equal(result.housing.total, 240);
  assert.equal(result.income.total, 150);
  assert.equal(result.estimate, 310);
});

test("sissetulek üle piiri ei anna negatiivset toetust, vaid nullib ja ütleb ülejäägi", () => {
  const result = estimateSubsistenceBenefit({
    adults: 1,
    netIncome: 2000,
    housingCosts: { rent: 200 },
    dwellingAreaM2: 30,
    effectiveDate: IN_2026
  });
  assert.equal(result.estimate, 0);
  assert.equal(result.surplus, 1580);
  assert.ok(result.caveats.includes("ABOVE_SUBSISTENCE_LINE"));
});

test("tulemus ei nimeta end kunagi otsuseks ja nimetab otsustaja", () => {
  const result = estimateSubsistenceBenefit({ adults: 1, netIncome: 0, effectiveDate: IN_2026 });
  assert.equal(result.isDecision, false);
  assert.equal(result.decidedBy, "KOV");
  assert.ok(result.legalBasis.includes("SHS § 134"));
});

test("eluasemekulude olemasolul tuleb ALATI kaasa hoiatus, et KOV piirmäärad on teadmata", () => {
  const result = estimateSubsistenceBenefit({
    adults: 2,
    minors: 1,
    netIncome: 700,
    housingCosts: { rent: 350, heating: 120, electricity: 70 },
    dwellingAreaM2: 60,
    effectiveDate: IN_2026
  });
  assert.ok(result.caveats.includes("KOV_HOUSING_LIMITS_UNKNOWN"));
});

test("normi ületav pind märgitakse hoiatusena, et inimene teaks, miks summa kahanes", () => {
  const result = estimateSubsistenceBenefit({
    adults: 1,
    netIncome: 0,
    housingCosts: { rent: 400 },
    dwellingAreaM2: 66,
    effectiveDate: IN_2026
  });
  assert.ok(result.caveats.includes("AREA_ABOVE_NORM_SCALED"));
  assert.equal(result.housing.total, 200);
});

test("kinnitamata määraga kuupäev märgitakse eraldi hoiatusega", () => {
  const rates = resolveSubsistenceRates(new Date("2020-01-01T00:00:00Z"));
  assert.equal(rates.exact, false);
  const result = estimateSubsistenceBenefit({
    adults: 1,
    netIncome: 0,
    effectiveDate: new Date("2020-01-01T00:00:00Z")
  });
  assert.ok(result.caveats.includes("RATES_NOT_CONFIRMED_FOR_DATE"));
});

test("sendi ümardamine ei tekita nähtamatut toetusesenti", () => {
  const result = estimateSubsistenceBenefit({
    adults: 1,
    netIncome: 220.005,
    housingCosts: {},
    effectiveDate: IN_2026
  });
  assert.equal(Number.isInteger(result.estimate * 100), true);
});
