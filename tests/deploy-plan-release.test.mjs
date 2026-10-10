import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { publishRelease, jobUnit, releaseUnit, outsideRelease, namesCheckout } from '../scripts/release-switch.mjs';
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

// 05.10.2026: the release wrote three named job units for itself; the payment e-mails, the subscription renewals and the
// availability reminders, added later, ran on from the first checkout with the code of the day the releases began.
const APP = '/home/ubuntu/apps/sotsiaalai', RELEASE = `${APP}-releases/${'a'.repeat(40)}`;
async function repositoryUnits() {
  const units = [];
  for (const folder of ['deploy/systemd', 'ops/systemd']) {
    for (const name of (await fs.readdir(new URL(`../${folder}/`, import.meta.url))).filter(name => name.endsWith('.service'))) {
      units.push({ name, text: await fs.readFile(new URL(`../${folder}/${name}`, import.meta.url), 'utf8') });
    }
  }
  return units;
}

test('every job unit of the repository that runs the app is written for the release', async () => {
  const jobs = (await repositoryUnits()).filter(unit => jobUnit(unit.name, unit.text, APP));
  const names = jobs.map(unit => unit.name).sort();
  for (const name of ['sotsiaalai-casework-retention.service', 'sotsiaalai-notifications.service', 'sotsiaalai-service-map-contact-check.service',
    'sotsiaalai-payment-emails.service', 'sotsiaalai-subscription-renewals.service', 'sotsiaalai-service-availability.service',
    'sotsiaalai-mtr-refresh.service']) assert(names.includes(name), name);
  // The frontend has its own override; a unit that does not run the app's code (routing engine, storage check) is left alone.
  for (const name of ['sotsiaalai-frontend.service', 'sotsiaalai-osrm.service', 'sotsiaalai-materials-storage-verify.service']) assert.equal(names.includes(name), false, name);
  for (const unit of jobs) {
    const written = releaseUnit(unit.text, APP, RELEASE);
    assert.match(written, new RegExp(`^WorkingDirectory=${RELEASE}$`, 'm'), unit.name);
    assert.equal(outsideRelease({ workingDirectory: RELEASE, execStart: written.match(/^ExecStart=[\s\S]*?[^\\]$/m)[0] }, APP), false, unit.name);
    assert.equal(namesCheckout(written, APP), false, unit.name);
  }
});

test('the releases folder is not taken for the first checkout, and a job left behind is named', () => {
  const written = releaseUnit(`WorkingDirectory=${APP}\nExecStart=/bin/bash -lc 'cd ${APP} && npm run job'\nReadWritePaths=-${APP}/.next/cache\n`, APP, RELEASE);
  assert.equal(written, `WorkingDirectory=${RELEASE}\nExecStart=/bin/bash -lc 'cd ${RELEASE} && npm run job'\nReadWritePaths=-${RELEASE}/.next/cache\n`);
  // Written twice (a retried release) it stays the same: the release path does not hold the checkout as a path of its own.
  assert.equal(releaseUnit(written, APP, RELEASE), written);
  assert.equal(outsideRelease({ workingDirectory: APP, execStart: '{ path=/usr/bin/npm ; argv[]=/usr/bin/npm run job ; }' }, APP), true);
  assert.equal(outsideRelease({ workingDirectory: '', execStart: `{ path=/bin/bash ; argv[]=/bin/bash -lc cd ${APP} && npm run job ; }` }, APP), true);
  assert.equal(outsideRelease({ workingDirectory: RELEASE, execStart: '{ path=/usr/bin/npm ; argv[]=/usr/bin/npm run job ; }' }, APP), false);
  // A unit without a folder of the app (a wrapper that calls the live site) is not a stray.
  assert.equal(outsideRelease({ workingDirectory: '', execStart: '{ path=/usr/local/bin/sotsiaalai-practice-reviews ; argv[]=/usr/local/bin/sotsiaalai-practice-reviews ; }' }, APP), false);
  assert.equal(jobUnit('sotsiaalai-notifications.timer', `Unit=sotsiaalai-notifications.service\n# ${APP}`, APP), false);
});
