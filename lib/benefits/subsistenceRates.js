// TOIMETULEKUPIIRI MÄÄRAD — ainus koht, kus numbrid elavad.
//
// Määrad tulevad riigieelarve seadusest ja muutuvad igal aastal. Nad on siin
// KUUPÄEVASTATUD tabelina, mitte valemi sees, sest vale aasta määr annab
// vaikselt vale vastuse — ja vaikselt vale vastus on selle kalkulaatori kõige
// halvem tulemus.
//
// Allikas: Sotsiaalministeerium, https://sm.ee/toimetulekutoetus (loetud 04.08.2026).
// Seaduse alus: SHS § 131 lg 3–5.
//
// Suhted seaduses: teine ja iga järgnev TÄISEALINE = 80% esimese liikme piirist,
// ALAEALINE = 120% esimese liikme piirist.

export const SUBSISTENCE_RATE_TABLE = [
  {
    validFrom: "2026-01-01",
    // Kinnitatud kuni selle kalendriaasta lõpuni. Järgmise aasta määr tuleb uue
    // riigieelarve seadusega — kuni teda ei ole, EI TOHI 2026 määra 2027. aasta
    // kohta „kinnitatuna" välja anda (audit 04.08, leid A).
    confirmedUntil: "2026-12-31",
    firstMember: 220,
    additionalAdult: 176,
    minor: 264,
    source: "https://sm.ee/toimetulekutoetus"
  },
  {
    validFrom: "2025-01-01",
    confirmedUntil: "2025-12-31",
    firstMember: 200,
    additionalAdult: 160,
    minor: 240,
    source: "https://sm.ee/toimetulekutoetus"
  }
];

// Elamuseadus § 7 lg 2: eluruumi sotsiaalselt põhjendatud norm.
export const SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2 = 18;
export const SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2 = 15;

// SHS § 133 lg 5: üksi elavale pensionärile ning osalise või puuduva töövõimega
// inimesele VÕIB normpinnaks arvestada kuni 51 m².
export const SINGLE_OCCUPANT_MAX_AREA_M2 = 51;

// SHS § 133 lg 9²: eluasemelaenu makseid saab arvesse võtta kuni KUUE KUU
// ulatuses kalendriaastas.
export const HOUSING_LOAN_MAX_MONTHS_PER_YEAR = 6;

// SHS § 133 lg 5 kululiigid. `areaScaled` ütleb, kas KOV-i piirmäär on selle
// liigi juures pinnapõhine — ainult need käivad normpinna alt läbi.
//
// PARANDATUD 04.08 (audit, leid B): `landTax` oli ekslikult pinnast sõltumatu.
// SHS § 133 lg 5 p 9 ütleb ise, et maamaksukulu „arvestamise aluseks on
// kolmekordne elamualune pind" — see ON pinnapõhine.
export const HOUSING_COST_KINDS = [
  { key: "rent", areaScaled: true, label: "üür", gate: "LANDLORD_RELATIONSHIP" },
  { key: "buildingManagement", areaScaled: true, label: "korterelamu haldamise kulu", gate: "APARTMENT_BUILDING" },
  { key: "buildingRenovationLoan", areaScaled: true, label: "korterelamu renoveerimislaenu tagasimakse", gate: "APARTMENT_BUILDING" },
  { key: "water", areaScaled: false, label: "veevarustus ja reovee ärajuhtimine" },
  { key: "hotWater", areaScaled: false, label: "soojaveevarustuse soojusenergia või kütus" },
  { key: "heating", areaScaled: true, label: "kütteks tarbitud soojusenergia või kütus" },
  { key: "electricity", areaScaled: false, label: "elektrienergia" },
  { key: "gas", areaScaled: false, label: "majapidamisgaas" },
  { key: "landTax", areaScaled: true, label: "maamaks (kolmekordne elamualune pind)" },
  { key: "buildingInsurance", areaScaled: true, label: "hoonekindlustus" },
  { key: "wasteRemoval", areaScaled: false, label: "olmejäätmete vedu" },
  { key: "housingLoan", areaScaled: true, label: "eluaseme soetamiseks võetud laenu tagasimakse", gate: "HOUSING_LOAN" }
];

export const HOUSING_COST_KEYS = HOUSING_COST_KINDS.map((kind) => kind.key);

function isoDate(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value || "").slice(0, 10);
}

/**
 * Määrad kuupäeva kohta. `exact: false` tähendab, et selle kuupäeva kohta EI OLE
 * kinnitatud määra — kutsuja peab siis keelduma summat näitamast, mitte kuvama
 * lähima teadaoleva määra nagu tõde.
 */
export function resolveSubsistenceRates(effectiveDate = new Date()) {
  const iso = isoDate(effectiveDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const newest = SUBSISTENCE_RATE_TABLE[0];
    return { ...newest, exact: false, reason: "INVALID_DATE" };
  }
  const match = SUBSISTENCE_RATE_TABLE.find((row) => iso >= row.validFrom);
  if (!match) {
    const oldest = SUBSISTENCE_RATE_TABLE[SUBSISTENCE_RATE_TABLE.length - 1];
    return { ...oldest, exact: false, reason: "BEFORE_FIRST_KNOWN_RATE" };
  }
  if (match.confirmedUntil && iso > match.confirmedUntil) {
    return { ...match, exact: false, reason: "NO_CONFIRMED_RATE_FOR_YEAR" };
  }
  return { ...match, exact: true, reason: null };
}
