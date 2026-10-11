// ABIKUULUTUSE LIIGI TULETAMINE EESTI SÕNADEST.
//
// Enne 11.10.2026 tuletus liik sisuliselt ainult ingliskeelsetest sõnadest: eesti tüved olid
// kirjas terve sõnana („korist", „juhend", „selts"), `\b` ei tundnud täpitähti („õpp") ja lühike
// tüvi `vii[a-z]*` luges transpordiks sõnad „viimasel" ja „viis". Päris lausete loend allpool on
// sama, millega muudatust enne ja pärast mõõdeti.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { inferHelpCategoryCode } from "../lib/help/categories.js";
import { createHelpWorkflowExtraction } from "../lib/help/workflowExtraction.js";

const code = (description, extra = {}) => inferHelpCategoryCode({ description, ...extra });

test("päris laused: eesti sõnavormidest tuleb õige liik", () => {
  const cases = [
    ["Otsin abi koristamisel", "HOME_HELP"],
    ["Lumekoristus ja muruniitmine", "HOME_HELP"],
    ["Viimasel ajal ei jaksa ma enam ise koristada", "HOME_HELP"],
    ["Aitan kodustes töödes", "HOME_HELP"],
    ["Vajan abi viis korda nädalas poes käimisel", "DAILY_TASKS"],
    ["Toon poest toidu koju", "DAILY_TASKS"],
    ["Aitan igapäevastes toimingutes", "DAILY_TASKS"],
    ["Vajan küüti arsti juurde", "TRANSPORT"],
    ["Sõidutan eakaid poodi ja arsti juurde", "TRANSPORT"],
    ["Kooli viimine ja toomine", "TRANSPORT"],
    ["Viin teid arsti juurde", "TRANSPORT"],
    ["Pakun sotsiaaltransporti", "TRANSPORT"],
    ["Vajan abi nutitelefoni seadistamisel", "DIGITAL_HELP"],
    ["Vajan juhendamist arvutiga", "DIGITAL_HELP"],
    ["Vajan abi e-teenuste kasutamisel ja ID-kaardiga", "DIGITAL_HELP"],
    ["Otsin hooldajat eakale emale", "CARE_SUPPORT"],
    ["Koduhooldus eakale", "CARE_SUPPORT"],
    ["Isiklik abistaja puudega noorele", "CARE_SUPPORT"],
    ["Pakun lapsehoidu õhtuti", "CHILD_YOUTH_SUPPORT"],
    ["Otsin lapsehoidjat, helista telefonil", "CHILD_YOUTH_SUPPORT"],
    ["Saan laste hoidmisel aidata", "CHILD_YOUTH_SUPPORT"],
    ["Lapsele õppimise abi", "LEARNING_GUIDANCE"],
    ["Pakun järeleaitamist matemaatikas põhikooli lastele", "LEARNING_GUIDANCE"],
    ["Õpetan eesti keelt", "LEARNING_GUIDANCE"],
    ["Vajan mentorit karjääri alustamiseks", "LEARNING_GUIDANCE"],
    ["Otsin emale seltsilist, kes käiks temaga jalutamas", "SOCIAL_SUPPORT"],
    ["Tunnen üksildust ja otsin vestluskaaslast", "SOCIAL_SUPPORT"],
    ["Otsin seltskonda õhtuteks", "SOCIAL_SUPPORT"],
    ["Aitan täita avaldusi ja taotlusi", "ADMIN_FORM_HELP"],
    ["Aitan dokumentide vormistamisel", "ADMIN_FORM_HELP"],
    ["Otsin abi tuludeklaratsiooni täitmisel", "ADMIN_FORM_HELP"],
    ["Abi asjaajamisel ametiasutustega", "ADMIN_FORM_HELP"]
  ];
  for (const [text, expected] of cases) assert.equal(code(text), expected, text);
});

test("suurtähed, täpitähed sõna alguses ja täppideta kirjapilt", () => {
  for (const text of ["ÕPPIMINE", "Õpiabi", "õpe", "ÕPETAJA", "oppimine", "Oppida on raske"]) assert.equal(code(text), "LEARNING_GUIDANCE", text);
  for (const text of ["ÜKSILDUS", "Üksindus", "uksildus"]) assert.equal(code(text), "SOCIAL_SUPPORT", text);
  for (const text of ["KÄIMINE POES", "poes kaimine", "IGAPÄEVAABI", "igapaevaabi"]) assert.equal(code(text), "DAILY_TASKS", text);
  for (const text of ["SÕIT", "sõidan ise", "soidutan", "KÜÜT"]) assert.equal(code(text), "TRANSPORT", text);
  for (const text of ["Põetamine", "KÕRVALABI", "korvalabi"]) assert.equal(code(text), "CARE_SUPPORT", text);
});

test("sõna teise sõna sees, teise tähendusega sõna ja kontaktirida ei anna liiki", () => {
  const none = [
    "Platvorm ei tööta",
    "Töövormi valik",
    "Olen heas vormis",
    "Poeg aitab",
    "Helista mulle telefonil",
    "Vastan telefoni teel",
    "Minu telefoninumber on kuulutuses",
    "Suhtleme meili teel",
    "Pärast operatsiooni vajan abi",
    "Viirus on levinud",
    "Viimistlustööd on tehtud",
    "Viimati oli kõik hästi",
    "Nad sõid lõunat",
    "Midagi muud"
  ];
  for (const text of none) assert.equal(code(text), "OTHER", text);
  /* Samad sõnad õiges tähenduses loevad. */
  assert.equal(code("Vajan abi telefoniga"), "DIGITAL_HELP");
  assert.equal(code("Paigalda rakendus telefonile"), "DIGITAL_HELP");
  assert.equal(code("Aitan vormi täita"), "ADMIN_FORM_HELP");
  assert.equal(code("Viia on vaja arsti juurde"), "TRANSPORT");
});

test("lapse või noore paljas mainimine jääb sisulise liigi taha", () => {
  /* Selge märk loeb oma kohal … */
  assert.equal(code("Pakun lastehoidu ja abi kodutöödes"), "CHILD_YOUTH_SUPPORT");
  assert.equal(code("Lapsele tuge koolis ja kodus"), "CHILD_YOUTH_SUPPORT");
  assert.equal(code("Noorsootöö ja mentorlus"), "CHILD_YOUTH_SUPPORT");
  /* … paljas sõna alles siis, kui midagi muud ei sobinud. */
  assert.equal(code("Aitan lapse toetuse avalduse täita"), "ADMIN_FORM_HELP");
  assert.equal(code("Otsin noortele seltskonda"), "SOCIAL_SUPPORT");
  assert.equal(code("Lapsed vajavad abi"), "CHILD_YOUTH_SUPPORT");
  assert.equal(code("Abi noortele"), "CHILD_YOUTH_SUPPORT");
});

test("reeglite järjekord: varasem liik võidab, kui lauses on mitu märki", () => {
  assert.equal(code("Sõidutan ja aitan poes käia"), "TRANSPORT");
  assert.equal(code("Poes käimine ja koristamine"), "DAILY_TASKS");
  assert.equal(code("Koristamine ja arvutiabi"), "HOME_HELP");
  assert.equal(code("Arvuti ja hooldus"), "DIGITAL_HELP");
  assert.equal(code("Hooldus ja õppimine"), "CARE_SUPPORT");
  assert.equal(code("Õppimine ja seltskond"), "LEARNING_GUIDANCE");
  assert.equal(code("Seltskond ja avaldus"), "SOCIAL_SUPPORT");
});

test("kutsuja antud silt võidab kirjelduse sõnad; tundmatu silt on tavaline tekst", () => {
  const labels = [
    ["Transport", "TRANSPORT"],
    ["Igapäevaabi", "DAILY_TASKS"],
    ["Igapaevaabi", "DAILY_TASKS"],
    ["Koduabi", "HOME_HELP"],
    ["Digiabi", "DIGITAL_HELP"],
    ["Tugi ja hooldus", "CARE_SUPPORT"],
    ["Laste ja noorte tugi", "CHILD_YOUTH_SUPPORT"],
    ["Õppimise ja juhendamise abi", "LEARNING_GUIDANCE"],
    ["Seltskond ja sotsiaalne tugi", "SOCIAL_SUPPORT"],
    ["Asjaajamise ja vormide abi", "ADMIN_FORM_HELP"],
    ["Muu abi", "OTHER"],
    ["  home_help ", "HOME_HELP"]
  ];
  for (const [category, expected] of labels) assert.equal(inferHelpCategoryCode({ category, description: "autoga poodi ja arvuti" }), expected, category);
  /* Tundmatu silt ja teenuse nimi on tõend nagu kirjeldus. */
  assert.equal(inferHelpCategoryCode({ category: "Koristamine", description: "" }), "HOME_HELP");
  assert.equal(inferHelpCategoryCode({ serviceLabel: "Lapsehoidja", description: "õhtuti" }), "CHILD_YOUTH_SUPPORT");
  /* Väljade piir ei tekita fraasi: „lapsele" teenuse nimes ja „abi" kirjelduse alguses ei ole „lapsele abi". */
  assert.equal(inferHelpCategoryCode({ serviceLabel: "Toidu toomine lapsele", description: "Abi asjaajamisel" }), "ADMIN_FORM_HELP");
  for (const empty of [{}, { description: "" }, { description: "   " }, { description: null }, undefined]) assert.equal(inferHelpCategoryCode(empty), "OTHER");
});

test("ingliskeelsed sõnad annavad sama liigi mis enne", () => {
  const cases = [
    ["Help with shopping and errands", "DAILY_TASKS"],
    ["household cleaning", "HOME_HELP"],
    ["Need help with a computer", "DIGITAL_HELP"],
    ["digital skills", "DIGITAL_HELP"],
    ["care for my mother", "CARE_SUPPORT"],
    ["support worker needed", "CARE_SUPPORT"],
    ["youth club", "CHILD_YOUTH_SUPPORT"],
    ["child needs help", "CHILD_YOUTH_SUPPORT"],
    ["learning support", "LEARNING_GUIDANCE"],
    ["guidance for beginners", "LEARNING_GUIDANCE"],
    ["social contact", "SOCIAL_SUPPORT"],
    ["emotional support", "SOCIAL_SUPPORT"],
    ["form filling", "ADMIN_FORM_HELP"],
    ["application for benefits", "ADMIN_FORM_HELP"]
  ];
  for (const [text, expected] of cases) assert.equal(code(text), expected, text);
  /* Uued: „companion" ei sobinud varem üldse (reeglis oli tüvi „compan" terve sõnana). */
  assert.equal(code("Looking for a companion"), "SOCIAL_SUPPORT");
});

/* Vestluse töövoog: sama normaliseerimine mis failis lib/help/chatWorkflow.js (täpid maha, väiketähed). */
const normalizeText = (value = "") => String(value || "").normalize("NFD").replace(/\p{Diacritic}+/gu, "").toLowerCase().trim();
const { inferCategoryFromText } = createHelpWorkflowExtraction({ normalizeText, getCategoryLabel: (value) => value || "", inferHelpCategoryCode });
const chat = (message, previous = "") => inferCategoryFromText(message, previous).categoryCode;

test("vestluse töövoog: „viimasel ajal” ei ole transport ja eesti sõnavormid annavad liigi", () => {
  assert.equal(chat("Viimasel ajal ei jaksa ma enam ise koristada"), "HOME_HELP");
  assert.equal(chat("Vajan abi viis korda nädalas, ei jõua koristada"), "HOME_HELP");
  assert.equal(chat("Viirus on möödas, aga vajan abi koristamisel"), "HOME_HELP");
  /* „viima" vormid on endiselt transport. */
  for (const text of ["Vii mind arsti juurde", "Keegi võiks mind viia", "Viin teid kohale", "Lapse kooli viimine", "Vajan küüti"]) {
    assert.equal(chat(text), "TRANSPORT", text);
  }
  assert.equal(chat("Otsin lapsehoidjat õhtuteks"), "CHILD_YOUTH_SUPPORT");
  assert.equal(chat("Pakun järeleaitamist matemaatikas"), "LEARNING_GUIDANCE");
  assert.equal(chat("Tunnen üksildust ja otsin vestluskaaslast"), "SOCIAL_SUPPORT");
  assert.equal(chat("Otsin emale seltsilist"), "SOCIAL_SUPPORT");
  assert.equal(chat("Aitan täita avaldusi"), "ADMIN_FORM_HELP");
  assert.equal(chat("Vajan abi nutitelefoniga"), "DIGITAL_HELP");
});

test("vestluse töövoog: kontaktirida ei ole digiabi ja lapse paljas mainimine ei ole lapsehoid", () => {
  assert.equal(chat("Helista mulle telefonil"), "");
  assert.equal(chat("Otsin koristajat, helista telefonil"), "HOME_HELP");
  /* Paljas „laps": liiki ei pakuta, eelmine valik jääb alles. */
  assert.equal(chat("Mul on kaks last ja laps on haige"), "");
  assert.equal(chat("Mul on kaks last ja laps on haige", "HOME_HELP"), "HOME_HELP");
  assert.equal(chat("Lapsele tuge koolis"), "CHILD_YOUTH_SUPPORT");
  assert.equal(chat("midagi muud", "TRANSPORT"), "TRANSPORT");
});

test("reeglifailides ei ole enam lühikest tüve ega terve sõnana kirjutatud tüve", () => {
  const categories = fs.readFileSync(new URL("../lib/help/categories.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(categories, /\\b\(/, "kategooriate reeglid ei kasuta ASCII sõnapiiri");
  assert.doesNotMatch(categories, /\[a-z\]\*/, "tüve jätk peab tundma täpitähti");
  const workflow = fs.readFileSync(new URL("../lib/help/workflowExtraction.js", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  assert.doesNotMatch(workflow, /vii\\w\*/, "`vii\\w*` loeb transpordiks ka „viimasel” ja „viis”");
});
