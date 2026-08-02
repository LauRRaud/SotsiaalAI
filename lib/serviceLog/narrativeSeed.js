/**
 * TEENUSPÄEVIK-V1 E5 — KUUNARRATIIVI LÄHTEKOOND.
 *
 * Lepingu ptk 3: tugiisiku-tüüpi teenustel on LUGU põhiroog. Numbrid on arve
 * lisa; narratiiv on see, mille põhjal KOV otsustab teenuse jätkamise.
 *
 * MIDA SEE MOODUL TEEB JA MIDA MITTE.
 *
 * TEEB: koondab perioodi kirjed struktuuriks, mille inimene kirjutab lahti —
 * tegevused, kestused, märkmed koos PÄRITOLUGA ja suunamise eesmärgid.
 *
 * EI TEE: ei kirjuta teksti. See on teadlik ja lepingujärgne (ptk 3 „MVP
 * PARANDUS": AI-mustand märkmetest on v1.1). Deterministlik koond on aus
 * lähtepunkt — ta ei leiuta midagi juurde ja iga rida on jälgitav kirjeni.
 * Kui siia hiljem AI-mustand tuleb, kannab ta märget `AI_MUSTAND` ja jääb
 * mustandiks kuni inimese kinnituseni, nagu mujalgi platvormil.
 *
 * PÄRITOLU EI KAO KOONDAMISEL. Fakti ja tõlgenduse lahusus on see, mis teeb
 * aruande paremaks kui Wordi-praktika — kui koond need kokku sulataks, oleks
 * kogu päritolumärgistus mõttetu töö.
 */

import { ENTRY_STATUS, PROVENANCE } from "./constants.js";

function round2(value) {
  return Math.round(value * 100) / 100;
}

function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Mall C struktuur (leping ptk 6a): perioodi tegevused → edenemine EESMÄRKIDE
 * suhtes → takistused → ETTEPANEK. Viimane toidab KOV-i järgmist
 * suunamisotsust ja on seepärast eraldi väli, mitte lõigu lõpulause.
 */
export const NARRATIVE_SECTIONS = Object.freeze([
  "activities",
  "progress",
  "obstacles",
  "proposal"
]);

export const NARRATIVE_PROPOSAL = Object.freeze({
  CONTINUE: "CONTINUE",
  CHANGE_VOLUME: "CHANGE_VOLUME",
  END: "END"
});

export const NARRATIVE_PROPOSALS = Object.freeze(Object.values(NARRATIVE_PROPOSAL));

export function isNarrativeProposal(value) {
  return typeof value === "string" && NARRATIVE_PROPOSALS.includes(value);
}

/**
 * Koondab perioodi kirjed narratiivi lähtepunktiks.
 *
 * TÜHISTATUD KIRJED JÄÄVAD VÄLJA: nad ei ole toimunud töö. MUSTANDID tulevad
 * kaasa, aga MÄRGITUNA — narratiivi kirjutatakse sageli enne kuu lõplikku
 * kinnitamist ja kirjutaja peab teadma, mis on veel kinnitamata.
 */
export function buildNarrativeSeed(entries = [], { referral = null } = {}) {
  const relevant = entries.filter((entry) => entry && entry.status !== ENTRY_STATUS.VOID);

  const byUnit = new Map();
  const activities = new Map();
  const notes = [];
  let draftCount = 0;
  let firstDate = null;
  let lastDate = null;

  for (const entry of relevant) {
    if (entry.status === ENTRY_STATUS.DRAFT) draftCount += 1;

    const date = toDate(entry.date);
    if (date) {
      if (!firstDate || date < firstDate) firstDate = date;
      if (!lastDate || date > lastDate) lastDate = date;
    }

    const quantity = Number(entry.quantity);
    if (Number.isFinite(quantity) && quantity > 0) {
      const unit = byUnit.get(entry.unit) || { unit: entry.unit, total: 0, visits: 0 };
      unit.total += quantity;
      unit.visits += 1;
      byUnit.set(entry.unit, unit);
    }

    for (const activity of entry.activities || []) {
      activities.set(activity, (activities.get(activity) || 0) + 1);
    }

    /* Märge tuleb kaasa KOOS päritoluga. Ilma päritoluta oleks „ta ütles, et
       ei saa hakkama" ja „mulle tundus, et ta ei saa hakkama" sama lause —
       ja just see vahe on aruande väärtus. */
    const note = typeof entry.note === "string" ? entry.note.trim() : "";
    if (note) {
      notes.push({
        date: date ? date.toISOString().slice(0, 10) : null,
        note,
        provenance: entry.noteProvenance || PROVENANCE.TOOTAJA_TAHELEPANEK,
        isDraft: entry.status === ENTRY_STATUS.DRAFT
      });
    }
  }

  notes.sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  return {
    entryCount: relevant.length,
    draftCount,
    /* Hoiatus kirjutajale: kinnitamata kirjete peale kirjutatud narratiiv võib
       kuu lõpuks mitte enam kehtida. */
    hasUnconfirmed: draftCount > 0,
    periodFrom: firstDate ? firstDate.toISOString().slice(0, 10) : null,
    periodTo: lastDate ? lastDate.toISOString().slice(0, 10) : null,
    totals: [...byUnit.values()].map((row) => ({ ...row, total: round2(row.total) })),
    activities: [...activities.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    notes,
    /* Eesmärgid tulevad SUUNAMISEST. Mall C mõõdab edenemist nende vastu —
       ilma eesmärkideta ei ole narratiivil tuge ja „edenemine" muutub
       arvamuseks. */
    goalsText: referral?.goalsText || null,
    referralId: referral?.id || null,
    /* Iga koondrida on jälgitav kirjeni: see EI OLE AI väljund ja ei kanna
       `AI_MUSTAND` märget. Kui AI-mustand hiljem lisandub, on ta eraldi väli
       eraldi märkega. */
    generatedBy: "deterministic_summary"
  };
}
