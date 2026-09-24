import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { implementationManifest } from '../lib/rag-v2/pilot/provenance.js';

const freshness = input => spawnSync(process.execPath, ['scripts/rag-v2-plan-freshness.mjs'], { input, encoding: 'utf8' }).stdout.trim();

test('the deploy check names a pilot plan current, stale or invalid without printing it', async () => {
  const { hash } = await implementationManifest();
  assert.equal(freshness(JSON.stringify({ implementationHash: hash, users: ['secret-user'] })), 'current');
  const stale = freshness(JSON.stringify({ implementationHash: 'a'.repeat(64), users: ['secret-user'] }));
  assert.equal(stale, 'stale');
  for (const input of ['', 'not json', '{}', JSON.stringify({ implementationHash: 42 })]) assert.equal(freshness(input), 'invalid');
});
