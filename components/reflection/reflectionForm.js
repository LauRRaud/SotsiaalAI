/**
 * Meetodipeegli vorm ILMA JSX-ita: vaated, väljad ja see, mida neist arvutatakse.
 *
 * MIKS OMA FAIL. Kuni vormi kuju ja arvutused elasid lehe JSX-is, ei saanud
 * testida, kas iga väli on mõnes vaates, mida salvestamisel serverile saadetakse,
 * mis kahe versiooni vahel päriselt erineb ja mida loendirida näitab. Siin on
 * puhtad funktsioonid; leht (`ReflectionPage.jsx`) hoiab olekut ja päringuid,
 * vaated (`ReflectionViews.jsx`) ainult joonistavad.
 *
 * VAADE ON VÄIKE. Vormil on kaksteist tekstivälja ja kaks valikut. Ühes pikas
 * veerus tuli need läbi kerida ja salvestamise nupp oli lehe lõpus. Siin on
 * vorm jagatud vaadeteks: kuni kolm välja kuni kahel real (`layout`: rida on
 * üks väli või kaks kõrvuti), et vaade mahuks klaaspaneeli ära. Väljade
 * rühmad on samad mis analüüsidokumendis (ptk 3.3): valik, vaatlus, tõlgendus,
 * järeldus.
 *
 * Sõltuvused on ainult rakenduskihi sõnastikud (ei Prismat ega Reacti).
 */

import { resolveApiMessage } from "@/lib/i18n/resolveApiMessage";
import { interimOutcomeLabelKey, supportNeedLabelKey } from "@/lib/reflection/constants";

/** Vormi vaated järjekorras. `layout` rida = üks väli või kaks kõrvuti. */
export const FORM_VIEWS = Object.freeze([
  { key: "method", layout: [["approach"], ["method"]] },
  { key: "action", layout: [["action"], ["supportTechnique"]] },
  { key: "reason", layout: [["choiceReason"]] },
  { key: "observation", layout: [["clientGoal", "clientReaction"], ["workerObservation"]] },
  { key: "interpretation", layout: [["interpretation"], ["whatWorked", "whatDidNot"]] },
  { key: "conclusion", layout: [["nextStep"], ["supportNeed"]] },
  { key: "outcome", layout: [["interimOutcome"]] }
]);

/* Valikuväljad: mitu lahtrit reas. Toevajadusel on neli lühikest vastust (üks
   rida), vahehindamisel kümme pikemat (kaks veergu, viis rida: ühtlane võrk). */
export const CHOICE_FIELDS = Object.freeze({ supportNeed: { columns: 4 }, interimOutcome: { columns: 2 } });

/* Pikem mõtisklus saab rohkem ridu; ülejäänud väljad on kaherealised. */
const TEXT_ROWS = Object.freeze({ choiceReason: 6, interpretation: 3 });

export const viewFields = (view) => (view?.layout || []).flat();
export const isChoiceField = (field) => Object.prototype.hasOwnProperty.call(CHOICE_FIELDS, field);
export const textRows = (field) => TEXT_ROWS[field] || 2;

const ALL_FIELDS = FORM_VIEWS.flatMap(viewFields);
export const TEXT_FIELDS = Object.freeze(ALL_FIELDS.filter((field) => !isChoiceField(field)));

/**
 * Lava vaadete võtmed. Loend on alati esimene; avatud kirje vaated tulevad
 * selle järele. Kahe versiooni võrdlus on olemas ainult siis, kui salvestamine
 * leidis serverist uuema versiooni.
 */
export function reflectionViewKeys({ open = false, conflict = false } = {}) {
  if (!open) return ["list"];
  return ["list", ...FORM_VIEWS.map((view) => view.key), ...(conflict ? ["conflict"] : []), "entry"];
}

export function emptyForm() {
  const form = {};
  for (const field of ALL_FIELDS) form[field] = "";
  return form;
}

export function formFromReflection(reflection) {
  const form = emptyForm();
  for (const field of ALL_FIELDS) form[field] = reflection?.[field] || "";
  return form;
}

/** Salvestamise sisu: tühi väli läheb serverile `null`-ina (server puhastab välja). */
export function reflectionBody(form) {
  const body = {};
  for (const field of ALL_FIELDS) body[field] = form?.[field] || null;
  return body;
}

const settled = (value) => String(value ?? "").trim();

/** Kas kaks vormi on sisult samad? Tühikud välja alguses ja lõpus ei loe (server lõikab need ära). */
export function sameForm(a, b) {
  return ALL_FIELDS.every((field) => settled(a?.[field]) === settled(b?.[field]));
}

/** Vaate täituvus sammu numbri heleduse jaoks. */
export function viewState(view, form) {
  const fields = viewFields(view);
  const filled = fields.filter((field) => settled(form?.[field])).length;
  if (!filled) return "empty";
  return filled === fields.length ? "done" : "partial";
}

/** Tekst ühele reale: liigne lõigatakse sõna piirilt ja lõppu tuleb kolmikpunkt. */
export function clip(value, max = 90) {
  const text = settled(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** Valiku nimi kataloogist. Tundmatu väärtus jääb sildita: sisemist koodi ekraanile ei trükita. */
export function choiceLabel(field, value, t) {
  const key = field === "supportNeed" ? supportNeedLabelKey(value) : field === "interimOutcome" ? interimOutcomeLabelKey(value) : null;
  return key ? t(key) : "";
}

/** Vaate kokkuvõte „Kõik sammud" plaadile: esimene täidetud väli. Tühi vaade annab tühja sõne. */
export function viewSummary(view, form, t) {
  for (const field of viewFields(view)) {
    const value = settled(form?.[field]);
    if (!value) continue;
    const text = isChoiceField(field) ? choiceLabel(field, value, t) : clip(value);
    if (text) return text;
  }
  return "";
}

/**
 * Väljad, mis minu salvestamata versioonis ja serveri versioonis erinevad.
 * Samad väljad jäävad välja: võrrelda on vaja ainult seda, mis läks lahku.
 */
export function conflictRows(form, server) {
  return ALL_FIELDS.filter((field) => settled(form?.[field]) !== settled(server?.[field])).map((field) => ({
    field,
    choice: isChoiceField(field),
    mine: settled(form?.[field]),
    theirs: settled(server?.[field])
  }));
}

/**
 * Loendi read: pealkiri (meetod või lähenemisviis), aeg ja vahehindamise tulem märgina.
 * Kirje sisu loendisse ei tule; pikk pealkiri lõigatakse, et rida jääks madal.
 */
export function reflectionRows(items, { t, formatDate, openId = null, busyId = null }) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: String(item?.id),
    title: clip(item?.method || item?.approach, 80) || t("reflection.list.untitled"),
    date: item?.createdAt ? formatDate(item.createdAt) : "",
    outcome: choiceLabel("interimOutcome", item?.interimOutcome, t),
    selected: Boolean(openId) && item?.id === openId,
    busy: Boolean(busyId) && item?.id === busyId
  }));
}

/**
 * Ebaõnnestunud päringu tekst inimesele.
 *
 * Serveri enda võti tuleb enne üldist „kirjet ei leitud": 404 tähendab loomisel
 * ka seda, et seotud tegevust ei leitud (`reflection.errors.source_missing`),
 * ja varem nägi inimene selle asemel „Kirjet ei leitud".
 */
export function reflectionErrorText({ status, payload } = {}, t) {
  if (status === 401) return t("reflection.common.login_required");
  const apiKey = typeof payload?.message === "string" ? payload.message.trim() : "";
  if (apiKey.startsWith("reflection.")) {
    const translated = t(apiKey);
    if (translated && translated !== apiKey) return translated;
  }
  if (status === 404) return t("reflection.errors.record_missing");
  return resolveApiMessage({ payload, t, fallbackKey: "reflection.errors.load_failed" });
}
