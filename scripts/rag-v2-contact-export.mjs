import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { readJson, writeJson } from '../lib/rag-v2/catalog.js';
import { fail, hash } from '../lib/rag-v2/contracts.js';
import { prepareMunicipalContactExport } from '../lib/rag-v2/adapters/municipal-contact-export.js';

let db;
try {
  const { values } = parseArgs({ options: { mapping: { type: 'string' }, 'input-root': { type: 'string' },
    out: { type: 'string' }, 'database-url-env': { type: 'string', default: 'RAG_CONTACT_EXPORT_DATABASE_URL' }, help: { type: 'boolean' } } });
  if (values.help) {
    console.log('node scripts/rag-v2-contact-export.mjs --mapping mapping.json --input-root Andmebaasi --out tmp/contacts-new');
    console.log('Requires RAG_CONTACT_EXPORT_DATABASE_URL (or --database-url-env NAME). Reads verified public contacts; writes a new local source package, registry and ingest selection. No publication or model calls.');
  } else {
    if (!values.mapping || !values['input-root'] || !values.out || !/^[A-Z][A-Z0-9_]*$/.test(values['database-url-env'])) fail('invalid_contact_export_cli');
    const connectionString = process.env[values['database-url-env']];
    if (!connectionString) fail('contact_export_database_required');
    if ((await fs.stat(values.mapping)).size > 1024 * 1024) fail('contact_mapping_size_limit');
    const out = path.resolve(values.out);
    try { await fs.access(out); fail('contact_export_destination_exists'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString }), log: [] });
    const source = await prepareMunicipalContactExport({ db, inputRoot: path.resolve(values['input-root']), mapping: await readJson(values.mapping) });
    const text = `${JSON.stringify(source, null, 2)}\n`;
    await fs.mkdir(out); // Never overwrite an existing source version or folder.
    await fs.writeFile(path.join(out, 'contacts.json'), text, { flag: 'wx', mode: 0o600 });
    await writeJson(path.join(out, 'REGISTER.json'), { entries: [{ role: 'source', path: 'contacts.json', sha256: hash(text) }] });
    await writeJson(path.join(out, 'selection.json'), source.items.map(item => ({ source: 'contacts.json', item: item.id })));
    console.log(JSON.stringify({ contacts: source.items.length, source_sha256: hash(text), registry_writes: 0, model_calls: 0, publication: 'not_run' }));
  }
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'contact_export_failed' }));
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
