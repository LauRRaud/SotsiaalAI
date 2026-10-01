import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { GOLD_ACTS, actBundles, actGold } from '../scripts/rag-v2-relation-gold.mjs';

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
  assert.deepEqual([gold.counts.other_act, gold.counts.denials], [{ links: 89, resolved: 32 }, { provisions: 17, with_card_relation: 7 }]);
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
  const committed = JSON.parse(await fs.readFile('tests/evaluation/graph/relation-gold-1.json', 'utf8'));
  assert.deepEqual(committed.acts.map(item => item.act), GOLD_ACTS);
  assert.deepEqual(committed.acts.find(item => item.act === SHS), JSON.parse(JSON.stringify(gold)));
});
