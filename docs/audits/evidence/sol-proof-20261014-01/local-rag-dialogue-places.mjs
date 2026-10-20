import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
// RAG-03 component check: whose municipality the search uses as two people and two municipalities appear, one is
// corrected and later negated. The model's search plan is replaced by already checked synthetic places; no model call.
const root = process.argv[2];
const pp = await import(pathToFileURL(root + '/lib/rag-v2/pilot/person-places.js'));
const directory = [{region: 'sol-kov-a'}, {region: 'sol-kov-b'}, {region: 'sol-kov-c'}, {region: 'sol-kov-d'}];
const known = region => directory.some(row => row.region === region);
const rec = {runId: 'sol-proof-20261014-01', serverRelease: 'f15b4866f9a3305c1d9de5ee93fcd3cdbfc76ff9', checkpointDate: '2026-10-20',
  environment: 'local Node run of lib/rag-v2/pilot/person-places.js; code identical to the deployed commit; synthetic region ids',
  checks: [], observations: [], newPaidCalls: false,
  limits: ['The model search plan that attributes a place to a person was not run; its output is replaced by checked synthetic places.',
    'Estonian morphology (EstNLTK) and the real municipality directory were not used.']};
const check = (variant, ok, actual) => rec.checks.push({case_id: 'RAG-03', variant_id: variant, status: ok ? 'PASS' : 'FAIL',
  evidence_mode: 'CURRENT_FIXTURE', entrypoint: 'deterministic person-region functions of the current code', actual});
const place = (person, region, relation, turn, sentence) => ({person, region, relation, turn, sentence});
const regionOf = (people, person) => people.find(entry => entry.person === person)?.region || null;

// Turn 1: the user lives in A.
const p1 = pp.resolvePersonRegions([], [place('user', 'sol-kov-a', 'lives', 1, 'Elan A vallas.')], 'user');
const s1 = pp.regionScope(regionOf(p1, 'user'), 'user', 1, known);
check('user_region_from_own_statement', s1.state === 'person_mentioned_region' && s1.region === 'sol-kov-a', {scope: s1});

// Turn 2: the mother lives in B; the user's A must stay.
const p2 = pp.resolvePersonRegions(p1, [place('ema', 'sol-kov-b', 'lives', 2, 'Minu ema elab B vallas.')], 'ema');
const t2 = pp.regionTarget('ema', {people: p1, focus: 'user'}, 'Minu ema elab B vallas.');
const s2 = pp.regionScope(regionOf(p2, t2), t2, 2, known);
check('second_person_gets_own_region_without_mixing', t2 === 'ema' && s2.region === 'sol-kov-b' && regionOf(p2, 'user')?.id === 'sol-kov-a',
  {target: t2, motherScope: s2, userRegion: regionOf(p2, 'user')?.id});

// Turn 3: correction - the mother lives in C instead.
const p3 = pp.resolvePersonRegions(p2, [place('ema', 'sol-kov-c', 'lives', 3, 'Vabandust, ema elab hoopis C vallas.')], 'ema');
check('correction_replaces_region', regionOf(p3, 'ema')?.id === 'sol-kov-c' && regionOf(p3, 'ema')?.status === 'reported' && regionOf(p3, 'user')?.id === 'sol-kov-a',
  {mother: regionOf(p3, 'ema'), userRegion: regionOf(p3, 'user')?.id});

// Turn 4: same topic about the mother, no new place - the correction must reach the next search.
const s4 = await pp.personRegionScope({previousValue: {people: p3, focus: 'ema'}, places: [], person: 'ema', turn: {text: 'Kas ta saaks koduteenust?'}, turnNumber: 4, directory});
check('correction_reaches_next_turn_scope', s4.state === 'person_region' && s4.region === 'sol-kov-c', {scope: s4});

// Turn 5: the plan names the user - the user's own region, not the mother's.
const s5 = await pp.personRegionScope({previousValue: {people: p3, focus: 'ema'}, places: [], person: 'user', turn: {text: 'Aga kas mina saaksin ka?'}, turnNumber: 5, directory});
check('user_turn_keeps_user_region', s5.region === 'sol-kov-a' && s5.person === 'user', {scope: s5});

// Turn 6: the mother no longer lives in C - region required, and the replaced B must not come back.
const p6 = pp.resolvePersonRegions(p3, [place('ema', 'sol-kov-c', 'not', 6, 'Ema ei ela enam C vallas.')], 'ema');
const s6 = pp.regionScope(regionOf(p6, 'ema'), 'ema', 6, known);
check('negation_requires_new_region_without_reviving_old', s6.state === 'region_required_after_negation' && s6.region === null && regionOf(p6, 'ema')?.id !== 'sol-kov-b',
  {scope: s6, mother: regionOf(p6, 'ema')});

// Two municipalities in one turn for the father - ambiguous, never a guess.
const p7 = pp.resolvePersonRegions(p3, [place('isa', 'sol-kov-c', 'lives', 7, 'Isa elab C vallas.'), place('isa', 'sol-kov-d', 'lives', 7, 'Isa elab ka D vallas.')], 'isa');
const s7 = pp.regionScope(regionOf(p7, 'isa'), 'isa', 7, known);
check('two_places_in_one_turn_stay_ambiguous', s7.state === 'ambiguous_region' && s7.region === null && s7.candidates.length === 2, {scope: s7});

// Fallback when the plan cannot tell whom the message is about: a first person singular question after a turn about the mother.
const fallbackTarget = pp.regionTarget('unclear', {people: p3, focus: 'ema'}, 'Kas mina saaksin ka koduteenust?');
const s8 = await pp.personRegionScope({previousValue: {people: p3, focus: 'ema'}, places: [], person: 'unclear', turn: {text: 'Kas mina saaksin ka koduteenust?'}, turnNumber: 8, directory});
rec.observations.push({case_id: 'RAG-03', variant_id: 'unclear_plan_first_person_question_after_focus_on_other',
  status: 'NOT_PROVEN', target: fallbackTarget, scope: s8,
  note: fallbackTarget === 'user' ? 'Falls back to the user.' : 'With an unclear plan, a first person singular question is scoped to the previous focus person (the mother) and her municipality, not the user. The first person check only stops choosing a named person. How often the live plan returns unclear was not measured, so this is not counted as a confirmed defect.'});

rec.finishedAt = new Date().toISOString();
fs.writeFileSync('local-rag-dialogue-places.json', JSON.stringify(rec, null, 2) + '\n');
console.log(JSON.stringify({checks: rec.checks.map(c => c.variant_id + ':' + c.status), observation: rec.observations[0].target + ' -> ' + JSON.stringify(rec.observations[0].scope)}));
