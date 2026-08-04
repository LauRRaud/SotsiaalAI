import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateCountedIncome,
  calculateFamilySubsistenceLimit,
  calculateHousingNormCost,
  estimateSubsistenceBenefit,
  resolveNormAreaM2
} from "../../lib/benefits/subsistence.js";
import { resolveSubsistenceRates } from "../../lib/benefits/subsistenceRates.js";

const IN_2026 = new Date("2026-08-04T00:00:00Z");

// Väravad, mis peavad olema vastatud, et eluasemekulu üldse arvesse läheks.
// Testides kasutame neid vaikimisi, et iga test ei peaks neid kordama.
const OPEN_GATES = {
  costsAreCurrentMonth: true,
  landlordIsFamilyOrTheirCompany: false,
  isApartmentBuilding: true,
  housingLoanConditionsMet: true,
  housingLoanMonthsUsedThisYear: 0
};

function estimate(overrides = {}) {
  return estimateSubsistenceBenefit({
    effectiveDate: IN_2026,
    gates: OPEN_GATES,
    ...overrides
  });
}

function codes(result) {
  return result.issues.map((issue) => issue.code);
}

// --- Toimetulekupiir (SHS § 131 lg 3-5) --------------------------------------

test("üksi elava inimese toimetulekupiir on 2026. aastal 220 eurot", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 1, minors: 0 }, IN_2026);
  assert.equal(limit.total, 220);
});

test("teine täisealine on 80% ja alaealine 120% esimese liikme piirist", () => {
  const rates = resolveSubsistenceRates(IN_2026);
  assert.equal(rates.additionalAdult, Math.round(rates.firstMember * 0.8));
  assert.equal(rates.minor, Math.round(rates.firstMember * 1.2));
});

test("kahe täiskasvanu ja kahe lapsega pere piir on 220 + 176 + 2 x 264", () => {
  assert.equal(calculateFamilySubsistenceLimit({ adults: 2, minors: 2 }, IN_2026).total, 924);
});

test("alaealine ei muutu kunagi 'teiseks täisealiseks'", () => {
  const limit = calculateFamilySubsistenceLimit({ adults: 0, minors: 2 }, IN_2026);
  assert.equal(limit.total, 220 + 264);
  assert.equal(limit.breakdown.some((row) => row.role === "ADDITIONAL_ADULT"), false);
});

// --- AUDIT LEID A: kuupäev peab olema fail-closed ----------------------------

test("LEID A: tuleviku kuupäev EI saa 2026. määra kinnitatuna", () => {
  const future = resolveSubsistenceRates(new Date("2027-08-04T00:00:00Z"));
  assert.equal(future.exact, false);
  assert.equal(future.reason, "NO_CONFIRMED_RATE_FOR_YEAR");
});

test("LEID A: kinnitamata määraga kuupäev keeldub summat andmast", () => {
  const result = estimate({ adults: 1, effectiveDate: new Date("2027-08-04T00:00:00Z") });
  assert.equal(result.usable, false);
  assert.equal(result.estimate, null);
  assert.ok(codes(result).includes("UNSUPPORTED_DATE"));
});

test("LEID A: liiga vana kuupäev keeldub samuti", () => {
  const result = estimate({ adults: 1, effectiveDate: new Date("2020-01-01T00:00:00Z") });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("UNSUPPORTED_DATE"));
});

test("2025. aasta kuupäev on endiselt kinnitatud ja annab 2025. määra", () => {
  const rates = resolveSubsistenceRates(new Date("2025-06-01T00:00:00Z"));
  assert.equal(rates.exact, true);
  assert.equal(rates.firstMember, 200);
});

// --- AUDIT LEID B: maamaks on pinnapõhine ------------------------------------

test("LEID B: maamaks on pinnapõhine kulu, mitte tarbimispõhine", () => {
  const issues = [];
  const caveats = [];
  const housing = calculateHousingNormCost({
    costs: { landTax: 100 },
    members: 1,
    dwellingAreaM2: 66,
    rooms: 3,
    issues,
    caveats
  });
  // Norm 33 m2, tegelik 66 m2, tube 3 vs 1 elanik -> kärbitakse suhtega 0,5.
  assert.equal(housing.lines.find((line) => line.key === "landTax").counted, 50);
});

// --- AUDIT LEID C: kärpimismehhanism on nimeliselt eeldus ---------------------

test("LEID C: ilma KOV piirmäärata märgitakse meetod EELDUSEKS, mitte seaduseks", () => {
  const result = estimate({
    adults: 1,
    otherIncome: 0,
    housingCosts: { rent: 400 },
    dwellingAreaM2: 66,
    rooms: 2
  });
  assert.equal(result.housing.method, "ASSUMED_PROPORTIONAL");
  assert.ok(result.caveats.includes("HOUSING_METHOD_ASSUMED_PROPORTIONAL"));
  assert.ok(result.caveats.includes("KOV_HOUSING_LIMITS_UNKNOWN"));
});

test("LEID C: KOV piirmäära olemasolul tehakse statuudijärgne min(kulu, piirmäär x normpind)", () => {
  const result = estimate({
    adults: 1,
    otherIncome: 0,
    housingCosts: { rent: 400 },
    dwellingAreaM2: 66,
    rooms: 2,
    capsPerM2: { rent: 5 }
  });
  assert.equal(result.housing.method, "KOV_CAPS_PER_M2");
  // Norm 33 m2 x 5 EUR/m2 = 165 < 400 deklareeritud.
  assert.equal(result.housing.lines.find((line) => line.key === "rent").counted, 165);
  assert.ok(!result.caveats.includes("KOV_HOUSING_LIMITS_UNKNOWN"));
});

// --- AUDIT LEID D: tubade arv == elanike arv ---------------------------------

test("LEID D: kui tube on sama palju kui elanikke, on normpind KOGU üldpind", () => {
  const { normAreaM2, basis } = resolveNormAreaM2({ members: 2, dwellingAreaM2: 80, rooms: 2 });
  assert.equal(normAreaM2, 80);
  assert.equal(basis, "ROOMS_EQUAL_RESIDENTS");
});

test("LEID D: tubade arvu erinevusel kehtib tavanorm", () => {
  const { normAreaM2 } = resolveNormAreaM2({ members: 2, dwellingAreaM2: 80, rooms: 4 });
  assert.equal(normAreaM2, 2 * 18 + 15);
});

test("LEID D: normi ületav pind ilma tubade arvuta keeldub, mitte ei oleta", () => {
  const result = estimate({
    adults: 1,
    housingCosts: { rent: 400 },
    dwellingAreaM2: 66
  });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("ROOM_COUNT_REQUIRED"));
});

test("üksi elav pensionär saab kuni 51 m2", () => {
  const { normAreaM2, basis } = resolveNormAreaM2({
    members: 1,
    dwellingAreaM2: 51,
    singleOccupantExtendedNorm: true
  });
  assert.equal(normAreaM2, 51);
  assert.equal(basis, "SINGLE_OCCUPANT_51M2");
});

// --- AUDIT LEID E: kohustuslikud väravad -------------------------------------

test("LEID E: sugulaselt üüritud eluruumi üür ei lähe arvesse", () => {
  const result = estimate({
    adults: 1,
    housingCosts: { rent: 300 },
    dwellingAreaM2: 30,
    gates: { ...OPEN_GATES, landlordIsFamilyOrTheirCompany: true }
  });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("RENT_FROM_FAMILY_NOT_COUNTED"));
});

test("LEID E: vastamata värav blokeerib, ei muutu vaikseks eelduseks", () => {
  const result = estimateSubsistenceBenefit({
    effectiveDate: IN_2026,
    adults: 1,
    housingCosts: { rent: 300 },
    dwellingAreaM2: 30
  });
  assert.equal(result.usable, false);
  const unanswered = result.issues.filter((issue) => issue.code === "GATE_UNANSWERED").map((i) => i.field);
  assert.ok(unanswered.includes("gates.landlordIsFamilyOrTheirCompany"));
  assert.ok(unanswered.includes("gates.costsAreCurrentMonth"));
});

test("LEID E: eluasemelaenu kuue kuu piir kalendriaastas (SHS 133 lg 9-2)", () => {
  const result = estimate({
    adults: 1,
    housingCosts: { housingLoan: 250 },
    dwellingAreaM2: 30,
    gates: { ...OPEN_GATES, housingLoanMonthsUsedThisYear: 6 }
  });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("HOUSING_LOAN_MONTH_LIMIT_REACHED"));
});

test("LEID E: korterelamu kulud eramaja puhul ei kohaldu", () => {
  const result = estimate({
    adults: 1,
    housingCosts: { buildingManagement: 90 },
    dwellingAreaM2: 30,
    gates: { ...OPEN_GATES, isApartmentBuilding: false }
  });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("APARTMENT_BUILDING_COSTS_NOT_APPLICABLE"));
});

// --- AUDIT LEID F: sisendivead ei muutu vaikselt nulliks ---------------------

test("LEID F: tundmatu kululiik blokeerib, ei kao vaikselt", () => {
  const result = estimate({
    adults: 1,
    housingCosts: { internet: 99 },
    dwellingAreaM2: 30
  });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("UNKNOWN_HOUSING_COST_KIND"));
});

test("LEID F: puuduv eluruumi pind ei tähenda enam 'ei kärbita'", () => {
  const result = estimate({ adults: 1, housingCosts: { rent: 300 } });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("DWELLING_AREA_REQUIRED"));
});

test("LEID F: negatiivne summa blokeerib", () => {
  const result = estimate({ adults: 1, otherIncome: -50 });
  assert.equal(result.usable, false);
  assert.ok(codes(result).includes("NEGATIVE_AMOUNT"));
});

test("LEID F: null pereliikmega ei anta positiivset tulemust", () => {
  const result = estimate({ adults: 0, minors: 0, housingCosts: { rent: 200 }, dwellingAreaM2: 30 });
  assert.equal(result.usable, false);
  assert.equal(result.estimate, null);
  assert.ok(codes(result).includes("NO_FAMILY_MEMBERS"));
});

// --- AUDIT LEID G: sissetulek liigiti ---------------------------------------

test("LEID G: seaduses välistatud tulu ei lähe arvesse ega vaja kasutajalt lahutamist", () => {
  const income = calculateCountedIncome({
    otherIncome: 400,
    statutorilyExcludedIncome: 150
  });
  assert.equal(income.total, 400);
  assert.equal(income.statutorilyExcludedIncome, 150);
});

test("LEID G: töise tulu erand -- kahel kuul 100%, seejärel neljal kuul 50%", () => {
  const first = calculateCountedIncome({ workIncome: 600, workIncomeExemptionMonth: 1 });
  assert.equal(first.total, 0);
  assert.equal(first.workIncomeExempt, 600);

  const third = calculateCountedIncome({ workIncome: 600, workIncomeExemptionMonth: 3 });
  assert.equal(third.total, 300);

  const seventh = calculateCountedIncome({ workIncome: 600, workIncomeExemptionMonth: null });
  assert.equal(seventh.total, 600);
});

test("makstud elatis ja täitemenetluses kinnipeetu arvatakse maha", () => {
  const income = calculateCountedIncome({
    otherIncome: 900,
    paidMaintenance: 200,
    enforcementWithheld: 150
  });
  assert.equal(income.total, 550);
});

test("mahaarvamised ei vii sissetulekut miinusesse", () => {
  assert.equal(calculateCountedIncome({ otherIncome: 100, paidMaintenance: 500 }).total, 0);
});

// --- Terviktehe --------------------------------------------------------------

test("terviktehe: piir + eluaseme normkulu - sissetulek", () => {
  const result = estimate({
    adults: 1,
    otherIncome: 150,
    housingCosts: { rent: 200, electricity: 40 },
    dwellingAreaM2: 30,
    rooms: 1
  });
  assert.equal(result.usable, true);
  assert.equal(result.subsistenceLimit.total, 220);
  assert.equal(result.housing.total, 240);
  assert.equal(result.income.total, 150);
  assert.equal(result.estimate, 310);
});

test("sissetulek üle piiri nullib toetuse ja ütleb ülejäägi", () => {
  const result = estimate({
    adults: 1,
    otherIncome: 2000,
    housingCosts: { rent: 200 },
    dwellingAreaM2: 30,
    rooms: 1
  });
  assert.equal(result.estimate, 0);
  assert.equal(result.surplus, 1580);
  assert.ok(result.caveats.includes("ABOVE_SUBSISTENCE_LINE"));
});

test("tulemus ei nimeta end kunagi otsuseks ja nimetab otsustaja", () => {
  const result = estimate({ adults: 1, otherIncome: 0 });
  assert.equal(result.isDecision, false);
  assert.equal(result.decidedBy, "KOV");
  assert.ok(result.legalBasis.includes("SHS § 134"));
});

test("kasutamatu tulemus ei kanna kunagi summat", () => {
  const result = estimate({ adults: 1, housingCosts: { internet: 5 } });
  assert.equal(result.usable, false);
  assert.equal(result.estimate, null);
  assert.equal(result.surplus, null);
});

test("sendi ümardamine ei tekita nähtamatut toetusesenti", () => {
  const result = estimate({ adults: 1, otherIncome: 220.005 });
  assert.equal(Number.isInteger(result.estimate * 100), true);
});
