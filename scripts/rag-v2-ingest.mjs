import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readJson } from '../lib/rag-v2/catalog.js';
import { ingest } from '../lib/rag-v2/ingestion.js';

try {
  const { values } = parseArgs({ options: {
    'input-root': { type: 'string' }, metadata: { type: 'string' }, tenant: { type: 'string' },
    store: { type: 'string' }, profile: { type: 'string' }, config: { type: 'string' },
    'development-only': { type: 'boolean', default: false },
  } });
  if (!values['input-root'] || !values.metadata || !values.tenant || !values.store || !values['development-only']) {
    throw new Error('Usage: node scripts/rag-v2-ingest.mjs --input-root DIR --metadata RELATIVE.json --tenant NAME --store PRIVATE_DIR --development-only [--profile FILE.json] [--config FILE.json]');
  }
  const profilePath = values.profile || fileURLToPath(new URL('../lib/rag-v2/domain-profiles/sotsiaalai.json', import.meta.url));
  const result = await ingest({ tenant: values.tenant, inputRoot: path.resolve(values['input-root']),
    metadataFile: values.metadata, storeRoot: path.resolve(values.store), profile: await readJson(profilePath),
    config: values.config ? await readJson(values.config) : {},
    rights: { access: 'local_private', usage: 'development_only' },
  });
  console.log(JSON.stringify({ ok: true, reused: result.reused, document_id: result.bundle.document.id,
    version_id: result.bundle.version.id, generation: result.generation, output: result.output,
    pages: result.bundle.pages.length, chunks: result.bundle.chunks.length, structural_relations: result.bundle.relations.length,
    quality_state: result.bundle.report.quality_state, warnings: result.bundle.report.warnings.map(w => w.code), model_calls: 0 }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code || 'invalid_cli', message: error.code ? undefined : error.message }));
  process.exitCode = 1;
}
