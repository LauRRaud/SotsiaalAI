#!/usr/bin/env node
// ADR-060: the search index of document versions no generation lists (their unit rows, seals and Qdrant points).
//   node scripts/rag-v2-prune-versions.mjs --tenant sotsiaalai-corpus [--connections tmp/rag-v2-services/connections.json] [--execute]
// Without --execute it only counts. Run it when no index job is running: it refuses while a generation or an index job
// of the tenant is not ready, and a run stopped part-way is completed by the next one.
import { parseArgs } from 'node:util';
import { readJson } from '../lib/rag-v2/catalog.js';
import { PostgresCatalog } from '../lib/rag-v2/search/postgres.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';
import { pruneUnreferencedVersions } from '../lib/rag-v2/search/prune-versions.js';

let postgres;
try {
  const { values } = parseArgs({ options: { tenant: { type: 'string' }, connections: { type: 'string', default: 'tmp/rag-v2-services/connections.json' },
    execute: { type: 'boolean', default: false } } });
  if (!values.tenant) throw Object.assign(new Error('usage'), { code: 'prune_usage' });
  const connections = await readJson(values.connections);
  postgres = new PostgresCatalog(connections.postgresUrl, { lexicalWorkers: 0 });
  const qdrant = new QdrantIndex(connections.qdrantUrl, connections.qdrantKey);
  console.log(JSON.stringify(await pruneUnreferencedVersions({ postgres, qdrant, tenant: values.tenant, execute: values.execute }), null, 1));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/u.test(error.code) ? error.code : 'prune_failed' }));
  process.exitCode = 1;
} finally { await postgres?.close(); }
