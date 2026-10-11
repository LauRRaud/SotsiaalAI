/**
 * KODUTEENUS K1-c — päeviku otsing, mis arvestab eesti sõnavorme.
 *
 * Hooldaja otsib „võti" ja peab leidma ka „võtme" ja „võtmed". Eesti keeles
 * tüvi muutub (võti : võtme, tütar : tütre, uks : ukse), seega tüvestajast ei
 * piisa; vaja on algvormi. Selle annab platvormi olemasolev morfoloogia
 * (`lib/rag-v2/search/estnltk.js`: kohalik protsess samas serveris, mida kasutab
 * ka vestlus). Tekst EI LAHKU SERVERIST ja seda ei logita.
 *
 * KOLM KUJU IGA SÕNA KOHTA, et otsing töötaks ka siis, kui morfoloogia ei vasta:
 *   w<sõna>      sõna ise (väiketähtedes); otsingus sobib ka sõna ALGUS,
 *                „pesu" leiab „pesumasin";
 *   sb<kk><tüvi> tüvestaja tüvi (eesti, inglise, vene);
 *   vmet<lemma>  algvorm, kui morfoloogia vastas.
 *
 * Kirje juurde salvestatakse need tühikutega eraldatult (`searchText`) ja märge,
 * kas algvormid on olemas (`searchVersion`). Päring teeb otsisõnadest samad
 * kujud: iga otsisõna peab kirjes esinema vähemalt ühel kujul.
 *
 * Otsing käib ÜHE KLIENDI kirjete seas, seega piisab tavalisest
 * alamsõne-võrdlusest; eraldi täistekstiindeksit ei ole.
 */

import { badRequest } from "../org/errors.js";
import { defaultEstnltkAnalyzer } from "../rag-v2/search/estnltk.js";
import { morphologyText } from "../rag-v2/search/morphology.js";

import { HOME_CARE_LIMITS } from "./constants.js";

export const SearchVersion = Object.freeze({
  /** Algvormid olemas. */
  LEMMAS: "vm1",
  /** Ainult sõnad ja tüved: morfoloogia ei vastanud salvestamise ajal. */
  STEMS: "sb1"
});

const WORD_PATTERN = /[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu;
const LEMMA_TOKEN = /^vmet[\p{L}\p{M}-]+$/u;
const MAX_WORD = 60;

/** Teksti sõnad väiketähtedes, kordusteta, tekstis esinemise järjekorras. */
export function searchWords(text) {
  if (typeof text !== "string" || !text) return [];
  const found = text.normalize("NFC").toLowerCase().match(WORD_PATTERN) || [];
  const seen = new Set();
  const words = [];
  for (const word of found) {
    if (word.length < 2 || word.length > MAX_WORD || seen.has(word)) continue;
    seen.add(word);
    words.push(word);
  }
  return words;
}

function stemTokens(text) {
  try {
    return morphologyText(text).split(" ").filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Algvormid morfoloogialt. Tagastab iga teksti kohta žetoonide loendi või `null`,
 * kui morfoloogia ei vastanud ajapiiri sees. Viga EI OLE salvestamise takistus:
 * kirje peab ukse taga salvestuma ka siis, kui abiprotsess on maas.
 */
async function lemmaTokens(texts, { analyzer, timeoutMs }) {
  if (!analyzer || !texts.length) return null;
  let timer;
  try {
    const result = await Promise.race([
      analyzer.analyze(texts),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("morphology_timeout")), timeoutMs);
      })
    ]);
    if (!Array.isArray(result) || result.length !== texts.length) return null;
    return result.map((line) =>
      typeof line === "string" ? line.split(" ").filter((token) => LEMMA_TOKEN.test(token)) : []
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveAnalyzer(analyzer) {
  /* `undefined` = vaikimisi (serveri morfoloogia); `null` = teadlikult ilma. */
  return analyzer === undefined ? defaultEstnltkAnalyzer() : analyzer;
}

/**
 * Kirje otsinguabi. `parts` on kirje tekstiosad (tekst, erijuhtumi hinnang).
 *
 * @returns {{ searchText: string | null, searchVersion: string | null }}
 */
export async function entrySearchText(parts, { analyzer, timeoutMs = HOME_CARE_LIMITS.SEARCH_ANALYZE_MS } = {}) {
  const text = (Array.isArray(parts) ? parts : [parts])
    .filter((part) => typeof part === "string" && part.trim())
    .join("\n")
    .slice(0, HOME_CARE_LIMITS.SEARCH_SOURCE_MAX);
  const words = searchWords(text);
  if (!words.length) return { searchText: null, searchVersion: null };

  const tokens = new Set(words.map((word) => `w${word}`));
  for (const token of stemTokens(text)) tokens.add(token);
  const lemmas = await lemmaTokens([text], { analyzer: resolveAnalyzer(analyzer), timeoutMs });
  if (lemmas) for (const token of lemmas[0]) tokens.add(token);

  return {
    /* Algus- ja lõputühik: iga žetoon on tühikute vahel, seega saab otsida
       täpset žetooni (` žetoon `) ja sõna algust (` w<algus>`). */
    searchText: ` ${[...tokens].join(" ")} `,
    searchVersion: lemmas ? SearchVersion.LEMMAS : SearchVersion.STEMS
  };
}

/**
 * Otsisõnadest Prisma tingimused: iga sõna kohta üks OR-rühm, rühmad AND-iga.
 * Liiga lühike päring on 400 (sama reegel mis kliendiotsingul).
 *
 * @returns {Array<object>} tingimused välja `AND` jaoks
 */
export async function entrySearchWhere(rawQuery, { analyzer, timeoutMs = HOME_CARE_LIMITS.SEARCH_ANALYZE_MS } = {}) {
  const query = typeof rawQuery === "string" ? rawQuery.replace(/\s+/g, " ").trim() : "";
  if (query.length < HOME_CARE_LIMITS.SEARCH_MIN) throw badRequest("home_care.errors.search_too_short");
  const words = searchWords(query.slice(0, HOME_CARE_LIMITS.SEARCH_MAX)).slice(0, HOME_CARE_LIMITS.SEARCH_WORDS_MAX);
  if (!words.length) throw badRequest("home_care.errors.search_too_short");

  const lemmas = await lemmaTokens(words, { analyzer: resolveAnalyzer(analyzer), timeoutMs });
  return words.map((word, index) => {
    const exact = new Set(stemTokens(word));
    for (const token of lemmas?.[index] || []) exact.add(token);
    return {
      OR: [
        /* Sõna algus: lõputühikut ei ole, „pesu" leiab „pesumasin". */
        { searchText: { contains: ` w${word}` } },
        ...[...exact].map((token) => ({ searchText: { contains: ` ${token} ` } }))
      ]
    };
  });
}
