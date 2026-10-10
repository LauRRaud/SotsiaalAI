/**
 * Avatud Teekonna laua reeglid ilma joonistamiseta: laua osad ja nende seis,
 * plaatide kokkuvõtted, jagamise valikud, muutmise vormi seis ja muudetud
 * teksti tuvastus.
 *
 * MIKS OMAETTE FAIL. Avatud Teekond oli üks pikk veerg, kus iga funktsioon seisis
 * eelmise all. Nüüd on see laud: iga osa on üks asi ja plaat ütleb selle seisu.
 * Mis osa on olemas, mida plaat ütleb ja millal lahkumine tuleb kinni pidada, on
 * siin puhaste funktsioonidena, et neid saaks testida käitumise järgi
 * (`tests/journey-desk-views.test.mjs`). Leht (`../JourneyDetail.jsx`) hoiab
 * olekut ja teeb päringud; osade vaated ainult joonistavad.
 */
import { linkedPreInquiryState } from "../../../lib/journey/linkedPreInquiryState.js";
import { journeyRoadmap } from "../../../lib/journey/roadmap.js";

/** Laua osad lehe järjekorras: kõigepealt inimese enda asjad, siis teed abini, lõpus hoidmine. */
export const DESK_PARTS = Object.freeze([
  "situation",
  "wish",
  "steps",
  "feeling",
  "sent",
  "share",
  "help",
  "continuity",
  "road",
  "closure",
  "data"
]);

/** Aadressi `?alusta=` väärtus → laua osa (ja osa sees avatav vaade). */
export const START_TARGETS = Object.freeze({
  SERVICE_MAP: Object.freeze({ part: "help", view: "map" }),
  PRE_INQUIRY: Object.freeze({ part: "share", view: "choose" })
});

export function startTarget(value) {
  return Object.hasOwn(START_TARGETS, value) ? START_TARGETS[value] : null;
}

/* Teine vajutus samal nupul ei tule topeltklõpsust; kinnituse ootus aegub. */
export const PRESS_GAP_MS = 400;
export const CONFIRM_MS = 8000;

export function pressTooSoon(since, now = Date.now()) {
  return Boolean(since) && now - since < PRESS_GAP_MS;
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function contextOf(journey) {
  const context = journey?.context;
  return context && typeof context === "object" && !Array.isArray(context) ? context : {};
}

/** Esimene rida või lause tekstist: plaadi kokkuvõtte jaoks. */
export function firstLine(value, limit = 120) {
  const line = text(value).split(/\r?\n/).map((part) => part.trim()).find(Boolean) || "";
  return line.length > limit ? `${line.slice(0, limit - 1).trimEnd()}…` : line;
}

/** Kalendripäev `2026-10-15` → `15.10.2026`. */
export function plainDayLabel(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day || ""));
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/** ISO hetk → `15.10.2026` inimese enda ajavööndis. Vigane väärtus annab tühja sõne. */
export function dayOf(iso) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const two = (value) => String(value).padStart(2, "0");
  return `${two(date.getDate())}.${two(date.getMonth() + 1)}.${date.getFullYear()}`;
}

/**
 * Muud seotud asjad (dokumendid, kontaktid, ruumid): Teekond neid veel ise ei
 * loo ja kontekstis on ainult viited. Näidatakse, mitu neid on, mitte viiteid
 * endid (toores tunnus ei ütle inimesele midagi).
 */
export const RELATED_GROUPS = Object.freeze([
  ["linkedDocumentIds", "journey.related.documents"],
  ["linkedServiceMapEntryIds", "journey.related.service_contacts"],
  ["linkedHelpRequestIds", "journey.related.help_requests"],
  ["linkedHelpOfferIds", "journey.related.help_offers"],
  ["linkedRoomIds", "journey.related.rooms"]
]);

export function relatedCounts(journey) {
  const context = contextOf(journey);
  return RELATED_GROUPS.map(([key, labelKey]) => ({ key, labelKey, count: Array.isArray(context[key]) ? context[key].filter(Boolean).length : 0 })).filter((group) => group.count > 0);
}

/** Eluvaldkonnad Teekonna kontekstist; kui neid ei ole, kaks vaikimisi (nagu vanal lehel). */
export function journeyLifeDomains(journey) {
  const domains = listItems(contextOf(journey).lifeDomains);
  return domains.length ? domains : ["igapäevaelu toimingud", "võrgustik ja kõrvalabi"];
}

/** Sõnade loend kirjest, mis võib olla sõne või `{ title }`. */
export function listItems(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item : item?.title || item?.name || item?.label || ""))
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export function journeyWish(journey) {
  return text(contextOf(journey).personWish);
}

export function isArchived(journey) {
  return journey?.status === "ARCHIVED";
}

/**
 * Teekonna seis ühe sõna võtmena. Kõrvale pandud Teekond ütleb, kas see on paus
 * või lõpetamine; tundmatu liik jääb arhiveerituks, toorest väärtust ei näidata.
 */
export function journeyStateKey(journey) {
  const status = String(journey?.status || "ACTIVE").toUpperCase();
  const kind = String(journey?.closure?.current?.kind || "").toUpperCase();
  if (status === "ARCHIVED") {
    if (kind === "PAUSED" || kind === "FINISHED") return `journey.closure.status.${kind}`;
    return "journey.status.ARCHIVED";
  }
  return status === "DRAFT" ? "journey.status.DRAFT" : "journey.status.ACTIVE";
}

/* ---------- Sammud --------------------------------------------------------------- */

export function stepGroups(journey) {
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  return {
    open: steps.filter((step) => step.state === "TODO"),
    closed: steps.filter((step) => step.state !== "TODO")
  };
}

/**
 * Platvormi pakutud read, mida ei ole veel sammuks võetud. Rida, mis on sammu
 * pealkirjaks liiga pikk, jääb loetavaks, aga sammuks seda võtta ei saa
 * (`takeable: false`): muidu ei oleks see enam kusagil näha.
 */
export function stepSuggestions(journey, titleLimit = 200) {
  const steps = Array.isArray(journey?.steps) ? journey.steps : [];
  const taken = new Set(steps.map((step) => text(step.title).trim().toLocaleLowerCase("et")));
  const seen = new Set();
  return listItems(journey?.suggestedActions)
    .filter((title) => {
      const key = title.toLocaleLowerCase("et");
      if (taken.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((title) => ({ title, takeable: title.length <= titleLimit }));
}

/** Sammu rida pealkirja all: kes teeb, mis ajaks ja kas tähtaeg on möödas. */
export function stepMeta(step, { t, today }) {
  return [
    step.doer ? t("journey.own_steps.doer_value", { name: step.doer }) : "",
    step.dueOn ? t("journey.own_steps.due_value", { date: plainDayLabel(step.dueOn) }) : "",
    step.state === "TODO" && step.dueOn && today && step.dueOn < today ? t("journey.own_steps.overdue") : ""
  ].filter(Boolean).join(" · ");
}

/* ---------- Saadetud ja vastused --------------------------------------------------- */

export function linkedState(item) {
  return item?.state || linkedPreInquiryState(item);
}

/**
 * Plaadi lause saadetud pöördumiste kohta, faktidest (kõik seotud pöördumised,
 * mitte ainult esimene lehekülg). Vastus on tugevaim: see on asi, mida inimene
 * ootab.
 */
export function sentSummaryKey(journey) {
  const facts = journey?.preInquiryFacts || {};
  if (Number(facts.answered) > 0) return "journey.desk.sent.answered";
  if (Number(facts.opened) > 0) return "journey.desk.sent.opened";
  if (Number(facts.sent) > 0) return "journey.desk.sent.sent";
  if (Number(facts.total) > 0) return "journey.desk.sent.draft";
  return "journey.desk.sent.none";
}

/* ---------- Jagamine eelpöördumisena ja abisoovina ---------------------------------- */

/**
 * Mida saab eelpöördumisse kaasa võtta: ainult see, mis Teekonnas olemas on.
 * Vaikimisi on valitud kokkuvõte, teemad ja puuduolev info (nagu vanal lehel).
 */
export function preInquiryShareOptions(journey, { hasAssistiveDeviceNeed = false } = {}) {
  const context = contextOf(journey);
  return [
    ["summary", "journey.share.summary", Boolean(journey?.summary)],
    ["domains", "journey.share.domains", Boolean(journey?.domains?.length)],
    ["missingInfo", "journey.share.missing_info", Boolean(journey?.missingInfo?.length)],
    ...(hasAssistiveDeviceNeed ? [["assistiveDevices", "journey.share.assistive_devices", true]] : []),
    ["wish", "journey.share.wish", Boolean(context.personWish)],
    ["personContext", "journey.share.person_context", Boolean(context.personContext)],
    ["serviceContinuity", "journey.share.service_continuity", Boolean(context.serviceContinuity)],
    ["municipality", "journey.share.municipality", Boolean(context.municipality || context.municipalityName)],
    ["document", "journey.share.document", Boolean(context.contextNote)],
    ["title", "journey.share.title_field", Boolean(journey?.title)]
  ].filter(([, , present]) => present).map(([value, labelKey]) => ({ value, labelKey }));
}

export const PRE_INQUIRY_DEFAULT_SHARE = Object.freeze(["summary", "domains", "missingInfo"]);

/** Abisoovi kaasa võetav: `handoff` on `buildHelpMediationHandoff(journey)` tulemus. */
export function helpRequestShareOptions(journey, handoff) {
  const context = contextOf(journey);
  const mediation = context.helpMediation && typeof context.helpMediation === "object" && !Array.isArray(context.helpMediation) ? context.helpMediation : {};
  return [
    ["summary", "journey.helpMediation.share.summary", Boolean(journey?.summary)],
    ["category", "journey.helpMediation.share.category", Boolean(handoff?.categoryCode)],
    ["region", "journey.helpMediation.share.region", Boolean(handoff?.municipalityName || handoff?.municipalityId)],
    ["timing", "journey.helpMediation.share.timing", Boolean(mediation.timing || context.timing)],
    ["conditions", "journey.helpMediation.share.conditions", Boolean(mediation.conditions || context.conditions)],
    ["ownWords", "journey.helpMediation.share.ownWords", Boolean(context.personWish || context.ownWords)]
  ].filter(([, , present]) => present).map(([value, labelKey]) => ({ value, labelKey }));
}

export const HELP_REQUEST_DEFAULT_SHARE = Object.freeze(["summary", "category", "region", "ownWords"]);

/** Edasi viiv aadress valitud osadega: `shareReview=1` ja `share=a,b`. */
export function reviewedShareHref(href, selected) {
  const keys = (Array.isArray(selected) ? selected : []).filter(Boolean);
  const [path, query = ""] = String(href || "").split("?");
  const params = new URLSearchParams(query);
  params.set("shareReview", "1");
  if (keys.length) params.set("share", keys.join(","));
  else params.delete("share");
  const serialized = params.toString();
  return serialized ? `${path}?${serialized}` : path;
}

/** Valiku lüliti: märgitu maha, märkimata juurde; järjekord on vajutamise oma (nagu vanal lehel). */
export function toggleKey(list, key) {
  const current = Array.isArray(list) ? list : [];
  return current.includes(key) ? current.filter((item) => item !== key) : [...current, key];
}

/**
 * Kas eelpöördumisega tohib edasi minna: midagi on valitud ja teise inimese
 * teabe jagamisel on õigus kinnitatud.
 */
export function shareBlockKey(selected, acknowledged) {
  const keys = Array.isArray(selected) ? selected : [];
  if (!keys.length) return "journey.desk.share.need_choice";
  if (keys.includes("personContext") && !acknowledged) return "journey.desk.share.need_ack";
  return "";
}

/* ---------- Olukorra muutmise vorm ---------------------------------------------------- */

export function linesToText(value) {
  return listItems(value).join("\n");
}

export function textToLines(value) {
  return String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function situationForm(journey) {
  return {
    title: text(journey?.title),
    summary: text(journey?.summary),
    primaryPath: journey?.primaryPath || "UNKNOWN",
    domains: linesToText(journey?.domains),
    missingInfo: linesToText(journey?.missingInfo),
    riskSignals: linesToText(journey?.riskSignals),
    suggestedActions: linesToText(journey?.suggestedActions)
  };
}

/**
 * Teekond muutus ajal, mil vorm oli lahti (teine osa salvestas: jätkumise
 * kontroll lisab puuduoleva info ridu ja pakutud samme). Väli, mida inimene ei
 * ole puutunud, võtab uue väärtuse; puututud väli jääb, nagu ta selle kirjutas.
 * Muidu kirjutaks vana koopia teise osa salvestuse üle.
 */
export function rebaseForm(form, openedFrom, fresh) {
  if (!form || !openedFrom || !fresh) return form;
  const next = { ...form };
  for (const key of Object.keys(fresh)) {
    if (String(form[key] ?? "") === String(openedFrom[key] ?? "")) next[key] = fresh[key];
  }
  return next;
}

/** Kas vorm erineb Teekonnast endast (mitte avamisel võetud koopiast). */
export function formDirty(form, base) {
  if (!form || !base) return false;
  return Object.keys(base).some((key) => String(form[key] ?? "") !== String(base[key] ?? ""));
}

export function situationProblemKey(form) {
  if (!text(form?.title).trim()) return "journey.desk.situation.need_title";
  if (!text(form?.summary).trim()) return "journey.desk.situation.need_summary";
  return "";
}

/* ---------- Teenuse jätkumine ---------------------------------------------------------- */

const yesNo = (value) => (value === true ? "YES" : value === false ? "NO" : "");

export function continuityOf(journey) {
  const value = contextOf(journey).serviceContinuity;
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function hasContinuity(journey) {
  const continuity = continuityOf(journey);
  return Object.keys(continuity).some((key) => continuity[key] !== "" && continuity[key] !== null && continuity[key] !== undefined);
}

export function continuityForm(journey) {
  const continuity = continuityOf(journey);
  return {
    serviceName: text(continuity.serviceName),
    currentProvider: text(continuity.currentProvider),
    municipality: text(continuity.municipality),
    hasExistingService: yesNo(continuity.hasExistingService),
    knownEndDate: yesNo(continuity.knownEndDate),
    endDate: text(continuity.endDate),
    hasDecisionOrPlan: yesNo(continuity.hasDecisionOrPlan),
    documentAttached: yesNo(continuity.documentAttached),
    kovAlreadyInvolved: yesNo(continuity.kovAlreadyInvolved),
    providerAlreadyInvolved: yesNo(continuity.providerAlreadyInvolved),
    userGoal: text(continuity.userGoal)
  };
}

/* ---------- Laua plaadid ---------------------------------------------------------------- */

/** Teekonnaraja rea seisu sõna võti. */
export const ROAD_STATE_KEYS = Object.freeze({
  done: "journey.roadmap.done",
  current: "journey.roadmap.current",
  next: "journey.roadmap.next_recommended",
  todo: "journey.roadmap.todo"
});

/**
 * Teekonnaraja rida, mis on praegu ees: esimene pooleli või soovitatud rida;
 * kui kõik on tehtud, viimane tehtud rida.
 */
export function roadFocus(journey) {
  const rows = journeyRoadmap(journey);
  return rows.find((row) => row.state === "current") || rows.find((row) => row.state === "next") || [...rows].reverse().find((row) => row.state === "done") || rows[0];
}

/**
 * Laua osad plaatidena: nimi, lühinimi kiirmenüüle, seis ja üks-kaks rida.
 * `state` on olemasolu märk (`done`: osas on midagi; `empty`: ei ole), mitte
 * hinne. `attention` märgib plaadi, kus inimest ootab midagi uut (saaja vastus,
 * käes olev jätkamise päev, möödunud tähtaeg).
 *
 * `extra`: { today, helpKinds: string[], levelWord(level) }
 */
export function deskTiles(journey, { t, today = "", helpKinds = [], levelWord = (level) => String(level) } = {}) {
  const { open, closed } = stepGroups(journey);
  const wish = journeyWish(journey);
  const picture = journey?.assessments || {};
  const facts = journey?.preInquiryFacts || {};
  const closure = journey?.closure?.current || null;
  const archived = isArchived(journey);
  const continuity = continuityOf(journey);
  const focus = roadFocus(journey);
  const overdue = open.find((step) => step.dueOn && today && step.dueOn < today);
  const nextStep = overdue || open[0] || null;

  const summaries = {
    situation: { state: "done", summary: firstLine(journey?.summary) },
    wish: { state: wish.trim() ? "done" : "empty", summary: wish.trim() ? firstLine(wish) : t("journey.wish.empty") },
    steps: {
      state: open.length ? "done" : "empty",
      attention: Boolean(overdue),
      summary: nextStep
        ? [nextStep.title, stepMeta(nextStep, { t, today })].filter(Boolean).join(" · ")
        : closed.length
          ? t("journey.desk.steps.all_closed")
          : t("journey.own_steps.empty")
    },
    feeling: {
      state: picture.baseline ? "done" : "empty",
      summary: picture.latest
        ? t(`journey.assessment.change.${picture.change}`) === `journey.assessment.change.${picture.change}`
          ? levelWord(picture.latest.level)
          : `${levelWord(picture.latest.level)}, ${t(`journey.assessment.change.${picture.change}`)}`
        : picture.baseline
          ? t("journey.assessment.baseline_line", { date: dayOf(picture.baseline.createdAt), level: levelWord(picture.baseline.level) })
          : t("journey.assessment.empty")
    },
    sent: {
      state: Number(facts.total) > 0 ? "done" : "empty",
      attention: Number(facts.answered) > 0,
      summary: t(sentSummaryKey(journey))
    },
    /* Jagada saab ka kõrvale pandud Teekonnast: plaat ei väida vastupidist. */
    share: { state: "empty", summary: t("journey.desk.share.tile") },
    help: {
      state: helpKinds.length > 1 ? "done" : "empty",
      summary: helpKinds.map((kind) => t(`journey.desk.help.kinds.${kind}`)).join(", ")
    },
    continuity: {
      state: hasContinuity(journey) ? "done" : "empty",
      summary: text(continuity.serviceName).trim() || t("journey.desk.continuity.tile")
    },
    road: { state: "done", summary: `${t(`journey.roadmap.${focus.key}`)}: ${t(ROAD_STATE_KEYS[focus.state] || ROAD_STATE_KEYS.todo)}` },
    closure: {
      state: archived ? "done" : "empty",
      attention: Boolean(archived && closure?.resumeDue),
      summary: !archived
        ? t("journey.desk.closure.tile")
        : closure?.kind === "PAUSED"
          ? [t("journey.closure.paused_line", { date: dayOf(closure.closedAt) }), closure.resumeOn ? t("journey.closure.resume_line", { date: plainDayLabel(closure.resumeOn) }) : ""].filter(Boolean).join(" ")
          : closure?.kind === "FINISHED"
            ? t("journey.closure.finished_line", { date: dayOf(closure.closedAt), outcome: t(`journey.closure.outcomes.${closure.outcome}`) })
            : t("journey.closure.archived_line")
    },
    data: { state: "empty", summary: t("journey.desk.data.tile") }
  };

  return DESK_PARTS.map((key) => ({
    key,
    label: t(`journey.desk.parts.${key}.title`),
    short: t(`journey.desk.parts.${key}.short`),
    state: summaries[key].state,
    attention: Boolean(summaries[key].attention),
    summaryText: summaries[key].summary || "",
    /* Osa sees võib olla pikk tekst või loend: ühist kõrgust selle järgi ei võeta. */
    free: true
  }));
}

/**
 * Milliseid abi otsimise teid see Teekond pakub. Teenusekaart on alati;
 * abivahendus, abivahendid ja tervisekontakt ainult siis, kui kirjeldus neile
 * viitab (otsuse teevad `lib/journey` abilised, siin on ainult järjekord).
 */
export function helpKinds({ hasPracticalNeed = false, hasAssistiveDeviceNeed = false, hasHealthSignal = false } = {}) {
  return ["map", ...(hasPracticalNeed ? ["mediation"] : []), ...(hasAssistiveDeviceNeed ? ["devices"] : []), ...(hasHealthSignal ? ["health"] : [])];
}

/** Abivahendi seisu sõna võti; tundmatu seis jääb märgita (toorest väärtust ei näidata). */
export const DEVICE_STATUSES = Object.freeze(["NEEDED", "EXISTING", "NOT_USED", "NOT_WORKING", "UNSURE"]);

export function deviceStatusKey(status) {
  const value = String(status || "").toUpperCase();
  return DEVICE_STATUSES.includes(value) ? `journey.desk.help.device_status.${value}` : "";
}

/** Abi liigi sõna võti: sama kataloog, mida kasutavad abikuulutused. */
export function helpCategoryKey(code) {
  return `chat.help.categories.${String(code || "OTHER").toUpperCase()}`;
}

/** Abipakkumiste otsingu aadress: üks vaste piisab, et öelda „leidsime". */
export function helpOfferMatchHref(handoff) {
  if (!handoff?.hasPracticalNeed) return "";
  const params = new URLSearchParams();
  params.set("type", "HELP_OFFER");
  params.set("limit", "1");
  const keyword = handoff.taxonomy?.needTags?.[0] || handoff.categoryCode || "";
  if (keyword) params.set("q", keyword);
  if (handoff.municipalityName) params.set("municipalityName", handoff.municipalityName);
  return `/api/service-map/entries?${params.toString()}`;
}

/** Loendur ilmub alles siis, kui väli hakkab täis saama (viimane viiendik). */
export function counterNear(value, limit) {
  const length = text(value).length;
  return limit && length >= limit * 0.8 ? { current: length, limit } : null;
}
