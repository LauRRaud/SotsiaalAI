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
    ...(has("housingLoan") ? [{ field: "housingLoanConditionsMet", text: "subsistence.gates.loan" }] : [])
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

/** Sammu numbri heledus kiirmenüüs ja vaates „Kõik sammud". */
export function stepStates(form = {}, costs = {}) {
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
    result: "empty"
  };
}

/**
 * Puudujäägid ühekordselt. Kaks vastamata täpsustust annavad sama koodi: sama
 * lause kaks korda järjest näeks välja nagu viga, mitte nagu juhis.
 */
export function uniqueIssueCodes(issues = []) {
  return [...new Set(issues.map((issue) => String(issue?.code || "")).filter(Boolean))];
}

/** Summa kahe komakohaga ja euro märgiga. */
export function euro(value) {
  return `${Number(value || 0).toFixed(2)} €`;
}
