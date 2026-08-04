// TOIMETULEKUTOETUSE EELKALKULAATOR — aritmeetika ja selgitus, MITTE otsus.
//
// SHS § 134 järgi määrab toimetulekutoetuse valla- või linnavalitsus. See moodul
// ei hinda kellegi õigust teenusele ega abivajaduse taset.
//
// PÕHIMÕTE PÄRAST 04.08 AUDITIT: **kahtluse korral ei anna number, vaid keeldub.**
// Varasem versioon andis mitmes olukorras usutava, kuid vale summa — tundmatu
// kululiik kadus vaikselt nulliks, tuleviku kuupäev sai eelmise aasta määra
// „kinnitatud" märkega, kohustuslikud erandid puudusid. Usutav vale number on
// selle toote kõige halvem väljund: inimene teeb selle põhjal otsuse.
//
// Seega on tulemusel kaks eri asja:
//   - `issues`  = BLOKEERIVAD. Nende olemasolul on `usable: false` ja
//                 `estimate: null`. Numbrit ei tohi kuvada.
//   - `caveats` = mitteblokeerivad hoiatused, mis peavad nähtavalt kaasas käima.
//
// Valem (SKA „KOV-idele SHS TTT kommenteeritud variant 2026", 12.03.2026):
//   toimetulekutoetus = pereliikmete arvestuslik toimetulekupiir
//                     + eluaseme normkulu
//                     - sissetulekud

import {
  HOUSING_COST_KINDS,
  HOUSING_LOAN_MAX_MONTHS_PER_YEAR,
  resolveSubsistenceRates,
  SINGLE_OCCUPANT_MAX_AREA_M2,
  SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2,
  SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2
} from "./subsistenceRates.js";

const HOUSING_COST_BY_KEY = new Map(HOUSING_COST_KINDS.map((kind) => [kind.key, kind]));

function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

// Vigane summa EI muutu nulliks — ta annab blokeeriva vea. Vaikne null oli
// auditi leid F.
function readAmount(value, field, issues) {
  if (value == null || value === "") return 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    issues.push({ code: "INVALID_AMOUNT", field });
    return 0;
  }
  if (parsed < 0) {
    issues.push({ code: "NEGATIVE_AMOUNT", field });
    return 0;
  }
  return parsed;
}

/**
 * Perekonna arvestuslik toimetulekupiir. SHS § 131 lg 3–5.
 */
export function calculateFamilySubsistenceLimit({ adults = 0, minors = 0 }, effectiveDate) {
  const rates = resolveSubsistenceRates(effectiveDate);
  const adultCount = Math.max(0, Math.trunc(Number(adults) || 0));
  const minorCount = Math.max(0, Math.trunc(Number(minors) || 0));
  if (adultCount + minorCount < 1) {
    return { total: 0, breakdown: [], rates };
  }

  const breakdown = [];
  let remainingAdults = adultCount;
  let remainingMinors = minorCount;

  breakdown.push({ role: "FIRST_MEMBER", count: 1, unit: rates.firstMember });
  if (remainingAdults > 0) remainingAdults -= 1;
  else remainingMinors -= 1;

  if (remainingAdults > 0) {
    breakdown.push({ role: "ADDITIONAL_ADULT", count: remainingAdults, unit: rates.additionalAdult });
  }
  if (remainingMinors > 0) {
    breakdown.push({ role: "MINOR", count: remainingMinors, unit: rates.minor });
  }

  const total = breakdown.reduce((sum, row) => sum + row.count * row.unit, 0);
  return { total: round2(total), breakdown, rates };
}

/**
 * Eluruumi normpind.
 *
 * PARANDATUD 04.08 (audit, leid D). SKA kommenteeritud variant: „võetakse
 * normpinnana arvesse eluruumi ÜLDPIND, kui eluruumi tubade arv on võrdne selles
 * eluruumis alaliselt elavate inimeste arvuga ja eluruumi üldpind on sotsiaalselt
 * põhjendatud normist suurem." Varem see reegel puudus ja kalkulaator alahindas.
 */
export function resolveNormAreaM2({
  members = 1,
  dwellingAreaM2 = 0,
  rooms = null,
  singleOccupantExtendedNorm = false
}) {
  const count = Math.max(1, Math.trunc(Number(members) || 1));
  let norm = count * SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2 + SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2;
  let basis = "SOCIALLY_JUSTIFIED_NORM";

  if (count === 1 && singleOccupantExtendedNorm && SINGLE_OCCUPANT_MAX_AREA_M2 > norm) {
    norm = SINGLE_OCCUPANT_MAX_AREA_M2;
    basis = "SINGLE_OCCUPANT_51M2";
  }

  const area = Number(dwellingAreaM2) || 0;
  const roomCount = rooms == null ? null : Math.trunc(Number(rooms) || 0);
  if (area > norm && roomCount != null && roomCount === count) {
    // Tube on sama palju kui alalisi elanikke -> kogu üldpind on normpind.
    return { normAreaM2: area, basis: "ROOMS_EQUAL_RESIDENTS" };
  }
  return { normAreaM2: norm, basis };
}

/**
 * Eluaseme normkulu.
 *
 * AUDITI LEID C — kärpimismehhanism. Seadus näeb KAKS sõltumatut lage: KOV-i
 * piirmäär kululiigi kohta (üüril RUUTMEETRILE, SHS § 133 lg 6) ja normpind.
 * Statuudijärgne tehe on seega `min(deklareeritud, piirmäär_m² × normpind)`.
 *
 * Kui KOV-i piirmäärad on teada (`capsPerM2`), teeme just selle tehte.
 * Kui neid EI ole teada, siis me ei tea päris tehet — proportsionaalne
 * skaleerimine on lähend, mitte seadus. Ta on nüüd nimeliselt märgitud
 * eeldusena (`HOUSING_METHOD_ASSUMED_PROPORTIONAL`), mitte peidetud valemisse.
 */
export function calculateHousingNormCost({
  costs = {},
  members = 1,
  dwellingAreaM2 = 0,
  rooms = null,
  singleOccupantExtendedNorm = false,
  capsPerM2 = null,
  issues = [],
  caveats = []
}) {
  const declaredKeys = Object.keys(costs || {}).filter((key) => {
    const value = costs[key];
    return value != null && value !== "" && Number(value) !== 0;
  });

  // Tundmatut kululiiki EI visata vaikselt ära (audit, leid F).
  for (const key of declaredKeys) {
    if (!HOUSING_COST_BY_KEY.has(key)) {
      issues.push({ code: "UNKNOWN_HOUSING_COST_KIND", field: `housingCosts.${key}` });
    }
  }

  const knownKeys = declaredKeys.filter((key) => HOUSING_COST_BY_KEY.has(key));
  if (!knownKeys.length) {
    return { total: 0, lines: [], normAreaM2: null, dwellingAreaM2: null, method: "NO_HOUSING_COSTS" };
  }

  const area = Number(dwellingAreaM2) || 0;
  const hasAreaScaledCost = knownKeys.some((key) => HOUSING_COST_BY_KEY.get(key).areaScaled);
  if (hasAreaScaledCost && area <= 0) {
    // Ilma pinnata ei saa normi rakendada. Varem tähendas see „ei kärbita" —
    // ehk vaikset ülehindamist (audit, leid F).
    issues.push({ code: "DWELLING_AREA_REQUIRED", field: "dwellingAreaM2" });
  }

  const { normAreaM2, basis } = resolveNormAreaM2({ members, dwellingAreaM2: area, rooms, singleOccupantExtendedNorm });

  if (hasAreaScaledCost && area > 0 && area > normAreaM2 && rooms == null) {
    // Tubade arv otsustab, kas kärpida üldse tohib.
    issues.push({ code: "ROOM_COUNT_REQUIRED", field: "rooms" });
  }

  const usingCaps = capsPerM2 && typeof capsPerM2 === "object";
  const method = usingCaps ? "KOV_CAPS_PER_M2" : "ASSUMED_PROPORTIONAL";
  if (!usingCaps) {
    caveats.push("HOUSING_METHOD_ASSUMED_PROPORTIONAL");
    caveats.push("KOV_HOUSING_LIMITS_UNKNOWN");
  }

  const ratio = area > normAreaM2 && area > 0 ? normAreaM2 / area : 1;
  const lines = [];
  let total = 0;

  for (const key of knownKeys) {
    const kind = HOUSING_COST_BY_KEY.get(key);
    const declared = readAmount(costs[key], `housingCosts.${key}`, issues);
    if (declared <= 0) continue;

    let counted = declared;
    if (kind.areaScaled) {
      if (usingCaps && Number(capsPerM2[key]) > 0) {
        counted = Math.min(declared, Number(capsPerM2[key]) * normAreaM2);
      } else {
        counted = declared * ratio;
      }
    } else if (usingCaps && Number(capsPerM2[key]) > 0) {
      counted = Math.min(declared, Number(capsPerM2[key]));
    }

    lines.push({
      key,
      label: kind.label,
      declared: round2(declared),
      counted: round2(counted),
      areaScaled: kind.areaScaled
    });
    total += counted;
  }

  if (basis === "ROOMS_EQUAL_RESIDENTS") caveats.push("NORM_AREA_IS_FULL_DWELLING");
  else if (ratio < 1) caveats.push("AREA_ABOVE_NORM_SCALED");

  return {
    total: round2(total),
    lines,
    normAreaM2,
    normBasis: basis,
    dwellingAreaM2: area || null,
    areaRatio: round2(ratio),
    method
  };
}

/**
 * Arvesse minev sissetulek. SHS § 133 lg 1.
 *
 * AUDITI LEID G: varem oli `excludedIncome` ainult kuvatav ja eeldas, et kutsuja
 * on seaduses välistatud tulud juba `netIncome`-st eemaldanud — mida tavakasutaja
 * teha ei oska. Nüüd võetakse tulu SISENDIKS LIIGITI ja moodul teeb välistuse ise.
 *
 * Töise tulu erand (SHS § 133 lg 2¹): kui inimesele oli vähemalt kahel
 * järjestikusel kuul määratud toetus ilma töist tulu arvestamata, siis järgnevalt
 * kahel kuul 100% ja seejärel neljal kuul 50% töisest tulust ei arvata
 * sissetulekute hulka. See EI ole KOV kaalutlus, vaid seadusest tulenev õigus.
 */
export function calculateCountedIncome({
  otherIncome = 0,
  workIncome = 0,
  workIncomeExemptionMonth = null,
  statutorilyExcludedIncome = 0,
  paidMaintenance = 0,
  enforcementWithheld = 0,
  issues = [],
  caveats = []
} = {}) {
  const other = readAmount(otherIncome, "otherIncome", issues);
  const work = readAmount(workIncome, "workIncome", issues);
  const excluded = readAmount(statutorilyExcludedIncome, "statutorilyExcludedIncome", issues);
  const maintenance = readAmount(paidMaintenance, "paidMaintenance", issues);
  const withheld = readAmount(enforcementWithheld, "enforcementWithheld", issues);

  let workExemptShare = 0;
  const month = workIncomeExemptionMonth == null ? null : Math.trunc(Number(workIncomeExemptionMonth) || 0);
  if (month != null && month >= 1 && month <= 6) {
    workExemptShare = month <= 2 ? 1 : 0.5;
    caveats.push("WORK_INCOME_EXEMPTION_APPLIED");
  } else if (month != null && month !== 0) {
    issues.push({ code: "INVALID_WORK_EXEMPTION_MONTH", field: "workIncomeExemptionMonth" });
  }

  const countedWork = work * (1 - workExemptShare);
  const counted = Math.max(0, other + countedWork - maintenance - withheld);

  return {
    total: round2(counted),
    otherIncome: round2(other),
    workIncome: round2(work),
    workIncomeExempt: round2(work * workExemptShare),
    statutorilyExcludedIncome: round2(excluded),
    deductions: {
      paidMaintenance: round2(maintenance),
      enforcementWithheld: round2(withheld)
    }
  };
}

// Väravad, millele peab olema vastatud, kui vastav kulu on deklareeritud.
// Vastamata värav = blokeeriv, mitte vaikne eeldus (audit, leid E).
function checkHousingGates({ costs, gates, issues, caveats }) {
  const declared = new Set(
    Object.keys(costs || {}).filter((key) => Number(costs[key]) > 0)
  );
  const answered = gates && typeof gates === "object" ? gates : {};

  if (declared.has("rent")) {
    if (answered.landlordIsFamilyOrTheirCompany == null) {
      issues.push({ code: "GATE_UNANSWERED", field: "gates.landlordIsFamilyOrTheirCompany" });
    } else if (answered.landlordIsFamilyOrTheirCompany === true) {
      // SHS § 131 lg 7/8 isikud ja nende äriühingud — KOV ei võta sellist üüri
      // üldjuhul arvesse.
      issues.push({ code: "RENT_FROM_FAMILY_NOT_COUNTED", field: "housingCosts.rent" });
    }
  }

  if (declared.has("buildingManagement") || declared.has("buildingRenovationLoan")) {
    if (answered.isApartmentBuilding == null) {
      issues.push({ code: "GATE_UNANSWERED", field: "gates.isApartmentBuilding" });
    } else if (answered.isApartmentBuilding === false) {
      issues.push({ code: "APARTMENT_BUILDING_COSTS_NOT_APPLICABLE", field: "housingCosts.buildingManagement" });
    }
  }

  if (declared.has("housingLoan")) {
    if (answered.housingLoanConditionsMet == null) {
      issues.push({ code: "GATE_UNANSWERED", field: "gates.housingLoanConditionsMet" });
    } else if (answered.housingLoanConditionsMet === false) {
      issues.push({ code: "HOUSING_LOAN_CONDITIONS_NOT_MET", field: "housingCosts.housingLoan" });
    }
    const used = Number(answered.housingLoanMonthsUsedThisYear);
    if (Number.isFinite(used) && used >= HOUSING_LOAN_MAX_MONTHS_PER_YEAR) {
      // SHS § 133 lg 9²: kuni kuus kuud kalendriaastas.
      issues.push({ code: "HOUSING_LOAN_MONTH_LIMIT_REACHED", field: "housingCosts.housingLoan" });
    } else if (!Number.isFinite(used)) {
      caveats.push("HOUSING_LOAN_MONTHS_UNKNOWN");
    }
  }

  if (declared.size > 0 && answered.costsAreCurrentMonth !== true) {
    // „Jooksval kuul tasumisele kuuluvad" — varasemat eluasemevõlga ei arvestata.
    issues.push({ code: "GATE_UNANSWERED", field: "gates.costsAreCurrentMonth" });
  }
}

/**
 * Kogu eelhinnang.
 *
 * Tagastab `usable: false` ja `estimate: null`, kui sisendist ei saa ohutult
 * numbrit teha. Kuvakiht EI TOHI sellisel juhul summat näidata.
 */
export function estimateSubsistenceBenefit(input = {}) {
  const {
    adults = 0,
    minors = 0,
    housingCosts = {},
    dwellingAreaM2 = 0,
    rooms = null,
    singleOccupantExtendedNorm = false,
    capsPerM2 = null,
    gates = {},
    effectiveDate = new Date()
  } = input;

  const issues = [];
  const caveats = [];

  const adultCount = Math.max(0, Math.trunc(Number(adults) || 0));
  const minorCount = Math.max(0, Math.trunc(Number(minors) || 0));
  const members = adultCount + minorCount;
  if (members === 0) issues.push({ code: "NO_FAMILY_MEMBERS", field: "adults" });

  const limit = calculateFamilySubsistenceLimit({ adults: adultCount, minors: minorCount }, effectiveDate);
  if (!limit.rates.exact) {
    // Fail-closed: kinnitamata määraga ei anta summat (audit, leid A).
    issues.push({ code: "UNSUPPORTED_DATE", field: "effectiveDate", reason: limit.rates.reason });
  }

  checkHousingGates({ costs: housingCosts, gates, issues, caveats });

  const housing = calculateHousingNormCost({
    costs: housingCosts,
    members: members || 1,
    dwellingAreaM2,
    rooms,
    singleOccupantExtendedNorm,
    capsPerM2,
    issues,
    caveats
  });

  const income = calculateCountedIncome({ ...input, issues, caveats });

  const base = {
    members,
    subsistenceLimit: limit,
    housing,
    income,
    issues,
    caveats,
    // Ei ole otsus. Masinloetav, et ükski kuvakiht ei saaks seda ära kaotada.
    isDecision: false,
    decidedBy: "KOV",
    legalBasis: ["SHS § 131", "SHS § 132", "SHS § 133", "SHS § 134"]
  };

  if (issues.length) {
    return { ...base, usable: false, estimate: null, surplus: null };
  }

  const raw = limit.total + housing.total - income.total;
  if (raw <= 0) caveats.push("ABOVE_SUBSISTENCE_LINE");

  return {
    ...base,
    usable: true,
    estimate: round2(Math.max(0, raw)),
    surplus: raw < 0 ? round2(-raw) : 0
  };
}
