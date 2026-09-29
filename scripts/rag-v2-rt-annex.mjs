#!/usr/bin/env node
// Reads an annex table of a registered Riigi Teataja act (the PDF inside the act's XML) into a derived source and its
// metadata file (ADR-050). The source keeps one item per table row with the table's own column labels; the metadata
// names the act version and the exact XML and annex bytes, which the registry adapter checks again on ingest.
//   node scripts/rag-v2-rt-annex.mjs --xml oigusaktid/126092026005.xml --file SOM_24092026_m37_lisa.pdf \
//     --table abivahendite_loetelu --out oigusaktid/lisad/126092026005-abivahendite-loetelu [--root Andmebaasi] [--check]
// Writes <out>.json and <out>.meta.json under the root; --check only compares them with a fresh extraction.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { hash } from '../lib/rag-v2/contracts.js';
import { derivedAnnex, ANNEX_TABLES } from '../lib/rag-v2/adapters/rt-annex.js';

const { values } = parseArgs({ options: { xml: { type: 'string' }, file: { type: 'string' }, table: { type: 'string' }, out: { type: 'string' },
  root: { type: 'string', default: 'Andmebaasi' }, check: { type: 'boolean', default: false } } });
if (!values.xml || !values.file || !ANNEX_TABLES[values.table] || !values.out) {
  console.error('usage: --xml <registered xml> --file <annex file name> --table abivahendite_loetelu --out <path without extension> [--root] [--check]');
  process.exit(1);
}

const root = path.resolve(values.root);
const result = await derivedAnnex({ root, xmlPath: values.xml, fileName: values.file, table: values.table, out: values.out });
const targets = [[`${values.out}.json`, result.source], [`${values.out}.meta.json`, result.metadata]];
if (values.check) {
  const differing = [];
  for (const [file, text] of targets) if ((await fs.readFile(path.join(root, file), 'utf8').catch(() => null)) !== text) differing.push(file);
  console.log(JSON.stringify({ ok: !differing.length, rows: result.rows, differing }));
  process.exit(differing.length ? 1 : 0);
}
await fs.mkdir(path.dirname(path.join(root, values.out)), { recursive: true });
for (const [file, text] of targets) await fs.writeFile(path.join(root, file), text);
console.log(JSON.stringify({ ok: true, rows: result.rows, written: targets.map(([file, text]) => ({ file, sha256: hash(Buffer.from(text)) })) }));
