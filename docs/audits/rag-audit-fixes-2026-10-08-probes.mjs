// Offline evidence checks. No database, network or provider calls.
// node --import ./scripts/register-node-source-loader.mjs docs/audits/rag-audit-fixes-2026-10-08-probes.mjs [--with-local-raw]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { priceProviderUsage } from '../../lib/rag-v2/pilot/cost.js';
import { roleWorkInstructions } from '../../lib/rag-v2/pilot/dialogue.js';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const sha = value => createHash('sha256').update(value).digest('hex');
const root = 'docs/audits/evidence/';
const before = read(root+'rag-rerank-cache-before-2026-10-08.json');
const previous = read(root+'rag-rerank-cache-after-2026-10-08.json');
const first = read(root+'rag-audit-fixes-first-2026-10-08.json');
const second = read(root+'rag-audit-fixes-second-2026-10-08.json');
const third = read(root+'rag-audit-fixes-third-2026-10-08.json');
const final = read(root+'rag-audit-fixes-2026-10-08.json');
const trials=[first,second,third,final], ids=new Set();
let cumulative = 366613975, citations=0;
for (const run of trials) {
 assert.equal(run.casesHash,before.casesHash); assert.equal(run.generationId,before.generationId);
 assert.equal(run.turns.length,15); assert.equal(run.unknownCalls,0); assert.equal(run.cleanup.syntheticUsersRemaining,0);
 assert.equal(run.priorNanoUsd,cumulative);
 let total=0, calls=0;
 for(const [i,t] of run.turns.entries()) {
  const key=x=>[x.role,x.scenario,x.turnIndex,x.question]; assert.deepEqual(key(t),key(before.turns[i]));
  let turnCost=0;
  for(const r of t.receipts) {
   const p=t.providers.find(p=>p.requestId===r.requestId),u=r.usage,embedding=r.stage==='embedding';
   assert.deepEqual(u,p.usage); assert.equal(r.state,'settled'); assert.equal(p.billing.serviceTier??'default','default');
   const long=u.input>272000,plain=embedding?u.input:u.input-u.cachedInput-u.cacheWriteInput;assert.ok(plain>=0);
   const expected=embedding?u.input*130:Math.ceil((plain*100+u.cachedInput*10+u.cacheWriteInput*125)*(long?2:1)+u.output*500*(long?1.5:1));
   assert.equal(priceProviderUsage({stage:r.stage,usage:u,billing:p.billing,mode:'real'}).nanoUsd,expected);
   assert.equal(r.pricing.nanoUsd,expected);assert.equal(Number(r.billedNanoUsd),expected);
   assert.ok(!ids.has(r.requestId));ids.add(r.requestId);turnCost+=expected;calls++;
  }
  assert.equal(Number(t.nanoUsd),turnCost);total+=turnCost;
  if(t.state==='completed') {
   assert.equal(t.replayNoNewCalls,true);assert.ok(t.streamingChunks>0);
   for(const ref of new Set(t.answer.blocks.flatMap(b=>b.refs))) {
    const binding=t.references[ref];assert.ok(binding);
    const e=t.evidence.find(e=>e.evidence_id===binding.evidence_id);assert.ok(e);
    assert.equal(e.source_text_sha256,binding.source_text_sha256);citations++;
   }
  } else assert.ok(t.error,'unpublished result must record its failure');
  if(run===final) {
   assert.equal(t.state,'completed');
   assert.deepEqual(t.providers.find(p=>p.stage==='answer').trailingInstructions,[{role:'developer',content:roleWorkInstructions(t.userRole)}]);
  }
 }
 assert.equal(total,Number(run.nanoUsd));assert.equal(total,run.ledger.nanoUsd);assert.equal(calls,run.cleanup.receiptsRetained);
 assert.ok(total<=run.phaseLimitNanoUsd);cumulative+=total;assert.ok(cumulative<1e9);
}
const sum=values=>values.reduce((a,b)=>a+b,0);
const at=(values,p)=>[...values].sort((a,b)=>a-b)[Math.ceil(values.length*p)-1];
function metrics(turns) {
 const receipts=turns.flatMap(t=>t.receipts),rerank=receipts.filter(r=>r.stage==='rerank');
 const times=turns.filter(t=>t.timings).map(t=>t.timings.phases.answered);
 return {turns:turns.length,completed:turns.filter(t=>t.state==='completed').length,
  input:sum(receipts.map(r=>r.usage.input)),output:sum(receipts.map(r=>r.usage.output)),
  cacheRead:sum(receipts.map(r=>r.usage.cachedInput||0)),cacheWrite:sum(receipts.map(r=>r.usage.cacheWriteInput||0)),
  nanoUsd:sum(turns.map(t=>Number(t.nanoUsd))),rerankInput:sum(rerank.map(r=>r.usage.input)),
  rerankInputNanoUsd:sum(rerank.map(r=>Number(r.billedNanoUsd)-r.pricing.components.output)),
  answeredP50ms:at(times,.5),answeredP95ms:at(times,.95)};
}
const comparison=['all','CLIENT','SOCIAL_WORKER','SERVICE_PROVIDER'].map(role=>({role,...Object.fromEntries([['baseline',before],['previousCandidate',previous],['fixes',final]].map(([name,data])=>[name,metrics(data.turns.filter(t=>role==='all'||t.role===role))]))}));
if(process.argv.includes('--with-local-raw')) {
 for(const [run,path] of [[first,'tmp/rag-audit-fixes-first-result.json'],[second,'tmp/rag-audit-fixes-second-result.json'],[third,'tmp/rag-audit-fixes-third-result.json'],[final,'tmp/rag-audit-fixes-result.json']]) {
  assert.equal(sha(fs.readFileSync(path)),run.rawFileSha256);
  for(const t of read(path).turns.filter(t=>t.state==='completed')) for(const ref of new Set(t.answer.blocks.flatMap(b=>b.refs))) {
   const r=t.references[ref],e=t.evidence.find(e=>e.evidence_id===r.evidence_id);assert.equal(sha(e.source_text),r.source_text_sha256);
  }
 }
 for(const [file,hash] of Object.entries(final.runtimeModuleHashes)) assert.equal(sha(fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n')),hash,file);
}
console.log(JSON.stringify({trials:trials.map(run=>({phase:run.phase,...metrics(run.turns),errors:run.turns.filter(t=>t.error).map(t=>({role:t.role,scenario:t.scenario,error:t.error}))})),receipts:ids.size,citations,cumulativeNanoUsd:cumulative,comparison},null,2));
