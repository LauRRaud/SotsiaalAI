/**
 * Koostamisruumi reeglid ILMA JSX-ita.
 *
 * MIKS OMA FAIL. Ruum oli üks 2600-realine komponent ja iga otsus elas selle
 * JSX-is: millised vaated on pöördujal ja millised spetsialistil, millal
 * tulemuse vaated tekivad, mis puudub enne, kui tasulist tööd saab käivitada,
 * ja mis läheb kaotsi, kui tekst asendatakse. Neid ei saanud testida. Siin on
 * puhtad funktsioonid; leht (`../AgentModePage.jsx`) hoiab andmeid, päringuid
 * ja olekut ning vaated (`./ComposeViews.jsx`, `./ResultViews.jsx`,
 * `./AudioViews.jsx`) ainult joonistavad.
 *
 * TOORES VÄÄRTUS EI JÕUA EKRAANILE. Iga seis (väljundi tüüp, mustandi olek,
 * versiooni liik, salvestise eesmärk) läbib kataloogi; tundmatu väärtus annab
 * üldise sõna või jääb ära, mitte ei kuva sisemist koodi ega võtit.
 */

import { MAX_USER_MESSAGE_CHARS } from "@/lib/chat/messageLimits";
import { clientTaskInstruction } from "@/lib/documents/agentTasks";
import { AGENT_ARTIFACT_TYPE_VALUES } from "@/lib/documents/constants";
import { formatDate, formatFileSize, kindLabel } from "@/lib/documents/presentation";

/** Pöörduja töös on korraga kuni kaks faili. */
export const CLIENT_MAX_DOCUMENTS = 2;
/** Tööruum hoiab mälus nii mitu viimast versiooni. */
export const WORKSPACE_VERSION_LIMIT = 8;
/** Pöörduja viimaste tulemuste loend: server annab kuni nii mitu (`/api/documents/artifacts?limit=10`). */
export const RECENT_RESULTS_LIMIT = 10;
/** Helifailide loend: server annab kuni nii mitu uusimat (`take: 50` marsruudis audio-sources). */
export const AUDIO_SOURCE_LIST_LIMIT = 50;
/** Teine vajutus (asendamine, kustutamine, lahkumine) peab tulema selle aja sees. */
export const CONFIRM_MS = 8000;
/* Lühim vahe kahe vajutuse vahel: topeltklõps on alla selle. */
export const PRESS_GAP_MS = 400;
/** Isikuandmete kontrolli töövoo nimi: sama, mille vestluse sisestusriba dokumendirežiimis saatis. */
export const PRIVACY_WORKFLOW = "document_generation";

/**
 * Pöörduja ülesanded. Iga ülesanne annab serverile oma väljundi tüübi; juhise
 * ette lisatakse ülesande kirjeldus (`clientTaskInstruction`).
 */
export const CLIENT_AGENT_TASK_OPTIONS = Object.freeze([
  { value: "LETTER_REQUEST", artifactType: "LETTER_DRAFT", labelKey: "documents.drafting.tasks.letter_request" },
  { value: "LETTER_REPLY", artifactType: "LETTER_DRAFT", labelKey: "documents.drafting.tasks.letter_reply" },
  { value: "FILL_FORM", artifactType: "OTHER", labelKey: "documents.drafting.tasks.fill_form" }
]);

/** Kust helifail tuleb. Võtmed on välja kirjutatud, et test leiaks iga sõna kolmes keeles. */
export const AUDIO_WAYS = Object.freeze([
  { value: "record_now", labelKey: "documents.drafting.audio.ways.record_now" },
  { value: "upload_file", labelKey: "documents.drafting.audio.ways.upload_file" },
  { value: "choose_existing", labelKey: "documents.drafting.audio.ways.choose_existing" }
]);

export const AUDIENCE_OPTIONS = Object.freeze([
  { value: "worker", labelKey: "chat.deep_research.scope_output_worker" },
  { value: "client", labelKey: "chat.deep_research.scope_output_client" }
]);
export const TONE_OPTIONS = Object.freeze([
  { value: "professional", labelKey: "documents.drafting.style.tones.professional" },
  { value: "supportive", labelKey: "documents.drafting.style.tones.supportive" },
  { value: "plain", labelKey: "documents.drafting.style.tones.plain" }
]);
export const LANGUAGE_OPTIONS = Object.freeze([
  { value: "et", labelKey: "common.languages.et" },
  { value: "en", labelKey: "common.languages.en" },
  { value: "ru", labelKey: "common.languages.ru" }
]);
export const LENGTH_OPTIONS = Object.freeze([
  { value: "short", labelKey: "documents.drafting.style.lengths.short" },
  { value: "standard", labelKey: "documents.drafting.style.lengths.standard" },
  { value: "detailed", labelKey: "documents.drafting.style.lengths.detailed" }
]);

/** Versiooni liigid: kust tööruumi versioon tuli. */
export const VERSION_KINDS = Object.freeze({
  loaded: "documents.drafting.versions.kinds.loaded",
  generated: "documents.drafting.versions.kinds.generated",
  refined: "documents.drafting.versions.kinds.refined",
  rerun: "documents.drafting.versions.kinds.rerun"
});

/* Helisalvestise päritolu sõnad. */
const AUDIO_ORIGIN_KEYS = Object.freeze({
  call: "documents.drafting.audio.origin_call",
  recorded: "documents.drafting.audio.origin_recorded",
  upload: "documents.drafting.audio.origin_upload"
});

export const COMPOSE_VIEWS_WORKER = Object.freeze(["sources", "type", "template", "style", "instruction"]);
export const COMPOSE_VIEWS_CLIENT = Object.freeze(["task", "files", "instruction"]);
export const AUDIO_VIEWS = Object.freeze(["audio", "transcribe", "review", "summary"]);
const RESULT_VIEWS = Object.freeze(["text", "refine", "versions", "approve", "finish"]);

/** Vaated, millel on kataloogis nimi ja lühinimi (`documents.drafting.views.<võti>`). */
export const VIEW_TEXT_KEYS = Object.freeze([
  ...COMPOSE_VIEWS_WORKER,
  "task",
  "files",
  ...RESULT_VIEWS,
  "results",
  ...AUDIO_VIEWS
]);

/**
 * Vaated, mis võivad olla pikad (loend, terve tekst): nende järgi lava ühist
 * kõrgust ei võeta ja siis kerib kogu paneel, mitte kast paneeli sees.
 */
export const FREE_VIEWS = Object.freeze(["sources", "files", "template", "text", "versions", "results", "audio", "review"]);

/**
 * Tegevused, mis küsivad teist vajutust, ja nende sõnad: `label` on nupu sõnad
 * teise vajutuse ajaks (kui tegevusel on nupp), `note` selgitus selle kõrval.
 * Kinnituse võti on kujul `liik` või `liik:täpsustus` (nt `version:<id>`).
 *
 * - compose, summary: uus tekst asendaks salvestamata muudatused
 * - leave, esc, panel: lahkumine viiks salvestamata muudatused kaasa (`panel`:
 *   kiirmenüü tagasi-nool või paneeli sulgemine, mida leht ise ei joonista)
 * - clear, open: tulemuse eemaldamine või teise avamine teeb sama
 * - version, saved: taastamine asendaks teksti, mida ei ole üheski versioonis
 * - delete, approve, finish: pöördumatu tegu
 * - audio, upload: teine helifail viiks transkripti salvestamata parandused
 * - way, exit: salvestamine käib ja lõpeks
 */
export const CONFIRM_KINDS = Object.freeze({
  compose: { label: "documents.drafting.confirm.compose", note: "documents.drafting.confirm.replace_note" },
  summary: { label: "documents.drafting.confirm.compose", note: "documents.drafting.confirm.replace_note" },
  leave: { label: "documents.drafting.confirm.leave", note: "documents.drafting.confirm.leave_note" },
  esc: { label: "", note: "documents.drafting.confirm.esc_note" },
  panel: { label: "", note: "documents.drafting.confirm.panel_note" },
  clear: { label: "documents.drafting.confirm.clear", note: "documents.drafting.confirm.clear_note" },
  open: { label: "documents.drafting.confirm.open", note: "documents.drafting.confirm.open_note" },
  version: { label: "documents.drafting.confirm.restore", note: "documents.drafting.confirm.restore_note" },
  saved: { label: "documents.drafting.confirm.restore", note: "documents.drafting.confirm.restore_note" },
  delete: { label: "documents.views.confirm_delete", note: "documents.drafting.confirm.delete_note" },
  approve: { label: "documents.drafting.confirm.approve", note: "documents.drafting.confirm.approve_note" },
  finish: { label: "documents.drafting.confirm.finish", note: "documents.drafting.confirm.finish_note" },
  audio: { label: "documents.drafting.confirm.choose", note: "documents.drafting.confirm.transcript_note" },
  upload: { label: "documents.drafting.confirm.choose", note: "documents.drafting.confirm.transcript_note" },
  way: { label: "", note: "documents.drafting.confirm.recording_note" },
  exit: { label: "", note: "documents.drafting.confirm.recording_note" }
});

/** Ootel kinnituse sõnad: `{ kind, labelKey, noteKey }` või `null`, kui midagi ei oota. */
export function confirmTexts(armedKey) {
  const kind = String(armedKey || "").split(":")[0];
  const texts = CONFIRM_KINDS[kind];
  return texts ? { kind, labelKey: texts.label, noteKey: texts.note } : null;
}

const options = (list, t) => list.map((option) => ({ value: option.value, label: t(option.labelKey) }));
export const audienceOptions = (t) => options(AUDIENCE_OPTIONS, t);
export const toneOptions = (t) => options(TONE_OPTIONS, t);
export const languageOptions = (t) => options(LANGUAGE_OPTIONS, t);
export const lengthOptions = (t) => options(LENGTH_OPTIONS, t);
export const audioWayOptions = (t) => options(AUDIO_WAYS, t);
export const clientTaskOptions = (t) => options(CLIENT_AGENT_TASK_OPTIONS, t);

/** Kataloogi sõna või tühi string: `t` annab puuduva sõna asemel võtme enda tagasi. */
function word(t, key) {
  const text = t(key);
  return typeof text === "string" && text && text !== key ? text : "";
}

/** Väljundi tüübi nimi; tundmatu tüüp saab üldise sõna, mitte koodi. */
export function typeLabel(type, t) {
  return word(t, `documents.artifact_types.${String(type || "other").toLowerCase()}`) || t("documents.artifact_types.other");
}

/** Mustandi olek spetsialistile: mustand või kinnitatud. */
export function statusLabel(status, t) {
  return t(String(status || "") === "DRAFT" ? "documents.status.draft" : "documents.status.final");
}

/** Sama olek pöördujale tema sõnadega: pooleli või valmis. */
export function clientStatusLabel(status, t) {
  return t(String(status || "") === "FINAL" ? "documents.drafting.results.status_final" : "documents.drafting.results.status_draft");
}

/** Pöörduja ülesande väljundi tüüp, mille server saab. */
export function clientTaskArtifactType(task) {
  return CLIENT_AGENT_TASK_OPTIONS.find((option) => option.value === task)?.artifactType || "LETTER_DRAFT";
}

/** Spetsialisti väljunditüübid. Transkripti kokkuvõte sünnib ainult heli rajal ega ole siin valikus. */
export function outputTypeOptions(t) {
  return AGENT_ARTIFACT_TYPE_VALUES.filter((value) => value !== "TRANSCRIPT_SUMMARY").map((value) => ({ value, label: typeLabel(value, t) }));
}

/** Kas valitud tüübiga saab uut teksti koostada (heli raja kokkuvõtte tüüpi siit ei koostata). */
export function isComposableType(type) {
  return AGENT_ARTIFACT_TYPE_VALUES.includes(String(type || "")) && String(type || "") !== "TRANSCRIPT_SUMMARY";
}

/** Mall sobib, kui see on üldine või mõeldud samale väljunditüübile. */
export function isTemplateCompatible(template, artifactType) {
  const templateType = String(template?.templateFor || "").trim().toUpperCase();
  const targetType = String(artifactType || "").trim().toUpperCase();
  return !templateType || templateType === "OTHER" || templateType === targetType;
}

/** Malli nimi valikus: pealkiri ja, kui mall on mõeldud kindlale väljundile, selle nimi. */
export function templateOptionLabel(template, t) {
  const title = String(template?.title || template?.originalName || "").trim() || t("documents.workspace.untitled");
  const target = template?.templateFor ? word(t, `documents.template_for.${String(template.templateFor).toLowerCase()}`) : "";
  return target ? `${title} · ${target}` : title;
}

/** Malli valik: „ilma mallita” ja sobivad mallid. */
export function templateOptions(templates, t) {
  return [
    { value: "", label: t("documents.drafting.template.none") },
    ...(Array.isArray(templates) ? templates : []).map((template) => ({ value: template.id, label: templateOptionLabel(template, t) }))
  ];
}

/**
 * Tulemuse seis: `none` (tulemust ei ole), `loading`, `failed` (avamine ei
 * õnnestunud), `draft` (muudetav) või `final` (kinnitatud, ainult lugemiseks).
 */
export function resultStateOf({ result = null, loading = false, error = "" } = {}) {
  if (loading) return "loading";
  if (result) return String(result.status || "") === "DRAFT" ? "draft" : "final";
  return error ? "failed" : "none";
}

/**
 * Millised vaated on ees.
 *
 * - Heli rada (ainult spetsialistil) on oma jada ja selle vaated on alati samad:
 *   lava ei ehitata salvestamise ajal ümber, muidu lõpeks salvestamine.
 * - Koostamise jada lõppu tulevad tulemuse vaated alles siis, kui tulemus on
 *   olemas (või seda parajasti avatakse): tekst alati, täiendamine ja
 *   versioonid ainult muudetaval mustandil, kinnitamine mustandil ja
 *   kinnitatud tekstil.
 * - Pöördujal on lühem tee (ülesanne, failid, juhis) ja lõpus tema viimased
 *   tulemused; versioone talle ei näidata.
 */
export function viewKeysFor({ client = false, level = "compose", resultState = "none" } = {}) {
  if (!client && level === "audio") return [...AUDIO_VIEWS];
  const keys = client ? [...COMPOSE_VIEWS_CLIENT] : [...COMPOSE_VIEWS_WORKER];
  if (resultState !== "none") {
    keys.push("text");
    if (resultState === "draft") keys.push("refine");
    if (!client && resultState === "draft") keys.push("versions");
    if (resultState === "draft" || resultState === "final") keys.push(client ? "finish" : "approve");
  }
  if (client) keys.push("results");
  return keys;
}

/**
 * Milline vaade on ees, kui soovitud vaadet enam ei ole (tulemus eemaldati,
 * mustand kinnitati, roll vahetus). Tulemuse vaatest minnakse tulemuse teksti
 * või, kui tulemust enam ei ole, juhise juurde.
 */
export function activeViewFor(view, keys) {
  if (keys.includes(view)) return view;
  if (RESULT_VIEWS.includes(view)) return keys.includes("text") ? "text" : keys.includes("instruction") ? "instruction" : keys[0];
  return keys[0];
}

/** Kas tulemuse pealkiri või sisu erineb sellest, mis on salvestatud. */
export function hasUnsavedText(result, title, content) {
  if (!result) return false;
  return String(title || "").trim() !== String(result.title || "").trim() || String(content || "") !== String(result.content || "");
}

/** Kas tööruumi versioon on sama mis toimetis olev tekst. */
export function isVersionActive(version, title, content) {
  return String(version?.title || "").trim() === String(title || "").trim() && String(version?.content || "") === String(content || "");
}

/**
 * Kas toimetis on teksti, mida ei ole salvestatud EGA üheski tööruumi
 * versioonis. Ainult selline tekst läheb versiooni taastamisel päriselt kaotsi;
 * versioonide vahel liikumine ei küsi iga kord teist vajutust.
 */
export function textAtRisk({ result, title, content, versions = [] } = {}) {
  if (!hasUnsavedText(result, title, content)) return false;
  return !(Array.isArray(versions) ? versions : []).some((version) => isVersionActive(version, title, content));
}

/**
 * Juhise suurim pikkus. Server lubab 4000 märki; pöörduja juhise ette lisatakse
 * ülesande kirjeldus ja kaks reavahetust, mis loetakse sama piiri sisse.
 */
export function instructionLimit({ client = false, task = "" } = {}) {
  return client ? MAX_USER_MESSAGE_CHARS - clientTaskInstruction(task).length - 2 : MAX_USER_MESSAGE_CHARS;
}

/**
 * Mis takistab uue teksti koostamist. Tühi string tähendab, et saab koostada.
 * `type`: heli raja kokkuvõtte tüüpi siit ei koostata, enne tuleb valida väljund.
 */
export function composeBlocker({ client = false, documentCount = 0, type = "", instruction = "", limit = MAX_USER_MESSAGE_CHARS, busy = false } = {}) {
  if (busy) return "busy";
  if (!documentCount) return "documents";
  if (!client && !isComposableType(type)) return "type";
  const text = String(instruction || "").trim();
  if (!text) return "instruction";
  if (text.length > limit) return "too_long";
  return "";
}

/** Mis takistab mustandi täiendamist. Täiendada saab ainult muudetavat mustandit, millel on tekst ja lähtefailid. */
export function refineBlocker({ resultState = "none", documentCount = 0, content = "", instruction = "", limit = MAX_USER_MESSAGE_CHARS, busy = false } = {}) {
  if (busy) return "busy";
  if (resultState !== "draft") return "no_draft";
  if (!documentCount) return "documents";
  if (!String(content || "").trim()) return "empty_text";
  const text = String(instruction || "").trim();
  if (!text) return "instruction";
  if (text.length > limit) return "too_long";
  return "";
}

/** Mis takistab transkripti koostamist. Kui transkript on olemas, uut ei koostata. */
export function transcribeBlocker({ sourceId = "", hasTranscript = false, busy = false } = {}) {
  if (busy) return "busy";
  if (!sourceId) return "source";
  if (hasTranscript) return "exists";
  return "";
}

/** Kas transkripti parandused on salvestamata. Tühja teksti ei salvestata. */
export function transcriptEdited(transcript, draft) {
  if (!transcript?.id || !String(draft || "").trim()) return false;
  return String(draft || "") !== String(transcript.content || "");
}

/**
 * Mis takistab kokkuvõtte koostamist. `loaded`: transkripti terve tekst on
 * avatud (loendi rida kannab ainult teksti algust ja sellest kokkuvõtet ei tehta).
 */
export function summaryBlocker({ transcriptId = "", loaded = false, draft = "", busy = false } = {}) {
  if (busy) return "busy";
  if (!transcriptId || !loaded) return "transcript";
  if (!String(draft || "").trim()) return "empty_text";
  return "";
}

/** Kas valitud fail on helifail, mida tasub üles laadida (sama reegel, mis lehel varem; server kontrollib ka sisu). */
export function audioFileProblem(file) {
  const mime = String(file?.type || "").toLowerCase();
  return mime.startsWith("audio/") || ["video/webm", "video/mp4", "application/ogg"].includes(mime) ? "" : "documents.errors.audio_mime_not_allowed";
}

/**
 * Teise vajutuse reegel. `arm`: esimene vajutus (küsi kinnitust); `wait`: teine
 * vajutus tuli liiga ruttu (topeltklõps) ja jäetakse vahele; `run`: tee ära.
 */
export function confirmPress({ armedKey = "", armedAt = 0, key = "", now = 0, gap = PRESS_GAP_MS } = {}) {
  if (!key || armedKey !== key) return "arm";
  return now - armedAt < gap ? "wait" : "run";
}

/** Tasulise töö nupp: vajutus loeb ainult siis, kui eelmisest vajutusest on möödas rohkem kui topeltklõpsu vahe. */
export function pressAllowed(lastAt, now, gap = PRESS_GAP_MS) {
  return !lastAt || now - lastAt >= gap;
}

const RAW_KEY = /^[a-z_0-9]+(\.[a-z_0-9]+)+$/;

/**
 * Serveri veateade inimesele. Dokumentide marsruudid saadavad tõlgitud lause,
 * aga peatatud koostamise marsruut saadab `message` väljal võtme enda
 * (`api.rag.retired`): seda ekraanile ei lasta, vaid otsitakse kataloogist sõna.
 */
export function serverMessage(payload, t, fallbackKey) {
  const message = String(payload?.message || "").trim();
  const key = String(payload?.messageKey || "").trim();
  if (message && message !== key && !RAW_KEY.test(message)) return message;
  for (const candidate of [key, message]) {
    const text = candidate ? word(t, candidate) : "";
    if (text) return text;
  }
  return t(fallbackKey);
}

/**
 * Isikuandmete kontrolli valikud. Kontrolli tõrke korral saab proovida uuesti
 * või teksti muuta; leiu korral muuta teksti, saata maskeeritud tekst või (kui
 * töövoog lubab) algne tekst.
 */
export function privacyChoices(prompt) {
  if (!prompt) return [];
  if (prompt.unavailable) return ["retry", "edit"];
  return ["edit", ...(prompt.redactedText ? ["redacted"] : []), ...(prompt.allowOriginal ? ["original"] : [])];
}

/**
 * Isikuandmete kontrolli sõnad. Küsimus tuleb ette enne TASULIST tööd ja selle
 * põhinupp käivitab töö: nupp ütleb seepärast, mida ta teeb (koostab või
 * täiendab), mitte vestluse sõna „saada". „Muudan teksti" ja „Kontrolli
 * uuesti" on samad mis vestluses.
 */
export const PRIVACY_CHOICE_KEYS = Object.freeze({
  retry: "privacy_guard.retry",
  edit: "privacy_guard.edit",
  redacted: "privacy_guard.send_redacted",
  original: "privacy_guard.send_original"
});
export const PRIVACY_ACTIONS = Object.freeze(["compose", "refine"]);

/** Valiku sõna: tasulise töö käivitavad valikud kannavad töö nime. */
export function privacyChoiceKey(action, choice) {
  if (PRIVACY_ACTIONS.includes(action) && (choice === "redacted" || choice === "original")) return `documents.drafting.privacy.${action}_${choice}`;
  return PRIVACY_CHOICE_KEYS[choice] || "";
}

/** Küsimuse tekst ja kontrolli tõrke lause selle töö kohta, mille ette küsimus tuli. */
export function privacyTextKeys(action, unavailable = false) {
  const known = PRIVACY_ACTIONS.includes(action);
  return {
    title: unavailable ? "privacy_guard.unavailable_title" : "privacy_guard.title",
    text: known ? `documents.drafting.privacy.${action}_${unavailable ? "unavailable" : "body"}` : unavailable ? "privacy_guard.unavailable" : "privacy_guard.body"
  };
}

/** Kestus kujul 12:05 (minutid ja sekundid); tunnist pikem 1:02:05. */
export function formatDuration(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  const two = (value) => String(value).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours ? `${hours}:${two(minutes)}:${two(total % 60)}` : `${minutes}:${two(total % 60)}`;
}

/**
 * Kõnesalvestise eesmärk sõnadega. Inimese enda sõnastus läheb ette; muidu
 * kataloogi sõna samast võtmest, millest nõusolekutekst ehitati. Tundmatu
 * väärtus saab sõna „muu eesmärk”, mitte koodi.
 */
export function recordingPurposeLabel(callRecording, t) {
  const custom = String(callRecording?.purposeText || "").trim();
  if (custom) return custom;
  const purpose = String(callRecording?.purpose || "").trim().toLowerCase();
  if (!purpose) return "";
  return word(t, `calls.recording_purpose_${purpose}`) || t("calls.recording_purpose_other");
}

/** Lähtefaili rida: pealkiri, liik, faili nimi ja suurus ning tee allalaadimiseks. */
export function sourceRows(documents, { t, locale }) {
  return (Array.isArray(documents) ? documents : []).map((document) => {
    const purpose = document.templateFor ? word(t, `documents.template_for.${String(document.templateFor).toLowerCase()}`) : "";
    return {
      key: document.id,
      title: String(document.title || document.originalName || "").trim() || t("documents.workspace.untitled"),
      /* Liik ja malli otstarve võivad kanda sama sõna („Muu”): seda ei näidata kaks korda. */
      chips: [...new Set([kindLabel(document.kind, t), purpose].filter(Boolean))],
      meta: [document.originalName, formatFileSize(document.size), formatDate(document.updatedAt, locale)].filter(Boolean).join(" · "),
      download: `/api/documents/${encodeURIComponent(document.id)}/download`
    };
  });
}

/** Helifaili rida: pealkiri, päritolu, aeg ja kõnesalvestise faktid; kas transkript on olemas ja kas see on valitud. */
export function audioSourceRows(sources, { selectedId = "", t, locale }) {
  return (Array.isArray(sources) ? sources : []).map((source) => {
    const call = source.callRecording || null;
    const origin = source.kind === "CALL_AUDIO_RECORDING" ? "call" : source.recording ? "recorded" : "upload";
    const purpose = recordingPurposeLabel(call, t);
    return {
      key: source.id,
      title: String(source.title || source.originalName || "").trim() || t("documents.workspace.untitled"),
      origin: t(AUDIO_ORIGIN_KEYS[origin]),
      meta: [
        formatDate(source.createdAt, locale),
        call?.durationSeconds ? t("documents.drafting.audio.duration", { duration: formatDuration(call.durationSeconds) }) : "",
        purpose ? t("documents.drafting.audio.purpose", { purpose }) : "",
        call?.callStartedAt ? t("documents.drafting.audio.call_time", { date: formatDate(call.callStartedAt, locale) }) : ""
      ]
        .filter(Boolean)
        .join(" · "),
      hasTranscript: Boolean(source.transcript?.id),
      selected: source.id === selectedId
    };
  });
}

/** Tööruumi versioonid, uusim ees: nimi, liik, kas see on toimetis ja millal see tekkis. */
export function versionRows(versions, { title = "", content = "", t, locale }) {
  return (Array.isArray(versions) ? versions : [])
    .slice()
    .reverse()
    .map((version) => ({
      key: version.id,
      title: String(version.title || "").trim() || typeLabel(version.type, t),
      kind: VERSION_KINDS[version.kind] ? t(VERSION_KINDS[version.kind]) : "",
      current: isVersionActive(version, title, content),
      meta: [typeLabel(version.type, t), formatDate(version.createdAt, locale)].filter(Boolean).join(" · ")
    }));
}

/**
 * Tulemuse leht: märgid (spetsialistil tüüp ja olek, pöördujal olek tema
 * sõnadega), ajad ja allikad. Kinnitamise aega näeb ainult spetsialist.
 */
export function resultSheet(result, { client = false, t, locale }) {
  if (!result) return { chips: [], facts: [], sources: [] };
  const final = String(result.status || "") !== "DRAFT";
  const tone = final ? "ok" : "wait";
  return {
    chips: client
      ? [{ key: "status", text: clientStatusLabel(result.status, t), tone }]
      : [
          { key: "type", text: typeLabel(result.type, t), tone: "quiet" },
          { key: "status", text: statusLabel(result.status, t), tone }
        ],
    facts: [
      { key: "created", label: t("documents.drafting.text.created"), value: formatDate(result.createdAt, locale) },
      { key: "updated", label: t("documents.updated_at"), value: formatDate(result.updatedAt, locale) },
      { key: "approved", label: t("documents.approved_at"), value: !client && result.approvedAt ? formatDate(result.approvedAt, locale) : "" }
    ].filter((fact) => fact.value),
    sources: (Array.isArray(result.sources) ? result.sources : [])
      .filter((source) => source?.id)
      .map((source) => ({
        key: source.id,
        title: String(source.title || source.originalName || "").trim() || t("documents.workspace.untitled"),
        href: `/api/documents/${encodeURIComponent(source.id)}/download`
      }))
  };
}

/** Pöörduja viimaste tulemuste rida: pealkiri, olek, aeg ja kas see on praegu avatud. */
export function recentResultRows(artifacts, { currentId = "", t, locale }) {
  return (Array.isArray(artifacts) ? artifacts : []).map((artifact) => ({
    key: artifact.id,
    title: String(artifact.title || artifact.snippet || "").trim() || t("documents.workspace.untitled"),
    status: clientStatusLabel(artifact.status, t),
    tone: String(artifact.status || "") === "FINAL" ? "ok" : "wait",
    date: formatDate(artifact.updatedAt || artifact.createdAt, locale),
    current: Boolean(currentId) && artifact.id === currentId
  }));
}

/**
 * Vaadete seisud sammude jaoks (`empty`, `partial`, `done`): tehtud samm on
 * kiirmenüüs heledam. Sisend on paar arvu ja lippu, mitte lehe olek.
 */
export function viewStates({
  documentCount = 0,
  missingCount = 0,
  templateChosen = false,
  instruction = "",
  resultState = "none",
  unsaved = false,
  refineText = "",
  versionCount = 0,
  recentCount = 0,
  audioChosen = false,
  hasTranscript = false,
  transcriptUnsaved = false,
  summaryReady = false
} = {}) {
  const files = documentCount ? (missingCount ? "partial" : "done") : "empty";
  const hasResult = resultState === "draft" || resultState === "final";
  const approved = resultState === "final" ? "done" : "empty";
  return {
    sources: files,
    files,
    type: "done",
    task: "done",
    template: templateChosen ? "done" : "empty",
    style: "done",
    instruction: hasResult ? "done" : String(instruction || "").trim() ? "partial" : "empty",
    text: hasResult ? (unsaved ? "partial" : "done") : "empty",
    refine: String(refineText || "").trim() ? "partial" : "empty",
    versions: versionCount > 1 ? "done" : "empty",
    approve: approved,
    finish: approved,
    results: recentCount ? "done" : "empty",
    audio: audioChosen ? "done" : "empty",
    transcribe: hasTranscript ? "done" : "empty",
    review: hasTranscript ? (transcriptUnsaved ? "partial" : "done") : "empty",
    summary: summaryReady ? "done" : "empty"
  };
}

/** Teksti algus ühe reana (vaate „Kõik sammud” plaadile). */
export function snippet(text, max = 90) {
  const line = String(text || "").replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
