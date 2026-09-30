#!/usr/bin/env node
// The social welfare acts each municipality has in force that the index lacks (ADR-058). Reads public data only.
//   scan --manifest docs/rag-v2/legal-acts-in-index.json --out DIR [--today YYYY-MM-DD] [--horizon-days 460] [--download DIR]
//     Lists the acts of every indexed municipality's council and government in Riigi Teataja, keeps the social welfare
//     acts in force today or starting by the horizon (lib/rag-v2/municipal-acts.js) and names those not in the index.
//     --download fetches their XML into DIR, except a text with no paragraphs (a repeal record) and an act whose
//     consolidated-text group the index already has (its versions are the validity check's, ADR-038).
//     It also names the indexed acts the selection now drops (a newer act of the same kind, a past year in the title):
//     their amounts or rules would stand beside the newer ones, so they are to leave the index policy (refresh package
//     --remove, ADR-059). Writes municipal-acts-<today>.json and .md. Exit 0: nothing to do; 10: acts to add or remove;
//     20: a request failed.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addDays } from '../lib/rag-v2/law-validity.js';
import { selectMunicipalActs } from '../lib/rag-v2/municipal-acts.js';

const BASE = process.env.RAG_V2_RT_BASE || 'https://www.riigiteataja.ee';
const PAUSE = Number(process.env.RAG_V2_RT_PAUSE_MS ?? 200), PAGE = 500;
const pause = () => new Promise(resolve => setTimeout(resolve, PAUSE));
const tag = (xml, name) => xml.match(new RegExp(`<${name}>([^<]*)</${name}>`))?.[1] ?? null;

async function get(url, errors, json) {
  let last = 'unknown';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'sotsiaalai-rag-v2-municipal-acts' } });
      if (response.ok) { const body = json ? await response.json() : await response.text(); await pause(); return body; }
      last = `http_${response.status}`;
    } catch (error) { last = error.name === 'TimeoutError' ? 'timeout' : 'network'; }
    await new Promise(resolve => setTimeout(resolve, PAUSE * attempt));
  }
  errors.push({ url: url.replace(BASE, ''), error: last });
  return undefined;
}

// Title words that every category of lib/rag-v2/municipal-acts.js contains; the search matches them inside words too
// ("hoold" finds "Üldhooldusteenuse"). A search this narrow fits one page: an issuer's whole listing does not (Tallinna
// Linnavalitsus has 2110 acts, 500 a page), and Riigi Teataja orders every request differently, so its pages overlap
// and miss acts (30.09.2026: the v43 scan missed four).
const TITLE_WORDS = ['sotsiaal', 'toetus', 'toetami', 'teenus', 'hoold', 'hoolekan', 'eluruum', 'eluase', 'puude', 'puuet', 'eaka', 'toimetulek'];
const ROUNDS = 8, MAX_PAGES = 30;

/** Every act of an issuer whose title has the word; the pages are fetched again until the distinct acts reach the
 *  reported total. undefined when a request failed or the acts never added up. */
async function search(issuer, word, errors) {
  const acts = new Map();
  let total = Infinity;
  for (let round = 1; round <= ROUNDS && acts.size < total; round++) {
    for (let page = 1; (page - 1) * PAGE < total && page <= MAX_PAGES; page++) {
      const result = await get(`${BASE}/api/oigusakt_otsing/1/otsi?valjaandja=${encodeURIComponent(issuer)}&pealkiri=${encodeURIComponent(word)}&leht=${page}&limiit=${PAGE}`, errors, true);
      if (!Number.isInteger(result?.metaandmed?.kokku) || !Array.isArray(result?.aktid)) {
        if (result !== undefined) errors.push({ issuer, word, error: 'invalid_response' });
        return undefined;
      }
      total = result.metaandmed.kokku;
      for (const act of result.aktid) acts.set(String(act.globaalID), act);
    }
  }
  if (acts.size < total) { errors.push({ issuer, word, error: 'incomplete_results', found: acts.size, total }); return undefined; }
  return [...acts.values()];
}

/** The issuer's acts whose titles have a social welfare word; undefined when any search failed. */
async function listing(issuer, municipality, errors) {
  const acts = new Map();
  for (const word of TITLE_WORDS) {
    const found = await search(issuer, word, errors);
    if (!found) return undefined;
    for (const act of found) acts.set(String(act.globaalID), act);
  }
  return [...acts.values()].map(a => ({ m: municipality, issuer, id: String(a.globaalID), title: a.pealkiri, from: a.kehtivus?.algus ?? null,
    to: a.kehtivus?.lopp ?? null, tekst: a.tekst, kk: a.kehtivKehtetus === true, mj: a.mitteJoustunud === true }));
}

function markdown(report) {
  const lines = [`# Omavalitsuste sotsiaalaktid, mida indeksis pole: ${report.today}`, '',
    `Vaadatud ${report.municipalities} omavalitsuse volikogu ja valitsuse aktid (vaatehorisont kuni ${report.horizon}). ` +
    `Valitud ${report.selected} kehtivat sotsiaalvaldkonna akti, neist indeksis ${report.indexed}.`, '',
    '| Kategooria | Uusi | Alla laaditud |', '|---|---:|---:|',
    ...Object.entries(report.categories).map(([name, c]) => `| ${name} | ${c.new} | ${c.downloaded} |`), ''];
  for (const act of report.acts) lines.push(`- ${act.m} ${act.id} ${act.category} ${act.from}..${act.to ?? ''} ${act.status}: ${act.title}`);
  if (report.superseded.length) {
    lines.push('', `## Indeksis, aga asendatud: ${report.superseded.length}`, '');
    for (const act of report.superseded) lines.push(`- ${act.m} ${act.id} ${act.category} ${act.reason}${act.replaced_by ? ` (${act.replaced_by})` : ''}: ${act.title}`);
  }
  if (report.errors.length) lines.push('', ...report.errors.map(e => `- päringu tõrge: ${e.error} ${e.url ?? e.issuer ?? ''}`));
  return lines.join('\n');
}

try {
  const [mode, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { manifest: { type: 'string' }, out: { type: 'string' }, today: { type: 'string' },
    'horizon-days': { type: 'string', default: '460' }, download: { type: 'string' } } });
  if (mode !== 'scan' || !values.manifest || !values.out) throw Object.assign(new Error('usage'), { code: 'municipal_acts_usage' });
  const manifest = JSON.parse(await fs.readFile(values.manifest, 'utf8'));
  const today = values.today || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
  const horizon = addDays(today, Number(values['horizon-days']));
  const indexed = new Set(manifest.acts.map(act => act.globaal_id)), groups = new Set(manifest.acts.map(act => act.group).filter(Boolean));
  // A municipality's council is the issuer of its indexed acts; its government has the same name with "valitsus".
  const councils = new Map();
  for (const act of manifest.acts) for (const region of act.regions || []) if (/volikogu$/u.test(act.issuer || '')) councils.set(region, act.issuer);
  const errors = [], all = [];
  for (const [municipality, council] of [...councils].sort()) {
    for (const issuer of [council, council.replace(/volikogu$/u, 'valitsus')]) {
      const acts = await listing(issuer, municipality, errors);
      if (acts) all.push(...acts);
    }
  }
  const { keep, dropped } = selectMunicipalActs(all, { today, horizon });
  const documentOf = new Map(manifest.acts.map(act => [act.globaal_id, act.document_id]));
  const superseded = dropped.filter(act => indexed.has(act.id)).map(act => ({ m: act.m, id: act.id, document_id: documentOf.get(act.id) ?? null,
    category: act.category, title: act.title, reason: act.reason, ...(act.replaced_by ? { replaced_by: act.replaced_by } : {}) }));
  const fresh = keep.filter(act => !indexed.has(act.id)).sort((a, b) => a.m.localeCompare(b.m) || a.category.localeCompare(b.category) || a.from.localeCompare(b.from));
  // A downloaded text is read the way the ingest reads it: a repeal record has no text of its own (source_text_empty).
  // Loaded only for --download, since the monthly scan runs without the installed packages.
  const reader = values.download ? { ...(await import('../lib/rag-v2/text-source.js')), ...(await import('../lib/rag-v2/contracts.js')) } : null;
  const hasText = xml => {
    try { reader.parseTextSource(Buffer.from(xml), 'xml', {}, { document_version_id: 'municipal-acts-scan' }, reader.DEFAULT_CONFIG); return true; }
    catch (error) { if (error.code === 'source_text_empty') return false; throw error; }
  };
  if (values.download) await fs.mkdir(values.download, { recursive: true });
  for (const act of fresh) {
    if (!values.download) { act.status = 'new'; continue; }
    const xml = await get(`${BASE}/et/akt/${act.id}.xml`, errors, false);
    if (xml === undefined) { act.status = 'fetch_failed'; continue; }
    act.group = tag(xml, 'terviktekstiGrupiID');
    if (act.group && groups.has(act.group)) { act.status = 'group_indexed'; continue; }
    if (!hasText(xml)) { act.status = 'no_text'; continue; }
    await fs.writeFile(path.join(values.download, `${act.id}.xml`), xml);
    act.status = 'downloaded';
  }
  const categories = {};
  for (const act of fresh) {
    const c = categories[act.category] ||= { new: 0, downloaded: 0 };
    c.new++; if (act.status === 'downloaded') c.downloaded++;
  }
  const report = { schema_version: 'rag-v2/municipal-acts-report-1', today, horizon, municipalities: councils.size, selected: keep.length,
    indexed: keep.length - fresh.length, categories, errors, acts: fresh, superseded };
  await fs.mkdir(values.out, { recursive: true });
  await fs.writeFile(path.join(values.out, `municipal-acts-${today}.json`), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(values.out, `municipal-acts-${today}.md`), `${markdown(report)}\n`);
  const code = errors.length ? 20 : fresh.some(act => ['new', 'downloaded'].includes(act.status)) || superseded.length ? 10 : 0;
  console.log(JSON.stringify({ today, municipalities: councils.size, selected: keep.length, new: fresh.length,
    downloaded: fresh.filter(act => act.status === 'downloaded').length, superseded: superseded.length, errors: errors.length, exit: code }));
  process.exitCode = code;
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'municipal_acts_failed' }));
  process.exitCode = 1;
}
