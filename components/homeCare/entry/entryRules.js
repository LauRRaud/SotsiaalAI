/**
 * Uue kirje sammude reeglid ilma joonistamiseta: mis sammud on, mis sammuga
 * kirje avaneb, kui kaugel iga samm on, mis salvestamist takistab ja mis
 * seisab toimingu real.
 *
 * Vormi olek ja saatmine on konksus `./useEntryForm.js`; siinsed funktsioonid
 * loevad selle seisu (`form`) ja ütlevad, mida vaated (`./EntryViews.jsx`)
 * näitavad.
 */

/**
 * Sammud lehe järjekorras. Loend on kindel: samm ei teki ega kao kirjutamise
 * ajal, sammu SISU sõltub kirje liigist ja kontakti viisist.
 *  - kind  mis kirje see on ja kuidas kokku puututi (erijuhtumil ka: mis juhtus)
 *  - done  mida tehti: käigul kava toimingud, erijuhtumil tehtud sammud
 *  - time  käigu kestus, sündmuse aeg ja kes oli kaasas
 *  - text  mida nähti (tavalisel käigul ka: kas midagi oli teisiti) ja salvestamine
 */
export const ENTRY_STEPS = Object.freeze(["kind", "done", "time", "text"]);

/**
 * Mis sammuga kirje avaneb. Tavaline käigu kirje (vaikimisi valik) algab
 * toimingutest, kui kliendil on neid loendis: hooldaja märgib ukse taga kõige
 * sagedamini just seda ja liik on juba õige. Muu kirje algab liigist.
 */
export function openingStep(form) {
  /* Parandus avaneb viimase sammuga: seal on tekst, paranduse põhjus ja salvestamine. */
  if (form?.correcting) return "text";
  return form?.kind === "NOTE" && form.isVisit && (form.visitChoices || []).length > 0 ? "done" : "kind";
}

const filled = (value) => Boolean(String(value || "").trim());
const count = (value) => (value && typeof value === "object" ? Object.keys(value).length : 0);

/**
 * Mis salvestamist takistab: `{ key, step }` või null. `key` on teate võti,
 * `step` samm, kus selle saab korda teha. Järjekord on sammude järjekord.
 */
export function entryProblem(form) {
  if (form.isIncident && !form.incidentType) return { key: "home_care.entry_steps.problems.incident_type", step: "kind" };
  if (form.reasonMissing) return { key: "home_care.visit.reason_missing", step: "done" };
  if (form.medicationMissing) return { key: "home_care.medication.missing", step: "done" };
  if (form.changed && !(form.diffAreas || []).length) return { key: "home_care.change.area_missing", step: "text" };
  if (form.textRequired && !filled(form.text)) return { key: "home_care.entry_steps.problems.text", step: "text" };
  /* Parandus nõuab põhjust: see jääb kirje ajalukku. */
  if (form.correcting && !filled(form.reason)) return { key: "home_care.entry_steps.problems.reason", step: "text" };
  return null;
}

/** Sammu numbri heledus kiirmenüüs: tühi, pooleli või tehtud. Liik ja viis on vaikevalikuga kohe „tehtud". */
export function entryStepStates(form) {
  const marked = (form.doneList || []).length;
  const actions = count(form.actions);
  const done = form.reasonMissing || form.medicationMissing ? "partial" : marked || (form.isIncident && actions) ? "done" : "empty";
  return {
    kind: form.isIncident && !form.incidentType ? "partial" : "done",
    done,
    time: filled(form.visitMinutes) || filled(form.occurredLocal) || filled(form.companion) ? "done" : "empty",
    text: entryProblem(form)?.step === "text" ? (filled(form.text) ? "partial" : "empty") : filled(form.text) || !form.textRequired ? "done" : "empty"
  };
}

/**
 * Toimingute read sammus „Mida tegid": `[{ id, name, state, line, wait, plan, medication, critical }]`.
 * `state`: "done", "skipped" või "" (veel ütlemata). `line` on rea teine rida:
 * kuidas tehti (ainult siis, kui see erineb kavas kirjas olevast viisist: kava
 * järgi tehtud toimingu rida jääb üherealiseks ja pikk loend lühemaks),
 * ravimitoimingu märge või miks jäi tegemata. `wait` märgib rea, kus valik on
 * veel tegemata (põhjus või ravimitoimingu märge).
 */
export function activityRows(form, { t }) {
  return (form.visitChoices || []).map((choice) => {
    const id = choice.activityId;
    const mode = form.done?.[id];
    const skipped = id in (form.skipped || {});
    const medication = form.isMedication(choice);
    const action = medication ? form.medication?.[id] : "";
    let line = "";
    let wait = false;
    if (mode) {
      wait = medication && !action;
      line = [mode !== choice.mode ? t(`home_care.visit.modes.${mode}`) : null, action ? t(`home_care.medication.actions.${action}`) : null, wait ? t("home_care.entry_steps.pick_action") : null]
        .filter(Boolean)
        .join(" · ");
    } else if (skipped) {
      wait = form.skipped[id] === "";
      line = wait ? t("home_care.visit.reason_pick") : t(`home_care.visit.outcomes.${form.skipped[id]}`);
    }
    return {
      id,
      name: choice.name,
      state: mode ? "done" : skipped ? "skipped" : "",
      line,
      wait,
      /* Kavavälist toimingut ei saa märkida tegemata jäänuks: selle võtab lihtsalt maha. */
      plan: (form.planChoices || []).includes(choice),
      medication,
      critical: Boolean(choice.critical) && !mode
    };
  });
}

/** Lühike kokkuvõte viimase sammu ülaservas: liik, viis, mitu toimingut on märgitud ja kestus. Tühi osa jääb välja. */
export function entrySummary(form, { t }) {
  const done = (form.doneList || []).filter((item) => !item.outcome).length;
  const skipped = (form.doneList || []).filter((item) => item.outcome).length;
  const minutes = String(form.visitMinutes || "").trim();
  return [
    t(`home_care.entry.kinds.${form.kind}`),
    t(`home_care.entry.contact.${form.contactMode}`),
    done ? t("home_care.entry_steps.summary_done", { count: done }) : null,
    skipped ? t("home_care.entry_steps.summary_skipped", { count: skipped }) : null,
    form.isVisit && /^\d+$/.test(minutes) ? t("home_care.visit.minutes", { minutes }) : null
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Vastus küsimusele „kas midagi oli teisiti?" ühe reana: valdkonnad ja suure muutuse märge. */
export function changeSummary(form, { t }) {
  if (form.different !== "YES") return "";
  const areas = (form.diffAreas || []).map((area) => t(`home_care.change.areas.${area}`));
  return [areas.length ? t("home_care.change.entry_line", { areas: areas.join(", ") }) : t("home_care.change.area_missing"), form.diffMajor ? t("home_care.change.major_badge") : null]
    .filter(Boolean)
    .join(" · ");
}
