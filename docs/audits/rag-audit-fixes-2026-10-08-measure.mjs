// Isolated synthetic measurement. The wrapper first checks the active release plan without an overlay.
// Historical config is read here, then explicitly overridden for this authorized, separately budgeted experiment.
import fs from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { PrismaClient } from './generated/prisma/client.ts';
import { PrismaPg } from '@prisma/adapter-pg';
import { readPilotConfig } from './lib/rag-v2/pilot/config.js';
import { PilotStore } from './lib/rag-v2/pilot/store.js';
import { PilotService } from './lib/rag-v2/pilot/service.js';
import { providerCall } from './lib/rag-v2/pilot/provider.js';
import { runtimeAdapters } from './lib/rag-v2/pilot/retrieval.js';
import { municipalDirectoryAdapter } from './lib/rag-v2/adapters/municipal-directory.js';
import { createRagAccounting, AI_COST_METRIC } from './lib/usage/ragAccounting.js';
import { getCostExchangeRate } from './lib/usage/exchangeRate.js';
const cases=JSON.parse(Buffer.from('__CASES__','base64').toString('utf8'));
const phase='__PHASE__';
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL}),log:[]});
const users=[],turnIds=[];
const result={measuredAt:new Date().toISOString(),release:process.cwd().split('/').at(-1),phase,synthetic:true,
  casesHash:digest(cases),phaseLimitNanoUsd:150000000,priorNanoUsd:565613105,turns:[]};
result.runtimeModuleHashes=JSON.parse(process.env.RERANK_MEASURE_OVERLAY_HASHES||'{}');
let config;
try {
  const disk=JSON.parse(fs.readFileSync(process.env.M4_PILOT_CONFIG,'utf8'));
  const active=await readPilotConfig(disk.users[0],{purpose:'read'});assert.equal(active.mode,'real');
  result.generationId=active.generationId;result.searchAssist=active.searchAssist;result.promptVersion=active.promptVersion;
  const id=`m4-rerank-measure-${randomUUID()}`;
  const account=[];
  for(const [role,userRole] of cases.roles) {
    const plan=await db.planDefinition.findFirst({where:{role,active:true,price:{gt:0}},orderBy:{version:'desc'},include:{entitlements:true}});
    assert(plan?.entitlements.some(e=>e.metric===AI_COST_METRIC&&e.hardLimit>0n));
    const user=await db.user.create({data:{email:`rerank-measure-${randomUUID()}@example.invalid`,role}});users.push(user.id);
    await db.subscription.create({data:{userId:user.id,status:'ACTIVE',planDefinitionId:plan.id}});
    account.push({role,userRole,id:user.id});
  }
  config={...active,id,configHash:randomUUID(),users:[...users],budgetLedger:undefined,
    searchAssist:'rag-v2/search-assist-12',promptVersion:'m4-grounded-dialogue-37',rerankCachePolicy:undefined,
    expiresAt:new Date(Date.now()+30*60000).toISOString(),retentionHours:1,auditDays:1,
    budget:{...active.budget,attempts:60,embeddingAttempts:15,answerAttempts:15,planAttempts:15,rerankAttempts:15,tokens:4000000,nanoUsd:result.phaseLimitNanoUsd}};
  result.searchAssist=config.searchAssist; result.promptVersion=config.promptVersion;
  assert(result.priorNanoUsd+result.phaseLimitNanoUsd<=1000000000);
  const fx=await getCostExchangeRate(db);result.exchangeRate=fx;
  const accounting=createRagAccounting(db,fx);
  const store=new PilotStore(db,{accounting});store.purgeDue=async()=>{};
  for(const accountEntry of account) for(const scenario of cases.scenarios) {
    const conv=await db.conversation.create({data:{userId:accountEntry.id,role:accountEntry.role,metadata:{m4:true}}});
    for(const [turnIndex,question] of scenario.turns.entries()) {
      const entry={role:accountEntry.role,userRole:accountEntry.userRole,scenario:scenario.id,turnIndex,question:question.text,
        contextMode:question.mode,streamingChunks:0,providers:[]};result.turns.push(entry);
      const readConfig=async()=>config;
      const call=async args=>{
        const started=Date.now();let response;
        try {response=await providerCall(args);return response;}
        finally {
          const input=args.stage==='rerank'?Object.assign({},...args.body.input.map(message=>JSON.parse(typeof message.content==='string'?message.content:message.content.map(block=>block.text).join('')))):null;
          entry.providers.push({stage:args.stage,elapsedMs:Date.now()-started,input,
            answerInput:args.stage==='answer'?args.body.input:undefined,
            requestBodyHash:createHash('sha256').update(JSON.stringify(args.body)).digest('hex'),
            draft:args.stage==='answer'?response?.value?.dialogue_state:undefined,
            draftAnswer:args.stage==='answer'?response?.value:undefined,
            instructionsHash:createHash('sha256').update(args.body.instructions||'').digest('hex'),
            usage:response?.usage,requestId:response?.requestId,billing:response?.billing,
            selected:args.stage==='rerank'?response?.value.useful:undefined});
        }
      };
      const service=new PilotService({store,readConfig,adapters:runtimeAdapters(readConfig,accountEntry.id,municipalDirectoryAdapter(db)),call});
      const input={convId:conv.id,clientTurnKey:randomUUID(),contextMode:question.mode,language:'et',userRole:accountEntry.userRole,question:question.text};
      const started=Date.now();
      try {
        const answer=await service.run(accountEntry.id,input,{onAnswerText:()=>entry.streamingChunks++});
        entry.state=answer.state;entry.answer=answer.answer;entry.sources=answer.sources;
        const row=await store.existing(config,accountEntry.id,input);entry.searchAssist=row.payload.searchAssist;
        entry.evidence=row.payload.packet?.evidence;entry.references=row.payload.packet?.reference_map;
        entry.context=row.payload.context;entry.dialogueState=row.payload.dialogueState;entry.timings=row.payload.timings;
        entry.assistFailures=row.payload.searchAssist?.failures;
        turnIds.push(row.id);entry.turnId=row.id;
        const before=await db.aiProviderCall.count({where:{turnId:row.id}});
        const replay=await service.run(accountEntry.id,input);
        entry.replayNoNewCalls=before===await db.aiProviderCall.count({where:{turnId:row.id}});assert(entry.replayNoNewCalls);assert.equal(replay.id,row.id);
      } catch(error){entry.error=String(error.code||error.name||'measurement_failed');
        if(error.pilotTurnId){entry.turnId=error.pilotTurnId;turnIds.push(error.pilotTurnId);
          const stopped=await store.existing(config,accountEntry.id,input); entry.validation=stopped.payload.responseAudit?.validation;
          entry.evidence=stopped.payload.packet?.evidence;entry.references=stopped.payload.packet?.reference_map;}
      }
      entry.elapsedMs=Date.now()-started;
      if(entry.turnId) {
        const receipts=await db.aiProviderCall.findMany({where:{turnId:entry.turnId},orderBy:{createdAt:'asc'}});
        entry.receipts=receipts.map(r=>({stage:r.stage,state:r.state,requestId:r.requestId,usage:r.usage,pricing:r.pricing,
          billedNanoUsd:r.billedNanoUsd?.toString()??null,billedNanoEur:r.billedNanoEur?.toString()??null,reservedNanoUsd:r.reservedNanoUsd.toString()}));
        entry.nanoUsd=receipts.reduce((sum,r)=>sum+(r.billedNanoUsd||0n),0n).toString();
        if(receipts.some(receipt=>receipt.state!=='settled'))entry.error='unpriced_call';
      }
      const ledger=await db.m4PilotLedger.findUnique({where:{id:config.id}});result.ledger=ledger?.totals;
      console.log('MEASURE_PROGRESS '+JSON.stringify({phase,role:entry.role,scenario:entry.scenario,turnIndex,state:entry.state,error:entry.error,
        nanoUsd:entry.nanoUsd,elapsedMs:entry.elapsedMs}));
      if(entry.error&&entry.error!=='invalid_answer_reference') throw Object.assign(Error(entry.error),{code:entry.error});
    }
  }
  result.nanoUsd=result.turns.reduce((sum,r)=>sum+BigInt(r.nanoUsd||0),0n).toString();
  assert(BigInt(result.nanoUsd)<=BigInt(result.phaseLimitNanoUsd));
} catch(error){result.error=String(error.code||error.name||'measurement_failed');}
finally {
  const allReceipts=await db.aiProviderCall.findMany({where:{userId:{in:users}},select:{turnId:true,billedNanoUsd:true,state:true}});
  for(const receipt of allReceipts) if(!turnIds.includes(receipt.turnId))turnIds.push(receipt.turnId);
  result.nanoUsd=allReceipts.reduce((sum,r)=>sum+(r.billedNanoUsd||0n),0n).toString();
  result.unknownCalls=allReceipts.filter(r=>!['settled','not_sent'].includes(r.state)).length;
  await db.user.deleteMany({where:{id:{in:users},email:{endsWith:'@example.invalid'}}});
  result.cleanup={syntheticUsersRemaining:await db.user.count({where:{id:{in:users}}}),
    receiptsRetained:await db.aiProviderCall.count({where:{turnId:{in:turnIds},userId:null}})};
  if(config)await db.m4PilotLedger.deleteMany({where:{id:config.id}});
  await db.$disconnect();
  await new Promise(resolve=>process.stdout.write('MEASURE_RESULT '+JSON.stringify(result)+'\n',resolve));process.exit(0);
}
