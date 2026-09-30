// The corpus refresh path (ADR-059): Riigi Teataja texts the validity check (ADR-038) or the municipal scan (ADR-058)
// downloaded go into the registry, a clean ingest review is written without hand edits, and the store increment with
// its index policy is packaged for the server. Each step stops where a person has to decide.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fail, hash } from './contracts.js';
import { inspectXmlMetadata } from './text-source.js';
import { derivedAnnex } from './adapters/rt-annex.js';

const RT_XML = /^oigusaktid\/\d+\.xml$/u;
const row = file => `| ${file.split('/').pop()} | [${file}](<${file}>) |\n`;

// A file is replaced through a temporary name, so a stop leaves either its old or its new bytes, never a part.
async function replaceFile(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.refresh-${process.pid}`;
  await fs.writeFile(temporary, content);
  await fs.rename(temporary, file);
}

// The registered bytes of a file about to be replaced go to `previous` once: a copy already there is kept (a second run
// after a stop must not overwrite it with bytes the first run wrote), and bytes that are neither there nor on disk stop
// the refresh, since a knowledge card bound to them could not be rebound.
async function keepPrevious(root, previous, file, sha256) {
  const target = path.join(previous, file), kept = await fs.readFile(target).catch(() => null);
  if (kept) { if (hash(kept) !== sha256) fail('refresh_previous_differs'); return; }
  const current = await fs.readFile(path.join(root, file));
  if (hash(current) !== sha256) fail('refresh_registered_bytes_missing');
  await replaceFile(target, current);
}

/** Registers the Riigi Teataja XML files in `from` (named <globaalID>.xml): a new act gets an entry and a REGISTER.md
 *  row, a registered act whose bytes changed (an end date written in, a corrected text) is replaced in place, and an
 *  unchanged one is left. The replaced bytes are kept under `previous` for rebinding knowledge cards; an annex derived
 *  from a replaced act is read again from it (ADR-053). Every file is read and checked, and every annex derived, before
 *  anything is written; the registry is written last (Codex R3, 30.09.2026). Returns what changed and the selection. */
export async function registerDownloads({ root, from, previous = null }) {
  const registerFile = path.join(root, 'REGISTER.json'), registerText = await fs.readFile(registerFile, 'utf8');
  const register = JSON.parse(registerText), mdFile = path.join(root, 'REGISTER.md'), mdText = await fs.readFile(mdFile, 'utf8');
  let md = mdText.replace(/\r\n/gu, '\n');
  const byPath = new Map(register.entries.map(entry => [entry.path, entry]));
  const result = { added: [], replaced: [], unchanged: [], annexes: [], knowledge: [] };
  const writes = new Map(), backups = new Map();
  for (const name of (await fs.readdir(from)).filter(file => /^\d+\.xml$/u.test(file)).sort()) {
    const bytes = await fs.readFile(path.join(from, name)), file = `oigusaktid/${name}`, sha256 = hash(bytes);
    const act = inspectXmlMetadata(bytes).metadata;
    if (act.act_reference !== name.slice(0, -4) || !act.title) fail('refresh_not_the_named_act');
    const entry = byPath.get(file);
    if (entry && entry.role !== 'source') fail('refresh_path_not_a_source');
    if (entry?.sha256 === sha256) { result.unchanged.push(file); continue; }
    writes.set(file, bytes);
    if (entry) {
      backups.set(file, entry.sha256);
      entry.sha256 = sha256;
      result.replaced.push(file);
      continue;
    }
    const after = [...register.entries].reverse().find(item => item.role === 'source' && RT_XML.test(item.path));
    if (!after || !md.includes(row(after.path))) fail('refresh_register_row_missing');
    const added = { path: file, category: 'oigusaktid', role: 'source', sha256, original_path: `riigiteataja.ee/et/akt/${name}`,
      review_status: 'version_and_jurisdiction_validation_pending' };
    register.entries.splice(register.entries.indexOf(after) + 1, 0, added);
    byPath.set(file, added);
    md = md.replace(row(after.path), row(after.path) + row(file));
    result.added.push(file);
  }
  if (result.added.length) {
    const counts = register.counts?.oigusaktid, summary = /^\| oigusaktid \| (\d+) \| (\d+) \|/mu.exec(md);
    if (!counts || !summary || Number(summary[1]) !== counts.sources || Number(summary[2]) !== counts.files) fail('refresh_register_counts_differ');
    counts.sources += result.added.length; counts.files += result.added.length;
    md = md.replace(summary[0], `| oigusaktid | ${counts.sources} | ${counts.files} |`);
  }
  // An annex keeps its act's XML hash and validity in its metadata, so it is derived again from the replaced act's new bytes.
  for (const entry of register.entries.filter(item => item.role === 'source' && item.metadata_path)) {
    const metadata = JSON.parse(await fs.readFile(path.join(root, entry.metadata_path), 'utf8'));
    if (!metadata.rt_annex || !result.replaced.includes(metadata.rt_annex.xml_path)) continue;
    const annex = metadata.rt_annex;
    const derived = await derivedAnnex({ root, xmlPath: annex.xml_path, fileName: annex.file_name, table: annex.table,
      out: entry.path.replace(/\.json$/u, ''), heading: annex.heading ?? null, xml: writes.get(annex.xml_path) });
    const sourceSha = hash(Buffer.from(derived.source));
    if (sourceSha !== entry.sha256) backups.set(entry.path, entry.sha256);
    writes.set(entry.path, derived.source);
    writes.set(entry.metadata_path, derived.metadata);
    entry.sha256 = sourceSha;
    byPath.get(entry.metadata_path).sha256 = hash(Buffer.from(derived.metadata));
    result.annexes.push(entry.path);
  }
  // A knowledge card is bound to its source's bytes (ADR-054); a changed source needs the re-anchor script.
  for (const entry of register.entries.filter(item => item.role === 'knowledge')) {
    const card = JSON.parse(await fs.readFile(path.join(root, entry.path), 'utf8'));
    if (byPath.get(card.source_path) && card.source_sha256 !== byPath.get(card.source_path).sha256) result.knowledge.push(entry.path);
  }
  // Writing: the previous bytes first, then the files, the registry last. A stop before the registry leaves it naming
  // the old bytes, which `previous` keeps; the same command then completes the refresh.
  if (previous) for (const [file, sha256] of backups) await keepPrevious(root, previous, file, sha256);
  for (const [file, content] of writes) await replaceFile(path.join(root, file), content);
  const indent = registerText.match(/\n( +)"/u)?.[1].length ?? 2;
  await replaceFile(registerFile, `${JSON.stringify(register, null, indent)}${registerText.endsWith('\n') ? '\n' : ''}`);
  await replaceFile(mdFile, mdText.includes('\r\n') ? md.replace(/\n/gu, '\r\n') : md);
  return { ...result, selection: [...result.added, ...result.replaced, ...result.annexes].map(source => ({ source })) };
}

// Warnings an item may carry and still be included, with the note the review records (ADR-053, ADR-054).
export const KNOWN_WARNINGS = Object.freeze({
  collected_package_text: 'Tuletatud allikas (ADR-053): collected_package_text on JSON-adapteri üldhoiatus; päritolu kontrollis registriadapter (XML-i ja lisa räsi, akti redaktsioon, kehtivus).',
  knowledge_import_unreviewed: 'Allikapõhised teadmiskaardid (ADR-054): iga ankur läbis ingest\'i kontrolli; sisu pole inimene üle vaadanud.',
});

const fieldValue = (item, key) => {
  const field = item.fields?.[key];
  return field && typeof field === 'object' && 'value' in field ? field.value : field;
};

/** The review of an ingest review draft when every item is clean: no blockers, only known warnings, a start date, and
 *  a municipality for a municipal council's or government's act. Otherwise the items a person has to look at. */
export function autoReview(draft, { reviewer }) {
  if (typeof reviewer !== 'string' || !reviewer.trim()) fail('refresh_reviewer_required');
  const held = [];
  const items = draft.items.map(item => {
    const warnings = item.warnings.map(warning => warning.code ?? String(warning));
    const municipal = /(?:valla|linna)(?:volikogu|valitsus)$/iu.test(String(fieldValue(item, 'authority') ?? ''));
    const reasons = [...item.blockers.map(blocker => `blocker:${blocker.code ?? blocker}`), ...warnings.filter(code => !KNOWN_WARNINGS[code]),
      ...(fieldValue(item, 'valid_from') ? [] : ['valid_from_missing']),
      ...(municipal && !fieldValue(item, 'municipality_name') ? ['municipality_unresolved'] : [])];
    if (reasons.length) held.push({ item_id: item.item_id, act_reference: fieldValue(item, 'act_reference') ?? null, title: fieldValue(item, 'title'), reasons });
    const notes = [...new Set(warnings)].map(code => KNOWN_WARNINGS[code]).filter(Boolean);
    return { ...item, decision: 'include', note: notes.join(' ') };
  });
  return held.length ? { held } : { review: { ...draft, reviewed_by: reviewer, items } };
}

/** The next index policy: the previous one with the reviewed documents, each checked against the store's head, and
 *  without the documents `remove` names ({ document_id, reason }): an act a newer one replaced, which the store keeps as
 *  history (ADR-058). A removed document must be in the policy and not among the reviewed ones. */
export function nextPolicy(previous, review, active, tenant, remove = []) {
  const operator = previous?.tenants?.[tenant]?.operator;
  if (!Array.isArray(operator)) fail('refresh_policy_invalid');
  const included = review.items.filter(item => item.decision === 'include');
  if (included.some(item => active.documents[item.document_id]?.version_id !== item.version_id)) fail('refresh_version_not_in_head');
  const removed = new Set(remove.map(entry => entry.document_id));
  if (remove.some(entry => typeof entry.reason !== 'string' || !entry.reason.trim()) || removed.size !== remove.length) fail('refresh_remove_invalid');
  if ([...removed].some(id => !operator.includes(id))) fail('refresh_remove_not_in_policy');
  if (included.some(item => removed.has(item.document_id))) fail('refresh_remove_reviewed');
  const documents = [...new Set([...operator, ...included.map(item => item.document_id)])].filter(id => !removed.has(id)).sort();
  if (documents.some(id => !active.documents[id])) fail('refresh_policy_document_not_in_head');
  return { policy: { tenants: { [tenant]: { operator: documents } } }, added: documents.length + removed.size - operator.length,
    removed: remove, versions: included.map(item => item.version_id) };
}
