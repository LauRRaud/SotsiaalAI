import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { createRagAccounting, AI_COST_METRIC } from '../lib/usage/ragAccounting.js';
import { createUsageService } from '../lib/usage/service.js';
import { getUserCostSnapshot } from '../lib/usage/costSnapshot.js';
import { PilotStore } from '../lib/rag-v2/pilot/store.js';
import { PilotService } from '../lib/rag-v2/pilot/service.js';
import { embeddingConfig } from '../lib/rag-v2/search/embedding.js';
import { retrievalProfile } from '../lib/rag-v2/search/profiles.js';

const url=new URL(process.env.M4_TEST_DATABASE_URL||'postgres://invalid/invalid');
if (!['localhost','127.0.0.1'].includes(url.hostname)||url.pathname!=='/sotsiaal_ai_m4_dev') throw Error('isolated M4_TEST_DATABASE_URL required');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:url.href}),log:[]});
test.after(()=>db.$disconnect());
const fx={usdPerEurMicros:1000000,date:'2026-10-08'};
const response={value:{kind:'grounded',blocks:[{text:'Synthetic source',factual:true,refs:['S1']}],limitations:[],clarification:null},
  usage:{input:1000,cachedInput:400,cacheWriteInput:500,output:200,reasoning:100},
  billing:{model:'gpt-6-luna',serviceTier:'default',responseId:'resp_synthetic'},requestId:'req_synthetic'};

async function fixture(t,{limit=3600000000n,role='CLIENT'}={}) {
  const id=randomUUID(),user=await db.user.create({data:{email:`cost-${id}@example.invalid`,role}});
  const plan=await db.planDefinition.create({data:{key:`cost_${id}`,name:'Isolated',role,price:'7.99',currency:'EUR',
    entitlements:{create:{metric:AI_COST_METRIC,period:'MONTHLY',hardLimit:limit}}}});
  await db.subscription.create({data:{userId:user.id,status:'ACTIVE',planDefinitionId:plan.id}});
  const conv=await db.conversation.create({data:{userId:user.id,role:'CLIENT',metadata:{m4:true}}});
  const config={id,configHash:id,accountProject:'proj_synthetic',tenant:'test',mode:'real',users:[user.id],documents:{doc1:'v1'},
    model:'gpt-6-luna',reasoning:'low',maxInputTokens:60000,maxOutputTokens:1000,retentionHours:1,
    embedding:embeddingConfig({embedding_mode:'real',provider:'openai',model:'text-embedding-3-large',dimensions:3072,endpoint:'https://api.openai.com/v1/embeddings'}),
    prices:{embeddingInput:130,answerInput:125,answerOutput:500},profile:retrievalProfile('vector-ranked-first-v1'),
    budget:{attempts:200,embeddingAttempts:100,answerAttempts:100,tokens:10000000,nanoUsd:1000000000}};
  const accounting=createRagAccounting(db,fx),store=new PilotStore(db,{accounting});
  const input={convId:conv.id,clientTurnKey:randomUUID(),question:'Synthetic test question',contextMode:'new'};
  const packet={tenant:'test',query_id:randomUUID(),reference_map:{S1:{document_id:'doc1',document_version_id:'v1',evidence_id:'e1',pdf_pages:[1]}},
    evidence:[{evidence_id:'e1',source_text:'Synthetic source',bibliography:{title:'Test'}}],model_context:{evidence:[{ref:'S1',text:'Synthetic source'}]}};
  const calls=[];
  const service=new PilotService({store,readConfig:async()=>config,adapters:{preflight:async()=>{},search:async()=>packet,canonical:async()=>{}},
    call:async({stage})=>{calls.push(stage);return stage==='embedding'?{...response,billing:{model:config.embedding.model},usage:{input:5,output:0},
      value:Array.from({length:3072},(_,i)=>i===0?1:0)}:response;}});
  t.after(async()=>{await db.user.deleteMany({where:{id:user.id}});await db.aiProviderCall.deleteMany({where:{projectId:'proj_synthetic',turnId:{in:turnIds}}});
    await db.planDefinition.delete({where:{id:plan.id}});await db.m4PilotLedger.deleteMany({where:{id}});});
  const turnIds=[];
  const claim=async()=>{const row=(await store.claim(config,user.id,{...input,clientTurnKey:randomUUID()})).row;turnIds.push(row.id);return row;};
  return {user,plan,conv,config,store,accounting,input,service,calls,claim,turnIds};
}

test('each paid role is metered; duplicated receipts refund exactly once and preserve the raw USD cost',async t=>{
  for(const role of ['CLIENT','SOCIAL_WORKER','SERVICE_PROVIDER']) {
    const f=await fixture(t,{role}),row=await f.claim();
    await f.store.reserve(f.config,row,'answer',{tokens:5000,nanoUsd:1000000},{});
    await f.store.sent(f.config,row,'answer');
    await Promise.all([f.accounting.settle(f.config,row,'answer',response),f.accounting.settle(f.config,row,'answer',response)]);
    await f.store.usage(f.config,row,'answer',response);await f.store.usage(f.config,row,'answer',response);
    const bucket=await db.usageBucket.findFirst({where:{userId:f.user.id}});
    assert.equal(bucket.reserved,0n);assert.equal(bucket.used,176500n);
    assert.equal((await db.m4PilotLedger.findUnique({where:{id:f.config.id}})).totals.nanoUsd,176500);
    const snapshot=await getUserCostSnapshot(db,f.user.id);assert.equal(snapshot.billedNanoUsd,'176500');assert.equal(snapshot.calls,1);
  }
});
test('concurrent requests across separate ledgers cannot overspend one user budget',async t=>{
  const f=await fixture(t,{limit:1000000n});const first=await f.claim(),second={...first,id:randomUUID()};f.turnIds.push(second.id);const rows=[first,second];
  const results=await Promise.allSettled(rows.map(row=>db.$transaction(tx=>f.accounting.reserve(tx,f.config,row,'answer',{nanoUsd:700000}))));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.find(x=>x.status==='rejected').reason.code,'USAGE_LIMIT_EXCEEDED');
  assert.equal((await db.usageBucket.findFirst({where:{userId:f.user.id}})).reserved,700000n);
});
test('unknown sent calls stay reserved; unsent work releases; real late receipt can settle after conversation deletion',async t=>{
  const f=await fixture(t),row=await f.claim();
  await f.store.reserve(f.config,row,'plan',{tokens:5000,nanoUsd:1000000},{});await f.store.sent(f.config,row,'plan');
  await f.accounting.settle(f.config,row,'plan',new Error('timeout'));
  await f.store.reserve(f.config,row,'answer',{tokens:5000,nanoUsd:1000000},{});
  await f.store.save(f.config,row,'stopped',{});
  assert.equal((await db.usageBucket.findFirst({where:{userId:f.user.id}})).reserved,1000000n);
  await db.conversation.delete({where:{id:f.conv.id}});
  await f.accounting.settle(f.config,row,'plan',response);
  const bucket=await db.usageBucket.findFirst({where:{userId:f.user.id}});
  assert.equal(bucket.used,176500n);assert.equal(bucket.reserved,0n);
  await db.user.delete({where:{id:f.user.id}});
  const receipt=await db.aiProviderCall.findUnique({where:{id:`${row.id}:plan`}});
  assert.equal(receipt.userId,null);assert.equal(receipt.billedNanoUsd,176500n);
});
test('actual overspend remains recorded and blocks future requests; it must not disappear when the bound was too small',async t=>{
  const f=await fixture(t,{limit:100000n}),row=await f.claim();
  await f.store.reserve(f.config,row,'answer',{tokens:5000,nanoUsd:10000},{});await f.store.sent(f.config,row,'answer');
  await f.accounting.settle(f.config,row,'answer',response);
  assert.equal((await db.usageBucket.findFirst({where:{userId:f.user.id}})).used,176500n);
  await assert.rejects(db.$transaction(tx=>f.accounting.reserve(tx,f.config,{id:randomUUID(),payload:row.payload},'answer',{nanoUsd:1})),{code:'USAGE_LIMIT_EXCEEDED'});
});
test('full RAG path charges provider calls once, reconnect is free, and exhaustion blocks before the first model call',async t=>{
  const f=await fixture(t);const result=await f.service.run(f.user.id,f.input);f.turnIds.push(result.id);
  assert.equal(result.state,'completed');await f.service.run(f.user.id,f.input);
  assert.deepEqual(f.calls,['embedding','answer']);
  assert.equal((await db.usageBucket.findFirst({where:{userId:f.user.id}})).used,177150n);
  const blocked=await fixture(t,{limit:1n});
  await assert.rejects(blocked.service.run(blocked.user.id,blocked.input),{code:'USAGE_LIMIT_EXCEEDED'});
  assert.equal(blocked.calls.length,0);
});
test('cost reservation and RAG reservation roll back together on durable write failure',async t=>{
  const f=await fixture(t),row=await f.claim();
  await assert.rejects(db.$transaction(async tx=>{await f.accounting.reserve(tx,f.config,row,'answer',{nanoUsd:500000});throw Error('rollback');}));
  assert.equal(await db.aiProviderCall.count({where:{userId:f.user.id}}),0);
  assert.equal(await db.usageBucket.count({where:{userId:f.user.id}}),0);
  const usage=createUsageService({prismaClient:db});
  await assert.rejects(usage.reserve({userId:f.user.id,metric:'CHAT_ASSISTANT_REPLY',idempotencyKey:'no-unrelated-entitlement'}),{code:'USAGE_NOT_ENTITLED'});
});

test('unsent stale reservations are released across plan renewals and cannot subsequently be sent',async t=>{
  const f=await fixture(t),row=await f.claim();
  await f.store.reserve(f.config,row,'answer',{tokens:5000,nanoUsd:1000000},{});
  await db.aiProviderCall.update({where:{id:`${row.id}:answer`},data:{createdAt:new Date(Date.now()-600000)}});
  await f.accounting.sweepUnsent(f.user.id);
  assert.equal((await db.usageBucket.findFirst({where:{userId:f.user.id}})).reserved,0n);
  await assert.rejects(f.store.sent(f.config,row,'answer'),{code:'cost_reservation_not_active'});
});

test('session revocation during a paid call withholds the answer but preserves incurred cost',async t=>{
  const f=await fixture(t);let allowed=true;
  f.service.readConfig=async()=>{if(!allowed)throw Object.assign(Error('revoked'),{code:'revoked'});return f.config;};
  const call=f.service.call;f.service.call=async args=>{const result=await call(args);allowed=false;return result;};
  await assert.rejects(f.service.run(f.user.id,f.input),{code:'revoked'});
  const receipts=await db.aiProviderCall.findMany({where:{userId:f.user.id}});f.turnIds.push(...receipts.map(x=>x.turnId));
  assert.equal(receipts.length,1);assert.equal(receipts[0].state,'settled');assert.equal(receipts[0].billedNanoUsd,650n);
  assert.equal(await db.conversationMessage.count({where:{conversationId:f.conv.id}}),0);
});

test('monthly EUR capacity resets while a late September charge stays in its original month',async t=>{
  const f=await fixture(t,{limit:1000n}),usage=createUsageService({prismaClient:db});
  const common={userId:f.user.id,metric:AI_COST_METRIC,amount:1000};
  await usage.reserve({...common,idempotencyKey:'september',now:new Date('2026-09-30T20:59:00Z')});
  await usage.reserve({...common,idempotencyKey:'october',now:new Date('2026-09-30T21:01:00Z')});
  await usage.commit({userId:f.user.id,idempotencyKey:'september',actualAmount:100,now:new Date('2026-10-01T00:00:00Z')});
  const buckets=await db.usageBucket.findMany({where:{userId:f.user.id},orderBy:{periodStart:'asc'}});
  assert.deepEqual(buckets.map(b=>[b.used,b.reserved]),[[100n,0n],[0n,1000n]]);
});

test('an administrator uses the internal monetary entitlement despite a personal paid subscription',async t=>{
  const f=await fixture(t,{role:'ADMIN'});
  const adminPlan=await db.planDefinition.create({data:{key:'admin_internal',name:'Isolated admin',role:'ADMIN',version:999999,price:'0',
    entitlements:{create:{metric:AI_COST_METRIC,period:'MONTHLY',hardLimit:12000000000n}}}});
  t.after(()=>db.planDefinition.delete({where:{id:adminPlan.id}}));
  const entitlement=await createUsageService({prismaClient:db}).resolveEntitlement({userId:f.user.id,metric:AI_COST_METRIC});
  assert.equal(entitlement.hardLimit,12000000000n);assert.equal(entitlement.planDefinitionId,adminPlan.id);
});
