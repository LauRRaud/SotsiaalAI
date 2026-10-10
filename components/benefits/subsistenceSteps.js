/**
 * Toimetulekutoetuse eelhinnangu vaated ILMA JSX-ita.
 *
 * Leht (`./SubsistenceCalculator.jsx`) joonistab; siin on reeglid, mida saab
 * testida: millised vaated on olemas, mis seisus need on, millised täpsustavad
 * küsimused sisestatud kulude põhjal küsitakse ja kuidas kulud kahe vaate vahel
 * jagunevad. Arvutus ise on failis `lib/benefits/subsistence.js`.
 */

/**
 * Eluasemekulud kahes vaates: eluasemega seotud maksed ja kommunaalkulud.
 * Kaksteist välja ühes vaates ei mahu paneeli; iga kulu on täpselt ühes rühmas
 * (test võrdleb seda serveri loendiga `HOUSING_COST_KEYS`).
 */
export const COST_GROUPS = Object.freeze({
  costs: Object.freeze(["rent", "buildingManagement", "buildingRenovationLoan", "housingLoan", "landTax", "buildingInsurance"]),
  utilities: Object.freeze(["water", "hotWater", "heating", "electricity", "gas", "wasteRemoval"])
});

/** Kulud, mille kohta on sisestatud nullist suurem summa. */
export function declaredCostKeys(costs = {}) {
  return Object.keys(costs).filter((key) => Number(costs[key]) > 0);
}

/**
 * Täpsustavad küsimused. Esimene küsitakse alati, kui mõni kulu on sisestatud;
 * ülejäänud ainult selle kulu juurde, mille arvessevõtmine vastusest sõltub
 * (sama tingimus mis arvutuses: `GATE_UNANSWERED`).
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
          { field: "housingLoanConditionsMet", text: "subsistence.gates.loan" },
          /* SHS § 133 lg 9²: eluasemelaenu makset saab arvesse võtta kuni kuuel kuul
             kalendriaastas. Ilma selle küsimuseta läks makse alati täies mahus arvesse. */
          { field: "housingLoanMonthLimitReached", text: "subsistence.gates.loan_limit" }
        ]
      : [])
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

/** Vormi algseis. Üks täisealine on ette pandud: ilma ühegi pereliikmeta arvutust ei ole. */
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
  housingLoanMonthLimitReached: null
});

/** Pereliikmete arv täisarvuna (0 kuni 99): murdosa ja miinust ei ole. */
export function wholeCount(value) {
  return Math.min(99, Math.max(0, Math.trunc(Number(value) || 0)));
}

/**
 * Kas inimene on midagi sisestanud. Leht ei salvesta midagi, seega läheks
 * kogemata lahkumisel kõik sisestatu kaotsi: muudetud vorm küsib enne lahkumist.
 */
export function formTouched(form = {}, costs = {}) {
  if (Object.values(costs).some(filled)) return true;
  return Object.keys(EMPTY_FORM).some((key) => (form[key] ?? EMPTY_FORM[key]) !== EMPTY_FORM[key]);
}

/**
 * Sammu numbri heledus kiirmenüüs ja vaates „Kõik sammud". Eelhinnangu samm on
 * valmis siis, kui arvutus andis summa (`usable`).
 */
export function stepStates(form = {}, costs = {}, usable = false) {
  const declared = declaredCostKeys(costs);
  const group = (keys) => (keys.some((key) => declared.includes(key)) ? "done" : "empty");
  const questions = gateQuestions(declared);
  const answered = questions.filter((question) => form[question.field] === true || form[question.field] === false).length;
  return {
    family: Number(form.adults) + Number(form.minors) > 0 ? "done" : "empty",
    income: ["workIncome", "otherIncome", "paidMaintenance", "enforcementWithheld"].some((key) => filled(form[key])) ? "done" : "empty",
    housing: filled(form.dwellingAreaM2) && filled(form.rooms) ? "done" : filled(form.dwellingAreaM2) || filled(form.rooms) ? "partial" : "empty",
    costs: group(COST_GROUPS.costs),
    utilities: group(COST_GROUPS.utilities),
    gates: !questions.length ? "empty" : answered === questions.length ? "done" : answered ? "partial" : "empty",
    result: usable ? "done" : "empty"
  };
}

/**
 * Puudujäägid ühekordselt. Kaks vastamata täpsustust annavad sama koodi: sama
 * lause kaks korda järjest näeks välja nagu viga, mitte nagu juhis.
 */
export function uniqueIssueCodes(issues = []) {
  return [...new Set(issues.map((issue) => String(issue?.code || "")).filter(Boolean))];
}

/* Summa viga nimetab välja: kuueteistkümne summavälja seast ei pea inimene viga otsima. */
const NAMED_ISSUE_CODES = new Set(["NEGATIVE_AMOUNT", "INVALID_AMOUNT"]);
const FIELD_LABEL_KEYS = Object.freeze({
  otherIncome: "subsistence.fields.other_income",
  workIncome: "subsistence.fields.work_income",
  paidMaintenance: "subsistence.fields.paid_maintenance",
  enforcementWithheld: "subsistence.fields.enforcement"
});
const KNOWN_COST_KEYS = new Set([...COST_GROUPS.costs, ...COST_GROUPS.utilities]);

/** Välja nime võti kataloogis arvutuse välja tee järgi; tundmatu välja kohta tühi sõne. */
export function issueFieldLabelKey(field = "") {
  const name = String(field || "");
  if (name.startsWith("housingCosts.")) {
    const cost = name.slice("housingCosts.".length);
    return KNOWN_COST_KEYS.has(cost) ? `subsistence.costs.${cost}` : "";
  }
  return FIELD_LABEL_KEYS[name] || "";
}

/**
 * Puudujäägid ridadena: kood ja (summa vea korral) välja nime võti. Sama lause
 * ei kordu; kahe eri välja summa viga annab kaks rida, sest kumbki nimetab oma välja.
 */
export function issueRows(issues = []) {
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

/* Eesti ja vene keeles on kümnendmärk koma. */
const decimalMark = (locale) => (String(locale || "et").toLowerCase().startsWith("en") ? "." : ",");

/** Arv kuni ühe komakohaga lehe keeles (pind ruutmeetrites). */
export function plainNumber(value, locale = "et") {
  const number = Math.round((Number(value) || 0) * 10) / 10;
  return String(number).replace(".", decimalMark(locale));
}

/** Summa kahe komakohaga ja euro märgiga, kümnendmärk lehe keele järgi. */
export function euro(value, locale = "et") {
  return `${Number(value || 0).toFixed(2).replace(".", decimalMark(locale))} €`;
}

/**
 * Miks arvesse läks vähem eluasemekulu, kui sisestati. Arvutus kärbib pinnaga
 * seotud kulusid, kui eluruum on normpinnast suurem; varem näitas leht ainult
 * väiksemat summat ilma ühegi sõnata. Tagastab kataloogi võtme ja arvud või
 * `null`, kui sisestatu läks täies mahus arvesse.
 */
export function housingReason(result, locale = "et") {
  const housing = result?.housing;
  if (!result?.usable || !housing || !(housing.declaredTotal > housing.total)) return null;
  if (!result.caveats?.includes("AREA_ABOVE_NORM_SCALED")) return null;
  return {
    key: "subsistence.reason.area_scaled",
    vars: {
      area: plainNumber(housing.dwellingAreaM2, locale),
      norm: plainNumber(housing.normAreaM2, locale),
      percent: Math.round((Number(housing.areaRatio) || 0) * 100),
      declared: euro(housing.declaredTotal, locale)
    }
  };
}
