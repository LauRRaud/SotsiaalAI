import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Codex R1 (30.09.2026): scripts/rag-v2-corpus-run.sh ended with 0 when making the chat plan failed, because the plan's
// output went through `| tail`. The plan step runs here against a temporary tree, with `sudo` and `systemctl` replaced.
const shell = spawnSync('sh', ['-c', 'exit 0']).status === 0;
let dir;
before(async () => { dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-corpus-run-')); });
after(async () => {
  const target = path.resolve(dir);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-corpus-run-'));
  await fs.rm(target, { recursive: true, force: true });
});

const SUDO = `#!/bin/sh
[ "$1" = "-n" ] && shift
case "$*" in
  *rag-v2-chat-plan.mjs*)
    [ -n "$FAIL_PLAN" ] && { echo "plan refused" >&2; exit 3; }
    out=""; previous=""; for arg in "$@"; do [ "$previous" = "--out" ] && out="$arg"; previous="$arg"; done
    echo '{"id":"plan-new","generationId":"search_generation_next","documents":{"d1":"v2"}}' > "$out"; echo '{"out":"ok"}'; exit 0 ;;
  chown*) [ -n "$FAIL_CHOWN" ] && exit 1; exit 0 ;;
  systemctl*) exit 0 ;;
esac
exec "$@"
`;
const SYSTEMCTL = `#!/bin/sh
case "$*" in *is-active*) [ -n "$FAIL_ACTIVE" ] && exit 3; exit 0 ;; esac
exit 0
`;

async function tree(name) {
  const root = path.join(dir, name), work = path.join(root, 'work'), etc = path.join(root, 'etc'), bin = path.join(root, 'bin');
  for (const folder of [path.join(root, 'app'), path.join(root, 'eval'), path.join(work, 'tmp/rag-v2-corpus-index-v45'), etc, bin]) await fs.mkdir(folder, { recursive: true });
  await fs.writeFile(path.join(work, 'index-run-v45.json'), '{\n  "state": "ready"\n}\n');
  await fs.writeFile(path.join(work, 'tmp/rag-v2-corpus-index-v45/index-plan.json'), JSON.stringify({ generation_id: 'search_generation_next' }));
  await fs.writeFile(path.join(work, 'ship-v45.tgz'), 'package');
  await fs.writeFile(path.join(etc, 'current.json'), JSON.stringify({ id: 'plan-old', generationId: 'search_generation_prior', documents: { d1: 'v1' } }));
  await fs.writeFile(path.join(etc, 'rag.env'), `M4_PILOT_CONFIG=${path.join(etc, 'current.json').replace(/\\/gu, '/')}\n`);
  await fs.writeFile(path.join(bin, 'sudo'), SUDO, { mode: 0o755 });
  await fs.writeFile(path.join(bin, 'systemctl'), SYSTEMCTL, { mode: 0o755 });
  return { root, work, etc, bin };
}

function run({ root, work, etc, bin }, env = {}) {
  const posix = file => file.replace(/\\/gu, '/');
  return spawnSync('sh', ['scripts/rag-v2-corpus-run.sh', '45', '44', posix(path.join(etc, 'new.json')), '0.05', 'alus', 'basis'], {
    encoding: 'utf8',
    env: { ...process.env, RESUME: 'plan', RAG_V2_APP: posix(path.join(root, 'app')), RAG_V2_WORK: posix(work), RAG_V2_EVAL: posix(path.join(root, 'eval')),
      RAG_V2_ETC: posix(etc), PATH: `${posix(bin)}${path.delimiter}${process.env.PATH}`, ...env },
  });
}

test('a failed chat plan, owner change or restart ends the run with an error and keeps the package', { skip: !shell && 'no sh' }, async () => {
  for (const [name, env, message] of [['plan', { FAIL_PLAN: '1' }, /FAILED: chat plan \(exit 3/u], ['chown', { FAIL_CHOWN: '1' }, /FAILED: chown/u],
    ['active', { FAIL_ACTIVE: '1' }, /FAILED: sotsiaalai-frontend is not active/u]]) {
    const paths = await tree(name), result = run(paths, env);
    assert.notEqual(result.status, 0, `${name}: ${result.stdout}`);
    assert.match(result.stdout, message, name);
    assert.doesNotMatch(result.stdout, /== done/u, name);
    await fs.access(path.join(paths.work, 'ship-v45.tgz'));
  }
  // The failed plan's message says how to go on.
  assert.match(run(await tree('plan-message'), { FAIL_PLAN: '1' }).stdout, /RESUME=plan and a new plan file name/u);
});

test('a chat plan made for the active index ends the run with 0, the plan difference and the package removed', { skip: !shell && 'no sh' }, async () => {
  const paths = await tree('success'), result = run(paths);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /^active$/mu);
  assert.match(result.stdout, /diff generationId "search_generation_prior" -> "search_generation_next"/u);
  assert.doesNotMatch(result.stdout, /diff documents/u);
  assert.match(result.stdout, /== done/u);
  await assert.rejects(fs.access(path.join(paths.work, 'ship-v45.tgz')));
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
});
