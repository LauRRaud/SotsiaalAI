import test from 'node:test';
import assert from 'node:assert/strict';
import { chunkSection, internalReferences, sectionKey } from '../lib/rag-v2/search/legal-references.js';

const known = new Set(['9', '105', '106', '107', '131', '133', '15^1', '45^9', '45^16']);

test('a chunk\'s section comes from its heading path, superscript included', () => {
  const chunk = (heading, rest = '') => ({ retrieval_text: `${heading}\n\n${rest}`, retrieval_mapping: { prefix_length: heading.length } });
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > 8. jagu Toimetulekutoetus > § 133. Toimetulekutoetuse arvestamise alused')), '133');
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > § 15¹. Eluruumi tagamine')), '15^1');
  assert.equal(chunkSection(chunk('Riigikogu > Sotsiaalhoolekande seadus > 3. peatükk', '§ 9. body text')), null);
  assert.equal(sectionKey('45', '¹⁶'), '45^16');
});

test('the act\'s own references are read, another act\'s are not, and a lost superscript is restored only when unique', () => {
  assert.deepEqual(internalReferences('käesoleva seaduse §-s 9 sätestatud korras ja § 133 lõikes 1', known), ['9', '133']);
  assert.deepEqual(internalReferences('lastekaitseseaduse § 3 lõike 2 ja täitemenetluse seadustiku §-de 131 ja 132 kohaselt', known), []);
  assert.deepEqual(internalReferences('käesoleva seaduse §-des 105–107', known), ['105', '107']);
  // "§ 459" and "§ 4516" are § 45⁹ and § 45¹⁶ whose superscripts the text lost; "§ 151" could be § 15¹ or § 151.
  assert.deepEqual(internalReferences('käesoleva seaduse § 459 lõikes 1 ja § 4516 lõigetes 1', known), ['45^9', '45^16']);
  assert.deepEqual(internalReferences('käesoleva seaduse § 151', new Set([...known, '151'])), []);
  assert.deepEqual(internalReferences('käesoleva seaduse § 15¹ alusel', known), ['15^1']);
  assert.deepEqual(internalReferences('§ 999 ja § 131 ja § 131 uuesti', known), ['131']);
});
