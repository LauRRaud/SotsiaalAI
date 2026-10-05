import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';
import { makeChunks } from '../lib/rag-v2/chunking.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { actDates, chunkAmendments, legalDates, LEGAL_DATES_LIMITS } from '../lib/rag-v2/search/legal-dates.js';
import { modelProjection, serializeModelContext, LEGAL_DATES_TOKENS, MODEL_SERIALIZER } from '../lib/rag-v2/search/model-context.js';
import { mergeUnifiedPackets, UNIFIED_LIMITS, UNIFIED_RETRIEVAL_VERSION } from '../lib/rag-v2/search/unified.js';
import { DISCOVERY_SCHEMA } from '../lib/rag-v2/search/discovery.js';

// ADR-062, stage 2: how an act's amendment notes and own dates are shown to the answer model. Fictional acts read by the
// real reader (source-structure-v30) and chunker, fictional legal_text records, and 25 registered acts read from
// Andmebaasi as committed; no store, no network. The two acts of the 30.09 live check are in rag-v2-legal-dates.test.mjs.
const mark = (act, published, inForce) => `<avaldamismarge><RTosa>RT IV</RTosa><avaldamineKuupaev>${published}</avaldamineKuupaev><RTartikkel>7</RTartikkel><aktViide>${act}</aktViide></avaldamismarge><joustumine>${inForce}</joustumine>`;
const note = (inForce, { before = '', after = '', published = '2018-01-02', act = '400000000001' } = {}) => `<muutmismarge>${before ? `<tavatekst>${before}</tavatekst>` : ''}${mark(act, published, inForce)}${after ? `<tavatekst>${after}</tavatekst>` : ''}</muutmismarge>`;
const act = (body, { validFrom = '2026-09-04', history = '', after = '' } = {}) => '<oigusakt xmlns="fixture"><metaandmed><valjaandja>Fixture issuer</valjaandja><tekstiliik>terviktekst</tekstiliik>'
  + `<vastuvoetud><aktikuupaev>2018-05-15</aktikuupaev>${mark('418052018022', '2018-05-18', '2018-07-01')}</vastuvoetud><globaalID>fixture-789</globaalID>`
  + `<kehtivus><kehtivuseAlgus>${validFrom}</kehtivuseAlgus></kehtivus></metaandmed><aktinimi><nimi><pealkiri>Fictional benefits</pealkiri></nimi></aktinimi>${history}<sisu>${body}</sisu>${after}</oigusakt>`;
const section = (number, title, content) => `<paragrahv><kuvatavNr><![CDATA[§ ${number}. ]]></kuvatavNr><paragrahvPealkiri>${title}</paragrahvPealkiri>${content}</paragrahv>`;
const subsection = (number, text, notes = '') => `<loige><kuvatavNr>(${number})</kuvatavNr><sisuTekst><tavatekst>${text}</tavatekst></sisuTekst>${notes}</loige>`;
// A numbered subsection of opening words and points; `opening` is a note right after those words.
const listed = (number, points, opening = '') => `<loige><kuvatavNr><![CDATA[(${number})]]></kuvatavNr><sisuTekst><tavatekst>The fictional conditions are:</tavatekst></sisuTekst>${opening}${points}</loige>`;
const point = (number, text, notes = '') => `<alampunkt><kuvatavNr><![CDATA[${number}) ]]></kuvatavNr>${text ? `<sisuTekst><tavatekst>${text}</tavatekst></sisuTekst>` : ''}${notes}</alampunkt>`;
function read(xml) {
  const scope = { tenant_id: 'legal-date-rendering', document_version_id: 'version_fixture' }, config = { ...DEFAULT_CONFIG };
  const { parsed, structured } = parseTextSource(Buffer.isBuffer(xml) ? xml : Buffer.from(xml), 'xml', {}, scope, config);
  const chunks = makeChunks({ ...structured, metadata: { title: parsed.source_metadata.title, retrieval_context: parsed.source_metadata.authority }, versionId: scope.document_version_id, scope, config });
  const bundle = { source_units: structured.source_units, document: { fields: { legal_text: { value: parsed.legal_text } } } };
  // The chunks of one section, in the text's order (a section's source unit starts with its number).
  const of = number => { const unit = structured.source_units.find(item => item.raw_text.startsWith(`§ ${number}.`)); return chunks.filter(chunk => chunk.source_locations.some(location => location.source_unit_id === unit?.id)); };
  return { bundle, chunks, of, legal: parsed.legal_text, warnings: structured.warnings };
}

const words = (number, sentences = 14) => Array.from({ length: sentences }, (_, at) => `Fictional subsection ${number} sentence ${at + 1} sets out a condition of the sample benefit in plain words.`).join(' ');
const labels = list => (list || []).flatMap(entry => entry?.provisions || []);

test('a provision split over several chunks is dated in each of them; a note after the heading is the heading\'s, in the chunk that holds the heading', () => {
  // Four subsections; (2) is long enough to span three chunks and carries a note, as does (3); the heading has its own.
  // No sentence repeats, so each chunk is found by its words. (4) carries none, so nothing closes the section.
  const { bundle, of, chunks } = read(act(section(1, 'Long section', note('2024-02-01') + subsection(1, words(1)) + subsection(2, words(2, 40), note('2025-01-01', { act: '400000000002' }))
    + subsection(3, words(3), note('2026-03-24', { act: '400000000003', after: ', rakendatakse alates 01.01.2026' })) + subsection(4, words(4)))
    + section(2, 'Short section', subsection(1, 'A fictional closing rule.'))));
  const parts = of(1), lists = parts.map(chunk => chunkAmendments(bundle, chunk)), holding = number => parts.map(chunk => chunk.source_text.includes(`Fictional subsection ${number} sentence`));
  assert(parts.length >= 4 && holding(2).filter(Boolean).length === 3, `the section is split and (2) spans three chunks (${holding(2)})`);
  // The heading's note says nothing of the subsections: it is the heading's, once, where the heading is.
  assert.deepEqual(lists[0], [{ provisions: ['§ 1 pealkiri'], in_force: '2024-02-01' }, { provisions: ['§ 1 lg 2'], in_force: '2025-01-01' }]);
  assert.deepEqual(lists.map(list => labels(list).includes('§ 1 pealkiri')), [true, ...parts.slice(1).map(() => false)]);
  assert(!labels(lists.flat()).includes('§ 1'));
  // A provision's note is in every chunk that holds a part of the provision, not only in the one that holds its end.
  for (const number of [2, 3]) assert.deepEqual(lists.map(list => labels(list).includes(`§ 1 lg ${number}`)), holding(number), `§ 1 lg ${number}`);
  for (const number of [1, 4]) assert(!labels(lists.flat()).includes(`§ 1 lg ${number}`));
  assert.equal(lists.at(-1), null, 'a chunk of a provision without a note has none');
  // The words of a note stay with its day.
  assert.deepEqual(lists.flat().find(entry => entry?.provisions.includes('§ 1 lg 3')), { provisions: ['§ 1 lg 3'], in_force: '2026-03-24', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' });
  // A chunk that ends with the provision's number alone holds no part of it; one that ends a character into its text does.
  const unit = bundle.source_units[0], marker = unit.raw_text.indexOf('(2)') + 3, range = (start, end) => ({ source_locations: [{ source_unit_id: unit.id, path: unit.locator.path, start, end }] });
  assert.deepEqual([labels(chunkAmendments(bundle, range(100, marker))), labels(chunkAmendments(bundle, range(100, marker + 3)))], [[], ['§ 1 lg 2']]);
  assert.deepEqual(labels(chunkAmendments(bundle, range(unit.amendments[1].offset, unit.amendments[1].offset + 50))), ['§ 1 lg 3'], 'a chunk that starts at the note is past its provision and in the next');
  // The other section has no note, so its excerpt gets none, and no chunk's text holds a note.
  assert.equal(chunkAmendments(bundle, of(2)[0]), null);
  assert(chunks.every(chunk => !/RT IV|40000000000\d/u.test(chunk.source_text)));
});

test('the note that closes a section: the whole section\'s with its twin after the heading or under an added number, the last provision\'s or the section\'s under a plain number', () => {
  const body = (closing, { heading = '', second = '', long = 3 } = {}) => heading + subsection(1, words(1, long)) + subsection(2, words(2, long), second) + subsection(3, words(3, long), closing);
  const X = { act: '400000000002' }, Y = { act: '400000000003' };
  const { bundle, of, legal } = read(act([
    // § 1: the amendment's only two notes stand after the heading and at the end: the section was reworded as a whole
    // (Kohtla-Järve 412122024021 § 31).
    section(1, 'Reworded', body(note('2024-12-15', { ...X, after: ', rakendatakse alates 1.01.2024' }), { heading: note('2024-12-15', { ...X, after: ', rakendatakse alates 1.01.2024' }), long: 20 })),
    // § 2: the same amendment also marked a subsection of its own, so it marked what it changed one by one.
    section(2, 'Piece by piece', body(note('2024-12-15', X), { heading: note('2024-12-15', X), second: note('2024-12-15', X) })),
    // § 3¹ and § 3²: a number with a superscript is an added section, and the note that closes it is the one that added
    // it; a later note of another subsection stays that subsection's. § 3³ closes in a point.
    section('3<sup>1</sup>', 'Added', body(note('2026-09-04', Y), { long: 20 })),
    section('3<sup>2</sup>', 'Added and amended', body(note('2021-01-08', X), { second: note('2026-09-04', Y) })),
    section('3<sup>3</sup>', 'Added, ending in points', subsection(1, 'A fictional rule.') + `<loige><kuvatavNr>(2)</kuvatavNr><sisuTekst><tavatekst>The fictional points are:</tavatekst></sisuTekst>${point(1, 'a first point;')}${point(2, 'a last point.', note('2021-01-08', X))}</loige>`),
    // § 3⁴: an older note elsewhere shows the section stood before its closing note, which is then the last subsection's.
    section('3<sup>4</sup>', 'Added earlier', body(note('2026-09-04', Y), { second: note('2021-01-08', X) })),
    // § 4: a plain number: the last subsection's note or the whole section's, which one version cannot tell (Tori 430092026027 § 9).
    section(4, 'Plain', body(note('2026-09-04', Y), { long: 20 })),
    // § 5 and § 6: an older note, or another of the same amendment, makes it the last subsection's own.
    section(5, 'Plain, older note', body(note('2026-09-04', Y), { second: note('2021-01-08', X) })),
    section(6, 'Plain, same amendment', body(note('2026-09-04', Y), { second: note('2026-09-04', Y) })),
    // § 7: a newer note elsewhere tells nothing of the closing one.
    section(7, 'Plain, newer note', body(note('2021-01-08', X), { second: note('2026-09-04', Y) })),
    // § 8: the heading's note with a closing note of the same amendment, and an older note between: the section stood.
    section(8, 'Heading and last subsection', body(note('2026-09-04', Y), { heading: note('2026-09-04', Y), second: note('2021-01-08', X) })),
    // § 9: the heading's note has words of its own that the closing one of the same amendment does not say: no pair
    // (lastekaitseseadus 111072026042 § 27²: "muudetud paragrahvi number 27¹ numbriks 27²").
    section(9, 'Renumbered', body(note('2024-12-15', X), { heading: note('2024-12-15', { ...X, after: ', muudetud paragrahvi number 8 numbriks 9' }) })),
  ].join('')));
  const lists = number => of(number).map(chunk => chunkAmendments(bundle, chunk));
  const every = (number, entry) => { const all = lists(number); assert(all.length > 1, `§ ${number} is split`); for (const list of all) assert.deepEqual(list[0], entry, `§ ${number}`); return all; };
  const whole = every(1, { provisions: ['§ 1'], in_force: '2024-12-15', applies_from: '2024-01-01', note: 'rakendatakse alates 1.01.2024' });
  assert.deepEqual(whole.map(list => list.length), whole.map(() => 1), 'the pair is one entry: neither the heading nor the last subsection is named beside it');
  assert.deepEqual(lists(2), [[{ provisions: ['§ 2 pealkiri', '§ 2 lg 2', '§ 2 lg 3'], in_force: '2024-12-15' }]]);
  every('3¹', { provisions: ['§ 3¹'], in_force: '2026-09-04' });
  assert.deepEqual(lists('3²'), [[{ provisions: ['§ 3²'], in_force: '2021-01-08' }, { provisions: ['§ 3² lg 2'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists('3³'), [[{ provisions: ['§ 3³'], in_force: '2021-01-08' }]]);
  assert.deepEqual(lists('3⁴'), [[{ provisions: ['§ 3⁴ lg 2'], in_force: '2021-01-08' }, { provisions: ['§ 3⁴ lg 3'], in_force: '2026-09-04' }]]);
  every(4, { provisions: ['§ 4 lg 3 või kogu § 4'], in_force: '2026-09-04' });
  assert.deepEqual(lists(5), [[{ provisions: ['§ 5 lg 2'], in_force: '2021-01-08' }, { provisions: ['§ 5 lg 3'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(6), [[{ provisions: ['§ 6 lg 2', '§ 6 lg 3'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(7), [[{ provisions: ['§ 7 lg 3 või kogu § 7'], in_force: '2021-01-08' }, { provisions: ['§ 7 lg 2'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(8), [[{ provisions: ['§ 8 pealkiri', '§ 8 lg 3'], in_force: '2026-09-04' }, { provisions: ['§ 8 lg 2'], in_force: '2021-01-08' }]]);
  assert.deepEqual(lists(9), [[{ provisions: ['§ 9 pealkiri'], in_force: '2024-12-15', note: 'muudetud paragrahvi number 8 numbriks 9' }, { provisions: ['§ 9 lg 3'], in_force: '2024-12-15' }]]);
  // The card names what the version's first day changed as the excerpts name it: the reader's labels are the last
  // subsection's ("§ 3¹ lg 3", "§ 4 lg 3"), which alone would leave the rest of those sections to the act's first day.
  assert.deepEqual(legal.version_change.provisions, ['§ 3¹ lg 3', '§ 3² lg 2', '§ 3⁴ lg 3', '§ 4 lg 3', '§ 5 lg 3', '§ 6 lg 2', '§ 6 lg 3', '§ 7 lg 2', '§ 8', '§ 8 lg 3']);
  assert.deepEqual(actDates(legal, bundle.source_units).changed_on_valid_from, ['§ 3¹', '§ 3² lg 2', '§ 3⁴ lg 3', '§ 4 lg 3 või kogu § 4', '§ 5 lg 3', '§ 6 lg 2', '§ 6 lg 3', '§ 7 lg 2', '§ 8 pealkiri', '§ 8 lg 3']);
  assert.deepEqual(actDates(legal).changed_on_valid_from, legal.version_change.provisions, 'without the units the reader\'s labels stay');
});

test('the note that closes a numbered subsection, kept in its last point: the subsection\'s under an added number, the point\'s or the subsection\'s under a plain one', () => {
  const X = { act: '400000000002' }, Y = { act: '400000000003' }, old = note('2021-01-08', X), now = note('2026-09-04', Y), mid = note('2025-03-01', { act: '400000000004' });
  const rule = subsection(9, 'A fictional rule after the list.');
  const { bundle, of, legal } = read(act([
    // § 1: both instalments of a grant were raised and the one note stands in the last point (Türi 411062026105 § 91
    // lg 2). One version cannot tell that from a change to point 2 alone: the label says both, in every chunk of lg 2.
    section(1, 'Plain', subsection(1, words(1, 20)) + listed(2, point(1, words('2a', 40)) + point(2, 'a last instalment of 500 euros.', now)) + subsection(3, words(3, 20))),
    // § 2: a subsection under an added number was added by the note that closes it (the state fees act's § 142⁴⁷ lg 3¹).
    section(2, 'Added subsection', subsection(1, 'A fictional rule.') + listed('1<sup>1</sup>', point(1, 'a first point;') + point(2, 'a last point.', now)) + rule),
    // § 3 and § 4: an older note in the subsection, or another point's of the same amendment, makes it the point's own.
    section(3, 'Older note', listed(1, point(1, 'a first point;', old) + point(2, 'a last point.', now)) + rule),
    section(4, 'Point by point', listed(1, point(1, 'a first point;', now) + point(2, 'a second point;') + point(3, 'a last point.', now)) + rule),
    // § 5 and § 6: a note after the opening words is about those words, and does not make the closing one the point's own.
    section(5, 'Opening words and the end', listed(1, point(1, 'a first point;') + point(2, 'a last point.', now), now) + rule),
    section(6, 'Opening words', listed(1, point(1, 'a first point;') + point(2, 'a last point.'), now) + rule),
    // § 7 and § 8: points left empty after the note hold no text, so the note still closes the subsection; the repeal
    // of one by the same amendment shows the amendment marked its points one by one (lastekaitseseadus 111072026043 § 15 lg 2).
    section(7, 'Empty point, same amendment', listed(1, point(1, 'a first point;') + point(2, 'a last point.', mid) + point(3, '', note('2025-03-01', { act: '400000000004', before: 'kehtetu - ' }))) + rule),
    section(8, 'Empty point, later repeal', listed(1, point(1, 'a first point;') + point(2, 'a last point.', old) + point(3, '', note('2025-03-01', { act: '400000000004', before: 'kehtetu - ' }))) + rule),
    // § 9: the note closes the section too, which the same amendment marked piece by piece; its subsection it did not.
    section(9, 'Last subsection', subsection(1, 'A fictional rule.', now) + listed(2, point(1, 'a first point;') + point(2, 'a last point.', now))),
    // § 10: opening words left alone when the points under them were emptied: the note is the subsection's (403032026033 § 74 lg 1).
    section(10, 'Emptied points', listed(1, point(1, '', note('2021-01-08', { ...X, before: 'kehtetu - ' })) + point(2, '', note('2021-01-08', { ...X, before: 'kehtetu - ' })), now) + rule),
  ].join('')));
  const lists = number => of(number).map(chunk => chunkAmendments(bundle, chunk));
  // The whole subsection's label is in every chunk that holds a part of the subsection and in no other.
  const plain = of(1), either = { provisions: ['§ 1 lg 2 p 2 või kogu § 1 lg 2'], in_force: '2026-09-04' };
  const holds = plain.map(chunk => /Fictional subsection 2a sentence|The fictional conditions are|a last instalment/u.test(chunk.source_text));
  assert(holds.filter(Boolean).length >= 3 && holds.includes(false), `lg 2 is split and other chunks hold none of it (${holds})`);
  assert.deepEqual(lists(1), holds.map(held => (held ? [either] : null)));
  assert.deepEqual(lists(2), [[{ provisions: ['§ 2 lg 1¹'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(3), [[{ provisions: ['§ 3 lg 1 p 1'], in_force: '2021-01-08' }, { provisions: ['§ 3 lg 1 p 2'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(4), [[{ provisions: ['§ 4 lg 1 p 1', '§ 4 lg 1 p 3'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(5), [[{ provisions: ['§ 5 lg 1 sissejuhatav lauseosa', '§ 5 lg 1 p 2 või kogu § 5 lg 1'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(6), [[{ provisions: ['§ 6 lg 1 sissejuhatav lauseosa'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(7), [[{ provisions: ['§ 7 lg 1 p 2'], in_force: '2025-03-01' }, { provisions: ['§ 7 lg 1 p 3'], repealed_from: '2025-03-01' }]]);
  assert.deepEqual(lists(8), [[{ provisions: ['§ 8 lg 1 p 2 või kogu § 8 lg 1'], in_force: '2021-01-08' }, { provisions: ['§ 8 lg 1 p 3'], repealed_from: '2025-03-01' }]]);
  assert.deepEqual(lists(9), [[{ provisions: ['§ 9 lg 1', '§ 9 lg 2 p 2 või kogu § 9 lg 2'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists(10), [[{ provisions: ['§ 10 lg 1'], in_force: '2026-09-04' }, { provisions: ['§ 10 lg 1 p 1', '§ 10 lg 1 p 2'], repealed_from: '2021-01-08' }]]);
  // The card names what the version's first day changed as the excerpts do.
  assert.deepEqual(legal.version_change.provisions, ['§ 1 lg 2 p 2', '§ 2 lg 1¹ p 2', '§ 3 lg 1 p 2', '§ 4 lg 1 p 1', '§ 4 lg 1 p 3', '§ 5 lg 1', '§ 5 lg 1 p 2', '§ 6 lg 1', '§ 9 lg 1', '§ 9 lg 2 p 2', '§ 10 lg 1']);
  assert.deepEqual(actDates(legal, bundle.source_units).changed_on_valid_from, ['§ 1 lg 2 p 2 või kogu § 1 lg 2', '§ 2 lg 1¹', '§ 3 lg 1 p 2', '§ 4 lg 1 p 1', '§ 4 lg 1 p 3', '§ 5 lg 1 sissejuhatav lauseosa',
    '§ 5 lg 1 p 2 või kogu § 5 lg 1', '§ 6 lg 1 sissejuhatav lauseosa', '§ 9 lg 1', '§ 9 lg 2 p 2 või kogu § 9 lg 2', '§ 10 lg 1']);
});

test('an added section\'s earliest note is the one that added it, also where it stands after the heading', () => {
  const X = { act: '400000000002' }, Y = { act: '400000000003' }, old = note('2021-01-08', X), now = note('2026-09-04', Y);
  const body = (heading, { first = '', last = '', long = 3 } = {}) => heading + subsection(1, words(1, long), first) + subsection(2, words(2, long)) + subsection(3, words(3, long), last);
  const { bundle, of, legal } = read(act([
    // § 1¹: the section did not stand before its heading's note, the only one of its amendment (Rapla 405092026058
    // § 52¹): the note dates every subsection, in every chunk; a later note of one subsection stays that subsection's.
    section('1<sup>1</sup>', 'Added by the heading\'s note', body(old, { last: now, long: 20 })),
    // § 1²: the same amendment marked a subsection too, so it marked what it changed piece by piece.
    section('1<sup>2</sup>', 'Heading and a subsection', body(now, { first: now })),
    // § 1³: an older note shows the section stood before the heading's.
    section('1<sup>3</sup>', 'Heading amended later', body(now, { first: old })),
    // § 1⁴: the closing note of another amendment of the same day already tells the whole section.
    section('1<sup>4</sup>', 'Whole section told beside', body(old, { last: note('2021-01-08', { act: '400000000005' }) })),
    // § 2: under a plain number a heading's note is the heading's.
    section(2, 'Plain', body(now)),
  ].join('')));
  const lists = number => of(number).map(chunk => chunkAmendments(bundle, chunk));
  const third = of('1¹').map(chunk => chunk.source_text.includes('Fictional subsection 3 sentence'));
  assert(third.length > 2 && third.includes(false), `§ 1¹ is split (${third})`);
  assert.deepEqual(lists('1¹'), third.map(held => [{ provisions: ['§ 1¹'], in_force: '2021-01-08' }, ...(held ? [{ provisions: ['§ 1¹ lg 3'], in_force: '2026-09-04' }] : [])]));
  assert.deepEqual(lists('1²'), [[{ provisions: ['§ 1² pealkiri', '§ 1² lg 1'], in_force: '2026-09-04' }]]);
  assert.deepEqual(lists('1³'), [[{ provisions: ['§ 1³ pealkiri'], in_force: '2026-09-04' }, { provisions: ['§ 1³ lg 1'], in_force: '2021-01-08' }]]);
  assert.deepEqual(lists('1⁴'), [[{ provisions: ['§ 1⁴', '§ 1⁴ pealkiri'], in_force: '2021-01-08' }]]);
  assert.deepEqual(lists(2), [[{ provisions: ['§ 2 pealkiri'], in_force: '2026-09-04' }]]);
  assert.deepEqual(actDates(legal, bundle.source_units).changed_on_valid_from, ['§ 1¹ lg 3', '§ 1² pealkiri', '§ 1² lg 1', '§ 1³ pealkiri', '§ 2 pealkiri']);
});

test('an unnumbered subsection: the note after its opening words is theirs, the one that closes it is the section\'s', () => {
  const list = (opening, closing = '') => `<loige><kuvatavNr/><sisuTekst><tavatekst>The fictional rates are:</tavatekst></sisuTekst>${opening}${point(1, 'a first rate;', note('2025-01-01'))}${point(2, 'a second rate;')}${closing}</loige>`;
  const { bundle, of } = read(act(section(1, 'Rates', note('2023-07-01', { act: '400000000002' }) + list(note('2025-01-01')))
    + section(2, 'Limits', note('2023-07-01', { act: '400000000002' }) + list('', note('2025-06-01', { act: '400000000003' })))));
  // Tallinn 423052026004 § 2 and § 4¹: the reader names all three kinds "§ N"; shown so, one excerpt gave "§ 4¹" two days.
  assert.deepEqual(bundle.source_units.map(unit => unit.amendments.map(item => item.provision)), [['§ 1', '§ 1', '§ 1 p 1'], ['§ 2', '§ 2 p 1', '§ 2']]);
  assert.deepEqual(chunkAmendments(bundle, of(1)[0]), [{ provisions: ['§ 1 pealkiri'], in_force: '2023-07-01' }, { provisions: ['§ 1 sissejuhatav lauseosa', '§ 1 p 1'], in_force: '2025-01-01' }]);
  assert.deepEqual(chunkAmendments(bundle, of(2)[0]), [{ provisions: ['§ 2'], in_force: '2025-06-01' }, { provisions: ['§ 2 pealkiri'], in_force: '2023-07-01' }, { provisions: ['§ 2 p 1'], in_force: '2025-01-01' }]);
});

test('a division\'s note: an added division (a superscript number) dates the sections under it; any other division\'s note is about its heading, but for an added section without a note', () => {
  // The state fees act's shape: a chapter whose note is of 2025 over sections that carry none (the act is of 2015), and
  // a division added later, two of whose sections have no note of their own.
  const applied = { act: '400000000002', after: ', rakendatakse alates 01.01.2025' };
  const body = `<peatykk><kuvatavNr>2. peatükk</kuvatavNr><peatykkPealkiri>Old chapter</peatykkPealkiri>${note('2025-01-01')}`
    + section(1, 'Under the chapter', subsection(1, 'A fictional rule that the chapter\'s new heading did not change.')) + '</peatykk>'
    + `<peatykk><kuvatavNr>3. peatükk</kuvatavNr><peatykkPealkiri>Services</peatykkPealkiri><jagu><kuvatavNr><![CDATA[10<sup>1</sup>. jagu]]></kuvatavNr><jaguPealkiri>Added service</jaguPealkiri>${note('2021-01-08')}`
    + section(2, 'Added without a note', subsection(1, `A fictional rule of the added division. ${'It says the same once more in other words. '.repeat(60)}`))
    + section(3, 'Added, short', subsection(1, 'Another fictional rule of the added division.'))
    + section(4, 'Added and amended', subsection(1, 'A fictional rule amended later.', note('2024-12-09')) + subsection(2, 'A fictional rule as the division brought it.')) + '</jagu></peatykk>'
    // Märjamaa 421032026022's shape: a division under a plain number, added with its sections. The note stands on the
    // division and on the last section; the sections before it carry none, and their numbers say they were added.
    + `<peatykk><kuvatavNr>4. peatükk</kuvatavNr><peatykkPealkiri>Later services</peatykkPealkiri>${note('2019-05-01', { act: '400000000003' })}<jagu><kuvatavNr>15. jagu</kuvatavNr><jaguPealkiri>New service</jaguPealkiri>${note('2025-06-30', applied)}`
    + section(5, 'Plain, under the same division', subsection(1, 'A fictional rule that stood before the division\'s note.'))
    + section('5<sup>1</sup>', 'Added without a note', subsection(1, `A fictional rule of the new service. ${'It says the same once more in other words. '.repeat(60)}`))
    + section('5<sup>2</sup>', 'Added, with the note', subsection(1, 'The last fictional rule of the new service.', note('2025-06-30', applied))) + '</jagu>'
    + section('6<sup>1</sup>', 'Added under the chapter alone', subsection(1, 'A fictional rule added to the chapter.')) + '</peatykk>';
  const { bundle, of, legal } = read(act(body));
  assert.deepEqual(legal.structure.map(item => [item.target, item.in_force]), [['2. peatükk Old chapter', '2025-01-01'], ['10¹. jagu Added service', '2021-01-08'], ['4. peatükk Later services', '2019-05-01'], ['15. jagu New service', '2025-06-30']]);
  assert.equal(chunkAmendments(bundle, of(1)[0]), null, 'a chapter note of 2025 is not the day of a section of 2015');
  // A section with no note of its own gets its day from the added division, in each of its chunks.
  assert(of(2).length > 1);
  for (const chunk of [...of(2), ...of(3)]) assert.deepEqual(chunkAmendments(bundle, chunk), [{ provisions: ['10¹. jagu Added service'], in_force: '2021-01-08' }]);
  // A section amended since: the division's day, then the section's own note.
  assert.deepEqual(chunkAmendments(bundle, of(4)[0]), [{ provisions: ['10¹. jagu Added service'], in_force: '2021-01-08' }, { provisions: ['§ 4 lg 1'], in_force: '2024-12-09' }]);
  // An added section without a note of its own gets the note of the nearest division above that has one, with its day
  // of application and words, in each of its chunks: the division's, not the chapter's over it. A plain-numbered
  // section under the same division gets none, and an added one with its own note only its own.
  const division = { provisions: ['15. jagu New service'], in_force: '2025-06-30', applies_from: '2025-01-01', note: 'rakendatakse alates 01.01.2025' };
  assert(of('5¹').length > 1);
  for (const chunk of of('5¹')) assert.deepEqual(chunkAmendments(bundle, chunk), [division]);
  assert.equal(chunkAmendments(bundle, of(5)[0]), null);
  assert.deepEqual(chunkAmendments(bundle, of('5²')[0]), [{ ...division, provisions: ['§ 5²'] }]);
  assert.deepEqual(chunkAmendments(bundle, of('6¹')[0]), [{ provisions: ['4. peatükk Later services'], in_force: '2019-05-01' }]);
});

test('a repeal is shown as one, also where the text does not say it: lower case, "välja jäetud", the word misspelt; a note without the word on an empty provision is not one', () => {
  const day = '2023-03-04';
  const { bundle, of } = read(act(section(1, 'Points', `<loige><kuvatavNr/><sisuTekst><tavatekst>The fictional points are:</tavatekst></sisuTekst>${
    point(1, '', note(day, { before: 'Kehtetu - ' }))}${point(2, '', note(day, { before: 'kehtetu - ' }))}${point(3, '', note(day, { before: 'välja jäetud - ' }))}${
    point(4, '', note(day, { before: 'Kehetu - ' }))}${point(5, '', note(day, { before: 'Kehtetu - ', after: ', rakendatakse alates 01.01.2023' }))}${
    point(6, 'a fictional point in force;', note(day))}${point(7, '', note('2023-05-06', { act: '400000000002' }))}${point(8, '', note('2023-05-06', { act: '400000000002', after: ', rakendatakse alates 01.06.2023' }))}</loige>`)));
  const [chunk] = of(1), text = chunk.source_text;
  // The text reads only the capital form as "Kehtetu." (ADR-034); the reader marks the three wordings and leaves the
  // misspelt one as words. A note on a point without text that says nothing of a repeal (411062026102 § 13¹) carries no mark.
  assert.equal((text.match(/Kehtetu\./gu) || []).length, 2);
  assert.deepEqual(bundle.source_units[0].amendments.map(item => [item.provision, item.repeal ?? false, item.note ?? null]),
    [['§ 1 p 1', true, null], ['§ 1 p 2', true, null], ['§ 1 p 3', true, null], ['§ 1 p 4', false, 'Kehetu'], ['§ 1 p 5', true, 'rakendatakse alates 01.01.2023'], ['§ 1 p 6', false, null],
      ['§ 1 p 7', false, null], ['§ 1 p 8', false, 'rakendatakse alates 01.06.2023']]);
  // Only a note that says so is a repeal: one on an empty point, with words of its own or without any, stays an
  // amendment with its day. Read as a repeal, the wordless one gave the day the point entered into force as its end.
  assert.deepEqual(chunkAmendments(bundle, chunk), [{ provisions: ['§ 1 p 1', '§ 1 p 2', '§ 1 p 3', '§ 1 p 4'], repealed_from: day },
    { provisions: ['§ 1 p 5'], repealed_from: day, applies_from: '2023-01-01', note: 'rakendatakse alates 01.01.2023' }, { provisions: ['§ 1 p 6'], in_force: day },
    { provisions: ['§ 1 p 7'], in_force: '2023-05-06' }, { provisions: ['§ 1 p 8'], in_force: '2023-05-06', applies_from: '2023-06-01', note: 'rakendatakse alates 01.06.2023' }]);
});

test('a note whose day the reader left out names none, and a version change with no provision recorded shows nothing (Haljala\'s shape)', () => {
  // The amending act entered into force on the version's first day; its only note carries a day two years before its
  // publication, which the reader leaves out. What that day changed is then not known, which is not "nothing".
  const history = `<muutmismarge><aktikuupaev>2022-01-20</aktikuupaev>${mark('429012022005', '2022-01-29', '2022-02-01')}</muutmismarge>`;
  const { bundle, of, legal, warnings } = read(act(section(1, 'Rates', `<loige><kuvatavNr/><sisuTekst><tavatekst>The fictional rates are:</tavatekst></sisuTekst>${
    point(4, 'a fictional rate;', note('2020-02-01', { published: '2022-01-29', act: '429012022005', after: ', rakendatakse alates 1.01.2022' }))}</loige>`)
    + section(2, 'Entry', subsection(1, 'Määrus jõustub 1. juulil 2018.')), { validFrom: '2022-02-01', history }));
  assert(warnings.some(warning => warning.code === 'amendment_note_in_force_before_publication'));
  // The note closes its section; without a day it is not read as the section's.
  assert.deepEqual(chunkAmendments(bundle, of(1)[0]), [{ provisions: ['§ 1 p 4'], applies_from: '2022-01-01', note: 'rakendatakse alates 1.01.2022' }]);
  assert.deepEqual(legal.version_change, { in_force: '2022-02-01', acts: ['429012022005'], provisions: [] });
  assert.deepEqual(actDates(legal, bundle.source_units), { act_in_force_from: '2018-07-01', entry_into_force: [{ provision: '§ 2 lg 1', text: 'Määrus jõustub 1. juulil 2018.' }] });
});

const real = async number => read(await fs.readFile(path.join('Andmebaasi', 'oigusaktid', `${number}.xml`)));
const notes = ({ bundle, of }, number) => of(number).map(chunk => chunkAmendments(bundle, chunk));
const cardOf = ({ bundle, legal }) => actDates(legal, bundle.source_units);

test('registered acts: the state fees act\'s chapter note dates no section under it, an added division dates its sections, a repeal the text does not show is shown', async () => {
  // Riigilõivuseadus 111072026166: the 5th chapter's note is of 01.01.2025 (its heading); §§ 72, 74 and 75 under it carry
  // no note and the act is of 2015. Tied to the chunks below it, the note would give them a wrong day.
  const fees = await real('111072026166');
  assert.deepEqual(fees.legal.structure.filter(item => item.target.startsWith('5. peatükk')).map(item => item.in_force), ['2025-01-01']);
  for (const number of [72, 74, 75]) assert.deepEqual(notes(fees, number), [null], `§ ${number}`);
  assert.deepEqual(cardOf(fees).entry_into_force, [{ provision: '§ 372 lg 1', text: 'Käesolev seadus jõustub 2015. aasta 1. jaanuaril.' }]);
  // § 53: the note after the heading has no twin at the section's end, so it is the heading's; "põhihariduse puhul 500
  // eurot" under it carries no note and is not dated by it.
  assert.deepEqual(notes(fees, 53), [[{ provisions: ['§ 53 pealkiri'], in_force: '2025-09-01' }, { provisions: ['§ 53 lg 1 p 1'], repealed_from: '2025-09-01' },
    { provisions: ['§ 53 lg 1 p 4'], repealed_from: '2015-07-01' }, { provisions: ['§ 53 lg 2'], in_force: '2019-09-01' }]]);
  // § 298⁴: the last subsection carries two notes. The older one added the section; the newer is a Supreme Court ruling
  // on subsections 2 and 3, whose words say what it struck and are kept whole (cut at 160 they stop before that).
  const [[added, ruling]] = notes(fees, '298⁴');
  assert.deepEqual([added, { ...ruling, note: undefined }], [{ provisions: ['§ 298⁴'], in_force: '2025-01-01' }, { provisions: ['§ 298⁴ lg 2', '§ 298⁴ lg 3'], in_force: '2026-05-07', note: undefined }]);
  assert(ruling.note.length > 200 && ruling.note.startsWith('Riigikohtu põhiseaduslikkuse järelevalve kolleegiumi otsus') && ruling.note.endsWith('sigarite tootjatele ja importijatele.'), ruling.note);
  // Harku 404072025017: §§ 34¹ and 34² have no note of their own; the division added with them (10¹. jagu) dates them.
  // The record's day (11.04.2016) is before the publication its adoption names (06.12.2024), so the card shows the act's
  // own sentence and not that day.
  const harku = await real('404072025017');
  for (const number of ['34¹', '34²']) assert.deepEqual(notes(harku, number), [[{ provisions: ['10¹. jagu Varjupaigateenus'], in_force: '2021-01-08', applies_from: '2021-01-01', note: 'rakendatakse alates 1.01.2021' }]], `§ ${number}`);
  for (const number of ['34⁷', '34⁸', '34⁹']) assert.deepEqual(notes(harku, number), [[{ provisions: ['10³. jagu Asendushooldusteenus'], in_force: '2024-12-09' }]], `§ ${number}`);
  const card = cardOf(harku);
  assert.deepEqual([card.act_in_force_from, card.entry_into_force], [undefined, [{ provision: '§ 72', text: 'Määrust rakendatakse tagasiulatuvalt 1. aprillist 2016.' }]]);
  // §§ 22¹ and 24¹ were added too, under a plain-numbered division ("6. jagu Eluruumi tagamine") and without a note of
  // their own: the division's note is the only one their amendment left by them. Without it the card's one sentence
  // (1 April 2016) was all that dated them. § 22 beside them gets none; § 24², the division's last, carries its own.
  for (const number of ['22¹', '24¹']) assert.deepEqual(notes(harku, number), [[{ provisions: ['6. jagu Eluruumi tagamine'], in_force: '2024-12-09' }]], `§ ${number}`);
  assert.deepEqual([notes(harku, 22), notes(harku, '24²')], [[null], [[{ provisions: ['§ 24²'], in_force: '2024-12-09' }]]]);
  // Märjamaa 421032026022 (in force from 23.09.2024): "15. jagu Vaimse tervise teenus" came with §§ 88¹–88³ on 30.06.2025,
  // applied from 01.01.2025. The note stands on the division and on § 88³, its last section; §§ 88¹ and 88² carry none.
  const marjamaa = await real('421032026022'), service = { in_force: '2025-06-30', applies_from: '2025-01-01', note: 'rakendatakse alates 01.01.2025' };
  assert.deepEqual(['88¹', '88²', '88³', 88].map(number => notes(marjamaa, number)),
    [[[{ provisions: ['15. jagu Vaimse tervise teenus'], ...service }]], [[{ provisions: ['15. jagu Vaimse tervise teenus'], ...service }]], [[{ provisions: ['§ 88³'], ...service }]], [null]]);
  assert.equal(cardOf(marjamaa).act_in_force_from, '2024-09-23');
  // Sotsiaalhoolekande seadus 103062026023: § 115 reads only "§ 115." (its repeal note is not the capital word), so the
  // repeal is told by the note. Of the act's eight sentences on entry into force the card shows the act's own; its seven
  // transitional rules are too many to show whole and are counted.
  const welfare = await real('103062026023');
  assert.deepEqual([welfare.of(115).map(chunk => chunk.source_text), notes(welfare, 115)], [['§ 115.'], [[{ provisions: ['§ 115'], repealed_from: '2017-01-01' }]]]);
  assert.deepEqual([cardOf(welfare).entry_into_force.map(item => item.provision), cardOf(welfare).scoped_rules, cardOf(welfare).entry_into_force_more], [['§ 184 lg 1'], undefined, 7]);
  // § 71 lg 5 begins in the section's first chunk and ends in its second: both name its note; the third holds none of it.
  assert.deepEqual(notes(welfare, 71).map(list => labels(list).includes('§ 71 lg 5')), [true, true, false]);
  assert.deepEqual(welfare.of(71).map(chunk => /\(5\)\s+Isikule sobiva erihoolekandeteenuse osutaja/u.test(chunk.source_text)), [true, false, false]);
});

test('registered acts: a section reworded or added as a whole is dated in all its chunks and on the card, a heading\'s note dates the heading alone', async () => {
  // Kohtla-Järve 412122024021 § 31: the same note after the heading and after lg 11, the section's last.
  const kohtlaJarve = await real('412122024021'), birth = { provisions: ['§ 31'], in_force: '2024-12-15', applies_from: '2024-01-01', note: 'rakendatakse alates 1.01.2024' };
  assert.deepEqual(notes(kohtlaJarve, 31), [[birth], [birth]]);
  // Sotsiaalhoolekande seadus 130062026065, in force from 01.10.2026: §§ 13²–13⁴ and 155¹ are new and § 13¹ is reworded;
  // each carries one note, in its last subsection. § 13² lg 1–7 are in a chunk that note is not in.
  const welfare = await real('130062026065');
  assert.deepEqual(welfare.bundle.source_units.find(unit => unit.raw_text.startsWith('§ 13².')).amendments.map(item => item.provision), ['§ 13² lg 10']);
  assert.deepEqual(notes(welfare, '13²'), [[{ provisions: ['§ 13²'], in_force: '2026-10-01' }], [{ provisions: ['§ 13²'], in_force: '2026-10-01' }]]);
  assert.deepEqual(welfare.legal.version_change.provisions, ['§ 13¹ lg 4', '§ 13² lg 10', '§ 13³ lg 10', '§ 13⁴ lg 2', '§ 45¹ lg 1', '§ 155¹ lg 4']);
  assert.deepEqual(cardOf(welfare).changed_on_valid_from, ['§ 13¹', '§ 13²', '§ 13³', '§ 13⁴', '§ 45¹ lg 1', '§ 155¹']);
  // Tori 430092026027 § 9 (birth grant), valid from 03.10.2026: every subsection was rewritten and the one note is on the
  // last. Under a plain number that cannot be told from a change to lg 6 alone, and the label says so.
  const tori = await real('430092026027');
  assert.deepEqual(notes(tori, 9), [[{ provisions: ['§ 9 lg 6 või kogu § 9'], in_force: '2026-10-03' }]]);
  assert.deepEqual(cardOf(tori).changed_on_valid_from, ['§ 9 lg 6 või kogu § 9']);
  // Tallinn 417062026033 § 5: the heading and lg 1 changed on 14.06.2026; lg 2 and lg 3 did not, and are not dated by the heading.
  assert.deepEqual(notes(await real('417062026033'), 5), [[{ provisions: ['§ 5 pealkiri', '§ 5 lg 1'], in_force: '2026-06-14' }, { provisions: ['§ 5 lg 4', '§ 5 lg 5'], repealed_from: '2025-05-01' }]]);
  // Tallinn 423052026004 § 4¹: the heading's note and the text's, each under its own name.
  assert.deepEqual(notes(await real('423052026004'), '4¹'), [[{ provisions: ['§ 4¹'], in_force: '2025-01-01' }, { provisions: ['§ 4¹ pealkiri'], in_force: '2023-07-01' }]]);
  // Narva 428122019021 § 2 p 1: the ruling struck one clause of the point; its note is whole.
  const [[{ note: struck, ...narva }]] = notes(await real('428122019021'), 2);
  assert.deepEqual(narva, { provisions: ['§ 2 p 1'], in_force: '2019-12-09' });
  assert(struck.length > 400 && struck.endsWith('määratud keskmine, raske või sügav puue“.'), struck);
  // Tallinn 411062026102 § 13¹: three subsections left empty under the note of the act that added them on 01.01.2022 (the
  // version before, 410092025033, holds their text under the same note). No note says they were repealed, so none is
  // shown as a repeal: each keeps the day it entered into force. The heading's note is of the same amendment.
  assert.deepEqual(notes(await real('411062026102'), '13¹'), [[{ provisions: ['§ 13¹ pealkiri', '§ 13¹ lg 1', '§ 13¹ lg 2', '§ 13¹ lg 3'], in_force: '2022-01-01' }]]);
  // Lastekaitseseadus 111072026042 § 27²: the heading's note says the section was renumbered, and the same amendment's
  // other note closes lg 4. The two do not say the same, so they are no pair: the section stood before as § 27¹.
  assert.deepEqual(notes(await real('111072026042'), '27²'), [[{ provisions: ['§ 27² pealkiri'], in_force: '2025-01-01', note: 'muudetud paragrahvi number 27¹ numbriks 27²' }, { provisions: ['§ 27² lg 4'], in_force: '2025-01-01' }]]);
});

test('registered acts: a subsection\'s closing note in its last point, an added section\'s note after its heading, a ruling\'s note whole', async () => {
  // Türi 411062026105 § 91 (birth grant): both instalments rose from 350 to 500 euros on 01.01.2027 and the note stands in
  // point 2. Named as point 2's alone, point 1 had no day and the card read as if it had not changed.
  const turi = await real('411062026105');
  assert.deepEqual(notes(turi, 91), [[{ provisions: ['§ 91 lg 2 p 2 või kogu § 91 lg 2', '§ 91 lg 4'], in_force: '2027-01-01' }]]);
  assert.deepEqual(cardOf(turi).changed_on_valid_from, ['§ 91 lg 2 p 2 või kogu § 91 lg 2', '§ 91 lg 4', '§ 99 lg 3 või kogu § 99', '§ 152']);
  // Rakvere 407052026045 § 10 lg 8: the note in point 2 speaks of the whole subsection in its own words.
  assert.deepEqual(notes(await real('407052026045'), 10).flat().at(-1), { provisions: ['§ 10 lg 8 p 2 või kogu § 10 lg 8'], in_force: '2026-05-10', note: '§ 10 lg 8 rakendatakse alates 01.01.2027' });
  // Anija 418082026033 § 37: lg 8 is new with its three points; the amendment marked the other subsections one by one.
  assert.deepEqual(notes(await real('418082026033'), 37), [[{ provisions: ['§ 37 lg 4', '§ 37 lg 5', '§ 37 lg 6', '§ 37 lg 7', '§ 37 lg 8 p 3 või kogu § 37 lg 8', '§ 37 lg 9', '§ 37 lg 10'], in_force: '2026-08-21' }]]);
  // Riigilõivuseadus 111072026166 § 142⁴⁷: lg 3¹ was added on 19.07.2026 and its note stands in its point 3.
  const fees = await real('111072026166');
  assert.deepEqual(notes(fees, '142⁴⁷'), [[{ provisions: ['§ 142⁴⁷'], in_force: '2023-07-01' }, { provisions: ['§ 142⁴⁷ lg 1'], in_force: '2024-07-01' }, { provisions: ['§ 142⁴⁷ lg 3¹'], in_force: '2026-07-19' }]]);
  // § 59 lg 1 and lg 15: the note is a Supreme Court ruling's operative part and names no court. What it struck and the
  // fee it set come after 300 characters; the note is whole.
  const [[ruling], second] = notes(fees, 59), again = second.find(entry => entry.provisions.includes('§ 59 lg 15'));
  assert.deepEqual({ ...ruling, note: undefined }, { provisions: ['§ 59 lg 1'], in_force: '2015-05-26', note: undefined });
  assert(ruling.note.length === 551 && !/riigikoh/iu.test(ruling.note) && ruling.note.startsWith('1. Rahuldada osaliselt õiguskantsleri')
    && ruling.note.replace(/\s/gu, ' ').endsWith('kehtetuks osas, milles tsiviilasja hinna puhul üle 500 000 euro tasutakse riigilõivu kuni 10 500 eurot. 3. Tsiviilasja hinna puhul üle 500 000 euro tasutakse riigilõivu 3400 eurot.'), ruling.note);
  assert.equal(again.note, ruling.note);
  // Rapla 405092026058 § 52¹ and § 52² are not in the original text; each one's earliest note stands after its heading.
  const rapla = await real('405092026058');
  assert.deepEqual([notes(rapla, '52¹'), notes(rapla, '52²')], [[[{ provisions: ['§ 52¹'], in_force: '2025-09-12' }, { provisions: ['§ 52¹ lg 2 p 3'], in_force: '2026-09-08' }]], [[{ provisions: ['§ 52²'], in_force: '2025-09-12' }]]]);
  // 409052026032 § 70 lg 1: the opening words changed on 05.10.2024, the six points under them did not.
  assert.deepEqual(notes(await real('409052026032'), 70), [[{ provisions: ['§ 70 lg 1 sissejuhatav lauseosa'], in_force: '2024-10-05' }, { provisions: ['§ 70 lg 1 p 2', '§ 70 lg 1 p 4', '§ 70 lg 1 p 6'], in_force: '2019-01-01' }]]);
});

test('registered acts: the card shows the day the act took effect, and a rule on what its amounts apply from', async () => {
  // Kiili 430062026040: in force 25.10.2021 by the record and amended from 31.01.2022; § 72 reads "Määrus jõustub 01.07.2023."
  assert.deepEqual(cardOf(await real('430062026040')), { act_in_force_from: '2021-10-25', changed_on_valid_from_count: 21, entry_into_force_more: 1 });
  // 417062026002: published 17.06.2026 and in force 20.06.2026; its sentence names 01.06.2026, before it was published.
  assert.deepEqual(cardOf(await real('417062026002')), { act_in_force_from: '2026-06-20', entry_into_force_more: 1 });
  // 425072025017: the sentence names the day after the record's and nothing contradicts it: the sentence alone.
  const later = cardOf(await real('425072025017'));
  assert.deepEqual([later.act_in_force_from, later.entry_into_force.map(item => [item.provision, item.text.replace(/\s/gu, ' ')])], [undefined, [['§ 13 lg 1', 'Määrus jõustub 1. jaanuaril 2024.']]]);
  // Rae 430012026034 and 412092026007: the sentence that dates the act's whole content is about its amounts, not the act.
  assert.deepEqual(cardOf(await real('430012026034')), { act_in_force_from: '2026-02-02', scoped_rules: [{ provision: '§ 2 lg 3', text: 'Piirmäärasid rakendatakse tagasiulatuvalt alates 01.01.2026.' }] });
  assert.deepEqual(cardOf(await real('412092026007')), { act_in_force_from: '2026-09-15',
    scoped_rules: [{ provision: '§ 2 lg 3', text: 'Käesolevas määruses sätestatud hooldajatoetuse määrasid kohaldatakse tagasiulatuvalt alates 1. jaanuarist 2026.' }] });
  // Saku 429012026051 keeps its rates in an annex, changed on the version's first day (01.02.2026) and applied from
  // 01.01.2026. No excerpt carries an annex title's note, so the card gives its day and words itself.
  const saku = cardOf(await real('429012026051'));
  assert.deepEqual([saku.act_in_force_from, saku.changed_on_valid_from, saku.changed_on_valid_from_notes], ['2017-09-01', ['lisa Sotsiaaltoetuste määrade kehtestamine'],
    [{ provisions: ['lisa Sotsiaaltoetuste määrade kehtestamine'], in_force: '2026-02-01', applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' }]]);
  // A scoped rule is whole, with every day it names (cut at 160 characters, 404032025051 § 24 lg 2 lost "alates 1.01.2020"
  // and 431122025034 § 67¹ the end of its period).
  assert(cardOf(await real('404032025051')).scoped_rules[1].text.endsWith('uute haldusaktide sõlmimise ajast või alates 1.01.2020. a; lõikes 8 sätestatud hoolduskulude toetuse määra korralduste kehtivuse lõppemisel, uue korralduse kehtima hakkamise ajast või alates 1.01.2020. a.'));
  assert(cardOf(await real('431122025034')).scoped_rules[0].text.endsWith('alates 24. veebruarist 2022 kuni 31. detsembrini 2022.'));
});

test('a note of the version\'s first day outside the sections: the card gives its applies_from and words, which no excerpt carries', () => {
  const day = '2026-09-04', annex = (name, marks) => `<lisaViide><lisaPealkiri><lisaNimi>${name}</lisaNimi>${marks}</lisaPealkiri></lisaViide>`;
  const { bundle, legal, of } = read(act(`<preambul><tavatekst>Fictional basis.</tavatekst>${note(day)}</preambul>`
    + section(1, 'Rates', subsection(1, 'The fictional rates are in the annex.', note(day, { after: ', rakendatakse alates 01.07.2026' })) + subsection(2, 'A fictional rule.')),
  { after: annex('Fictional rates', note(day, { after: ', rakendatakse alates 01.01.2026' })) + annex('Fictional form', note('2024-02-01', { act: '400000000002', after: ', rakendatakse alates 01.01.2024' }))
      + annex('Old form', note(day, { before: 'Kehtetu - ', after: ', rakendatakse alates 01.01.2026' })) }));
  assert.deepEqual(legal.structure.map(item => [item.target, item.in_force, item.applies_from ?? null]), [['preambul', day, null], ['lisa Fictional rates', day, '2026-01-01'], ['lisa Fictional form', '2024-02-01', '2024-01-01'], ['lisa Old form', day, '2026-01-01']]);
  // The annex of that day with its day of application, and the repealed one as a repeal. The preamble's note has neither
  // a day of application nor words and is named only; an annex changed earlier is not this day's; a section's note is
  // with its excerpt.
  assert.deepEqual(actDates(legal, bundle.source_units), { act_in_force_from: '2018-07-01', changed_on_valid_from: ['preambul', '§ 1 lg 1', 'lisa Fictional rates', 'lisa Old form (kehtetu)'],
    changed_on_valid_from_notes: [{ provisions: ['lisa Fictional rates'], in_force: day, applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' },
      { provisions: ['lisa Old form'], repealed_from: day, applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' }] });
  assert.deepEqual(chunkAmendments(bundle, of(1)[0]), [{ provisions: ['§ 1 lg 1'], in_force: day, applies_from: '2026-07-01', note: 'rakendatakse alates 01.07.2026' }]);
  // More than twelve changes are counted, not named; the notes outside the sections are given all the same.
  const many = read(act(section(1, 'Points', `<loige><kuvatavNr/><sisuTekst><tavatekst>The fictional points are:</tavatekst></sisuTekst>${Array.from({ length: 13 }, (_, at) => point(at + 1, 'a fictional point;', note(day))).join('')}${point(99, 'a last point.')}</loige>`),
    { after: annex('Fictional rates', note(day, { after: ', rakendatakse alates 01.01.2026' })) }));
  assert.deepEqual(actDates(many.legal, many.bundle.source_units), { act_in_force_from: '2018-07-01', changed_on_valid_from_count: 14,
    changed_on_valid_from_notes: [{ provisions: ['lisa Fictional rates'], in_force: day, applies_from: '2026-01-01', note: 'rakendatakse alates 01.01.2026' }] });
});

// A section as the reader stores it, and a chunk over all of it; `end` gives a note the place right after those words.
const TEXT = '§ 1.\n\nHeading\n\n(1)\n\nFirst rule.\n\n(2)\n\nSecond rule.\n\n(3)\n\nThird rule.', end = text => TEXT.indexOf(text) + text.length;
const unitNote = (provision, offset, fields = {}) => ({ provision, offset, path: `/oigusakt[1]/sisu[1]/paragrahv[1]/loige[${provision.match(/ lg (\d+)/u)?.[1] ?? 1}]/muutmismarge[1]`,
  act_reference: '400000000001', rt: 'RT IV, 02.01.2018, 7', published: '2018-01-02', in_force: '2024-01-01', ...fields });
const single = amendments => ({ bundle: { source_units: [{ id: 'unit-1', raw_text: TEXT, amendments }], document: { fields: { legal_text: { value: { schema_version: 'rag-v2/legal-text-1', structure: [] } } } } },
  chunk: { source_locations: [{ source_unit_id: 'unit-1', path: '/oigusakt[1]/sisu[1]/paragrahv[1]', start: 0, end: TEXT.length }] } });
const pointList = points => read(act(section(1, 'Points', `<loige><kuvatavNr/><sisuTekst><tavatekst>The fictional points are:</tavatekst></sisuTekst>${points}${point(99, 'a last point without a note.')}</loige>`)));

test('a heading\'s note and the closing note of one amendment are a pair only when they say the same', () => {
  const shown = (heading, closing) => { const { bundle, chunk } = single([{ ...unitNote('§ 1', end('Heading'), heading), path: '/oigusakt[1]/sisu[1]/paragrahv[1]/muutmismarge[1]' }, unitNote('§ 1 lg 3', TEXT.length, closing)]); return chunkAmendments(bundle, chunk); };
  const day = { in_force: '2024-01-01' }, applied = { applies_from: '2023-07-01', note: 'rakendatakse alates 01.07.2023' };
  assert.deepEqual([shown({}, {}), shown(applied, applied)], [[{ provisions: ['§ 1'], ...day }], [{ provisions: ['§ 1'], ...day, ...applied }]]);
  // Other words, or another day of application under the same words: the heading's note stays the heading's, and the
  // closing one is its subsection's own, as the same amendment marked the section piece by piece.
  assert.deepEqual(shown(applied, {}), [{ provisions: ['§ 1 pealkiri'], ...day, ...applied }, { provisions: ['§ 1 lg 3'], ...day }]);
  assert.deepEqual(shown({}, applied), [{ provisions: ['§ 1 pealkiri'], ...day }, { provisions: ['§ 1 lg 3'], ...day, ...applied }]);
  assert.deepEqual(shown(applied, { ...applied, applies_from: '2023-08-01' }), [{ provisions: ['§ 1 pealkiri'], ...day, ...applied }, { provisions: ['§ 1 lg 3'], ...day, ...applied, applies_from: '2023-08-01' }]);
});

test('the limits of an excerpt\'s notes: eight entries, twelve provisions an entry; a note\'s words are never cut', () => {
  assert.deepEqual(LEGAL_DATES_LIMITS, { groups: 8, provisions: 12, changed: 12, entry: 3, scoped: 3 });
  // Nine days: eight entries and the count of the rest.
  const days = pointList(Array.from({ length: 9 }, (_, at) => point(at + 1, 'a fictional point;', note(`2024-01-0${at + 1}`))).join(''));
  const cut = chunkAmendments(days.bundle, days.of(1)[0]);
  assert.equal(cut.length, 9); assert.deepEqual(cut.at(-1), { more: 1 }); assert.deepEqual(cut[7], { provisions: ['§ 1 p 8'], in_force: '2024-01-08' });
  // Thirteen provisions of one day: twelve named and the count of the rest; a label two notes share is named once.
  const many = pointList(Array.from({ length: 13 }, (_, at) => point(at + 1, 'a fictional point;', note('2024-01-01') + (at ? '' : note('2024-01-01')))).join(''));
  assert.equal(many.bundle.source_units[0].amendments.length, 14);
  assert.deepEqual(chunkAmendments(many.bundle, many.of(1)[0]), [{ provisions: Array.from({ length: 12 }, (_, at) => `§ 1 p ${at + 1}`), in_force: '2024-01-01', more_provisions: 1 }]);
  // A note's words are shown whole, whatever their length and wording. Cut at 160 characters, a ruling's note that names
  // no court (the state fees act's § 59: the ruling's operative part) stopped before the words that say what it struck.
  const worded = said => { const { bundle, of } = pointList(said.map((text, at) => point(at + 1, 'a fictional point;', note(`2024-01-0${at + 1}`, { after: `, ${text}` }))).join('')); return chunkAmendments(bundle, of(1)[0]).map(entry => entry.note); };
  const ruling = `1. Rahuldada osaliselt fiktiivne taotlus. 2. Tunnistada ${'fiktiivse määruse '.repeat(12)}§ 1 lõige 1 põhiseadusega vastuolus olevaks ning kehtetuks osas, milles tasu on üle 100 euro. 3. Tasu on 50 eurot.`;
  const said = ['c'.repeat(171), `${'d'.repeat(159)}😀${'d'.repeat(20)}`, ruling, 'e'.repeat(900)];
  assert(ruling.length > 300 && !/riigikoh/iu.test(ruling));
  assert.deepEqual(worded(said), said);
  // A note without a place is in no chunk, whatever it is a note of.
  const unplaced = single([unitNote('§ 1 lg 1', null), { ...unitNote('§ 1', null), path: '/oigusakt[1]/sisu[1]/paragrahv[1]/muutmismarge[1]' }, unitNote('§ 1 lg 2', end('Second rule.'), { in_force: '2024-02-01' })]);
  assert.deepEqual(chunkAmendments(unplaced.bundle, unplaced.chunk), [{ provisions: ['§ 1 lg 2'], in_force: '2024-02-01' }]);
  // A repeal without its day is still a repeal; an amendment without day or words still names its provision.
  const bare = single([unitNote('§ 1 lg 1', end('First rule.'), { in_force: null, repeal: true }), unitNote('§ 1 lg 2', end('Second rule.'), { in_force: null })]);
  assert.deepEqual(chunkAmendments(bare.bundle, bare.chunk), [{ provisions: ['§ 1 lg 1'], repealed_from: null }, { provisions: ['§ 1 lg 2'] }]);
  // No notes, no source ranges, an earlier bundle: nothing.
  for (const [bundle, chunk] of [[single([]).bundle, bare.chunk], [bare.bundle, { source_locations: undefined }], [{ document: { fields: {} } }, bare.chunk]]) assert.equal(chunkAmendments(bundle, chunk), null);
  assert.equal(legalDates({ document: { fields: {} } }, bare.chunk), null);
});

const legalText = fields => ({ schema_version: 'rag-v2/legal-text-1', text_kind: 'terviktekst', adopted: '2015-12-09', original_reference: '130122015005', original_published: '2015-12-30',
  act_in_force_from: '2016-01-01', version_from: '2026-06-03', history: [], structure: [], entry_into_force: [], ...fields });
const sentence = (provision, text) => ({ provision, unit_index: 1, path: '/oigusakt[1]/sisu[1]/paragrahv[9]/loige[1]/sisuTekst[1]/tavatekst[1]', text });

test('the act\'s own sentences: those about the whole act are shown, three at most; a scoped or transitional rule is shown apart or counted, another act\'s day is neither', () => {
  // The social welfare act's shape: its own sentence is the third of eight. Four transitional rules are more than are
  // shown whole, so they are counted, not shown in part.
  const welfare = legalText({ entry_into_force: [
    sentence('§ 160 lg 18', 'Käesoleva seaduse § 47 lõigetes 6 ja 7 sätestatut kohaldatakse ka isikule, kellel tekkis õigus enne 2016. aasta 1. jaanuari.'),
    sentence('§ 160 lg 40', 'Käesoleva seaduse § 13¹ lõikeid 3–5 rakendatakse tagasiulatuvalt 2020. aasta 12. märtsist.'),
    sentence('§ 184 lg 1', 'Sotsiaalseadustiku üldosa seadus ja käesolev seadus jõustuvad 2016. aasta 1. jaanuaril.'),
    sentence('§ 184 lg 2', 'Käesoleva seaduse § 68 lõige 3 jõustub 2016. aasta 18. jaanuaril.'),
    sentence('§ 184 lg 6', 'Käesoleva seaduse § 176 punkt 10 jõustub 2018. aasta 1. juulil.')] });
  const own = { provision: '§ 184 lg 1', text: 'Sotsiaalseadustiku üldosa seadus ja käesolev seadus jõustuvad 2016. aasta 1. jaanuaril.' };
  assert.deepEqual(actDates(welfare), { act_in_force_from: '2016-01-01', entry_into_force: [own], entry_into_force_more: 4 });
  // With three they are shown, under their own key and after the act's own sentence, each with its provision.
  assert.deepEqual(actDates({ ...welfare, entry_into_force: welfare.entry_into_force.slice(1) }), { act_in_force_from: '2016-01-01', entry_into_force: [own],
    scoped_rules: [1, 3, 4].map(at => ({ provision: welfare.entry_into_force[at].provision, text: welfare.entry_into_force[at].text })) });
  // Every wording of a whole-act sentence the registered acts use; the subject is the act, in any of its forms.
  const whole = ['Määrus jõustub 1. juulil 2018.', 'Määrust rakendatakse alates 01.05.2026.', 'Käesolev määrus jõustub 1. jaanuaril 2022.', 'Käesolevat määrust rakendatakse tagasiulatuvalt 1. jaanuarist 2022.',
    'Käesolev seadus jõustub 2016. aasta 1. jaanuaril.', 'Määrus rakendatakse 1. jaanuarist 2018. a.', 'Määrust jõustub 1. jaanuaril 2023.',
    'Määrus jõustub kolmandal päeval pärast Riigi Teatajas avaldamist ja seda rakendatakse alates 1. juulist 2022. a.'];
  const scoped = ['Määruse § 2 lõike 2 punkt 2 jõustub 1. juulil 2016. a.', 'Käesoleva määruse § 6 jõustub 1. jaanuaril 2015. a.', 'Paragrahve 63 ja 66 rakendatakse tagasiulatuvalt alates 01.01.2026. a.',
    'Piirmäärasid rakendatakse tagasiulatuvalt alates 01.01.2026.', '§ 18 lõiget 4 rakendatakse tagasiulatuvalt 01. jaanuarist 2020.', 'Käesoleva seaduse 5. peatükk jõustub 2017. aasta 1. jaanuaril.',
    'Käesoleva määruse 10. jagu „Kogukonnapõhise toetatud elamise teenus rakendatakse“ alates 1. jaanuarist 2027.',
    'Enne käesoleva määruse jõustumist vastu võetud transporditeenuse otsuseid rakendatakse käesoleva määruse kohaselt alates 01.03.2023.',
    'Käesolevas määruses sätestatud hooldajatoetuse määrasid kohaldatakse tagasiulatuvalt alates 1. jaanuarist 2026.'];
  const shownOf = text => actDates(legalText({ act_in_force_from: null, entry_into_force: [sentence('§ 9', text)] }));
  for (const text of whole) assert.deepEqual(shownOf(text), { entry_into_force: [{ provision: '§ 9', text }] }, text);
  // A rule about a provision, a part or an amount is never the act's own entry into force: it has its own key.
  for (const text of scoped) assert.deepEqual(shownOf(text), { scoped_rules: [{ provision: '§ 9', text }] }, text);
  // Four whole-act sentences: three shown, in the act's order, and the count of the rest.
  const four = actDates(legalText({ entry_into_force: [1, 2, 3, 4].map(number => sentence(`§ 9 lg ${number}`, `Määrust rakendatakse ${number}. liigi toetusele alates 01.0${number}.2016.`)) }));
  assert.deepEqual([four.entry_into_force.map(item => item.provision), four.entry_into_force_more], [['§ 9 lg 1', '§ 9 lg 2', '§ 9 lg 3'], 1]);
  // A day that only dates another act is not this act's day: the sentence is left out and not counted (three registered
  // acts). A sentence that names such a day and the act's own keeps its own (Tallinn 423052026004 § 6).
  const other = ['Korras kohaldatakse Saaremaa Vallavolikogu 26.04.2019. a määruse nr 7 „Sotsiaalhoolekandelise abi andmise kord“ sätteid, arvestades käesolevas korras sätestatud erisusi.',
    'Eluruumi tagamise teenuse taotlemisele kohaldatakse Jõhvi Vallavolikogu 21.02.2021 määruse nr 89 ja Toila Vallavolikogu 18.04.2018 määrus nr 15 vastavaid sätteid.',
    'Määrust kohaldatakse koos Vallavolikogu 26.04.2019 määrusega nr 7.'];
  for (const text of other) assert.equal(shownOf(text), null, text);
  const tallinn = 'Määrus jõustub Tallinna Linnavolikogu 15. detsembri 2022 määruse „Tallinna Linnavolikogu määruste muutmine“ jõustumisel, kuid kõige varem 1. jaanuaril 2023.';
  assert.deepEqual(actDates(legalText({ act_in_force_from: '2023-01-01', original_published: '2022-12-22', entry_into_force: [sentence('§ 6', tallinn)] })),
    { act_in_force_from: '2023-01-01', entry_into_force: [{ provision: '§ 6', text: tallinn }] });
  // A sentence is shown whole: cut at 160 characters, a scoped rule lost its day (404032025051 § 24 lg 2 stopped at
  // "... või alat", 431122025034 § 67¹ at "kuni 31.").
  const long = `Määrust rakendatakse ${'fiktiivse tingimuse täitmisel ning '.repeat(8)}alates 01.05.2026.`;
  const rule = `Paragrahvi 7 lõikes 6 sätestatud määrasid rakendatakse ${'olemasolevate haldusaktide tähtaja lõppemisel, '.repeat(5)}uute haldusaktide sõlmimise ajast või alates 1.01.2020. a.`;
  assert(long.length > 250 && rule.length > 300);
  assert.deepEqual(shownOf(long), { entry_into_force: [{ provision: '§ 9', text: long }] });
  assert.deepEqual(shownOf(rule), { scoped_rules: [{ provision: '§ 9', text: rule }] });
});

test('the record\'s day and the act\'s own "jõustub" sentence: where they name different days one is shown, never both', () => {
  const card = (text, record, fields = {}) => actDates(legalText({ act_in_force_from: record, original_published: null, entry_into_force: [sentence('§ 9', text)], ...fields }));
  // Ruhnu 417032016009: in force 03.10.2012 by the record, published 06.10.2012; § 5 lg 2 names the day itself. The
  // record's day is before the publication its adoption names and is left out; the sentence is shown as it is.
  const ruhnu = legalText({ act_in_force_from: '2012-10-03', original_published: '2012-10-06', entry_into_force: [sentence('§ 5 lg 2', 'Määrus jõustub 03.10.2012. a.')] });
  assert.deepEqual(actDates(ruhnu), { entry_into_force: [{ provision: '§ 5 lg 2', text: 'Määrus jõustub 03.10.2012. a.' }] });
  // Viljandi 403052024057: an act of 2007 put into Riigi Teataja in 2012, with no sentence of its own: no day is shown.
  assert.equal(actDates(legalText({ act_in_force_from: '2007-10-01', original_published: '2012-09-05' })), null);
  // The sentence names a day before the record's (13 registered acts): the act was published later and took effect on
  // the record's day, the third day after. The record's day is shown and the sentence only counted.
  for (const [text, record] of [['Määrus jõustub 1. juulil 2018.', '2018-07-06'], ['Määrus jõustub 2018. aasta 1. märtsil.', '2018-03-02'],
    ['Käesolev määrus jõustub 01.06.2026.', '2026-06-20'], ['Määrus jõustub 01. märtsil 2018.', '2018-03-06'], ['Määrus jõustub 1. detsembril 2021.', '2021-12-04']]) {
    assert.deepEqual(card(text, record), { act_in_force_from: record, entry_into_force_more: 1 }, text);
  }
  // The sentence names a later day. With an amendment in force before it the act was in force already (Kiili: record
  // 25.10.2021, first amendment 31.01.2022, "Määrus jõustub 01.07.2023."): the record's day. With nothing against it
  // (425072025017: record 31.12.2023, "jõustub 1. jaanuaril 2024") the sentence, without the record's day.
  const amended = { history: [{ act_reference: '400000000001', in_force: '2022-01-31' }, { act_reference: '400000000002', in_force: '2024-03-01' }] };
  assert.deepEqual(card('Määrus jõustub 01.07.2023.', '2021-10-25', amended), { act_in_force_from: '2021-10-25', entry_into_force_more: 1 });
  assert.deepEqual(card('Määrus jõustub 01.07.2023.', '2021-10-25'), { entry_into_force: [{ provision: '§ 9', text: 'Määrus jõustub 01.07.2023.' }] });
  assert.deepEqual(card('Määrus jõustub 01.07.2023.', '2021-10-25', { history: [amended.history[1]] }), { entry_into_force: [{ provision: '§ 9', text: 'Määrus jõustub 01.07.2023.' }] });
  assert.deepEqual(card('Määrus jõustub 1. jaanuaril 2024.', '2023-12-31'), { entry_into_force: [{ provision: '§ 9', text: 'Määrus jõustub 1. jaanuaril 2024.' }] });
  // A refuted sentence leaves the act's other sentences as they are.
  assert.deepEqual(actDates(legalText({ act_in_force_from: '2018-07-06', original_published: null,
    entry_into_force: [sentence('§ 9 lg 1', 'Määrus jõustub 1. juulil 2018.'), sentence('§ 9 lg 2', 'Määrust rakendatakse alates 1. septembrist 2018.'), sentence('§ 9 lg 3', 'Määruse § 5 rakendatakse alates 1. jaanuarist 2019.')] })),
  { act_in_force_from: '2018-07-06', entry_into_force: [{ provision: '§ 9 lg 2', text: 'Määrust rakendatakse alates 1. septembrist 2018.' }],
    scoped_rules: [{ provision: '§ 9 lg 3', text: 'Määruse § 5 rakendatakse alates 1. jaanuarist 2019.' }], entry_into_force_more: 1 });
  // The same day in every written form stays beside the sentence; so does a sentence that names no day after its verb.
  for (const [text, record] of [['Määrus jõustub 1. juulil 2018.', '2018-07-01'], ['Määrus jõustub 2018. aasta 1. märtsil.', '2018-03-01'], ['Määrus jõustub 01.07.2023.', '2023-07-01'],
    ['Määrus jõustub 1. jaanuarist 2021.', '2021-01-01'], ['Määrus jõustub 01. mail 2007. a.', '2007-05-01'], ['Sotsiaalseadustiku üldosa seadus ja käesolev seadus jõustuvad 2016. aasta 1. jaanuaril.', '2016-01-01'],
    ['Määrus jõustub kolmandal päeval pärast Riigi Teatajas avaldamist ja seda rakendatakse alates 1. juulist 2022. a.', '2022-07-08'],
    // Otepää 405072022009: in force 08.07.2022, applied from 1 July: two different things, both shown.
    ['Määrust rakendatakse alates 1. juulist 2022. a.', '2022-07-08']]) {
    assert.deepEqual(card(text, record), { act_in_force_from: record, entry_into_force: [{ provision: '§ 9', text }] }, text);
  }
  // A scoped rule's day is no contradiction of the act's.
  assert.equal(actDates(legalText({ entry_into_force: [sentence('§ 9', 'Käesoleva seaduse § 68 jõustub 2018. aasta 1. jaanuaril.')] })).act_in_force_from, '2016-01-01');
});

test('what the first day of the version changed: up to twelve provisions by name, more by count, none recorded as nothing; no data gives no card', () => {
  const change = provisions => actDates(legalText({ version_change: { in_force: '2026-06-03', acts: ['400000000001'], provisions } }));
  assert.deepEqual(change(['preambul']), { act_in_force_from: '2016-01-01', changed_on_valid_from: ['preambul'] });
  const twelve = Array.from({ length: 12 }, (_, at) => `§ ${at + 1}`);
  assert.deepEqual(change(twelve).changed_on_valid_from, twelve);
  assert.deepEqual(change([...twelve, '§ 13 (kehtetu)']), { act_in_force_from: '2016-01-01', changed_on_valid_from_count: 13 });
  assert.deepEqual(change([]), { act_in_force_from: '2016-01-01' });
  assert.deepEqual(actDates(legalText({})), { act_in_force_from: '2016-01-01' });
  // An act without its day (Kambja 414032026010) and with nothing else gives no card; so does an earlier or unknown record.
  for (const legal of [legalText({ act_in_force_from: null }), null, undefined, {}, { ...legalText({}), schema_version: 'rag-v2/legal-text-0' }]) assert.equal(actDates(legal), null);
});

// Evidence entries as the search gives them, with the legal dates of sourceEntry.
const entry = (doc, number, dates) => ({ evidence_id: `${doc}-e${number}`, document_id: doc, document_version_id: `${doc}-v`, unit_id: `${doc}-u${number}`, chunk_id: `${doc}-c${number}`,
  span_ids: [`${doc}-s${number}`], pdf_pages: [], source_locations: [{ kind: 'xml', path: `/oigusakt[1]/sisu[1]/paragrahv[${number}]`, act_reference: doc, source_unit_id: `${doc}-unit${number}`, start: 0, end: 40 }],
  source_text: `§ ${number}. A fictional rule of ${doc}.`, bibliography: { title: `Act ${doc}`, authors: [], publication_date: '2026-06-01' },
  source_metadata: { source_type: { value: 'legal_act' }, valid_from: { value: '2026-06-03' } }, selection: { reason: 'ranked_seed' }, limitations: [], ...(dates ? { legal_dates: dates } : {}) });
const amendmentsOf = (number, size) => Array.from({ length: size }, (_, at) => ({ provisions: [`§ ${number} lg ${at + 1}`], in_force: `2024-0${at + 1}-01`, note: `rakendatakse fiktiivse ${number}. paragrahvi ${at + 1}. lõike suhtes eraldi korra alusel` }));
const actCard = { act_in_force_from: '2016-01-01', changed_on_valid_from: ['preambul'], entry_into_force: [{ provision: '§ 9', text: 'Määrus jõustub 1. jaanuaril 2016.' }] };
const scope = { tenant: 't', query_id: 'q', generation_id: 'g' };

test('the projection: act_dates closes a legal source card and amendments stands before the excerpt\'s text, only in the context a turn sends', () => {
  assert.equal(MODEL_SERIALIZER, 'rag-v2/model-context-json-4');
  const evidence = [entry('a', 1, { act: actCard, amendments: amendmentsOf(1, 2) }), entry('b', 1), entry('a', 2, { act: actCard })];
  const sent = modelProjection(evidence, scope), plain = modelProjection(evidence, scope, { annotations: false });
  assert.deepEqual(Object.keys(sent.context.sources.D1), ['title', 'publication_date', 'source_type', 'valid_from', 'act_dates']);
  assert.deepEqual(sent.context.sources.D1.act_dates, actCard);
  assert.deepEqual(Object.keys(sent.context.evidence[0]), ['ref', 'source', 'pdf_pages', 'source_locations', 'amendments', 'text']);
  assert.deepEqual(sent.context.evidence[0].amendments, amendmentsOf(1, 2));
  // A source without the data and an excerpt without notes are exactly what they are without the switch.
  assert.deepEqual(sent.context.sources.D2, plain.context.sources.D2);
  assert.deepEqual([sent.context.evidence[1], sent.context.evidence[2]], [plain.context.evidence[1], plain.context.evidence[2]]);
  assert(!JSON.stringify(plain.context).includes('act_dates') && !JSON.stringify(plain.context).includes('amendments'));
  // Every measure a budget or a reference check reads leaves the dates out; the references never carry them.
  for (const options of [{ measure: 'budget' }, { measure: 'none' }, { measure: 'full', annotations: false }]) {
    const measured = modelProjection(evidence, scope, options);
    assert.deepEqual(measured.context, plain.context, JSON.stringify(options));
    assert.deepEqual(measured.references, sent.references);
  }
  assert(!JSON.stringify(sent.references).includes('legal_dates') && !JSON.stringify(sent.references).includes('2016-01-01'));
  assert.equal(modelProjection(evidence, scope, { measure: 'budget' }).measurements.model_context_tokens, tokenCount(serializeModelContext(plain.context)));
  // The full measure gives both counts: the context as sent, and the same without the dates, which a limit reads.
  assert.equal(sent.measurements.model_context_tokens, tokenCount(serializeModelContext(sent.context)));
  assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  assert.equal(plain.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  assert.deepEqual(sent.measurements.legal_dates, { tokens: sent.measurements.legal_dates.tokens, limit: LEGAL_DATES_TOKENS, shown: 2, omitted: 0 });
  assert.equal(plain.measurements.legal_dates, undefined);
  // A structured record's excerpt is cited by its ref alone and never carries dates.
  const record = { ...entry('r', 1, { act: actCard, amendments: amendmentsOf(1, 1) }), selection: { reason: 'structured_record' } };
  assert.deepEqual(modelProjection([record], scope).context, modelProjection([record], scope, { annotations: false }).context);
});

test('the dates\' own cap: 1500 tokens in evidence order; past it a card or an excerpt carries only the mark, and the marks are inside the cap', () => {
  assert.equal(LEGAL_DATES_TOKENS, 1500);
  // Four acts, five excerpts each, every excerpt with eight entries of notes: far more than the cap holds.
  const evidence = ['a', 'b', 'c', 'd'].flatMap(doc => [1, 2, 3, 4, 5].map(number => entry(doc, number, { act: actCard, amendments: amendmentsOf(number, 8) })));
  const sent = modelProjection(evidence, scope), plain = modelProjection(evidence, scope, { annotations: false }), { legal_dates: dates } = sent.measurements;
  assert.deepEqual([dates.limit, dates.shown + dates.omitted], [1500, 24]);
  assert(dates.shown > 0 && dates.omitted > 0 && dates.tokens <= 1500, JSON.stringify(dates));
  // In evidence order: a card with its first excerpt, then the excerpt's notes; from the first that does not fit, marks only.
  const order = sent.context.evidence.flatMap((excerpt, at) => [...(at % 5 === 0 ? [sent.context.sources[excerpt.source]] : []), excerpt]);
  const state = order.map(item => ('act_dates' in item || 'amendments' in item ? 'shown' : item.act_dates_omitted === true || item.amendments_omitted === true ? 'omitted' : 'none'));
  assert.equal(state.indexOf('none'), -1);
  assert.deepEqual(state, [...Array(dates.shown).fill('shown'), ...Array(dates.omitted).fill('omitted')]);
  assert.deepEqual(sent.context.sources.D4, { ...plain.context.sources.D4, act_dates_omitted: true });
  assert.deepEqual(sent.context.evidence.at(-1), { ...plain.context.evidence.at(-1), amendments_omitted: true, text: plain.context.evidence.at(-1).text });
  assert.deepEqual(Object.keys(sent.context.evidence.at(-1)), ['ref', 'source', 'pdf_pages', 'source_locations', 'amendments_omitted', 'text']);
  // The whole addition stays inside the cap: the context a turn sends passes the measured one by at most 1500 tokens.
  assert.equal(sent.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  const added = sent.measurements.model_context_tokens - sent.measurements.budget_context_tokens;
  assert(added > 0 && added <= LEGAL_DATES_TOKENS, `added ${added}`);
  // Under the cap nothing is cut.
  const few = modelProjection(evidence.slice(0, 2), scope);
  assert.deepEqual([few.measurements.legal_dates.shown, few.measurements.legal_dates.omitted], [3, 0]);
  // The most a turn can bring: thirty entries (the largest finalLimit), each of another act with its card and notes.
  // The marks of what is left out fit the cap with what is shown; they would not from 167 fragments on.
  const most = modelProjection(Array.from({ length: 30 }, (_, at) => entry(`act${at}`, 1, { act: actCard, amendments: amendmentsOf(1, 8) })), scope), full = most.measurements;
  assert.deepEqual([full.legal_dates.shown + full.legal_dates.omitted, tokenCount(',"amendments_omitted":true'), Math.floor(LEGAL_DATES_TOKENS / 9) + 1], [60, 9, 167]);
  assert(full.legal_dates.shown > 0 && full.legal_dates.omitted > 40 && full.legal_dates.tokens <= LEGAL_DATES_TOKENS && full.model_context_tokens - full.budget_context_tokens <= LEGAL_DATES_TOKENS, JSON.stringify(full.legal_dates));
});

test('the unified limit reads the context without the dates: it fails no turn over them, and a context too large without them still fails', () => {
  const row = id => ({ schema_version: DISCOVERY_SCHEMA, document_id: id, version_id: `${id}-v`, source: { journal: false, record_kind: null },
    fields: { publication_date: { value: '2026-06-01' }, regions: { value: [] }, valid_from: { value: '2026-06-03' }, valid_to: { value: null, open_end: true } } });
  const plan = { version: UNIFIED_RETRIEVAL_VERSION, temporal: { state: 'no_period', periods: [] }, publicationCandidates: [], legalPeriods: [],
    interpretation: 'bounded_evidence_selection_not_verified_intent' };
  const word = ' fiktiivne', each = tokenCount(word.repeat(100)) / 100, words = Math.floor(7000 / each);
  const merge = (filler, dated) => mergeUnifiedPackets({ tenant: 't', generationId: 'g', directories: [row('a')], plan, lanes: [{ key: 'knowledge', kind: 'knowledge',
    packet: { tenant: 't', generation_id: 'g', state: 'ok', evidence: [1, 2, 3, 4].map(number => ({ ...entry('a', number, dated ? { act: actCard, amendments: amendmentsOf(number, 6) } : null),
      source_text: `§ ${number}.${word.repeat(number === 4 ? filler : words)}` })) } }] });
  // Fill the last excerpt until the context without the dates is just inside the limit.
  let filler = words, plain = merge(filler, false);
  for (let round = 0; round < 8 && UNIFIED_LIMITS.contextTokens - plain.measurements.model_context_tokens > 40; round++) {
    filler += Math.floor((UNIFIED_LIMITS.contextTokens - plain.measurements.model_context_tokens - 20) / each);
    plain = merge(filler, false);
  }
  const room = UNIFIED_LIMITS.contextTokens - plain.measurements.model_context_tokens;
  assert(room >= 0 && room <= 40, `room ${room}`);
  const dated = merge(filler, true);
  assert.equal(dated.measurements.budget_context_tokens, plain.measurements.model_context_tokens);
  assert(dated.measurements.model_context_tokens > UNIFIED_LIMITS.contextTokens, 'the context sent passes the limit by its dates alone');
  assert(dated.measurements.model_context_tokens <= UNIFIED_LIMITS.contextTokens + LEGAL_DATES_TOKENS);
  assert.deepEqual(dated.model_context.evidence.map(excerpt => excerpt.text), plain.model_context.evidence.map(excerpt => excerpt.text));
  assert.deepEqual(dated.reference_map, Object.fromEntries(Object.entries(plain.reference_map).map(([ref, value]) => [ref, { ...value, query_id: dated.query_id }])));
  // The text itself over the limit fails as before, with or without dates.
  for (const withDates of [false, true]) assert.throws(() => merge(filler + Math.ceil(100 / each), withDates), { code: 'unified_context_budget_exceeded' });
});
