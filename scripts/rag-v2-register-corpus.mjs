// Writes the RAG state into Andmebaasi/REGISTER.json and Andmebaasi/REGISTER.md (lib/rag-v2/register-corpus.js):
// which registered files are in the corpus and how many documents each gives, the corpus by source type, and the
// sources of the corpus that are kept outside the repository (pages by title and address; contacts by counts only,
// since a contact's title is a person's name). Reads the corpus store's head and the policy of the corpus version;
// no model or embedding call. Run it after every corpus increment, with that increment's policy:
//   node --import ./scripts/register-node-source-loader.mjs scripts/rag-v2-register-corpus.mjs --store <corpus store>
//     --policy <ship/policy.json> --version v64 --index 7d209c63 [--units 45596] [--date 2026-10-07]
//     [--tenant sotsiaalai-corpus] [--root Andmebaasi] [--check]
// --check writes nothing and exits 1 when the registers do not say what the store holds.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { id } from '../lib/rag-v2/contracts.js';
import { readActive } from '../lib/rag-v2/catalog.js';
import { corpusState, registerWithCorpus, markdownWithCorpus } from '../lib/rag-v2/register-corpus.js';

const { values } = parseArgs({ options: { store: { type: 'string' }, policy: { type: 'string' }, version: { type: 'string' }, index: { type: 'string' }, units: { type: 'string' },
  date: { type: 'string', default: new Date().toISOString().slice(0, 10) }, tenant: { type: 'string', default: 'sotsiaalai-corpus' }, root: { type: 'string', default: 'Andmebaasi' },
  check: { type: 'boolean', default: false } } });
if (!values.store || !values.policy || !/^v\d+$/u.test(values.version || '') || !/^[0-9a-f]{8}$/u.test(values.index || '') || !/^\d{4}-\d{2}-\d{2}$/u.test(values.date) || (values.units && !/^\d+$/u.test(values.units))) {
  throw Error('usage: --store <corpus store> --policy <policy.json> --version v<N> --index <8 hex> [--units <n>] [--date YYYY-MM-DD] [--tenant <name>] [--root Andmebaasi] [--check]');
}
const tenantDir = path.resolve(values.store, id('tenant', values.tenant)), active = await readActive(tenantDir);
const policy = JSON.parse(await fs.readFile(values.policy, 'utf8')).tenants?.[values.tenant]?.operator;
if (!Array.isArray(policy)) throw Error('the policy names no documents for the tenant');
const documents = [];
for (const document of policy) {
  const head = active.documents[document];
  if (!head) throw Error(`a document of the policy is not in the store's head: ${document}`);
  const metadata = JSON.parse(await fs.readFile(path.join(tenantDir, 'versions', head.version_id, 'metadata.json'), 'utf8'));
  documents.push({ source_type: metadata.source_type, title: metadata.title, url: metadata.url || metadata.source_url || null, publisher: metadata.publisher || metadata.authority || null,
    municipality: metadata.municipality_name || null, registry_path: metadata.registry_provenance?.registry_path || null });
}
const jsonFile = path.join(values.root, 'REGISTER.json'), mdFile = path.join(values.root, 'REGISTER.md');
const jsonBefore = (await fs.readFile(jsonFile, 'utf8')).replace(/\r\n/gu, '\n'), mdBefore = (await fs.readFile(mdFile, 'utf8')).replace(/\r\n/gu, '\n');
const register = JSON.parse(jsonBefore);
const state = corpusState(register, documents, { version: values.version, index_generation: values.index, units: values.units ? Number(values.units) : null, date: values.date });
const jsonAfter = `${JSON.stringify(registerWithCorpus(register, state), null, 2)}\n`, mdAfter = markdownWithCorpus(mdBefore, state);
const summary = { corpus: values.version, documents: state.documents, fromRepository: state.documents - state.outsideDocuments, outsideRepository: state.outsideDocuments,
  outsideKinds: Object.fromEntries(state.outside.map(found => [found.kind.key, found.documents])), sourceFilesInCorpus: Object.keys(state.perPath).length, sourceFilesNotInCorpus: state.notInCorpus.length,
  changed: { json: jsonAfter !== jsonBefore, md: mdAfter !== mdBefore } };
if (values.check) { console.log(JSON.stringify({ ...summary, check: summary.changed.json || summary.changed.md ? 'the registers do not say what the store holds' : 'same' })); process.exit(summary.changed.json || summary.changed.md ? 1 : 0); }
await fs.writeFile(jsonFile, jsonAfter);
await fs.writeFile(mdFile, mdAfter);
console.log(JSON.stringify(summary));
