/**
 * Teekonna alguse täpsustavad küsimused: küsitakse ainult seda, millele kirjeldus veel ei vasta.
 *
 * Varem olid kolm küsimust alati samad. Inimene kirjutas „Ema on 82 ja elab üksi Rakveres” ja sai
 * ikka küsimused „Millises omavalitsuses abi vajatakse?” ja „Kas abi on vaja inimesele endale või
 * lähedasele?”. Küsimus, millele on juba vastatud, jätab mulje, et kirjeldust ei loetud.
 *
 * Reegel on ettevaatlik ühes suunas: kahtluse korral küsimus JÄÄB. Vale äratundmine jätab ühe
 * küsimuse küsimata; midagi ei kirjutata Teekonna andmetesse ega täideta kellegi eest ette.
 */

export const JOURNEY_PLACE_QUESTION = "Millises omavalitsuses või piirkonnas abi vajatakse?";
export const JOURNEY_PERSON_QUESTION = "Kas abi on vaja inimesele endale või lähedasele?";
export const JOURNEY_EXISTING_HELP_QUESTION = "Kas mõni teenus, otsus või kontakt on juba olemas?";

const WORD = /\p{L}[\p{L}-]*/gu;

/* Kohanime käändelõpud: Rakvere+s, Türi+l, Tallinn+as, Saaremaa+le. */
const PLACE_ENDINGS = new Set([
  "", "s", "sse", "st", "l", "le", "lt", "ga", "ni", "na", "ks", "t",
  "a", "as", "ast", "asse", "al", "ale", "alt"
]);

/* Piirkonna nimi ilma loendita: Harjumaal, Lääne-Virumaale, Saaremaa. */
const REGION_WORD = /^\p{Lu}[\p{L}-]*maa(?:l|le|lt|s|st|ga|ni)?$/u;

const UNIT_WORD = /^(?:vald|valla|vallas|vallast|valda|linn|linna|linnas|linnast|maakond|maakonna|maakonnas)$/u;

/* Lähedast või teist inimest nimetav sõna. Lühikesed tüved on kirjas täisvormidena, et „õelus” ega
   „emakeel” vastuseks ei loetaks; pikematel piisab tüvest ja kuni kolmest lõputähest. */
const OTHER_PERSON_FORMS = new Set([
  "ema", "emal", "emale", "emaga", "emalt", "emast", "emata",
  "isa", "isal", "isale", "isaga", "isalt", "isast", "isata",
  "õde", "õe", "õel", "õele", "õega", "õelt",
  "äi", "äia", "äial", "äiale", "äiaga",
  "ämm", "ämma", "ämmal", "ämmale", "ämmaga",
  "onu", "onul", "onule", "onuga",
  "tädi", "tädil", "tädile", "tädiga"
]);
const OTHER_PERSON_STEMS = Object.freeze([
  "vanaema", "vanaisa", "abikaasa", "elukaasla", "tütar", "tütre", "poeg", "poja",
  "lapselaps", "lapselapse", "laps", "lapse", "vend", "venna", "lähedane", "lähedase",
  "naaber", "naabri", "naabrimees", "naabrimehe", "naabrinaine", "naabrinaise", "sõber", "sõbra", "sugulane", "sugulase", "klient", "kliendi",
  "hoolealune", "hoolealuse", "eestkostetav"
]);

/* „minu mees”, „mu naine”: sõna „mees” üksi võib olla kes tahes. */
const SPOUSE = /(?:^|[^\p{L}])(?:minu|mu|meie)\s+(?:mees|mehe|mehel|mehele|naine|naise|naisel|naisele)(?![\p{L}])/iu;

/* Inimene räägib endast. „minu” ei ole siin: „minu ema” ei ütle, et abi vajab kirjutaja ise. */
const SELF_FORMS = new Set([
  "ma", "mina", "mul", "mulle", "mult", "mind", "minul", "minule", "minult", "olen", "vajan", "elan"
]);

function wordsOf(text) {
  return String(text || "").match(WORD) || [];
}

function lower(value) {
  return String(value || "").toLocaleLowerCase("et");
}

/** Kas kirjeldus nimetab omavalitsuse või piirkonna. `baseNames` on omavalitsuste nimed („Rakvere”). */
export function namesPlace(text, baseNames = []) {
  const words = wordsOf(text);
  const names = [...new Set((Array.isArray(baseNames) ? baseNames : []).map(lower).filter((name) => name.length >= 3))];
  for (let index = 0; index < words.length; index += 1) {
    const word = words[index];
    /* Kohanimi kirjutatakse suure algustähega; nii ei loeta sõna „tapa” Tapa vallaks. */
    if (!/^\p{Lu}/u.test(word)) continue;
    if (REGION_WORD.test(word)) return true;
    const folded = lower(word);
    if (names.some((name) => folded.startsWith(name) && PLACE_ENDINGS.has(folded.slice(name.length)))) return true;
    /* „Vinni vald”, „Kose vallas”: nimi, mida loendis ei ole, koos üksuse sõnaga. */
    if (UNIT_WORD.test(lower(words[index + 1]))) return true;
  }
  return false;
}

/** Kas kirjeldus ütleb, kelle jaoks abi on: nimetab lähedast või räägib kirjutajast endast. */
export function namesPerson(text) {
  const source = String(text || "");
  if (SPOUSE.test(source)) return true;
  for (const word of wordsOf(source)) {
    const folded = lower(word);
    if (SELF_FORMS.has(folded) || OTHER_PERSON_FORMS.has(folded)) return true;
    if (OTHER_PERSON_STEMS.some((stem) => folded.startsWith(stem) && folded.length - stem.length <= 3)) return true;
  }
  return false;
}

/** Küsimused, millele kirjeldus veel ei vasta. Kolmandat ei saa tekstist usaldusväärselt lugeda. */
export function journeyDraftQuestions(situation, { municipalityNames = [] } = {}) {
  const questions = [];
  if (!namesPlace(situation, municipalityNames)) questions.push(JOURNEY_PLACE_QUESTION);
  if (!namesPerson(situation)) questions.push(JOURNEY_PERSON_QUESTION);
  questions.push(JOURNEY_EXISTING_HELP_QUESTION);
  return questions;
}
