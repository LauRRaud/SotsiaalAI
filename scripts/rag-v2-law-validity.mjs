#!/usr/bin/env node
// The legal texts of the active corpus against Riigi Teataja (ADR-038). Reads public data only; changes nothing.
//   manifest --store S --tenant T --policy P --input-root Andmebaasi --out docs/rag-v2/legal-acts-in-index.json
//     The acts the index serves: document and version, Riigi Teataja act id and consolidated-text group, title,
//     issuer, regions and the validity they were indexed with. Written when a corpus version is published.
//   check --manifest M --out DIR [--today YYYY-MM-DD] [--horizon-days 400] [--download DIR]
//     For every group: the validity Riigi Teataja states now for each indexed act, every published version of the
//     group (all result pages), gaps and overlaps from today to the horizon (as Riigi Teataja publishes them and as the
//     corpus has them), versions missing from the corpus, and for a group that ends, replacing acts to review.
//     Writes law-validity-<today>.json and .md. Exit 0: unchanged; 10: findings or items to review; 20: a request
//     failed after retries (its group is reported as fetch_failed, never as unchanged).
//     --download puts the missing versions' XML in DIR for the usual register, ingest and index path.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { addDays, analyseGroup, coverage, exitCode, groupStatus, isoDay } from '../lib/rag-v2/law-validity.js';

const BASE = process.env.RAG_V2_RT_BASE || 'https://www.riigiteataja.ee';
const PAGE = 500, MAX_PAGES = 30, ROUNDS = 8, PAUSE_MS = Number(process.env.RAG_V2_RT_PAUSE_MS ?? 200);
const pause = () => new Promise(resolve => setTimeout(resolve, PAUSE_MS));
const tag = (xml, name) => (xml.match(new RegExp(`<${name}[^>]*>([^<]*)</${name}>`)) || [])[1]?.trim() ?? null;

/** GET with three attempts for network errors, timeouts and 5xx; a 404 is an answer, not a failure. */
async function get(url, errors, { json = false } = {}) {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), headers: { 'user-agent': 'sotsiaalai-rag-v2-law-validity' } });
      await pause();
      if (response.status === 404) return null;
      if (response.ok) return json ? await response.json() : await response.text();
      last = `http_${response.status}`;
      if (response.status < 500) break;
    } catch (error) { last = error?.name === 'TimeoutError' ? 'timeout' : error instanceof SyntaxError ? 'invalid_json' : 'network'; }
    await new Promise(resolve => setTimeout(resolve, attempt * 1000));
  }
  errors.push({ url: url.replace(BASE, ''), error: last });
  return undefined;
}
// A repeal stub: the group's last version with an empty body and the mark "Kehtetu" naming the repealing act.
const REPEAL = /<muutmismarge[^>]*>\s*<tavatekst[^>]*>\s*Kehtetu\s*<\/tavatekst>[\s\S]*?<aktViide[^>]*>([^<]*)<\/aktViide>/;
/** The consolidated text as Riigi Teataja serves it now. */
async function currentText(id, errors) {
  const xml = await get(`${BASE}/et/akt/${id}.xml`, errors);
  if (xml === undefined) return undefined;
  if (xml === null) return null;
  const repeal = /<sisu[^>]*\/>/.test(xml) ? xml.match(REPEAL) : null;
  return { from: isoDay(tag(xml, 'kehtivuseAlgus')), to: isoDay(tag(xml, 'kehtivuseLopp')), group: tag(xml, 'terviktekstiGrupiID'),
    title: tag(xml, 'pealkiri'), issuer: tag(xml, 'valjaandja'), kind: tag(xml, 'tekstiliik'), paragraphs: (xml.match(/<paragrahv[ >]/g) || []).length,
    repealed: Boolean(repeal), repealed_by: repeal?.[1].trim() || null };
}
/** Every act a search finds. Riigi Teataja orders a result set differently on each request, so its pages overlap and
 *  miss acts (27.09.2026: page 2 of 521 results repeated 20 acts of page 1): the pages are fetched again until the
 *  distinct acts reach the reported total. undefined when a request failed; `complete: false` when they never did.
 *  Each search runs once per check. */
const searches = new Map();
async function search(query, errors) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value)).toString();
  if (searches.has(params)) return searches.get(params);
  const acts = new Map();
  let total = Infinity;
  for (let round = 1; round <= ROUNDS && acts.size < total; round++) {
    for (let page = 1; (page - 1) * PAGE < total && page <= MAX_PAGES; page++) {
      const result = await get(`${BASE}/api/oigusakt_otsing/1/otsi?${params}&leht=${page}&limiit=${PAGE}`, errors, { json: true });
      if (result === undefined) return undefined;
      total = result?.metaandmed?.kokku ?? 0;
      for (const act of result?.aktid || []) acts.set(String(act.globaalID), act);
    }
  }
  const found = { query: params, acts: [...acts.values()], total, complete: acts.size >= total };
  searches.set(params, found);
  return found;
}
const published = act => act.mitteJoustunud === false && /terviktekst/.test(act.tekst || '');
const version = act => ({ globaal_id: String(act.globaalID), group: String(act.terviktekstID), title: act.pealkiri, issuer: act.valjaandja,
  from: isoDay(act.kehtivus?.algus), to: isoDay(act.kehtivus?.lopp) });
const firstWord = title => title.trim().split(/\s+/)[0];
// The title search matches words and prefixes but misses some acts by their full title (Tallinn's "Sotsiaalteenuste
// osutamise tingimused ja kord"), so the group is looked up by issuer and first word first; the full title without the
// issuer covers a renamed issuer.
const groupQueries = ({ title, issuer }) => [{ valjaandja: issuer, pealkiri: firstWord(title) }, { valjaandja: issuer, pealkiri: title }, { pealkiri: title }]
  .filter(query => query.pealkiri && (query.valjaandja || !('valjaandja' in query)));
// Words for acts of the same issuer that may replace an ending group (a replacing act usually has a new group).
const REPLACEMENT_WORDS = ['sotsiaal', 'toetus', 'teenus', 'hoolekan', 'abi'];

/** The group's published versions: from the first complete search that finds it, else from every search that did,
 *  marked incomplete (a result that cannot be trusted is a failure, never "unchanged"). */
async function groupVersions(group, acts, errors) {
  const members = new Map();
  let incomplete = false;
  for (const query of groupQueries(acts[0])) {
    const found = await search(query, errors);
    if (found === undefined) return undefined;
    const matching = found.acts.filter(act => String(act.terviktekstID) === group && published(act));
    for (const act of matching) members.set(String(act.globaalID), version(act));
    if (matching.length && found.complete) return { members: [...members.values()], searched: true };
    if (!found.complete) incomplete = true;
  }
  if (incomplete) errors.push({ url: `/api/oigusakt_otsing (group ${group})`, error: 'incomplete_results' });
  return { members: [...members.values()], searched: members.size > 0 };
}

async function checkGroup(group, acts, { today, horizon, indexed }) {
  const errors = [], current = {};
  for (const act of acts) {
    const now = await currentText(act.globaal_id, errors);
    if (now) current[act.globaal_id] = now;
    else if (now === null) errors.push({ url: `/et/akt/${act.globaal_id}.xml`, error: 'not_found' });
  }
  // An act without a consolidated-text group (an amending act as first published) is its own only version.
  const found = group.startsWith('act:')
    ? { members: acts.filter(a => current[a.globaal_id]).map(a => ({ globaal_id: a.globaal_id, from: current[a.globaal_id].from, to: current[a.globaal_id].to })), searched: true }
    : await groupVersions(group, acts, errors) ?? { members: [], searched: false };
  const members = new Map(found.members.map(v => [v.globaal_id, v]));
  // Published versions the corpus lacks: a text to add, or the repeal stub that ends the group.
  for (const v of members.values()) {
    if (indexed.has(v.globaal_id) || (v.to ?? '9999-12-31') < today || v.from > horizon) continue;
    const text = await currentText(v.globaal_id, errors);
    if (text?.repealed) Object.assign(v, { repealed: true, repealed_by: text.repealed_by, repealed_by_in_corpus: indexed.has(text.repealed_by) });
  }
  const replacements = [];
  const endsOn = () => coverage([...members.values()].filter(v => !v.repealed).map(v => ({ id: v.globaal_id, from: v.from, to: v.to })), { from: today, to: horizon }).ends_on;
  const replacedByStub = [...members.values()].some(v => v.repealed && v.repealed_by_in_corpus);
  if (found.searched && endsOn() && !replacedByStub && acts[0].issuer) {
    // The same issuer's social acts: versions of the group under a changed title, and acts starting near its end as
    // replacement candidates. Only candidates: a person decides (a repeal stub has ~0 paragraphs).
    const pool = new Map();
    for (const word of [firstWord(acts[0].title), ...REPLACEMENT_WORDS]) {
      const result = await search({ valjaandja: acts[0].issuer, pealkiri: word }, errors);
      if (result && !result.complete) errors.push({ url: `/api/oigusakt_otsing?${result.query}`, error: 'incomplete_results' });
      for (const act of result?.acts || []) {
        if (!published(act)) continue;
        if (String(act.terviktekstID) === group) members.set(String(act.globaalID), version(act));
        else pool.set(String(act.globaalID), version(act));
      }
    }
    const ends = endsOn();
    for (const candidate of ends ? pool.values() : []) {
      if (!candidate.from || candidate.from < addDays(ends, -3) || candidate.from > addDays(ends, 10)) continue;
      const inCorpus = indexed.has(candidate.globaal_id);
      const text = inCorpus ? null : await currentText(candidate.globaal_id, errors);
      replacements.push({ ...candidate, in_corpus: inCorpus, paragraphs: inCorpus ? undefined : text?.paragraphs ?? null });
    }
  }
  const versions = [...members.values()].sort((a, b) => a.from.localeCompare(b.from));
  const result = analyseGroup({ group, corpus: acts, current, published: versions, searched: found.searched, today, horizon, replacements });
  return { ...result, title: acts[0].title, issuer: acts[0].issuer, regions: acts[0].regions, corpus: acts.map(a => a.globaal_id), errors,
    published: versions.map(v => `${v.globaal_id} ${v.from}..${v.to ?? 'open'}${v.repealed ? ` kehtetuks (${v.repealed_by ?? '?'})` : ''}`) };
}

function markdown(report) {
  const lines = [`# Õigusaktide kehtivuse kontroll ${report.today}`, '',
    `Kontrollitud ${report.groups.length} akti gruppi (${report.acts} indekseeritud teksti), vaatehorisont kuni ${report.horizon}. ` +
    `Manifest: ${report.manifest.store_generation ?? '?'} (${report.manifest.generated_at ?? '?'}).`, '',
    '| Olek | Gruppe |', '|---|---:|', ...Object.entries(report.summary).map(([state, count]) => `| ${state} | ${count} |`), ''];
  // Published versions from half a year back: the ones the findings are about.
  const recent = entry => (entry.split('..')[1] === 'open' || entry.split('..')[1] >= addDays(report.today, -180));
  for (const group of report.groups.filter(g => g.status !== 'unchanged' || g.notes.length)) {
    lines.push(`## ${group.title}${group.regions?.length ? ` (${group.regions.join(', ')})` : ''} — ${group.status}`, '',
      `Grupp ${group.group}; korpuses ${group.corpus.join(', ')}; RT avaldatud (alates ${addDays(report.today, -180)}): ${group.published.filter(recent).join('; ') || '—'}`, '');
    for (const f of group.findings) lines.push(`- **${f.kind}** ${JSON.stringify(Object.fromEntries(Object.entries(f).filter(([k]) => k !== 'kind')))}`);
    for (const r of group.review) lines.push(`- ülevaatus: ${r.kind} ${JSON.stringify(Object.fromEntries(Object.entries(r).filter(([k]) => k !== 'kind')))}`);
    for (const n of group.notes) lines.push(`- märkus: ${n.kind} ${JSON.stringify(Object.fromEntries(Object.entries(n).filter(([k]) => k !== 'kind')))}`);
    for (const e of group.errors) lines.push(`- päringu tõrge: ${e.error} ${e.url}`);
    lines.push('');
  }
  return lines.join('\n');
}

async function buildManifest(values) {
  const { readActive } = await import('../lib/rag-v2/catalog.js');
  const { id } = await import('../lib/rag-v2/contracts.js');
  const tenantDir = path.resolve(values.store, id('tenant', values.tenant)), active = await readActive(tenantDir);
  const policy = JSON.parse(await fs.readFile(values.policy, 'utf8'));
  const allowed = new Set(Object.values(policy.tenants?.[values.tenant] || {}).flat());
  const acts = [];
  for (const [documentId, ref] of Object.entries(active.documents).sort()) {
    if (!allowed.has(documentId)) continue;
    const bundle = JSON.parse(await fs.readFile(path.join(tenantDir, 'versions', ref.version_id, 'bundle.json'), 'utf8'));
    const F = bundle.document.fields, source = bundle.document.legacy_metadata?.source_path || bundle.version.metadata?.source_path || F.source_path?.value;
    if (F.source_type?.value !== 'legal_act' || !/\.(xml|akt)$/.test(source || '')) continue;
    const xml = await fs.readFile(path.join(values['input-root'], source), 'utf8');
    acts.push({ document_id: documentId, version_id: ref.version_id, globaal_id: tag(xml, 'globaalID'), group: tag(xml, 'terviktekstiGrupiID'),
      title: F.title.value, issuer: tag(xml, 'valjaandja'), regions: F.regions?.value || [], source_path: source,
      index_from: isoDay(F.valid_from?.value), index_to: isoDay(F.valid_to?.value) });
  }
  return { schema_version: 'rag-v2/legal-acts-in-index-1', generated_at: new Date().toISOString(), tenant: values.tenant,
    store_generation: active.generation, policy_documents: allowed.size, acts };
}

try {
  const [mode, ...rest] = process.argv.slice(2);
  const { values } = parseArgs({ args: rest, options: { store: { type: 'string' }, tenant: { type: 'string', default: 'sotsiaalai-corpus' },
    policy: { type: 'string' }, 'input-root': { type: 'string', default: 'Andmebaasi' }, out: { type: 'string' }, manifest: { type: 'string' },
    today: { type: 'string' }, 'horizon-days': { type: 'string', default: '400' }, download: { type: 'string' } } });
  if (mode === 'manifest') {
    if (!values.store || !values.policy || !values.out) throw Object.assign(new Error('usage'), { code: 'law_validity_usage' });
    const manifest = await buildManifest(values);
    await fs.writeFile(values.out, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(JSON.stringify({ acts: manifest.acts.length, store_generation: manifest.store_generation }));
  } else if (mode === 'check') {
    if (!values.manifest || !values.out) throw Object.assign(new Error('usage'), { code: 'law_validity_usage' });
    const manifest = JSON.parse(await fs.readFile(values.manifest, 'utf8'));
    const today = values.today || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
    const horizon = addDays(today, Number(values['horizon-days']));
    const byGroup = new Map();
    for (const act of manifest.acts) {
      const key = act.group || `act:${act.globaal_id}`;
      if (!byGroup.has(key)) byGroup.set(key, []);
      byGroup.get(key).push(act);
    }
    const groups = [], indexed = new Set(manifest.acts.map(act => act.globaal_id));
    for (const [group, acts] of byGroup) {
      const result = await checkGroup(group, acts, { today, horizon, indexed });
      groups.push({ ...result, status: groupStatus(result) });
    }
    const summary = {};
    for (const group of groups) summary[group.status] = (summary[group.status] || 0) + 1;
    const report = { schema_version: 'rag-v2/law-validity-report-1', today, horizon, acts: manifest.acts.length,
      manifest: { store_generation: manifest.store_generation, generated_at: manifest.generated_at }, summary, groups };
    await fs.mkdir(values.out, { recursive: true });
    await fs.writeFile(path.join(values.out, `law-validity-${today}.json`), `${JSON.stringify(report, null, 2)}\n`);
    await fs.writeFile(path.join(values.out, `law-validity-${today}.md`), `${markdown(report)}\n`);
    if (values.download) {
      await fs.mkdir(values.download, { recursive: true });
      for (const group of groups) for (const finding of group.findings.filter(f => f.kind === 'missing_version')) {
        const xml = await get(`${BASE}/et/akt/${finding.globaal_id}.xml`, group.errors);
        if (xml) await fs.writeFile(path.join(values.download, `${finding.globaal_id}.xml`), xml);
      }
    }
    const code = exitCode(groups);
    console.log(JSON.stringify({ today, groups: groups.length, summary, exit: code }));
    process.exitCode = code;
  } else throw Object.assign(new Error('usage'), { code: 'law_validity_usage' });
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: typeof error.code === 'string' && /^[a-z][a-z0-9_]+$/.test(error.code) ? error.code : 'law_validity_failed' }));
  process.exitCode = 1;
}
