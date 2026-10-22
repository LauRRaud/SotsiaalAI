import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { priceProviderUsage, reserveProviderCost } from '../lib/rag-v2/pilot/cost.js';
import { parseEcbRate, nanoUsdToEur } from '../lib/usage/exchangeRate.js';
import { displayUsageAmount, storeUsageAmount } from '../lib/usage/amounts.js';
import { providerCall } from '../lib/rag-v2/pilot/provider.js';
import { PilotService, ANSWER_RETRY, answerRetryTimeout } from '../lib/rag-v2/pilot/service.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';

const base = { stage: 'answer', model: 'gpt-6-luna', mode: 'real', billing: { model: 'gpt-6-luna', serviceTier: 'default' } };
const price = usage => priceProviderUsage({ ...base, usage });
test('cache classes partition input; reasoning is already in output', () => {
  const value = price({ input: 1000, cachedInput: 400, cacheWriteInput: 500, output: 200, reasoning: 150 });
  assert.equal(value.nanoUsd, 100*100 + 400*10 + 500*125 + 200*500);
  assert.equal(value.status, 'priced');
});
test('272K boundary applies to each full request, including all cache and output tokens', () => {
  for (const input of [271999,272000,272001,300000]) {
    const value = price({ input, cachedInput: 100000, cacheWriteInput: 100000, output: 100 });
    const long = input > 272000;
    assert.equal(value.nanoUsd, ((input-200000)*100 +100000*10+100000*125)*(long?2:1)+100*(long?750:500));
    assert.equal(value.longContext,long);
  }
  const small = { input: 200000, cachedInput: 0, cacheWriteInput: 200000, output: 100 };
  assert.equal(price(small).longContext,false); assert.equal(price(small).longContext,false);
});
test('unknown usage, unknown tiers and inconsistent accounting cannot look free or priced', () => {
  for (const usage of [undefined,{ input: 1, output: 1 },{ input: 5, output: 1, cachedInput: 6, cacheWriteInput: 0 },
    { input: 5, output: 1, cachedInput: 0, cacheWriteInput: null },{ input:5,output:1,cachedInput:0,cacheWriteInput:0,reasoning:2 }]) {
    assert.equal(price(usage).status, 'unknown'); assert.equal(price(usage).nanoUsd,undefined);
  }
  assert.equal(priceProviderUsage({ ...base, billing:{serviceTier:'priority'},usage:{input:1,output:1,cachedInput:0,cacheWriteInput:0} }).status,'unknown');
  assert.equal(priceProviderUsage({ ...base, stage:'embedding', billing:{model:'text-embedding-3-large'},
    usage:{input:Number.MAX_SAFE_INTEGER,output:0} }).status,'unknown');
});
test('flex rate rounds once at nano-USD precision and reserve covers the higher long tariff', () => {
  const usage = { input: 1, output: 0, cachedInput: 0, cacheWriteInput: 1 };
  assert.equal(priceProviderUsage({ ...base, billing:{serviceTier:'flex'},usage }).nanoUsd,63);
  const config={mode:'real',model:'gpt-6-luna',prices:{answerInput:125,answerOutput:500}};
  assert.equal(reserveProviderCost(config,'answer',272001,8192),272001*250+8192*750);
  assert.equal(reserveProviderCost({...config,embedding:{model:'text-embedding-3-large'},prices:{embeddingInput:1}},'embedding',10),1300);
});
test('search assist rejects oversized input before reserving or calling a provider', async () => {
  const service = new PilotService({store:{reserve:()=>assert.fail('must not reserve')},call:()=>assert.fail('must not call')});
  await assert.rejects(service.assistCall({maxInputTokens:1000},{},'rerank',{input:'x'.repeat(2000),max_output_tokens:100},{}),
    {code:'assist_input_budget_exceeded'});
});
test('ECB freshness and exact integer EUR conversion; decimal form values round trip', () => {
  const xml="<Cube time='2026-10-07'><Cube currency='USD' rate='1.1177'/></Cube>";
  const rate=parseEcbRate(xml,new Date('2026-10-08T08:00:00Z'));
  assert.equal(nanoUsdToEur(1117700000,rate),1000000000n);
  assert.equal(nanoUsdToEur(1,rate),1n);
  assert.throws(()=>parseEcbRate(xml,new Date('2026-11-08')));
  assert.throws(()=>parseEcbRate(xml,new Date('2026-10-06')));
  for(const amount of ['3.60','6.75','9.00','0.000000001']) {
    const value=storeUsageAmount('AI_COST_NANO_EUR',amount);
    assert.equal(storeUsageAmount('AI_COST_NANO_EUR',displayUsageAmount('AI_COST_NANO_EUR',value)),value);
  }
});
test('all response stages preserve cache fields and billing metadata, including rejected output', async () => {
  const config={mode:'real',model:'gpt-6-luna',timeoutMs:1000,accountProject:'proj_synthetic'};
  for(const stage of ['plan','rerank','answer']) for(const valid of [true,false]) {
    const call=()=>providerCall({stage,config,apiKey:'test',body:{},transport:async()=>Response.json({
      id:'resp_test',model:config.model,service_tier:'default',status:valid?'completed':'incomplete',
      usage:{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:400,cache_write_tokens:600}},
      output:[{type:'message',content:[{type:'output_text',text:'{}'}]}]
    },{headers:{'x-request-id':'req_test'}})});
    const result=valid?await call():await call().catch(e=>e);
    assert.equal(result.usage.cachedInput,400); assert.equal(result.usage.cacheWriteInput,600);
    assert.equal(result.billing.serviceTier,'default'); assert.equal(result.requestId,'req_test');
  }
});
// ADR-170: the answer's one retry after a time limit is a paid call of its own.
test('answer retry only after a time limit with nothing shown, and only while the turn can still end', () => {
  const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' }), aborted = Object.assign(new Error('aborted'), { name: 'AbortError' });
  const at = (elapsedMs, error = timeout, textShown = false) => answerRetryTimeout({ error, textShown, elapsedMs, timeoutMs: 60000 });
  assert.equal(at(75000), 60000); assert.equal(at(100000, aborted), ANSWER_RETRY.turnMs - 100000);
  assert.equal(at(ANSWER_RETRY.turnMs - ANSWER_RETRY.minimumMs + 1), null);
  assert.equal(at(75000, timeout, true), null);
  for (const error of [Object.assign(new Error('x'), { code: 'provider_http_error' }), Object.assign(new Error('x'), { name: 'TimeoutError', usage: { input: 1, output: 1 } }), null]) assert.equal(at(75000, error), null);
});
test('answer retry reserves and accounts a second answer attempt, the timed-out one stays reserved', async () => {
  const config = { id: 'plan-1', configHash: 'cfg', mode: 'real', model: 'gpt-6-luna', embedding: { model: 'text-embedding-3-large' }, timeoutMs: 60000,
    budget: { attempts: 100, tokens: 10000000, nanoUsd: 10000000000, embeddingAttempts: 10, answerAttempts: 10 }, prices: { answerInput: 125, answerOutput: 500 } };
  const reservation = { tokens: 30000, nanoUsd: 5000000 }, trace = { bodyHash: 'b', inputBound: 20000, maxOutputTokens: 10000 };
  const fake = answerAttempts => {
    const state = { turn: { id: 'turn-1', configHash: 'cfg', expiresAt: null, state: 'answer_sent',
      payload: { userId: 'user-1', convId: 'conv-1', events: [{ stage: 'answer', state: 'sent_unknown', reservation, ...trace }] } },
    ledger: { id: 'plan-1', configHash: 'cfg', totals: { attempts: 3, tokens: 50000, nanoUsd: 6000000, embeddingAttempts: 1, answerAttempts, planAttempts: 1, rerankAttempts: 0 } } };
    const tx = { $executeRaw: async () => 0, $queryRaw: async () => [],
      conversation: { findUnique: async () => ({ id: 'conv-1', userId: 'user-1', archivedAt: null, expiresAt: null, metadata: { m4: true } }) },
      m4PilotTurn: { findUnique: async () => structuredClone(state.turn), update: async ({ data }) => (state.turn = { ...state.turn, ...structuredClone(data) }) },
      m4PilotLedger: { findUnique: async () => structuredClone(state.ledger), upsert: async ({ update }) => { state.ledger = { ...state.ledger, ...update }; },
        update: async ({ data }) => { state.ledger = { ...state.ledger, ...data }; } } };
    return { state, store: new PilotStore({ $transaction: async fn => fn(tx) }) };
  };
  const { state, store } = fake(1), calls = [], reached = [];
  const result = { value: {}, usage: { input: 20000, output: 900, cachedInput: 0, cacheWriteInput: 0 }, requestId: 'req_retry',
    billing: { model: 'gpt-6-luna', responseId: 'resp_retry', serviceTier: 'default' }, timings: {} };
  const service = new PilotService({ store, readConfig: async () => config, adapters: {}, call: async args => { calls.push(args); return result; } });
  const timeout = Object.assign(new Error('timeout'), { name: 'TimeoutError' });
  const { row } = await service.answerRetry(config, structuredClone(state.turn), { body: { model: 'gpt-6-luna' }, reservation, trace, timeoutMs: 50000,
    error: timeout, textStream: () => null, reached: name => reached.push(name) });
  assert.deepEqual(calls.map(args => [args.stage, args.config.timeoutMs]), [['answer_retry', 50000]]);
  assert.deepEqual(row.payload.events.map(e => [e.stage, e.state, e.code ?? null]), [['answer', 'provider_failed', 'TimeoutError'], ['answer_retry', 'sent_unknown', null]]);
  assert.equal(row.state, 'answer_retry_sent'); assert.deepEqual(reached, ['answer_retry']);
  assert.deepEqual(row.payload.events[0].reservation, reservation);
  assert.deepEqual([state.ledger.totals.answerAttempts, state.ledger.totals.attempts, state.ledger.totals.tokens, state.ledger.totals.nanoUsd], [2, 4, 80000, 11000000]);
  const done = await store.usage(config, row, 'answer_retry', result);
  assert.equal(done.payload.events[1].state, 'response_received'); assert.equal(done.payload.events[0].state, 'provider_failed');
  // One retry a turn, and the answers' cap counts it.
  await assert.rejects(store.reserve(config, done, 'answer_retry', reservation, trace), { code: 'attempt_already_reserved' });
  const capped = fake(10);
  await assert.rejects(capped.store.reserve(config, structuredClone(capped.state.turn), 'answer_retry', reservation, trace), { code: 'pilot_stage_budget_exhausted' });
});
test('two real synthetic receipts reproduce cache write/read costs without another API call', () => {
  const evidence=JSON.parse(fs.readFileSync(new URL('../docs/audits/evidence/rag-cost-live-receipts-2026-10-08.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const costs=evidence.calls.map(call=>priceProviderUsage({...base,billing:call,usage:{input:call.usage.input_tokens,
    output:call.usage.output_tokens,cachedInput:call.usage.input_tokens_details.cached_tokens,
    cacheWriteInput:call.usage.input_tokens_details.cache_write_tokens}}));
  assert.deepEqual(costs.map(x=>x.nanoUsd),[232050,24820]);
});
