#!/usr/bin/env node
// Whole conversations on the live chat plan (tests/evaluation/dialogue/scenarios-corpus-4.json): each scenario in its own
// conversation of the plan's first user ("Hindamine <id>", visible in the chat), every turn through the real service, so
// search, model and checks are the production ones. Paid: the plan's model and ledger; --max-usd stops the run before
// a scenario would start above it. The report names for every turn what failed: search, answer or state.
// On the server it runs in the running release's directory with that release's env file: since 04.10.2026 the service
// no longer runs /home/ubuntu/apps/sotsiaalai, and frontend.env with rag.env are not what it reads. A release has no
// tests/ and no docs/rag-v2/, so the catalogue and the legal acts' manifest are given by path, as copies from the
// commit that is measured:
//   R=$(systemctl show -p WorkingDirectory --value sotsiaalai-frontend); cd $R
//   sudo -n node --env-file=/etc/sotsiaalai/releases/${R##*/}.env --import ./scripts/register-node-source-loader.mjs \
//     scripts/rag-v2-conversation-eval.mjs --scenarios <dir>/scenarios-corpus-4.json --legal <dir>/legal-acts-in-index.json \
//     --out /home/ubuntu/rag-v2-work/eval-files/conversations-<day> [--only id,id] [--max-usd 1.5]
//   --dry-run checks the catalogue and prints the turns; no model call, no database write.
//   --auto-modes sends what the chat sends since it has no topic choice (02.10.2026): 'new' for a conversation's first
//   message and 'same' for every later one, whatever mode the catalogue names; a turn's previous_state_cleared, which only
//   an explicit new person can meet, is then not checked.
//   The run reads the server's verified marks (ADR-069) and writes none: sources the server has checked are read at once
//   and this process starts no background warm-up of its own. --cold: no marks, every source verified here as before
//   (for a change to the checks themselves).
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { checkTurn, turnPassages, validateCatalogue } from '../lib/rag-v2/pilot/conversation-eval.js';

const { values } = parseArgs({ options: { scenarios: { type: 'string', default: 'tests/evaluation/dialogue/scenarios-corpus-4.json' }, out: { type: 'string' },
  only: { type: 'string' }, 'max-usd': { type: 'string', default: '1.5' }, 'dry-run': { type: 'boolean', default: false },
  // --stream: request the answer as a stream, as the chat does, so the first visible text is measured (Codex 7.8).
  stream: { type: 'boolean', default: false },
  'auto-modes': { type: 'boolean', default: false },
  // --warm: verify the knowledge sources before the first conversation, as the chat server does at its start (ADR-033),
  // so the search times are a warm server's and not this new process's (Codex 7.8).
  warm: { type: 'boolean', default: false },
  cold: { type: 'boolean', default: false },
  // --reasoning low|medium|high (ADR-092): every turn asks for this effort of the answer, as a user's choice in the chat
  // does; the plan must offer it (reasoningChoices). Without it the plan's own effort is used.
  reasoning: { type: 'string' },
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
const { PilotStore, openTurn } = await import('../lib/rag-v2/pilot/store.js');
const { PilotService } = await import('../lib/rag-v2/pilot/service.js');
const { runtimeAdapters } = await import('../lib/rag-v2/pilot/retrieval.js');
const { municipalDirectoryAdapter } = await import('../lib/rag-v2/adapters/municipal-directory.js');
const { pilotExpiry } = await import('../lib/rag-v2/pilot/lifetime.js');
const { renderAnswer } = await import('../lib/rag-v2/pilot/presentation.js');
const { detectCrisis } = await import('../lib/chat/safety.js');
const { focusRegion } = await import('../lib/rag-v2/pilot/record-scope.js');
const { tokenCount } = await import('../lib/rag-v2/search/embedding.js');

const plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8'));
const userId = plan.users[0];
const readConfig = options => readPilotConfig(userId, options);
const config = await readConfig({ purpose: 'execute' });
// An effort the plan does not offer would be refused turn by turn; say so before anything runs.
if (values.reasoning && !(config.reasoningChoices || []).includes(values.reasoning)) {
  console.error(JSON.stringify({ ok: false, problem: 'reasoning_not_offered', offered: config.reasoningChoices ?? null }));
  process.exit(1);
}
const { processCatalog } = await import('../lib/rag-v2/search/postgres.js');
// The server's marks, read only. Without them (--cold, no table, a failed read) the process verifies as before.
const verifiedMarks = values.cold ? 0 : await processCatalog(process.env.RAG_V2_POSTGRES_URL).inheritVerified({ keep: false }).catch(() => 0);
if (verifiedMarks && !values.warm) {
  // No warm-up of this process's own: the first turn would start one and the turns would compete with it.
  const generation = await processCatalog(process.env.RAG_V2_POSTGRES_URL).active(config.tenant);
  (globalThis[Symbol.for('sotsiaalai.rag-v2.warming')] ||= new Set()).add(generation.id);
}
console.error(JSON.stringify({ verified_marks: verifiedMarks }));
if (values.warm) {
  const { unifiedDirectory } = await import('../lib/rag-v2/search/unified.js');
  const postgres = processCatalog(process.env.RAG_V2_POSTGRES_URL), generation = await postgres.active(config.tenant);
  const documents = Object.keys(plan.documents).filter(doc => generation.snapshot.documents[doc]?.version_id === plan.documents[doc]);
  const groups = unifiedDirectory(await postgres.retrievalDirectory(config.tenant, generation, documents));
  const national = groups.nationalLaw.map(row => row.document_id), first = new Set(national);
  const knowledge = [...national, ...groups.knowledge.map(row => row.document_id).filter(doc => !first.has(doc))], started = performance.now();
  await postgres.warm(config.tenant, generation.id, knowledge);
  // The server's own warm-up keeps this mark per process and generation; set, the first turn does not start it again.
  (globalThis[Symbol.for('sotsiaalai.rag-v2.warming')] ||= new Set()).add(generation.id);
  console.error(JSON.stringify({ warmed: knowledge.length, seconds: Math.round((performance.now() - started) / 1000) }));
}
const service = new PilotService({ store: new PilotStore(prisma), readConfig, adapters: runtimeAdapters(readConfig, userId, municipalDirectoryAdapter(prisma)) });
const legal = new Map(JSON.parse(await fs.readFile(values.legal, 'utf8')).acts.filter(act => !act.regions.length)
  .map(act => [act.document_id, { from: act.index_from, to: act.index_to }]));
// Every indexed act's validity, a municipal one's too: which version of an act a source is (ADR-077).
const versions = new Map(JSON.parse(await fs.readFile(values.legal, 'utf8')).acts.map(act => [act.document_id, { from: act.index_from, to: act.index_to }]));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Tallinn' });
const titleOf = entry => entry.fields?.title?.value || entry.fields?.name?.value || '';
const maxUsd = Number(values['max-usd']);

// The answer request's parts in tokens (the search tokenizer, an estimate of the model's; the call's usage is exact): what
// the input is made of, so a smaller input is measured part by part (Codex 7.8). question_in_turns: the question is also
// the last of the dialogue's user turns.
function inputParts(body, input) {
  if (!body) return null;
  const count = value => value === undefined || value === null ? 0 : tokenCount(typeof value === 'string' ? value : JSON.stringify(value));
  const evidence = input.evidence || {}, dialogue = input.dialogue || {}, records = evidence.records || {};
  const { entries = [], ...recordRest } = records;
  const { userTurns, publishedAssistant, previousState, stateContext, ...dialogueRest } = dialogue;
  return { instructions: count(body.instructions), schema: count(body.text?.format?.schema), question: count(input.question),
    user_turns: count(userTurns), published_assistant: count(publishedAssistant), previous_state: count(previousState),
    state_context: count(stateContext), dialogue_rest: count(Object.keys(dialogueRest).length ? dialogueRest : null),
    sources: count(evidence.sources), evidence_text: count((evidence.evidence || []).map(item => item.text).join('\n')),
    evidence_meta: count((evidence.evidence || []).map(({ text: _text, ...meta }) => meta)), dependencies: count(evidence.dependencies),
    record_entries: count(entries), records_rest: count(recordRest), retrieval: count(evidence.retrieval),
    question_in_turns: Boolean(input.question && Array.isArray(userTurns) && JSON.stringify(userTurns.at(-1) || '').includes(JSON.stringify(input.question).slice(1, -1))) };
}

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
    // The fact lifecycle checks (Codex 7.6): the saved facts with their status and quotes, and every left-out item.
    facts: (payload.dialogueState?.value?.facts || []).map(({ id, person, status, support }) => ({ id, person, status, support })),
    dropped: payload.dialogueState?.value?.model?.dropped ?? [],
    // The plan's checked places (state v5: turn, person, region, relation or why unresolved): a place the plan left out shows here.
    places: (payload.searchAssist?.places || []).map(({ turn, person, region, relation, reason }) => ({ turn, person, region, relation, ...(reason ? { reason } : {}) })),
    // ADR-074: how the turn's municipality was chosen (the person's own, the asked one, or the plan's queries), and the
    // plan's place attributions as it gave them, before the server's check.
    scopeState: records.scope?.state ?? null, plannedPlaces: payload.searchAssist?.plannedPlaces ?? null,
    personRegions: Object.fromEntries((payload.dialogueState?.value?.people || []).map(entry => [entry.person.trim().toLowerCase(), entry.region.id])),
    timings: { searched: payload.timings?.phases?.searched ?? null, answered: payload.timings?.phases?.answered ?? null,
      search: payload.timings?.search?.since_start_ms?.merged ?? null, total: payload.timings?.validatedDraftMs ?? null },
    // Where the turn spent its time (Codex 7.8), read stage by stage: the service's phases since the turn started, the
    // search's steps since it started and each lane's own steps (lanes run side by side), and each model call's times
    // and tokens. Each process's own clock; nothing here is subtracted across processes.
    stages: { phases: payload.timings?.phases ?? null, search: payload.timings?.search?.since_start_ms ?? null,
      lanes: payload.timings?.search?.lanes ?? null,
      calls: events.filter(event => event.timings || event.usage).map(event => ({ stage: event.stage, timings: event.timings ?? null, usage: event.usage ?? null })),
      input: inputParts(payload.requestAudit?.body, input) },
    usd: events.reduce((sum, event) => sum + (event.estimatedNanoUsd || 0), 0) / 1e9,
    // The search plan and the rerank's candidates and choice: why a search check failed, read before the run's
    // conversations are deleted.
    queries: payload.searchAssist?.queries ?? [],
    // The greeting route: no search plan and no search were made for this turn.
    greeting: payload.searchAssist?.greeting === true,
    rerank: rerankOf(payload.searchAssist?.rerank),
    // A rejected answer's check (code, path, the value it refused) and the references it was allowed, read before the
    // run's conversations are deleted.
    validation: payload.responseAudit?.validation?.valid === false ? { code: payload.responseAudit.validation.code, path: payload.responseAudit.validation.path,
      received: typeof payload.responseAudit.validation.received === 'string' ? payload.responseAudit.validation.received.slice(0, 300) : payload.responseAudit.validation.received ?? null,
      allowed: (payload.responseAudit.validation.allowedReferences || []).length } : null,
  };
}
function rerankOf(rerank) {
  if (!rerank) return null;
  const title = id => rerank.candidates.find(candidate => candidate.id === id)?.title || id;
  // Which passage each candidate is (ADR-077): an act's versions and its passages share the title.
  const told = candidate => [candidate.id, candidate.valid_from ? `alates ${candidate.valid_from}` : null, candidate.lead ?? null].filter(Boolean).join(' | ');
  return { candidates: rerank.candidates.map(candidate => candidate.title), selected: rerank.selected.map(title),
    ...(rerank.candidates.some(candidate => candidate.lead) ? { passages: rerank.candidates.map(told), selected_ids: rerank.selected } : {}) };
}

await fs.mkdir(values.out, { recursive: true });
const report = { schema_version: 'rag-v2/conversation-eval-report-1', started_at: new Date().toISOString(), today, plan: config.id, verified_marks: verifiedMarks,
  generation: config.generationId, model: config.model, reasoning: values.reasoning || config.reasoning, catalogue: values.scenarios, scenarios: [] };
let spent = 0;
try {
  for (const scenario of scenarios) {
    if (spent >= maxUsd) { report.stopped = `cost ${spent.toFixed(4)} USD reached --max-usd ${maxUsd}`; break; }
    const conversation = await prisma.conversation.create({ data: { userId, role: 'CLIENT', title: `Hindamine ${scenario.id}`, metadata: { m4: true },
      expiresAt: pilotExpiry(config) } });
    const turns = [];
    for (const [index, listed] of scenario.turns.entries()) {
      const turn = values['auto-modes'] ? { ...listed, mode: index ? 'same' : 'new', listedMode: listed.mode,
        expect: Object.fromEntries(Object.entries(listed.expect || {}).filter(([key]) => key !== 'previous_state_cleared')) } : listed;
      let result = null, error = null, firstText = null;
      const started = performance.now(), streaming = values.stream ? { onAnswerText: () => { firstText ??= performance.now() - started; } } : {};
      try { result = await service.run(userId, { question: turn.text, contextMode: turn.mode, convId: conversation.id, clientTurnKey: randomUUID(), language: 'et',
        ...(values.reasoning ? { reasoning: values.reasoning } : {}) }, streaming); }
      catch (failure) { error = failure.code || 'turn_failed'; result = failure.pilotTurnId ? { id: failure.pilotTurnId } : null; }
      const row = result?.id ? openTurn(await prisma.m4PilotTurn.findUnique({ where: { id: result.id } })) : null;
      const observed = observe(row, error);
      // The caller's own view in this process: the first provisional text passed on and the whole turn.
      if (observed.stages) observed.stages.caller = { streamed: values.stream, firstTextMs: firstText === null ? null : Math.round(firstText), totalMs: Math.round(performance.now() - started) };
      spent += observed.usd;
      // The evidence texts are read by the checks only; the report keeps titles, not the sources' text. The provision
      // checks read each passage with its act's title and its own section, and the passages the answer cites.
      const evidenceTexts = (row?.payload?.packet?.evidence || []).map(evidence => evidence.source_text || '');
      turns.push({ mode: turn.mode, ...(turn.listedMode ? { listed_mode: turn.listedMode } : {}), text: turn.text, expect: turn.expect || {}, note: turn.note, turn_id: row?.id ?? null, observed,
        ...checkTurn(turn.expect, { ...observed, evidenceTexts, ...turnPassages(row?.payload?.packet, row?.payload?.answer) }, { today, validity: id => legal.get(id) || null, version: id => versions.get(id) || null }) });
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
      lines.push(`### ${index + 1}. [${turn.mode}${turn.listed_mode && turn.listed_mode !== turn.mode ? ` (kataloogis ${turn.listed_mode})` : ""}] ${turn.text} — **${turn.verdict}**`, '');
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
