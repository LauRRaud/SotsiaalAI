import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { actAbbreviations, currentActAbbreviations, TABLE, TABLE_VERSION } from '../scripts/rag-v2-act-abbreviations.mjs';
import { modelProjection, stripLegalDates, auditPacketBytes, MODEL_SERIALIZER } from '../lib/rag-v2/search/model-context.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';

// ADR-129 (10.10.2026): a law's abbreviation is Riigi Teataja's own, read from the registered XML files, never typed in.
const committed = JSON.parse(fs.readFileSync(TABLE, 'utf8'));

test('the committed table of law abbreviations is what the registered XML files of the indexed acts give', () => {
  // Fails when a law is added to the index list, or a file changes its abbreviation, and the table was not made again
  // (node scripts/rag-v2-act-abbreviations.mjs --write).
  assert.deepEqual(committed, currentActAbbreviations());
  assert.equal(committed.schema_version, TABLE_VERSION);
  const titles = Object.keys(committed.abbreviations), short = Object.values(committed.abbreviations);
  // On 10.10.2026: 37 law titles, 36 with an abbreviation; the State Budget Act has none. Every title is listed, so the
  // provision check knows which laws the corpus holds.
  assert.deepEqual([titles.length, short.filter(Boolean).length, titles.filter(title => committed.abbreviations[title] === null)], [37, 36, ['2026. aasta riigieelarve seadus']]);
  assert.deepEqual(['Sotsiaalhoolekande seadus', 'Lastekaitseseadus', 'Sotsiaalseadustiku üldosa seadus', 'Tsiviilkohtumenetluse seadustik'].map(title => committed.abbreviations[title]), ['SHS', 'LasteKS', 'SÜS', 'TsMS']);
  // No abbreviation twice, each as the check reads one: letters only, at least two capitals, the last an S.
  assert.equal(new Set(short.filter(Boolean)).size, 36);
  for (const value of short.filter(Boolean)) assert.match(value, /^(?=\p{L}*\p{Lu}\p{L}*S$)\p{L}{2,8}$/u, value);
  assert.deepEqual(titles, [...titles].sort((a, b) => (a < b ? -1 : 1)));
});

test('the generator: a law by its own metadata, one abbreviation a title, none shared; a regulation is not listed', () => {
  const xml = (kind, short) => `<?xml version="1.0"?><oigusakt><metaandmed><valjaandja>X</valjaandja><dokumentLiik>${kind}</dokumentLiik>${short ? `<lyhend>${short}</lyhend>` : ''}</metaandmed><sisu><lyhend>EI</lyhend></sisu></oigusakt>`;
  const files = { 'a.xml': xml('seadus', 'FTS'), 'a2.xml': xml('seadus', 'FTS'), 'a3.xml': xml('seadus', null), 'b.xml': xml('seadus', null), 'c.xml': xml('määrus', 'FKK'), 'd.xml': xml('seadus', 'FKS'), 'e.xml': xml('seadus', 'FTS'), 'f.xml': xml('seadus', 'FXS') };
  const read = source => files[source], act = (title, source_path) => ({ title, source_path });
  // Versions of one law agree (one of them without the field); a law without an abbreviation is listed with null; a
  // regulation is left out; the field is read from the metadata only, not from the act's text.
  assert.deepEqual(actAbbreviations([act('Fiktiivsete toetuste seadus', 'a.xml'), act('Fiktiivne lühendita seadus', 'b.xml'), act('Fiktiivse toetuse kord', 'c.xml'), act('Fiktiivsete toetuste seadus', 'a3.xml'),
    act('Fiktiivse kaitse seadus', 'd.xml'), act('Fiktiivsete toetuste seadus', 'a2.xml')], read),
  { schema_version: 'rag-v2/act-abbreviations-1', source: 'Riigi Teataja XML: /oigusakt/metaandmed/lyhend', abbreviations: { 'Fiktiivne lühendita seadus': null, 'Fiktiivse kaitse seadus': 'FKS', 'Fiktiivsete toetuste seadus': 'FTS' } });
  // The same whichever version comes first.
  assert.equal(actAbbreviations([act('Fiktiivsete toetuste seadus', 'a3.xml'), act('Fiktiivsete toetuste seadus', 'a.xml')], read).abbreviations['Fiktiivsete toetuste seadus'], 'FTS');
  // The check would take one law for another: the run stops.
  assert.throws(() => actAbbreviations([act('Fiktiivsete toetuste seadus', 'a.xml'), act('Fiktiivsete toetuste seadus', 'f.xml')], read), /two abbreviations for one title/u);
  assert.throws(() => actAbbreviations([act('Fiktiivsete toetuste seadus', 'a.xml'), act('Fiktiivne teine seadus', 'e.xml')], read), /one abbreviation for two titles/u);
});

// Evidence entries as the search gives them: a law of the table, a regulation and a guide that shares a law's title.
const entry = (doc, number, title, extra = {}) => ({ evidence_id: `${doc}-e${number}`, document_id: doc, document_version_id: `${doc}-v`, unit_id: `${doc}-u${number}`, chunk_id: `${doc}-c${number}`,
  span_ids: [`${doc}-s${number}`], pdf_pages: [], source_locations: [{ kind: 'xml', path: `/oigusakt[1]/sisu[1]/paragrahv[${number}]`, source_unit_id: `${doc}-unit${number}`, start: 0, end: 40 }],
  source_text: `§ ${900 + number}.\nNäidissäte ${number}.`, bibliography: { title, authors: [], publication_date: '2026-06-01' },
  source_metadata: { source_type: { value: 'legal_act' }, valid_from: { value: '2026-06-03' } }, selection: { reason: 'ranked_seed' }, limitations: [], legal_place: { section: String(900 + number), subsections: [] }, ...extra });
const scope = { tenant: 't', query_id: 'q', generation_id: 'g' };

test('the card of a law with a labelled excerpt carries act_abbreviation, only in the context a turn sends and outside every budget', () => {
  assert.equal(MODEL_SERIALIZER, 'rag-v2/model-context-json-5');
  const law = [entry('shs', 1, 'Sotsiaalhoolekande seadus'), entry('shs', 2, 'Sotsiaalhoolekande seadus')], rule = entry('kord', 1, 'Fiktiivse toetuse andmise kord'), budget = entry('res', 1, '2026. aasta riigieelarve seadus');
  // A guide that shares the law's title has no label and gets none; neither does a law's passage stored before the label.
  const guide = entry('juhend', 1, 'Lastekaitseseadus', { legal_place: undefined, source_metadata: { source_type: { value: 'guide' } } }), unlabelled = entry('pks', 1, 'Perekonnaseadus', { legal_place: undefined });
  const evidence = [law[0], rule, law[1], budget, guide, unlabelled], sent = modelProjection(evidence, scope), plain = modelProjection(evidence, scope, { annotations: false });
  // One for a card, after everything else the card holds; the law without an abbreviation and the regulation have none.
  assert.deepEqual(Object.entries(sent.context.sources).map(([key, card]) => [key, card.title, card.act_abbreviation ?? null, Object.keys(card).at(-1)]),
    [['D1', 'Sotsiaalhoolekande seadus', 'SHS', 'act_abbreviation'], ['D2', 'Fiktiivse toetuse andmise kord', null, 'valid_from'], ['D3', '2026. aasta riigieelarve seadus', null, 'valid_from'],
      ['D4', 'Lastekaitseseadus', null, 'source_type'], ['D5', 'Perekonnaseadus', null, 'valid_from']]);
  assert.deepEqual(sent.measurements.act_abbreviations, { shown: 1, tokens: tokenCount(',"act_abbreviation":"SHS"') });
  // The label's own measurement keeps its shape (ADR-123); the abbreviation is counted beside it.
  assert.deepEqual(sent.measurements.legal_place, { tokens: sent.measurements.legal_place.tokens, limit: 300, shown: 4, omitted: 0 });
  // An annotation: not in a budget measure, a reference check or the audit packet's size; the references are the same.
  for (const options of [{ measure: 'budget' }, { measure: 'none' }, { measure: 'full', annotations: false }]) assert.equal(JSON.stringify(modelProjection(evidence, scope, options).context).includes('act_abbreviation'), false, JSON.stringify(options));
  assert.deepEqual(stripLegalDates(sent.context), plain.context);
  assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  assert.deepEqual(sent.references, plain.references);
  const packet = { ...scope, evidence, model_context: sent.context, reference_map: sent.references }, bare = { ...scope, evidence: evidence.map(({ legal_place: _place, ...item }) => item), model_context: plain.context, reference_map: plain.references };
  assert.equal(auditPacketBytes(packet), Buffer.byteLength(JSON.stringify(bare), 'utf8'));
  // Without a labelled entry of a law of the table there is no field and no measurement.
  const none = modelProjection([rule, budget, guide], scope);
  assert.equal(JSON.stringify(none.context).includes('act_abbreviation'), false);
  assert.equal(none.measurements.act_abbreviations, undefined);
  // The bound the comment in model-context.js states: no abbreviation of the table costs more than 10 tokens on a card.
  assert.equal(Math.max(...Object.values(committed.abbreviations).filter(Boolean).map(short => tokenCount(`,"act_abbreviation":${JSON.stringify(short)}`))), 10);
});
