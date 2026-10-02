// M3 measurement, one paid observation (owner 02.10.2026: one turn of the Põlva question on the live production plan,
// about 0.005 USD; no repeat): does the text of SHS § 25 lõige 2 reach the answer's evidence when the municipal
// regulation names the act by abbreviation ("SHS § 25")?
// The turn runs through the real service like the conversation evaluator's: the live plan, its search plan, rerank
// model and answer model. The rerank hook is wrapped only to record what the model was given and what it returned.
// Saved: the search plan, the candidates in the order the rerank model read them, its selection, the evidence sent to
// the answer model, and the references of the answer. Exactly one turn; a failure is reported, never retried.
//   node --env-file=/etc/sotsiaalai/frontend.env --env-file=/etc/sotsiaalai/rag.env --import ./scripts/register-node-source-loader.mjs scripts/<copy>.mjs <out directory>
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const out = process.argv[2];
const QUESTION = 'Elame Põlva vallas ja mu lapsel on raske puue. Kas tema tugiisikuks võib olla lapse vanaema?';
const DECIDING = 'kes on teenuse saaja esimese või teise astme üleneja või alaneja sugulane', DECIDING_SECTION = '25';
const POINTING = 'kes vastab SHS § 25 esitatud nõuetele';
const spaced = text => String(text || '').replace(/\s+/gu, ' ');
const sectionsOf = text => [...new Set([...spaced(text).matchAll(/§ ?(\d+[¹²³⁴⁵⁶⁷⁸⁹⁰]*)\. /gu)].map(found => found[1]))];
// The deciding provision is § 25 lõige 2; the same words also stand in § 29 lõige 2 (the personal assistant), which is not it.
const flags = text => ({ sections: sectionsOf(text), deciding: spaced(text).includes(DECIDING) && sectionsOf(text).includes(DECIDING_SECTION),
  same_words_other_section: spaced(text).includes(DECIDING) && !sectionsOf(text).includes(DECIDING_SECTION), pointing: spaced(text).includes(POINTING) });

await fs.mkdir(out, { recursive: true });
if (await fs.stat(path.join(out, 'raw.json')).catch(() => null)) { console.log(JSON.stringify({ ok: false, code: 'already_run' })); process.exit(1); }

const { default: prisma } = await import('../lib/prisma.js');
const { readPilotConfig } = await import('../lib/rag-v2/pilot/config.js');
const { PilotStore } = await import('../lib/rag-v2/pilot/store.js');
const { PilotService } = await import('../lib/rag-v2/pilot/service.js');
const { runtimeAdapters } = await import('../lib/rag-v2/pilot/retrieval.js');
const { municipalDirectoryAdapter } = await import('../lib/rag-v2/adapters/municipal-directory.js');
const { pilotExpiry } = await import('../lib/rag-v2/pilot/lifetime.js');
const { renderAnswer } = await import('../lib/rag-v2/pilot/presentation.js');
const { processCatalog } = await import('../lib/rag-v2/search/postgres.js');
const { tokenCount } = await import('../lib/rag-v2/search/embedding.js');

const plan = JSON.parse(await fs.readFile(process.env.M4_PILOT_CONFIG, 'utf8'));
const userId = plan.users[0], readConfig = options => readPilotConfig(userId, options);
const config = await readConfig({ purpose: 'execute' });
// As the evaluator: the server's verified marks, read only, and no warm-up of this process's own.
const verifiedMarks = await processCatalog(process.env.RAG_V2_POSTGRES_URL).inheritVerified({ keep: false }).catch(() => 0);
if (verifiedMarks) (globalThis[Symbol.for('sotsiaalai.rag-v2.warming')] ||= new Set()).add((await processCatalog(process.env.RAG_V2_POSTGRES_URL).active(config.tenant)).id);

const adapters = runtimeAdapters(readConfig, userId, municipalDirectoryAdapter(prisma));
const search = adapters.search.bind(adapters), rerankCalls = [];
adapters.search = (settings, query, vector, assist) => search(settings, query, vector, assist?.rerank ? { ...assist, rerank: async passages => {
  const call = { passages, selected: undefined }; rerankCalls.push(call);
  call.selected = await assist.rerank(passages);
  return call.selected;
} } : assist);
const service = new PilotService({ store: new PilotStore(prisma), readConfig, adapters });

let result = null, error = null, row = null;
const started = performance.now();
try {
  const conversation = await prisma.conversation.create({ data: { userId, role: 'CLIENT', title: 'Hindamine polva-support-person-relative', metadata: { m4: true }, expiresAt: pilotExpiry(config) } });
  try { result = await service.run(userId, { question: QUESTION, contextMode: 'new', convId: conversation.id, clientTurnKey: randomUUID(), language: 'et' }); }
  catch (failure) { error = failure.code || failure.message || 'turn_failed'; result = failure.pilotTurnId ? { id: failure.pilotTurnId } : null; }
  const ms = Math.round(performance.now() - started);
  // What only this process saw, kept before anything else is read.
  await fs.writeFile(path.join(out, 'raw.json'), JSON.stringify({ turn_id: result?.id ?? null, error, ms, rerank_calls: rerankCalls }, null, 1));
  row = result?.id ? await prisma.m4PilotTurn.findUnique({ where: { id: result.id } }) : null;
  const payload = row?.payload || {};
  let input = {};
  try { input = JSON.parse(payload.requestAudit?.body?.input?.[0]?.content || '{}'); } catch { /* no answer request */ }
  const packet = payload.packet || { evidence: [], reference_map: {} }, answer = payload.answer || null;
  const byEvidence = new Map(packet.evidence.map(entry => [entry.evidence_id, entry]));
  const describe = entry => entry ? { title: entry.bibliography?.title || '', reason: entry.selection?.reason?.type || entry.selection?.reason || null,
    ...(entry.selection?.reason?.named_act ? { named_act: true } : {}), tokens: tokenCount(entry.source_text || ''), ...flags(entry.source_text) } : null;
  const calls = rerankCalls.map(call => {
    const candidates = call.passages.map((passage, index) => ({ place: index + 1, id: passage.id, title: passage.title, ...flags(passage.text) }));
    const chosen = Array.isArray(call.selected) ? call.selected : null;
    return { candidates_read: candidates.length, candidates,
      selected: chosen ? chosen.map(id => candidates.find(candidate => candidate.id === id)) : null,
      deciding_among_candidates: candidates.filter(candidate => candidate.deciding).map(candidate => candidate.place),
      deciding_selected: chosen ? candidates.some(candidate => candidate.deciding && chosen.includes(candidate.id)) : null };
  });
  const evidence = packet.evidence.map(describe);
  const blocks = (answer?.blocks || []).map((block, index) => ({ block: index + 1, refs: block.refs.map(ref => ({ ref, ...describe(byEvidence.get(packet.reference_map[ref]?.evidence_id)) })) }));
  const events = payload.events || [];
  const report = { question: QUESTION, at: new Date().toISOString(), plan: config.id, profile: config.profile?.id ?? config.profileId ?? null, prompt: config.promptVersion, generation: config.generationId,
    verified_marks: verifiedMarks, turn_id: row?.id ?? null, state: row?.state ?? 'missing', error, ms,
    search_plan: { queries: payload.searchAssist?.queries ?? [], person: payload.searchAssist?.person ?? null, places: payload.searchAssist?.places ?? [], failures: payload.searchAssist?.failures ?? [] },
    region: input.evidence?.records?.scope?.region ?? null,
    rerank: calls,
    evidence: { passages: evidence.length, deciding_in_evidence: evidence.some(entry => entry.deciding), deciding_reason: evidence.find(entry => entry.deciding)?.reason ?? null,
      pointing_in_evidence: evidence.some(entry => entry.pointing), same_words_other_section: evidence.some(entry => entry.same_words_other_section), entries: evidence },
    answer: { kind: answer?.kind ?? null, clarification: answer?.clarification ?? null, limitations: answer?.limitations ?? [], blocks,
      cites_deciding: blocks.some(block => block.refs.some(ref => ref.deciding)), cites_pointing: blocks.some(block => block.refs.some(ref => ref.pointing)),
      text: answer ? renderAnswer(answer, payload.answerVersion || 'm4-text-refs-1') : '' },
    calls: events.filter(event => event.usage).map(event => ({ stage: event.stage, usage: event.usage, usd: (event.estimatedNanoUsd || 0) / 1e9 })),
    usd: events.reduce((sum, event) => sum + (event.estimatedNanoUsd || 0), 0) / 1e9 };
  await fs.writeFile(path.join(out, 'turn.json'), JSON.stringify(report, null, 1));
  const { text, ...answerSummary } = report.answer;
  console.log(JSON.stringify({ state: report.state, error: report.error, usd: report.usd, ms, region: report.region, search_plan: report.search_plan,
    rerank: calls.map(call => ({ read: call.candidates_read, deciding_among_candidates: call.deciding_among_candidates, deciding_selected: call.deciding_selected,
      selected: (call.selected || []).map(item => `${item.place}:${item.title.slice(0, 40)}${item.sections.length ? ` §${item.sections.join(',')}` : ''}`) })),
    evidence: { passages: report.evidence.passages, deciding_in_evidence: report.evidence.deciding_in_evidence, deciding_reason: report.evidence.deciding_reason, pointing_in_evidence: report.evidence.pointing_in_evidence,
      same_words_other_section: report.evidence.same_words_other_section, entries: evidence.map(entry => `${entry.title.slice(0, 40)}${entry.sections.length ? ` §${entry.sections.join(',')}` : ''} [${entry.reason}]${entry.deciding ? ' DECIDING' : ''}${entry.pointing ? ' POINTING' : ''}`) },
    answer: { kind: answerSummary.kind, cites_deciding: answerSummary.cites_deciding, cites_pointing: answerSummary.cites_pointing, clarification: answerSummary.clarification, limitations: answerSummary.limitations,
      blocks: blocks.map(block => block.refs.map(ref => `${ref.ref}:${(ref.title || '').slice(0, 30)}${ref.sections?.length ? ` §${ref.sections.join(',')}` : ''}`)) } }, null, 1));
  console.log('ANSWER:\n' + text);
} catch (failure) {
  console.log(JSON.stringify({ ok: false, code: failure.code || failure.message, turn_id: result?.id ?? null }));
} finally { await prisma.$disconnect(); }
process.exit(0);
