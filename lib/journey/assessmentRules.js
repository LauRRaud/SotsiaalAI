/**
 * TEEKOND K1-d — inimese enda hinnang muutusele: reeglid ilma andmebaasita.
 *
 * Inimene märgib, kuidas ta oma olukorraga toime tuleb: esimene märge on
 * algseis, iga järgmine näitab, kas on läinud paremaks, samaks või raskemaks.
 * See on INIMESE hinnang. Spetsialisti hinnang on teine asi, ei kirjuta seda üle
 * ja neid kahte ei keskmistata: kui need erinevad, on see põhjus rääkida.
 *
 * Skaala on sõnades, mitte numbrites. Arv (1–5) on ainult järjestus, et kaht
 * märget saaks võrrelda; inimesele seda arvuna ei näidata.
 */
export const JOURNEY_ASSESSMENT_LEVELS = Object.freeze([1, 2, 3, 4, 5]);

export const JOURNEY_ASSESSMENT_LIMITS = Object.freeze({
  note: 1000,
  /** Ühel Teekonnal. Hinnang on harv märge, mitte päevik. */
  perJourney: 60
});

export const AssessmentChange = Object.freeze({
  /** Esimene märge: võrrelda ei ole veel millegagi. */
  BASELINE: "BASELINE",
  BETTER: "BETTER",
  SAME: "SAME",
  HARDER: "HARDER"
});

function assessmentError(message, status = 400, extra = {}) {
  const error = new Error(message);
  error.status = status;
  Object.assign(error, extra);
  return error;
}

/** Hinnangu sisend: aste on kohustuslik täisarv 1–5, märkus valikuline. */
export function normalizeAssessmentInput(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const level = typeof source.level === "number" || (typeof source.level === "string" && source.level.trim() !== "") ? Number(source.level) : NaN;
  if (!JOURNEY_ASSESSMENT_LEVELS.includes(level)) throw assessmentError("journeys.errors.assessment_level_required");
  const note = typeof source.note === "string"
    ? source.note.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim()
    : "";
  if (note.length > JOURNEY_ASSESSMENT_LIMITS.note) {
    throw assessmentError("journeys.errors.field_too_long", 400, { code: "JOURNEY_FIELD_TOO_LONG", field: "note", limit: JOURNEY_ASSESSMENT_LIMITS.note });
  }
  return { level, note: note || null };
}

/** Kuidas see märge suhestub võrdlusmärkega (algseis või eelmine). */
export function assessmentChange(level, comparedTo) {
  if (comparedTo === null || comparedTo === undefined) return AssessmentChange.BASELINE;
  if (level > comparedTo) return AssessmentChange.BETTER;
  if (level < comparedTo) return AssessmentChange.HARDER;
  return AssessmentChange.SAME;
}

function time(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

/**
 * Hinnangute pilt lehe jaoks: algseis, viimane märge ja muutus algusest; iga
 * märke juures muutus võrreldes ALGSEISUGA (see on küsimus, millele inimene
 * vastab: kas on läinud paremaks sellest, kust ma alustasin).
 */
export function summarizeAssessments(rows) {
  const ordered = [...(Array.isArray(rows) ? rows : [])].sort(
    (a, b) => time(a.createdAt) - time(b.createdAt) || String(a.id).localeCompare(String(b.id))
  );
  const baseline = ordered[0] || null;
  const latest = ordered.length > 1 ? ordered[ordered.length - 1] : null;
  const items = ordered
    .map((row, index) => ({
      ...row,
      change: index === 0 ? AssessmentChange.BASELINE : assessmentChange(row.level, baseline.level)
    }))
    .reverse();
  return {
    baseline: baseline ? items[items.length - 1] : null,
    latest: latest ? items[0] : null,
    /* Ilma teise märketa ei ole muutust, millest rääkida. */
    change: latest ? assessmentChange(latest.level, baseline.level) : null,
    items
  };
}
