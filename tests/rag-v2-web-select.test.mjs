import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { WEB_SELECTION, chosenMetadata, lowerWords, namesPerson, personPair, selectPage } from '../lib/rag-v2/web-select.js';
import { COUNTRY_NAMES, countryPair, countryWord } from '../lib/rag-v2/countries.js';
import { GIVEN_NAMES } from '../lib/rag-v2/web-select-words.js';

// Every name, address and number here is made up.
const stored = (body, title = 'Näidisliit: Mis on haigus') => `<!doctype html><html lang="et"><meta charset="utf-8"><title>${title}</title><body><article>\n${body}\n</article></body></html>\n`;
const meta = (url = 'https://naidisliit.ee/mis-on-haigus', more = {}) => ({ title: 'Näidisliit: Mis on haigus', publisher: 'Näidisliit', url, collection: { warnings: [], stats: { words: 200 } }, ...more });
const filler = 'Haigus on krooniline seisund, mille korral organism ei tule veresuhkru reguleerimisega toime ning inimene vajab ravi, toitumise jälgimist ja regulaarset liikumist iga päev.';
const context = { lower: lowerWords([`<p>${filler} kask sclerosis multiplex teenuste lastele</p>`]), places: new Set(['tartu', 'viljandi']), year: 2026 };

test('a person is two capitalised words that are not the name of something else', () => {
  assert.equal(WEB_SELECTION, 'rag-v2/web-select-1');
  // A given name and a family name, wherever they stand.
  assert.deepEqual(personPair('Koolituse viib läbi Mari Tammsalu ja teised.', context), { pair: 'Mari Tammsalu', by: 'given_name' });
  assert.equal(namesPerson('Ülevaate koostasid Eve-Liis Nurmoja (kolledž) ja kolleegid', context), true);
  // Neither word is written in lower case anywhere in the reading: a name the list of given names does not know.
  assert.deepEqual(personPair('Raamatu autor on Zuzzu Brenkmann.', context), { pair: 'Zuzzu Brenkmann', by: 'never_lower_case' });
  // One word is an ordinary one: a name only beside a role, a phone number or an address.
  assert.deepEqual(personPair('Küsimustele vastab projektijuht Zenta Kask', context), { pair: 'Zenta Kask', by: 'beside_a_role' });
  assert.equal(namesPerson('Zenta Kask on üks meie liikmetest', context), false);
  // Institutions, places, things, people of history after whom something is named, and repeated headings.
  for (const text of ['Eesti Diabeediliit ootab liikmeid', 'Tartu Ülikooli Kliinikum võtab vastu', 'Dementsuse Kompetentsikeskus nõustab', 'Viljandi Haigla arst võtab vastu',
    'Punktkirja lõi Louis Braille juba ammu', 'Teabematerjal Teabematerjal', 'Haiguse nimi on Sclerosis Multiplex ja arst selgitab', 'Teenuste Lastele juhataja määrab']) assert.equal(namesPerson(text, context), false, text);
  // Words a comma or a full stop parts are not one name.
  assert.equal(namesPerson('Kohtume Tartus. Mari tuleb ka, Tammsalu samuti.', context), false);
  // A sentence's first word before a place in a case form.
  assert.equal(namesPerson('Asume Tartus ja Ootame Viljandisse kõiki', context), false);
  // A name in capitals is known by its given name; other capitals are headings.
  assert.deepEqual(personPair('MARI TAMMSALU', context), { pair: 'MARI TAMMSALU', by: 'given_name' });
  for (const text of ['KOGUKONNAS ELAMISE TEENUS', 'MIS ON DIABEET', 'MARI KESKUS', 'KUST LEIDA ABI JA TUGE?']) assert.equal(namesPerson(text, context), false, text);
  // Without a reading every word counts as unseen: the strict side.
  assert.equal(namesPerson('Raamatu autor on Zuzzu Kask.'), true);
  assert.deepEqual([...lowerWords(['<p>Tere <b>tulemast</b> meie Lehele</p>'])].sort(), ['meie', 'tulemast']);
});

test('a state\'s name is told from a person\'s by the register of states (ADR-143)', () => {
  // A name of several words, also in a case form and written without its marks.
  for (const text of ['Dokumenti ei pea legaliseerima Burkina Faso ja Costa Rica puhul', 'Otsus tehti Sri Lankas', 'Konventsiooniga on liitunud Püha Tool', 'Sao Tome ja Principe', 'Ta elab Araabia Ühendemiraatides',
    // A state's name beside the word for its form, and two states' names in a row of a table.
    'see leping Venemaa Föderatsiooniga kehtib', 'otsus tunnustatakse Šveitsi Konföderatsioonis', 'Kasahstan Kasahstani Vabariik', 'leping Rootsi Kuningriigiga']) assert.equal(namesPerson(text, context), false, text);
  assert.deepEqual([countryPair('Burkina', 'Faso'), countryPair('Venemaa', 'Föderatsioonist'), countryPair('Soome', 'Rootsi'), countryWord('Kasahstanis'), countryWord('Egiptusest')], [true, true, true, true, true]);
  // One word that is a state's name beside another word is not a state: a family name may be a country's. A given name before it decides as before.
  assert.deepEqual([countryPair('Zuzzu', 'Soome'), countryPair('Holland', 'Brenkmann'), countryPair('Vabariik', 'Föderatsioon'), countryWord('Brenkmann')], [false, false, false, false]);
  assert.deepEqual(personPair('Raamatu autor on Zuzzu Soome.', context), { pair: 'Zuzzu Soome', by: 'never_lower_case' });
  assert.deepEqual(personPair('Lepingu allkirjastas Mari Soome', context), { pair: 'Mari Soome', by: 'given_name' });
  assert.deepEqual(personPair('Koolituse viib läbi Mari Tammsalu Burkina Fasost', context), { pair: 'Mari Tammsalu', by: 'given_name' });
  // The register: every state once, and no listed given name is a state's name, so the given name always decides first.
  assert(COUNTRY_NAMES.length >= 200 && new Set(COUNTRY_NAMES.map(entry => entry.name)).size === COUNTRY_NAMES.length);
  for (const name of ['Eesti', 'Soome', 'Läti', 'Venemaa', 'Ukraina', 'Ameerika Ühendriigid', 'Ühendkuningriik', 'Saint Kitts ja Nevis']) assert(COUNTRY_NAMES.some(entry => entry.name === name), name);
  assert.deepEqual([...GIVEN_NAMES].filter(name => countryWord(name)), []);
});

test('a legal act\'s number dates no page, and a unit\'s mailbox is no person\'s address (ADR-143)', () => {
  const why = (body, about = meta()) => { const result = selectPage({ html: stored(body), meta: about }, context); return result.keep ? 'kept' : result.why; };
  const page = `<h1>Mis on haigus</h1>\n<p>${filler}</p>\n<p>${filler}</p>`;
  // The year of an act's number, written as acts are numbered, and of a convention's name; in the address the same name.
  for (const title of ['Kohtuotsuse tunnustamine Nõukogu määruse nr 4/2009 alusel', 'Tunnustamine määruse (EÜ) nr 805/2004 alusel', 'Määrus (EL) 2019/1111', 'Nn. Lugano 2007 konventsioon ja elatisabi']) {
    assert.equal(why(page, meta('https://naidisliit.ee/nn-lugano-2007-konventsioon-ja-elatisabi', { title })), 'kept', title);
  }
  // Any other earlier year dates the page as before: a post's year, a number that is no act's, a year beside the act's number.
  for (const title of ['Näidisliit: Uuring 2024', 'Uudiskiri 2019/05', 'Teabeleht 4/2009', 'Määruse nr 4/2009 muudatused 2015']) assert.match(why(page, meta('https://naidisliit.ee/leht', { title })), /^dated/u, title);
  assert.match(why(page, meta('https://naidisliit.ee/2007-konverents')), /^dated/u);
  // An address the page collector reads as a unit's mailbox stays with its paragraph; a person's and one the rule cannot place go as before.
  const chosen = selectPage({ html: stored(`${page}\n<p>Taotlus saada keskasutusele: central.authority@naidisamet.ee.</p>\n<p>Küsi lisa: sotsiaal.osakond@naidisvald.ee</p>\n<p>Juhendaja aadress on zenta@naidisliit.ee.</p>\n<p>Kirjuta mari.tammsalu@naidisamet.ee</p>`), meta: meta() }, context);
  assert.deepEqual([chosen.keep, chosen.removed.units], [true, 2]);
  assert.match(chosen.html, /central\.authority@naidisamet\.ee/u); assert.match(chosen.html, /sotsiaal\.osakond@naidisvald\.ee/u);
  for (const gone of ['zenta@', 'mari.tammsalu@']) assert.equal(chosen.html.includes(gone), false, gone);
});

test('a paragraph that names a person is taken out and the page stays', () => {
  const html = stored([`<h1>Mis on haigus</h1>`, `<p>${filler}</p>`, `<p>Mari Tammsalu</p>`, `<h2>Ravi</h2>`, `<p>${filler}</p>`,
    `<ul><li>Vaata ka: Kask, Zuzzu Brenkmann (2021) Uurimus haigusest.</li><li>Liikumine aitab.</li></ul>`, `<p>Kirjuta meile: info@naidisliit.ee või naidisliit@gmail.com.</p>`,
    `<p>Küsimustele vastab [e-post eemaldatud] tööpäeviti.</p>`, `<p>Juhendaja aadress on zenta@naidisliit.ee.</p>`].join('\n'));
  const chosen = selectPage({ html, meta: meta() }, context);
  assert.equal(chosen.keep, true);
  assert.deepEqual(chosen.removed, { units: 4, words: 2 + 8 + 5 + 4, sections: 0 });
  for (const gone of ['Tammsalu', 'Brenkmann', 'eemaldatud', 'zenta@']) assert.equal(chosen.html.includes(gone), false, gone);
  // The organisation's own addresses stay: a general one, and one named after the site.
  assert.match(chosen.html, /info@naidisliit\.ee või naidisliit@gmail\.com/u);
  assert.match(chosen.html, /<ul><li>Liikumine aitab\.<\/li><\/ul>/u);
  assert.equal(chosen.sourceSha256, createHash('sha256').update(chosen.html).digest('hex'));
  assert.equal(chosen.words, chosen.html.replace(/<title>[^<]*<\/title>/u, '').replace(/<[^>]+>/gu, ' ').trim().split(/\s+/u).length);
  // The metadata says what the choice did; the collector's content hash stays for the next reading's comparison.
  const placed = chosenMetadata({ ...meta(), content_sha256: 'as-read', source_sha256: 'as-collected' }, chosen);
  assert.deepEqual([placed.content_sha256, placed.source_sha256, placed.selection],
    ['as-read', chosen.sourceSha256, { rule: WEB_SELECTION, words: chosen.words, paragraphs_taken_out: 4, sections_taken_out: 0, words_taken_out: 19 }]);
  // A page that names no one comes back as it was.
  const plainPage = stored(`<h1>Mis on haigus</h1>\n<p>${filler}</p>\n<p>${filler}</p>`);
  assert.equal(selectPage({ html: plainPage, meta: meta() }, context).html, plainPage);
});

test('under a heading that names a person the whole section goes, and what it leaves empty', () => {
  const html = stored([`<h1>Meie tegevus</h1>`, `<p>${filler}</p>`, `<p>${filler}</p>`, `<h2>Nõustamine</h2>`, `<h3>Kohtumine notar Mari Tammsaluga</h3>`, `<p>Kohtumine toimub saalis.</p>`, `<ul><li>Tule kohale.</li></ul>`,
    `<h3>Tugigrupp</h3>`, `<p>${filler}</p>`, `<h2>Lektorid</h2>`, `<ul><li>Jaan Tammsalu</li></ul>`, `<h2>Kuidas liituda</h2>`, `<p>${filler}</p>`].join('\n'), 'Näidisliit: Meie tegevus');
  const chosen = selectPage({ html, meta: meta('https://naidisliit.ee/tegevus', { title: 'Näidisliit: Meie tegevus' }) }, context);
  assert.equal(chosen.keep, true);
  assert.deepEqual({ units: chosen.removed.units, sections: chosen.removed.sections }, { units: 2, sections: 1 });
  for (const gone of ['notar', 'toimub saalis', 'Tule kohale', 'Lektorid', 'Jaan']) assert.equal(chosen.html.includes(gone), false, gone);
  // The section's sibling and the heading above them stay.
  assert.match(chosen.html, /<h2>Nõustamine<\/h2>\n<h3>Tugigrupp<\/h3>/u);
  assert.match(chosen.html, /<h2>Kuidas liituda<\/h2>/u);
});

test('a page is left out whole when it is mostly about persons, by what it is, or when little is left', () => {
  const why = (body, about = meta(), more = {}) => { const result = selectPage({ html: stored(body), meta: about }, { ...context, ...more }); return result.keep ? 'kept' : result.why; };
  const page = `<h1>Mis on haigus</h1>\n<p>${filler}</p>\n<p>${filler}</p>`;
  assert.equal(why(page), 'kept');
  // A quarter of the words, many paragraphs, or several lines that are nothing but a name.
  assert.equal(why(`<h1>Lood</h1>\n<p>${filler}</p>\n<p>Mari Tammsalu jutustab: ${filler}</p>`), 'mostly about persons');
  assert.equal(why(`${page}\n<p>${filler}</p>\n<p>${filler}</p>\n<ul>${'<li>Mari Tammsalu</li>'.repeat(4)}</ul>`), 'mostly about persons');
  assert.equal(why(`<h1>Mari Tammsalu</h1>\n<p>${filler}</p>\n<p>${filler}</p>`), 'its own heading names a person');
  // By its address or title, the list's own pattern included.
  assert.match(why(page, meta('https://naidisliit.ee/foorum')), /^by what it is/u);
  assert.match(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Tegevuskava' })), /^by what it is/u);
  assert.match(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Toetused ja soodustused' }), { leaveOut: /Toetused ja soodustused/iu }), /^by what it is/u);
  // Donors' pages go; a page written to the one who supports somebody stays.
  assert.match(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Meie toetajad' })), /^by what it is/u);
  assert.equal(why(page, meta('https://naidisliit.ee/soovitused-leinaja-toetajale', { title: 'Näidisliit: Soovitused leinaja toetajale' })), 'kept');
  assert.equal(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Abimaterjal lähedastele ja nende toetajatele' })), 'kept');
  // A page of a list of posts is titled with its number.
  assert.match(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: 67' })), /^by what it is/u);
  // Dated by title or address; the year at hand is not an earlier one, and a date in the text is not a sign.
  assert.match(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Uuring 2024' })), /^dated/u);
  assert.match(why(page, meta('https://naidisliit.ee/avaleht/2026-01-ara-lase')), /^dated/u);
  assert.match(why(page, meta('https://naidisliit.ee/2023-aasta-kokkuvote')), /^dated/u);
  assert.equal(why(page, meta('https://naidisliit.ee/leht', { title: 'Näidisliit: Hinnakiri aastal 2026' })), 'kept');
  assert.equal(why(`${page}\n<p>Postitatud 2019-03-04T10:15 ja kehtib endiselt.</p>`), 'kept');
  // What the page is not.
  assert.equal(why(`<h1>Leht</h1>\n<p>See domeen on registreeritud. ${filler}</p>`), 'a parked domain');
  assert.equal(why(page, meta(undefined, { collection: { warnings: ['rendered_by_script'] } })), 'rendered by script');
  assert.equal(why('<h1>Kontakt</h1>\n<p>Asume Tartus, oleme avatud tööpäeviti.</p>'), 'under 30 words');
  assert.equal(why(page, meta(undefined, { collection: { warnings: ['content_region_not_marked'] } })), 'no marked content region and under 80 words');
  // A name in text that stands in no paragraph of its own cannot be taken out: the page goes.
  assert.equal(why(`${page}\n<ul><li>Meie lektor Mari Tammsalu<ul><li>${filler}</li></ul></li></ul>`), 'a person named outside a paragraph');
  assert.equal(selectPage({ html: '<p>ei ole kogutud leht</p>', meta: meta() }, context).why, 'not a collected page');
});
