// TOIMETULEKUTOETUSE EELKALKULAATOR — aritmeetika ja selgitus, MITTE otsus.
//
// SHS § 134 järgi määrab toimetulekutoetuse valla- või linnavalitsus. See moodul
// ei hinda kellegi õigust teenusele ega abivajaduse taset — ta teeb seaduses
// kirjas oleva tehte läbi ja näitab inimesele ette, MILLISTEST osadest see tehe
// koosneb. Kolm asja, mida ta teadlikult EI tee:
//
//   1. ei ütle „sul on õigus" ega „sul ei ole õigust" — ütleb „selle sisendi
//      juures tuleks tehte tulemuseks X";
//   2. ei tea KOV-i piirmäärasid (SHS § 133 lg 6 — need kehtestab iga volikogu
//      ise ja need on piirkonniti erinevad), seega eluasemekulude pool on
//      ÜLEMINE hinnang, mida KOV võib allapoole korrigeerida;
//   3. ei tee kaalutlusotsuseid (SHS § 134 lg 4–7: vara, töise tulu puudumine,
//      kuue kuu keskmine). Need on nimeliselt tulemuse `caveats` all.
//
// Valem (SKA „KOV-idele SHS TTT kommenteeritud variant 2026", 12.03.2026):
//   toimetulekutoetus = pereliikmete arvestuslik toimetulekupiir
//                     + eluaseme normkulu
//                     - sissetulekud
//
// Sissetulekutest arvatakse SHS § 133 lg 1 alusel maha makstud elatis ja
// täitemenetluses (TMS §-d 131–132) õiguspäraselt kinni peetud summad.

import {
  HOUSING_COST_KINDS,
  resolveSubsistenceRates,
  SINGLE_OCCUPANT_MAX_AREA_M2,
  SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2,
  SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2
} from "./subsistenceRates.js";

const HOUSING_COST_BY_KEY = new Map(HOUSING_COST_KINDS.map((kind) => [kind.key, kind]));

function toAmount(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed;
}

// Sendi täpsus. Ujukomaviga ei tohi tekitada „0,004 € toetust", mis näeks
// inimese jaoks välja nagu õigus, mida tegelikult ei ole.
function round2(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Perekonna arvestuslik toimetulekupiir. SHS § 131 lg 3–5.
 * Esimene liige täismääras, iga järgnev täisealine 80%, iga alaealine 120%.
 * Järjekord ei ole vaba valik: esimeseks liikmeks loetakse üks inimene ja
 * ALAEALINE ei saa kunagi olla „teine täisealine", seega täisealiste puudumisel
 * kannab esimese liikme määra üks alaealine.
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

  if (remainingAdults > 0) {
    breakdown.push({ role: "FIRST_MEMBER", count: 1, unit: rates.firstMember });
    remainingAdults -= 1;
  } else {
    // Ainult alaealistest koosnev leibkond on haruldane, aga mitte võimatu
    // (nt iseseisvalt elav alaealine). Esimene liige on siis tema.
    breakdown.push({ role: "FIRST_MEMBER", count: 1, unit: rates.firstMember });
    remainingMinors -= 1;
  }
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
 * Eluruumi sotsiaalselt põhjendatud norm. Elamuseadus § 7 lg 2:
 * 18 m² iga pereliikme kohta + 15 m² perekonna kohta.
 * SHS § 133 lg 5: üksi elav pensionär või osalise/puuduva töövõimega inimene
 * kuni 51 m².
 */
export function socallyJustifiedAreaM2({ members = 1, singleOccupantExtendedNorm = false }) {
  const count = Math.max(1, Math.trunc(Number(members) || 1));
  const base = count * SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2 + SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2;
  if (count === 1 && singleOccupantExtendedNorm) {
    return Math.max(base, SINGLE_OCCUPANT_MAX_AREA_M2);
  }
  return base;
}

/**
 * Eluaseme normkulu. Pinnasõltuvad kulud (üür, küte, haldus, hoonekindlustus,
 * eluasemelaen) skaleeritakse normpinna suhtega, kui eluruum on normist suurem.
 * Tarbimispõhised kulud (elekter, vesi, gaas, jäätmevedu, maamaks) lähevad
 * täies ulatuses — nende suurus ei sõltu sellest, kui suur korter on.
 *
 * NB: KOV-i piirmäärasid (SHS § 133 lg 6) siin EI rakendata, sest platvorm neid
 * ei tea. Tulemus on seetõttu ÜLEMINE hinnang.
 */
export function calculateHousingNormCost({
  costs = {},
  members = 1,
  dwellingAreaM2 = 0,
  singleOccupantExtendedNorm = false
}) {
  const normArea = socallyJustifiedAreaM2({ members, singleOccupantExtendedNorm });
  const actualArea = toAmount(dwellingAreaM2);
  // Pind teadmata või normist väiksem -> midagi ei kärbita.
  const ratio = actualArea > normArea ? normArea / actualArea : 1;

  const lines = [];
  let total = 0;
  for (const [key, rawValue] of Object.entries(costs)) {
    const kind = HOUSING_COST_BY_KEY.get(key);
    if (!kind) continue;
    const declared = toAmount(rawValue);
    if (declared <= 0) continue;
    const counted = kind.areaScaled ? declared * ratio : declared;
    lines.push({
      key,
      label: kind.label,
      declared: round2(declared),
      counted: round2(counted),
      areaScaled: kind.areaScaled
    });
    total += counted;
  }

  return {
    total: round2(total),
    lines,
    normAreaM2: normArea,
    dwellingAreaM2: actualArea || null,
    areaRatio: round2(ratio)
  };
}

/**
 * Arvesse minev sissetulek. SHS § 133 lg 1: eelmise kuu netosissetulekust
 * arvatakse maha makstud elatis ja täitemenetluses kinni peetud summad.
 * SHS § 133 lg 2 loetleb, mida sissetulekute hulka üldse ei arvata — need
 * summad ei tohi `netIncome` sisse jõuda ja kutsuja peab need eraldi hoidma;
 * `excludedIncome` on siin selleks, et neid saaks selgituses NÄIDATA.
 */
export function calculateCountedIncome({
  netIncome = 0,
  paidMaintenance = 0,
  enforcementWithheld = 0,
  excludedIncome = 0
}) {
  const net = toAmount(netIncome);
  const maintenance = toAmount(paidMaintenance);
  const withheld = toAmount(enforcementWithheld);
  const counted = Math.max(0, net - maintenance - withheld);
  return {
    total: round2(counted),
    netIncome: round2(net),
    deductions: {
      paidMaintenance: round2(maintenance),
      enforcementWithheld: round2(withheld)
    },
    excludedIncome: round2(toAmount(excludedIncome))
  };
}

/**
 * Kogu eelhinnang. Tagastab summa JA selle koostisosad, sest number ilma
 * koosseisuta ei ole selgitus — ja selgitus on siin pool toodet.
 */
export function estimateSubsistenceBenefit(input = {}) {
  const {
    adults = 0,
    minors = 0,
    netIncome = 0,
    paidMaintenance = 0,
    enforcementWithheld = 0,
    excludedIncome = 0,
    housingCosts = {},
    dwellingAreaM2 = 0,
    singleOccupantExtendedNorm = false,
    effectiveDate = new Date()
  } = input;

  const members = Math.max(0, Math.trunc(Number(adults) || 0)) + Math.max(0, Math.trunc(Number(minors) || 0));
  const limit = calculateFamilySubsistenceLimit({ adults, minors }, effectiveDate);
  const housing = calculateHousingNormCost({
    costs: housingCosts,
    members: members || 1,
    dwellingAreaM2,
    singleOccupantExtendedNorm
  });
  const income = calculateCountedIncome({ netIncome, paidMaintenance, enforcementWithheld, excludedIncome });

  const raw = limit.total + housing.total - income.total;
  const estimate = round2(Math.max(0, raw));

  const caveats = [];
  if (housing.total > 0) {
    // Kõige olulisem piirang. Ilma selleta loeks inimene ülemist hinnangut
    // lubaduseks.
    caveats.push("KOV_HOUSING_LIMITS_UNKNOWN");
  }
  if (housing.areaRatio < 1) {
    caveats.push("AREA_ABOVE_NORM_SCALED");
  }
  if (!limit.rates.exact) {
    caveats.push("RATES_NOT_CONFIRMED_FOR_DATE");
  }
  if (members === 0) {
    caveats.push("NO_FAMILY_MEMBERS");
  }
  if (raw <= 0) {
    caveats.push("ABOVE_SUBSISTENCE_LINE");
  }

  return {
    estimate,
    // Negatiivne vahe on inimesele infona väärtuslik („kui palju puudu jäi"),
    // aga toetuseks ta ei saa muutuda.
    surplus: raw < 0 ? round2(-raw) : 0,
    members,
    subsistenceLimit: limit,
    housing,
    income,
    caveats,
    // Ei ole otsus. See lipp on masinloetav, et ükski kuvakiht ei saaks teda
    // kogemata ära kaotada.
    isDecision: false,
    decidedBy: "KOV",
    legalBasis: ["SHS § 131", "SHS § 132", "SHS § 133", "SHS § 134"]
  };
}
