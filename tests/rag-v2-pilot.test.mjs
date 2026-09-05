import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { hash, id, stable } from '../lib/rag-v2/contracts.js';
import { tokenCount } from '../lib/rag-v2/search/embedding.js';
import { realEmbeddingConfig, validateApproval, nanoUsd, formatUsd, costNanos } from '../lib/rag-v2/search/pilot-manifest.js';
import { runPilot, StoredEmbedding } from '../lib/rag-v2/search/pilot-runner.js';
import { openAITransport } from '../lib/rag-v2/search/openai-embedding.js';
import { modelProjection, resolveModelReference } from '../lib/rag-v2/search/model-context.js';
import { structuralRole } from '../lib/rag-v2/search/structural-role.js';
import { LocalPolicy } from '../lib/rag-v2/search/policy.js';
import { anchorCoverage } from '../lib/rag-v2/search/evaluator.js';
import { QdrantIndex } from '../lib/rag-v2/search/qdrant.js';

let root, attempts = 0;
const savedFetch = globalThis.fetch, savedConnect = net.Socket.prototype.connect;
const context = {tenant:'synthetic-pilot',subject:'owner',usage:'development_only'};
const policy = new LocalPolicy({tenants:{'synthetic-pilot':{owner:['doc']}}});
const price = {input_per_million:'0.13',currency:'USD',version:'synthetic-price',source:'https://developers.openai.com/api/docs/models/text-embedding-3-large',checked_at:new Date().toISOString()};
function prepared() {
  const inputs=['hello world','A😀B'].map((text,i)=>({id:id('pilot_input',i,hash(text)),kind:i?'query':'document',text,input_hash:hash(text),tokens:tokenCount(text)}));
  const manifest={schema_version:'rag-v2/egress-manifest-1',tenant:context.tenant,source_plan_id:'synthetic-plan',config:realEmbeddingConfig(),
    files:[{document_id:'doc',version_id:'version',pdf_sha256:'a'.repeat(64),metadata_sha256:'b'.repeat(64)}],inputs:inputs.map(({text:_text,...item})=>item),
    total_input_tokens:inputs.reduce((n,i)=>n+i.tokens,0),max_api_attempts:inputs.length,retries:0,generation_calls:0};
  return {manifest,manifest_sha256:hash(stable(manifest)),inputs,matches_baseline:true,differences:[]};
}
function approval(p) {return {schema_version:'rag-v2/pilot-approval-1',state:'approved',material_egress_approved:true,spend_cap_approved:true,
  approved_by:'synthetic-test-owner',approved_at:new Date().toISOString(),approval_basis:'Synthetic test authorization only',source_plan_id:p.manifest.source_plan_id,
  egress_manifest_sha256:p.manifest_sha256,tenant:p.manifest.tenant,config:p.manifest.config,files:p.manifest.files,
  max_api_attempts:p.manifest.max_api_attempts,max_total_input_tokens:p.manifest.total_input_tokens,retries:0,generation_calls:0,currency:'USD',approved_spend_cap:'0.05'};}
function response(text,config) {return {body:{model:config.model,data:[{index:0,object:'embedding',embedding:Array.from({length:3072},(_,i)=>i===0?1:0)}],
  usage:{prompt_tokens:tokenCount(text),total_tokens:tokenCount(text)}},request_id:'synthetic-request',duration_ms:1};}
const success = async ({text,config})=>response(text,config);
async function options(name) {const p=prepared();return {prepared:p,approval:approval(p),price,policy,context,root:path.join(root,name),execute:true,transport:success};}
before(async()=>{root=await fs.mkdtemp(path.join(os.tmpdir(),'rag-v2-pilot-test-'));
  globalThis.fetch=()=>{attempts++;throw new Error('unexpected_network');};net.Socket.prototype.connect=()=>{attempts++;throw new Error('unexpected_network');};});
after(async()=>{globalThis.fetch=savedFetch;net.Socket.prototype.connect=savedConnect;assert.equal(attempts,0);
  assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));await fs.rm(root,{recursive:true,force:true});});

test('E-02/03: dry run and invalid approval never reach transport',async()=>{
  const opts=await options('authorization');let calls=0;opts.transport=async()=>{calls++;throw new Error('must not send');};
  const dry=await runPilot({...opts,execute:false,approval:null});assert.equal(dry.api_attempts,0);
  for(const bad of [null,{...opts.approval,state:'draft_not_authorized'},{...opts.approval,material_egress_approved:false},
    {...opts.approval,egress_manifest_sha256:'bad'},{...opts.approval,tenant:'other'}, {...opts.approval,config:{...opts.approval.config,model:'wrong'}},
    {...opts.approval,ignored_override:true}]) await assert.rejects(runPilot({...opts,approval:bad}));
  const changed=structuredClone(opts.prepared);changed.inputs[0].text='different';
  await assert.rejects(runPilot({...opts,prepared:changed}),/pilot_input_hash_mismatch/);
  const removed=structuredClone(opts.prepared);removed.inputs.pop();await assert.rejects(runPilot({...opts,prepared:removed}),/pilot_input_hash_mismatch/);
  assert.equal(calls,0);
});
test('E-04: exact money, token and attempt limits; missing/stale prices fail before calls',async()=>{
  assert.equal(String(costNanos(12420,price)),'1614600');assert.equal(formatUsd(1614600n),'0.001614600');assert.equal(nanoUsd('0.05'),50000000n);
  const opts=await options('caps');
  for(const bad of [{...opts.approval,max_api_attempts:1},{...opts.approval,max_total_input_tokens:1},{...opts.approval,approved_spend_cap:'0.000000001'}]) await assert.rejects(runPilot({...opts,approval:bad}));
  await assert.rejects(runPilot({...opts,price:null}),/verified_price_required/);
  await assert.rejects(runPilot({...opts,price:{...price,checked_at:'2020-01-01'}}),/price_verification_stale/);
  assert.throws(()=>nanoUsd(NaN),/invalid_usd_amount/);assert.throws(()=>validateApproval(opts.prepared,opts.approval,{...price,input_per_million:0}),/verified_price_required/);
});
test('E-04/13: successful vectors persist; restart does not reset counters or resend',async()=>{
  const opts=await options('reuse');let calls=0;opts.transport=async args=>{calls++;return success(args);};
  const first=await runPilot(opts);assert.equal(first.state,'complete');assert.equal(calls,2);
  const second=await runPilot(opts);assert.equal(second.api_attempts_this_run,0);assert.equal(calls,2);assert.equal(second.ledger.reserved_attempts,2);
  const saved=await StoredEmbedding.load(first.directory,context.tenant);assert.equal(saved.provenance,'test_transport');
  await saved.embed('hello world');await saved.embed('hello world');assert.equal(calls,2);
  await assert.rejects(saved.embed('not saved'),/stored_embedding_missing/);
  await assert.rejects(StoredEmbedding.load(first.directory,'other'),/complete_real_pilot_required/);
});
test('E-05: timeout reserves budget permanently and never automatically retries unknown input',async()=>{
  const opts=await options('unknown');let calls=0;opts.transport=async()=>{calls++;throw Object.assign(new Error('timeout'),{code:'ETIMEDOUT'});};
  const first=await runPilot(opts);assert.equal(first.state,'stopped_unknown');assert.equal(first.ledger.reserved_attempts,1);
  assert.equal(first.ledger.reserved_tokens,opts.prepared.inputs[0].tokens);assert.ok(BigInt(first.ledger.reserved_nano_usd)>0n);
  const retry=await runPilot({...opts,transport:async args=>{calls++;return success(args);}});assert.equal(retry.api_attempts_this_run,0);assert.equal(calls,1);
});
test('E-05: simultaneous process attempt is rejected by the persistent pilot lock',async()=>{
  const opts=await options('lock');let release,entered;
  const gate=new Promise(r=>{release=r;});const start=new Promise(r=>{entered=r;});
  const first=runPilot({...opts,transport:async args=>{entered();await gate;return success(args);}});await start;
  await assert.rejects(runPilot(opts),/pilot_busy/);release();assert.equal((await first).state,'complete');
});
test('E-06: invalid provider model, dimension, values and usage halt after one attempt',async()=>{
  const changes=[r=>r.body.model='wrong',r=>r.body.data[0].embedding.pop(),r=>r.body.data[0].embedding[0]=NaN,
    r=>r.body.data[0].embedding.fill(0),r=>delete r.body.usage,r=>r.body.usage.total_tokens++,r=>r.body.data[0].index=1];
  for(const [i,change] of changes.entries()) {
    const opts=await options(`invalid-${i}`);let calls=0;
    const result=await runPilot({...opts,transport:async args=>{calls++;const r=await success(args);change(r);return r;}});
    assert.equal(result.state,'stopped_unknown');assert.equal(calls,1);assert.equal(result.ledger.entries[0].status,'unknown');
    assert.equal(result.ledger.entries[0].reported_usage.validated,false);
  }
});
test('E-04/07: current policy is checked before every send and persisted vector corruption is rejected',async()=>{
  const opts=await options('revoke');const ownPolicy=new LocalPolicy({tenants:{[context.tenant]:{owner:['doc']}}});let calls=0;
  await assert.rejects(runPilot({...opts,policy:ownPolicy,transport:async args=>{calls++;ownPolicy.value.tenants[context.tenant].owner=[];return success(args);}}),/pilot_material_access_revoked/);
  assert.equal(calls,1);
  const good=await runPilot(await options('corrupt'));const entry=good.ledger.entries[0];
  const file=path.join(good.directory,entry.vector_file),data=JSON.parse(await fs.readFile(file));data.vector[1]=1;await fs.writeFile(file,JSON.stringify(data));
  await assert.rejects(StoredEmbedding.load(good.directory,context.tenant),/stored_vector_integrity_failed/);
});
test('E-14: real transport has one POST, fixed endpoint, float encoding and redirect rejection',async()=>{
  let calls=0;const previous=globalThis.fetch;
  globalThis.fetch=async(url,opts)=>{calls++;assert.equal(url,'https://api.openai.com/v1/embeddings');assert.equal(opts.redirect,'error');assert.equal(opts.method,'POST');
    const body=JSON.parse(opts.body);assert.deepEqual(Object.keys(body).sort(),['dimensions','encoding_format','input','model']);assert.equal(body.dimensions,3072);assert.equal(body.encoding_format,'float');
    return {ok:true,headers:{get:()=> 'synthetic-id'},json:async()=>response(body.input,realEmbeddingConfig()).body};};
  try {await openAITransport('synthetic-key')({text:'hello world',config:realEmbeddingConfig()});assert.equal(calls,1);}
  finally{globalThis.fetch=previous;}
});
test('E-08/09: compact context preserves source text and conditions with scoped resolvable short references',async()=>{
  const entry={evidence_id:'e',document_id:'doc',document_version_id:'v',unit_id:'u',chunk_id:'c',span_ids:['long-span-id'],pdf_pages:[3],source_text:'Keeld. 😀',
    bibliography:{title:'Title',authors:['Author'],publication_date:'2025-06-06'},source_metadata:{source_type:'journal_article',authority:'editorial',valid_from:null,valid_to:null},
    search_aids:{legacy_description:{value:'Unverified long description'}},limitations:[{code:'reference_list_not_visible',span_ids:['long-span-id']},{code:'description_not_verified',detail:'Unverified long description'}]};
  const packet={tenant:context.tenant,query_id:'query-one',generation_id:'g',evidence:[entry,{...entry,evidence_id:'e2',unit_id:'u2',chunk_id:'c2',source_text:'Helista 112.'}]};
  const p=modelProjection(packet.evidence,packet);packet.reference_map=p.references;
  assert.equal(p.context.evidence[0].text,entry.source_text);assert.equal(Object.keys(p.context.sources).length,1);
  assert.ok(!JSON.stringify(p.context).includes('long-span-id'));assert.ok(!JSON.stringify(p.context).includes('Unverified long description'));
  assert.equal(p.context.sources.D1.source_type,'journal_article');assert.equal(p.context.sources.D1.valid_to,null);
  assert.equal(p.context.sources.D1.limitations[0].code,'reference_list_not_visible');
  assert.equal((await resolveModelReference({packet,reference:'S1',queryId:packet.query_id,context,policy})).span_ids[0],'long-span-id');
  await assert.rejects(resolveModelReference({packet,reference:'S1',queryId:'other',context,policy}),/reference_scope_mismatch/);
  const denied=new LocalPolicy({tenants:{[context.tenant]:{owner:[]}}});await assert.rejects(resolveModelReference({packet,reference:'S1',queryId:packet.query_id,context,policy:denied}),/reference_access_denied/);
  assert.equal(modelProjection([],packet).measurements.model_context_tokens,0);
});
test('E-10: publication role is structural; short phone, deadline and prohibition remain evidence',()=>{
  const b={document:{fields:{journal_title:{value:'Journal X'},title:{value:'Article title'}}},sections:[{id:'root',parent_id:null},{id:'title',parent_id:'root',title:'Article title',span_ids:['title-span']}],
    spans:[{id:'label',pdf_page:1,start:1},{id:'title-span',pdf_page:1,start:20}]};
  const chunk={source_text:'Journal X',parent_section_id:'root',span_ids:['label']};assert.equal(structuralRole(chunk,b).evidence_eligible,false);
  for(const source_text of ['112','10 päeva','Keelatud','Ära avalda isikuandmeid']) assert.equal(structuralRole({...chunk,source_text},b).evidence_eligible,true);
});
test('E-12: an ID or page without supporting text does not cover an anchor group',()=>{
  const required=[{id:'g',alternatives:[{document_id:'d',version_id:'v',pdf_page:3,span_ids:['s'],contains:'piirang'},{document_id:'d',version_id:'v',pdf_page:4,span_ids:['s2'],contains:'erand'}]}];
  const wrong={document_id:'d',document_version_id:'v',pdf_pages:[3],span_ids:['s'],source_text:'No support here'};
  assert.equal(anchorCoverage([wrong],required)[0].covered,false);
  assert.equal(anchorCoverage([{...wrong,source_text:'piirang'}],required)[0].covered,true);
  assert.equal(anchorCoverage([{...wrong,source_text:'erand',pdf_pages:[4],span_ids:['s2']}],required)[0].covered,true);
});
test('Audit: Qdrant timeout remains a service failure eligible for explicit lexical degradation',async()=>{
  const previous=globalThis.fetch;
  globalThis.fetch=async()=>{throw new DOMException('synthetic timeout','TimeoutError');};
  try {await assert.rejects(new QdrantIndex('http://127.0.0.1:56333','synthetic-qdrant-key-long-enough').request('/'),e=>e.code==='qdrant_request_failed');}
  finally {globalThis.fetch=previous;}
});
