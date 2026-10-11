/**
 * Abilise vastus eelpöördumise sammus „Täpsusta abilisega" OSADENA, ilma JSX-ita.
 *
 * MIKS OMA FAIL. Leht liimis abilise vastuse üheks tekstiks (sõnum, märksõnad, küsimus,
 * hoiatused) ja näitas seda vestlusmullina inimese kirjelduse mulli all. Lühikese kirjeldusega
 * oli vaade siis 806 px (paneelis mahub 445) ja töölaua paneelis, kus kõrgeim vaade määrab kogu
 * lava kõrguse, hakkas pärast abilise vastust kerima iga samm. Vaade näitab nüüd osi eraldi:
 * kiire abi hoiatus, sõnumi algus ja järgmine küsimus on ees; märksõnad ja üldised märkused
 * avanevad soovi korral.
 *
 * Abiline on reeglipõhine (`assistPreInquiry` failis lib/preInquiries.js): mudelit ta ei kutsu.
 */

/* Sama tunnus, millega leht seni kiire abi hoiatused teistest eraldas. */
const URGENT = /112|vahetu|kiire|oht|kriisi/i;

/* Kui pikk sõnumi algus on vaates ees; terve sõnum on avatavas plokis. */
export const ASSISTANT_MESSAGE_LIMIT = 180;

const clean = (value) => String(value || "").replace(/\s+/g, " ").trim();
const list = (value) => (Array.isArray(value) ? value : []).map(clean).filter(Boolean);

/**
 * Abilise vastuse osad:
 *   answered   kas abiline on midagi vastanud
 *   message    abilise sõnum (kui seda ei ole, siis põhjendus)
 *   question   järgmine täpsustav küsimus (üks korraga)
 *   urgent     kiire abi hoiatused (jäävad alati ette)
 *   tags       märksõnad: eluvaldkonnad ja sihtrühmad, kordusteta
 *   notes      muud märkused (nt et eelpöördumine ei asenda ametlikku hindamist)
 */
export function assistantAnswer({ message = "", reasoning = "", lifeDomains = [], targetGroups = [], questions = [], warnings = [] } = {}) {
  const text = clean(message) || clean(reasoning);
  const allWarnings = [...new Set(list(warnings))];
  const tags = [...new Set([...list(lifeDomains), ...list(targetGroups)])];
  const question = list(questions)[0] || "";
  return {
    answered: Boolean(text || question || tags.length || allWarnings.length),
    message: text,
    question,
    urgent: allWarnings.filter((warning) => URGENT.test(warning)),
    tags,
    notes: allWarnings.filter((warning) => !URGENT.test(warning))
  };
}

/**
 * Kui palju abilise sõnumist on vaates ees: `{ inline, folded }`.
 *   inline  `full` (terve sõnum), `start` (algus kuni `limit` märki) või `none`
 *   folded  kas terve sõnum on avatavas plokis
 * Kiire abi hoiatuse korral on ees hoiatus ja küsimus; üldine sõnum („kaardistasin
 * kirjelduse…") läheb plokki, et hoiatus ei peaks sellega ruumi jagama (kolme hoiatusega ei
 * mahtunud vaade muidu paneeli).
 */
export function assistantMessagePlace(answer, limit = ASSISTANT_MESSAGE_LIMIT) {
  const message = answer?.message || "";
  if (!message) return { inline: "none", folded: false };
  if (answer.urgent.length) return { inline: "none", folded: true };
  return message.length > limit ? { inline: "start", folded: true } : { inline: "full", folded: false };
}

/** Kas avatav plokk „Abilise märkused" on vaja: seal on märksõnad, märkused ja sõnum, mis ei ole tervikuna ees. */
export function assistantHasNotes(answer, limit = ASSISTANT_MESSAGE_LIMIT) {
  if (!answer?.answered) return false;
  return Boolean(answer.tags.length || answer.notes.length || assistantMessagePlace(answer, limit).folded);
}
