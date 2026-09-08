import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { ingest } from '../lib/rag-v2/ingestion.js';
import { registeredSource } from '../lib/rag-v2/registered-source.js';

try {
  const { values } = parseArgs({ options: {
    registry: { type: 'string' }, source: { type: 'string' }, item: { type: 'string' },
    tenant: { type: 'string' }, store: { type: 'string' }, profile: { type: 'string' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!values.registry || !values.source || !values.tenant || !values.store || !values['development-only']) {
    throw new Error('Usage: node scripts/rag-v2-ingest-registered.mjs --registry REGISTER.json --source RELATIVE_PATH --tenant NAME --store PRIVATE_DIR --development-only [--item ITEM_ID] [--profile PROFILE.json]');
  }
  const registryFile = path.resolve(values.registry), registry = JSON.parse(await fs.readFile(registryFile, 'utf8'));
  const entry = registry.entries.find(entry => entry.path === values.source);
  if (!entry) throw Object.assign(new Error('registry_source_not_found'), { code: 'registry_source_not_found' });
  const inputRoot = path.dirname(registryFile), metadata = await registeredSource(inputRoot, entry, { itemId: values.item });
  const profilePath = values.profile || fileURLToPath(new URL('../lib/rag-v2/domain-profiles/sotsiaalai.json', import.meta.url));
  const result = await ingest({ tenant: values.tenant, inputRoot, metadata, storeRoot: path.resolve(values.store),
    profile: JSON.parse(await fs.readFile(profilePath, 'utf8')), rights: { access: 'local_private', usage: 'development_only' } });
  console.log(JSON.stringify({ ok: true, source_format: result.bundle.version.source_format, document_id: result.bundle.document.id,
    version_id: result.bundle.version.id, reused: result.reused, chunks: result.bundle.chunks.length, output: result.output,
    warnings: result.bundle.report.warnings.map(warning => warning.code), model_calls: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || 'invalid_cli', ...(error.code ? {} : { message: error.message }) }));
  process.exitCode = 1;
}
