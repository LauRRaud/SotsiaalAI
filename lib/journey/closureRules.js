/**
 * TEEKOND K1-f — paus ja lõpetamine: reeglid ilma andmebaasita.
 *
 * Seni oli Teekonnal üks nupp „Arhiveeri", mis ei öelnud, kas inimene paneb asja
 * korraks kõrvale või on see läbi. Need on kaks eri asja:
 *
 *   PAUS       „praegu ma sellega ei tegele": võib lisada, miks, ja päeva, millal
 *              plaanib jätkata. Päev on inimesele endale; platvorm seda meelde ei tuleta.
 *   LÕPETAMINE „see Teekond on minu jaoks läbi": inimene ütleb ise, kuidas see lõppes.
 *              Hea tulemus võib olla ka püsivalt toimiv abi, mitte ainult täielik
 *              iseseisvus; ja „ei lahenenud" on sama aus vastus kui „lahenes".
 *
 * Mõlemal juhul on Teekond kirjutuskaitstud (seis ARCHIVED nagu seni) ja inimene
 * saab selle alati uuesti avada. Midagi ei kustu: iga paus ja lõpetamine jääb reana
 * alles koos uuesti avamise ajaga.
 */
import { JOURNEY_ASSESSMENT_LEVELS } from "./assessmentRules.js";
import { normalizeStepDay } from "./stepRules.js";

export const JourneyClosureKind = Object.freeze({ PAUSED: "PAUSED", FINISHED: "FINISHED" });

export const JOURNEY_CLOSURE_KINDS = Object.freeze(Object.values(JourneyClosureKind));

/** Kuidas Teekond inimese enda sõnul lõppes. Järjekord on see, milles valikud lehel on. */
export const JOURNEY_CLOSURE_OUTCOMES = Object.freeze([
  /** Mure on lahenenud. */
  "RESOLVED",
  /** Abi toimib ja jätkub (püsiv abi on samuti hea tulemus). */
  "HELP_CONTINUES",
  /** Leidsin teise lahenduse. */
  "OWN_WAY",
  /** Olukord muutus ja seda ei ole enam vaja. */
  "CHANGED",
  /** Ei lahenenud, aga lõpetan siin. */
  "UNRESOLVED"
]);

export const JOURNEY_CLOSURE_LIMITS = Object.freeze({
  note: 1000,
  /** Ühel Teekonnal. Paus on harv sündmus; piir hoiab tabeli lõputult kasvamast. */
  perJourney: 100
});

function closureError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

function cleanNote(value) {
  return typeof value === "string"
    ? value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : "";
}

/**
 * Pausi või lõpetamise sisend.
 *
 * @param {object} input `{ kind, outcome?, note?, resumeOn?, level? }`
 * @param {{ today: string }} options tänane päev Eestis (AAAA-KK-PP)
 * @returns {{ kind: string, outcome: string|null, note: string|null, resumeOn: string|null, level: number|null }}
 */
export function normalizeClosureInput(input = {}, { today } = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const kind = typeof source.kind === "string" ? source.kind.trim().toUpperCase() : "";
  if (!JOURNEY_CLOSURE_KINDS.includes(kind)) throw closureError("journeys.errors.closure_kind_required");

  const note = cleanNote(source.note);
  if (note.length > JOURNEY_CLOSURE_LIMITS.note) {
    throw closureError("journeys.errors.field_too_long", 400, { code: "JOURNEY_FIELD_TOO_LONG", field: "note", limit: JOURNEY_CLOSURE_LIMITS.note });
  }

  if (kind === JourneyClosureKind.PAUSED) {
    /* Jätkamise päev on plaan, seega täna või hiljem. Tulemust ja hinnangut pausil ei ole. */
    const resumeOn = normalizeStepDay(source.resumeOn);
    if (resumeOn && today && resumeOn < today) throw closureError("journeys.errors.closure_resume_in_past");
    return { kind, outcome: null, note: note || null, resumeOn, level: null };
  }

  const outcome = typeof source.outcome === "string" ? source.outcome.trim().toUpperCase() : "";
  if (!JOURNEY_CLOSURE_OUTCOMES.includes(outcome)) throw closureError("journeys.errors.closure_outcome_required");
  /* Lõpphinnang on valikuline; kui see on antud, peab see olema päris aste. */
  const hasLevel = source.level !== null && source.level !== undefined && source.level !== "";
  const level = hasLevel ? Number(source.level) : null;
  if (hasLevel && !JOURNEY_ASSESSMENT_LEVELS.includes(level)) throw closureError("journeys.errors.assessment_level_required");
  return { kind, outcome, note: note || null, resumeOn: null, level };
}

function time(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function view(row, today) {
  return {
    id: row.id,
    kind: row.kind,
    outcome: row.outcome || null,
    note: row.note || null,
    resumeOn: row.resumeOn || null,
    closedAt: row.closedAt,
    reopenedAt: row.reopenedAt || null,
    /* Päev, mil inimene plaanis jätkata, on käes või möödas. */
    resumeDue: Boolean(row.kind === JourneyClosureKind.PAUSED && !row.reopenedAt && row.resumeOn && today && row.resumeOn <= today)
  };
}

/**
 * Pilt lehe jaoks: praegune paus või lõpetamine (kui Teekond on kõrvale pandud) ja
 * varasemad, viimane ees.
 *
 * `archived` on Teekonna enda seis. Avatud Teekonnal praegust rida ei ole; lihtsalt
 * arhiveeritud Teekonnal (vana nupp, rida puudub) on `current` samuti null.
 */
export function summarizeClosures(rows, { archived = false, today = "" } = {}) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort(
    (a, b) => time(b.closedAt) - time(a.closedAt) || String(b.id).localeCompare(String(a.id))
  );
  const open = archived ? ordered.find((row) => !row.reopenedAt) || null : null;
  return {
    current: open ? view(open, today) : null,
    history: ordered.filter((row) => row !== open).map((row) => view(row, today))
  };
}
