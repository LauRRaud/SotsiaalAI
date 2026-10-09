/**
 * TEEKOND K1-b — järgmise sammu reeglid ilma andmebaasita.
 *
 * Samm on inimese enda kokkulepe iseendaga või kellegagi: mida tehakse, kes teeb,
 * mis ajaks ja kas see on tehtud. Varem olid Teekonnas ainult platvormi pakutud
 * tekstiread („Võimalikud järgmised sammud"), mida ei saanud ei võtta, tähtajastada
 * ega tehtuks märkida.
 *
 * „Kes teeb" on K1-s vaba tekst inimese sõnadega („mina", „tütar Mari",
 * „sotsiaaltöötaja"): Teekond on privaatne ja teist osalist veel ei ole. Päris
 * osaline koos vastuvõtmise ja üleandmisega tuleb ühise plaani kihis (K2).
 */
import { ESTONIA_TIME_ZONE, zonedParts } from "../time/estonianDay.js";

export const JourneyStepState = Object.freeze({
  TODO: "TODO",
  DONE: "DONE",
  /** Jäeti ära: samm ei ole enam vajalik. Jääb alles, et oleks näha, mis otsustati. */
  DROPPED: "DROPPED"
});
export const JOURNEY_STEP_STATES = Object.freeze(Object.values(JourneyStepState));

export const JOURNEY_STEP_LIMITS = Object.freeze({
  title: 200,
  doer: 80,
  note: 1000,
  /** Ühel Teekonnal korraga. Piir on selleks, et loend jääks inimesele haaratav. */
  perJourney: 40
});

function stepError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function cleanLine(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanText(value) {
  return typeof value === "string"
    ? value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : "";
}

function limited(text, field) {
  const limit = JOURNEY_STEP_LIMITS[field];
  if (text.length > limit) {
    throw stepError("journeys.errors.field_too_long", 400, { code: "JOURNEY_FIELD_TOO_LONG", field, limit });
  }
  return text;
}

/** Kalendripäev kujul AAAA-KK-PP. Tühi on lubatud (tähtaega ei ole); olematu kuupäev on viga. */
export function normalizeStepDay(value) {
  if (value === null || value === undefined || value === "") return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(typeof value === "string" ? value.trim() : "");
  if (!match) throw stepError("journeys.errors.step_date_invalid");
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  const real = date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  if (!real || year < 2000 || year > 2100) throw stepError("journeys.errors.step_date_invalid");
  return match[0];
}

/**
 * Sammu sisend. `partial`: muutmisel puudutatakse ainult saadetud välju; tühi
 * tekst tähendab välja tühjendamist (pealkirja ei saa tühjendada).
 */
export function normalizeStepInput(input = {}, { partial = false } = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const data = {};

  if (!partial || Object.hasOwn(source, "title")) {
    const title = limited(cleanLine(source.title), "title");
    if (!title) throw stepError("journeys.errors.step_title_required");
    data.title = title;
  }
  if (Object.hasOwn(source, "doer")) data.doer = limited(cleanLine(source.doer), "doer") || null;
  if (Object.hasOwn(source, "dueOn")) data.dueOn = normalizeStepDay(source.dueOn);
  if (Object.hasOwn(source, "note")) data.note = limited(cleanText(source.note), "note") || null;
  if (Object.hasOwn(source, "state")) {
    const state = typeof source.state === "string" ? source.state.trim().toUpperCase() : "";
    if (!JOURNEY_STEP_STATES.includes(state)) throw stepError("journeys.errors.step_state_invalid");
    data.state = state;
  }
  return data;
}

/** Tänane kalendripäev Eestis. Tähtaeg on päev, mitte kellaaeg. */
export function todayInEstonia(now = new Date()) {
  const parts = zonedParts(now, ESTONIA_TIME_ZONE);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Tähtaeg on möödas alles järgmisel päeval: tähtpäeval endal on samm veel õigel ajal. */
export function isStepOverdue(step, today) {
  return step?.state === JourneyStepState.TODO && typeof step?.dueOn === "string" && Boolean(today) && step.dueOn < today;
}

function time(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Järjekord lehel: kõigepealt tegemata sammud (varasema tähtajaga ees, tähtajata
 * lõpus, võrdsetel varem lisatu ees), siis lõpetatud (viimati lõpetatu ees).
 */
export function sortSteps(steps) {
  const open = [];
  const closed = [];
  for (const step of Array.isArray(steps) ? steps : []) {
    (step?.state === JourneyStepState.TODO ? open : closed).push(step);
  }
  open.sort((a, b) => {
    if (a.dueOn && b.dueOn && a.dueOn !== b.dueOn) return a.dueOn < b.dueOn ? -1 : 1;
    if (Boolean(a.dueOn) !== Boolean(b.dueOn)) return a.dueOn ? -1 : 1;
    return time(a.createdAt) - time(b.createdAt) || String(a.id).localeCompare(String(b.id));
  });
  closed.sort((a, b) => time(b.doneAt || b.updatedAt) - time(a.doneAt || a.updatedAt) || String(a.id).localeCompare(String(b.id)));
  return [...open, ...closed];
}

/** Esimene tegemata samm ehk see, mis on inimesel praegu ees. */
export function nextOpenStep(steps) {
  return sortSteps(steps).find((step) => step.state === JourneyStepState.TODO) || null;
}
