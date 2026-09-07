import fs from 'node:fs/promises';
import path from 'node:path';
import { configuration, fail, hash, nonempty, stable } from '../contracts.js';
import { nanoUsd } from '../search/pilot-manifest.js';

const FIELDS = ['enabled', 'id', 'tenant', 'subject', 'users', 'documentIds', 'storeRoot', 'workRoot', 'policyFile',
  'connectionsFile', 'embeddingReuseDirs', 'priceFile', 'maxSpendUsd', 'maxApiAttempts', 'maxInputTokens',
  'expiresAt', 'maxFileBytes', 'maxMetadataBytes'];
const PATH_FIELDS = ['storeRoot', 'workRoot', 'policyFile', 'connectionsFile', 'priceFile'];
const within = (base, value) => {
  const rel = path.relative(base, value);
  return !rel || rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
};

function privatePath(value) {
  if (!nonempty(value) || !path.isAbsolute(value)) fail('rag_v2_admin_private_path_invalid');
  const target = path.resolve(value), cwd = process.cwd();
  if (target === path.parse(target).root || within(target, cwd)
    || ['public', '.next', '.git', 'node_modules'].includes(path.relative(cwd, target).split(path.sep)[0].toLowerCase())) fail('rag_v2_admin_private_path_invalid');
  return target;
}

export function validateAdminConfig(value, now = Date.now()) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || Object.keys(value).some(key => !FIELDS.includes(key))
    || value.enabled !== true || !nonempty(value.id) || value.id.length > 100 || !nonempty(value.tenant) || value.tenant.length > 200
    || !nonempty(value.subject) || value.subject.length > 200) fail('rag_v2_admin_config_invalid');
  if (!Array.isArray(value.users) || !value.users.length || value.users.length > 32 || !value.users.every(v => nonempty(v) && v.length <= 200)) fail('rag_v2_admin_users_invalid');
  if (!Array.isArray(value.documentIds) || !value.documentIds.length || value.documentIds.length > 64
    || !value.documentIds.every(v => /^document_[a-f0-9]{64}$/.test(v))) fail('rag_v2_admin_documents_invalid');
  const expires = Date.parse(value.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) fail('rag_v2_admin_config_expired');
  if (typeof value.maxSpendUsd !== 'string' || nanoUsd(value.maxSpendUsd) < 0n) fail('rag_v2_admin_spend_cap_invalid');
  for (const key of ['maxApiAttempts', 'maxInputTokens']) if (!Number.isSafeInteger(value[key]) || value[key] < 0) fail('rag_v2_admin_cap_invalid');
  for (const [key, max] of [['maxFileBytes', 20 * 1024 * 1024], ['maxMetadataBytes', 1024 * 1024]]) {
    if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || value[key] < 1 || value[key] > max)) fail('rag_v2_admin_file_limit_invalid');
  }
  const paths = Object.fromEntries(PATH_FIELDS.map(key => [key, privatePath(value[key])]));
  if (within(paths.storeRoot, paths.workRoot) || within(paths.workRoot, paths.storeRoot)) fail('rag_v2_admin_storage_overlap');
  if (!Array.isArray(value.embeddingReuseDirs) || value.embeddingReuseDirs.length > 32) fail('rag_v2_admin_reuse_dirs_invalid');
  const config = { ...value, ...paths, users: [...new Set(value.users)].sort(), documentIds: [...new Set(value.documentIds)].sort(),
    embeddingReuseDirs: [...new Set(value.embeddingReuseDirs.map(privatePath))].sort(),
    maxFileBytes: value.maxFileBytes ?? 20 * 1024 * 1024, maxMetadataBytes: value.maxMetadataBytes ?? 1024 * 1024 };
  configuration({ maxFileBytes: config.maxFileBytes, maxMetadataBytes: config.maxMetadataBytes });
  return Object.freeze(config);
}

async function checkRealPath(file) {
  let existing = file;
  const tail = [];
  for (;;) {
    try { privatePath(path.join(await fs.realpath(existing), ...tail)); return; }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      tail.unshift(path.basename(existing)); existing = path.dirname(existing);
    }
  }
}

export async function loadAdminConfig(env = process.env) {
  if (env.RAG_V2_ADMIN_ENABLED !== '1') fail('rag_v2_admin_disabled');
  const file = privatePath(env.RAG_V2_ADMIN_CONFIG);
  await checkRealPath(file);
  const handle = await fs.open(file, 'r');
  let bytes;
  try {
    const buffer = Buffer.alloc(128 * 1024 + 1);
    let length = 0, count;
    do { ({ bytesRead: count } = await handle.read(buffer, length, buffer.length - length, null)); length += count; } while (count && length < buffer.length);
    if (length === buffer.length) fail('rag_v2_admin_config_too_large');
    bytes = buffer.subarray(0, length);
  } finally { await handle.close(); }
  let value;
  try { value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { fail('rag_v2_admin_config_json_invalid'); }
  const config = validateAdminConfig(value);
  for (const target of [...PATH_FIELDS.map(key => config[key]), ...config.embeddingReuseDirs]) await checkRealPath(target);
  return config;
}

export const configFingerprint = config => hash(stable(config));
