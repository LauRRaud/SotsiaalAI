import test from 'node:test';
import assert from 'node:assert/strict';
import { publishRelease } from '../scripts/release-switch.mjs';
import { migrationChanges, runtimeFile, isRevision } from '../scripts/release-artifact.mjs';

function fixture(failure) {
  const calls = [], running = new Set(['previous']);
  let selected = 'previous', plan = 'previous', committed = false;
  const host = Object.fromEntries(['prepare', 'migrate', 'preparePlan', 'stop', 'switch', 'start', 'check', 'checkPublic', 'commit', 'rollback', 'abandon'].map(step => [step, async () => {
    calls.push(step);
    if (step === failure) throw new Error(`failed ${step}`);
    if (step === 'stop') running.delete('previous');
    if (step === 'switch') { assert.equal(running.size, 0); selected = 'next'; }
    if (step === 'start') { assert.equal(running.size, 0, 'Never run two frontend versions'); running.add(selected); }
    if (step === 'check') assert.deepEqual([...running], ['next']);
    if (step === 'commit') { plan = 'next'; committed = true; }
    if (step === 'rollback') { running.clear(); selected = 'previous'; plan = 'previous'; running.add('previous'); }
  }]));
  return { host, calls, running, state: () => ({ selected, plan, committed }) };
}

test('single process release stops only after files, migrations and chat plan are prepared', async () => {
  const f = fixture(); await publishRelease(f.host);
  assert.deepEqual(f.calls, ['prepare', 'migrate', 'preparePlan', 'stop', 'switch', 'start', 'check', 'checkPublic', 'commit']);
  assert.deepEqual([...f.running], ['next']);
  assert.deepEqual(f.state(), { selected: 'next', plan: 'next', committed: true });
});

for (const failure of ['prepare', 'migrate', 'preparePlan']) {
  test(`${failure} failure leaves the existing frontend and plan untouched`, async () => {
    const f = fixture(failure);
    await assert.rejects(publishRelease(f.host), new RegExp(`failed ${failure}`));
    assert.equal(f.calls.includes('stop'), false);
    assert.equal(f.calls.includes('rollback'), false);
    assert.deepEqual([...f.running], ['previous']);
    assert.equal(f.state().plan, 'previous');
  });
}

for (const failure of ['stop', 'switch', 'start', 'check', 'checkPublic', 'commit']) {
  test(`${failure} failure restores the previous single service and plan`, async () => {
    const f = fixture(failure);
    await assert.rejects(publishRelease(f.host), new RegExp(`failed ${failure}`));
    assert(f.calls.includes('rollback'));
    assert.deepEqual([...f.running], ['previous']);
    assert.deepEqual(f.state(), { selected: 'previous', plan: 'previous', committed: false });
  });
}

test('unchanged migrations are skipped; changed schema without migration cannot publish', () => {
  const old = { main: { schema: 'a', migrations: 'b' }, rag: { schema: 'c', migrations: 'd' } };
  assert.deepEqual(migrationChanges(old, structuredClone(old)), []);
  assert.deepEqual(migrationChanges(old, { ...old, rag: { schema: 'e', migrations: 'f' } }), ['rag']);
  assert.throws(() => migrationChanges(old, { ...old, main: { schema: 'x', migrations: 'b' } }), /without a migration/);
});

test('release includes runtime source/legal documents but excludes local secrets and archives', () => {
  for (const file of ['lib/rag-v2/pilot/provenance.js', 'scripts/rag-v2-plan-release.mjs', 'docs/legal/framework.html', 'public/logo/sotsiaal-pro-corner.svg']) assert(runtimeFile(file), file);
  for (const file of ['.env', '.env.production', 'config/.env.local', 'docs/audits/diagnostic.json', 'Arhiiv/example.pdf', 'tmp/user-upload.pdf', '.github/workflows/deploy.yml']) assert.equal(runtimeFile(file), false, file);
  assert(isRevision('a'.repeat(40)));
  for (const value of ['main', 'a'.repeat(39), '../escape', 'a'.repeat(40) + ';']) assert.equal(isRevision(value), false);
});
