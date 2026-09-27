import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// ADR-037: the real generated deploy script, run against a local git remote with stand-ins for sudo, systemctl, npm
// and npx that record every call. A release whose chat plan check fails must bring back the previous code, build and
// plan; a release with a renewed plan activates it after the main migration and checks it after the restart.
const bash = spawnSync('bash', ['-c', 'echo ok'], { encoding: 'utf8' });
const skip = bash.stdout?.trim() !== 'ok' ? 'bash is not available' : false;

const STUBS = {
  sudo: `#!/usr/bin/env bash
[ "$1" = "-n" ] && shift
echo "sudo $*" >> "$CALLS"
case "$1" in chown) exit 0 ;; esac
exec "$@"`,
  systemctl: `#!/usr/bin/env bash
echo "systemctl $*" >> "$CALLS"
case "$1" in is-active) [ "$2" = "--quiet" ] || echo active; exit 0 ;; cat) exit 1 ;; esac
exit 0`,
  npm: `#!/usr/bin/env bash
echo "npm $* @$(cat VERSION 2>/dev/null)" >> "$CALLS"
if [ "$1" = "run" ] && [ "$2" = "build" ]; then mkdir -p .next && cat VERSION > .next/marker; fi
if [ "$1" = "ci" ]; then mkdir -p node_modules/.bin && for b in cross-env cross-env-shell; do printf '#!/bin/sh\\n' > "node_modules/.bin/$b"; chmod 755 "node_modules/.bin/$b"; done; fi
exit 0`,
  npx: `#!/usr/bin/env bash
echo "npx $*" >> "$CALLS"
exit 0`,
};
// The release's own plan command: behaviour chosen by the committed file plan-mode (fail or renew).
const PLAN_COMMAND = `import fs from 'node:fs';
const [mode, ...args] = process.argv.slice(2), arg = name => args[args.indexOf(name) + 1];
const planMode = fs.readFileSync('plan-mode', 'utf8').trim();
fs.appendFileSync(process.env.CALLS, \`plan \${mode} @\${fs.readFileSync('VERSION', 'utf8').trim()}\\n\`);
if (mode === 'prepare') {
  if (planMode === 'fail') { console.error('{"ok":false,"code":"unknown_retrieval_profile"}'); process.exit(1); }
  if (planMode === 'unready') { console.log('unready active_index_mismatch'); process.exit(0); }
  const file = process.env.PLAN_DIR + '/renewed.json'; fs.writeFileSync(file, '{}'); console.log('renewed ' + file);
} else if (mode === 'activate') {
  const env = arg('--rag-env'), text = fs.readFileSync(env, 'utf8'); fs.writeFileSync(env + '.before', text);
  fs.writeFileSync(env, text.replace(/^M4_PILOT_CONFIG=.*$/m, 'M4_PILOT_CONFIG=' + arg('--plan'))); console.log(env + '.before');
} else if (mode === 'ready') { if (planMode === 'renew-not-ready') process.exit(1); console.log('ready'); }
`;
const git = (cwd, ...args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t' } });
  assert.equal(result.status, 0, result.stderr); return result.stdout.trim();
};
async function sandbox(nextMode) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'deploy-plan-release-'));
  const bin = path.join(root, 'bin'), app = path.join(root, 'app'), origin = path.join(root, 'origin.git'), plans = path.join(root, 'plans');
  await fs.mkdir(bin); await fs.mkdir(plans); await fs.mkdir(path.join(root, 'home'));
  for (const [name, text] of Object.entries(STUBS)) await fs.writeFile(path.join(bin, name), `${text}\n`, { mode: 0o755 });
  git(root, 'init', '-q', '--bare', '-b', 'main', origin);
  git(root, 'clone', '-q', origin, app);
  git(app, 'checkout', '-q', '-b', 'main');
  const commit = async (version, mode) => {
    await fs.mkdir(path.join(app, 'scripts'), { recursive: true });
    await fs.writeFile(path.join(app, 'VERSION'), `${version}\n`);
    await fs.writeFile(path.join(app, 'plan-mode'), `${mode}\n`);
    await fs.writeFile(path.join(app, 'package.json'), JSON.stringify({ scripts: { build: 'node -e "require(\'fs\').mkdirSync(\'.next\',{recursive:true});require(\'fs\').copyFileSync(\'VERSION\',\'.next/marker\')"', 'prisma:generate': 'node -e 0' } }));
    await fs.writeFile(path.join(app, '.gitignore'), '.next\n.migration-state.*\ndeploy-build-logs\nnode_modules\n');
    await fs.writeFile(path.join(app, 'scripts', 'register-node-source-loader.mjs'), '');
    await fs.writeFile(path.join(app, 'scripts', 'prisma-migration-state.mjs'), "import fs from 'node:fs'; if (process.argv[2] === 'write') fs.writeFileSync(process.argv[3], '{}');\n");
    await fs.writeFile(path.join(app, 'scripts', 'rag-v2-plan-release.mjs'), PLAN_COMMAND);
    git(app, 'add', '-A'); git(app, 'commit', '-q', '-m', version);
    return git(app, 'rev-parse', 'HEAD');
  };
  const previous = await commit('previous', 'renew');
  git(app, 'push', '-q', '-u', 'origin', 'main');
  await fs.mkdir(path.join(app, '.next')); await fs.writeFile(path.join(app, '.next', 'marker'), 'previous\n');
  const next = await commit('next', nextMode);
  git(app, 'push', '-q', 'origin', 'main');
  git(app, 'reset', '-q', '--hard', previous);
  const ragEnv = path.join(root, 'rag.env'), frontendEnv = path.join(root, 'frontend.env');
  await fs.writeFile(ragEnv, `RAG_V2_POSTGRES_URL=postgres://synthetic\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=${plans}/previous.json\n`);
  await fs.writeFile(frontendEnv, 'NODE_ENV=production\n');
  const script = spawnSync(process.execPath, ['scripts/deploy-server.mjs', '--print-script'], { encoding: 'utf8',
    env: { ...process.env, DEPLOY_APP_DIR: posix(app), DEPLOY_FRONTEND_ENV: posix(frontendEnv), DEPLOY_RAG_ENV: posix(ragEnv) } }).stdout;
  const calls = path.join(root, 'calls.log'); await fs.writeFile(calls, '');
  const run = spawnSync('bash', ['-s'], { input: script, encoding: 'utf8', timeout: 120000,
    env: { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, HOME: path.join(root, 'home'), CALLS: mixed(calls), PLAN_DIR: mixed(plans) } });
  return { root, app, previous, next, ragEnv, run, calls: (await fs.readFile(calls, 'utf8')).trim().split('\n'),
    cleanup: () => fs.rm(root, { recursive: true, force: true }) };
}
const index = (calls, pattern) => calls.findIndex(line => pattern.test(line));
// Git Bash on Windows: tar reads "C:" as a remote host, so the script gets /c/... paths; node and bash both take C:/...
const posix = file => process.platform === 'win32' ? file.replace(/\\/g, '/').replace(/^([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`) : file;
const mixed = file => process.platform === 'win32' ? file.replace(/\\/g, '/') : file;

test('a release whose chat plan check fails brings back the previous code, build and plan', { skip }, async () => {
  const s = await sandbox('fail');
  try {
    assert.equal(s.run.status, 8, s.run.stderr);
    assert.match(s.run.stderr, /No chat plan runs on this release/);
    assert.equal(git(s.app, 'rev-parse', 'HEAD'), s.previous);
    assert.equal((await fs.readFile(path.join(s.app, '.next', 'marker'), 'utf8')).trim(), 'previous');
    assert.match(await fs.readFile(s.ragEnv, 'utf8'), /M4_PILOT_CONFIG=.*previous\.json/);
    // The plan was checked on the new code after the catalogue migration, before the main schema: the main
    // migration and any activation never ran; the dependencies were reinstalled for the previous code.
    assert(index(s.calls, /^plan prepare @next$/) > index(s.calls, /^npx prisma migrate deploy --config prisma\/rag-v2/));
    assert.equal(index(s.calls, /^npx prisma migrate deploy$/), -1);
    assert.equal(index(s.calls, /^plan activate/), -1);
    assert(index(s.calls, /^npm ci .*@previous$/) > index(s.calls, /^plan prepare/));
    assert(index(s.calls, /^systemctl start sotsiaalai-frontend\.service$/) > index(s.calls, /^npm ci .*@previous$/));
  } finally { await s.cleanup(); }
});

test('a release with a renewed plan activates it after the main migration and checks it after the restart', { skip }, async () => {
  const s = await sandbox('renew');
  try {
    assert.equal(s.run.status, 0, s.run.stderr);
    assert.equal(git(s.app, 'rev-parse', 'HEAD'), s.next);
    assert.equal((await fs.readFile(path.join(s.app, '.next', 'marker'), 'utf8')).trim(), 'next');
    assert.match(await fs.readFile(s.ragEnv, 'utf8'), /M4_PILOT_CONFIG=.*renewed\.json/);
    const order = [/^npx prisma migrate deploy --config prisma\/rag-v2/, /^plan prepare @next$/, /^npx prisma migrate deploy$/,
      /^plan activate @next$/, /^systemctl restart sotsiaalai-frontend\.service$/, /^plan ready @next$/].map(pattern => index(s.calls, pattern));
    assert(order.every(position => position >= 0), JSON.stringify(order));
    assert.deepEqual([...order].sort((x, y) => x - y), order);
    assert.match(s.run.stdout, /chat plan renewed for this release/); assert.match(s.run.stdout, /ready on this release/);
  } finally { await s.cleanup(); }
});

test('a plan that could not run before the release is reported and does not stop it', { skip }, async () => {
  const s = await sandbox('unready');
  try {
    assert.equal(s.run.status, 0, s.run.stderr);
    assert.equal(git(s.app, 'rev-parse', 'HEAD'), s.next);
    assert.match(s.run.stdout, /::warning title=RAG v2 chat plan unready::unready active_index_mismatch/);
    assert.match(await fs.readFile(s.ragEnv, 'utf8'), /M4_PILOT_CONFIG=.*previous\.json/);
    assert.equal(index(s.calls, /^plan (activate|ready)/), -1);
  } finally { await s.cleanup(); }
});

test('a renewed plan that is not ready after the restart turns the deploy red', { skip }, async () => {
  const s = await sandbox('renew-not-ready');
  try {
    assert.equal(s.run.status, 9, s.run.stderr);
    assert.match(s.run.stdout, /::error title=RAG v2 chat plan not ready::/);
    // The schema moved on, so the release is kept; the chat plan renewed for it stays active.
    assert.equal(git(s.app, 'rev-parse', 'HEAD'), s.next);
    assert.match(await fs.readFile(s.ragEnv, 'utf8'), /M4_PILOT_CONFIG=.*renewed\.json/);
  } finally { await s.cleanup(); }
});
