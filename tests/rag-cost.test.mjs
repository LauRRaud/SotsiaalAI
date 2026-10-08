import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { priceProviderUsage, reserveProviderCost } from '../lib/rag-v2/pilot/cost.js';
import { parseEcbRate, nanoUsdToEur } from '../lib/usage/exchangeRate.js';
import { displayUsageAmount, storeUsageAmount } from '../lib/usage/amounts.js';
import { providerCall } from '../lib/rag-v2/pilot/provider.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';

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
test('two real synthetic receipts reproduce cache write/read costs without another API call', () => {
  const evidence=JSON.parse(fs.readFileSync(new URL('../docs/audits/evidence/rag-cost-live-receipts-2026-10-08.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
  const costs=evidence.calls.map(call=>priceProviderUsage({...base,billing:call,usage:{input:call.usage.input_tokens,
    output:call.usage.output_tokens,cachedInput:call.usage.input_tokens_details.cached_tokens,
    cacheWriteInput:call.usage.input_tokens_details.cache_write_tokens}}));
  assert.deepEqual(costs.map(x=>x.nanoUsd),[232050,24820]);
});
