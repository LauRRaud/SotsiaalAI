#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { isRevision, sha256 } from './release-artifact.mjs';

const { values } = parseArgs({ options: { artifact: { type: 'string' }, revision: { type: 'string' } } });
const run = (bin, args) => execFileSync(bin, args, { stdio: 'inherit', windowsHide: true });
if (!values.artifact) {
  // Manual publication uses the very same build-once workflow. No second build
  // or maintenance mode exists on the server anymore.
  run('gh', ['workflow', 'run', 'quality-gate.yml', '--ref', 'main']);
  console.log('[deploy] GitHub release build requested; its successful artifact is deployed automatically.');
} else {
  if (!isRevision(values.revision)) throw new Error('--revision must be the full validated commit SHA');
  const artifact = path.resolve(values.artifact);
  const archive = path.join(artifact, 'release.tar.gz');
  const expected = (await fs.readFile(path.join(artifact, 'release.sha256'), 'utf8')).trim();
  if (!/^[a-f0-9]{64}  release\.tar\.gz$/.test(expected) || !expected.startsWith(sha256(await fs.readFile(archive)))) throw new Error('Artifact checksum mismatch');
  const remote = process.env.DEPLOY_SSH_HOST || 'sotsiaalai';
  if (!/^[a-zA-Z0-9_.@-]+$/.test(remote) || remote.startsWith('-')) throw new Error('Invalid SSH host');
  const root = '/home/ubuntu/apps/sotsiaalai-releases';
  const incoming = `${root}/incoming-${values.revision}-${randomUUID()}`;
  run('ssh', [remote, `mkdir -p ${incoming}`]);
  try {
    run('scp', [archive, path.join(artifact, 'release.sha256'), 'scripts/deploy-release-host.mjs', 'scripts/release-artifact.mjs', 'scripts/release-switch.mjs', `${remote}:${incoming}/`]);
    run('ssh', [remote, `cd ${incoming} && sha256sum -c release.sha256 && flock -w 900 ${root}/deploy.lock node deploy-release-host.mjs ${values.revision} ${incoming}/release.tar.gz`]);
  } finally {
    // Fixed filenames only; no recursive removal or path supplied by the artifact.
    run('ssh', [remote, `rm -f ${incoming}/release.tar.gz ${incoming}/release.sha256 ${incoming}/deploy-release-host.mjs ${incoming}/release-artifact.mjs ${incoming}/release-switch.mjs && rmdir ${incoming}`]);
  }
}
