import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GOLD_ACTS, actBundles, actGold, actProvisions, cardRelationPopulation, listTarget, pointerAdditions, firstPassageAdditions } from '../scripts/rag-v2-relation-gold.mjs';

// ADR-063: the pointer gold set is read from the act with no model, so the same act gives the same links. The Social
// Welfare Act in force on 2026-10-15 pins the counts the ADR states; the committed file must be what the builder gives.
const SHS = '130062026065';
test('the gold builder reads the Social Welfare Act’s pointers at subsection level and counts the card relations on them', async () => {
  const bundle = (await actBundles([SHS], 'Andmebaasi')).get(SHS);
  const knowledge = JSON.parse(await fs.readFile(`Andmebaasi/teadmised/${SHS}.knowledge.json`, 'utf8')).knowledge;
  const gold = actGold(SHS, bundle, knowledge);
  assert.deepEqual([gold.title, gold.normalization, gold.provisions], ['Sotsiaalhoolekande seadus', 'source-structure-v30', 855]);
  assert.deepEqual(gold.counts.other_section, { links: 282, located: 278, cross_passage: 278, outside_first_passage: 24, cross_passage_with_card_relation: 9 });
  assert.deepEqual(gold.counts.own_section, { links: 161, located: 161, cross_passage: 44, outside_first_passage: 18, cross_passage_with_card_relation: 4 });
  assert.deepEqual(gold.counts.other_section_exception, { links: 33, located: 32, cross_passage: 32, outside_first_passage: 0, cross_passage_with_card_relation: 1 });
  assert.deepEqual([gold.counts.other_act, gold.counts.denials], [{ links: 88, resolved: 20 }, { provisions: 17, with_card_relation: 7 }]);
  // Every § mark of the act's provisions is a resolved reference, another act's list or a named miss.
  assert.deepEqual(gold.reader, { marks: 405, own: 261, other_act: 92, own_section: 148, unresolved: { same_act_unknown: 1, other_version: 3, section_not_in_act: 3 } });
  // Known cases: § 131's pointer to § 133 lõiked 5 and 6 lands outside § 133's first passage; the dementia exclusion
  // of § 88 points at § 72 lõige 2.
  const link = (from, to) => gold.links.find(item => item.from === from && item.to === to);
  assert.equal(gold.links.some(item => item.from.startsWith('131/') && item.to === '133/5' && item.in_first_passage === false), true);
  assert.equal(Boolean(gold.links.find(item => item.from.startsWith('88/') && item.to === '72/2')), true);
  assert.equal(link('12/1', '105/null').exception, true);
  // A range of subsections names every one of them: § 38 lõige 2 of no act here, but § 130³ lõige 6 says "lõigetes 1–5".
  assert.deepEqual(['1', '2', '3', '4', '5'].map(to => Boolean(link('130^3/6', `130^3/${to}`))), [true, true, true, true, true]);
  // A list's act is the one named directly before it: the Family Law Act for § 139¹ lõige 4, none for another act's list.
  const other = from => gold.links.filter(item => item.class === 'other_act' && item.from === from).map(item => [item.to_act, item.list]);
  assert.deepEqual(other('139^1/4'), [['107052025017', '§ 97 punkti 1 või 2']]);
  assert.deepEqual(other('45^13/1').map(([act]) => act), ['111072026042', null, null]);
  const committed = JSON.parse(await fs.readFile('tests/evaluation/graph/relation-gold-1.json', 'utf8'));
  assert.deepEqual(committed.acts.map(item => item.act), GOLD_ACTS);
  assert.deepEqual(committed.acts.find(item => item.act === SHS), JSON.parse(JSON.stringify(gold)));
});

test('ADR-063 arm R: following the act’s own pointers from a selected passage adds the subsection named, the provisions that point at it and a named other act', async () => {
  const PKS = '107052025017', bundles = await actBundles([SHS, PKS], 'Andmebaasi');
  const acts = new Map([['shs', { act: SHS, bundle: bundles.get(SHS), gold: actGold(SHS, bundles.get(SHS)) }]]);
  const passage = (act, id) => actProvisions(bundles.get(act)).find(provision => provision.id === id).passage;
  const run = (id, limits) => pointerAdditions({ seeds: [{ document_id: 'shs', passage: passage(SHS, id) }], acts, limits,
    otherAct: act => (act === PKS ? { document_id: 'pks', bundle: bundles.get(PKS) } : null), tokens: text => Math.ceil(text.length / 4) });
  const places = result => result.additions.map(item => `${item.class}:${item.document_id}#${item.passage}`);
  // § 131 lõige 2 names § 133 lõiked 5 and 6: the passages of those subsections, not the section's first one.
  const benefit = run('131/2');
  assert.deepEqual(places(benefit).slice(0, 2), [`exact_subsection:shs#${passage(SHS, '133/5')}`, `exact_subsection:shs#${passage(SHS, '133/6')}`]);
  assert.match(benefit.additions[0].source_text, /eluaseme soetamiseks võetud laenu tagasimakse/u);
  // Today's rule on the same seed adds § 133's first passage, where the list of housing costs is not.
  const today = firstPassageAdditions({ seeds: [{ document_id: 'shs', passage: passage(SHS, '131/2') }], acts, tokens: text => Math.ceil(text.length / 4) });
  assert.deepEqual(today.additions.map(item => [item.class, item.to]), [['first_passage', '133/null']]);
  assert.doesNotMatch(today.additions[0].source_text, /eluaseme soetamiseks võetud laenu tagasimakse/u);
  // § 80 lõige 1 is named by § 13² lõige 3 (martial law): an incoming pointer.
  const ending = run('80/1');
  assert.equal(ending.additions.some(item => item.class === 'incoming' && item.from === '13^2/3' && /kauem kui 14 päeva/u.test(item.source_text)), true);
  // § 134 lõige 4 is qualified by lõige 5 of the same section, in the next passage.
  assert.deepEqual(places(run('134/4')), [`incoming:shs#${passage(SHS, '134/5')}`]);
  // § 139¹ lõige 4 names the Family Law Act § 97: it is the fifth candidate, so four places cut it and five keep it.
  const pensioner = run('139^1/4'), other = pensioner.candidates.find(item => item.class === 'other_act');
  assert.deepEqual([other.document_id, other.passage, other.added, pensioner.candidates.indexOf(other)], ['pks', passage(PKS, '97/null'), false, 4]);
  assert.match(other.source_text, /mitte kauem kui 21-aastaseks saamiseni/u);
  assert.equal(run('139^1/4', { additions: 5, tokens: 3000 }).additions.at(-1).class, 'other_act');
  // A seed of a document whose pointers are not read adds nothing; a token room that is too small keeps nothing.
  assert.deepEqual(pointerAdditions({ seeds: [{ document_id: 'other', passage: 0 }], acts }).additions, []);
  assert.deepEqual(run('131/2', { additions: 4, tokens: 10 }).additions, []);
  assert.deepEqual([listTarget('§ 97 punkti 1 või 2'), listTarget('§ 25 lõikes 2'), listTarget('§ 45¹³ lõike 1 punktides 1–7'), listTarget('lõikes 2')],
    [{ section: '97', subsection: null }, { section: '25', subsection: '2' }, { section: '45^13', subsection: '1' }, null]);
});

// Codex's review of #297: the hand-checked card relations are the relations whose cards stand in different passages by
// their anchors (not by where their provisions begin), and the stated result is the count of the rows' verdicts.
test('the hand-checked card relations are the cross-passage relations of the four card files, and their result is the rows’ count', async () => {
  const checked = JSON.parse(await fs.readFile('tests/evaluation/graph/card-relations-1-checked.json', 'utf8'));
  const acts = [...new Set(checked.rows.map(row => row.act))], bundles = await actBundles(acts, 'Andmebaasi');
  const population = [];
  for (const act of acts) {
    const knowledge = JSON.parse(await fs.readFile(`Andmebaasi/teadmised/${act}.knowledge.json`, 'utf8')).knowledge;
    for (const item of cardRelationPopulation(bundles.get(act), knowledge)) population.push(`${act}/${item.relation}/${item.from}/${item.to}`);
  }
  const inside = checked.rows.filter(row => row.in_population !== false), keyOf = row => `${row.act}/${row.relation}/${row.from}/${row.to}`;
  assert.equal(population.length, 76);
  assert.deepEqual(inside.map(keyOf).sort(), [...population].sort());
  // The one row drawn by its provisions' first passages: both cards are anchored in the same passage.
  assert.deepEqual(checked.rows.filter(row => row.in_population === false).map(row => row.n), [39]);
  const count = (rows, verdict) => rows.filter(row => row.verdict === verdict).length;
  const result = rows => ({ rows: rows.length, right: count(rows, 'right'), wrong_target: count(rows, 'wrong_target'), wrong_type: count(rows, 'wrong_type'),
    wrong_direction: count(rows, 'wrong_direction') });
  assert.deepEqual(result(inside), { rows: 76, right: 52, wrong_target: 15, wrong_type: 6, wrong_direction: 3 });
  for (const [stated, rows] of [[checked.result, inside], [checked.first_sample, checked.rows.filter(row => row.n <= 75)]]) {
    assert.deepEqual({ rows: stated.rows, right: stated.right, wrong_target: stated.wrong_target, wrong_type: stated.wrong_type, wrong_direction: stated.wrong_direction }, result(rows));
  }
  assert.equal(checked.result.bar_met, false);
  // A second reader's change keeps the first verdict beside it.
  assert.deepEqual(checked.rows.filter(row => row.first_verdict).map(row => [row.n, row.first_verdict, row.verdict]),
    [[38, 'right', 'wrong_target'], [39, 'right', 'wrong_target'], [45, 'right', 'wrong_type'], [71, 'right', 'wrong_target'], [72, 'right', 'wrong_target']]);
});
