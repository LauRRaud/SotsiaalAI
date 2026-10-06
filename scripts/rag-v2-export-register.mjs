// Makes a directory of collected sources ready for the corpus ingest: writes its REGISTER.json and selection.json.
// Every <name>.html (or .pdf, .xml) under --root that has a <name>.json beside it is a source with that metadata file;
// the register names both with their sha256, as Andmebaasi/REGISTER.json does for the repository's sources, and the
// selection lists every source. For sources that are generated or collected outside the repository (web pages before
// they are registered there, pages that hold contacts), ingested as a registered contact export is:
//   node scripts/rag-v2-export-register.mjs --root <dir>
//   node scripts/rag-v2-ingest-batch.mjs --mode plan --development-only --registry <dir>/REGISTER.json --selection <dir>/selection.json ...
// Prints counts only.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { hash } from '../lib/rag-v2/contracts.js';

const { values } = parseArgs({ options: { root: { type: 'string' } } });
if (!values.root) throw Error('usage: --root <dir>');
const root = path.resolve(values.root), entries = [], selection = [];
async function walk(dir) {
  for (const item of (await fs.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, item.name), rel = path.relative(root, full).split(path.sep).join('/');
    if (item.isDirectory()) { await walk(full); continue; }
    if (!/\.(?:html|pdf|xml)$/u.test(item.name)) continue;
    const metadataPath = rel.replace(/\.[a-z]+$/u, '.json'), metadata = await fs.readFile(path.join(root, metadataPath)).catch(() => null);
    if (!metadata) throw Error(`a source without its metadata file: ${rel}`);
    const parsed = JSON.parse(metadata.toString('utf8'));
    for (const key of ['document_id', 'title', 'source_type', 'language']) if (typeof parsed[key] !== 'string' || !parsed[key]) throw Error(`${metadataPath}: ${key} is missing`);
    entries.push({ path: rel, category: rel.split('/')[0], role: 'source', sha256: hash(await fs.readFile(full)), title: parsed.title, document_id: parsed.document_id, metadata_path: metadataPath },
      { path: metadataPath, category: rel.split('/')[0], role: 'metadata', sha256: hash(metadata) });
    selection.push({ source: rel });
  }
}
await walk(root);
const ids = entries.filter(entry => entry.role === 'source').map(entry => entry.document_id), repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
if (repeated.length) throw Error(`document ids used twice: ${[...new Set(repeated)].join(', ')}`);
if (!selection.length || selection.length > 1000) throw Error(`${selection.length} sources: the ingest takes 1 to 1000 at a time`);
await fs.writeFile(path.join(root, 'REGISTER.json'), `${JSON.stringify({ schema_version: 'export-register-1', created_at: new Date().toISOString(), path_base: '.', entries }, null, 1)}\n`);
await fs.writeFile(path.join(root, 'selection.json'), `${JSON.stringify(selection, null, 1)}\n`);
const byCategory = entries.filter(entry => entry.role === 'source').reduce((bag, entry) => { bag[entry.category] = (bag[entry.category] || 0) + 1; return bag; }, {});
console.log(JSON.stringify({ root: values.root, sources: selection.length, byCategory }));
