import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Codex R1 (30.09.2026): scripts/rag-v2-corpus-run.sh ended with 0 when making the chat plan failed, because the plan's
// output went through `| tail`. The plan step runs here against a temporary tree, with `sudo`, `systemctl`, `flock` and
// `sleep` replaced.
// Since 04.10.2026 the service runs a release directory with its own env file (scripts/deploy-release-host.mjs). The
// stand-ins keep what a deploy leaves and what a restart does: the unit names the release and its env file, and the
// process holds the plan that file named when it started.
// The server's sh is dash, so dash runs the script where it exists, from a copy without a checkout's carriage returns.
const shell = ['dash', 'sh'].find(name => spawnSync(name, ['-c', 'exit 0']).status === 0);
const SHA = 'c0ffee'.padEnd(40, '0');
const posix = file => file.replace(/\\/gu, '/');
let dir, script;
before(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-corpus-run-'));
  script = path.join(dir, 'rag-v2-corpus-run.sh');
  await fs.writeFile(script, (await fs.readFile('scripts/rag-v2-corpus-run.sh', 'utf8')).replace(/\r\n/gu, '\n'));
});
after(async () => {
  const target = path.resolve(dir);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-corpus-run-'));
  await fs.rm(target, { recursive: true, force: true });
});

// `point` is what activateChatPlan does to an env file: the plan's line is replaced by one at the end.
const SUDO = `#!/bin/sh
[ "$1" = "-n" ] && shift
value() { wanted=$1; shift; previous=""; for arg in "$@"; do [ "$previous" = "$wanted" ] && echo "$arg"; previous="$arg"; done; }
point() { grep -v "^M4_PILOT_CONFIG=" "$1" > "$1.next"; echo "M4_PILOT_CONFIG=$2" >> "$1.next"; mv "$1.next" "$1"; }
called() { echo "$1 in $(cat .release-metadata.json 2>/dev/null) $2" >> "$TREE/calls"; }
case "$*" in
  *rag-v2-chat-plan.mjs*)
    called plan "$*"
    [ -n "$FAIL_PLAN" ] && { echo "plan refused" >&2; exit 3; }
    out=$(value --out "$@")
    echo '{"id":"plan-new","generationId":"search_generation_next","documents":{"d1":"v2"}}' > "$out"
    point "$(value --rag-env "$@")" "$out"; echo '{"out":"ok"}'; exit 0 ;;
  *"rag-v2-plan-release.mjs activate"*)
    called activate "$*"
    [ -n "$FAIL_RELEASE_ENV" ] && exit 1
    point "$(value --rag-env "$@")" "$(value --plan "$@")"; exit 0 ;;
  *"rag-v2-plan-release.mjs ready"*) called ready "$*"; [ -n "$FAIL_READY" ] && exit 1; echo ready; exit 0 ;;
  chown*) [ -n "$FAIL_CHOWN" ] && exit 1; exit 0 ;;
  "cat /proc/4242/environ") tr '\\n' '\\0' < "$TREE/process.env"; exit 0 ;;
esac
"$@"
`;
const SYSTEMCTL = `#!/bin/sh
case "$*" in
  *is-active*) [ -n "$FAIL_ACTIVE" ] && exit 3; exit 0 ;;
  "show -p WorkingDirectory --value sotsiaalai-frontend") echo "$UNIT_DIRECTORY" ;;
  "show -p EnvironmentFiles --value sotsiaalai-frontend") for file in $UNIT_ENV; do echo "$file (ignore_errors=no)"; done ;;
  "show -p MainPID --value sotsiaalai-frontend") echo 4242 ;;
  "restart sotsiaalai-frontend")
    echo restart >> "$TREE/calls"
    [ -n "$STALE_START" ] || grep "^M4_PILOT_CONFIG=" $UNIT_ENV | tail -1 > "$TREE/process.env" ;;
esac
exit 0
`;
const FLOCK = `#!/bin/sh
[ -n "$FAIL_LOCK" ] && exit 1
exit 0
`;

async function tree(name) {
  const root = path.join(dir, name), work = path.join(root, 'work'), etc = path.join(root, 'etc'), bin = path.join(root, 'bin');
  const release = path.join(root, 'releases', SHA), env = path.join(etc, 'releases', `${SHA}.env`), current = posix(path.join(etc, 'current.json'));
  for (const folder of [path.join(release, 'scripts'), path.join(release, 'lib'), path.join(release, 'node_modules'), path.join(root, 'shared'),
    path.join(root, 'eval'), path.join(work, 'tmp/rag-v2-corpus-index-v45'), path.join(etc, 'releases'), bin]) await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(release, '.release-metadata.json'), JSON.stringify({ revision: SHA }));
  for (const file of ['scripts/rag-v2-chat-plan.mjs', 'lib/code.js', 'node_modules/package.js']) await fs.writeFile(path.join(release, file), `// ${SHA}\n`);
  await fs.writeFile(path.join(release, 'package.json'), '{}');
  await fs.writeFile(path.join(work, 'index-run-v45.json'), '{\n  "state": "ready"\n}\n');
  await fs.writeFile(path.join(work, 'tmp/rag-v2-corpus-index-v45/index-plan.json'), JSON.stringify({ generation_id: 'search_generation_next' }));
  await fs.writeFile(path.join(work, 'ship-v45.tgz'), 'package');
  await fs.writeFile(path.join(etc, 'current.json'), JSON.stringify({ id: 'plan-old', generationId: 'search_generation_prior', documents: { d1: 'v1' } }));
  await fs.writeFile(path.join(etc, 'rag.env'), `RAG_V2_POSTGRES_URL=postgres://x\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=${current}\n`);
  // The release's env file: frontend.env, rag.env as it was at the deploy, and the plan that release renewed, appended.
  await fs.writeFile(env, `NODE_ENV=production\n\nRAG_V2_POSTGRES_URL=postgres://x\nM4_PILOT_ENABLED=1\nM4_PILOT_CONFIG=${posix(path.join(etc, 'before-renewal.json'))}\n`
    + `\nNODE_ENV=production\nM4_PILOT_CONFIG=${current}\nM4_PILOT_ENABLED=1\n`);
  await fs.writeFile(path.join(root, 'process.env'), `M4_PILOT_CONFIG=${current}\n`);
  for (const [file, text] of Object.entries({ sudo: SUDO, systemctl: SYSTEMCTL, flock: FLOCK, sleep: '#!/bin/sh\nexit 0\n' })) await fs.writeFile(path.join(bin, file), text, { mode: 0o755 });
  return { root, work, etc, bin, release, env };
}

function run({ root, work, etc, bin, release, env: releaseEnv }, env = {}) {
  return spawnSync(shell, [posix(script), '45', '44', posix(path.join(etc, 'new.json')), '0.05', 'alus', 'basis'], {
    encoding: 'utf8',
    env: { ...process.env, RESUME: 'plan', RAG_V2_WORK: posix(work), RAG_V2_EVAL: posix(path.join(root, 'eval')), RAG_V2_ETC: posix(etc),
      RAG_V2_RELEASES: posix(path.join(root, 'releases')), RAG_V2_SHARED: posix(path.join(root, 'shared')),
      TREE: posix(root), UNIT_DIRECTORY: posix(release), UNIT_ENV: posix(releaseEnv), PATH: `${posix(bin)}${path.delimiter}${process.env.PATH}`, ...env },
  });
}
// What the stand-ins were asked to do, in order: `plan`, `activate` and `ready` with the directory they ran in, `restart`.
const calls = async ({ root }) => (await fs.readFile(path.join(root, 'calls'), 'utf8').catch(() => '')).split('\n').filter(Boolean);
const missing = file => assert.rejects(fs.access(file));

test('a failed lock, chat plan, owner change, release env, readiness check or restart ends the run with an error and keeps the package', { skip: !shell && 'no sh' }, async () => {
  // `again`: the failures that leave the chat without a plan for the active index say how to go on.
  for (const [name, env, message, restarted, again] of [
    ['lock', { FAIL_LOCK: '1' }, /FAILED: a deploy held \S+\/releases\/deploy\.lock/u, false, true],
    ['plan', { FAIL_PLAN: '1' }, /FAILED: chat plan \(exit 3/u, false, true],
    ['chown', { FAIL_CHOWN: '1' }, /FAILED: chown/u, false, false],
    ['release-env', { FAIL_RELEASE_ENV: '1' }, /FAILED: the plan \S+new\.json is in rag\.env but not in the running release's env file/u, false, true],
    ['ready', { FAIL_READY: '1' }, /FAILED: the plan \S+\.env names cannot run a turn on the release \S+ \(\S+\), so the service was not restarted/u, false, true],
    ['active', { FAIL_ACTIVE: '1' }, /FAILED: sotsiaalai-frontend is not active/u, true, false],
    // The restart did not bring the plan to the process: another setting of the unit decides it, a new plan would not help.
    ['stale', { STALE_START: '1' }, /FAILED: sotsiaalai-frontend runs with the plan '\S+current\.json', not \S+new\.json, though its env file \S+\.env names/u, true, false]]) {
    const paths = await tree(name), result = run(paths, env);
    assert.notEqual(result.status, 0, `${name}: ${result.stdout}`);
    assert.match(result.stdout, message, name);
    assert.doesNotMatch(result.stdout, /== done/u, name);
    await fs.access(path.join(paths.work, 'ship-v45.tgz'));
    assert.equal((await calls(paths)).includes('restart'), restarted, name);
    if (again) assert.match(result.stdout, /RESUME=plan and a new plan file name/u, name);
    // A deploy in progress: nothing is made while it holds the lock.
    if (name === 'lock') { assert.deepEqual(await calls(paths), []); await missing(path.join(paths.etc, 'new.json')); }
  }
});

test('a chat plan for the active index reaches the running release: made in it, named by rag.env and the release env, held by the restarted service', { skip: !shell && 'no sh' }, async () => {
  const paths = await tree('success'), result = run(paths), plan = posix(path.join(paths.etc, 'new.json'));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^active$/mu);
  assert(result.stdout.includes(`running plan: ${plan}\n`), result.stdout);
  // The plan it replaces is the last one the release env names, not the one the deploy copied from rag.env before it.
  assert.match(result.stdout, /diff generationId "search_generation_prior" -> "search_generation_next"/u);
  assert.doesNotMatch(result.stdout, /diff documents/u);
  assert.match(result.stdout, /== done/u);
  await missing(path.join(paths.work, 'ship-v45.tgz'));
  // Made, activated and checked in the running release's directory with its env file; the restart comes last.
  const made = await calls(paths);
  assert.deepEqual(made.map(line => line.split(' ')[0]), ['plan', 'activate', 'ready', 'restart']);
  for (const line of made.slice(0, 3)) assert(line.includes(` in {"revision":"${SHA}"} `) && line.includes(` --env-file=${posix(paths.env)} `), line);
  assert(made[0].includes(` --rag-env ${posix(path.join(paths.etc, 'rag.env'))} --activate`), made[0]);
  assert(made[1].endsWith(` activate --plan ${plan} --rag-env ${posix(paths.env)}`), made[1]);
  // rag.env names the plan for the next release, the release env for this one, and the process started from it.
  for (const file of [path.join(paths.etc, 'rag.env'), paths.env, path.join(paths.root, 'process.env')]) {
    assert.deepEqual((await fs.readFile(file, 'utf8')).match(/^M4_PILOT_CONFIG=.*$/gmu), [`M4_PILOT_CONFIG=${plan}`], file);
  }
  // A plan file that exists is never overwritten.
  const again = run(paths);
  assert.notEqual(again.status, 0);
  assert.match(again.stdout, /FAILED: the plan file .* exists/u);
});

test('RESUME=plan refuses an index that is not ready', { skip: !shell && 'no sh' }, async () => {
  const paths = await tree('not-ready');
  await fs.writeFile(path.join(paths.work, 'index-run-v45.json'), '{\n  "state": "running"\n}\n');
  const result = run(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAILED: index v45 is not ready/u);
  assert.deepEqual(await calls(paths), []);
});

test('a service that does not run a release with its one env file is refused before anything is copied or made', { skip: !shell && 'no sh' }, async () => {
  for (const [name, unit, message] of [
    // The layout before 04.10.2026: the first checkout with frontend.env and rag.env.
    ['first-checkout', paths => ({ UNIT_DIRECTORY: posix(path.join(paths.root, 'shared')), UNIT_ENV: `${posix(paths.etc)}/frontend.env ${posix(paths.etc)}/rag.env` }), /FAILED: sotsiaalai-frontend runs from/u],
    ['two-env-files', paths => ({ UNIT_ENV: `${posix(paths.env)} ${posix(paths.etc)}/rag.env` }), /FAILED: sotsiaalai-frontend runs from/u],
    ['no-env-file', () => ({ UNIT_ENV: '' }), /FAILED: sotsiaalai-frontend runs from/u],
    ['removed-release', paths => ({ UNIT_DIRECTORY: posix(path.join(paths.root, 'releases', 'f'.repeat(40))) }), /FAILED: the release \S+ or its env file \S+ cannot be read/u]]) {
    for (const resume of ['', 'plan']) {
      const paths = await tree(`${name}-${resume}`), result = run(paths, { RESUME: resume, ...unit(paths) });
      assert.notEqual(result.status, 0, `${name}: ${result.stdout}`);
      assert.match(result.stdout, message, name);
      assert.deepEqual(await calls(paths), [], name);
      for (const file of [path.join(paths.work, 'lib'), path.join(paths.work, 'node_modules'), path.join(paths.etc, 'new.json')]) await missing(file);
    }
  }
});

test('a full run takes the code and the packages from the running release', { skip: !shell && 'no sh' }, async () => {
  // It stops at the first thing this tree lacks, the increment's package, after the code is in the work dir.
  const paths = await tree('full'), result = run(paths, { RESUME: '' });
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /FAILED: ship-v45\.tgz, ship-v45\.json and policy-v45\.json are needed/u);
  for (const file of ['lib/code.js', 'scripts/rag-v2-chat-plan.mjs', 'node_modules/package.js']) assert.equal(await fs.readFile(path.join(paths.work, file), 'utf8'), `// ${SHA}\n`, file);
  await fs.access(path.join(paths.work, 'package.json'));
  // Packages someone installed in the work dir are not replaced by a link.
  const own = await tree('own-packages');
  await fs.mkdir(path.join(own.work, 'node_modules'));
  assert.match(run(own, { RESUME: '' }).stdout, /FAILED: \S+\/node_modules is not a link/u);
});

test('ADR-092: the new plan is asked for the effort and the choices of the plan it replaces; a plan without a choice gets none', { skip: !shell && 'no sh' }, async () => {
  const plain = await tree('choice-none');
  assert.equal(run(plain).status, 0);
  const made = (await calls(plain)).find(line => line.startsWith('plan '));
  assert.match(made, /--reasoning medium /u);
  assert.doesNotMatch(made, /--reasoning-choices/u);
  const offering = await tree('choice-kept');
  await fs.writeFile(path.join(offering.etc, 'current.json'), JSON.stringify({ id: 'plan-old', generationId: 'search_generation_prior', documents: { d1: 'v1' },
    reasoning: 'medium', reasoningChoices: ['low', 'medium'] }));
  const result = run(offering);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const kept = (await calls(offering)).find(line => line.startsWith('plan '));
  assert.match(kept, /--budget-usd 4 --reasoning-choices low,medium --basis /u);
  assert.match(kept, /--reasoning medium /u);
  // The owner's default (low since 06.10.2026) is the running plan's own effort: an increment does not put medium back.
  const quick = await tree('choice-default-low');
  await fs.writeFile(path.join(quick.etc, 'current.json'), JSON.stringify({ id: 'plan-old', generationId: 'search_generation_prior', documents: { d1: 'v1' },
    reasoning: 'low', reasoningChoices: ['low', 'medium'] }));
  assert.equal(run(quick).status, 0);
  const lowered = (await calls(quick)).find(line => line.startsWith('plan '));
  assert.match(lowered, /--reasoning low /u);
  assert.match(lowered, /--reasoning-choices low,medium /u);
  // A running plan that cannot be read stops the run before a plan is made.
  const broken = await tree('choice-unreadable');
  await fs.writeFile(path.join(broken.etc, 'current.json'), 'not json');
  const failed = run(broken);
  assert.notEqual(failed.status, 0);
  assert.match(failed.stdout, /FAILED: the running plan \S+current\.json cannot be read/u);
  assert.deepEqual((await calls(broken)).filter(line => line.startsWith('plan ')), []);
});
