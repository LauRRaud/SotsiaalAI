import { fail, hash, id, stable } from '../contracts.js';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export async function gitProvenance(scopePaths = ['lib/rag-v2']) {
  if (!Array.isArray(scopePaths) || !scopePaths.length || scopePaths.some(value => typeof value !== 'string' || !value)) fail('invalid_git_scope');
  const run = args => execFileAsync('git', args, { encoding: 'utf8', windowsHide: true });
  const [head, status, scope] = await Promise.all([
    run(['rev-parse', 'HEAD']),
    run(['status', '--porcelain', '--untracked-files=no']),
    run(['status', '--porcelain', '--untracked-files=all', '--', ...scopePaths]),
  ]);
  return { head: head.stdout.trim(), tracked_dirty: Boolean(status.stdout.trim()), scoped_dirty: Boolean(scope.stdout.trim()),
    status_sha256: hash(status.stdout.trim()) };
}

export function artifactProvenance({ runKind, createdAt, git, snapshot, index, results, evaluationSets, vectorSources = [], apiAttemptsThisRun = 0 }) {
  if (typeof runKind !== 'string' || !runKind || !Number.isFinite(Date.parse(createdAt))
    || !/^[a-f0-9]{40}$/.test(git?.head ?? '') || typeof git.tracked_dirty !== 'boolean' || typeof git.scoped_dirty !== 'boolean'
    || !snapshot?.snapshot_hash || !index?.generation_id || !results?.schema_version || !Array.isArray(evaluationSets)
    || !Number.isSafeInteger(apiAttemptsThisRun) || apiAttemptsThisRun < 0) fail('invalid_artifact_provenance');
  const evaluation = evaluationSets.map(set => ({ name: set.name, questions_sha256: hash(stable(set.questions)),
    anchor_groups_sha256: hash(stable(set.groups)) }));
  const base = { schema_version: 'rag-v2/evaluation-artifact-provenance-1', run_kind: runKind, created_at: createdAt,
    code: { git_head_sha: git.head, tracked_worktree_dirty: git.tracked_dirty, rag_v2_scope_dirty: git.scoped_dirty,
      tracked_status_sha256: git.status_sha256 },
    corpus: { tenant: snapshot.tenant, source_generation_id: snapshot.source_generation,
      snapshot_sha256: snapshot.snapshot_hash, document_count: snapshot.bundles.length,
      search_generation_id: index.generation_id },
    configuration_sha256: hash(stable(results.config)), evaluation, output_schema_version: results.schema_version,
    result_payload_sha256: hash(stable(results)), vector_sources: vectorSources,
    external_api_attempts_this_run: apiAttemptsThisRun, generation_calls: 0 };
  return { ...base, run_id: id('evaluation_run', base) };
}
