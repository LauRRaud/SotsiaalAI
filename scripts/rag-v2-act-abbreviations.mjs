#!/usr/bin/env node
// ADR-129 (owner 10.10.2026): the abbreviation of each indexed law, as Riigi Teataja itself gives it in the act's XML
// (/oigusakt/metaandmed/lyhend: "SHS", "LasteKS", "TsMS"). An answer to a specialist may use it after one full naming,
// and the server's provision check (lib/rag-v2/pilot/provision-check.js) reads an act named by it. Nothing is typed in
// by hand: the table is what the registered XML files of the indexed acts say, and a test holds the committed table to
// them. It lists every indexed law by its title, with null for one that has no abbreviation (the State Budget Act), so
// the check also knows which laws the corpus holds. A regulation has none (0 of 501 on 10.10.2026) and is not listed.
// Local and free: it reads docs/rag-v2/legal-acts-in-index.json and the files under Andmebaasi/, nothing else. Usage:
//   node scripts/rag-v2-act-abbreviations.mjs          print the table the files give
//   node scripts/rag-v2-act-abbreviations.mjs --write  write lib/rag-v2/search/act-abbreviations.json
// Run it with --write after an increment that adds a law or a law's version, once the index list has been renewed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const TABLE = path.join(root, 'lib/rag-v2/search/act-abbreviations.json');
export const TABLE_VERSION = 'rag-v2/act-abbreviations-1';
const field = (meta, name) => new RegExp(`<${name}>([^<]*)</${name}>`, 'u').exec(meta)?.[1].trim() || null;

/** The table the files give. acts: the acts of legal-acts-in-index.json ({ title, source_path }); read: a source
 *  path's XML text. A law is an act whose own metadata says so (dokumentLiik "seadus"). The versions of one law share
 *  its title and must agree: a title with two abbreviations, or one abbreviation under two titles, stops the run, since
 *  the check could then take one law for another. */
export function actAbbreviations(acts, read) {
  const found = new Map();
  for (const act of acts) {
    const meta = /<metaandmed[\s>][\s\S]*?<\/metaandmed>/u.exec(read(act.source_path))?.[0] ?? '';
    if (field(meta, 'dokumentLiik') !== 'seadus') continue;
    const short = field(meta, 'lyhend');
    // A version without the field says nothing: only two different abbreviations disagree.
    if (found.get(act.title) && short && found.get(act.title) !== short) throw Error(`two abbreviations for one title: ${act.title}`);
    found.set(act.title, found.get(act.title) ?? short);
  }
  const given = [...found.values()].filter(Boolean);
  if (new Set(given).size !== given.length) throw Error('one abbreviation for two titles');
  // In the order of the titles' characters, which is the same on every machine (a locale's order is not).
  return { schema_version: TABLE_VERSION, source: 'Riigi Teataja XML: /oigusakt/metaandmed/lyhend',
    abbreviations: Object.fromEntries([...found].sort(([a], [b]) => (a < b ? -1 : 1))) };
}
/** The table of this checkout's index list and files. */
export function currentActAbbreviations() {
  const { acts } = JSON.parse(fs.readFileSync(path.join(root, 'docs/rag-v2/legal-acts-in-index.json'), 'utf8'));
  return actAbbreviations(acts, source => fs.readFileSync(path.join(root, 'Andmebaasi', source), 'utf8'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const table = currentActAbbreviations();
  if (process.argv.includes('--write')) fs.writeFileSync(TABLE, `${JSON.stringify(table, null, 2)}\n`);
  console.log(JSON.stringify(table, null, 2));
}
