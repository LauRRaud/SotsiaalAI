/**
 * Toimetulekutoetuse eelhinnangu vaated ILMA JSX-ita.
 *
 * Leht (`./SubsistenceCalculator.jsx`) joonistab; siin on reeglid, mida saab
 * testida: millised vaated on olemas, mis seisus need on, millised täpsustavad
 * küsimused sisestatud kulude põhjal küsitakse, mis läheb arvutusse ja mida
 * tulemuse kohta öeldakse. Arvutus ise on failis `lib/benefits/subsistence.js`.
 *
 * MIKS LEHE OTSUSED ON SIIN, MITTE JSX-is (10.10). Lehe varasem viga oli
 * ühendustes, mitte arvutuses: tühi sissetulek läks arvutusse nullina ja
 * puutumata leht näitas summat. Sellist viga ei hoia test, mis loeb lehe
 * lähteteksti. Seepärast ehitab arvutuse sisendi `estimateInput`, kogu lehe
 * tulemuse annab `pageEstimate` ja need on testitud käitumisena.
 */

import { estimateSubsistenceBenefit } from "../../lib/benefits/subsistence.js";

/**
 * Eluasemekulud kahes vaates: eluasemega seotud maksed ja kommunaalkulud.
 * Kaksteist välja ühes vaates ei mahu paneeli; iga kulu on täpselt ühes rühmas
 * (test võrdleb seda serveri loendiga `HOUSING_COST_KEYS`).
 */
export const COST_GROUPS = Object.freeze({
  costs: Object.freeze(["rent", "buildingManagement", "buildingRenovationLoan", "housingLoan", "landTax", "buildingInsurance"]),
  utilities: Object.freeze(["water", "hotWater", "heating", "electricity", "gas", "wasteRemoval"])
});

const KNOWN_COST_KEYS = Object.freeze([...COST_GROUPS.costs, ...COST_GROUPS.utilities]);

/** Kulud, mille kohta on sisestatud nullist suurem summa. */
export function declaredCostKeys(costs = {}) {
  return Object.keys(costs).filter((key) => Number(costs[key]) > 0);
}

/**
 * Täpsustavad küsimused. Esimene küsitakse alati, kui mõni kulu on sisestatud;
 * ülejäänud ainult selle kulu juurde, mille arvessevõtmine vastusest sõltub
 * (sama tingimus mis arvutuses: `GATE_UNANSWERED`). Küsimuste sõnastus järgib
 * seadust (SHS § 133 lg 7, 8, 9, 9¹ ja 9²), mitte lihtsustust: lihtsustatud
 * küsimus „kas laen on sinu nimel" jättis välja pereliikme võetud laenu.
 */
export function gateQuestions(declared = []) {
  if (!declared.length) return [];
  const has = (key) => declared.includes(key);
  return [
    { field: "costsAreCurrentMonth", text: "subsistence.gates.current_month", hint: "subsistence.hints.current_month" },
    ...(has("rent") ? [{ field: "landlordIsFamilyOrTheirCompany", text: "subsistence.gates.landlord_family" }] : []),
    ...(has("buildingManagement") || has("buildingRenovationLoan") ? [{ field: "isApartmentBuilding", text: "subsistence.gates.apartment" }] : []),
    ...(has("housingLoan")
      ? [
          { field: "housingLoanConditionsMet", text: "subsistence.gates.loan", hint: "subsistence.hints.loan" },
          { field: "housingLoanMonthLimitReached", text: "subsistence.gates.loan_limit" }
        ]
      : []),
    ...(has("landTax") ? [{ field: "landTaxExempt", text: "subsistence.gates.land_tax" }] : [])
  ];
}

/**
 * Vaated järjekorras. Loend on ALATI sama: kui täpsustuste vaade tekiks alles
 * esimese kulu sisestamisel, ehitataks lava ümber samal hetkel, kui inimene
 * summat kirjutab, ja väli kaotaks fookuse. Ilma kuludeta ütleb täpsustuste
 * vaade, et küsimusi ei ole.
 */
export const STEP_KEYS = Object.freeze(["family", "income", "housing", "costs", "utilities", "gates", "result"]);

const filled = (value) => String(value ?? "").trim() !== "";

/** Vormi algseis. Üks täisealine on ette pandud: ilma täisealiseta arvutust ei ole. */
export const EMPTY_FORM = Object.freeze({
  adults: "1",
  minors: "0",
  otherIncome: "",
  workIncome: "",
  paidMaintenance: "",
  enforcementWithheld: "",
  dwellingAreaM2: "",
  rooms: "",
  singleOccupantExtendedNorm: false,
  costsAreCurrentMonth: null,
  landlordIsFamilyOrTheirCompany: null,
  isApartmentBuilding: null,
  housingLoanConditionsMet: null,
  housingLoanMonthLimitReached: null,
  landTaxExempt: null
});

const GATE_FIELDS = Object.freeze([
  "costsAreCurrentMonth",
  "landlordIsFamilyOrTheirCompany",
  "isApartmentBuilding",
  "housingLoanConditionsMet",
  "housingLoanMonthLimitReached",
  "landTaxExempt"
]);
const INCOME_FIELDS = Object.freeze(["workIncome", "otherIncome", "paidMaintenance", "enforcementWithheld"]);
/* Väljad, mis ei ole summad: nende loetamatu sisu kohta teeb puudujäägi leht ise. */
const COUNT_FIELDS = Object.freeze(["adults", "minors", "dwellingAreaM2", "rooms"]);

/** Pereliikmete ja tubade arv täisarvuna (0 kuni 99): murdosa ja miinust ei ole. */
export function wholeCount(value) {
  return Math.min(99, Math.max(0, Math.trunc(Number(value) || 0)));
}

/** Loetamatu välja tunnus: summa- ja arvuväljal välja nimi, kulul `cost:<kulu>`. */
export const costFieldId = (key) => `cost:${key}`;

/**
 * Kas inimene on midagi sisestanud. Leht ei salvesta midagi, seega läheks
 * kogemata lahkumisel kõik sisestatu kaotsi: muudetud vorm küsib enne lahkumist.
 * Loetamatu sisu väljal (`bad`) on samuti sisestus.
 */
export function formTouched(form = {}, costs = {}, bad = []) {
  if (bad.length) return true;
  if (Object.values(costs).some(filled)) return true;
  return Object.keys(EMPTY_FORM).some((key) => (form[key] ?? EMPTY_FORM[key]) !== EMPTY_FORM[key]);
}

/**
 * Arvutuse sisend lehe olekust.
 *
 * `bad`: väljad, kuhu on kirjutatud midagi, mida brauser arvuks ei loe
 * („500,-", „1 200"). Arvuväli annab sellise sisu lehele TÜHJANA, kuigi tekst
 * seisab väljal edasi; tühi kulu ei ole viga, seega arvutati ilma selleta ja
 * summa ei vastanud sellele, mida inimene väljal nägi. Loetamatu summa läheb
 * arvutusse mittearvuna ja arvutus keeldub välja nimega.
 */
export function estimateInput(form = EMPTY_FORM, costs = {}, bad = []) {
  const amount = (key) => (bad.includes(key) ? Number.NaN : form[key]);
  const housingCosts = {};
  for (const key of KNOWN_COST_KEYS) {
    if (bad.includes(costFieldId(key))) housingCosts[key] = Number.NaN;
    else if (costs[key] != null && costs[key] !== "") housingCosts[key] = costs[key];
  }
  const gates = {};
  for (const field of GATE_FIELDS) gates[field] = form[field] === true ? true : form[field] === false ? false : null;
  return {
    adults: form.adults,
    minors: form.minors,
    otherIncome: amount("otherIncome"),
    workIncome: amount("workIncome"),
    paidMaintenance: amount("paidMaintenance"),
    enforcementWithheld: amount("enforcementWithheld"),
    dwellingAreaM2: form.dwellingAreaM2,
    rooms: filled(form.rooms) ? form.rooms : null,
    singleOccupantExtendedNorm: form.singleOccupantExtendedNorm === true,
    housingCosts,
    gates
  };
}

/**
 * Lehe tulemus: arvutus pluss need puudujäägid, mida arvutus ise ei näe
 * (loetamatu sisu pereliikmete, pinna või tubade väljal). `effectiveDate` on
 * testi jaoks; leht jätab selle andmata ja arvutus võtab tänase kuupäeva.
 */
export function pageEstimate(form = EMPTY_FORM, costs = {}, bad = [], effectiveDate) {
  const input = estimateInput(form, costs, bad);
  const result = estimateSubsistenceBenefit(effectiveDate === undefined ? input : { ...input, effectiveDate });
  const unreadable = COUNT_FIELDS.filter((field) => bad.includes(field)).map((field) => ({ code: "INVALID_AMOUNT", field }));
  if (!unreadable.length) return result;
  return { ...result, issues: [...result.issues, ...unreadable], usable: false, estimate: null, surplus: null };
}

/**
 * Sammu numbri heledus kiirmenüüs ja vaates „Kõik sammud". Seis käib sama
 * reegli järgi mis arvutus: sissetuleku samm on valmis siis, kui töine või muu
 * sissetulek on sisestatud (ainult mahaarvamisest ei piisa), pere samm siis,
 * kui on vähemalt üks täisealine. Eelhinnangu samm on valmis, kui summa on olemas.
 */
export function stepStates(form = {}, costs = {}, usable = false) {
  const declared = declaredCostKeys(costs);
  const group = (keys) => (keys.some((key) => declared.includes(key)) ? "done" : "empty");
  const questions = gateQuestions(declared);
  const answered = questions.filter((question) => form[question.field] === true || form[question.field] === false).length;
  const incomeEntered = filled(form.workIncome) || filled(form.otherIncome);
  const members = wholeCount(form.adults) + wholeCount(form.minors);
  return {
    family: wholeCount(form.adults) > 0 ? "done" : members > 0 ? "partial" : "empty",
    income: incomeEntered ? "done" : INCOME_FIELDS.some((key) => filled(form[key])) ? "partial" : "empty",
    housing: filled(form.dwellingAreaM2) && filled(form.rooms) ? "done" : filled(form.dwellingAreaM2) || filled(form.rooms) ? "partial" : "empty",
    costs: group(COST_GROUPS.costs),
    utilities: group(COST_GROUPS.utilities),
    gates: !questions.length ? "empty" : answered === questions.length ? "done" : answered ? "partial" : "empty",
    result: usable ? "done" : "empty"
  };
}

/* Summa viga nimetab välja: kuueteistkümne summavälja seast ei pea inimene viga otsima. */
const NAMED_ISSUE_CODES = new Set(["NEGATIVE_AMOUNT", "INVALID_AMOUNT"]);
const FIELD_LABEL_KEYS = Object.freeze({
  adults: "subsistence.fields.adults",
  minors: "subsistence.fields.minors",
  dwellingAreaM2: "subsistence.fields.area",
  rooms: "subsistence.fields.rooms",
  otherIncome: "subsistence.fields.other_income",
  workIncome: "subsistence.fields.work_income",
  paidMaintenance: "subsistence.fields.paid_maintenance",
  enforcementWithheld: "subsistence.fields.enforcement"
});

/** Välja nime võti kataloogis arvutuse välja tee järgi; tundmatu välja kohta tühi sõne. */
export function issueFieldLabelKey(field = "") {
  const name = String(field || "");
  if (name.startsWith("housingCosts.")) {
    const cost = name.slice("housingCosts.".length);
    return KNOWN_COST_KEYS.includes(cost) ? `subsistence.costs.${cost}` : "";
  }
  return FIELD_LABEL_KEYS[name] || "";
}

/**
 * Puudujäägid ridadena: kood ja (summa vea korral) välja nime võti. Sama lause
 * ei kordu; kahe eri välja summa viga annab kaks rida, sest kumbki nimetab oma
 * välja. Kui selle aasta määra ei ole kinnitatud, on see ainus rida: miski, mida
 * inimene sisestab, seda ei muuda, ja teised read kõrval oleksid eksitavad.
 */
export function issueRows(issues = []) {
  if (issues.some((issue) => issue?.code === "UNSUPPORTED_DATE")) return [{ code: "UNSUPPORTED_DATE", fieldLabelKey: "" }];
  const rows = [];
  const seen = new Set();
  for (const issue of issues) {
    const code = String(issue?.code || "");
    if (!code) continue;
    const fieldLabelKey = NAMED_ISSUE_CODES.has(code) ? issueFieldLabelKey(issue?.field) : "";
    const id = `${code}:${fieldLabelKey}`;
    if (seen.has(id)) continue;
    seen.add(id);
    rows.push({ code, fieldLabelKey });
  }
  return rows;
}

/** Kas arvutus keeldub selle pärast, et selle aasta määra ei ole kinnitatud. */
export function rateMissing(result) {
  return Boolean(result?.issues?.some((issue) => issue?.code === "UNSUPPORTED_DATE"));
}

/* Eesti ja vene keeles on kümnendmärk koma. */
const decimalMark = (locale) => (String(locale || "et").toLowerCase().startsWith("en") ? "." : ",");

/** Arv kuni kahe komakohaga lehe keeles (pind ruutmeetrites, protsent). */
export function plainNumber(value, locale = "et") {
  const number = Math.round((Number(value) || 0) * 100) / 100;
  return String(number).replace(".", decimalMark(locale));
}

/** Summa kahe komakohaga ja euro märgiga, kümnendmärk lehe keele järgi. */
export function euro(value, locale = "et") {
  return `${Number(value || 0).toFixed(2).replace(".", decimalMark(locale))} €`;
}

/**
 * Miks arvesse läks vähem eluasemekulu, kui sisestati.
 *
 * Kui eluruum on normpinnast suurem, võtab SEE EELHINNANG pinnaga seotud
 * kuludest arvesse normpinnale vastava osa. See on lähend (omavalitsus arvutab
 * oma piirmäärade järgi), seepärast ütleb lause „selles eelhinnangus" ja
 * nimetab kulud, mida kärbiti: muidu näeb inimene ühte väiksemat summat ega tea,
 * milline tema kuludest pooleks läks. Protsent tuleb ümardamata suhtest ühe
 * komakohaga ja kärpe korral ei ole see kunagi 100.
 *
 * Tagastab kataloogi võtme, kärbitud kulude nimede võtmed ja arvud või `null`.
 */
export function housingReason(result, locale = "et") {
  const housing = result?.housing;
  if (!result?.usable || !housing) return null;
  const cut = (housing.lines || []).filter((line) => Number(line.counted) < Number(line.declared));
  const area = Number(housing.dwellingAreaM2);
  const norm = Number(housing.normAreaM2);
  if (!cut.length || !(area > norm) || !(norm > 0)) return null;
  const percent = Math.min(99.9, Math.floor((norm / area) * 1000) / 10);
  return {
    key: "subsistence.reason.area_scaled",
    costKeys: cut.map((line) => `subsistence.costs.${line.key}`),
    vars: { area: plainNumber(area, locale), norm: plainNumber(norm, locale), percent: plainNumber(percent, locale) }
  };
}

/**
 * Lause tulemuse all: „toetust ei tuleks", kui hinnang on null (siis ei ole
 * mõtet öelda, et tegelik summa võib olla väiksem), muidu omavalitsuse
 * piirmäärade hoiatus, kui eluasemekulusid arvestati.
 */
export function resultNote(result) {
  if (!result?.usable) return "";
  if (result.estimate === 0) return "above_line";
  return result.caveats?.includes("KOV_HOUSING_LIMITS_UNKNOWN") ? "kov_limits" : "";
}

/** Faktid tulemuse all. Sisestatud eluasemekulu on real ainult siis, kui arvesse läks vähem. */
export function resultFacts(result, locale = "et") {
  if (!result?.usable) return [];
  const housing = result.housing || {};
  return [
    { key: "limit", value: euro(result.subsistenceLimit?.total, locale) },
    ...(Number(housing.declaredTotal) > Number(housing.total) ? [{ key: "housing_declared", value: euro(housing.declaredTotal, locale) }] : []),
    { key: "housing", value: euro(housing.total, locale) },
    { key: "income", value: euro(result.income?.total, locale) }
  ];
}

/** Plaatide ja kiirmenüü kokkuvõtted: summa on eelhinnangu plaadil ainult siis, kui see on olemas. */
export function stepSummaries(form = EMPTY_FORM, costs = {}, result = null, locale = "et") {
  const sum = (group) => COST_GROUPS[group].reduce((total, key) => total + (Number(costs[key]) > 0 ? Number(costs[key]) : 0), 0);
  return {
    family: { adults: wholeCount(form.adults), minors: wholeCount(form.minors) },
    costs: sum("costs") ? euro(sum("costs"), locale) : "",
    utilities: sum("utilities") ? euro(sum("utilities"), locale) : "",
    result: result?.usable ? euro(result.estimate, locale) : ""
  };
}
