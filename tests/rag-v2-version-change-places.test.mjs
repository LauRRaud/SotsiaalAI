import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';
import { parseTextSource } from '../lib/rag-v2/text-source.js';
import { makeChunks } from '../lib/rag-v2/chunking.js';
import { actProvisions, compareProvisions, changedPassages, versionChangePlaces, VERSION_CHANGE_RESERVE } from '../lib/rag-v2/search/version-comparison.js';
import { validateQuery } from '../lib/rag-v2/search/ranking.js';

// ADR-091: the passages of the provisions that differ between two versions of an act become candidates of the evidence
// selection when the question asks about the day the newer version starts. The Child Protection Act's versions that end
// on 31.12.2026 and start on 01.01.2027 are read from Andmebaasi as committed (Riigi Teataja's own bytes); no network.
// In the turn measured on 05.10.2026 ("Mis muutub lastekaitseseaduses 1. jaanuaril 2027?") the candidates of the act were
// its final provisions, and section 29, which the amendment rewrote, was not among them.
const OLDER = '111072026042', NEWER = '111072026043', TITLE = 'Lastekaitseseadus', DAY = '2027-01-01';
const validity = { [OLDER]: ['2026-10-01', '2026-12-31'], [NEWER]: [DAY, null] };
async function version(rt, { title = TITLE, authority = 'Riigikogu', municipality = null } = {}) {
  const scope = { tenant_id: 'version-change-test', document_version_id: `version-${rt}` }, metadata = { title };
  const { parsed, structured } = parseTextSource(await fs.readFile(`Andmebaasi/oigusaktid/${rt}.xml`), 'xml', metadata, scope, DEFAULT_CONFIG);
  const chunks = makeChunks({ ...structured, metadata, scope, versionId: `version-${rt}`, config: DEFAULT_CONFIG });
  return { document: { id: `document-${rt}`, fields: { title: { value: title }, authority: { value: authority }, ...(municipality ? { municipality_id: { value: municipality } } : {}),
    legal_text: { value: parsed.legal_text } } }, version: { id: `version-${rt}` }, source_units: structured.source_units, chunks };
}
// A directory row as the search reads it: the version's validity and its units; a unit's id names its passage.
const rowOf = (bundle, [from, to]) => ({ document_id: bundle.document.id, version_id: bundle.version.id,
  fields: { valid_from: { value: from }, valid_to: to ? { value: to } : { value: null, open_end: true }, regions: { value: [] } },
  units: bundle.chunks.map(chunk => ({ id: `unit/${bundle.version.id}/${chunk.ordinal}`, chunk_id: chunk.id, role: { evidence_eligible: true } })) });
const loader = (bundles, calls = []) => async ids => { calls.push(ids); return bundles.filter(bundle => ids.includes(bundle.document.id)); };
const holds = (bundle, chunkId, pattern) => pattern.test(bundle.chunks.find(chunk => chunk.id === chunkId).source_text);

test('the passages of what differs between two versions: each changed provision in both, an added one in the newer, a removed one in the older', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)], groups = changedPassages(older, newer);
  const difference = compareProvisions(actProvisions(older), actProvisions(newer));
  // Every provision that differs is in exactly one group; one that only moved to another number or reads the same is in none.
  const listed = groups.flatMap(group => group.provisions);
  assert.deepEqual([...listed].sort(), [...difference.changed, ...difference.added, ...difference.removed].sort());
  assert.equal(new Set(listed).size, listed.length);
  assert.ok(difference.renumbered.length && difference.renumbered.every(item => !listed.includes(item.label)));
  // Provisions held by the same passages are one group; every passage is of its own version.
  assert.equal(new Set(groups.map(group => JSON.stringify([group.newer, group.older]))).size, groups.length);
  const [olderIds, newerIds] = [new Set(older.chunks.map(chunk => chunk.id)), new Set(newer.chunks.map(chunk => chunk.id))];
  for (const group of groups) {
    assert.ok(group.newer.every(chunk => newerIds.has(chunk)) && group.older.every(chunk => olderIds.has(chunk)));
    assert.ok(group.newer.length <= VERSION_CHANGE_RESERVE.perSide && group.older.length <= VERSION_CHANGE_RESERVE.perSide);
    assert.ok(group.newer.length + group.older.length >= 1 && group.newer.length + group.older.length <= VERSION_CHANGE_RESERVE.size);
  }
  // Section 29, which the amendment rewrote: its first subsections stand in a passage of each version.
  const rewritten = groups.find(group => group.provisions.includes('§ 29 lg 1'));
  assert.deepEqual([rewritten.newer.length, rewritten.older.length], [1, 1]);
  assert.ok(holds(newer, rewritten.newer[0], /§ 29\./u) && holds(older, rewritten.older[0], /§ 29\./u));
  // An added provision has a passage only in the newer version, a removed one only in the older.
  const added = groups.find(group => group.provisions.includes('§ 36¹')), removed = groups.find(group => group.provisions.includes('§ 29 lg 3¹'));
  assert.deepEqual([added.newer.length, added.older.length], [1, 0]);
  assert.deepEqual([removed.newer.length, removed.older.length], [0, 1]);
  // In the newer version's reading order, what was removed last.
  assert.equal(groups[0].provisions[0], '§ 11 lg 2'); assert.equal(groups.at(-1), removed);
  // The same version against itself differs in nothing.
  assert.deepEqual(changedPassages(newer, newer), []);
});

test('a turn\'s version-change places: the act whose version starts on the asked day, with the version that ended the day before', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)], rows = [rowOf(older, validity[OLDER]), rowOf(newer, validity[NEWER])];
  const calls = [], places = await versionChangePlaces(rows, [DAY], loader([older, newer], calls));
  assert.deepEqual(calls, [[older.document.id, newer.document.id]]);
  const expected = changedPassages(older, newer);
  assert.deepEqual(places.acts, [{ act: TITLE, day: DAY, older: older.document.id, newer: newer.document.id, groups: expected.length,
    provisions: expected.reduce((count, group) => count + group.provisions.length, 0) }]);
  // The groups name the index's units, the newer version's passages first.
  const unit = (bundle, chunkId) => `unit/${bundle.version.id}/${bundle.chunks.find(chunk => chunk.id === chunkId).ordinal}`;
  assert.deepEqual(places.groups, expected.map(group => [...group.newer.map(chunk => unit(newer, chunk)), ...group.older.map(chunk => unit(older, chunk))]));
  // What the search accepts as its change reserve.
  assert.equal(validateQuery({ text: 'x', language: 'et', changeReserve: { groups: places.groups, size: VERSION_CHANGE_RESERVE.size } }).changeReserve.groups.length, expected.length);
});

test('nothing is read or compared unless a kept version starts on an asked day and the one it replaced is kept too', async () => {
  const [older, newer] = [await version(OLDER), await version(NEWER)], rows = [rowOf(older, validity[OLDER]), rowOf(newer, validity[NEWER])];
  const never = async () => { throw new Error('no bundle is read'); }, none = { acts: [], groups: [] };
  // No asked day; a day on which no version starts; the newer version alone; the older alone.
  assert.deepEqual(await versionChangePlaces(rows, [], never), none);
  assert.deepEqual(await versionChangePlaces(rows, ['2027-01-02'], never), none);
  assert.deepEqual(await versionChangePlaces(rows, ['2026-12-31'], never), none);
  assert.deepEqual(await versionChangePlaces([rows[1]], [DAY], never), none);
  assert.deepEqual(await versionChangePlaces([rows[0]], [DAY], never), none);
  // A version that ended earlier than the day before is not the one the new version replaced.
  assert.deepEqual(await versionChangePlaces([rowOf(older, ['2026-10-01', '2026-11-30']), rows[1]], [DAY], never), none);
  // Another act that ends the day before: another title, another issuer, another municipality's act of the same title.
  for (const other of [{ title: 'Teine seadus' }, { authority: 'Vabariigi Valitsus' }, { municipality: 'teine_vald' }]) {
    const unrelated = await version(OLDER, other);
    assert.deepEqual(await versionChangePlaces(rows, [DAY], loader([unrelated, newer])), none, JSON.stringify(other));
  }
  // A new act that replaced the old one under the same title (another adoption day) has its own numbering: not compared.
  const replaced = { ...older, document: { ...older.document, fields: { ...older.document.fields, legal_text: { value: { ...older.document.fields.legal_text.value, adopted: '2019-01-01' } } } } };
  assert.deepEqual(await versionChangePlaces(rows, [DAY], loader([replaced, newer])), none);
  const undated = { ...older, document: { ...older.document, fields: { ...older.document.fields, legal_text: { value: {} } } } };
  assert.deepEqual(await versionChangePlaces(rows, [DAY], loader([undated, newer])), none);
  // A bundle that is no longer the version the directory names is not compared.
  assert.deepEqual(await versionChangePlaces(rows, [DAY], loader([{ ...older, version: { id: 'another-version' } }, newer])), none);
  // A source without validity (an article) is in the way of nothing.
  const article = { document_id: 'article', version_id: 'article-v1', fields: { valid_from: { value: null }, valid_to: { value: null }, regions: { value: [] } }, units: [] };
  assert.equal((await versionChangePlaces([article, ...rows], [DAY], loader([older, newer]))).acts.length, 1);
});

test('the change reserve of a query is bounded', () => {
  const base = { text: 'x', language: 'et' };
  for (const changeReserve of [null, [], { groups: 'a', size: 2 }, { groups: [['a']], size: 0 }, { groups: [['a']], size: 13 }, { groups: [['a']], size: 1.5 }, { groups: [[]], size: 2 },
    { groups: [['a', 'a']], size: 2 }, { groups: [['a', '']], size: 2 }, { groups: [['a', 1]], size: 2 }, { groups: [['a', 'b', 'c']], size: 2 }, { groups: [['a']], size: 2, extra: true },
    { groups: ['a'], size: 2 }, { groups: Array.from({ length: 2001 }, (_, at) => [`u${at}`]), size: 2 }]) {
    assert.throws(() => validateQuery({ ...base, changeReserve }), { code: 'invalid_change_reserve' }, JSON.stringify(changeReserve)?.slice(0, 80));
  }
  assert.deepEqual(validateQuery({ ...base, changeReserve: { groups: [['b', 'a'], ['a']], size: 8 } }).changeReserve, { groups: [['b', 'a'], ['a']], size: 8 });
  assert.equal(validateQuery(base).changeReserve, undefined);
});
