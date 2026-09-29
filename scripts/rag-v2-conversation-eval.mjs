#!/usr/bin/env node
// Whole conversations on the live chat plan (tests/evaluation/dialogue/scenarios-corpus-4.json): each scenario in its own
// conversation of the plan's first user ("Hindamine <id>", visible in the chat), every turn through the real service, so
// search, model and checks are the production ones. Paid: the plan's model and ledger; --max-usd stops the run before
// a scenario would start above it. The report names for every turn what failed: search, answer or state.
//   sudo -n node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-conversation-eval.mjs --out /home/ubuntu/rag-v2-work/eval-files/conversations-<day> [--only id,id] [--max-usd 1.5]
//   --dry-run checks the catalogue and prints the turns; no model call, no database write.
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { checkTurn, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

const { values } = parseArgs({ options: { scenarios: { type: 'string', default: 'tests/evaluation/dialogue/scenarios-corpus-4.json' }, out: { type: 'string' },
  only: { type: 'string' }, 'max-usd': { type: 'string', default: '1.5' }, 'dry-run': { type: 'boolean', default: false },
  legal: { type: 'string', default: 'docs/rag-v2/legal-acts-in-index.json' } } });
const catalogue = JSON.parse(await fs.readFile(values.scenarios, 'utf8'));
const problems = validateCatalogue(catalogue);
if (problems.length) { console.error(JSON.stringify({ ok: false, problems })); process.exit(1); }
const only = values.only ? new Set(values.only.split(',')) : null;
const scenarios = catalogue.scenarios.filter(scenario => !only || only.has(scenario.id));
if (values['dry-run']) {
  console.log(JSON.stringify({ ok: true, scenarios: scenarios.length, turns: scenarios.reduce((n, s) => n + s.turns.length, 0) }));
  process.exit(0);
}
if (!values.out) { console.error(JSON.stringify({ ok: false, code: 'out_required' })); process.exit(1); }

const { default: prisma } = await import('../lib/prisma.js');
const { readPilotConfig } = await import('../lib/rag-v2/pilot/config.js');
const { PilotStore } = await import('../lib/rag-v2/pilot/store.js');
const { PilotService } = await import('../lib/rag-v2/pilot/service.js');
const { runtimeAdapters } = await import('../lib/rag-v2/pilot/retrieval.js');
const { municipalDirectoryAdapter } = await import('../lib/rag-v2/adapters/municipal-directory.js');
const { pilotExpiry } = await import('../lib/rag-v2/pilot/lifetime.js');
const { renderAnswer } = await import('../lib/rag-v2/pilot/presentation.js');
const { detectCrisis } = await import('../lib/chat/safety.js');
const { focusRegion } = await import('../lib/rag-v2/pilot/record-scope.js');

const plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8'));
const userId = plan.users[0];
const readConfig = options => readPilotConfig(userId, options);
const config = await readConfig({ purpose: 'execute' });
const service = new PilotService({ store: new PilotStore(prisma), readConfig, adapters: runtimeAdapters(readConfig, userId, municipalDirectoryAdapter(prisma)) });
const legal = new Map(JSON.parse(await fs.readFile(values.legal, 'utf8')).acts.filter(act => !act.regions.length)
  .map(act => [act.document_id, { from: act.index_from, to: act.index_to }]));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
const titleOf = entry => entry.fields?.title?.value || entry.fields?.name?.value || '';
const maxUsd = Number(values['max-usd']);

// What a turn produced, from its saved row: the model's input (the catalogue and the dialogue), the evidence packet and
// the published or rejected answer. No question or answer leaves the server except in this report.
function observe(row, error) {
  const payload = row?.payload || {};
  let input = {};
  try { input = JSON.parse(payload.requestAudit?.body?.input?.[0]?.content || '{}'); } catch { /* no answer request was made */ }
  const records = input.evidence?.records || {}, entries = records.entries || [];
  const packet = payload.packet || { evidence: [], reference_map: {} };
  const byEvidence = new Map(packet.evidence.map(evidence => [evidence.evidence_id, evidence]));
  const answer = payload.answer || null;
  const refs = new Set(answer ? answer.blocks.flatMap(block => block.refs) : []);
  const cited = [...refs].map(ref => packet.reference_map[ref]).filter(Boolean)
    .map(binding => ({ title: byEvidence.get(binding.evidence_id)?.bibliography?.title || '', documentId: binding.document_id, version: binding.document_version_id }));
  const text = answer ? renderAnswer(answer, payload.answerVersion || 'm4-text-refs-1') : '';
  const events = payload.events || [];
  return {
    state: row?.state || 'missing', error: error || payload.error || null, crisis: detectCrisis(payload.question || ''),
    region: records.scope?.region ?? null, previousStateCleared: input.dialogue ? input.dialogue.previousState === null : null,
    summaries: entries.filter(entry => entry.fields?.summary && entry.detail !== 'selected_detail').map(titleOf),
    details: entries.filter(entry => entry.detail === 'selected_detail').map(titleOf),
    contacts: entries.filter(entry => entry.kind === 'contact').length,
    evidenceTitles: [...new Set(packet.evidence.map(evidence => evidence.bibliography?.title || ''))],
    found: [...new Map(packet.evidence.map(evidence => [evidence.document_id, { title: evidence.bibliography?.title || '', documentId: evidence.document_id }])).values()],
    cited: [...new Map(cited.map(source => [source.documentId, source])).values()],
    text, kind: answer?.kind ?? null, clarification: Boolean(answer?.clarification) || answer?.kind === 'clarification',
    stateRegion: payload.dialogueState?.value ? focusRegion(payload.dialogueState.value)?.id ?? null : null,
    person: payload.searchAssist?.person ?? null, scopePerson: records.scope?.person ?? null,
    // State v4 never falls back as a whole; a missing model state is its own drop (ADR-051).
    stateFallback: payload.dialogueStateFallback?.code ?? (payload.dialogueState?.value?.model?.accepted === false ? 'state_missing' : null),
    stateDropped: payload.dialogueState?.value?.model?.dropped?.map(item => item.reason) ?? [],
    personRegions: Object.fromEntries((payload.dialogueState?.value?.people || []).map(entry => [entry.person.trim().toLowerCase(), entry.region.id])),
    timings: { searched: payload.timings?.phases?.searched ?? null, answered: payload.timings?.phases?.answered ?? null,
      search: payload.timings?.search?.since_start_ms?.merged ?? null, total: payload.timings?.validatedDraftMs ?? null },
    usd: events.reduce((sum, event) => sum + (event.estimatedNanoUsd || 0), 0) / 1e9,
    // The search plan and the rerank's candidates and choice: why a search check failed, read before the run's
    // conversations are deleted.
    queries: payload.searchAssist?.queries ?? [],
    rerank: rerankOf(payload.searchAssist?.rerank),
  };
}
function rerankOf(rerank) {
  if (!rerank) return null;
  const title = id => rerank.candidates.find(candidate => candidate.id === id)?.title || id;
  return { candidates: rerank.candidates.map(candidate => candidate.title), selected: rerank.selected.map(title) };
}

await fs.mkdir(values.out, { recursive: true });
const report = { schema_version: 'rag-v2/conversation-eval-report-1', started_at: new Date().toISOString(), today, plan: config.id,
  generation: config.generationId, model: config.model, reasoning: config.reasoning, catalogue: values.scenarios, scenarios: [] };
let spent = 0;
try {
  for (const scenario of scenarios) {
    if (spent >= maxUsd) { report.stopped = `cost ${spent.toFixed(4)} USD reached --max-usd ${maxUsd}`; break; }
    const conversation = await prisma.conversation.create({ data: { userId, role: 'CLIENT', title: `Hindamine ${scenario.id}`, metadata: { m4: true },
      expiresAt: pilotExpiry(config) } });
    const turns = [];
    for (const turn of scenario.turns) {
      let result = null, error = null;
      try { result = await service.run(userId, { question: turn.text, contextMode: turn.mode, convId: conversation.id, clientTurnKey: randomUUID(), language: 'et' }); }
      catch (failure) { error = failure.code || 'turn_failed'; result = failure.pilotTurnId ? { id: failure.pilotTurnId } : null; }
      const row = result?.id ? await prisma.m4PilotTurn.findUnique({ where: { id: result.id } }) : null;
      const observed = observe(row, error);
      spent += observed.usd;
      turns.push({ mode: turn.mode, text: turn.text, expect: turn.expect || {}, note: turn.note, turn_id: row?.id ?? null, observed,
        ...checkTurn(turn.expect, observed, { today, validity: id => legal.get(id) || null }) });
      console.error(JSON.stringify({ scenario: scenario.id, turn: turns.length, verdict: turns.at(-1).verdict, usd: +spent.toFixed(4) }));
    }
    report.scenarios.push({ id: scenario.id, title: scenario.title, source: scenario.source, conversation: conversation.id, turns });
  }
} finally {
  report.finished_at = new Date().toISOString();
  report.estimated_usd = +spent.toFixed(4);
  const all = report.scenarios.flatMap(scenario => scenario.turns);
  report.summary = Object.fromEntries(['passed', 'search', 'answer', 'state'].map(verdict => [verdict, all.filter(turn => turn.verdict === verdict).length]));
  // Rejected model states are counted on every run, expected or not: a lost state hides behind a right catalogue.
  report.states = { continuing: all.filter(turn => turn.observed?.previousStateCleared === false).length,
    rejected: all.filter(turn => turn.observed?.stateFallback).length };
  await fs.writeFile(path.join(values.out, 'conversation-eval.json'), `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(path.join(values.out, 'conversation-eval.md'), `${markdown(report)}\n`);
  await prisma.$disconnect();
}
console.log(JSON.stringify({ summary: report.summary, states: report.states, estimated_usd: report.estimated_usd, stopped: report.stopped || null }));
process.exit(0);

function markdown(r) {
  const lines = [`# Vestluste hindamine ${r.today}`, '', `Plaan ${r.plan}, indeks ${r.generation}, mudel ${r.model} (${r.reasoning}). `
    + `Kulu plaani hinnatabeli järgi (hinnang) ${r.estimated_usd} USD.${r.stopped ? ` Peatatud: ${r.stopped}.` : ''}`, '',
  `Jätkupöördeid ${r.states?.continuing ?? '-'}, neist mudeli uus olek tagasi lükatud ${r.states?.rejected ?? '-'}.`, '',
  '| Tulemus | Pöördeid |', '|---|---:|', ...Object.entries(r.summary).map(([verdict, n]) => `| ${verdict} | ${n} |`), ''];
  for (const scenario of r.scenarios) {
    lines.push(`## ${scenario.title} (\`${scenario.id}\`)`, '', `Allikas: ${scenario.source}. Vestlus: \`${scenario.conversation}\`.`, '');
    for (const [index, turn] of scenario.turns.entries()) {
      const o = turn.observed;
      lines.push(`### ${index + 1}. [${turn.mode}] ${turn.text} — **${turn.verdict}**`, '');
      if (turn.note) lines.push(`_${turn.note}_`, '');
      lines.push(`- Piirkond ${o.region ?? '-'} (olek ${o.stateRegion ?? '-'}), vastuse liik ${o.kind ?? '-'}, täpsustus ${o.clarification}; otsing ${o.timings.search ?? '-'} ms, kokku ${o.timings.total ?? '-'} ms, ${o.usd.toFixed(4)} USD`);
      lines.push(`- Leitud allikad (${o.evidenceTitles.length}): ${o.evidenceTitles.slice(0, 12).join('; ') || '-'}${o.evidenceTitles.length > 12 ? ' …' : ''}`);
      lines.push(`- Viidatud: ${o.cited.map(source => source.title).join('; ') || '-'}`);
      if (turn.verdict === 'search' && o.queries) {
        lines.push(`- Otsinguplaan: ${o.queries.join(' | ') || '-'}`);
        if (o.rerank) lines.push(`- Rerank valis ${o.rerank.selected.length}/${o.rerank.candidates.length}: ${o.rerank.selected.join('; ') || '-'}`,
          `- Rerank'i kandidaadid: ${[...new Set(o.rerank.candidates)].join('; ')}`);
      }
      for (const check of turn.checks) lines.push(`- ${check.ok ? 'OK' : '**VIGA**'} ${check.kind}/${check.key}: ${check.detail}`);
      lines.push('', '> ' + (o.text || `(vastust pole: ${o.error || o.state})`).replace(/\n/g, '\n> '), '');
    }
  }
  // No trailing spaces: an empty quoted line is a bare '>'.
  return lines.join('\n').replace(/[ \t]+$/gm, '').replace(/\n+$/, '');
}
