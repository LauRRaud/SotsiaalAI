import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRerankRequest, rerankRequest, validateRerank } from '../lib/rag-v2/pilot/search-assist.js';
import { RERANK_CACHE_POLICY } from '../lib/rag-v2/pilot/rerank-cache.js';
import { priceProviderUsage } from '../lib/rag-v2/pilot/cost.js';

test('the opt-in cost policy preserves every request field except cache controls, including full text, versions and dialogue', () => {
  const config={model:'gpt-6-luna'}, messages=['Olukord on Tartu linnas.','Tema pension on 700 eurot kuus.'];
  const passages=Array.from({length:44},(_,i)=>({id:`P${i+1}`,title:'Synthetic act',year:'2026',valid_from:i%2?'2026-10-06':'2025-09-01',
    valid_to:i%2?null:'2026-10-05',text:`§ ${i+1}. Täielik tingimus, erand ja viide.\n`.repeat(80)}));
  const original=structuredClone(passages), baseline=rerankRequest(config,messages,passages,'2026-10-08');
  const prepared=prepareRerankRequest({...config,rerankCachePolicy:RERANK_CACHE_POLICY},messages,passages,'2026-10-08');
  const {prompt_cache_options:policy,...rest}=prepared.body;
  assert.deepEqual(rest,baseline);assert.deepEqual(passages,original);assert.deepEqual(policy,{mode:'explicit',ttl:'30m'});
  assert.equal(prepared.measurements.fullSourceText,true);assert.equal(prepared.measurements.cacheWrites,false);
  assert.deepEqual(validateRerank({useful:['P44','P1']},passages),['P44','P1']);
});
test('default and unknown policies retain implicit caching and the same request', () => {
  const config={model:'gpt-6-luna'}, passages=[{id:'P1',text:'All source text.'}], baseline=rerankRequest(config,['question'],passages);
  for(const policy of [undefined,'unknown']){
    const prepared=prepareRerankRequest({...config,rerankCachePolicy:policy},['question'],passages);
    assert.deepEqual(prepared.body,baseline);assert.equal(prepared.measurements,null);
  }
});
test('uncached full text is cheaper than a cache write, while a cache read is cheaper than either', () => {
  const base={stage:'rerank',model:'gpt-6-luna',mode:'real',billing:{model:'gpt-6-luna',serviceTier:'default'}};
  const price=(read,write)=>priceProviderUsage({...base,usage:{input:10000,output:100,cachedInput:read,cacheWriteInput:write}}).nanoUsd;
  assert.equal(price(0,10000),1300000);assert.equal(price(0,0),1050000);assert.equal(price(10000,0),150000);
});
