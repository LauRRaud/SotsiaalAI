#!/usr/bin/env node
// Knowledge cards follow their source's text when only its superscripts changed (ADR-056). A card's anchor is an exact
// quote at a position in a source unit. Riigi Teataja superscripts were read as plain digits ("§ 459") and are now read
// as the act cites them ("§ 45⁹"), with the same length, so each quote is re-read at the same place in the source as the
// current processing reads it. A quote that differs in anything but superscript digits stops the script; nothing is
// guessed. The preparation record keeps what was done, and REGISTER.json gets the new file hash. Usage:
//   node scripts/rag-v2-knowledge-reanchor.mjs [--input-root Andmebaasi] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseTextSource } from '../lib/rag-v2/text-source.js';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';

const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const root = option('--input-root') || 'Andmebaasi', write = args.includes('--write');
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const digits = text => text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/gu, char => String(SUPERSCRIPTS.indexOf(char)));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (code, detail) => { console.error(JSON.stringify({ ok: false, code, ...detail })); process.exit(1); };

const registerPath = path.join(root, 'REGISTER.json'), register = JSON.parse(await fs.readFile(registerPath, 'utf8'));
const report = [];
for (const entry of register.entries.filter(item => item.role === 'knowledge')) {
  const file = path.join(root, entry.path), bytes = await fs.readFile(file);
  if (sha256(bytes) !== entry.sha256) fail('registry_knowledge_hash_mismatch', { path: entry.path });
  const value = JSON.parse(bytes.toString('utf8'));
  const source = register.entries.find(item => item.path === value.source_path && item.role === 'source');
  if (!source || !/\.xml$/u.test(source.path)) { report.push({ path: entry.path, changed: 0, skipped: 'not_xml' }); continue; }
  const sourceBytes = await fs.readFile(path.join(root, source.path));
  if (sha256(sourceBytes) !== value.source_sha256) fail('knowledge_source_hash_mismatch', { path: entry.path });
  const units = parseTextSource(sourceBytes, 'xml', {}, { document_version_id: 'reanchor' }, DEFAULT_CONFIG).structured.source_units;
  let changed = 0;
  const reanchor = anchor => {
    const unit = units[anchor.source_unit_index];
    if (!unit || !Number.isInteger(anchor.start)) fail('knowledge_anchor_unplaced', { path: entry.path, anchor });
    const now = unit.raw_text.slice(anchor.start, anchor.start + anchor.quote.length);
    if (now === anchor.quote) return anchor;
    if (digits(now) !== digits(anchor.quote)) fail('knowledge_anchor_changed_beyond_superscripts', { path: entry.path, quote: anchor.quote, now });
    changed++;
    return { ...anchor, quote: now };
  };
  const knowledge = value.knowledge;
  for (const list of [knowledge.cards, knowledge.dependencies, knowledge.gaps]) {
    for (const item of list || []) if (Array.isArray(item.anchors)) item.anchors = item.anchors.map(reanchor);
  }
  report.push({ path: entry.path, changed });
  if (!changed || !write) continue;
  value.preparation.reanchored = [...(value.preparation.reanchored || []),
    { normalization: DEFAULT_CONFIG.normalization, reason: 'superscript_digits', anchors: changed }];
  const next = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await fs.writeFile(file, next);
  entry.sha256 = sha256(next);
}
if (write && report.some(item => item.changed)) await fs.writeFile(registerPath, `${JSON.stringify(register, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, write, files: report }, null, 1));
