import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { readActive, readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { fail, hash } from '../lib/rag-v2/contracts.js';
import { prepareMunicipalContactExport, prepareRegisterContactExport } from '../lib/rag-v2/adapters/municipal-contact-export.js';
import { CONTACT_BINDING_SCHEMA } from '../lib/rag-v2/adapters/verified-municipal-contact.js';

// The bindings of the contact documents the index holds (ADR-085): which register rows the corpus already has. A
// document of the store's head that the index policy has left out is not one of them: a directory would link to a
// contact the chat cannot open. No names: the row's id, revision and content hash, and the document's item id.
async function boundContacts(store, indexed) {
  const active = await readActive(store), bound = [];
  if (!active.generation) fail('contact_export_store_empty');
  for (const [documentId, document] of Object.entries(active.documents)) {
    if (!indexed.has(documentId)) continue;
    let metadata; try { metadata = await readJson(path.join(store, 'versions', document.version_id, 'metadata.json')); } catch { continue; }
    const binding = metadata.registry_binding;
    if ((metadata.itemType || metadata.item_type) !== 'contact' || binding?.schema_version !== CONTACT_BINDING_SCHEMA) continue;
    bound.push({ entry_id: binding.entry_id, revision: binding.revision, content_sha256: binding.content_sha256, item_id: binding.source_record?.item_id });
  }
  return bound;
}

let db;
try {
  const { values } = parseArgs({ options: { mapping: { type: 'string' }, 'input-root': { type: 'string' }, register: { type: 'boolean', default: false }, store: { type: 'string' },
    policy: { type: 'string' }, tenant: { type: 'string', default: 'sotsiaalai-corpus' },
    out: { type: 'string' }, 'database-url-env': { type: 'string', default: 'RAG_CONTACT_EXPORT_DATABASE_URL' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('node scripts/rag-v2-contact-export.mjs --mapping mapping.json --input-root Andmebaasi --out tmp/contacts-new');
    console.log('node scripts/rag-v2-contact-export.mjs --register --store <store>/tenant_<hash> --policy <index policy.json> --out tmp/contacts-register');
    console.log('  --register (ADR-085): every verified register contact the index holds no matching document for, and the contact directories of each municipality.');
    console.log('Requires RAG_CONTACT_EXPORT_DATABASE_URL (or --database-url-env NAME). Reads verified public contacts; writes a new local source package, registry and ingest selection. No publication or model calls.');
  } else {
    const mapped = Boolean(values.mapping || values['input-root']);
    if (!values.out || !/^[A-Z][A-Z0-9_]*$/.test(values['database-url-env']) || mapped === values.register
      || mapped && (!values.mapping || !values['input-root'] || values.store || values.policy) || values.register && (!values.store || !values.policy)) fail('invalid_contact_export_cli');
    const connectionString = process.env[values['database-url-env']];
    if (!connectionString) fail('contact_export_database_required');
    if (mapped && (await fs.stat(values.mapping)).size > 1024 * 1024) fail('contact_mapping_size_limit');
    const out = path.resolve(values.out);
    try { await fs.access(out); fail('contact_export_destination_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    const indexed = values.register ? (await readJson(values.policy)).tenants?.[values.tenant]?.operator : null;
    if (values.register && !Array.isArray(indexed)) fail('contact_export_policy_invalid');
    const bound = values.register ? await boundContacts(path.resolve(values.store), new Set(indexed)) : null;
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [] });
    const prepared = values.register ? await prepareRegisterContactExport({ db, bound })
      : { source: await prepareMunicipalContactExport({ db, inputRoot: path.resolve(values['input-root']), mapping: await readJson(values.mapping) }) };
    const { source } = prepared, text = `${JSON.stringify(source, null, 2)}\n`;
    await fs.mkdir(out); // Never overwrite an existing source version or folder.
    await fs.writeFile(path.join(out, 'contacts.json'), text, { flag: 'wx', mode: 0o600 });
    await writeJson(path.join(out, 'REGISTER.json'), { entries: [{ role: 'source', path: 'contacts.json', sha256: hash(text) }] });
    await writeJson(path.join(out, 'selection.json'), source.items.map(item => ({ source: 'contacts.json', item: item.id })));
    console.log(JSON.stringify({ ...(values.register ? { ...prepared.counts, bound_in_store: bound.length, items: source.items.length } : { contacts: source.items.length }),
      source_sha256: hash(text), registry_writes: 0, model_calls: 0, publication: 'not_run' }));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'contact_export_failed' }));
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
