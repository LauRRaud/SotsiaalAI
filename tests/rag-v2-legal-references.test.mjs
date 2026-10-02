import test from 'node:test';
import assert from 'node:assert/strict';
import { actGenitive, actSections, chunkSection, internalReferences, keepsSuperscripts, namedActReferences, provisionChunks, readReferences, resolveSection, sectionKey, sectionReferences,
  REFERENCE_LIMITS, SUPERSCRIPT_NORMALIZATIONS } from '../lib/rag-v2/search/legal-references.js';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';

// The act's sections in the act's order, a section with a superscript between its neighbours.
const sections = ['9', '15', '15^1', '16', '45', '45^9', '45^16', '46', '105', '105^1', '106', '107', '131', '132', '133'];
const reasons = (text, act = sections) => readReferences(text, act).unresolved.map(entry => entry.reason);

test('a chunk\'s section comes from its heading path, superscript included; the act\'s sections keep its order', () => {
  const chunk = (heading, rest = '') => ({ retrieval_text: `${heading}\n\n${rest}`, retrieval_mapping: { prefix_length: heading.length } });
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > 8. jagu Toimetulekutoetus > § 133. Toimetulekutoetuse arvestamise alused')), '133');
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > § 15¹. Eluruumi tagamine')), '15^1');
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > 3. peatükk', '§ 9. body text')), null);
  assert.equal(sectionKey('45', '¹⁶'), '45^16');
  const act = ['§ 15. A', '§ 15. A', '§ 15¹. B', '3. peatükk', '§ 16. C'].map(heading => chunk(`X > ${heading}`));
  assert.deepEqual(actSections(act), ['15', '15^1', '16']);
  assert.throws(() => actSections([...act, chunk('X > § 15. A')]), /act_sections_out_of_order/);
  assert.throws(() => readReferences('§ 9', new Set(sections)), /ordered_sections_required/);
});

test('a list keeps its act: another act\'s list is not the act\'s own, "käesoleva seadustiku/koodeksi" is', () => {
  // Codex J5: "Teise seaduse § 131 ja § 133 alusel" gave 133.
  assert.deepEqual(internalReferences('Teise seaduse § 131 ja § 133 alusel', sections), []);
  assert.deepEqual(readReferences('Teise seaduse § 131 ja § 133 alusel', sections).other.length, 1);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 lõike 2 ja täitemenetluse seadustiku §-de 131 ja 132 kohaselt', sections), []);
  assert.deepEqual(internalReferences('käesoleva seadustiku § 9', sections), ['9']);
  assert.deepEqual(internalReferences('käesoleva koodeksi §-s 16 ja § 46 lõikes 2', sections), ['16', '46']);
  assert.deepEqual(internalReferences('käesoleva seaduse §-s 9 sätestatud korras ja § 133 lõikes 1', sections), ['9', '133']);
  // The act named with its publication, title or chapter in between is still the act of the list.
  assert.deepEqual(internalReferences('lastekaitseseaduse (RT I, 06.12.2014, 1) § 9', sections), []);
  assert.deepEqual(internalReferences('Kose Vallavolikogu määruse nr 5 „Abi andmise kord“ § 9', sections), []);
  assert.deepEqual(internalReferences('käesoleva seaduse 3. peatüki 2. jao § 106', sections), ['106']);
  // An abbreviation names an act of unknown identity, never the act's own.
  assert.deepEqual(internalReferences('SHS § 9 ja KOKS-i § 16 ning TsMS § 131', sections), []);
});

test('lists and ranges: every number of a plural mark, every section of a range in the act\'s order', () => {
  assert.deepEqual(internalReferences('käesoleva seaduse §-des 105, 106 ja 107', sections), ['105', '106', '107']);
  // A range includes the sections with a superscript between its ends.
  assert.deepEqual(internalReferences('käesoleva seaduse §-des 105–107', sections), ['105', '105^1', '106', '107']);
  assert.deepEqual(internalReferences('§-des 15–16 ja 131', sections), ['15', '15^1', '16', '131']);
  assert.deepEqual(internalReferences('§ 131 ja § 133 ning §§ 105, 106', sections), ['131', '133', '105', '106']);
  // A singular mark's bare number is a section only when the list goes on after it: "§ 9 ja 16 kuu jooksul" names one.
  assert.deepEqual(internalReferences('§ 9 ja 16 kuu jooksul', sections), ['9']);
  assert.deepEqual(internalReferences('§-s 9, 16, § 46 lõikes 3, §-s 105–106, 131 või 133 sätestatud', sections), ['9', '16', '46', '105', '105^1', '106', '131']);
  // An ordinal is no section, and a section's own heading at the start of a line is no reference.
  assert.deepEqual(internalReferences('käesoleva seaduse §-des 9 ja 16. peatükis', sections), ['9']);
  assert.deepEqual(internalReferences('§ 131. Toetuse maksmine\n(1) Toetust makstakse § 133 alusel. Vt ka § 9.', sections), ['133', '9']);
  // Smaller units stay with their section and do not end the list.
  const units = readReferences('§ 133 lõike 1 punktides 2 ja 3 ning § 9 lõike 2 teises lauses ja § 106 lg 1', sections).references;
  assert.deepEqual(units.map(entry => [entry.key, entry.unit]), [['133', 'lõike 1 punktides 2 ja 3'], ['9', 'lõike 2 teises lauses'], ['106', 'lg 1']]);
  assert.deepEqual(internalReferences('Teise seaduse § 131 lõike 1 punktis 2 ja § 133', sections), []);
});

test('superscripts: written, lost and restored only when unique; unknown or ambiguous numbers are named, never guessed', () => {
  assert.deepEqual(internalReferences('käesoleva seaduse § 15¹ alusel', sections), ['15^1']);
  // "§ 459" and "§ 4516" are § 45⁹ and § 45¹⁶ whose superscripts the text lost; "§ 151" could be § 15¹ or § 151.
  assert.deepEqual(internalReferences('käesoleva seaduse § 459 lõikes 1 ja § 4516 lõigetes 1', sections), ['45^9', '45^16']);
  assert.deepEqual(readReferences('käesoleva seaduse § 151', [...sections, '151']), { references: [], other: [],
    unresolved: [{ at: 20, end: 23, reason: 'section_ambiguous' }] });
  assert.deepEqual(internalReferences('§ 999 ja § 131 ja § 131 uuesti', sections), ['131']);
  assert.deepEqual(reasons('§ 999 ja § 131'), ['section_not_in_act']);
  assert.deepEqual(reasons('§-des 107–105'), ['range_reversed']);
  assert.deepEqual(reasons('§-des 105–999'), ['range_bound_unknown']);
  const long = Array.from({ length: REFERENCE_LIMITS.range + 1 }, (_, index) => String(index + 1));
  assert.deepEqual(readReferences(`§-des 1–${long.length}`, long), { references: [], other: [], unresolved: [{ at: 6, end: 10, reason: 'range_too_long' }] });
});

test('a text that keeps its superscripts (ADR-056): a plain number is exactly that section, never a restored one', () => {
  const kept = { exactNumbers: true };
  // The Sotsiaalhoolekande seadus has § 15¹ and § 151: in a v28 text "§ 151 punktile 3" is § 151, which the older reading
  // left out as ambiguous; "§ 459" is no section, because § 45⁹ would read "§ 45⁹".
  assert.deepEqual(internalReferences('käesoleva seaduse § 151 punktile 3', [...sections, '151'], kept), ['151']);
  assert.deepEqual(reasons('käesoleva seaduse § 151 punktile 3', [...sections, '151']), ['section_ambiguous']);
  assert.deepEqual(readReferences('käesoleva seaduse § 459 lõikes 1', sections, kept).unresolved.map(entry => entry.reason), ['section_not_in_act']);
  assert.deepEqual(internalReferences('käesoleva seaduse § 45⁹ ja §-des 105–106', sections, kept), ['45^9', '105', '105^1', '106']);
  const version = normalization => ({ source_format: 'xml', processing_config: { normalization } });
  assert.equal(keepsSuperscripts(version('source-structure-v28')), true);
  assert.equal(keepsSuperscripts(version('source-structure-v29')), true);
  // v30 reads the text exactly as v29 and adds amendment notes beside it (ADR-062).
  assert.equal(keepsSuperscripts(version('source-structure-v30')), true);
  // A later normalization is not taken on trust (Codex R3): it is named only when it is known to keep the superscripts, and
  // the current one must be named, so a new normalization cannot pass without that decision.
  assert.equal(keepsSuperscripts(version('source-structure-v31')), false);
  assert.ok(SUPERSCRIPT_NORMALIZATIONS.includes(DEFAULT_CONFIG.normalization));
  assert.equal(keepsSuperscripts(version('source-structure-v27')), false);
  assert.equal(keepsSuperscripts({ ...version('source-structure-v28'), source_format: 'pdf' }), false);
  assert.equal(keepsSuperscripts({ source_format: 'xml', processing_config: {} }), false);
  assert.equal(keepsSuperscripts(null), false);
});

test('the act of a bare list: a sentence\'s other act makes it unclear, a new sentence starts over, "sama seaduse" follows the last act', () => {
  // After another act's list in the same sentence a bare "§ 9" could be either act's.
  assert.deepEqual(reasons('lastekaitseseaduse § 3 alusel ja § 9 kohaselt'), ['act_scope_unclear']);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 alusel ja § 9 kohaselt', sections), []);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 ja käesoleva seaduse § 16 alusel ning § 9 kohaselt', sections), ['16', '9']);
  // A sentence boundary ends the other act's scope; a comma alone does not.
  assert.deepEqual(internalReferences('Toetust makstakse lastekaitseseaduse § 3 alusel. Taotlus esitatakse § 9 kohaselt.', sections), ['9']);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 alusel; § 9 kohaselt', sections), ['9']);
  assert.deepEqual(reasons('lastekaitseseaduse § 3, samuti § 9'), ['act_scope_unclear']);
  // "sama seaduse" is the act named last; with none named it is left out.
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3. Sama seaduse § 9 kohaselt', sections), []);
  assert.deepEqual(internalReferences('käesoleva seaduse § 16. Sama seaduse § 9 kohaselt', sections), ['16', '9']);
  assert.deepEqual(reasons('Sama seaduse § 9 kohaselt'), ['same_act_unknown']);
});

test('an act named anywhere before a bare list, in any case form, and an earlier version keep the list from the act\'s own', () => {
  // "võlaõigusseaduses ... sätestatut § 272": the other act is named, not just before the mark.
  assert.deepEqual(reasons('lepingule ei kohaldata võlaõigusseaduses eluruumide kohta sätestatut § 133 lõike 4 kohaselt'), ['act_scope_unclear']);
  assert.deepEqual(internalReferences('sotsiaalhoolekande seadus § 131 lõikes 1 nimetatud hooldaja', sections), []);
  // "käesolevas seaduses" is the act itself and "seadusliku esindaja" names no act.
  assert.deepEqual(internalReferences('Käesolevas seaduses sätestatud juhul esitab seadusliku esindaja taotluse § 9 alusel', sections), ['9']);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 ja käesoleva seaduse § 16 alusel ning võlaõigusseaduses sätestatud § 9 kohaselt', sections), ['16']);
  // An earlier version's section is not today's section of the same number.
  assert.deepEqual(reasons('käesoleva seaduse kuni 2015. aasta 31. detsembrini kehtinud redaktsiooni § 131 lõike 1 ja § 133 alusel'), ['other_version', 'other_version']);
  assert.deepEqual(reasons('seaduse kuni 2015. aasta 31. detsembrini kehtinud redaktsiooni § 131 alusel ja § 133 kohaselt'), ['other_version', 'act_scope_unclear']);
});

// ADR-063: another act named in full directly before its list.
test('a named other act: its title in the genitive directly before the list names it; anything else names none', () => {
  assert.deepEqual(['Sotsiaalhoolekande seadus', ' Perekonnaseadus ', 'Karistusseadustik', 'Halduskohtumenetluse  seadustik', 'Abivahendite loetelu', null].map(actGenitive),
    ['sotsiaalhoolekande seaduse', 'perekonnaseaduse', 'karistusseadustiku', 'halduskohtumenetluse seadustiku', null, null]);
  const names = new Map([['sotsiaalhoolekande seaduse', 'shs'], ['perekonnaseaduse', 'pks'], ['sotsiaalseadustiku üldosa seaduse', 'sys'], ['üldosa seaduse', 'short']]);
  const read = text => namedActReferences(text, names).map(({ act, base, superscript, subsections }) => [act, base + superscript, subsections]);
  assert.deepEqual(read('Teenust ei osuta isik, kes on sotsiaalhoolekande seaduse § 25 lõikes 2 nimetatud isik.'), [['shs', '25', ['2']]]);
  assert.deepEqual(read('Laps on ülalpidamist saama õigustatud perekonnaseaduse § 97 punkti 1 või 2 alusel.'), [['pks', '97', []]]);
  // What may stand between the name and the list; a superscript; several subsections; two sections of one list.
  assert.deepEqual(read('Vastavalt Sotsiaalhoolekande  seaduse (RT I, 30.06.2026, 65) § 45¹³ lõigetes 5 ja 6 sätestatule.'), [['shs', '45¹³', ['5', '6']]]);
  assert.deepEqual(read('Sotsiaalhoolekande seaduse §-des 131 ja 133 sätestatud alustel.'), [['shs', '131', []], ['shs', '133', []]]);
  assert.deepEqual(read('Sotsiaalhoolekande seaduse § 17 lõike 2¹ kohaselt.'), [['shs', '17', ['2^1']]]);
  // Of two names that both end the words before the list, the longer one.
  assert.deepEqual(read('Sotsiaalseadustiku üldosa seaduse § 28 alusel.'), [['sys', '28', []]]);
  // No name of the map, an abbreviation, the act itself, "sama seaduse", a name elsewhere in the sentence, a range, a
  // name that only ends like one ("ohvriabi…" is not "…perekonnaseaduse").
  for (const text of ['Lastekaitseseaduse § 28 lõike 1 kohaselt.', 'SHS § 25 lõikes 2 nimetatud isik.', 'Käesoleva seaduse § 25 lõikes 2 nimetatud isik.',
    'Perekonnaseadus kehtib. Sama seaduse § 97 kohaselt.', 'Sotsiaalhoolekande seaduses sätestatud korras ja § 25 alusel.', 'Sotsiaalhoolekande seaduse §-des 131–133 sätestatud alustel.',
    'Uusperekonnaseaduse § 97 kohaselt.']) assert.deepEqual(read(text), [], text);
  // The number is as written; the other act's own sections say which section it is.
  assert.deepEqual([resolveSection('25', '', ['24', '25', '26'], true), resolveSection('45', '¹³', ['45', '45^13'], true), resolveSection('131', '', ['13^1'], false),
    resolveSection('131', '', ['13^1'], true), resolveSection('7', '', ['8'], true)], ['25', '45^13', '13^1', null, null]);
});

test('the passages that hold a named subsection: its own text, also when it runs on; without one, the section\'s start', () => {
  // § 7 in three passages: lõige 1 and the mark of lõige 2 in the first, lõige 2 over the second and third; § 8 in one.
  const raw = '\n(1)\nEsimene lõige.\n(2)\nTeise lõike algus.\nTeise lõike lõpp.\n(3)\nKolmas lõige.\n';
  const offset = text => raw.indexOf(text), span = (id, text) => ({ id, source_unit_index: 0, start: offset(text), end: offset(text) + text.length });
  const spans = [span('s1', '(1)\nEsimene lõige.\n(2)'), span('s2', 'Teise lõike algus.'), span('s3', 'Teise lõike lõpp.\n(3)\nKolmas lõige.'),
    { id: 's4', source_unit_index: 1, start: 0, end: 12 }];
  const chunk = (id, ordinal, section, spanId) => {
    const heading = `Seadus > § ${section}. Pealkiri`;
    return { id, ordinal, span_ids: [spanId], retrieval_text: `${heading}\n\ntekst`, retrieval_mapping: { prefix_length: heading.length } };
  };
  const chunks = [chunk('c1', 0, '7', 's1'), chunk('c2', 1, '7', 's2'), chunk('c3', 2, '7', 's3'), chunk('c4', 3, '8', 's4')];
  const bundle = { spans, source_units: [{ raw_text: raw }, { raw_text: 'Üks säte ilma lõigeteta.' }] };
  const held = (...rest) => provisionChunks(bundle, chunks, ...rest).map(item => item.id);
  assert.deepEqual([held('7'), held('7', '1'), held('7', '2'), held('7', '2', { limit: 1 }), held('7', '3'), held('7', '9'), held('8', '2'), held('9', '1')],
    [['c1'], ['c1'], ['c2', 'c3'], ['c2'], ['c3'], ['c1'], ['c4'], []]);
  // A subsection number from a text that may have lost a superscript (Codex review of #301): § 5 has lõiked 2, 2¹ and
  // 21, § 6 has lõiked 2 and 2¹. A plain "21" is lõige 2¹ only where no lõige 21 stands beside it; a written "2¹" is exact.
  const rawFive = '\n(2)\nTeine.\n(2¹)\nTeine prim.\n(21)\nKahekümne esimene.\n', rawSix = '\n(2)\nTeine.\n(2¹)\nTeine prim.\n';
  const part = (id, unit, raw, text) => ({ id, source_unit_index: unit, start: raw.indexOf(text), end: raw.indexOf(text) + text.length });
  const lost = { spans: [part('a1', 0, rawFive, 'Teine.'), part('a2', 0, rawFive, 'Teine prim.'), part('a3', 0, rawFive, 'Kahekümne esimene.'),
    part('b1', 1, rawSix, 'Teine.'), part('b2', 1, rawSix, 'Teine prim.')], source_units: [{ raw_text: rawFive }, { raw_text: rawSix }] };
  const lostChunks = [chunk('a1', 0, '5', 'a1'), chunk('a2', 1, '5', 'a2'), chunk('a3', 2, '5', 'a3'), chunk('b1', 3, '6', 'b1'), chunk('b2', 4, '6', 'b2')];
  const from = (section, subsection, exactNumbers) => provisionChunks(lost, lostChunks, section, subsection, { exactNumbers }).map(item => item.id);
  assert.deepEqual([from('5', '21', true), from('5', '21', false), from('5', '2^1', false), from('6', '21', false), from('6', '21', true), from('6', '2', false)],
    [['a3'], ['a1'], ['a2'], ['b2'], ['b1'], ['b1']]);
  // A bundle without its source units gives the section's start.
  assert.deepEqual(provisionChunks({ spans }, chunks, '7', '2').map(item => item.id), ['c1']);
});

// ADR-068: the act's own sections with the subsections named for each.
test('own references with their subsections: each section once, its named subsections in order, whole when a mention names the section alone', () => {
  const sections = ['9', '16', '34', '34^2', '46', '72'], kept = { exactNumbers: true };
  const read = (text, options) => sectionReferences(text, sections, options).map(({ key, subsections, whole }) => [key, subsections, whole]);
  assert.deepEqual(read('käesoleva seaduse § 34² lõigetes 3 ja 4 nimetatud andmed', kept), [['34^2', ['3', '4'], false]]);
  assert.deepEqual(read('käesoleva seaduse § 72 kohaselt'), [['72', [], true]]);
  // Two mentions of one section: the subsections of both, and its start because one names the section alone.
  assert.deepEqual(read('käesoleva seaduse § 46 lõikes 2 ja § 9 alusel ning § 46 kohaselt ja § 46 lõike 2¹ alusel', kept), [['46', ['2', '2^1'], true], ['9', [], true]]);
  // A point or a sentence without a subsection names the section.
  assert.deepEqual(read('käesoleva seaduse § 16 punktis 3'), [['16', [], true]]);
  // The sections are the ones internalReferences gives, in its order; another act's are none.
  for (const text of ['käesoleva seaduse §-s 9 sätestatud korras ja § 46 lõikes 1', 'lastekaitseseaduse § 9 lõikes 2 ja § 16', '§ 999 lõikes 1 ja § 72 lõikes 1'])
    assert.deepEqual(read(text).map(([key]) => key), internalReferences(text, sections), text);
});
