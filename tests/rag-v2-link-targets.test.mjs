import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { DEFAULT_CONFIG, hash } from '../lib/rag-v2/contracts.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';

// ADR-090: a link in a Riigi Teataja act (viide) has its visible words and its target. Until source-structure-v30 the
// target stood in the section's text as a line of its own ("./dyn=<this version's number>&id=<the linked act's>"),
// in what the answer model reads and in the embedding input. Since v31 it is left out. The acts are read from
// Andmebaasi as committed; no network.
const read = (bytes, metadata = { title: 'Akt' }) => parseTextSource(bytes, 'xml', metadata, { tenant_id: 'link-targets-test', document_version_id: 'v' }, DEFAULT_CONFIG);
const texts = result => result.structured.source_units.map(unit => unit.raw_text);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('the Social Welfare Act: the visible words of a link stay where they were, its target is not in the text', async () => {
  const result = read(await fs.readFile('Andmebaasi/oigusaktid/103062026023.xml')), all = texts(result);
  // The reader of v30 gave this act 197 units with 55 targets in them.
  assert.equal(all.length, 197);
  assert.equal(all.filter(text => /dyn=|vaheleht\.html|viideUR/u.test(text)).length, 0);
  const ninth = all.find(text => text.includes('Juhtumiplaanis sisalduvate andmete loetelu'));
  assert.ok(ninth.includes('(6)\n\nJuhtumiplaanis sisalduvate andmete loetelu kehtestab\n\nvaldkonna eest vastutav minister\n\nmäärusega.'));
  // A link that opens a subsection, and one whose target is the intermediate page.
  assert.ok(all.some(text => text.includes('(3)\n\nValdkonna eest vastutav minister\n\nvõib kehtestada määrusega täpsustatud nõuded koduteenuse')));
  // What the act's own dates and notes say is read as before: the note of a provision still has its place in the text.
  const placed = result.structured.source_units.flatMap(unit => (unit.amendments || []).map(note => note.offset === null || note.offset <= unit.raw_text.length));
  assert.ok(placed.length > 100 && placed.every(Boolean));
});

test('an act without links reads byte for byte as before', async () => {
  // Põhja-Sakala's procedure has no link. The hash is that of its 45 units' text as source-structure-v30 read them,
  // recorded with the reader of commit f0f55684 before the change.
  const all = texts(read(await fs.readFile('Andmebaasi/oigusaktid/404072025051.xml')));
  assert.deepEqual([all.length, digest(all)], [45, '21faa07d52ea187acd6847e5367df1cd7821905892d7f336ce117e6f63067034']);
});

const link = (words, target, attributes = '') => `<viide${attributes}><kuvatavTekst><![CDATA[${words}]]></kuvatavTekst><viideURID${attributes}><viideURI${attributes}><![CDATA[${target}]]></viideURI></viideURID></viide>`;
const act = body => `<?xml version="1.0" encoding="UTF-8"?>
<oigusakt><metaandmed><valjaandja>Riigikogu</valjaandja><dokumentLiik>seadus</dokumentLiik><globaalID>100000000002</globaalID>
<kehtivus><kehtivuseAlgus>2026-01-01</kehtivuseAlgus></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Näidisseadus</pealkiri></nimi></aktinimi><sisu>
<paragrahv><paragrahvNr>1</paragrahvNr><kuvatavNr>§ 1.</kuvatavNr><paragrahvPealkiri>Kord</paragrahvPealkiri>${body}</paragrahv>
</sisu></oigusakt>`;
const sub = (number, content) => `<loige><loigeNr>${number}</loigeNr><kuvatavNr>(${number})</kuvatavNr><sisuTekst>${content}</sisuTekst></loige>`;
const NOTE = '<muutmismarge><aktikuupaev>2025-05-20</aktikuupaev><avaldamismarge><RTosa>RT I</RTosa><avaldamineKuupaev>2025-06-01</avaldamineKuupaev><RTartikkel>3</RTartikkel><aktViide>101062025003</aktViide></avaldamismarge><joustumine>2025-07-01</joustumine><tavatekst>Lõige muudetud</tavatekst></muutmismarge>';
const MADE_UP = act(sub(1, `<tavatekst>Korra kehtestab </tavatekst>${link('valdkonna eest vastutav minister', './dyn=100000000002&id=112022019005;112022019006')}<tavatekst> määrusega.</tavatekst>`)
  + sub(2, `${link('Vabariigi Valitsus', './../vaheleht.html')}<tavatekst> võib kehtestada täpsemad nõuded.</tavatekst>${NOTE}`)
  + sub(3, `<tavatekst>Teenust osutatakse </tavatekst>${link('sotsiaalhoolekande seaduse', './dyn=100000000002&id=113032019154!pr47lg2b1', ' id="9a9e8ac6"')}<tavatekst> § 47 lõike 2 alusel.</tavatekst>`));

test('a made-up act: every shape of target is left out, a note after a link keeps its place', () => {
  const result = read(Buffer.from(MADE_UP)), [unit] = result.structured.source_units;
  // This file has no line breaks between its elements, so a link's words stand on the line after the text before them.
  assert.equal(unit.raw_text, '§ 1.\n\nKord\n\n(1)\n\nKorra kehtestab\nvaldkonna eest vastutav minister\nmäärusega.\n\n(2)\nVabariigi Valitsus\nvõib kehtestada täpsemad nõuded.'
    + '\n\n(3)\n\nTeenust osutatakse\nsotsiaalhoolekande seaduse\n§ 47 lõike 2 alusel.');
  // The note of subsection 2 stands at the end of that subsection's words, as it would without any link before it.
  const [note] = unit.amendments;
  assert.deepEqual([note.provision, unit.raw_text.slice(0, note.offset).endsWith('võib kehtestada täpsemad nõuded.')], ['§ 1 lg 2', true]);
  // The passages and the embedding input are made of this text: no target reaches them.
  assert.ok(!/dyn=|vaheleht|!pr47/u.test(JSON.stringify(result.structured.spans.map(span => span.source_text))));
});

// A knowledge card's anchor is an exact quote at a place in a source unit (ADR-054). The cards of an act with links were
// anchored on the text that held the targets; the script moves each such anchor to where its quote stands now.
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-link-targets-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-link-targets-'));
  await fs.rm(target, { recursive: true, force: true });
});
const SOURCE = 'oigusaktid/100000000002.xml', CARD = 'teadmised/100000000002.knowledge.json';
const run = (...args) => {
  const result = spawnSync(process.execPath, ['scripts/rag-v2-knowledge-reanchor.mjs', ...args], { encoding: 'utf8' });
  return { status: result.status, out: result.status ? JSON.parse(result.stderr.trim()) : JSON.parse(result.stdout) };
};
async function fixture(name, anchors) {
  const dir = path.join(root, name), bytes = Buffer.from(MADE_UP);
  const write = async (file, text) => { await fs.mkdir(path.dirname(path.join(dir, file)), { recursive: true }); await fs.writeFile(path.join(dir, file), text); };
  await write(SOURCE, bytes);
  const card = `${JSON.stringify({ schema_version: 'rag-v2/registered-knowledge-1', source_path: SOURCE, source_sha256: hash(bytes),
    preparation: { schema_version: 'rag-v2/knowledge-preparation-1', verification_state: 'source_anchored_unreviewed' },
    knowledge: { cards: anchors.map((anchor, index) => ({ key: `c${index + 1}`, anchors: [{ source_unit_index: 0, ...anchor }] })), dependencies: [], gaps: [] } }, null, 2)}\n`;
  await write(CARD, card);
  await write('REGISTER.json', JSON.stringify({ entries: [{ path: SOURCE, role: 'source', sha256: hash(bytes) }, { path: CARD, role: 'knowledge', sha256: hash(Buffer.from(card)), source_path: SOURCE }] }));
  return dir;
}

test('a knowledge card follows a text that lost its link targets: the place is corrected, the quote is not touched', async () => {
  const text = read(Buffer.from(MADE_UP)).structured.source_units[0].raw_text;
  // The places as the text of v30 had them: each target stood after its link's words, with an empty line before it.
  const targets = ['./dyn=100000000002&id=112022019005;112022019006', './../vaheleht.html', './dyn=100000000002&id=113032019154!pr47lg2b1'];
  const earlier = (quote, linksBefore) => ({ quote, start: text.indexOf(quote) + targets.slice(0, linksBefore).reduce((sum, target) => sum + target.length + 2, 0) });
  const anchors = [earlier('Korra kehtestab', 0), earlier('määrusega.', 1), earlier('võib kehtestada täpsemad nõuded.', 2), earlier('§ 47 lõike 2 alusel.', 3)];
  const dir = await fixture('moved', anchors);
  assert.deepEqual(run('--input-root', dir).out.files, [{ path: CARD, changed: 0, moved: 3 }]);
  assert.equal(run('--input-root', dir, '--write').status, 0);
  const card = JSON.parse(await fs.readFile(path.join(dir, CARD), 'utf8'));
  assert.deepEqual(card.knowledge.cards.map(item => item.anchors[0]), anchors.map(anchor => ({ source_unit_index: 0, start: text.indexOf(anchor.quote), quote: anchor.quote })));
  assert.deepEqual(card.preparation.reanchored, [{ normalization: DEFAULT_CONFIG.normalization, reason: 'link_targets_removed', anchors: 3 }]);
  const register = JSON.parse(await fs.readFile(path.join(dir, 'REGISTER.json'), 'utf8'));
  assert.equal(register.entries[1].sha256, hash(await fs.readFile(path.join(dir, CARD))));
  // Moved once: a second run finds every quote at its place.
  assert.deepEqual(run('--input-root', dir).out.files, [{ path: CARD, changed: 0 }]);
});

test('an anchor is not moved to a quote found by chance, and a quote that is gone stops the script', async () => {
  const text = read(Buffer.from(MADE_UP)).structured.source_units[0].raw_text;
  // "kehtesta" stands in subsection 1 and in subsection 2. An anchor recorded 40 characters after the second one would
  // be moved back onto it, further than the anchor after it moves: the moves of one unit must grow with the places.
  const second = text.lastIndexOf('kehtesta'), last = text.indexOf('§ 47 lõike 2 alusel.');
  const dir = await fixture('chance', [{ quote: 'kehtesta', start: second + 40 }, { quote: '§ 47 lõike 2 alusel.', start: last + 5 }]);
  assert.equal(run('--input-root', dir, '--write').out.code, 'knowledge_anchor_move_inconsistent');
  const gone = await fixture('gone', [{ quote: 'seda lauset aktis ei ole', start: 30 }]);
  assert.equal(run('--input-root', gone, '--write').out.code, 'knowledge_anchor_changed_beyond_superscripts');
  // Nothing was written in either case.
  for (const folder of [dir, gone]) assert.equal(JSON.parse(await fs.readFile(path.join(folder, CARD), 'utf8')).preparation.reanchored, undefined);
});
