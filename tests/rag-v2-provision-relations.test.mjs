import test from 'node:test';
import assert from 'node:assert/strict';
import { LEFT_OUT, actFirstDay, dayRefusal, documentDay, followableNames, passageRelations, relationSection } from '../lib/rag-v2/search/provision-relations.js';
import { documentGroup, relationReport } from '../scripts/rag-v2-provision-relations.mjs';

// ADR-145 (11.10.2026): the relation from a passage to the provision of a law it names, read from the text with no
// model. The rules the search and the corpus count share.
test('the names of a scope\'s laws: the genitive, its other spelling, the title as it stands and Riigi Teataja\'s abbreviation; a title two documents share names neither', () => {
  const { names, abbreviations } = followableNames([['shs', 'Sotsiaalhoolekande seadus'], ['lks', 'Lastekaitseseadus'], ['riigieelarve', '2026. aasta riigieelarve seadus'], ['kord', 'Abivahendite loetelu'], ['nameless', null]]);
  assert.deepEqual([...names], [['sotsiaalhoolekande seaduse', 'shs'], ['sotsiaalhoolekandeseaduse', 'shs'], ['sotsiaalhoolekande seadus', 'shs'], ['lastekaitseseaduse', 'lks'], ['lastekaitse seaduse', 'lks'],
    ['lastekaitseseadus', 'lks'], ['2026. aasta riigieelarve seaduse', 'riigieelarve'], ['2026. aasta riigieelarveseaduse', 'riigieelarve'], ['2026. aasta riigieelarve seadus', 'riigieelarve']]);
  // The State Budget Act has no abbreviation; a regulation has no name here at all.
  assert.deepEqual([...abbreviations], [['SHS', 'shs'], ['LasteKS', 'lks']]);
  // Two versions of one law in the scope: neither is named, by any form.
  const twin = followableNames(new Map([['shs', 'Sotsiaalhoolekande seadus'], ['shs-2027', 'Sotsiaalhoolekande seadus'], ['lks', 'Lastekaitseseadus']]));
  assert.deepEqual([[...twin.names.values()], [...twin.abbreviations]], [['lks', 'lks', 'lks'], [['LasteKS', 'lks']]]);
  // The lists of a passage as the search reads them.
  assert.deepEqual(passageRelations('Abivajadust hindab vald (SHS § 15 lg 1), last toetab LasteKS § 27 ja sotsiaalhoolekande seaduse §-d 5–9.', { names, abbreviations })
    .map(({ act, base, to, named }) => [act, base, to?.[0] ?? null, named]), [['shs', '15', null, 'SHS'], ['lks', '27', null, 'LasteKS'], ['shs', '5', '9', 'sotsiaalhoolekande seaduse']]);
  assert.deepEqual([relationSection({ base: '15', superscript: '', to: null }, ['14', '15'], false), relationSection({ base: '5', superscript: '', to: ['9', ''] }, ['5', '9'], false),
    relationSection({ base: '99', superscript: '', to: null }, ['14', '15'], false)], [{ key: '15' }, { reason: 'range' }, { reason: 'section_not_in_act' }]);
});

test('the day a text speaks from and an act\'s first day: a text older than the act names none of its sections', () => {
  const field = value => ({ value });
  // A legal text's version from its first day in force; else the publication day, a year's first day, the day it was read.
  assert.deepEqual([documentDay({ valid_from: field('2024-03-01'), publication_date: field('2015-01-05') }), documentDay({ publication_date: field('2019-05-07'), publication_year: field(2018) }),
    documentDay({ publication_year: field(2014), source_checked_at: field('2026-09-01T07:00:00.000Z') }), documentDay({ publication_year: field('2014') }),
    documentDay({ source_checked_at: field('2026-09-01T07:00:00.000Z'), retrieved_at: field('2026-08-01T07:00:00.000Z') }), documentDay({ retrieved_at: field('2026-08-01T07:00:00.000Z') }),
    documentDay({ publication_year: field('2014–2015') }), documentDay({}), documentDay(undefined)],
  ['2024-03-01', '2019-05-07', '2014-01-01', '2014-01-01', '2026-09-01', '2026-08-01', null, null, null]);
  const act = text => ({ legal_text: field(text) });
  assert.deepEqual([actFirstDay(act({ act_in_force_from: '2016-01-01', adopted: '2015-12-09' })), actFirstDay(act({ act_in_force_from: null, adopted: '1999-01-27' })), actFirstDay(act({})), actFirstDay({})],
    ['2016-01-01', '1999-01-27', null, null]);
  const shs = act({ act_in_force_from: '2016-01-01', adopted: '2015-12-09' });
  assert.deepEqual([dayRefusal({ publication_year: field(2014) }, shs), dayRefusal({ publication_date: field('2015-12-31') }, shs), dayRefusal({ publication_year: field(2016) }, shs),
    dayRefusal({ valid_from: field('2016-01-01') }, shs), dayRefusal({}, shs), dayRefusal({}, {}), dayRefusal({ publication_year: field(1990) }, {})],
  ['older_document', 'older_document', null, null, 'undated_document', null, null]);
  assert.deepEqual(LEFT_OUT, ['range', 'older_document', 'undated_document', 'section_not_in_act', 'section_ambiguous', 'over_limit']);
});

// The corpus count (scripts/rag-v2-provision-relations.mjs) reads a store's bundles with these rules.
test('the corpus count: relations by document group and written form, what is left out and why; a law\'s reference to itself is none', async () => {
  const field = value => ({ value });
  const bundle = (fields, passages, version = { source_format: 'pdf' }) => ({ document: { fields: { title: field(null), ...fields } }, version,
    chunks: passages.map(([heading, text], ordinal) => ({ ordinal, source_text: text, retrieval_text: `${heading}\n\n${text}`, retrieval_mapping: { prefix_length: heading.length } })) });
  const law = (title, first, passages) => bundle({ title: field(title), valid_from: field('2026-01-01'), valid_to: { value: null, open_end: true }, legal_text: field({ act_in_force_from: first }) },
    passages.map(([section, text]) => [`${title} > § ${section}. Jagu`, text]), { source_format: 'xml', processing_config: { normalization: 'source-structure-v31' } });
  const bundles = [
    law('Sotsiaalhoolekande seadus', '2016-01-01', [['15', 'Abivajadust hindab kohaliku omavalitsuse üksus.'], ['25', 'Tugiisikuteenust ei osuta sugulane, vt käesoleva seaduse § 15 ja sotsiaalhoolekande seaduse § 15.'],
      ['26', 'Lapsele kohaldatakse lastekaitseseaduse § 21 lõiget 1.']]),
    law('Lastekaitseseadus', '2016-01-01', [['21', '(1)\nLapse parimad huvid.']]),
    // A guide of 2024: three written forms, a range, a section the act does not have, an act the corpus does not hold.
    bundle({ source_type: field('official_guideline'), publication_year: field(2024) }, [['Juhend > Hindamine', 'Vald hindab abivajadust (SHS § 15 lg 1). Vt ka sotsiaalhoolekande seaduse § 25 ja Lastekaitseseadus § 21.'],
      ['Juhend > Muu', 'Toetust arvestatakse SHS §-des 15–25, SHS § 99 ja KOKS § 22 alusel.'], ['Juhend > Lõpp', 'Märgita lõik.']]),
    // An article of 2014: the act of that name was then another one.
    bundle({ source_type: field('file'), publication_year: field(2014) }, [['Artikkel', 'Hooldust reguleerib SHS § 25 ja sotsiaalhoolekande seaduse § 15.']]),
    // A regulation of a municipality: the genitive, as before.
    bundle({ source_type: field('legal_act'), valid_from: field('2025-03-01'), regions: field(['harku_vald']) }, [['Kord > § 3. Jagu', 'Teenust ei osuta sotsiaalhoolekande seaduse § 25 nimetatud isik.']]),
  ];
  assert.deepEqual(bundles.map(item => documentGroup(item.document.fields)), ['law', 'law', 'official_guideline', 'file', 'municipal_act']);
  const report = await relationReport(bundles, { date: '2026-10-11' });
  assert.deepEqual(report.laws.one_version_in_force, 2);
  assert.deepEqual(report.groups.official_guideline, { documents: 1, passages: 3, passages_with_a_list: 2, lists: 6, references: 5, followed: 3, followed_by_form: { abbreviation: 1, genitive: 1, title: 1 },
    left_out: { range: 1, section_not_in_act: 1 }, passages_with_a_relation: 1, passages_without_the_genitive_form: 0, documents_with_a_relation: 1, documents_without_the_genitive_form: 0,
    laws_pointed_at: { 'Sotsiaalhoolekande seadus': 2, Lastekaitseseadus: 1 } });
  assert.deepEqual([report.groups.file.references, report.groups.file.followed, report.groups.file.left_out], [2, 0, { older_document: 2 }]);
  assert.deepEqual([report.groups.municipal_act.followed, report.groups.municipal_act.followed_by_form, report.groups.municipal_act.passages_without_the_genitive_form], [1, { genitive: 1 }, 0]);
  // The law's "sotsiaalhoolekande seaduse § 15" in its own text is no relation to another act; its pointer to the Child Protection Act is one.
  assert.deepEqual([report.groups.law.references, report.groups.law.followed, report.groups.law.laws_pointed_at], [1, 1, { Lastekaitseseadus: 1 }]);
  // A date before the laws' versions were in force: no act is the one in force, nothing is followed.
  const early = await relationReport(bundles, { date: '2025-06-01' });
  assert.deepEqual([early.laws.one_version_in_force, early.groups.official_guideline.followed, early.groups.official_guideline.left_out], [0, 0, { act_not_one_in_force: 5 }]);
});
