// No new retrieval: all inputs below are private immutable files and evaluator-only proposals.
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { parseArgs } from 'node:util';
import { hash, fail } from '../lib/rag-v2/contracts.js';
import { readJson } from '../lib/rag-v2/catalog.js';
import { loadSnapshot } from '../lib/rag-v2/search/snapshot.js';
import { verifyInputs, prepareRubric, verifyRubric, makeReviewPacket, regrade, digest } from '../lib/rag-v2/evaluation/rubric-v2.js';
import { rubricProposal } from './lib/rag-v2-rubric-proposal.mjs';

let networkAttempts = 0;
const denyNetwork = () => { networkAttempts++; fail('regrade_network_forbidden'); };
globalThis.fetch = denyNetwork;
net.Socket.prototype.connect = denyNetwork;
http.request = denyNetwork; http.get = denyNetwork; https.request = denyNetwork; https.get = denyNetwork;

const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const pre = value => `<pre>${escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2))}</pre>`;
const reviewInstructions = `# M2.3 rubriigi v2 ülevaatus

Otsingut ei muudetud. See pakett hindab salvestatud valikuid retrospektiivselt.

1. Ava review.html. Esmalt on perekondade sisulised nõuded, seejärel meetodita kontekstid.
2. Vaata üle rubric-v2.json definitsioonid ning iga nõude tõenduskomplektid. Komplekti all liikmed on JA; sama nõude komplektid on VÕI. Full ja partial on siin Codexi ettepanekud.
3. Märgi review-decisions.json vastavad definition: ja mapping: kirjed. Kinnitamisel täida state=approved, reviewed_by tegeliku inimese nime ja rolliga owner või human_reviewer, reviewed_at tegeliku aja, reason põhjenduse ning basis tegeliku ülevaatuse/volituse viitega. Tagasilükkamine kasutab rejected ja samu päritoluvälju. Pending jätab hinnangu lahtiseks. Ära muuda content_sha256 ega bindings välju otsuse kinnitamiseks.
4. Corpus: kirjes märgi iga nõude tugi valitud korpuses. Puuduvate vastenduste nimekirjast ei järeldu automaatselt corpus absent. Full eeldab kinnitatud allikakomplekti.
5. Context_ kirjes kinnita kogu kuvatud konteksti ülevaatus exhaustive=true ning contradiction=none/present/needs_review. No_other_support_for loetleb nõuded, millele peale rubriigis vastendatud toe ei leitud muud või tugevamat tuge. See on sisuline otsus: tühi nimekiri ei luba kinnitamata puudumist absent-iks nimetada.
6. Uue allikakomplekti või nõude korral muuda rubriiki ja genereeri uus ülevaatuspakett. Muudetud rubriigiga vanad otsused ei kehti; räside käsitsi ülekirjutamine pole heakskiit.
7. Kordushindamiseks anna samale skriptile --rubric ja --decisions ning uus privaatne --output kaust. Originaalid jäävad muutmata.

Otsusefail on usaldatud kohaliku ülevaatuse kirje, mitte inimese autentimissüsteem ega digitaalallkiri. Codex ei tohi selles oma ettepanekuid inimese nimel kinnitada. Kõik algsed kirjed on pending ja reviewed_by=null.

Regrade-results.json säilitab iga v1 rea koos algse teksti, järjestuse ja tokeniarvestusega. Report.html sisaldab meetodipõhist koondit; seda ei näidata enne sisulist ülevaatust. Review.html ja review-packet.json peidavad meetodi nime, skoori ja järjestuse. Varasem kokkupuude tulemustega tähendab siiski, et ülevaatus pole puutumatu katse.
`;
const shell = (title, body) => `<!doctype html><html lang="et"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${escape(title)}</title><style>body{font:16px/1.6 system-ui;max-width:1150px;margin:32px auto;padding:0 20px;color:#243733;background:#fafaf5}h1,h2,h3{line-height:1.25}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:14px/1.6 ui-monospace,monospace;background:#eff1eb;padding:12px}details{margin:14px 0;border:1px solid #ccd6ce;padding:12px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ccd6ce;padding:8px;text-align:left;vertical-align:top}small{overflow-wrap:anywhere}a{color:#135b45}</style><h1>${escape(title)}</h1>${body}</html>`;

function blindHtml(packet) {
  let body = `<p>${escape(packet.notice)}</p><p>Rubriik ja vastendused on Codexi ettepanekud. Omaniku või sisulise ülevaataja kinnitusi pole eeldatud. Iga nõude tõenduskomplekti sees kehtib JA, komplektide vahel VÕI.</p><p>Otsused sisesta faili review-decisions.json. Kinnita kõigepealt pere definitsioon ja vastendused, seejärel konteksti täielik ülevaatus. Sobiva uue alternatiivi korral tuleb see esmalt lisada rubriiki; pelk konteksti heakskiit ei loo uut vastendust.</p><p>Vaate allikajärjekord on tehniliselt kanoniseeritud; otsingu algne järjekord säilib masinraportis.</p>`;
  for (const [familyId, family] of Object.entries(packet.rubric.families)) {
    body += `<details><summary>${escape(familyId)} — nõuete ja allikate ettepanek</summary><p>${escape(family.scope)}</p><p>Valikuline: ${escape(family.optional)}</p>`;
    for (const req of family.requirements) {
      body += `<h3>${escape(req.id)}: ${escape(req.meaning)}</h3><p>${escape(req.scope)}</p><p>${escape(req.corpus_note)}</p>`;
      for (const set of req.evidence_sets) body += `<details><summary>${escape(set.id)} — ${escape(set.support)} (ettepanek)</summary><p>${escape(set.rationale)}</p>${set.all.map(atom => `<h4>${escape(atom.title)}${atom.pdf_page ? ` · PDF lk ${atom.pdf_page}` : ' · bibliograafia'}</h4>${pre(atom)}`).join('')}</details>`;
    }
    body += '</details>';
  }
  body += '<h2>Kontekstid sisuliseks ülevaatuseks</h2>';
  for (const c of packet.contexts) {
    body += `<details><summary>${escape(c.family)} · ${escape(c.id.slice(-12))}</summary><small>${escape(c.id)}</small>${c.questions.map(q => `<p>${escape(q.language)}: ${escape(q.text)}</p>`).join('')}`;
    if (!c.context.length) body += '<p>Valitud kontekst on tühi.</p>';
    for (const e of c.context) body += `<h3>${escape(e.bibliography.title)} · PDF lk ${e.pdf_pages.join(', ')}</h3>${pre(e.text)}<details><summary>Allika päritolu</summary>${pre({ ...e, text: undefined })}</details>`;
    body += '</details>';
  }
  return shell('M2.3 sisulise ülevaatuse pakett', body);
}
function reportHtml(result) {
  return shell('M2.3 v1 → v2 kordushindamine', `<p>${escape(result.notice)}</p><p>Analüüs on retrospektiivne. Ootel vastenduse tekstiline leidumine ei ole kinnitatud sisuline tugi. Protsenti ei arvutata lahendamata ridu välja jättes.</p>${pre(result.summary)}<p><a href="review.html">Ava meetodite nimedeta ülevaatuspakett</a></p><table><tr><th>Küsimus</th><th>Meetod</th><th>V1</th><th>V2</th><th>Muutuse liik</th><th>Tokenid (säilitatud)</th></tr>${result.rows.map(r => `<tr><td>${escape(r.question_id)}</td><td>${escape(r.method)}</td><td>${escape(r.v1.outcome)}</td><td>${escape(r.v2.status)}</td><td>${escape(r.difference)}</td><td>${r.preserved_tokens}</td></tr>`).join('')}</table><h2>Nõuete kaupa</h2>${result.rows.map(r => `<details><summary>${escape(r.question_id)} · ${escape(r.method)}</summary><small>${escape(r.review_context_id)}</small>${pre(r.v2)}</details>`).join('')}`);
}

try {
  const { values: v } = parseArgs({ options: {
    results: { type: 'string', default: 'tmp/rag-v2-multi-source/server-real-9526a805-1/multi-source-v1-results.json' },
    questions: { type: 'string', default: 'tests/evaluation/multi-source/questions.json' },
    anchors: { type: 'string', default: 'tests/evaluation/multi-source/anchor-groups.json' },
    corpus: { type: 'string', default: 'tmp/rag-v2-multi-source/server-real-9526a805-1/corpus-manifest.json' },
    store: { type: 'string', default: 'tmp/rag-v2-multi-source/store' },
    rubric: { type: 'string' }, decisions: { type: 'string' }, output: { type: 'string' },
  } });
  if (!v.output) fail('output_required');
  const inputFiles = [v.results, v.questions, v.anchors, v.corpus, v.rubric, v.decisions].filter(Boolean).map(p => path.resolve(p));
  const before = await Promise.all(inputFiles.map(async p => ({ path: p, sha256: hash(await fs.readFile(p)) })));
  const [results, questions, groups, cm] = await Promise.all([v.results, v.questions, v.anchors, v.corpus].map(readJson));
  if (new Set(cm.documents.map(d => d.document_id)).size !== cm.documents.length) fail('duplicate_corpus_document');
  const snapshot = await loadSnapshot(v.store, cm.tenant, cm.documents.map(d => d.document_id));
  for (const doc of cm.documents) {
    const b = snapshot.bundles.find(b => b.document.id === doc.document_id);
    if (!b || b.version.id !== doc.version_id || b.version.pdf_hash !== doc.source_pdf_sha256
      || b.version.metadata_hash !== doc.metadata_sha256) fail('corpus_manifest_mismatch');
  }
  if (cm.snapshot_sha256 !== snapshot.snapshot_hash) fail('corpus_manifest_mismatch');
  const verification = verifyInputs(results, questions, snapshot, groups);
  const bindings = { source_payload_sha256: verification.payload_sha256, questions_sha256: verification.questions_sha256,
    v1_anchors_sha256: verification.anchors_sha256, corpus_snapshot_sha256: snapshot.snapshot_hash };
  const rubric = v.rubric ? await readJson(v.rubric) : prepareRubric(rubricProposal(), snapshot, bindings);
  verifyRubric(rubric, snapshot, bindings);
  const { packet, decisions } = makeReviewPacket(results, questions, snapshot, rubric);
  const review = v.decisions ? await readJson(v.decisions) : decisions;
  const result = regrade(results, questions, snapshot, rubric, review);
  const out = path.resolve(v.output), tmp = await fs.realpath('tmp');
  if (!out.startsWith(path.resolve('tmp') + path.sep)) fail('private_output_required');
  if (inputFiles.some(p => p === out || p.startsWith(out + path.sep))) fail('output_overlaps_input');
  await fs.mkdir(path.dirname(out), { recursive: true });
  const parent = await fs.realpath(path.dirname(out));
  if (parent !== tmp && !parent.startsWith(tmp + path.sep)) fail('private_output_required');
  await fs.mkdir(out, { recursive: false, mode: 0o700 });
  const write = async (name, data) => fs.writeFile(path.join(out, name), typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  for (const [name, data] of Object.entries({ 'rubric-v2.json': rubric, 'review-decisions.json': review,
    'review-packet.json': packet, 'regrade-results.json': result, 'review.html': blindHtml(packet), 'report.html': reportHtml(result),
    'README.md': reviewInstructions })) await write(name, data);
  for (const file of before) if (hash(await fs.readFile(file.path)) !== file.sha256) fail('source_file_changed_during_regrade');
  const manifest = { schema_version: 'rag-v2/regrade-run-2', created_at: new Date().toISOString(), retrospective: true,
    verification, inputs: before, rubric_sha256: digest(rubric), decisions_sha256: digest(review),
    distinct_review_contexts: packet.contexts.length, review_targets: Object.keys(review.decisions).length,
    network_attempts: networkAttempts, retrieval_calls: 0, source_files_unchanged: true, summary: result.summary };
  await write('run.json', manifest);
  console.log(JSON.stringify({ output: out, ...manifest }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ ok: false, code: error.code ?? error.message ?? 'regrade_failed' }));
  process.exitCode = 1;
}
