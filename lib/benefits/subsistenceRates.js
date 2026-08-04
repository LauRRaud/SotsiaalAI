// TOIMETULEKUPIIRI MÄÄRAD — ainus koht, kus numbrid elavad.
//
// Määrad tulevad riigieelarve seadusest ja muutuvad igal aastal. Nad on siin
// KUUPÄEVASTATUD tabelina, mitte valemi sees, sest vale aasta määr annab
// vaikselt vale vastuse — ja vaikselt vale vastus on selle kalkulaatori kõige
// halvem tulemus. Uue aasta lisamine = üks uus rida, koodi ei muudeta.
//
// Allikas: Sotsiaalministeerium, https://sm.ee/toimetulekutoetus (loetud 04.08.2026).
// Seaduse alus: SHS § 131 lg 3–5.
//
// Suhted seaduses: teine ja iga järgnev TÄISEALINE = 80% esimese liikme piirist,
// ALAEALINE = 120% esimese liikme piirist. Meie hoiame ka arvutatud eurod
// tabelis, et ümardamisvaidlus ei sõltuks meie tõlgendusest.

export const SUBSISTENCE_RATE_TABLE = [
  {
    validFrom: "2026-01-01",
    firstMember: 220,
    additionalAdult: 176,
    minor: 264,
    source: "https://sm.ee/toimetulekutoetus"
  },
  {
    validFrom: "2025-01-01",
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
// inimesele VÕIB normpinnaks arvestada kuni 51 m². „Võib" on KOV-i kaalutlus —
// meie eelhinnang kasutab seda, sest inimesele soodsam eeldus ei tohi tema
// ootust alla suruda, ja tulemus on niikuinii märgitud eelhinnanguks.
export const SINGLE_OCCUPANT_MAX_AREA_M2 = 51;

// SHS § 133 lg 5 loetleb 11 punktina eluasemekulu liigid, millele KOV volikogu
// kehtestab piirmäärad (§ 133 lg 6). Osa neist sõltub pinnast (üür, küte,
// haldus), osa tarbimisest (elekter, vesi, gaas) — ainult pinnasõltuvad kulud
// käivad normpinna proportsiooni alt läbi.
export const HOUSING_COST_KINDS = [
  { key: "rent", areaScaled: true, label: "üür" },
  { key: "buildingManagement", areaScaled: true, label: "korterelamu haldamise kulu" },
  { key: "buildingRenovationLoan", areaScaled: true, label: "korterelamu renoveerimislaenu tagasimakse" },
  { key: "water", areaScaled: false, label: "veevarustus ja reovee ärajuhtimine" },
  { key: "hotWater", areaScaled: false, label: "soojaveevarustuse soojusenergia või kütus" },
  { key: "heating", areaScaled: true, label: "kütteks tarbitud soojusenergia või kütus" },
  { key: "electricity", areaScaled: false, label: "elektrienergia" },
  { key: "gas", areaScaled: false, label: "majapidamisgaas" },
  { key: "landTax", areaScaled: false, label: "maamaks (kolmekordne elamualune pind)" },
  { key: "buildingInsurance", areaScaled: true, label: "hoonekindlustus" },
  { key: "wasteRemoval", areaScaled: false, label: "olmejäätmete vedu" },
  { key: "housingLoan", areaScaled: true, label: "eluaseme soetamiseks võetud laenu tagasimakse" }
];

export function resolveSubsistenceRates(effectiveDate = new Date()) {
  const iso = effectiveDate instanceof Date
    ? effectiveDate.toISOString().slice(0, 10)
    : String(effectiveDate || "").slice(0, 10);
  const match = SUBSISTENCE_RATE_TABLE.find((row) => iso >= row.validFrom);
  // Tundmatu tulevikukuupäev saab uusima teadaoleva määra, aga kutsuja peab
  // teadma, et see EI ole kinnitatud — seepärast tuleb lipp kaasa.
  if (!match) {
    const oldest = SUBSISTENCE_RATE_TABLE[SUBSISTENCE_RATE_TABLE.length - 1];
    return { ...oldest, exact: false };
  }
  return { ...match, exact: true };
}
