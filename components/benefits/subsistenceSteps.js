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
 *
 * TEINE SAMM (10.10 järelkontroll). Ülevaataja murdis lehe failis 21 rida ja 19
 * neist jättis kõik testid roheliseks: vastus „Jah" läks arvutusse „Ei"-na,
 * „muu sissetuleku" väli kirjutas töise sissetuleku kohale, keeldumise vaatesse
 * sai joonistada summa. Seepärast on siin nüüd ka need otsused: väljade tabel
 * (`VIEW_FIELDS`: mis nimega väli mis kohta kirjutab), lehe olek ja selle
 * muutmine (`pageReducer`), vastuse ja valiku vastavus (`choiceFromAnswer`,
 * `answerFromChoice`) ning see, mida iga vaade joonistada tohib (`pageView`,
 * `resultView`). Leht joonistab ainult seda, mida need tagastavad.
 */

import {
  MAX_AMOUNT,
  MAX_DWELLING_AREA_M2,
  declaredHousingCostKeys,
  enteredRoomCount,
  estimateSubsistenceBenefit
} from "../../lib/benefits/subsistence.js";

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

/** Eluasemelaenu neli tingimust (SHS § 133 lg 9¹ p 1 kuni 4) kataloogi võtmetena, seaduse järjekorras. */
export const LOAN_CONDITION_KEYS = Object.freeze([
  "subsistence.loan_conditions.borrower",
  "subsistence.loan_conditions.holiday",
  "subsistence.loan_conditions.insurance",
  "subsistence.loan_conditions.residence"
]);

/**
 * Kulud, mille kohta on sisestatud nullist suurem summa. Reegel on arvutuse oma
 * (`declaredHousingCostKeys`), mitte selle koopia: „0" kulu väljal tähendab
 * lehele ja arvutusele sama (kulu ei ole, küsimust ei küsita).
 */
export function declaredCostKeys(costs = {}) {
  return declaredHousingCostKeys(costs);
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
    /* Üür (§ 133 lg 8) kahe küsimusena: üürniku ja üürileandja suhe (üürnik võib olla teine
       pereliige) ning äriühing, mis on seotud taotleja või tema lähedasega. */
    ...(has("rent")
      ? [
          { field: "landlordIsTenantsRelative", text: "subsistence.gates.landlord_relative" },
          { field: "landlordIsRelatedCompany", text: "subsistence.gates.landlord_company" }
        ]
      : []),
    ...(has("buildingManagement") || has("buildingRenovationLoan") ? [{ field: "isApartmentBuilding", text: "subsistence.gates.apartment" }] : []),
    ...(has("housingLoan")
      ? [
          /* Neli tingimust (§ 133 lg 9¹) seisavad loendina KÜSIMUSE EES: ilma nendeta ei saa küsimusele vastata. */
          { field: "housingLoanConditionsMet", text: "subsistence.gates.loan", conditions: LOAN_CONDITION_KEYS },
          { field: "housingLoanMonthLimitReached", text: "subsistence.gates.loan_limit" }
        ]
      : []),
    ...(has("landTax") ? [{ field: "landTaxExempt", text: "subsistence.gates.land_tax", hint: "subsistence.hints.land_tax" }] : [])
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
  landlordIsTenantsRelative: null,
  landlordIsRelatedCompany: null,
  isApartmentBuilding: null,
  housingLoanConditionsMet: null,
  housingLoanMonthLimitReached: null,
  landTaxExempt: null
});

const GATE_FIELDS = Object.freeze([
  "costsAreCurrentMonth",
  "landlordIsTenantsRelative",
  "landlordIsRelatedCompany",
  "isApartmentBuilding",
  "housingLoanConditionsMet",
  "housingLoanMonthLimitReached",
  "landTaxExempt"
]);
const INCOME_FIELDS = Object.freeze(["workIncome", "otherIncome", "paidMaintenance", "enforcementWithheld"]);
/* Täisarvuväljad: nende loetamatu sisu kohta teeb puudujäägi leht ise (arvutus loeks tühja välja
   lihtsalt sisestamata arvuks). Summad ja pind lähevad arvutusse mittearvuna ja arvutus keeldub ise. */
const COUNT_FIELDS = Object.freeze(["adults", "minors", "rooms"]);

/** Pereliikmete ja tubade arv täisarvuna (0 kuni 99): murdosa ja miinust ei ole. */
export function wholeCount(value) {
  return Math.min(99, Math.max(0, Math.trunc(Number(value) || 0)));
}

/** Loetamatu välja tunnus: summa- ja arvuväljal välja nimi, kulul `cost:<kulu>`. */
export const costFieldId = (key) => `cost:${key}`;

/* --- Väljade tabel -------------------------------------------------------------------- */

const numberField = (id, labelKey, extra = {}) =>
  Object.freeze({ id, labelKey, formKey: "", costKey: "", whole: false, step: "0.01", size: "sum", max: String(MAX_AMOUNT), hint: "", ...extra });
const wholeField = (formKey, labelKey, hint) => numberField(formKey, labelKey, { formKey, whole: true, step: "1", size: "count", max: "99", hint });
const amountField = (formKey, labelKey, hint = "") => numberField(formKey, labelKey, { formKey, hint });
const costField = (key) => numberField(costFieldId(key), `subsistence.costs.${key}`, { costKey: key });

/**
 * Arvuväljad vaadete kaupa: mis nimega väli mis kohta kirjutab.
 *
 * `labelKey` on välja nimi kataloogis, `formKey` või `costKey` koht lehe olekus,
 * `whole` ütleb, et väli on täisarv (pereliikmete ja tubade arv: murdosa ei jää
 * väljale, plaat ja arvutus näitavad sama arvu). `hint` on selle selgituse nimi,
 * mis välja kirjeldab (`aria-describedby`), `step`, `size` ja `max` on välja kuju.
 *
 * Sama tabel annab välja nime ka puudujäägi reale (`issueFieldLabelKey`): rida
 * nimetab välja täpselt selle nimega, mis välja kohal seisab.
 */
export const VIEW_FIELDS = Object.freeze({
  family: Object.freeze([wholeField("adults", "subsistence.fields.adults", "family"), wholeField("minors", "subsistence.fields.minors", "family")]),
  income: Object.freeze([
    amountField("workIncome", "subsistence.fields.work_income", "income"),
    amountField("otherIncome", "subsistence.fields.other_income", "income"),
    amountField("paidMaintenance", "subsistence.fields.paid_maintenance"),
    amountField("enforcementWithheld", "subsistence.fields.enforcement")
  ]),
  housing: Object.freeze([
    numberField("dwellingAreaM2", "subsistence.fields.area", { formKey: "dwellingAreaM2", step: "0.1", size: "count", max: String(MAX_DWELLING_AREA_M2) }),
    wholeField("rooms", "subsistence.fields.rooms", "rooms")
  ]),
  costs: Object.freeze(COST_GROUPS.costs.map(costField)),
  utilities: Object.freeze(COST_GROUPS.utilities.map(costField))
});

const ALL_FIELDS = Object.freeze(Object.values(VIEW_FIELDS).flat());
const FIELD_BY_ID = new Map(ALL_FIELDS.map((field) => [field.id, field]));

/**
 * Mida arvuväli lehele ütleb: väärtus ja kas väljal seisab midagi, mida brauser
 * arvuks ei loe.
 *
 * LOETAMATU SISU. Arvuväli annab tühja väärtuse nii siis, kui ta on tühi, kui ka
 * siis, kui sinna on kirjutatud „500,-" või „1 200"; tekst jääb väljale seisma.
 * Vahet teeb ainult brauseri märge `validity.badInput`.
 */
export function readNumberInput(target, whole = false) {
  const typed = String(target?.value ?? "");
  return {
    value: whole && typed !== "" ? String(wholeCount(typed)) : typed,
    unreadable: target?.validity?.badInput === true
  };
}

/**
 * Loetamatute väljade märgid. `{ id, unreadable }` paneb märgi peale või võtab
 * maha; `{ clear: true }` võtab kõik maha (väljad läksid ekraanilt ja nendel
 * seisnud tekst koos nendega). Kui midagi ei muutu, tuleb tagasi SAMA loend:
 * väli teatab oma seisu igal sisestusel ja fookuse lahkumisel ning leht ei pea
 * sellepärast uuesti joonistama.
 */
export function markReducer(bad = [], action = {}) {
  if (action.clear) return bad.length ? [] : bad;
  const id = String(action.id ?? "");
  if (!id) return bad;
  const marked = bad.includes(id);
  if (action.unreadable === true) return marked ? bad : [...bad, id];
  return marked ? bad.filter((item) => item !== id) : bad;
}

/* --- Lehe olek ------------------------------------------------------------------------- */

/** Lehe algseis: vorm, kulud ja loetamatute väljade märgid. */
export const EMPTY_STATE = Object.freeze({ form: EMPTY_FORM, costs: Object.freeze({}), bad: Object.freeze([]) });

/** Väli lehele: mida väli parajasti ütleb (vt `readNumberInput`). */
export const fieldAction = (field, target) => ({ type: "field", id: field?.id, ...readNumberInput(target, field?.whole === true) });

/** Väärtus, mida väli näitab. */
export function fieldValue(state, field) {
  const value = field.costKey ? state.costs[field.costKey] : state.form[field.formKey];
  return value == null ? "" : String(value);
}

/** Täpsustava küsimuse valik vastusest: „yes", „no" või tühi (vastamata). */
export const choiceFromAnswer = (answer) => (answer === true ? "yes" : answer === false ? "no" : "");

/** Vastus valikust. Tundmatu valik on vastamata küsimus, mitte „ei". */
export const answerFromChoice = (choice) => (choice === "yes" ? true : choice === "no" ? false : null);

/** Vastusevariandid lehe järjekorras: „Jah" enne. */
export const ANSWER_CHOICES = Object.freeze([
  Object.freeze({ value: "yes", labelKey: "subsistence.answers.yes" }),
  Object.freeze({ value: "no", labelKey: "subsistence.answers.no" })
]);

/**
 * Lehe oleku muutused. Iga muutus tuleb siit, mitte lehe failist:
 *   - `field`: arvuväli ütleb oma väärtuse ja loetavuse (`fieldAction`);
 *   - `answer`: vastus täpsustavale küsimusele (`choice`: „yes" või „no");
 *   - `singleOccupant`: märge „elan üksi ja olen pensionär …";
 *   - `fieldsGone`: väljad läksid ekraanilt, loetamatu teksti märgid maha.
 * Kui midagi ei muutu, tuleb tagasi SAMA olek.
 */
export function pageReducer(state = EMPTY_STATE, action = {}) {
  switch (action?.type) {
    case "field": {
      const field = FIELD_BY_ID.get(action.id);
      if (!field) return state;
      const value = String(action.value ?? "");
      const bad = markReducer(state.bad, { id: field.id, unreadable: action.unreadable === true });
      const key = field.costKey || field.formKey;
      const group = field.costKey ? "costs" : "form";
      const same = fieldValue(state, field) === value;
      if (same && bad === state.bad) return state;
      return { ...state, [group]: same ? state[group] : { ...state[group], [key]: value }, bad };
    }
    case "answer": {
      if (!GATE_FIELDS.includes(action.field)) return state;
      const answer = answerFromChoice(action.choice);
      if (state.form[action.field] === answer) return state;
      return { ...state, form: { ...state.form, [action.field]: answer } };
    }
    case "singleOccupant": {
      const checked = action.checked === true;
      if (state.form.singleOccupantExtendedNorm === checked) return state;
      return { ...state, form: { ...state.form, singleOccupantExtendedNorm: checked } };
    }
    case "fieldsGone": {
      const bad = markReducer(state.bad, { clear: true });
      return bad === state.bad ? state : { ...state, bad };
    }
    default:
      return state;
  }
}

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
 * arvutusse mittearvuna ja arvutus keeldub välja nimega. Sama käib pinna kohta:
 * muidu ütleks arvutus loetamatu pinna kohta „märgi eluruumi üldpind", nagu
 * oleks väli tühi.
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
    dwellingAreaM2: amount("dwellingAreaM2"),
    rooms: filled(form.rooms) ? form.rooms : null,
    singleOccupantExtendedNorm: form.singleOccupantExtendedNorm === true,
    housingCosts,
    gates
  };
}

/**
 * Lehe tulemus: arvutus pluss need puudujäägid, mida arvutus ise ei näe
 * (loetamatu sisu pereliikmete või tubade väljal). `effectiveDate` on
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
 * kui on vähemalt üks täisealine, eluaseme samm siis, kui pind ja vähemalt üks
 * tuba on sisestatud (null tuba ei ole vastus). Eelhinnangu samm on valmis, kui
 * summa on olemas.
 */
export function stepStates(form = {}, costs = {}, usable = false) {
  const declared = declaredCostKeys(costs);
  const group = (keys) => (keys.some((key) => declared.includes(key)) ? "done" : "empty");
  const questions = gateQuestions(declared);
  const answered = questions.filter((question) => form[question.field] === true || form[question.field] === false).length;
  const incomeEntered = filled(form.workIncome) || filled(form.otherIncome);
  const members = wholeCount(form.adults) + wholeCount(form.minors);
  const roomsEntered = enteredRoomCount(form.rooms) != null;
  return {
    family: wholeCount(form.adults) > 0 ? "done" : members > 0 ? "partial" : "empty",
    income: incomeEntered ? "done" : INCOME_FIELDS.some((key) => filled(form[key])) ? "partial" : "empty",
    housing: filled(form.dwellingAreaM2) && roomsEntered ? "done" : filled(form.dwellingAreaM2) || filled(form.rooms) ? "partial" : "empty",
    costs: group(COST_GROUPS.costs),
    utilities: group(COST_GROUPS.utilities),
    gates: !questions.length ? "empty" : answered === questions.length ? "done" : answered ? "partial" : "empty",
    result: usable ? "done" : "empty"
  };
}

/* Summa viga nimetab välja: kuueteistkümne summavälja seast ei pea inimene viga otsima. */
const NAMED_ISSUE_CODES = new Set(["NEGATIVE_AMOUNT", "INVALID_AMOUNT"]);

/** Välja nime võti kataloogis arvutuse välja tee järgi; tundmatu välja kohta tühi sõne. */
export function issueFieldLabelKey(field = "") {
  const name = String(field || "");
  const id = name.startsWith("housingCosts.") ? costFieldId(name.slice("housingCosts.".length)) : name;
  return FIELD_BY_ID.get(id)?.labelKey || "";
}

/* Kuupäeva puudujäägid tähtsuse järjekorras: korraga on neid arvutuses üks. */
const DATE_ISSUE_CODES = Object.freeze(["DATE_UNREADABLE", "DATE_BEFORE_CURRENT_RATE", "UNSUPPORTED_DATE"]);

/**
 * Kuupäeva puudujäägi kood või tühi sõne: lehe päeva ei saanud lugeda, seadme
 * kell näitab varasemat aastat või selle aasta määra ei ole veel kinnitatud.
 * Igaühel on kataloogis oma lause (`subsistence.issues.<kood>`).
 */
export function dateIssueCode(result) {
  const found = new Set((result?.issues || []).map((issue) => issue?.code));
  return DATE_ISSUE_CODES.find((code) => found.has(code)) || "";
}

/**
 * Puudujäägid ridadena: kood ja (summa vea korral) välja nime võti. Sama lause
 * ei kordu; kahe eri välja summa viga annab kaks rida, sest kumbki nimetab oma
 * välja. Kuupäeva puudujääk on ainus rida: miski, mida inimene lehele sisestab,
 * seda ei muuda, ja teised read kõrval oleksid eksitavad.
 */
export function issueRows(issues = []) {
  const dateCode = dateIssueCode({ issues });
  if (dateCode) return [{ code: dateCode, fieldLabelKey: "" }];
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

/** Puudujäägi lause võti: välja nimega rida võtab lause, kuhu nimi sisse käib. */
export const issueTextKey = (row) => (row?.fieldLabelKey ? `subsistence.issues_named.${row.code}` : `subsistence.issues.${row?.code}`);

/** Välja nimi jutumärkides lehe keele järgi (nagu puudujäägi lausetes). */
export function quoted(text, locale = "et") {
  const lang = String(locale || "et").toLowerCase();
  if (lang.startsWith("en")) return `“${text}”`;
  if (lang.startsWith("ru")) return `«${text}»`;
  return `„${text}”`;
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

/**
 * Faktid tulemuse all. Sisestatud eluasemekulu on real ainult siis, kui arvesse
 * läks vähem. Toimetulekupiiri rida ütleb, MIS AASTA MÄÄRAGA see arvutati
 * (`vars.year`): leht võtab päeva seadme kellast ja inimene peab nägema, mis
 * aasta määra ta ees näeb.
 */
export function resultFacts(result, locale = "et") {
  if (!result?.usable) return [];
  const housing = result.housing || {};
  return [
    { key: "limit", value: euro(result.subsistenceLimit?.total, locale), vars: { year: String(result.subsistenceLimit?.rates?.year ?? "") } },
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

/* --- Mida leht joonistab -------------------------------------------------------------- */

/**
 * Eelhinnangu vaade: KAS summa koos sellega, millest see tuli, VÕI see, mis on
 * puudu. Keeldumise korral ei ole siin ühtegi arvu (summa on tühi sõne, fakte ja
 * lauseid ei ole): leht joonistab ainult seda, mis siit tuleb, seega ei saa
 * keeldumise vaatesse summat joonistada.
 *
 *   usable: true  -> `amount` (suur summa), `facts` (read `labelKey`, `vars`,
 *                    `value`), `sentences` (põhjus ja märkus; `tone` on „quiet"
 *                    või „caveat")
 *   usable: false -> `rows` (puudujäägi read: `key`, `fieldLabelKey`)
 */
export function resultView(result, locale = "et") {
  if (!result?.usable) {
    return {
      usable: false,
      amount: "",
      facts: [],
      sentences: [],
      rows: issueRows(result?.issues).map((row) => ({ id: `${row.code}:${row.fieldLabelKey}`, key: issueTextKey(row), fieldLabelKey: row.fieldLabelKey }))
    };
  }
  const reason = housingReason(result, locale);
  const note = resultNote(result);
  return {
    usable: true,
    amount: euro(result.estimate, locale),
    facts: resultFacts(result, locale).map((fact) => ({ id: fact.key, labelKey: `subsistence.result.${fact.key}`, vars: fact.vars || null, value: fact.value })),
    sentences: [
      /* Miks arvesse läks vähem, kui sisestati: arv ilma põhjuseta näeb välja nagu viga. */
      ...(reason ? [{ id: "reason", key: reason.key, vars: reason.vars, costKeys: reason.costKeys, tone: "quiet" }] : []),
      ...(note === "above_line" ? [{ id: "above_line", key: "subsistence.caveat.above_line", tone: "quiet" }] : []),
      ...(note === "kov_limits" ? [{ id: "kov_limits", key: "subsistence.caveat.kov_limits", tone: "caveat" }] : [])
    ],
    rows: []
  };
}

/**
 * Vaate rea tekst lehe keeles. `item` on fakt, lause või puudujäägi rida:
 * välja nimi (`fieldLabelKey`) ja kulude nimed (`costKeys`, jutumärkides)
 * pannakse lausesse siin, mitte lehe failis.
 */
export function viewText(item, t, locale = "et") {
  const key = item?.key || item?.labelKey || "";
  const vars = { ...(item?.vars || {}) };
  if (item?.fieldLabelKey) vars.field = t(item.fieldLabelKey);
  if (item?.costKeys) vars.costs = item.costKeys.map((costKey) => quoted(t(costKey), locale)).join(", ");
  return Object.keys(vars).length ? t(key, vars) : t(key);
}

/** Täpsustavad küsimused koos sellega, mis on vastatud: `choice` on „yes", „no" või tühi. */
export function gateRows(form = EMPTY_FORM, costs = {}) {
  return gateQuestions(declaredCostKeys(costs)).map((question) => ({ ...question, choice: choiceFromAnswer(form[question.field]) }));
}

/** Vastus täpsustavale küsimusele lehe oleku muutusena. */
export const answerAction = (question, choice) => ({ type: "answer", field: question?.field, choice });

/**
 * Märget „elan üksi ja olen pensionär …" pakutakse ainult ühe pereliikmega:
 * mitme pereliikmega arvutus seda ei kasuta.
 */
export function showSingleOccupant(form = EMPTY_FORM) {
  return wholeCount(form.adults) + wholeCount(form.minors) === 1;
}

/**
 * Mis lehel ees on: laadimine, sisselogimise kutse või vorm. Konto on nõutav
 * (omanik 04.08); kõik, mis ei ole sisse logitud seanss, on sisselogimise kutse.
 */
export function pageScreen(status) {
  if (status === "loading") return "loading";
  return status === "authenticated" ? "form" : "login";
}

/**
 * Kas lahkumist tuleb kinni pidada: vorm on ees ja inimene on midagi sisestanud.
 * Lõppenud seansi korral on ees sisselogimise vaade ja teadet ei oleks kus näidata.
 */
export function leaveGuarded(status, state = EMPTY_STATE) {
  return pageScreen(status) === "form" && formTouched(state.form, state.costs, state.bad);
}

/**
 * Paneb lahkumise värava peale ja tagastab mahavõtja.
 *
 * `leave` on kahe vajutusega värav (`twoPressLeaveGuard`), `register` paneb selle
 * paneeli väravaks (`setPanelLeaveGuard`: kiirmenüü tagasinool ja Esc), `target`
 * on aken: akna sulgemise ja uuesti laadimise peab kinni brauseri enda küsimus
 * (`beforeunload`). Brauseri tagasinuppu ja väljalogimist see ei kata.
 */
export function armLeaveGuard({ leave, register, target }) {
  const release = register(leave);
  const warn = (event) => {
    event.preventDefault();
    event.returnValue = "";
  };
  target.addEventListener("beforeunload", warn);
  return () => {
    release();
    leave.clear();
    target.removeEventListener("beforeunload", warn);
  };
}

/**
 * Kõik, mida vormi vaated joonistavad, ühest kohast.
 *
 *   banner          kuupäeva puudujäägi lause võti lava kohal või tühi sõne: kui
 *                   päeva ei saa lugeda või määra ei ole, ei aita ükski sisestus
 *                   ja seda öeldakse kohe, mitte alles seitsmendas vaates
 *   steps           lava sammud: nime võtmed, seis, kokkuvõte, `free`
 *   gates           täpsustavad küsimused koos valikuga
 *   singleOccupant  kas märget pakutakse ja kas see on sees
 *   result          eelhinnangu vaade (`resultView`)
 *
 * `effectiveDate` on testi jaoks; leht jätab selle andmata.
 */
export function pageView(state = EMPTY_STATE, locale = "et", effectiveDate) {
  const { form, costs, bad } = state;
  const estimate = pageEstimate(form, costs, bad, effectiveDate);
  const states = stepStates(form, costs, estimate.usable);
  const summaries = stepSummaries(form, costs, estimate, locale);
  const gates = gateRows(form, costs);
  const dateCode = dateIssueCode(estimate);
  return {
    banner: dateCode ? `subsistence.issues.${dateCode}` : "",
    steps: STEP_KEYS.map((key) => ({
      key,
      titleKey: `subsistence.views.${key}.title`,
      shortKey: `subsistence.views.${key}.short`,
      state: states[key],
      /* Pere plaadil on lause kataloogist, teistel valmis summa (või mitte midagi). */
      summaryKey: key === "family" ? "subsistence.views.family.summary" : "",
      summaryVars: key === "family" ? summaries.family : null,
      summary: key === "family" ? "" : summaries[key] || "",
      /* Üle nelja täpsustava küsimuse (üür, korterelamu kulud, laen ja maamaks korraga) ei mahu ühte vaatesse:
         see vaade kerib siis paneeli ega tee teisi vaateid enda kõrguseks. */
      free: key === "gates" && gates.length > 4
    })),
    gates,
    singleOccupant: { shown: showSingleOccupant(form), checked: form.singleOccupantExtendedNorm === true },
    result: resultView(estimate, locale)
  };
}
