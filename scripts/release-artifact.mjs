import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const isRevision = value => /^[a-f0-9]{40}$/.test(value || '');

// Keep all application sources: RAG provenance, workers and maintenance commands
// read them at runtime. Archives, developer evidence and local secrets are not a release.
export function runtimeFile(file) {
  if (file.split('/').some(part => part.startsWith('.env'))) return false;
  if (/^(Arhiiv|Andmebaasi|Kovisioon|tests|eval|reports|output|tmp|logs|\.git|\.github|\.agents|\.claude|codex-skills)(\/|$)/.test(file)) return false;
  if (file.startsWith('docs/') && !file.startsWith('docs/legal/')) return false;
  return true;
}

async function treeHash(root, relative) {
  const entries = [];
  async function walk(name) {
    const absolute = path.join(root, name);
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      for (const child of (await fs.readdir(absolute)).sort()) await walk(`${name}/${child}`);
    } else entries.push([name, sha256(await fs.readFile(absolute))]);
  }
  await walk(relative);
  return sha256(JSON.stringify(entries));
}

export async function migrationHashes(root) {
  return {
    main: { schema: await treeHash(root, 'prisma/schema.prisma'), migrations: await treeHash(root, 'prisma/migrations') },
    rag: { schema: await treeHash(root, 'prisma/rag-v2/schema.prisma'), migrations: await treeHash(root, 'prisma/rag-v2/migrations') },
  };
}

export function migrationChanges(previous, next) {
  return ['main', 'rag'].filter(name => {
    if (previous[name].schema !== next[name].schema && previous[name].migrations === next[name].migrations) {
      throw new Error(`${name}: schema changed without a migration; review before publishing`);
    }
    return previous[name].migrations !== next[name].migrations;
  });
}

export async function packageRelease(revision, output) {
  if (process.platform !== 'linux' || !isRevision(revision)) throw new Error('A Linux build and full commit SHA are required');
  const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  if (git('rev-parse', 'HEAD') !== revision || git('status', '--porcelain', '--untracked-files=no')) throw new Error('Release must match the clean checked-out commit');
  const files = git('ls-files', '-z').split('\0').filter(Boolean).filter(runtimeFile);
  const buildId = (await fs.readFile('.next/BUILD_ID', 'utf8')).trim();
  const publicEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => key.startsWith('NEXT_PUBLIC_')));
  const metadata = { version: 1, revision, buildId, nodeMajor: 24, publicEnv, migrations: await migrationHashes(process.cwd()) };
  await fs.mkdir(output, { recursive: true });
  await fs.writeFile('.release-metadata.json', JSON.stringify(metadata));
  const fileList = path.join(output, 'files.txt');
  await fs.writeFile(fileList, [...files, '.release-metadata.json', '.next', 'node_modules', 'generated'].join('\n') + '\n');
  const archive = path.join(output, 'release.tar.gz');
  execFileSync('tar', ['--exclude=.next/cache', '--exclude=.next/dev', '--exclude=node_modules/.cache', '-czf', archive, '-T', fileList], { stdio: 'inherit' });
  await fs.writeFile(path.join(output, 'release.sha256'), `${sha256(await fs.readFile(archive))}  release.tar.gz\n`);
  await fs.rm(fileList);
  await fs.rm('.release-metadata.json');
  console.log(`[release] Packaged ${revision}, build ${buildId}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await packageRelease(process.argv[2], path.resolve(process.argv[3] || '.release'));
}
