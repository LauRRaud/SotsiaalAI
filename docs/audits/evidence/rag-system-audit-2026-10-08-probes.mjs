// Free, synthetic probes. Run with --import ./docs/audits/evidence/rag-system-audit-2026-10-08-loader.mjs
import assert from 'node:assert/strict';
import { revision } from './rag-system-audit-2026-10-08-loader.mjs';
import { tokenCount, TOKENIZER } from '../../../lib/rag-v2/search/embedding.js';
import { queryPlanRequest, rerankRequest } from '../../../lib/rag-v2/pilot/search-assist.js';
import { dialogueRequest, DIALOGUE_LIMITS } from '../../../lib/rag-v2/pilot/dialogue.js';
import { DIALOGUE_VERSION } from '../../../lib/rag-v2/pilot/dialogue.js';
import { REGION_STATE_VERSION } from '../../../lib/rag-v2/pilot/dialogue-state.js';
import { UNIFIED_RETRIEVAL_VERSION } from '../../../lib/rag-v2/pilot/retrieval-plan.js';
import { RECORD_RETRIEVAL_VERSION } from '../../../lib/rag-v2/search/structured-record-source.js';
import { validateAnswer, digest } from '../../../lib/rag-v2/pilot/contracts.js';
import { providerCall } from '../../../lib/rag-v2/pilot/provider.js';
import { PilotService } from '../../../lib/rag-v2/pilot/service.js';
import { carriedStatements } from '../../../lib/rag-v2/pilot/dialogue-carry.js';
import { fetchPage } from '../../../lib/rag-v2/web-collect.js';

const config = { mode: 'real', model: 'gpt-6-luna', reasoning: 'low', maxOutputTokens: 8192, maxInputTokens: 300000,
  dialogueVersion: DIALOGUE_VERSION, dialogueStateVersion: REGION_STATE_VERSION,
  retrievalRouting: UNIFIED_RETRIEVAL_VERSION, recordCatalogue: RECORD_RETRIEVAL_VERSION, timeoutMs: 5000,
  prices: { answerInput: 125, answerOutput: 500 } };
const messages = ['Millist abi saab küsida kodus toimetulekuks?'];
const evidence = { sources: {}, evidence: [], records: { entries: [], relations: [] } };
const dialogue = { userTurns: [{ turn: 1, text: messages[0] }], previousState: null, stateContext: { asOfDateUTC: '2026-10-08' } };
const measure = body => ({ instructions: tokenCount(body.instructions), schema: tokenCount(JSON.stringify(body.text.format)),
  input: tokenCount(body.input[0].content), serialized_body: tokenCount(JSON.stringify(body)),
  reservation_input_bound: Buffer.byteLength(JSON.stringify(body), 'utf8') + 1024 });
const plan = queryPlanRequest(config, messages, 'et');
const answer = dialogueRequest(config, messages[0], evidence, 'et', dialogue);
const passageText = 'Teenuse vajadust hinnatakse inimese olukorra järgi. Taotlus esitatakse omavalitsusele. '.repeat(35);
const passages = Array.from({ length: 36 }, (_, index) => ({ id: `P${index + 1}`, title: 'Sünteetiline allikas', text: passageText }));
const rerank = rerankRequest(config, messages, passages, '2026-10-08');
const report = { revision, tokenizer: TOKENIZER, caveat: 'Local token estimates; synthetic content; not provider billing counts or quality proof',
  dialogueLimits: DIALOGUE_LIMITS, requestParts: { plan: measure(plan), rerank36: measure(rerank), answerEmptyEvidence: measure(answer) }, checks: {} };
// The same provider response has cache fields for each Responses stage.
report.cacheAccounting = {};
for (const stage of ['plan', 'rerank', 'answer']) {
  const data = { model: config.model, status: 'completed', usage: { input_tokens: 1000, output_tokens: 10,
    input_tokens_details: { cached_tokens: 300, cache_write_tokens: 600 } },
    output: [{ type: 'message', content: [{ type: 'output_text', text: '{}' }] }] };
  const result = await providerCall({ stage, body: {}, config, apiKey: 'synthetic-never-sent',
    transport: async () => new Response(JSON.stringify(data), { headers: { 'x-request-id': 'synthetic' } }) });
  report.cacheAccounting[stage] = result.usage;
}
assert.equal(report.cacheAccounting.answer.cachedInput, 300);
assert.equal(report.cacheAccounting.plan.cachedInput, undefined);
assert.equal(report.cacheAccounting.rerank.cacheWriteInput, undefined);
report.checks.cache_fields_lost_in_assist_stages = true;
// maxInputTokens is not enforced by assistCall, unlike the answer stage.
let sent = 0;
const store = { reserve: async (_c, row) => row, sent: async (_c, row) => row, usage: async (_c, row) => row };
const service = new PilotService({ store, readConfig: async () => config, adapters: {},
  call: async () => { sent++; return { value: {}, usage: { input: 1, output: 1 } }; } });
service.access = async () => ({ ...config, maxInputTokens: 1 });
await service.assistCall({ ...config, maxInputTokens: 1 }, {}, 'rerank', rerank, {});
assert.equal(sent, 1);
report.checks.assist_input_cap_not_enforced = true;
// References are syntactic provenance. The validator has no passage text to assess entailment.
const accepted = validateAnswer({ kind: 'grounded', blocks: [{ text: 'Toetust makstakse kõigile alati miljon eurot.', factual: true, refs: ['S1'] }], limitations: [], clarification: null }, ['S1']);
assert.equal(accepted.kind, 'grounded');
report.checks.reference_validation_is_not_factual_verification = true;
// A changing question is the first field before the large evidence payload.
assert.deepEqual(Object.keys(JSON.parse(answer.input[0].content)).slice(0,3), ['question','dialogue','evidence']);
assert.equal(answer.prompt_cache_options, undefined);
report.checks.dynamic_question_precedes_evidence_and_no_explicit_cache_boundary = true;
// The collector's byte cap rejects the result only after arrayBuffer consumed it whole.
let consumed = 0;
const fetched = await fetchPage('https://synthetic.example/page', { maxBytes: 32,
  fetchImpl: async () => ({ status: 200, headers: new Headers({ 'content-type': 'text/html' }),
    arrayBuffer: async () => { consumed = 4096; return new ArrayBuffer(consumed); } }) });
assert.equal(fetched.error, 'too_large'); assert.equal(consumed, 4096);
report.checks.collector_reads_entire_body_before_byte_cap = { configured: 32, consumed };
let streamThrown = false;
try {
  await fetchPage('https://synthetic.example/page', { fetchImpl: async () => ({ status: 200,
    headers: new Headers({ 'content-type': 'text/html' }), arrayBuffer: async () => { throw new Error('synthetic stream reset'); } }) });
} catch { streamThrown = true; }
assert.equal(streamThrown, true);
report.checks.collector_body_error_escapes_structured_result = true;
// Even 30-turn memory rolls over by tokens and carries only bounded saved quotes.
const state = { version: REGION_STATE_VERSION, value: { facts: Array.from({ length: 12 }, (_, at) => ({
  id: `F${at + 1}`, topic: `Asjaolu ${at + 1}`, status: 'current', person: 'user',
  support: [{ turn: 1, quote: `${at} ` + 'Sünteetiline asjaolu '.repeat(10) }] })) } };
const carried = carriedStatements({ ...state, hash: digest(state) });
report.memoryCarry = { before: 12, carried: carried.split('\n').length, chars: carried.length };
assert.ok(report.memoryCarry.carried < report.memoryCarry.before);
console.log(JSON.stringify(report, null, 2));
