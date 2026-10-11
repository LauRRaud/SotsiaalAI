import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { hash, id, stable } from '../lib/rag-v2/contracts.js';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { embeddingConfig, indexUnit, tokenCount, MockEmbedding } from '../lib/rag-v2/search/embedding.js';
import { searchConfig } from '../lib/rag-v2/search/indexing.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { sourceEntry, retrieve } from '../lib/rag-v2/search/retrieval.js';
import { modelProjection, packetReferences, stripLegalDates, auditPacketBytes, MODEL_SERIALIZER, LEGAL_PLACE_TOKENS } from '../lib/rag-v2/search/model-context.js';
import { legalPlace, provisionLabel } from '../lib/rag-v2/search/legal-place.js';
import { replayContext } from '../lib/rag-v2/search/context-replay.js';
import { leanPacket } from '../lib/rag-v2/pilot/lean-turn.js';

// ADR-123 (10.10.2026): the answer model must be able to tell which provision of an act a legal passage is. A made-up
// act read by the real reader and chunker, searched with stand-in services and the mock embedding: no network (any
// request fails the file), no model, nothing bought.
let root, networkCalls = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const tenant = 'legal-place-test', rights = { access: 'local_private', usage: 'development_only' }, profile = { id: 'generic-fixtures', version: '1', months: [], categoryLabels: [] };
const section = (number, title, content) => `<paragrahv><kuvatavNr><![CDATA[§ ${number}. ]]></kuvatavNr><paragrahvPealkiri>${title}</paragrahvPealkiri>${content}</paragrahv>`;
const subsection = (number, text, points = '') => `<loige><kuvatavNr><![CDATA[(${number})]]></kuvatavNr><sisuTekst><tavatekst>${text}</tavatekst></sisuTekst>${points}</loige>`;
const point = (number, text) => `<alampunkt><kuvatavNr><![CDATA[${number}) ]]></kuvatavNr><sisuTekst><tavatekst>${text}</tavatekst></sisuTekst></alampunkt>`;
// No sentence repeats, so a passage shows by its words which subsections it holds.
const words = (name, sentences) => Array.from({ length: sentences }, (_, at) => `Fictional subsection ${name} sentence ${at + 1} sets out a condition of the sample benefit in plain words.`).join(' ');
// § 133 is long: its subsection 2 runs over a passage's end, and 2¹ was put in after it. § 13⁴ has one unnumbered
// subsection, § 135 a list and a long subsection, § 136 quotes a provision under a number it has already.
const ACT = '<oigusakt xmlns="fixture"><metaandmed><valjaandja>Fixture issuer</valjaandja><tekstiliik>terviktekst</tekstiliik><globaalID>fixture-123</globaalID>'
  + '<kehtivus><kehtivuseAlgus>2026-09-04</kehtivuseAlgus></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Fictional benefits</pealkiri></nimi></aktinimi>'
  + '<sisu><preambul><tavatekst>This fictional act is given for the tests of the sample benefit.</tavatekst></preambul>'
  + section(1, 'Scope', subsection(1, 'The act sets the sample benefit.') + subsection(2, 'It applies to the sample garden.'))
  + section(133, 'Long section', subsection(1, words('1', 3)) + subsection(2, words('2', 40)) + subsection('2<sup>1</sup>', words('2¹', 3)) + subsection(3, words('3', 14)) + subsection(4, words('4', 14)))
  + section('13<sup>4</sup>', 'Unnumbered', '<loige><sisuTekst><tavatekst>One unnumbered fictional rule.</tavatekst></sisuTekst></loige>')
  + section(135, 'Rates', subsection(1, 'The fictional rates are:', point(1, 'the first rate is 10 euros;') + point(2, 'the second rate is 20 euros.')) + subsection(2, words('R2', 30)))
  + section(136, 'Quoted', subsection(1, 'The earlier act read as follows.') + subsection(2, 'Its second subsection was:') + subsection(2, 'A quoted fictional rule.'))
  + '</sisu></oigusakt>';
const bundles = {};
async function read(name, format, bytes, extra = {}) {
  const dir = path.join(root, name); await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `source.${format}`), bytes);
  const metadata = { document_id: name, title: `Fixture ${name}`, source_type: 'fixture', language: 'en', source_path: `source.${format}`, source_format: format, ...extra };
  return (await ingest({ tenant, inputRoot: dir, metadata, storeRoot: path.join(dir, 'store'), rights, profile })).bundle;
}
before(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-legal-place-'));
  globalThis.fetch = net.Socket.prototype.connect = () => { networkCalls++; throw Error('unexpected_network'); };
  bundles.act = await read('act', 'xml', ACT);
  bundles.bySubsection = await read('by-subsection', 'xml', ACT, { source_selector: { xml_sections: ['135'], xml_units: 'subsection' } });
  bundles.byPoint = await read('by-point', 'xml', ACT, { source_selector: { xml_sections: ['135'], xml_units: 'point' } });
  // A web page that quotes the same section under the same heading: no act, whatever its heading says.
  bundles.page = await read('page', 'html', `<article><h1>§ 133. Long section</h1><p>(2)</p><p>${words('2', 3)}</p></article>`);
});
after(async () => {
  globalThis.fetch = savedFetch; net.Socket.prototype.connect = savedConnect;
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-legal-place-'));
  await fs.rm(target, { recursive: true, force: true });
  assert.equal(networkCalls, 0);
});

const scope = { tenant, query_id: 'query-fixture', generation_id: 'generation-fixture' };
const heading = chunk => chunk.retrieval_text.slice(0, chunk.retrieval_mapping.prefix_length);
// The passages of one section, in the text's order.
const of = (bundle, number) => bundle.chunks.filter(chunk => heading(chunk).includes(`§ ${number}. `));
const entriesOf = (bundle, chunks = bundle.chunks) => chunks.map(chunk => sourceEntry(indexUnit(chunk, bundle, embeddingConfig()), bundle, 'ranked_seed', null));
const labels = (bundle, chunks = bundle.chunks) => chunks.map(chunk => provisionLabel(legalPlace(bundle, chunk)));
// An entry as it was before the entries carried the place: a stored turn's.
const unplaced = entries => entries.map(({ legal_place: _place, ...entry }) => entry);
const bytes = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

test('a long section cut into several passages: only the first has "§" in its text, and each names its section and the subsections it holds', () => {
  const { act } = bundles, parts = of(act, 133);
  // The fault: the later passages of the section have no section number, and two of them begin inside a subsection.
  assert.equal(parts.length, 4);
  assert.deepEqual(parts.map(chunk => chunk.source_text.includes('§')), [true, false, false, false]);
  assert.deepEqual(parts.map(chunk => /^\(/u.test(chunk.source_text)), [false, false, true, false]);
  const places = parts.map(chunk => legalPlace(act, chunk));
  assert.deepEqual(places, [{ section: '133', subsections: ['1', '2'] }, { section: '133', subsections: ['2', '2¹'] }, { section: '133', subsections: ['3', '4'] }, { section: '133', subsections: ['4'] }]);
  // The subsections named are those whose words the passage has: a subsection that runs on is named in both passages.
  for (const [at, chunk] of parts.entries()) assert.deepEqual(places[at].subsections, ['1', '2', '2¹', '3', '4'].filter(number => chunk.source_text.includes(`subsection ${number} sentence`)), `passage ${at + 1}`);
  assert.deepEqual(places.map(provisionLabel), ['§ 133 lg 1–2', '§ 133 lg 2–2¹', '§ 133 lg 3–4', '§ 133 lg 4']);
  // The other sections, each one passage: a superscript number as the act shows it, a section without numbered
  // subsections by its number alone, and so one whose subsection numbers repeat (a quoted provision).
  assert.deepEqual([1, '13⁴', 136].map(number => labels(act, of(act, number))), [['§ 1 lg 1–2'], ['§ 13⁴'], ['§ 136']]);
  assert.deepEqual(labels(act, of(act, 135)), ['§ 135 lg 1–2', '§ 135 lg 2']);
  // The preamble stands outside every section: no place.
  const preamble = act.chunks.filter(chunk => !heading(chunk).includes('§'));
  assert.equal(preamble.length, 1); assert.match(preamble[0].source_text, /^This fictional act/u);
  assert.equal(legalPlace(act, preamble[0]), null);
  // The entry carries the place, and the context a turn sends names the provision before the excerpt's text.
  const evidence = entriesOf(act), sent = modelProjection(evidence, scope);
  assert.equal(sent.context.schema_version, 'rag-v2/model-context-json-5'); assert.equal(MODEL_SERIALIZER, 'rag-v2/model-context-json-5');
  assert.deepEqual(evidence.map(entry => entry.legal_place ?? null), act.chunks.map(chunk => legalPlace(act, chunk)));
  assert.deepEqual(sent.context.evidence.map(excerpt => excerpt.provision ?? null), labels(act));
  const second = sent.context.evidence[act.chunks.indexOf(parts[1])];
  assert.deepEqual(Object.keys(second), ['ref', 'source', 'pdf_pages', 'source_locations', 'provision', 'text']);
  assert.deepEqual([second.provision, second.text, second.text.includes('§')], ['§ 133 lg 2–2¹', parts[1].source_text, false]);
  assert.deepEqual(Object.keys(sent.context.evidence[act.chunks.indexOf(preamble[0])]), ['ref', 'source', 'pdf_pages', 'source_locations', 'text']);
  assert.equal('legal_place' in evidence[act.chunks.indexOf(preamble[0])], false);
});

test('a section read by subsection or by point (ADR-082, ADR-083): the subsection is the unit\'s own, also in the passage that has lost its number', () => {
  const { bySubsection, byPoint } = bundles;
  // By subsection: the long subsection 2 is two passages, and the second starts without "(2)".
  assert.deepEqual(bySubsection.chunks.map(chunk => chunk.source_text.slice(0, 3)), ['(1)', '(2)', 'Fic']);
  assert.deepEqual(labels(bySubsection), ['§ 135 lg 1', '§ 135 lg 2', '§ 135 lg 2']);
  // By point: a point's passage is "1) ..." under the subsection's opening words, which only the heading path has.
  assert.deepEqual(byPoint.chunks.map(chunk => chunk.source_text.slice(0, 3)), ['1)\n', '2)\n', '(2)', 'Fic']);
  assert.match(heading(byPoint.chunks[0]), /> § 135\. Rates > \(1\) The fictional rates are:\n/u);
  assert.deepEqual(labels(byPoint), ['§ 135 lg 1', '§ 135 lg 1', '§ 135 lg 2', '§ 135 lg 2']);
  assert(byPoint.chunks.every(chunk => !chunk.source_text.includes('§')));
});

test('no place where it cannot be read: not an act, a reader that may have lost a superscript, a text that names another section', () => {
  const { act, page } = bundles, [first, second] = of(act, 133), unit = act.source_units.find(item => item.id === first.source_locations[0].source_unit_id);
  // A web page under the heading "§ 133. Long section" is no act: no place, no provision.
  assert(page.chunks.length > 0 && page.chunks.every(chunk => heading(chunk).includes('§ 133. Long section')));
  assert.deepEqual(labels(page), page.chunks.map(() => null));
  const entries = entriesOf(page);
  assert(entries.every(entry => !('legal_place' in entry)));
  assert(!JSON.stringify(modelProjection(entries, scope).context).includes('provision'));
  assert.equal(modelProjection(entries, scope).measurements.legal_place, undefined);
  // An XML read before the reader kept every superscript (ADR-056): its "§ 133" may be another section's number.
  const older = { ...act, version: { ...act.version, processing_config: { ...act.version.processing_config, normalization: 'source-structure-v27' } } };
  assert.equal(legalPlace(older, second), null);
  // The section's own text starts with another number than the heading path names.
  const renumbered = { ...act, source_units: act.source_units.map(item => (item === unit ? { ...item, raw_text: item.raw_text.replace('§ 133.', '§ 134.') } : item)) };
  assert.equal(legalPlace(renumbered, second), null);
  // Without the section's text (a unit the bundle does not have) the heading path still names the section.
  assert.deepEqual(legalPlace({ ...act, source_units: [] }, second), { section: '133', subsections: [] });
  // Text that stands in no section has no place, even under a heading path that holds a section's number.
  const preamble = act.chunks.find(chunk => !heading(chunk).includes('§')), path = 'Fixture issuer > Fictional rules of § 5. of another act\n\n';
  assert.equal(legalPlace(act, { ...preamble, retrieval_text: path + preamble.source_text, retrieval_mapping: { prefix_length: path.length } }), null);
  // A passage that ends with a subsection's number alone holds none of it; a character into its text, it does.
  const mark = unit.raw_text.indexOf('(2¹)'), until = end => legalPlace(act, { ...first, source_locations: [{ ...first.source_locations[0], start: 0, end }] }).subsections;
  assert.deepEqual([until(mark), until(mark + 4), until(mark + 7)], [['1', '2'], ['1', '2'], ['1', '2', '2¹']]);
  assert.equal(unit.raw_text.slice(mark, mark + 7), '(2¹)\n\nF');
  // Only a place projects: a section and subsections as an act numbers them.
  for (const none of [null, undefined, {}, 'a', { section: '5' }, { section: 5, subsections: [] }, { section: '5', subsections: ['x'] }, { section: '§ 5', subsections: [] }, { section: '5', subsections: [3] }]) assert.equal(provisionLabel(none), null, JSON.stringify(none));
  assert.deepEqual([{ section: '5', subsections: [] }, { section: '15¹', subsections: ['3'] }, { section: '142⁴⁷', subsections: ['3¹', '4', '12'] }].map(provisionLabel), ['§ 5', '§ 15¹ lg 3', '§ 142⁴⁷ lg 3¹–12']);
});

test('the provision is an annotation: only in the context a turn sends, outside every budget measure and the audit packet\'s limit, never in a reference', () => {
  const { act } = bundles, evidence = entriesOf(act), before = unplaced(evidence);
  // The made-up act has no amendment notes and no dates of its own: the provision is the only annotation here.
  assert(evidence.every(entry => !('legal_dates' in entry)) && evidence.filter(entry => entry.legal_place).length === act.chunks.length - 1);
  const sent = modelProjection(evidence, scope), plain = modelProjection(before, scope);
  // An entry without the field projects as before: no provision anywhere, and the context sent is the one a budget counts.
  assert(!JSON.stringify(plain.context).includes('provision'));
  assert.equal(plain.measurements.legal_place, undefined);
  assert.equal(plain.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  // With it, the context sent differs by each excerpt's provision alone.
  assert.deepEqual(sent.context, { ...plain.context, evidence: plain.context.evidence.map((excerpt, at) => (evidence[at].legal_place ? { ...excerpt, provision: provisionLabel(evidence[at].legal_place) } : excerpt)) });
  assert.deepEqual(stripLegalDates(sent.context), plain.context);
  // Every measure a budget or a reference check reads projects as without the field.
  for (const options of [{ measure: 'budget' }, { measure: 'none' }, { measure: 'full', annotations: false }]) {
    const measured = modelProjection(evidence, scope, options);
    assert.deepEqual(measured.context, plain.context, JSON.stringify(options));
    assert.deepEqual(measured.references, plain.references);
  }
  assert.equal(modelProjection(evidence, scope, { measure: 'budget' }).measurements.model_context_tokens, plain.measurements.model_context_tokens);
  // The full measure gives both counts: the context as sent, and the same without the provisions, which a limit reads.
  const { legal_place: placed } = sent.measurements, added = sent.measurements.model_context_tokens - sent.measurements.budget_context_tokens;
  assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  assert.deepEqual(placed, { tokens: placed.tokens, limit: LEGAL_PLACE_TOKENS, shown: act.chunks.length - 1, omitted: 0 });
  assert(added > 0 && added <= placed.tokens && placed.tokens <= LEGAL_PLACE_TOKENS, `${added} <= ${placed.tokens}`);
  // The reference map is the same map, and holds neither the place nor the label.
  assert.deepEqual(sent.references, plain.references);
  assert(!/legal_place|provision/u.test(JSON.stringify(sent.references)));
  // The audit packet's size limit counts the packet without the places of its entries and the provisions of its context.
  const packet = { ...scope, evidence, model_context: sent.context, reference_map: sent.references }, stored = { ...scope, evidence: before, model_context: plain.context, reference_map: plain.references };
  assert.deepEqual([auditPacketBytes(packet), auditPacketBytes(stored)], [bytes(stored), bytes(stored)]);
  assert(bytes(packet) > bytes(stored));
});

test('the provisions\' own cap: 300 tokens in evidence order; past it an excerpt carries only the mark, and no turn fails', () => {
  assert.equal(LEGAL_PLACE_TOKENS, 300);
  const [entry] = entriesOf(bundles.act, of(bundles.act, 133)), longest = { section: '142⁴⁷', subsections: ['3¹', '4', '12'] };
  const many = count => Array.from({ length: count }, (_, at) => ({ ...entry, evidence_id: `${entry.evidence_id}-${at}`, legal_place: longest }));
  assert.deepEqual([tokenCount(',"provision":"§ 133"'), tokenCount(`,"provision":${JSON.stringify(provisionLabel(longest))}`), tokenCount(',"provision_omitted":true')], [8, 18, 8]);
  // The chat's search brings 15 excerpts at most: all are labelled, even with numbers this long.
  const chat = modelProjection(many(15), scope);
  assert.deepEqual(chat.measurements.legal_place, { tokens: 270, limit: 300, shown: 15, omitted: 0 });
  // The most a search can bring is 30 (finalLimit): the first labels are shown, the rest marked, all inside the cap.
  const evidence = many(30), sent = modelProjection(evidence, scope), plain = modelProjection(unplaced(evidence), scope), { legal_place: placed } = sent.measurements;
  assert.deepEqual([placed.shown, placed.omitted, placed.tokens, 30 * 8 <= LEGAL_PLACE_TOKENS], [6, 24, 300, true]);
  assert.deepEqual(sent.context.evidence.map(excerpt => (excerpt.provision ? 'shown' : excerpt.provision_omitted === true ? 'omitted' : 'none')), [...Array(6).fill('shown'), ...Array(24).fill('omitted')]);
  assert.deepEqual(sent.context.evidence.at(-1), { ...plain.context.evidence.at(-1), provision_omitted: true });
  assert.deepEqual(Object.keys(sent.context.evidence.at(-1)), ['ref', 'source', 'pdf_pages', 'source_locations', 'provision_omitted', 'text']);
  // The marks are annotations too: a budget reads the context without them, and the context sent passes it by the cap at most.
  assert.deepEqual(stripLegalDates(sent.context), plain.context);
  assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  const added = sent.measurements.model_context_tokens - sent.measurements.budget_context_tokens;
  assert(added > 0 && added <= LEGAL_PLACE_TOKENS, `added ${added}`);
  // A structured record's excerpt is cited by its ref alone and never names a provision.
  const record = { ...entry, selection: { reason: 'structured_record' } };
  assert.deepEqual(modelProjection([record], scope).context, modelProjection(unplaced([record]), scope).context);
});

// The search over the act with stand-in services: every passage is a lexical hit, in the act's order.
function searchOver(bundle) {
  const embedding = new MockEmbedding(), config = searchConfig(embedding.config), documents = { [bundle.document.id]: { version_id: bundle.version.id } };
  const snapshot = { source_generation: 'source-v1', documents, snapshot_hash: hash(stable(documents)) }, generation = { id: id('search_generation', tenant, snapshot, config), config, snapshot };
  const units = bundle.chunks.map(chunk => indexUnit(chunk, bundle, embedding.config));
  const postgres = { active: async () => generation, bundles: async () => [bundle], units: async () => units,
    lexical: async (_tenant, _generation, _docs, _text, _limit, eligible) => units.filter(unit => eligible.includes(unit.id)).map((unit, at) => ({ ...unit, score: 100 - at })) };
  const policy = new LocalPolicy({ tenants: { [tenant]: { operator: [bundle.document.id] } } });
  return (contextTokens, options = {}) => retrieve({ postgres, qdrant: { query: async () => [] }, embedding, policy, context: { tenant, subject: 'operator', usage: 'development_only' }, allowLexicalFallback: false,
    query: { text: 'benefit', language: 'en', method: 'lexical', contextMode: 'compact', includeDocumentLabels: false, finalLimit: 20, limits: { topK: 20, perDocument: 20, candidates: 40, contextTokens }, ...options } });
}

test('retrieve() selects the same evidence whether its entries carry the place or not, in both budget measures', async () => {
  const { act } = bundles;
  // The same version as a reader that gives no place left it: its entries are the ones from before the field.
  const placeless = { ...act, version: { ...act.version, processing_config: { ...act.version.processing_config, normalization: 'source-structure-v27' } } };
  const placed = searchOver(act), earlier = searchOver(placeless);
  const chosen = packet => ({ state: packet.state, warnings: packet.warnings, evidence: unplaced(packet.evidence), trace: packet.selection_trace, rankings: packet.raw_rankings,
    context: stripLegalDates(packet.model_context), counted: [packet.measurements.context_tokens, packet.measurements.budget_context_tokens],
    references: Object.fromEntries(Object.entries(packet.reference_map).map(([ref, { query_id: _query, ...value }]) => [ref, value])) });
  const same = async (contextTokens, options) => {
    const [withPlace, without] = [await placed(contextTokens, options), await earlier(contextTokens, options)];
    assert.deepEqual(chosen(withPlace), chosen(without), `${contextTokens} ${JSON.stringify(options ?? {})}`);
    assert.equal(without.evidence.some(entry => 'legal_place' in entry), false);
    return { withPlace, without };
  };
  const roomy = await same(32000), all = act.chunks.length;
  assert.deepEqual([roomy.withPlace.state, roomy.withPlace.evidence.length, roomy.withPlace.evidence.filter(entry => entry.legal_place).length], ['ok', all, all - 1]);
  assert.deepEqual(roomy.withPlace.model_context.evidence.map(excerpt => excerpt.provision ?? null), labels(act));
  // A budget of exactly the context without the provisions: everything still fits, though the context sent is larger.
  const exact = roomy.without.measurements.model_context_tokens, tight = await same(exact);
  assert.deepEqual([tight.withPlace.evidence.length, tight.withPlace.warnings, tight.withPlace.measurements.budget_context_tokens], [all, [], exact]);
  assert(tight.withPlace.measurements.model_context_tokens > exact);
  // One token less: the same last excerpt is left out of both.
  const short = await same(exact - 1);
  assert.equal(short.withPlace.evidence.length, all - 1); assert(short.withPlace.warnings.includes('context_budget_limited'));
  // The audit measure counts whole entries: never their place in the act.
  const audit = roomy.without.evidence.reduce((sum, entry) => sum + tokenCount(JSON.stringify(entry)), 0);
  const whole = await same(audit, { contextMode: 'audit' }), less = await same(audit - 1, { contextMode: 'audit' });
  assert.deepEqual([whole.withPlace.evidence.length, less.withPlace.evidence.length, whole.withPlace.measurements.context_tokens], [all, all - 1, audit]);
});

test('a turn stored before the field: its references still hold, its lean form too, and a replay gives its context back', () => {
  const { act } = bundles, parts = of(act, 133), evidence = unplaced(entriesOf(act, parts)), then = modelProjection(evidence, scope, { annotations: false });
  // The packet as stored then: no place on its entries, no provision in its context, the label of that serializer.
  const stored = { ...scope, evidence, model_context: { ...then.context, schema_version: 'rag-v2/model-context-json-4' }, reference_map: then.references };
  assert.deepEqual(packetReferences(stored), stored.reference_map);
  // The same turn made now has the same reference map; kept lean for an answer that cites S2, its reference still holds.
  const now = entriesOf(act, parts), made = modelProjection(now, scope), packet = { ...scope, evidence: now, model_context: made.context, reference_map: made.references };
  assert.deepEqual(packet.reference_map, stored.reference_map);
  assert.deepEqual(packetReferences(packet), packet.reference_map);
  const lean = leanPacket(packet, { blocks: [{ text: 'A fictional statement.', refs: ['S2'] }] });
  assert.deepEqual([Object.keys(lean.reference_map), packetReferences(lean)], [['S2'], { S2: stored.reference_map.S2 }]);
  // ADR-129: the lean entry keeps its place in the act, which the sources panel shows beside the act's title.
  assert.deepEqual(lean.evidence.map(entry => entry.legal_place), [{ section: '133', subsections: ['2', '2¹'] }]);
  // The replay rebuilds the entries from the bundle, so the context it gives names the provisions; without the
  // annotations it is the stored context, and the packet's size limit counts what it counted then.
  const replay = replayContext(stored, new Map([[act.document.id, act]]), embeddingConfig());
  assert.deepEqual([replay.equal_without_legal_dates, replay.differences], [true, []]);
  assert.deepEqual(replay.context.evidence.map(excerpt => excerpt.provision), ['§ 133 lg 1–2', '§ 133 lg 2–2¹', '§ 133 lg 3–4', '§ 133 lg 4']);
  assert.deepEqual([replay.tokens.without_legal_dates, replay.tokens.context > replay.tokens.without_legal_dates], [then.measurements.model_context_tokens, true]);
  assert.deepEqual(replay.packet_bytes, { stored: bytes(stored), now: replay.packet_bytes.now, counted: bytes({ ...stored, model_context: then.context }), limit: replay.packet_bytes.limit });
  assert(replay.packet_bytes.now > replay.packet_bytes.counted);
});
