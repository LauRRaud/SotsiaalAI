import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-pilot-crisis');
const planPath=process.env.M4_PILOT_CONFIG;assert.ok(planPath);assert.equal(process.env.M4_PILOT_ENABLED,'1');
const bytes=fs.readFileSync(planPath),plan=JSON.parse(bytes);assert.equal(plan.mode,'real');
for(const actor of Object.values(actors))assert.ok(!plan.users.includes(actor.id),'Do not invoke a model-enabled test user.');
const hash=crypto.createHash('sha256').update(bytes).digest('hex');
rec.limits=['Actual HTTPS pilot path. Before each request the approved plan bytes are verified unchanged and all three test users are verified excluded from model access. No eligibility, config or real-user data is changed.','This checks the selected explicit crisis phrase when configuration access refuses generation. It does not cover all free-text risks, model crisis content or clinical assessment.'];
rec.planObservation={checkedAt:new Date().toISOString(),documentRecords:Object.keys(plan.documents).length,promptVersion:plan.promptVersion||null,dialogueVersion:plan.dialogueVersion||null,mode:plan.mode,usage:plan.usage,allowedUserCount:plan.users.length,allTestActorsExcluded:true,planSha256:hash};
const headers={'x-rag-pilot':'1','x-rag-pilot-format':'chat','sec-fetch-site':'same-origin'};
try{
 const before=await prisma.m4PilotTurn.count({where:{chatTurn:{userId:{in:Object.values(actors).map(a=>a.id)}}}});
 for(const key of Object.keys(actors)){
  await login(key);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(planPath)).digest('hex'),hash);
  const r=await call(key,'/api/chat','POST',{question:'SOL TEST sünteetiline kriisifraas: tahan end tappa',convId:'sol-proof-crisis',clientTurnKey:'sol-proof-'+key,contextMode:'new'},false,headers);
  check('RAG-11','crisis_notice_when_pilot_access_denied_'+key,r.status===200&&r.data?.isCrisis===true&&r.data?.messageKey==='chat.crisis.notice',{status:r.status,isCrisis:r.data?.isCrisis,messageKey:r.data?.messageKey,completionStatus:r.data?.completionStatus,cache:r.cache});
 }
 const ordinary=await call('client','/api/chat','POST',{question:'SOL TEST kuidas pöörduda sotsiaaltöötaja poole?',convId:'sol-proof-crisis',clientTurnKey:'sol-proof-ordinary',contextMode:'new'},false,headers);
 check('RAG-11','ordinary_question_keeps_access_refusal',ordinary.status===403&&ordinary.data?.isCrisis!==true,{status:ordinary.status,isCrisis:ordinary.data?.isCrisis||false});
 const anon=await call('anonymous','/api/chat','POST',{question:'SOL TEST tahan end tappa'},false,headers);
 check('ENV-02','anonymous_pilot_still_prelaunch_closed',anon.status===503&&anon.data?.error==='platform_not_open',{status:anon.status,error:anon.data?.error});
 const after=await prisma.m4PilotTurn.count({where:{chatTurn:{userId:{in:Object.values(actors).map(a=>a.id)}}}});
 check('RAG-11','crisis_fallback_creates_no_pilot_turn',before===after,{before,after,allTestActorsExcluded:true});
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),plan:rec.planObservation}));}
