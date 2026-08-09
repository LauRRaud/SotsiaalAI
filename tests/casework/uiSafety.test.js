/**
 * JTA-V1 — omaniku seitsmes audit (08.08): kasutajaliidese andmeterviklus.
 *
 * SEITSE LEIDU, MIS KÕIK ELASID PINNAL, MITTE TEENUSKIHIS — ja just seepärast
 * ei näinud neid ükski senine test: teenuskihi sviit oli roheline, marsruudi-
 * leping roheline, IDOR-sond roheline. Pind võib kõike seda austada ja ikkagi
 * kaotada kasutaja teksti või salvestada ta vale objekti alla.
 *
 * NEED ON KUJU-TESTID ja see on teadlik piirang: testijooksja ei teisenda
 * JSX-i, seega komponenti ei saa renderdada. Käitumise tõendab brauseri
 * läbisõit; siin hoitakse ära REGRESSIOON — et parandus ei kaoks järgmise
 * refaktori sees.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { normalizeLimit } from "../../lib/casework/paging.js";

const SECTIONS = [
  "../../components/casework/MeetingNoteSection.jsx",
  "../../components/casework/MeetingPrepSection.jsx"
];

async function read(relative) {
  return readFile(new URL(relative, import.meta.url), "utf8");
}

async function readCode(relative) {
  return (await read(relative)).replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|\s)\/\/.*$/gm, "$1");
}

/* ── 1. vormi olek ei kandu teise objekti ───────────────────────────────── */

test("avatud objekti vahetus VÕTAB PUU MAHA — vormi olek ei kandu üle", async () => {
  /* Ilma `key`-ta jäävad editor ja tema alamplokid SAMADEKS komponentideks:
     märkmes A pooleli jäänud tekst jääb nähtavaks märkmes B ja selle saab B
     alla salvestada. See on andmeterviklus, mitte kosmeetika. */
  const note = await readCode("../../components/casework/MeetingNoteSection.jsx");
  assert.match(note, /<NoteEditor\s+key=\{openNote\.id\}/, "märkme editoril puudub `key`");

  const prep = await readCode("../../components/casework/MeetingPrepSection.jsx");
  assert.match(prep, /<PrepEditor\s+key=\{openPrep\.id\}/, "ettevalmistuse editoril puudub `key`");
});

test("aegunud päring ei kirjuta värskemat üle", async () => {
  /* Kaks `load…()` päringut võivad lõppeda vales järjekorras. Ilma valvurita
     vaataks töötaja märget A ja näeks märkme B sisu. */
  for (const [file, ref] of [
    ["../../components/casework/MeetingNoteSection.jsx", "requestedNoteId"],
    ["../../components/casework/MeetingPrepSection.jsx", "requestedPrepId"]
  ]) {
    const source = await readCode(file);
    assert.match(source, new RegExp(`${ref} = useRef`), `${file}: võistlusvalvur puudub`);
    assert.match(source, new RegExp(`if \\(${ref}\\.current !== \\w+\\) return;`), `${file}: aegunud vastust ei visata ära`);
  }
});

test("avatud objekti identiteet on ekraanil nähtav", async () => {
  /* Juhtumil on mitu märget ja mitu ettevalmistust. Kui ekraan ei ütle, MILLISE
     alla parasjagu kirjutatakse, on vale koha alla salvestamine kasutaja jaoks
     nähtamatu. */
  const note = await readCode("../../components/casework/MeetingNoteSection.jsx");
  assert.match(note, /casework\.note\.open_note/, "märkme identiteet ei ole nähtav");

  const prep = await readCode("../../components/casework/MeetingPrepSection.jsx");
  assert.match(prep, /casework\.prep\.open_prep/, "ettevalmistuse identiteet ei ole nähtav");
});

/* ── 2. päritolul ei ole vaikeväärtust ──────────────────────────────────── */

test("päritolu EI OLE eelvalitud — märgis, mille inimene ei valinud, ei ole märgis (L4)", async () => {
  for (const file of SECTIONS) {
    const source = await readCode(file);
    /* Vaikeväärtus tähendas, et rea sai lisada päritolu teadlikult valimata.
       Seda süvendab see, et märkmel EI OLE hiljem parandusrada — eksimus nõuab
       rea kustutamist ja uuesti loomist. */
    assert.doesNotMatch(
      source,
      /useState\(PROVENANCE\.[A-Z_]+\)/,
      `${file}: päritolul on vaikeväärtus`
    );
    assert.match(source, /provenance_required/, `${file}: valikut ei nõuta`);
    /* Nupp peab olema kinni, kuni päritolu on valitud — muidu on nõue ainult
       serveri veateade, mille kasutaja saab pärast teksti kirjutamist. */
    assert.match(source, /!provenance/, `${file}: nupp ei sõltu päritolu valikust`);
  }
});

/* ── 3. tõrge ei kustuta sisestust ──────────────────────────────────────── */

test("ebaõnnestunud salvestus EI KUSTUTA kasutaja teksti", async () => {
  /* `run()` neelab vea ja tagastab `null`. Tingimusteta `setText("")` pärast
     `await`-i tähendas, et tõrke korral kadus töö ära — kõige halvem tulemus,
     mis vormil olla saab. */
  for (const file of SECTIONS) {
    const source = await readCode(file);
    assert.match(source, /const saved = await onAdd\(/, `${file}: edu ei kontrollita`);
    assert.match(source, /if \(saved\) \{[\s\S]{0,120}setText\(""\)/, `${file}: väli tühjendatakse tingimusteta`);
  }
});

test("lisamisoperatsioon TAGASTAB edu, mitte undefined", async () => {
  /* Ilma tagastuseta ei saa vorm vahet teha „salvestus õnnestus" ja „run()
     neelas vea" vahel — ja siis on eelmine test tühi. */
  for (const file of SECTIONS) {
    const source = await readCode(file);
    assert.match(source, /if \(!done\) return false;[\s\S]{0,160}return true;/, `${file}: edu ei tagastata`);
  }
});

/* ── 4. pagineerimine ───────────────────────────────────────────────────── */

test("loend säilitab cursor'i ja pakub näita-rohkem tegevuse", async () => {
  /* Teenuskiht toetab lehekülgi; pind viskas selle ära ja vanemad kui 25 kirjet
     muutusid liideses KÄTTESAAMATUKS. Juhtumitöö on pikk. */
  for (const [file, state, key] of [
    ["../../components/casework/MeetingNoteSection.jsx", "notesCursor", "casework.note.load_more"],
    ["../../components/casework/MeetingPrepSection.jsx", "prepsCursor", "casework.prep.load_more"]
  ]) {
    const source = await readCode(file);
    assert.match(source, new RegExp(`\\[${state}, set`), `${file}: cursor'it ei hoita`);
    assert.match(source, new RegExp(key.replace(/\./g, "\\.")), `${file}: „näita rohkem" puudub`);
    assert.match(source, /append: true/, `${file}: lehte ei lisata olemasolevale`);
  }
});

/* ── 5. pöördumatu tegu küsib üle ───────────────────────────────────────── */

test("pöördumatud kustutused käivad kaheastmelise kinnituse kaudu", async () => {
  /* Kliendiviite kustutus ei tule tagasi ka konto kustutamise rajalt; märkme
     kirjet ja ettevalmistust ei auditeerita. Üks vajutus oli liiga vähe. */
  const detail = await readCode("../../components/casework/CaseWorkDetail.jsx");
  assert.match(detail, /<ConfirmButton[\s\S]{0,400}onConfirm=\{eraseClientReference\}/, "kliendiviite kustutus ei küsi üle");

  /* SOL-CW-15: märkme kirjet EI KUSTUTATA enam — teda võetakse tagasi ja see
     jätab jälje. Kinnitus jääb (tegu on ikka pöördumatu), aga tema kõrvale on
     tulnud KOHUSTUSLIK PÕHJUS: kaheastmeline „kas oled kindel" ei tekita
     auditile midagi, ja kui pind põhjust ei küsi, saab töötaja 400 alles pärast
     otsust. Nupp on kinni, kuni põhjus on kirjutatud. */
  const note = await readCode("../../components/casework/MeetingNoteSection.jsx");
  assert.match(note, /<ConfirmButton[\s\S]{0,400}onRetract\(entryId, reason\.trim\(\)\)/, "kirje tagasivõtt ei küsi üle");
  assert.match(note, /disabled=\{disabled \|\| !ready\}/, "tagasivõtu nupp on lahti ka ilma põhjuseta");
  assert.doesNotMatch(note, /method: "DELETE"/, "pinnal on ikka kirje kõva kustutus");

  const prep = await readCode("../../components/casework/MeetingPrepSection.jsx");
  assert.match(prep, /onConfirm=\{\(\) => deletePrep\(prep\.id\)\}/, "ettevalmistuse kustutus ei küsi üle");
  assert.match(prep, /onConfirm=\{\(\) => onRemoveQuestion\(question\.id\)\}/, "küsimuse eemaldus ei küsi üle");
});

test("kinnitusnupu teine aste nullitakse, kui nupp keelatakse", async () => {
  /* Muidu jääks „kinnita" ripakile ja järgmine klõps käivitaks teo, mille
     kasutaja juba unustas. */
  const source = await readCode("../../components/casework/ConfirmButton.jsx");
  assert.match(source, /useEffect\(\(\) => \{[\s\S]{0,80}if \(disabled\) setArmed\(false\);/, "teist astet ei nullita");
  assert.doesNotMatch(source, /window\.confirm/, "brauseri dialoog ei ole tõlgitav ega testitav");
});

/* ── 6. loendipiir ─────────────────────────────────────────────────────── */

test("murdarvuline või rämps `limit` annab 400, mitte Prisma vea", async () => {
  /* `?limit=1.5` andis `take = 2.5`, mille päris Prisma tagasi lükkab — tulemus
     oleks kasutaja sisendist põhjustatud 500. Fake-prisma ei valideeri ühtegi
     argumenti, seega sviit oli roheline. */
  const bounds = { fallback: 50, max: 200 };

  for (const bad of ["1.5", 1.5, "abc", "0", 0, -3, "-3", "1e", Infinity, NaN, {}]) {
    assert.throws(
      () => normalizeLimit(bad, bounds),
      (error) => {
        assert.equal(error.status, 400, `${String(bad)}: oodatud 400, saadi ${error.status}`);
        assert.equal(error.messageKey, "casework.errors.limit_invalid");
        return true;
      },
      `${String(bad)} läks läbi`
    );
  }

  /* Puuduv piir on ERI ASI kui vigane piir — tema tähendab „vaikimisi". */
  for (const empty of [undefined, null, ""]) {
    assert.equal(normalizeLimit(empty, bounds), 50);
  }

  assert.equal(normalizeLimit("25", bounds), 25);
  assert.equal(normalizeLimit(25, bounds), 25);
  /* Ülemine lagi klambritakse vaikselt — see on serveri kaitse, mitte viga. */
  assert.equal(normalizeLimit(9999, bounds), 200);
});

test("ükski casework-moodul ei kirjuta enam oma `take` arvutust", async () => {
  /* Kaheksa koopiat ühest reast tähendasid, et parandus jääks ühte neist
     tegemata — ja just see üks oleks siis lahti. */
  for (const name of [
    "caseWorkAssist.js",
    "caseWorkItem.js",
    "caseWorkMissingInfo.js",
    "caseWorkMeetingPrep.js",
    "caseWorkMeetingNote.js"
  ]) {
    const source = await readCode(`../../lib/casework/${name}`);
    assert.doesNotMatch(source, /Math\.min\(Math\.max\(Number\(limit\)/, `${name}: oma take-arvutus alles`);
    assert.match(source, /normalizeLimit\(limit,/, `${name}: ühist normaliseerijat ei kasutata`);
  }
});

/* ── 7. detailvaate lehevahetus ─────────────────────────────────────────── */

test("detailvaate näita-rohkem käib `run()` sees ja lukustub", async () => {
  /* Väljaspool `run()`-i ei lukustunud nupp, sama cursor sai kaks korda
     lisanduda ja tõrge jäi käsitlemata — kasutaja vajutas ja ei juhtunud
     midagi. */
  const source = await readCode("../../components/casework/CaseWorkDetail.jsx");
  for (const loader of ["loadItems", "loadMissingInfo"]) {
    assert.match(
      source,
      new RegExp(`disabled=\\{busy\\}[\\s\\S]{0,120}run\\(\\(\\) => ${loader}\\(\\{ cursor:`),
      `${loader}: lehevahetus ei ole run() sees või ei lukustu`
    );
  }
});
