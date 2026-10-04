// Runs on Linux under the deploy user's flock. Exactly one frontend process runs.
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { parseEnv } from 'node:util';
import { isRevision, migrationHashes, migrationChanges } from './release-artifact.mjs';
import { publishRelease } from './release-switch.mjs';

const [revision, archive] = process.argv.slice(2);
if (!isRevision(revision) || process.platform !== 'linux') throw new Error('Linux and a full release SHA are required');
const app = '/home/ubuntu/apps/sotsiaalai';
const root = '/home/ubuntu/apps/sotsiaalai-releases';
const directory = `${root}/${revision}`;
const envFile = `/etc/sotsiaalai/releases/${revision}.env`;
const unit = 'sotsiaalai-frontend.service';
const override = `/etc/systemd/system/${unit}.d/30-release.conf`;
const stateFile = `${root}/active.json`;
const log = message => console.log(`[release] ${message}`);
const command = (bin, args, options = {}) => execFileSync(bin, args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, ...options });
const sudo = (...args) => command('sudo', ['-n', ...args]);
const exists = file => fs.access(file).then(() => true, () => false);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function atomic(file, contents) { await fs.writeFile(`${file}.new`, contents); await fs.rename(`${file}.new`, file); }
async function install(file, contents, mode = '0644') {
  const temporary = `${root}/install-${process.pid}`;
  await fs.writeFile(temporary, contents, { mode: 0o600 });
  try { sudo('install', '-m', mode, temporary, file); } finally { await fs.rm(temporary, { force: true }); }
}
const readRoot = file => { try { return sudo('cat', '--', file); } catch { return null; } };
const old = await exists(stateFile) ? JSON.parse(await fs.readFile(stateFile, 'utf8')) : {
  revision: command('git', ['-C', app, 'rev-parse', 'HEAD']).trim(), directory: app,
};
if (old.revision === revision) { log(`Already active: ${revision}`); process.exit(0); }
// A delayed workflow may not replace a newer production release with an older
// artifact. Fetch refs only: the old service's source checkout stays unchanged.
command('git', ['-C', app, 'fetch', 'origin', 'main']);
command('git', ['-C', app, 'merge-base', '--is-ancestor', old.revision, revision]);
command('git', ['-C', app, 'merge-base', '--is-ancestor', revision, 'origin/main']);
const originalOverride = readRoot(override);
const frontend = readRoot('/etc/sotsiaalai/frontend.env'), rag = readRoot('/etc/sotsiaalai/rag.env');
if (frontend === null || rag === null) throw new Error('Production environment files must be readable via sudo');
let releaseEnv = `${frontend}\n${rag}\nNODE_ENV=production\n`;
const runtimeEnv = { ...process.env, ...parseEnv(releaseEnv) };
let changed, plan, planBackup;
const maintenanceBackups = new Map();
const node = (args, options = {}) => command(process.execPath, args, { cwd: directory, ...options });
const planCommand = (...args) => command('sudo', ['-n', process.execPath, `--env-file=${envFile}`, '--import', './scripts/register-node-source-loader.mjs', 'scripts/rag-v2-plan-release.mjs', ...args], { cwd: directory }).trim();
async function checkUrl(url, tries = 1) {
  for (let i = 0; i < tries; i++) {
    try { command('curl', ['--fail', '--silent', '--max-time', '5', '--output', '/dev/null', url]); return; } catch { if (i + 1 < tries) await sleep(500); }
  }
  throw new Error(`Readiness failed: ${url}`);
}

await publishRelease({
  async prepare() {
    if (await exists(directory)) throw new Error('Candidate directory already exists; inspect the failed release before retrying');
    await fs.mkdir(directory);
    command('tar', ['-xzf', archive, '-C', directory]);
    const meta = JSON.parse(await fs.readFile(`${directory}/.release-metadata.json`, 'utf8'));
    if (meta.revision !== revision || meta.nodeMajor !== Number(process.versions.node.split('.')[0]) || meta.buildId !== (await fs.readFile(`${directory}/.next/BUILD_ID`, 'utf8')).trim()) throw new Error('Artifact identity/runtime mismatch');
    for (const key of new Set([...Object.keys(meta.publicEnv), ...Object.keys(runtimeEnv).filter(key => key.startsWith('NEXT_PUBLIC_'))])) {
      if (meta.publicEnv[key] !== runtimeEnv[key]) throw new Error(`Public build/runtime configuration differs: ${key}`);
    }
    changed = migrationChanges(await migrationHashes(old.directory), meta.migrations);
    for (const name of ['tmp', 'logs', 'KOV', 'Andmebaasi', 'Arhiiv']) {
      if (await exists(`${app}/${name}`)) await fs.symlink(`${app}/${name}`, `${directory}/${name}`);
    }
    sudo('install', '-d', '-m', '0700', '/etc/sotsiaalai/releases');
    await install(envFile, releaseEnv, '0600');
    // Existing browser tabs can still request their old content-addressed chunks.
    command('cp', ['-an', `${old.directory}/.next/static/.`, `${directory}/.next/static`]);
    log(`Prepared ${revision}; migrations: ${changed.join(', ') || 'none'}`);
  },
  async migrate() {
    const env = { ...runtimeEnv, PGOPTIONS: `${runtimeEnv.PGOPTIONS || ''} -c lock_timeout=5s -c statement_timeout=15min` };
    for (const name of changed) {
      // AI reviews/tests backward compatibility before publishing. Failure never
      // runs a down-migration, and lock waits are bounded in the real database.
      node(['scripts/prisma-migration-preflight.mjs', ...(name === 'rag' ? ['--rag-v2'] : [])], { env, stdio: 'inherit' });
      node(['node_modules/prisma/build/index.js', 'migrate', 'deploy', ...(name === 'rag' ? ['--config', 'prisma/rag-v2/prisma.config.mjs'] : [])], {
        env: { ...env, ...(name === 'rag' ? { RAG_V2_DATABASE_URL: runtimeEnv.RAG_V2_POSTGRES_URL } : {}) }, stdio: 'inherit',
      });
    }
  },
  async preparePlan() {
    const result = planCommand('prepare', '--release', revision);
    if (result.startsWith('renewed ')) {
      plan = result.slice(8);
      sudo('chown', 'root:ubuntu', plan);
      releaseEnv += `M4_PILOT_CONFIG=${plan}\nM4_PILOT_ENABLED=1\n`;
      await install(envFile, releaseEnv, '0600');
    } else if (!['current', 'disabled'].includes(result) && !result.startsWith('unready ')) throw new Error('Unexpected chat plan state');
    if (result.startsWith('unready ')) log(`WARNING: existing chat plan is unready: ${result.slice(8)}`);
    if (plan || result === 'current') planCommand('ready');
    log(`Chat plan: ${result.split(' ')[0]}`);
  },
  async stop() {
    log('Stopping the single frontend service for the release switch');
    sudo('systemctl', 'stop', unit);
  },
  async switch() {
    // The materials mount protection in 20-materials-storage.conf stays active.
    sudo('install', '-d', '-m', '0755', path.dirname(override));
    await install(override, `[Service]\nWorkingDirectory=${directory}\nEnvironmentFile=\nEnvironmentFile=${envFile}\nExecStart=\nExecStart=/usr/bin/node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3000\nTimeoutStopSec=300\n`);
    sudo('systemctl', 'daemon-reload');
  },
  async start() { sudo('systemctl', 'start', unit); },
  async check() {
    await checkUrl('http://127.0.0.1:3000/api/health', 30);
    await checkUrl('http://127.0.0.1:3000/');
  },
  async checkPublic() { await checkUrl('https://sotsiaal.pro/api/health', 5); await checkUrl('https://sotsiaal.pro/'); },
  async commit() {
    if (plan) planBackup = planCommand('activate', '--plan', plan, '--rag-env', '/etc/sotsiaalai/rag.env');
    // Future timer invocations must use the same code/dependencies as the frontend.
    // Do not start or enable timers, or restart any running maintenance job.
    for (const name of ['sotsiaalai-casework-retention.service', 'sotsiaalai-notifications.service', 'sotsiaalai-service-map-contact-check.service']) {
      const file = `/etc/systemd/system/${name}`;
      maintenanceBackups.set(file, readRoot(file));
      const contents = (await fs.readFile(`${directory}/deploy/systemd/${name}`, 'utf8')).replaceAll(app, directory);
      await install(file, contents);
    }
    sudo('systemctl', 'daemon-reload');
    const state = { revision, directory, activatedAt: new Date().toISOString(), previous: { revision: old.revision, directory: old.directory } };
    await atomic(stateFile, JSON.stringify(state, null, 2) + '\n');
    log(`Active: ${revision}`);
  },
  async rollback() {
    sudo('systemctl', 'stop', unit);
    if (originalOverride === null) sudo('rm', '-f', '--', override);
    else await install(override, originalOverride);
    if (planBackup) sudo('install', '-m', '0600', planBackup, '/etc/sotsiaalai/rag.env');
    for (const [file, contents] of maintenanceBackups) {
      if (contents === null) sudo('rm', '-f', '--', file);
      else await install(file, contents);
    }
    sudo('systemctl', 'daemon-reload');
    sudo('systemctl', 'start', unit);
    await checkUrl('http://127.0.0.1:3000/api/health', 30);
    log('Previous release restored; no database down-migration attempted');
  },
  async abandon() { log(`Failed candidate retained for inspection: ${directory}`); },
});

// Keep the running and previous release. Never remove the original checkout or
// shared data. Cleanup is outside the transaction and cannot roll back success.
for (const name of await fs.readdir(root)) {
  if (!isRevision(name) || [revision, old.revision].includes(name)) continue;
  const file = `${root}/${name}`;
  if (await fs.realpath(file) !== file) throw new Error('Refusing release cleanup outside its directory');
  const workingDirectories = await Promise.all((await fs.readdir('/proc')).filter(pid => /^\d+$/.test(pid)).map(pid => fs.readlink(`/proc/${pid}/cwd`).catch(() => '')));
  if (workingDirectories.some(cwd => cwd === file || cwd.startsWith(`${file}/`))) continue;
  await fs.rm(file, { recursive: true });
  sudo('rm', '-f', '--', `/etc/sotsiaalai/releases/${name}.env`);
}
