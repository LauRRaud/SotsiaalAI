import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { DEFAULT_CONFIG, hash, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';
import { xmlSections } from '../lib/rag-v2/text-source.js';
import { checkTurn, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

// ADR-076: a registered source may be named sections of a Riigi Teataja act. The State Budget Act of 2026 is 4 MB of
// budget tables (§ 1); its § 2 sets the national rates other acts refer to, among them the subsistence level. The file
// is read from Andmebaasi as committed; no network.
const BUDGET = '103072026024', MARJAMAA = '401092026014', tenant = 'xml-sections-test';
const rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-xml-sections-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-xml-sections-'));
  await fs.rm(target, { recursive: true, force: true });
});
async function registry(name, act, extra = {}) {
  const dir = path.join(root, name), file = `oigusaktid/${act}.xml`;
  await fs.mkdir(path.join(dir, 'oigusaktid'), { recursive: true });
  const bytes = await fs.readFile(path.join('Andmebaasi', file));
  await fs.writeFile(path.join(dir, file), bytes);
  const entry = { role: 'source', path: file, sha256: hash(bytes), ...extra };
  await fs.writeFile(path.join(dir, 'REGISTER.json'), JSON.stringify({ entries: [entry] }));
  return { dir, entry };
}
const read = async ({ dir, entry }) => (await ingest({ tenant, inputRoot: dir, metadataJson: stable(await registeredSource(dir, entry)), storeRoot: path.join(dir, 'store'), rights, profile })).bundle;

test('the committed register names § 2 of the State Budget Act, and the file is Riigi Teataja\'s own bytes', async () => {
  const register = JSON.parse(await fs.readFile('Andmebaasi/REGISTER.json', 'utf8'));
  const entry = register.entries.find(item => item.path === `oigusaktid/${BUDGET}.xml`);
  assert.deepEqual([entry.role, entry.xml_sections, entry.xml_units, entry.original_path], ['source', ['2'], 'point', `riigiteataja.ee/et/akt/${BUDGET}.xml`]);
  assert.equal(hash(await fs.readFile(path.join('Andmebaasi', entry.path))), entry.sha256);
  // No other registered source selects sections: every other act is read whole, as before.
  assert.deepEqual(register.entries.filter(item => item.xml_sections !== undefined).map(item => item.path), [entry.path]);
});

test('only the selected section is read; identity, validity and jurisdiction are the act\'s own', async () => {
  const source = await registry('budget', BUDGET, { xml_sections: ['2'] });
  const metadata = await registeredSource(source.dir, source.entry);
  assert.deepEqual(metadata.source_selector, { xml_sections: ['2'] });
  assert.deepEqual([metadata.document_id, metadata.title, metadata.authority, metadata.jurisdiction_level, metadata.valid_from, metadata.valid_to],
    [`riigiteataja:${BUDGET}`, '2026. aasta riigieelarve seadus', 'Riigikogu', 'national', '2026-07-13+03:00', '2026-12-31+02:00']);
  const bundle = await read(source);
  assert.deepEqual(bundle.source_units.map(unit => unit.locator.path), ['/oigusakt[1]/sisu[1]/paragrahv[2]']);
  assert.deepEqual([...new Set(bundle.sections.map(section => section.title).filter(Boolean))], ['§ 2. Seadustest tulenevate määrade ja piirsummade kehtestamine']);
  const text = bundle.chunks.map(chunk => chunk.source_text).join('\n');
  // Riigi Teataja writes a no-break space between a number and its unit.
  assert.match(text, /üksi elava isiku või perekonna esimese liikme toimetulekupiir\s220\seurot\skalendrikuus/u);
  // Nothing of the budget tables (§ 1) or of the other sections.
  assert(!/Riigieelarve vahendid|tasandus- ja toetusfondi|Kaitsekulu/u.test(text));
  assert(bundle.chunks.length <= 6 && text.length < 9000, `${bundle.chunks.length} chunks, ${text.length} characters`);
  // The section is one legal unit cut by size, as in every act: the passage with the amount carries the section's
  // heading, and the subsection's opening words ("Sotsiaalhoolekande seaduse alusel ...") are in the passage before it.
  const at = bundle.chunks.findIndex(chunk => /toimetulekupiir\s220\seurot/u.test(chunk.source_text));
  assert.match(JSON.stringify(bundle.chunks[at].section_path), /§ 2\. Seadustest tulenevate määrade/u);
  assert(at > 0 && /Sotsiaalhoolekande seaduse alusel kehtestatavad määrad/u.test(bundle.chunks[at - 1].source_text) && bundle.chunks[at].previous_id === bundle.chunks[at - 1].id);
  assert.deepEqual([bundle.document.fields.source_type.value, bundle.document.fields.valid_from.value, bundle.document.fields.valid_to.value],
    ['legal_act', '2026-07-13', '2026-12-31']);
});

test('without the selection the same file is refused whole: the tables are over the text limit', async () => {
  const source = await registry('whole', BUDGET);
  await assert.rejects(read(source), error => error.code === 'text_limit');
});

test('a section the act does not have and a malformed selection are errors, not an empty or a whole source', async () => {
  const missing = await registry('missing', BUDGET, { xml_sections: ['2', '99'] });
  await assert.rejects(read(missing), error => error.code === 'xml_section_not_found');
  for (const [name, bad] of [['empty', []], ['words', ['§ 2']], ['number', [2]], ['twice', ['2', '2']], ['text', '2']]) {
    const source = await registry(`bad-${name}`, BUDGET, { xml_sections: bad });
    await assert.rejects(registeredSource(source.dir, source.entry), error => error.code === 'invalid_source_selector', name);
  }
  assert.equal(xmlSections({}), null);
  assert.deepEqual(xmlSections({ source_selector: { xml_sections: ['15¹', '2'] } }), ['15¹', '2']);
});

// The two paid turns of 04.10.2026 on corpus v49 (the owner's permission): the catalogue's checks on what the run recorded
// and on what the same questions recorded in the live questionnaire before v49 (docs/audits/evidence/live-questionnaire-2026-10-04.json).
test('the measured turns pass the national sources catalogue; the records of Q9 and Q12 before v49 do not', async () => {
  const catalogue = JSON.parse(await fs.readFile('tests/evaluation/dialogue/scenarios-national-sources-1.json', 'utf8'));
  assert.deepEqual(validateCatalogue(catalogue), []);
  const run = JSON.parse(await fs.readFile('docs/audits/evidence/national-sources-measured-2026-10-04.json', 'utf8'));
  assert.deepEqual([run.turns.length, run.summary.passed, run.plan_price_usd], [2, 2, 0.01035]);
  const today = '2026-10-04', periods = new Map();
  const sources = list => list.map(source => {
    if (source.in_force) { const [from, to] = source.in_force.split('..'); periods.set(source.rt, { from, to: to === 'open' ? null : to }); }
    return { title: source.title, documentId: source.rt ?? source.title };
  });
  const observed = extra => ({ state: 'completed', region: null, summaries: [], details: [], contacts: 0, ...extra });
  const verdict = (expect, turn) => checkTurn(expect, turn, { today, validity: id => periods.get(id) || null });
  for (const [index, scenario] of catalogue.scenarios.entries()) {
    const measured = run.turns[index], expect = scenario.turns[0].expect;
    assert.deepEqual([measured.scenario, measured.text, measured.verdict, measured.checks], [scenario.id, scenario.turns[0].text, 'passed', 7]);
    const found = sources(measured.found_legal_acts), cited = sources(measured.cited);
    const now = verdict(expect, observed({ evidenceTitles: [...found.map(source => source.title), ...measured.found_other_titles], found, cited, text: measured.answer }));
    assert.deepEqual([now.verdict, now.checks.length], ['passed', 7], scenario.id);
  }
  // The amount the State Budget Act sets, and the two the answer made of it with the Social Welfare Act's shares.
  assert.match(run.turns[0].answer, /220 eurot[^.]*\.[^.]*176 eurot[^.]*264 eurot/u);
  assert.deepEqual(run.turns.map(turn => turn.cited.filter(source => source.national).map(source => source.rt)), [['103072026024', '130062026065'], ['130062026020']]);
  // Before v49: the Social Welfare Act alone and no amount (Q9); a study and no act (Q12).
  const law = sources([{ title: 'Sotsiaalhoolekande seadus', rt: '130062026065', in_force: '2026-10-01..2026-11-30' }]);
  const failed = result => result.checks.filter(check => !check.ok).map(check => check.key);
  assert.deepEqual(failed(verdict(catalogue.scenarios[0].turns[0].expect, observed({ evidenceTitles: ['Sotsiaalhoolekande seadus'], found: law, cited: law,
    text: 'Üksi elava inimese ja pere esimese liikme toimetulekupiiri kehtestab Riigikogu igaks eelarveaastaks riigieelarvega. Ma ei saa siin öelda toimetulekupiiri täpset eurodes suurust, sest kasutatud teave ei anna kehtivat summat.' }))),
  ['evidence', 'cited', 'must', 'found_valid_on']);
  const study = [{ title: 'Täisealiste puudega inimeste puude tuvastamise ja toetuste ning hüvede võimaliku nüüdisajastamise uuring', documentId: 'study' }];
  assert.deepEqual(failed(verdict(catalogue.scenarios[1].turns[0].expect, observed({ evidenceTitles: ['Sotsiaalhoolekande seadus', study[0].title], found: [...law, ...study], cited: study,
    text: 'Kui küsid tööealise täisealise kohta, saab ta esitada ühise töövõime hindamise ja puude raskusastme tuvastamise taotluse. Töötukassa ekspertarst hindab tervise infosüsteemi andmete põhjal inimese tegutsemis- ja osalemispiiranguid.' }))),
  ['evidence', 'cited', 'must', 'found_valid_on']);
});

test('an act without a selection is read as before; a selection on it reads that section with its own notes only', async () => {
  const whole = await read(await registry('act-whole', MARJAMAA)), part = await read(await registry('act-part', MARJAMAA, { xml_sections: ['3'] }));
  assert(whole.source_units.length > 3);
  const third = whole.source_units.find(unit => unit.locator.path === '/oigusakt[1]/sisu[1]/paragrahv[3]');
  assert.deepEqual(part.source_units.map(unit => [unit.locator.path, unit.raw_text, unit.amendments ?? null]), [[third.locator.path, third.raw_text, third.amendments ?? null]]);
  // The act's history stays; notes on what was not read are not this source's.
  const legal = bundle => bundle.document.fields.legal_text.value;
  assert.deepEqual(legal(part).history, legal(whole).history);
  assert.deepEqual(legal(part).structure, []);
  assert(DEFAULT_CONFIG.maxTextChars < 4000000);
});

// ADR-082: the register may ask a selected section to be read subsection by subsection (xml_units: "subsection").
test('ADR-082: read by subsection, the passage with the amount is the whole of its subsection, opening words and all', async () => {
  const source = await registry('budget-units', BUDGET, { xml_sections: ['2'], xml_units: 'subsection' });
  const metadata = await registeredSource(source.dir, source.entry);
  assert.deepEqual(metadata.source_selector, { xml_sections: ['2'], xml_units: 'subsection' });
  const bundle = await read(source);
  assert.deepEqual(bundle.source_units.map(unit => unit.locator.path), Array.from({ length: 9 }, (_, index) => `/oigusakt[1]/sisu[1]/paragrahv[2]/loige[${index + 1}]`));
  assert.deepEqual([...new Set(bundle.sections.map(section => section.title).filter(Boolean))], ['§ 2. Seadustest tulenevate määrade ja piirsummade kehtestamine']);
  // Before: the section was one unit cut by length, the amount in a passage that began in the middle of the list and
  // the subsection's opening words in the passage before it.
  const amount = bundle.chunks.filter(chunk => /toimetulekupiir\s220\seurot/u.test(chunk.source_text));
  assert.equal(amount.length, 1);
  assert.match(amount[0].source_text, /^\(5\)\s+Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:/u);
  assert.match(amount[0].retrieval_text, /> § 2\. Seadustest tulenevate määrade ja piirsummade kehtestamine\n\n\(5\) Sotsiaalhoolekande seaduse alusel/u);
  // Each subsection is passages of its own: only the long subsection 7 is cut, and no passage holds two subsections.
  const subsection = chunk => bundle.source_units.find(unit => unit.raw_text.includes(chunk.source_text)).locator.path.match(/loige\[(\d+)\]$/u)[1];
  assert.deepEqual(bundle.chunks.map(subsection), ['1', '2', '3', '4', '5', '6', '7', '7', '8', '9']);
  // The same file and section without the field is another version of the document, read as before: one unit.
  const plain = await read(await registry('budget-plain', BUDGET, { xml_sections: ['2'] }));
  assert.deepEqual([plain.source_units.length, plain.version.id === bundle.version.id, plain.document.id === bundle.document.id], [1, false, true]);
  // The field stands only beside a selection of sections and has one value.
  for (const [name, extra] of [['alone', { xml_units: 'subsection' }], ['other', { xml_sections: ['2'], xml_units: 'sentence' }], ['flag', { xml_sections: ['2'], xml_units: true }]]) {
    const bad = await registry(`units-${name}`, BUDGET, extra);
    await assert.rejects(registeredSource(bad.dir, bad.entry), error => error.code === 'invalid_source_selector', name);
  }
  // A municipal act's section with a note: the note stands in the subsection that holds its provision, at the same place.
  const whole = await read(await registry('act-whole-units', MARJAMAA)), part = await read(await registry('act-part-units', MARJAMAA, { xml_sections: ['3'], xml_units: 'subsection' }));
  const third = whole.source_units.find(unit => unit.locator.path === '/oigusakt[1]/sisu[1]/paragrahv[3]');
  assert.deepEqual(part.source_units.map(unit => unit.locator.path), [1, 2, 3].map(number => `${third.locator.path}/loige[${number}]`));
  assert(part.source_units.every(unit => third.raw_text.includes(unit.raw_text)));
  assert.deepEqual([third.amendments.length, third.amendments[0].offset], [1, third.raw_text.length]);
  const note = ({ offset: _offset, path: _path, ...rest }) => rest;
  assert.deepEqual(part.source_units.map(unit => (unit.amendments || []).map(item => [note(item), item.offset === unit.raw_text.length])), [[], [], [[note(third.amendments[0]), true]]]);
});

test('ADR-082 on a made-up act: by subsection only where the section\'s whole text stands in subsections; a repealed subsection is left out, its note listed', async () => {
  const { parseTextSource } = await import('../lib/rag-v2/text-source.js');
  const mark = (words, rt) => `<muutmismarge><aktikuupaev>2025-05-20</aktikuupaev><avaldamismarge><RTosa>RT I</RTosa><avaldamineKuupaev>2025-06-01</avaldamineKuupaev><RTartikkel>${rt}</RTartikkel><aktViide>10106202500${rt}</aktViide></avaldamismarge><joustumine>2025-07-01</joustumine><tavatekst>${words}</tavatekst></muutmismarge>`;
  const sub = (number, body) => `<loige><loigeNr>${number}</loigeNr><kuvatavNr>(${number})</kuvatavNr><sisuTekst>${body}</sisuTekst></loige>`;
  const section = (number, title, body) => `<paragrahv><paragrahvNr>${number}</paragrahvNr><kuvatavNr>§ ${number}.</kuvatavNr><paragrahvPealkiri>${title}</paragrahvPealkiri>${body}</paragrahv>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<oigusakt><metaandmed><valjaandja>Riigikogu</valjaandja><dokumentLiik>seadus</dokumentLiik><globaalID>100000000001</globaalID>
<kehtivus><kehtivuseAlgus>2026-01-01</kehtivuseAlgus></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Näidisseadus</pealkiri></nimi></aktinimi><sisu>
${section(1, 'Määrad', mark('Pealkiri muudetud', 1) + sub(1, '<tavatekst>Esimene määr on 10 eurot.</tavatekst>') + sub(2, mark('Kehtetu -', 2))
    + sub(3, `<tavatekst>Kolmas määr on 30 eurot.</tavatekst>${mark('Määr muudetud', 3)}`))}
${section(2, 'Lõigeteta', '<sisuTekst><tavatekst>Selle paragrahvi tekst ei seisa lõigetes.</tavatekst></sisuTekst>')}
${section(3, 'Üks lõige', sub(1, '<tavatekst>Ainus lõige.</tavatekst>'))}
</sisu></oigusakt>`;
  const read = selector => parseTextSource(Buffer.from(xml), 'xml', { title: 'Näidisseadus', ...(selector ? { source_selector: selector } : {}) }, { tenant_id: tenant, document_version_id: 'made-up' }, DEFAULT_CONFIG);
  const paths = result => result.structured.source_units.map(unit => unit.locator.path.replace('/oigusakt[1]/sisu[1]/', ''));
  const all = ['1', '2', '3'], selected = read({ xml_sections: all, xml_units: 'subsection' });
  // § 1 by subsection, without the repealed one; § 2 (text outside subsections) and § 3 (one subsection) whole.
  assert.deepEqual(paths(selected), ['paragrahv[1]/loige[1]', 'paragrahv[1]/loige[3]', 'paragrahv[2]', 'paragrahv[3]']);
  const [first, third] = selected.structured.source_units;
  assert.deepEqual([first.raw_text, first.amendments ?? null], ['(1)\n\nEsimene määr on 10 eurot.', null]);
  assert.deepEqual([third.raw_text, third.amendments.map(item => [item.provision, item.act_reference, item.offset])], ['(3)\n\nKolmas määr on 30 eurot.', [['§ 1 lg 3', '101062025003', third.raw_text.length]]]);
  // The notes outside the subsections that were read (the title's, the repealed subsection's) are listed, not dropped.
  assert.deepEqual(selected.parsed.legal_text.structure.map(item => [item.target, item.act_reference, item.repeal ?? false]), [['§ 1', '101062025001', false], ['§ 1 lg 2', '101062025002', true]]);
  // The selection alone, and no selection: every section is one unit, as before, the repealed subsection's word in its text.
  for (const result of [read({ xml_sections: all }), read(null)]) {
    assert.deepEqual(paths(result), ['paragrahv[1]', 'paragrahv[2]', 'paragrahv[3]']);
    assert.match(result.structured.source_units[0].raw_text, /\(2\)\s+Kehtetu\./u);
    assert.equal(result.structured.source_units[0].amendments.length, 3);
  }
  assert.throws(() => read({ xml_units: 'subsection' }), error => error.code === 'invalid_source_selector');
});

// ADR-083. Measured on corpus v50 (04.10.2026, docs/audits/evidence/corpus-v50-measured-2026-10-04.json): read by
// subsection, the State Budget Act's candidate for "Kui suur on toimetulekupiir ...?" was subsection 4 (the unemployment
// allowance's daily rate), not subsection 5: there the subsistence level is the fifth of six rates, after four on
// special care services.
test('ADR-083: a subsection that is a list is read point by point, its opening words as the heading; the amount is a passage of its own', async () => {
  const source = await registry('budget-points', BUDGET, { xml_sections: ['2'], xml_units: 'point' });
  assert.deepEqual((await registeredSource(source.dir, source.entry)).source_selector, { xml_sections: ['2'], xml_units: 'point' });
  const bundle = await read(source);
  // Five subsections are lists (5, 6, 8 and 3 points, and subsection 1 with 5); the four others are one unit each.
  const place = unit => unit.locator.path.replace('/oigusakt[1]/sisu[1]/paragrahv[2]/', '');
  const count = {};
  for (const unit of bundle.source_units) { const [, subsection, point] = place(unit).match(/^loige\[(\d+)\](\/alampunkt\[\d+\])?$/u); count[subsection] = (count[subsection] || 0) + (point ? 1 : 0); }
  assert.deepEqual(count, { 1: 5, 2: 0, 3: 0, 4: 0, 5: 6, 6: 0, 7: 8, 8: 3, 9: 0 });
  assert.deepEqual([bundle.source_units.length, bundle.chunks.length], [27, 27]);
  const amount = bundle.chunks.filter(chunk => /toimetulekupiir\s220\seurot/u.test(chunk.source_text));
  assert.equal(amount.length, 1);
  // The passage is the one point; which act's rate it is stands in its heading, the subsection's opening words.
  assert.match(amount[0].source_text, /^5\)\s+seaduse § 131 lõike 3 alusel kehtestatav üksi elava isiku või perekonna esimese liikme toimetulekupiir\s220\seurot\skalendrikuus;$/u);
  assert.match(amount[0].retrieval_text, /> § 2\. Seadustest tulenevate määrade ja piirsummade kehtestamine > \(5\) Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:\n\n5\) seaduse § 131/u);
  assert.deepEqual(amount[0].section_path.at(-1), '§ 2. Seadustest tulenevate määrade ja piirsummade kehtestamine > (5) Sotsiaalhoolekande seaduse alusel kehtestatavad määrad on järgmised:');
  // A subsection that is no list is one passage under the section's heading, as read by subsection.
  const parental = bundle.chunks.find(chunk => /vanemahüvitise määr/u.test(chunk.source_text));
  assert.deepEqual([parental.section_path.at(-1), /^\(3\)\s+Perehüvitiste seaduse/u.test(parental.source_text)], ['§ 2. Seadustest tulenevate määrade ja piirsummade kehtestamine', true]);
  // Nothing of the section's text is lost: every subsection's own text is its opening words and its points.
  const bySubsection = await read(await registry('budget-subsections', BUDGET, { xml_sections: ['2'], xml_units: 'subsection' }));
  const squeeze = value => value.replace(/\s+/gu, ' ').trim();
  for (const whole of bySubsection.source_units) {
    const parts = bundle.source_units.filter(unit => unit.locator.path.startsWith(whole.locator.path));
    const lead = bundle.sections.find(section => section.id === bundle.chunks.find(chunk => chunk.source_text === parts[0].raw_text).parent_section_id).title.split(' > ')[1];
    assert.equal(squeeze([lead, ...parts.map(unit => unit.raw_text)].filter(Boolean).join(' ')), squeeze(whole.raw_text), whole.locator.path);
  }
});

test('ADR-083 on a made-up act: a list is read by point only where the subsection ends in its points; a note stays with its point', async () => {
  const { parseTextSource } = await import('../lib/rag-v2/text-source.js');
  const mark = (words, rt) => `<muutmismarge><aktikuupaev>2025-05-20</aktikuupaev><avaldamismarge><RTosa>RT I</RTosa><avaldamineKuupaev>2025-06-01</avaldamineKuupaev><RTartikkel>${rt}</RTartikkel><aktViide>10106202500${rt}</aktViide></avaldamismarge><joustumine>2025-07-01</joustumine><tavatekst>${words}</tavatekst></muutmismarge>`;
  const point = (number, body) => `<alampunkt><alampunktNr>${number}</alampunktNr><kuvatavNr>${number})</kuvatavNr><sisuTekst>${body}</sisuTekst></alampunkt>`;
  const sub = (number, body) => `<loige><loigeNr>${number}</loigeNr><kuvatavNr>(${number})</kuvatavNr>${body}</loige>`;
  const words = text => `<sisuTekst><tavatekst>${text}</tavatekst></sisuTekst>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<oigusakt><metaandmed><valjaandja>Riigikogu</valjaandja><dokumentLiik>seadus</dokumentLiik><globaalID>100000000002</globaalID>
<kehtivus><kehtivuseAlgus>2026-01-01</kehtivuseAlgus></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Näidisseadus</pealkiri></nimi></aktinimi><sisu>
<paragrahv><paragrahvNr>1</paragrahvNr><kuvatavNr>§ 1.</kuvatavNr><paragrahvPealkiri>Määrad</paragrahvPealkiri>
${sub(1, words('Esimese seaduse määrad on järgmised:') + point(1, '<tavatekst>toetus on 10 eurot;</tavatekst>') + point(2, mark('Kehtetu -', 1)) + point(3, `<tavatekst>piirmäär on 30 eurot.</tavatekst>${mark('Määr muudetud', 2)}`))}
${sub(2, words('Üks määr on 40 eurot.'))}
${sub(3, words('Loetelu, mille järel on tekst:') + point(1, '<tavatekst>üks;</tavatekst>') + point(2, '<tavatekst>kaks.</tavatekst>') + words('Lõpulause.'))}
${sub(4, words('Ühe punktiga loetelu:') + point(1, '<tavatekst>ainus.</tavatekst>'))}
</paragrahv></sisu></oigusakt>`;
  const read = units => parseTextSource(Buffer.from(xml), 'xml', { title: 'Näidisseadus', source_selector: { xml_sections: ['1'], ...(units ? { xml_units: units } : {}) } },
    { tenant_id: tenant, document_version_id: 'made-up-points' }, DEFAULT_CONFIG);
  const paths = result => result.structured.source_units.map(unit => unit.locator.path.replace('/oigusakt[1]/sisu[1]/paragrahv[1]', '') || '/');
  const byPoint = read('point');
  // Subsection 1 by point, without the repealed one; 2 (no list), 3 (text after the points) and 4 (one point) whole.
  assert.deepEqual(paths(byPoint), ['/loige[1]/alampunkt[1]', '/loige[1]/alampunkt[3]', '/loige[2]', '/loige[3]', '/loige[4]']);
  const [first, third] = byPoint.structured.source_units;
  assert.deepEqual([first.raw_text, third.raw_text], ['1)\n\ntoetus on 10 eurot;', '3)\n\npiirmäär on 30 eurot.']);
  assert.deepEqual(third.amendments.map(item => [item.provision, item.act_reference, item.offset]), [['§ 1 lg 1 p 3', '101062025002', third.raw_text.length]]);
  const titles = byPoint.structured.sections.map(section => section.title).filter(Boolean);
  assert.deepEqual([...new Set(titles)], ['§ 1. Määrad > (1) Esimese seaduse määrad on järgmised:', '§ 1. Määrad']);
  // The repealed point's note is listed with the notes outside the text.
  assert.deepEqual(byPoint.parsed.legal_text.structure.map(item => [item.target, item.act_reference, item.repeal ?? false]), [['§ 1 lg 1 p 2', '101062025001', true]]);
  // By subsection and with the selection alone the same section is four units and one.
  assert.deepEqual([paths(read('subsection')), paths(read(null))], [['/loige[1]', '/loige[2]', '/loige[3]', '/loige[4]'], ['/']]);
});
