// Packs or unpacks the local evaluation data behind scripts/rag-v2-query-variants.mjs, so another
// checkout (e.g. a cloud session) can reproduce the 05.09 and holdout-2 tables without paid calls.
//
//   node scripts/rag-v2-eval-data.mjs unpack   # archive -> tmp/, every file hash-checked
//   node scripts/rag-v2-eval-data.mjs pack     # tmp/ -> archive + manifest (after new paid vectors)
//
// Contents: the 05.09 ingested corpus versions (bundles + source PDFs, exactly as the stored vectors
// were computed from), the stored real corpus vectors and the holdout-2 query vectors. The source
// PDFs are also in docs/; current code would chunk them differently, so the old versions are needed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ARCHIVE = 'tests/evaluation/multi-source/data/eval-data-2026-09-24.tar.gz';
const MANIFEST = 'tests/evaluation/multi-source/data/eval-data-2026-09-24.manifest.json';
const TENANT_DIR = 'tmp/rag-v2-multi-source/store/tenant_14adb6ca14328043b58abdabee85d62863056209a69bf8f9b1667dc2e7b45a98';
const VECTORS = ['tmp/rag-v2-m2-2/usage/pilot_e14470663fbf87b5ad1b1313e2f9945bf7e9afd96ec43a15c0dce380b95e2508',
  'tmp/rag-v2-multi-source/usage/pilot_2be546a0b998b304f89bb42d0a46d41efaf8bca48cafeba7e4a22c0a48687d40',
  'tmp/rag-v2-multi-source/holdout-2-query-vectors.json'];
const sha256 = async file => createHash('sha256').update(await fs.readFile(file)).digest('hex');
const tar = args => execFileSync('tar', [...(process.platform === 'win32' ? ['--force-local'] : []), ...args], { stdio: 'inherit' });
async function files(entry) {
  const stat = await fs.stat(entry);
  if (!stat.isDirectory()) return [entry];
  const nested = await Promise.all((await fs.readdir(entry)).sort().map(name => files(path.posix.join(entry, name))));
  return nested.flat();
}

const command = process.argv[2];
if (command === 'pack') {
  const active = JSON.parse(await fs.readFile(`${TENANT_DIR}/active.json`, 'utf8'));
  const entries = [`${TENANT_DIR}/active.json`, ...Object.values(active.documents).map(d => `${TENANT_DIR}/versions/${d.version_id}`), ...VECTORS];
  const list = (await Promise.all(entries.map(files))).flat();
  await fs.mkdir(path.dirname(ARCHIVE), { recursive: true });
  const listFile = path.join(path.dirname(ARCHIVE), '.pack-list');
  await fs.writeFile(listFile, list.join('\n') + '\n');
  try { tar(['-czf', ARCHIVE, '-T', listFile]); } finally { await fs.rm(listFile, { force: true }); }
  const manifest = { schema: 'rag-v2/eval-data-1', archive_sha256: await sha256(ARCHIVE),
    files: Object.fromEntries(await Promise.all(list.map(async file => [file, await sha256(file)]))) };
  await fs.writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`packed ${list.length} files, ${(await fs.stat(ARCHIVE)).size} bytes`);
} else if (command === 'unpack') {
  const manifest = JSON.parse(await fs.readFile(MANIFEST, 'utf8'));
  if (await sha256(ARCHIVE) !== manifest.archive_sha256) throw Error('eval_data_archive_hash_mismatch');
  tar(['-xzf', ARCHIVE]);
  for (const [file, digest] of Object.entries(manifest.files)) if (await sha256(file) !== digest) throw Error(`eval_data_file_hash_mismatch: ${file}`);
  console.log(`unpacked and verified ${Object.keys(manifest.files).length} files under tmp/`);
} else {
  console.error('usage: node scripts/rag-v2-eval-data.mjs pack|unpack');
  process.exit(2);
}
