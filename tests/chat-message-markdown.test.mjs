import test from 'node:test';
import assert from 'node:assert/strict';
import { parseAssistantMarkdownBlocks } from '../lib/chat/messageMarkdown.js';

test('a sentence that begins with an ordinal is a paragraph, not a list of one', () => {
  // The answer the owner saw on 06.10.2026: its first paragraph stood indented as item 2 of a list.
  const answer = '2. tüüpi diabeedi korral võib olla häiritud insuliini tootmine. Vaata lisaks: diabetes.ee [S1]\n\nKüsi perearstilt veresuhkrumõõtjat. [S2]';
  assert.deepEqual(parseAssistantMarkdownBlocks(answer), [
    { type: 'paragraph', text: '2. tüüpi diabeedi korral võib olla häiritud insuliini tootmine. Vaata lisaks: diabetes.ee [S1]' },
    { type: 'paragraph', text: 'Küsi perearstilt veresuhkrumõõtjat. [S2]' }]);
  // One numbered line anywhere is a sentence, with the marker it was written with.
  assert.deepEqual(parseAssistantMarkdownBlocks('Toetust makstakse kord kuus.\n\n1) juulist muutub määr.'), [
    { type: 'paragraph', text: 'Toetust makstakse kord kuus.' }, { type: 'paragraph', text: '1) juulist muutub määr.' }]);
  // A year at the head of a sentence was a paragraph before and is one still.
  assert.deepEqual(parseAssistantMarkdownBlocks('2026. aastal on piir 220 eurot.'), [{ type: 'paragraph', text: '2026. aastal on piir 220 eurot.' }]);
});

test('a numbered list of two or more items stays a list', () => {
  assert.deepEqual(parseAssistantMarkdownBlocks('Tee nii:\n1. Esita avaldus.\n2. Oota otsust.\n\n3. Vaidlusta vajadusel.'), [
    { type: 'paragraph', text: 'Tee nii:' }, { type: 'ordered', start: 1, items: ['Esita avaldus.', 'Oota otsust.', 'Vaidlusta vajadusel.'] }]);
  // A list that does not begin with one keeps its first number.
  assert.deepEqual(parseAssistantMarkdownBlocks('3. Kolmas samm.\n4. Neljas samm.'), [{ type: 'ordered', start: 3, items: ['Kolmas samm.', 'Neljas samm.'] }]);
  // Every item numbered one is a list too.
  assert.deepEqual(parseAssistantMarkdownBlocks('1. Üks\n1. Kaks'), [{ type: 'ordered', start: 1, items: ['Üks', 'Kaks'] }]);
  // A sentence with an ordinal before a real list: the number that does not continue begins the list.
  assert.deepEqual(parseAssistantMarkdownBlocks('2. tüüpi diabeedi korral aitab liikumine.\n\n1. Mõõda veresuhkrut.\n2. Liigu iga päev.'), [
    { type: 'paragraph', text: '2. tüüpi diabeedi korral aitab liikumine.' }, { type: 'ordered', start: 1, items: ['Mõõda veresuhkrut.', 'Liigu iga päev.'] }]);
  // Bullets and an item's indented second line are as before.
  assert.deepEqual(parseAssistantMarkdownBlocks('- esimene\n  jätk\n- teine'), [{ type: 'unordered', items: ['esimene\njätk', 'teine'] }]);
});
