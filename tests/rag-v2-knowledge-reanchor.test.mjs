import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { hash, DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';

// A knowledge card (ADR-054) is bound to its source's exact bytes. When the bytes change and the text does not (a
// derived annex that now names its act version, ADR-053), the script binds the card to the new bytes only after reading
// the previous bytes and finding every source unit the same.
let root;
before(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-reanchor-')); });
after(async () => {
  const target = path.resolve(root);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-reanchor-'));
  await fs.rm(target, { recursive: true, force: true });
});

const SOURCE = 'oigusaktid/lisad/000-lisa.json', CARD = 'teadmised/000-lisa.knowledge.json';
const annex = (text, actReference) => `${JSON.stringify({ title: 'Toetuste määrad', ...(actReference ? { act_reference: actReference } : {}),
  extractor: 'rag-v2/rt-annex-text-1', table: 'text', items: [{ id: 'lk-1', title: 'Toetuste määrad', text }] }, null, 2)}\n`;
const TEXT = '1) sünnitoetus 500 eurot;\n2) matusetoetus 250 eurot.';
const QUOTE = 'sünnitoetus 500 eurot';

async function fixture(name, previousText) {
  const dir = path.join(root, name), previous = path.join(root, `${name}-previous`);
  const write = async (base, file, text) => { await fs.mkdir(path.dirname(path.join(base, file)), { recursive: true }); await fs.writeFile(path.join(base, file), text); };
  const old = annex(TEXT), next = annex(TEXT, '000');
  await write(previous, SOURCE, previousText === undefined ? old : annex(previousText));
  await write(dir, SOURCE, next);
  const units = parseTextSource(Buffer.from(old), 'json', {}, { document_version_id: 'fixture' }, DEFAULT_CONFIG).structured.source_units;
  const index = units.findIndex(unit => unit.raw_text.includes(QUOTE));
  const card = `${JSON.stringify({ schema_version: 'rag-v2/registered-knowledge-1', source_path: SOURCE, source_sha256: hash(Buffer.from(old)),
    preparation: { schema_version: 'rag-v2/knowledge-preparation-1', verification_state: 'source_anchored_unreviewed' },
    knowledge: { cards: [{ key: 'c1', anchors: [{ source_unit_index: index, start: units[index].raw_text.indexOf(QUOTE), quote: QUOTE }] }], dependencies: [], gaps: [] } }, null, 2)}\n`;
  await write(dir, CARD, card);
  await write(dir, 'REGISTER.json', JSON.stringify({ entries: [
    { path: SOURCE, role: 'source', sha256: hash(Buffer.from(next)) },
    { path: CARD, role: 'knowledge', sha256: hash(Buffer.from(card)), source_path: SOURCE }] }));
  return { dir, previous, next };
}
const run = (...args) => {
  const result = spawnSync(process.execPath, ['scripts/rag-v2-knowledge-reanchor.mjs', ...args], { encoding: 'utf8' });
  return { status: result.status, out: result.status ? JSON.parse(result.stderr.trim()) : JSON.parse(result.stdout) };
};

test('a card follows its source to new bytes only when the previous bytes read as the same text', async () => {
  const { dir, previous, next } = await fixture('same');
  // Without the previous bytes nothing is assumed.
  assert.equal(run('--input-root', dir).out.code, 'knowledge_source_hash_mismatch');
  const dry = run('--input-root', dir, '--previous-root', previous);
  assert.deepEqual(dry.out.files, [{ path: CARD, changed: 0, rebound: true }]);
  const written = run('--input-root', dir, '--previous-root', previous, '--write');
  assert.equal(written.status, 0);
  const card = JSON.parse(await fs.readFile(path.join(dir, CARD), 'utf8'));
  assert.equal(card.source_sha256, hash(Buffer.from(next)));
  assert.deepEqual(card.preparation.reanchored, [{ normalization: DEFAULT_CONFIG.normalization, reason: 'source_bytes_same_text',
    previous_source_sha256: hash(Buffer.from(annex(TEXT))) }]);
  assert.equal(card.knowledge.cards[0].anchors[0].quote, QUOTE);
  const register = JSON.parse(await fs.readFile(path.join(dir, 'REGISTER.json'), 'utf8'));
  assert.equal(register.entries[1].sha256, hash(await fs.readFile(path.join(dir, CARD))));
  // Bound once: a second run finds the card on its source's bytes.
  assert.deepEqual(run('--input-root', dir).out.files, [{ path: CARD, changed: 0 }]);
});

test('a card does not follow a source whose text changed, even where its own quote still reads the same', async () => {
  const { dir, previous } = await fixture('changed', '1) sünnitoetus 500 eurot;\n2) matusetoetus 200 eurot.');
  const result = run('--input-root', dir, '--previous-root', previous, '--write');
  assert.equal(result.out.code, 'knowledge_source_hash_mismatch');
  // The previous bytes must be the card's own; a file with the right bytes but other text is a changed source.
  const { dir: other, previous: otherPrevious } = await fixture('changed-text');
  const card = JSON.parse(await fs.readFile(path.join(other, CARD), 'utf8'));
  const edited = annex('1) sünnitoetus 500 eurot;\n2) matusetoetus 200 eurot.');
  await fs.writeFile(path.join(otherPrevious, SOURCE), edited);
  card.source_sha256 = hash(Buffer.from(edited));
  const text = `${JSON.stringify(card, null, 2)}\n`;
  await fs.writeFile(path.join(other, CARD), text);
  const register = JSON.parse(await fs.readFile(path.join(other, 'REGISTER.json'), 'utf8'));
  register.entries[1].sha256 = hash(Buffer.from(text));
  await fs.writeFile(path.join(other, 'REGISTER.json'), JSON.stringify(register));
  assert.equal(run('--input-root', other, '--previous-root', otherPrevious, '--write').out.code, 'knowledge_source_text_changed');
  assert.equal(JSON.parse(await fs.readFile(path.join(other, CARD), 'utf8')).source_sha256, hash(Buffer.from(edited)));
});
