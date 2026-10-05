import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';
import { makeChunks } from '../lib/rag-v2/chunking.js';
import { actProvisions, compareProvisions, versionComparisons, versionChangesContext, VERSION_COMPARISON_VERSION, VERSION_CHANGES_TOKENS } from '../lib/rag-v2/search/version-comparison.js';
import { modelProjection, auditPacketBytes } from '../lib/rag-v2/search/model-context.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { DIALOGUE_PROMPT_VERSION, VERSION_CHANGES_INSTRUCTIONS, dialogueRequest } from '../lib/rag-v2/pilot/dialogue.js';

// ADR-088: the same provision in two versions of one act is compared on the server. The two versions of Põhja-Sakala's
// procedure for social welfare aid are read from Andmebaasi as committed (Riigi Teataja's own bytes); no network. In the
// turn measured on 04.10.2026 the answer presented § 5 lg 5 as new: the section is cut by length, and that subsection
// stands in the second passage of the older version and in the first of the newer one (ADR-077, finding F1).
const OLDER = '404072025051', NEWER = '403102026022', TITLE = 'Sotsiaalhoolekandelise abi osutamise kord';
const validity = { [OLDER]: ['2025-09-01', '2026-10-05'], [NEWER]: ['2026-10-06', null] };
async function version(rt) {
  const scope = { tenant_id: 'version-comparison-test', document_version_id: `version-${rt}` }, metadata = { title: TITLE };
  const { parsed, structured } = parseTextSource(await fs.readFile(`Andmebaasi/oigusaktid/${rt}.xml`), 'xml', metadata, scope, DEFAULT_CONFIG);
  const chunks = makeChunks({ ...structured, metadata, scope, versionId: `version-${rt}`, config: DEFAULT_CONFIG });
  return { document: { id: `document-${rt}`, fields: { legal_text: { value: parsed.legal_text } } }, version: { id: `version-${rt}` }, source_units: structured.source_units, chunks };
}
// An evidence entry as the search gives it, for one passage of a version.
const entryOf = (bundle, chunk, rt) => ({ evidence_id: `evidence-${rt}-${chunk.ordinal}`, document_id: bundle.document.id, document_version_id: bundle.version.id, chunk_id: chunk.id,
  unit_id: `unit-${rt}-${chunk.ordinal}`, span_ids: chunk.span_ids, pdf_pages: [], source_locations: chunk.source_locations, source_text: chunk.source_text,
  bibliography: { title: TITLE, authors: null, publication_date: null },
  source_metadata: { source_type: { value: 'legal_act' }, authority: { value: 'Põhja-Sakala Vallavolikogu' }, municipality_id: { value: 'pohja_sakala_vald' },
    valid_from: { value: validity[rt][0] }, valid_to: validity[rt][1] ? { value: validity[rt][1] } : { value: null, open_end: true } },
  limitations: [], selection: { reason: 'ranked_seed' } });
const ofSection = (bundle, number) => bundle.chunks.filter(chunk => chunk.section_path.some(title => new RegExp(`§ ${number}\\.`, 'u').test(title)));

test('an act is read provision by provision: every section, and every subsection where a section has them', async () => {
  const older = await version(OLDER), provisions = actProvisions(older);
  assert.equal(new Set(provisions.map(item => item.label)).size, provisions.length);
  const fifth = provisions.filter(item => item.section === '5');
  assert.deepEqual(fifth.map(item => item.label), ['§ 5', ...[1, 2, 3, 4, 5, 6, 7, 8].map(number => `§ 5 lg ${number}`)]);
  // The section's own provision is its number and title; a subsection holds its points.
  assert.equal(fifth[0].text, '§ 5. Sotsiaalhoolekandelise abi taotlemine');
  assert.match(fifth[2].text, /^\(2\) Taotluses tuleb märkida: 1\) taotleja ees- ja perekonnanimi/u);
  // A provision's place is where its words stand in the section's text.
  const unit = older.source_units.find(item => item.locator.path === fifth[5].path);
  assert.equal(unit.raw_text.slice(fifth[5].start, fifth[5].end).replace(/\s+/gu, ' '), fifth[5].text);
  // A section without subsections is one provision.
  assert.ok(provisions.some(item => !item.label.includes(' lg ') && provisions.filter(other => other.section === item.section).length === 1));
});

test('the two versions of the act: what changed, what was added, and that § 5 lg 5 reads the same', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)];
  const result = compareProvisions(actProvisions(older), actProvisions(newer));
  assert.deepEqual([result.changed.length, result.added.length, result.removed.length, result.renumbered.length, result.unchanged.length], [47, 12, 1, 0, 175]);
  // Repealed in the newer version, where its number still stands ("Kehtetu."); Riigi Teataja's note says the same.
  assert.deepEqual(result.removed, ['§ 22 lg 8']);
  assert.ok(newer.document.fields.legal_text.value.version_change.provisions.includes('§ 22 lg 8 (kehtetu)'));
  assert.ok(['§ 5', '§ 5 lg 2', '§ 5 lg 5', '§ 5 lg 6', '§ 5 lg 7', '§ 5 lg 8'].every(label => result.unchanged.includes(label)));
  assert.ok(['§ 5 lg 1', '§ 5 lg 3', '§ 5 lg 4'].every(label => result.changed.includes(label)));
  // The new version has a section the old one did not, and three new subsections elsewhere.
  assert.deepEqual(result.added.filter(label => !label.startsWith('§ 1¹')), ['§ 4 lg 6', '§ 22 lg 9', '§ 25 lg 7']);
  assert.equal(result.added.filter(label => label.startsWith('§ 1¹')).length, 9);
});

test('a subsection put into the middle of a section renumbers the ones after it; their words did not change', () => {
  const item = (label, text, section = '7') => ({ label, section, path: `/p[${section}]`, start: 0, end: text.length, text });
  const older = [item('§ 7 lg 1', '(1) Esimene.'), item('§ 7 lg 2', '(2) Teine lause jääb samaks.'), item('§ 7 lg 3', '(3) Kolmas jääb samuti.'), item('§ 8', 'Sama tekst kahes paragrahvis.', '8')];
  const newer = [item('§ 7 lg 1', '(1) Esimene, muudetud.'), item('§ 7 lg 2', '(2) Uus teine.'), item('§ 7 lg 3', '(3) Teine lause jääb samaks.'), item('§ 7 lg 4', '(4) Kolmas jääb samuti.'),
    item('§ 9', 'Sama tekst kahes paragrahvis.', '9')];
  // By number alone lg 2 and lg 3 would read as changed and lg 4 as added. The same words in another section are another
  // provision: § 8 is removed and § 9 added.
  assert.deepEqual(compareProvisions(older, newer), { changed: ['§ 7 lg 1'], added: ['§ 7 lg 2', '§ 9'], removed: ['§ 8'],
    renumbered: [{ label: '§ 7 lg 3', was: '§ 7 lg 2' }, { label: '§ 7 lg 4', was: '§ 7 lg 3' }], unchanged: [] });
});

test('a repealed subsection keeps its number without its words: it is removed, not changed or renumbered', () => {
  const item = (label, text) => ({ label, section: '13¹', path: '/p', start: 0, end: text.length, text });
  const older = [item('§ 13¹ lg 1', '(1) Toetust on õigus saada.'), item('§ 13¹ lg 2', '(2) Taotlus esitatakse.'), item('§ 13¹ lg 3', '(3) Kehtetu.'), item('§ 13¹ lg 4', '(4) Kehtetu.')];
  // The whole section repealed leaves the bare numbers; one subsection repealed reads "Kehtetu."; a repealed one may get words again.
  const newer = [item('§ 13¹ lg 1', '(1)'), item('§ 13¹ lg 2', '(2) Kehtetu.'), item('§ 13¹ lg 3', '(3) Kehtetu.'), item('§ 13¹ lg 4', '(4) Uus sõnastus.'), item('§ 13¹ lg 5', '(5) Kehtetu.')];
  assert.deepEqual(compareProvisions(older, newer), { changed: ['§ 13¹ lg 4'], added: ['§ 13¹ lg 5'], removed: ['§ 13¹ lg 1', '§ 13¹ lg 2'], renumbered: [], unchanged: ['§ 13¹ lg 3'] });
});

test('the target of a link to an implementing act names its own version and is no wording', () => {
  // As a national law is read: the link's target is a block of its own between the words of the sentence.
  const act = number => ({ source_units: [{ locator: { kind: 'xml', path: '/oigusakt[1]/sisu[1]/paragrahv[1]' },
    raw_text: `§ 9.

Kord

(1)

Korra kehtestab

valdkonna eest vastutav minister

./dyn=${number}&id=112022019005;112022019006

määrusega.

(2)

Teine lõige${number === '1' ? '' : ', muudetud'}.` }] });
  const [older, newer] = [actProvisions(act('1')), actProvisions(act('2'))];
  assert.equal(older[1].text, '(1) Korra kehtestab valdkonna eest vastutav minister määrusega.');
  assert.deepEqual(compareProvisions(older, newer), { changed: ['§ 9 lg 2'], added: [], removed: [], renumbered: [], unchanged: ['§ 9', '§ 9 lg 1'] });
});

test('the evidence of a "what changes" turn: each provision with its state and the passages that hold it in each version', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)], bundles = new Map([[older.document.id, older], [newer.document.id, newer]]);
  const oldFifth = ofSection(older, 5), newFifth = ofSection(newer, 5);
  assert.deepEqual([oldFifth.length, newFifth.length], [2, 2]);
  // As in the measured turn: the first passage of § 5 in both versions, and here also both second passages.
  const evidence = [entryOf(newer, newFifth[0], NEWER), entryOf(older, oldFifth[0], OLDER), entryOf(newer, newFifth[1], NEWER), entryOf(older, oldFifth[1], OLDER)];
  let loaded = null;
  const comparisons = await versionComparisons(evidence, async ids => { loaded = ids; return ids.map(id => bundles.get(id)); });
  assert.deepEqual([...loaded].sort(), [older.document.id, newer.document.id].sort());
  assert.equal(comparisons.length, 1);
  const [comparison] = comparisons;
  assert.deepEqual([comparison.act, comparison.older.valid_from, comparison.older.valid_to, comparison.newer.valid_from, comparison.newer.valid_to], [TITLE, '2025-09-01', '2026-10-05', '2026-10-06', null]);
  const byLabel = Object.fromEntries(comparison.provisions.map(item => [item.provision, item]));
  assert.deepEqual(Object.keys(byLabel), ['§ 5', ...[1, 2, 3, 4, 5, 6, 7, 8].map(number => `§ 5 lg ${number}`)]);
  assert.deepEqual(Object.values(byLabel).map(item => item.state), ['unchanged', 'changed', 'unchanged', 'changed', 'changed', 'unchanged', 'unchanged', 'unchanged', 'unchanged']);
  // § 5 lg 5 has the same wording, and stands in the second passage of the older version and the first of the newer.
  assert.deepEqual([byLabel['§ 5 lg 5'].older, byLabel['§ 5 lg 5'].newer], [[`evidence-${OLDER}-${oldFifth[1].ordinal}`], [`evidence-${NEWER}-${newFifth[0].ordinal}`]]);
  // What differs outside the evidence is named, not shown: 44 of the 47 changed provisions, all 12 added ones and the removed one.
  assert.deepEqual([comparison.other.changed.count, comparison.other.added.count, comparison.other.removed.count], [44, 12, 1]);
  assert.equal(comparison.other.changed.provisions.length, 40);

  // The block the model reads, with the packet's references.
  const refOf = evidenceId => `S${evidence.findIndex(entry => entry.evidence_id === evidenceId) + 1}`;
  const block = versionChangesContext(comparisons, refOf);
  assert.equal(block.version, VERSION_COMPARISON_VERSION);
  const [act] = block.acts;
  assert.deepEqual([act.older.refs, act.newer.refs], [['S2', 'S4'], ['S1', 'S3']]);
  assert.deepEqual(act.differences, [{ provision: '§ 5 lg 1', state: 'changed', older: ['S2'], newer: ['S1'] }, { provision: '§ 5 lg 3', state: 'changed', older: ['S2'], newer: ['S1'] },
    { provision: '§ 5 lg 4', state: 'changed', older: ['S2'], newer: ['S1'] }]);
  assert.deepEqual(act.same_wording, ['§ 5', '§ 5 lg 2', '§ 5 lg 5', '§ 5 lg 6', '§ 5 lg 7', '§ 5 lg 8']);
  assert.deepEqual([act.not_in_evidence.changed.count, act.not_in_evidence.changed.first.length, act.not_in_evidence.added.length, act.not_in_evidence.removed, act.not_in_evidence.renumbered],
    [44, 40, 12, ['§ 22 lg 8'], undefined]);
  // It reaches the model's context as version_changes and adds no text of the act.
  const { context } = modelProjection(evidence, { tenant: 't', query_id: 'q', generation_id: 'g', version_comparison: block });
  assert.deepEqual(context.version_changes, block);
  assert.ok(!JSON.stringify(block).includes('taotleja'));
  const scope = { tenant: 't', query_id: 'q', generation_id: 'g' }, plain = modelProjection(evidence, scope);
  assert.equal(plain.context.version_changes, undefined);
  // Like the legal dates it is outside every budget: the limits read the context without it, a budget measure never
  // holds it, and the audit packet's size is counted without it. A full context cannot fail a turn over the comparison.
  const { measurements } = modelProjection(evidence, { ...scope, version_comparison: block });
  assert.equal(measurements.budget_context_tokens, plain.measurements.budget_context_tokens);
  assert.ok(measurements.model_context_tokens > measurements.budget_context_tokens);
  assert.ok(measurements.model_context_tokens - plain.measurements.model_context_tokens <= VERSION_CHANGES_TOKENS + 5);
  assert.equal(modelProjection(evidence, { ...scope, version_comparison: block }, { measure: 'budget' }).context.version_changes, undefined);
  const packet = { ...scope, evidence, model_context: plain.context };
  assert.equal(auditPacketBytes({ ...packet, version_comparison: block, model_context: context }), auditPacketBytes(packet));
});

test('the block has its own cap: the names outside the evidence shrink to counts, and a block still too large is not sent', () => {
  const labels = (count, section) => Array.from({ length: count }, (_, at) => `§ ${section} lg ${at + 1}`);
  const comparison = (held, outside) => ({ act: 'Kord', older: { valid_from: '2026-01-01', valid_to: '2026-12-31', evidence: ['a'] }, newer: { valid_from: '2027-01-01', valid_to: null, evidence: ['b'] },
    provisions: labels(held, 1).map(provision => ({ provision, state: 'changed', older: ['a'], newer: ['b'] })),
    other: Object.fromEntries(['changed', 'added', 'removed', 'renumbered'].map((state, at) => [state, { count: outside, provisions: labels(Math.min(outside, 40), 100 + at) }])) });
  const refOf = id => ({ a: 'S1', b: 'S2' }[id]), size = block => tokenCount(JSON.stringify(block));
  // A small comparison names every provision that differs outside the evidence.
  const small = versionChangesContext([comparison(3, 5)], refOf);
  assert.deepEqual(small.acts[0].not_in_evidence.changed, labels(5, 100));
  // Many names outside the evidence: the first ten of each state, then the counts alone.
  const ten = versionChangesContext([comparison(20, 400)], refOf);
  assert.deepEqual([ten.acts[0].not_in_evidence.changed.count, ten.acts[0].not_in_evidence.changed.first.length, ten.acts[0].differences.length], [400, 10, 20]);
  const counts = versionChangesContext([comparison(45, 400)], refOf);
  assert.deepEqual([counts.acts[0].not_in_evidence.added, counts.acts[0].differences.length], [{ count: 400 }, 45]);
  for (const block of [small, ten, counts]) assert.ok(size(block) <= VERSION_CHANGES_TOKENS);
  // The provisions of the evidence are never cut: a block that cannot hold them all is left out.
  assert.equal(versionChangesContext([comparison(200, 400)], refOf), null);
});

test('the turn measured on 04.10: only the first passage of § 5 of each version was selected, and lg 5 is still known to read the same', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)], bundles = new Map([[older.document.id, older], [newer.document.id, newer]]);
  const evidence = [entryOf(newer, ofSection(newer, 5)[0], NEWER), entryOf(older, ofSection(older, 5)[0], OLDER)];
  const comparisons = await versionComparisons(evidence, async ids => ids.map(id => bundles.get(id)));
  const fifth = comparisons[0].provisions.find(item => item.provision === '§ 5 lg 5');
  // The older wording of lg 5 is in a passage the selection left out: the comparison reads the versions, not the passages.
  assert.deepEqual(fifth, { provision: '§ 5 lg 5', state: 'unchanged', older: [], newer: [evidence[0].evidence_id] });
  const [act] = versionChangesContext(comparisons, evidenceId => `S${evidence.findIndex(entry => entry.evidence_id === evidenceId) + 1}`).acts;
  assert.ok(act.same_wording.includes('§ 5 lg 5'));
  assert.ok(!act.differences.some(item => item.provision === '§ 5 lg 5'));
  // Every difference of the evidence names a passage of each version it stands in.
  for (const item of act.differences) assert.ok(item.older?.length || item.newer?.length, item.provision);
});

test('nothing is compared without two versions of one act in the evidence', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)];
  const never = async () => { throw new Error('no bundle is read'); };
  const first = entryOf(newer, ofSection(newer, 5)[0], NEWER);
  // One version; two passages of one version; two acts with their own titles; a version without a declared start; a record.
  assert.deepEqual(await versionComparisons([first], never), []);
  assert.deepEqual(await versionComparisons([first, entryOf(newer, ofSection(newer, 5)[1], NEWER)], never), []);
  const other = { ...entryOf(older, ofSection(older, 5)[0], OLDER), bibliography: { title: 'Teine kord' } };
  assert.deepEqual(await versionComparisons([first, other], never), []);
  const undated = { ...entryOf(older, ofSection(older, 5)[0], OLDER), source_metadata: { authority: { value: 'Põhja-Sakala Vallavolikogu' }, municipality_id: { value: 'pohja_sakala_vald' } } };
  assert.deepEqual(await versionComparisons([first, undated], never), []);
  const record = { ...entryOf(older, ofSection(older, 5)[0], OLDER), selection: { reason: 'structured_record' } };
  assert.deepEqual(await versionComparisons([first, record], never), []);
  // The same title of another municipality is another act.
  const elsewhere = entryOf(older, ofSection(older, 5)[0], OLDER); elsewhere.source_metadata = { ...elsewhere.source_metadata, municipality_id: { value: 'teine_vald' } };
  assert.deepEqual(await versionComparisons([first, elsewhere], never), []);
  // A new act that replaced the old one under the same title (another adoption day) has its own numbering: not compared.
  const both = [first, entryOf(older, ofSection(older, 5)[0], OLDER)];
  assert.equal(older.document.fields.legal_text.value.adopted, newer.document.fields.legal_text.value.adopted);
  const replaced = { ...older, document: { ...older.document, fields: { legal_text: { value: { ...older.document.fields.legal_text.value, adopted: '2019-01-01' } } } } };
  assert.deepEqual(await versionComparisons(both, async ids => ids.map(id => (id === older.document.id ? replaced : newer))), []);
  const unknown = { ...older, document: { id: older.document.id, fields: {} } };
  assert.deepEqual(await versionComparisons(both, async ids => ids.map(id => (id === older.document.id ? unknown : { ...newer, document: { id: newer.document.id, fields: {} } }))), []);
  // A bundle that is no longer the version of the evidence is not compared.
  const stale = { ...older, version: { id: 'another-version' } };
  assert.deepEqual(await versionComparisons([first, entryOf(older, ofSection(older, 5)[0], OLDER)], async ids => ids.map(id => (id === older.document.id ? stale : newer))), []);
});

test('the dialogue prompt (since 26) says what version_changes is and that a change is stated only as it lists it', () => {
  assert.ok(Number(DIALOGUE_PROMPT_VERSION.split('-').at(-1)) >= 26);
  const config = { model: 'gpt-6-luna', reasoning: 'medium', maxOutputTokens: 4096 };
  const instructions = dialogueRequest(config, 'Mis muutub?', { evidence: [] }, 'et', {}).instructions;
  assert.ok(instructions.includes(VERSION_CHANGES_INSTRUCTIONS));
  for (const phrase of ['never present a same_wording provision as a change', 'only as version_changes lists it', 'not_in_evidence differ too', 'cite them'])
    assert.ok(VERSION_CHANGES_INSTRUCTIONS.includes(phrase), phrase);
  // A general rule: no act, place or provision of the turn that showed the fault.
  assert.doesNotMatch(VERSION_CHANGES_INSTRUCTIONS, /Sakala|§|lg \d|taotl/iu);
});
