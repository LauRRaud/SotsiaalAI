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
//
// UUE AASTA RIDA. Lisa rida tabeli algusesse (uuem ees) ja muuda `RATES_CHECKED_ON`
// selleks päevaks, mil sa määra allikast lugesid. Iga rida on testiga lukus
// (`tests/subsistence-calculator-views.test.mjs`): test tuleb koos reaga muuta.

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

// Päev, mil tabelit viimati allikaga võrreldi. Sellest päevast on kood noorem,
// seega teab ta kindlalt: sel päeval juba kehtinud uusim rida on „praegune määr".
export const RATES_CHECKED_ON = "2026-08-04";

/**
 * Praeguse määra kehtivuse algus: uusim rida, mis tabeli kontrollimise päeval
 * juba kehtis.
 *
 * MIKS (10.10 ülevaatus). Leht võtab päeva seadme kellast. Kui kell näitas
 * aastat 2025, andis leht ühele inimesele 200 € (2025. aasta määr) ilma ühegi
 * sõnata, kuigi kehtis 220 €. Sellest päevast varasema kuupäevaga summat ei anta.
 *
 * MIKS MITTE LIHTSALT TABELI ESIMENE RIDA. Järgmise aasta rida lisatakse siis,
 * kui riigieelarve on vastu võetud, ehk enne aasta algust. Kui võrdlus käiks
 * tabeli esimese rea järgi, keelduks leht kogu detsembri: iga tänane päev oleks
 * „varasem kui uusim määr". Kontrollimise päev hoiab selle ära.
 */
export function currentRateFrom(table = SUBSISTENCE_RATE_TABLE, checkedOn = RATES_CHECKED_ON) {
  const started = table.find((row) => row.validFrom <= checkedOn);
  return started ? started.validFrom : "";
}

// Eluruumi sotsiaalselt põhjendatud norm: elamuseadus § 7 lg 1 p 2 alusel
// Vabariigi Valitsuse 26.01.1999 määrus nr 38, p 2 (18 m² inimese kohta ja 15 m² pere kohta).
export const SOCIALLY_JUSTIFIED_AREA_PER_MEMBER_M2 = 18;
export const SOCIALLY_JUSTIFIED_AREA_PER_FAMILY_M2 = 15;

// Sama määruse p 2¹: üksi elavale pensionärile ning osalise või puuduva töövõimega
// inimesele VÕIB normpinnaks arvestada kuni 51 m² (ja kui tube on sama palju kui
// alalisi elanikke, on normpind eluruumi üldpind).
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
  // Maamaksu alus on SHS § 133 lg 5 p 9 järgi KOLMEKORDNE ELAMUALUNE PIND, mitte
  // eluruumi normpind. Varem kärbiti maamaksu eluruumi normpinna suhtega
  // (04.08 leid B: „pinnapõhine"), mis on teine pind: 100 m² korteri puhul läks
  // maamaksust arvesse pool, kuigi krundi suurusega ei olnud sel mingit seost.
  // Arvutus elamualust pinda ei tea, seega kulu läheb arvesse sisestatud kujul
  // ja leht ütleb, et sisestada tuleb ainult kolmekordse elamualuse pinna osa.
  { key: "landTax", areaScaled: false, label: "maamaks (kolmekordne elamualune pind)", gate: "LAND_TAX_EXEMPTION" },
  { key: "buildingInsurance", areaScaled: true, label: "hoonekindlustus" },
  { key: "wasteRemoval", areaScaled: false, label: "olmejäätmete vedu" },
  { key: "housingLoan", areaScaled: true, label: "eluaseme soetamiseks võetud laenu tagasimakse", gate: "HOUSING_LOAN" }
];

export const HOUSING_COST_KEYS = HOUSING_COST_KINDS.map((kind) => kind.key);

/* Kuupäev Eesti kalendri järgi. Varem lõigati see UTC järgi: aasta esimesel kahel
   tunnil Eesti aja järgi kehtis veel eelmise aasta määr „kinnitatuna".

   Päev pannakse kokku OSADEST (aasta, kuu, päev), mitte vormindatud tekstist.
   Varem loeti seda Rootsi kuju „2026-10-10" järgi: see kuju on keeleandmed, mitte
   lubadus. Seade, kus Rootsi andmeid ei ole, annab vaikselt teise kuju (näiteks
   „10.10.2026"), ja seade, mis ajavööndit ei tunne, viskab vea juba vormindaja
   loomisel: esimesel juhul sai iga külastaja vale põhjuse, teisel kukkus leht
   kokku. Kalender ja numbrimärgid on ette öeldud, et osad oleksid alati Gregoriuse
   kalendri ladina numbrid (nii valikutena kui ka keele tunnuse laiendina, mida
   tunnevad ka vanemad brauserid); kõik muu annab tühja sõne ja arvutus keeldub. */
const TALLINN_DAY_OPTIONS = Object.freeze({
  timeZone: "Europe/Tallinn",
  calendar: "gregory",
  numberingSystem: "latn",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

let tallinnFormatter = null;
function defaultTallinnFormatter() {
  /* Luuakse esimesel küsimisel, mitte faili laadimisel: loomise viga ei tohi lehte maha võtta. */
  tallinnFormatter ??= new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", TALLINN_DAY_OPTIONS);
  return tallinnFormatter;
}

/**
 * Päev Tallinna ajavööndis kujul AAAA-KK-PP või tühi sõne, kui seda ei saa
 * kindlalt öelda. `createFormatter` on testi jaoks.
 */
export function dayInTallinn(date, createFormatter = defaultTallinnFormatter) {
  try {
    if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return "";
    const parts = {};
    for (const part of createFormatter().formatToParts(date)) parts[part.type] = String(part.value);
    const { year = "", month = "", day = "" } = parts;
    if (!/^[0-9]{4}$/.test(year) || !/^[0-9]{1,2}$/.test(month) || !/^[0-9]{1,2}$/.test(day)) return "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  } catch {
    return "";
  }
}

function isoDate(value) {
  if (value instanceof Date) return dayInTallinn(value);
  return String(value || "").slice(0, 10);
}

/** Määra aasta: rida kehtib kalendriaasta kaupa, aasta on kehtivuse alguse aasta. */
const rateYear = (row) => Number(String(row.validFrom).slice(0, 4));

/**
 * Määrad kuupäeva kohta. `exact: false` tähendab, et selle kuupäeva kohta EI
 * ANTA summat — kutsuja peab siis keelduma, mitte kuvama lähima teadaoleva
 * määra nagu tõde. `reason` ütleb, miks:
 *   - `INVALID_DATE`: kuupäeva ei saanud lugeda;
 *   - `BEFORE_FIRST_KNOWN_RATE`, `DATE_BEFORE_CURRENT_RATE`: kuupäev on varasem
 *     kui praegune määr (seadme kell näitab varasemat aastat);
 *   - `NO_CONFIRMED_RATE_FOR_YEAR`: selle aasta määra ei ole veel tabelis.
 * `year` on määra aasta: leht näitab seda toimetulekupiiri juures.
 */
export function resolveSubsistenceRates(effectiveDate = new Date()) {
  const refuse = (row, reason) => ({ ...row, year: rateYear(row), exact: false, reason });
  const iso = isoDate(effectiveDate);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return refuse(SUBSISTENCE_RATE_TABLE[0], "INVALID_DATE");
  }
  const match = SUBSISTENCE_RATE_TABLE.find((row) => iso >= row.validFrom);
  if (!match) {
    return refuse(SUBSISTENCE_RATE_TABLE[SUBSISTENCE_RATE_TABLE.length - 1], "BEFORE_FIRST_KNOWN_RATE");
  }
  if (iso < currentRateFrom()) {
    return refuse(match, "DATE_BEFORE_CURRENT_RATE");
  }
  if (match.confirmedUntil && iso > match.confirmedUntil) {
    return refuse(match, "NO_CONFIRMED_RATE_FOR_YEAR");
  }
  return { ...match, year: rateYear(match), exact: true, reason: null };
}
