import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-journey-lifecycle');
try{
 for(const key of Object.keys(actors))await login(key);
 const created=await call('client','/api/journeys','POST',{clientActionId:crypto.randomUUID(),title:'SOL TEST: sammude ja enda hinnangu teekond',summary:'Soovin testtelefoni iseseisvalt kasutada.',context:{personWish:'SOL TEST PRIVATE JOURNEY NOTE'}});
 assert.equal(created.status,201,JSON.stringify(created.data));const jid=created.data.journey.id;rec.created.journeyId=jid;save();
 const step=await call('client',`/api/journeys/${jid}/steps`,'POST',{clientActionId:crypto.randomUUID(),title:'SOL TEST: proovin juhendatud sammu',doer:'Mina',dueOn:'2026-10-15'});
 assert.equal(step.status,201,JSON.stringify(step.data));const sid=step.data.stepId;assert.ok(sid);rec.created.stepId=sid;
 const done=await call('client',`/api/journeys/${jid}/steps/${sid}`,'PATCH',{state:'DONE',note:'SOL TEST: sain juhendamisel hakkama'});
 const stored=await prisma.journeyStep.findUnique({where:{id:sid},select:{state:true,doneAt:true,doer:true,dueOn:true}});
 check('FLOW-04','http_step_completed_with_doer_and_due',done.status===200&&stored.state==='DONE'&&!!stored.doneAt&&stored.doer==='Mina',{httpStatus:done.status,...stored});
 for(const level of [1,4]){
  const r=await call('client',`/api/journeys/${jid}/assessments`,'POST',{clientActionId:crypto.randomUUID(),level,note:'SOL TEST inimese enda hinnang'});
  assert.equal(r.status,201,JSON.stringify(r.data));
 }
 const assessments=await prisma.journeyAssessment.findMany({where:{journeyId:jid,ownerUserId:actors.client.id},orderBy:{createdAt:'asc'},select:{level:true,note:true,createdAt:true}});
 check('FLOW-04','http_two_self_assessments_retained',assessments.length===2&&assessments[0].level===1&&assessments[1].level===4&&assessments.every(x=>x.createdAt),{assessments,causalEffectNotInferred:true});
 const ownExport=await call('client',`/api/journeys/${jid}/export`);
 check('DATA-01','owner_journey_export_permitted',ownExport.status===200&&ownExport.text.includes('SOL TEST PRIVATE JOURNEY NOTE'),{status:ownExport.status,ownPrivateContextPresent:ownExport.text.includes('SOL TEST PRIVATE JOURNEY NOTE')});
 for(const key of ['specialist','provider']){
  const read=await call(key,`/api/journeys/${jid}/export`),write=await call(key,`/api/journeys/${jid}/steps/${sid}`,'PATCH',{state:'TODO'});
  check('DATA-01','foreign_journey_export_and_step_'+key,read.status===404&&write.status===404&&!read.text.includes('SOL TEST PRIVATE JOURNEY NOTE'),{exportStatus:read.status,writeStatus:write.status,privateNoteAbsent:!read.text.includes('SOL TEST PRIVATE JOURNEY NOTE')});
 }
 const before=await call('client',`/api/journeys/${jid}`);const expected=before.data.journey.updatedAt;
 const edit=await call('client',`/api/journeys/${jid}`,'PATCH',{summary:'SOL TEST täpsustatud eesmärk',expectedUpdatedAt:expected});assert.equal(edit.status,200);
 const stale=await call('client',`/api/journeys/${jid}`,'PATCH',{summary:'SOL TEST vana vaate ülekirjutus',expectedUpdatedAt:expected});
 check('FLOW-04','stale_journey_change_rejected',stale.status===409,{status:stale.status,message:stale.data?.message});
 const current=await call('client',`/api/journeys/${jid}`);
 const archived=await call('client',`/api/journeys/${jid}`,'PATCH',{status:'ARCHIVED',expectedUpdatedAt:current.data.journey.updatedAt});
 const denied=await call('client',`/api/journeys/${jid}/steps`,'POST',{clientActionId:crypto.randomUUID(),title:'SOL TEST pärast arhiveerimist'});
 const readable=await call('client',`/api/journeys/${jid}`);
 check('FLOW-04','archived_journey_readable_but_not_writable',archived.status===200&&readable.data?.journey?.status==='ARCHIVED'&&denied.status===409,{archiveStatus:archived.status,readStatus:readable.status,journeyStatus:readable.data?.journey?.status,newStepStatus:denied.status,stepsStillPresent:!!readable.data?.journey?.steps});
 fs.writeFileSync('journey-lifecycle-fixture.json',JSON.stringify({runId:rec.runId,journeyId:jid,stepId:sid,finalStatus:'ARCHIVED'},null,2)+'\n');
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created}));}
