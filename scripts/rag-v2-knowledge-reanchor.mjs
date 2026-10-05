#!/usr/bin/env node
// Knowledge cards follow their source's text when only its superscripts changed (ADR-056). A card's anchor is an exact
// quote at a position in a source unit. Riigi Teataja superscripts were read as plain digits ("§ 459") and are now read
// as the act cites them ("§ 45⁹"), with the same length, so each quote is re-read at the same place in the source as the
// current processing reads it. A quote that differs in anything but superscript digits stops the script; nothing is
// guessed. The preparation record keeps what was done, and REGISTER.json gets the new file hash.
// A card also follows a source whose bytes changed while its text did not (ADR-053: a derived annex now names its act
// version, outside the items): the previous bytes, the card's own source_sha256, are read from --previous-root, and
// every source unit must read the same from both; then the card is bound to the new bytes.
// And a card follows a text that lost the targets of its links (ADR-090, source-structure-v31): a quote after a link
// stands earlier by the target's length and reads the same; its place is corrected, its words are not touched. Usage:
//   node scripts/rag-v2-knowledge-reanchor.mjs [--input-root Andmebaasi] [--previous-root DIR] [--write]
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseTextSource } from '../lib/rag-v2/text-source.js';
import { DEFAULT_CONFIG } from '../lib/rag-v2/contracts.js';

const args = process.argv.slice(2), option = name => { const at = args.indexOf(name); return at >= 0 ? args[at + 1] : null; };
const root = option('--input-root') || 'Andmebaasi', previousRoot = option('--previous-root'), write = args.includes('--write');
const SUPERSCRIPTS = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const digits = text => text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/gu, char => String(SUPERSCRIPTS.indexOf(char)));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = (code, detail) => { console.error(JSON.stringify({ ok: false, code, ...detail })); process.exit(1); };
const FORMATS = { xml: 'xml', json: 'json' };
const unitsOf = (bytes, format) => parseTextSource(bytes, format, {}, { document_version_id: 'reanchor' }, DEFAULT_CONFIG).structured.source_units;

const registerPath = path.join(root, 'REGISTER.json'), register = JSON.parse(await fs.readFile(registerPath, 'utf8'));
const report = [];
for (const entry of register.entries.filter(item => item.role === 'knowledge')) {
  const file = path.join(root, entry.path), bytes = await fs.readFile(file);
  if (sha256(bytes) !== entry.sha256) fail('registry_knowledge_hash_mismatch', { path: entry.path });
  const value = JSON.parse(bytes.toString('utf8'));
  const source = register.entries.find(item => item.path === value.source_path && item.role === 'source');
  const format = FORMATS[path.extname(source?.path || '').slice(1).toLowerCase()];
  if (!format) { report.push({ path: entry.path, changed: 0, skipped: 'not_xml_or_json' }); continue; }
  const sourceBytes = await fs.readFile(path.join(root, source.path));
  if (sha256(sourceBytes) !== source.sha256) fail('registry_source_hash_mismatch', { path: source.path });
  const units = unitsOf(sourceBytes, format);
  let rebound = null;
  if (sha256(sourceBytes) !== value.source_sha256) {
    const previous = previousRoot ? await fs.readFile(path.join(previousRoot, source.path)).catch(() => null) : null;
    if (!previous || sha256(previous) !== value.source_sha256) fail('knowledge_source_hash_mismatch', { path: entry.path });
    const before = unitsOf(previous, format);
    if (before.length !== units.length || before.some((unit, index) => unit.raw_text !== units[index].raw_text)) {
      fail('knowledge_source_text_changed', { path: entry.path });
    }
    rebound = value.source_sha256;
  }
  let changed = 0, moved = 0;
  // Each anchor's recorded place and how far it moved, by source unit (ADR-090).
  const moves = new Map();
  const reanchor = anchor => {
    const unit = units[anchor.source_unit_index];
    if (!unit || !Number.isInteger(anchor.start)) fail('knowledge_anchor_unplaced', { path: entry.path, anchor });
    const now = unit.raw_text.slice(anchor.start, anchor.start + anchor.quote.length);
    const note = by => { moves.set(anchor.source_unit_index, [...(moves.get(anchor.source_unit_index) || []), { start: anchor.start, by }]); };
    if (now === anchor.quote) { note(0); return anchor; }
    if (digits(now) === digits(anchor.quote)) { changed++; note(0); return { ...anchor, quote: now }; }
    // ADR-090: the target of a link no longer stands in a section's text, so what follows a link stands earlier by the
    // target's length. The quote itself must read the same, at or before its recorded place: the nearest such place.
    const at = unit.raw_text.lastIndexOf(anchor.quote, anchor.start);
    if (at < 0) fail('knowledge_anchor_changed_beyond_superscripts', { path: entry.path, quote: anchor.quote, now });
    moved++; note(anchor.start - at);
    return { ...anchor, start: at };
  };
  const knowledge = value.knowledge;
  for (const list of [knowledge.cards, knowledge.dependencies, knowledge.gaps]) {
    for (const item of list || []) if (Array.isArray(item.anchors)) item.anchors = item.anchors.map(reanchor);
  }
  // What was taken out before an anchor was taken out before every later anchor of the same unit: inside a unit the
  // moves can only grow with the places. A quote found by chance at another place breaks that order, and nothing is written.
  for (const [unit, list] of moves) {
    const ordered = [...list].sort((a, b) => a.start - b.start);
    if (ordered.some((item, index) => index > 0 && item.by < ordered[index - 1].by)) fail('knowledge_anchor_move_inconsistent', { path: entry.path, source_unit_index: unit });
  }
  report.push({ path: entry.path, changed, ...(moved ? { moved } : {}), ...(rebound ? { rebound: true } : {}) });
  if (!changed && !moved && !rebound || !write) continue;
  value.preparation.reanchored = [...(value.preparation.reanchored || []),
    ...(changed ? [{ normalization: DEFAULT_CONFIG.normalization, reason: 'superscript_digits', anchors: changed }] : []),
    ...(moved ? [{ normalization: DEFAULT_CONFIG.normalization, reason: 'link_targets_removed', anchors: moved }] : []),
    ...(rebound ? [{ normalization: DEFAULT_CONFIG.normalization, reason: 'source_bytes_same_text', previous_source_sha256: rebound }] : [])];
  if (rebound) value.source_sha256 = sha256(sourceBytes);
  const next = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await fs.writeFile(file, next);
  entry.sha256 = sha256(next);
}
if (write && report.some(item => item.changed || item.moved || item.rebound)) await fs.writeFile(registerPath, `${JSON.stringify(register, null, 2)}\n`);
console.log(JSON.stringify({ ok: true, write, files: report }, null, 1));
