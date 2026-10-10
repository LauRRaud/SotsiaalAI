// Asendajad toimetulekutoetuse lehe testile (`subsistence-calculator-render.test.mjs`).
//
// Leht joonistatakse päris Reactiga, aga ühised klotsid (lava, paneel, valikurida,
// märkekaart, nupp, väli), seanss ja tõlked on siin lihtsad asendajad. Asendaja
// joonistab nii palju, et test saaks märgendist lugeda, mida vaade näitab, ja jätab
// meelde omadused, mille leht talle andis (`seen`): nii saab test vajutada välja
// `onInput` või valikurea `onChange` ja vaadata, mis lehe olekusse jõuab.
//
// ASENDAJA KUTSUB LEHTE NII NAGU PÄRIS KLOTS (loetud 10.10):
//   - Input (components/ui/Input.jsx) annab kõik omadused edasi päris <input>-ile,
//     seega `onChange`, `onInput` ja `onBlur` saavad brauseri sündmuse (`event.target`);
//   - ChoiceRow kutsub `onChange(variandi value)`;
//   - CheckCard kutsub `onChange(uus märgitud olek)`;
//   - StepFlight hoiab KÕIK vaated korraga puus ja kutsub lapsfunktsiooni iga sammu kohta.
// See fail ei kontrolli päris klotse: neid vaadatakse brauseris.
import { createElement as h } from "react";

/** Mida test ette annab (seanss, keel, kataloog) ja mida asendajad nägid. */
export const seen = { status: "authenticated", locale: "et", messages: {}, inputs: [], choices: [], checks: [], flights: [] };

/** Tühjendab nähtu enne uut joonistust. */
export function reset() {
  seen.inputs = [];
  seen.choices = [];
  seen.checks = [];
  seen.flights = [];
}

const lookup = (key) => String(key).split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), seen.messages);

/** Sama reegel mis lehe tõlkijal: puuduva võtme korral tuleb tagasi võti ise, `{nimi}` asendatakse. */
export function translate(key, vars) {
  const template = lookup(key);
  const text = typeof template === "string" ? template : String(key);
  if (!vars || typeof vars !== "object") return text;
  return text.replace(/\{(\w+)\}/g, (whole, name) => (Object.hasOwn(vars, name) && vars[name] != null ? String(vars[name]) : whole));
}

export function useI18n() {
  return { t: translate, locale: seen.locale };
}

export function useSession() {
  return { status: seen.status, data: null };
}

function Input(props) {
  seen.inputs.push(props);
  const { onChange: _onChange, onInput: _onInput, onBlur: _onBlur, ...rest } = props;
  return h("input", { ...rest, readOnly: true });
}

function ChoiceRow(props) {
  seen.choices.push(props);
  return h(
    "div",
    { role: "radiogroup", "aria-label": props.label, "data-layout": props.layout },
    props.options.map((option) => h("button", { key: option.value, type: "button", role: "radio", "aria-checked": option.value === props.value }, option.label))
  );
}

function CheckCard(props) {
  seen.checks.push(props);
  return h("button", { type: "button", role: "checkbox", "aria-checked": props.checked === true }, props.title);
}

function StepPanel({ title, question, lead, note, actions, children }) {
  return h(
    "div",
    { "data-panel": title },
    question ? h("p", { "data-part": "question" }, question) : null,
    lead ? h("p", { "data-part": "lead" }, lead) : null,
    h("div", { "data-part": "body" }, children),
    note ? h("p", { "data-part": "note" }, note) : null,
    actions ?? null
  );
}

function StepFlight({ label, steps, children }) {
  seen.flights.push({ label, steps });
  return h(
    "div",
    { "data-flight": label },
    steps.map((step, index) => h("section", { key: step.key, "data-step": step.key }, children(step, index, { index, count: steps.length, isActive: index === 0 })))
  );
}

function Button({ as = "button", children, size: _size, variant: _variant, glow: _glow, ...rest }) {
  return h(as, rest, children);
}

export const standIns = { Input, ChoiceRow, CheckCard, StepPanel, StepFlight, Button };
