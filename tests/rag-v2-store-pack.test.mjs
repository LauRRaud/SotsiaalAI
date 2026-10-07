import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// ADR-101 (07.10.2026): scripts/rag-v2-store-pack.sh keeps the server's indexed version folders as a compressed
// archive and removes the loose files. What must hold: a version of the head that is not indexed yet stays loose (the
// next increment reads it); what is packed comes back byte for byte, one version alone too, though it shared a file
// with another by a hard link; a folder packed before and unpacked again is not
// packed twice; a loose file that differs from its archive is never removed.
// The script needs GNU tar, zstd and pgrep: where one is missing (a Windows checkout) the tests are skipped; the same
// file was run on the server before the store was packed.
const has = name => spawnSync('sh', ['-c', `command -v ${name}`]).status === 0;
const tools = ['tar', 'zstd', 'pgrep', 'sha256sum', 'node'].every(has);
const id = letter => `version_${letter.repeat(64)}`;
const SEALED = id('a'), UNSEALED = id('b'), OLD = id('c');
let dir, tenant, script, plan;
const run = (...args) => spawnSync('sh', [script, ...args], { encoding: 'utf8' });
const read = async version => Object.fromEntries(await Promise.all((await fs.readdir(path.join(tenant, 'versions', version))).sort().map(async name => [name, (await fs.readFile(path.join(tenant, 'versions', version, name))).toString('base64')])));

before(async () => {
  if (!tools) return;
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'rag-v2-store-pack-'));
  tenant = path.join(dir, 'tenant'); script = path.join(dir, 'rag-v2-store-pack.sh'); plan = path.join(dir, 'index-plan.json');
  await fs.writeFile(script, (await fs.readFile('scripts/rag-v2-store-pack.sh', 'utf8')).replace(/\r\n/gu, '\n'));
  for (const version of [SEALED, UNSEALED, OLD]) {
    await fs.mkdir(path.join(tenant, 'versions', version), { recursive: true });
    await fs.writeFile(path.join(tenant, 'versions', version, 'bundle.json'), JSON.stringify({ version, text: 'lõik '.repeat(400) }, null, 2));
    await fs.writeFile(path.join(tenant, 'versions', version, 'original.pdf'), Buffer.from([0, 1, 2, 3, 255, 254, 253]));
  }
  // Versions of one source share its original by a hard link, as the store does: the old version's file is the indexed one's.
  await fs.writeFile(path.join(tenant, 'versions', SEALED, 'original.json'), JSON.stringify({ shared: 'allikas '.repeat(50) }));
  await fs.link(path.join(tenant, 'versions', SEALED, 'original.json'), path.join(tenant, 'versions', OLD, 'original.json'));
  // The head names the indexed version and one that is not indexed yet; the third is an old version nobody names.
  await fs.writeFile(path.join(tenant, 'active.json'), JSON.stringify({ documents: { document_1: { version_id: SEALED }, document_2: { version_id: UNSEALED } } }));
  await fs.writeFile(plan, JSON.stringify({ items: [{ version_id: SEALED }] }));
});
after(async () => {
  if (!dir) return;
  const target = path.resolve(dir);
  assert(target.startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(target).startsWith('rag-v2-store-pack-'));
  await fs.rm(target, { recursive: true, force: true });
});

test('pack takes the indexed and the unnamed versions, leaves the unindexed head version loose, and unpack gives the same bytes back', { skip: !tools }, async () => {
  const original = { [SEALED]: await read(SEALED), [OLD]: await read(OLD) };
  const packed = run('pack', tenant, plan);
  assert.equal(packed.status, 0, packed.stdout + packed.stderr);
  assert.match(packed.stdout, /packing 2 version folders/u);
  assert.deepEqual((await fs.readdir(path.join(tenant, 'versions'))).sort(), [UNSEALED]);
  const archives = (await fs.readdir(path.join(tenant, 'versions-packed'))).filter(name => name.endsWith('.tar.zst'));
  assert.equal(archives.length, 1);
  assert.deepEqual((await fs.readFile(path.join(tenant, 'versions-packed', archives[0].replace('.tar.zst', '.list')), 'utf8')).trim().split('\n'), [SEALED, OLD]);

  const one = run('unpack', tenant, OLD);
  assert.equal(one.status, 0, one.stdout + one.stderr);
  assert.deepEqual(await read(OLD), original[OLD]);
  const all = run('unpack', tenant);
  assert.equal(all.status, 0, all.stdout + all.stderr);
  assert.deepEqual(await read(SEALED), original[SEALED]);
});

test('a folder an archive already holds is compared and removed, not packed again; one that differs is left where it is', { skip: !tools }, async () => {
  // After the first test both packed versions are loose again.
  const again = run('pack', tenant, plan);
  assert.equal(again.status, 0, again.stdout + again.stderr);
  assert.match(again.stdout, /and equal: 2 loose folders removed/u);
  assert.match(again.stdout, /nothing new to pack/u);
  assert.equal((await fs.readdir(path.join(tenant, 'versions-packed'))).filter(name => name.endsWith('.tar.zst')).length, 1);

  assert.equal(run('unpack', tenant, SEALED).status, 0);
  await fs.appendFile(path.join(tenant, 'versions', SEALED, 'bundle.json'), 'x');
  const changed = run('pack', tenant, plan);
  assert.match(changed.stdout, /NOT equal: 1 folders left loose/u);
  assert.deepEqual((await fs.readdir(path.join(tenant, 'versions'))).sort(), [SEALED, UNSEALED]);
});

test('pack refuses without the running corpus\'s index plan', { skip: !tools }, () => {
  const refused = run('pack', tenant);
  assert.equal(refused.status, 2);
  assert.match(refused.stdout, /index-plan\.json is needed/u);
});
