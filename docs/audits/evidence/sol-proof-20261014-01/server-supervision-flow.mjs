import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-supervision-flow');
assert.equal(fs.existsSync('supervision-fixture.json'),false,'Reuse an existing fixture for continuation.');
rec.limits=['Supervisor eligibility is an explicit one-hour synthetic grant to the existing specialist; no real qualification or platform admin approval is asserted. The grant is revoked in finally.','Only the three test accounts, fictitious contract/topics/meeting and scripted confirmations are used. No AI, audio/video, real invite recipient or substantive supervision quality assessment.'];
const f={},marker='SOL TEST SUPERVISION PRIVATE NOTE';let grant;
const persist=()=>{fs.writeFileSync('supervision-fixture.json',JSON.stringify(f,null,2)+'\n');save();};
async function req(key,path,method='GET',body,status=200){const r=await call(key,path,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
try{
 for(const key of Object.keys(actors))await login(key);
 grant=await prisma.supervisorGrant.create({data:{userId:actors.specialist.id,grantBasis:'SOL TEST eligibility fixture; not a real qualification',validUntil:new Date(Date.now()+3600000)}});f.grantId=grant.id;persist();
 const c=await req('specialist','/api/supervision/processes','POST',{type:'INDIVIDUAL',title:'SOL TEST full supervision',goal:'SOL TEST practical next step',plannedMeetingCount:1},201);f.processId=c.process.id;persist();const p=`/api/supervision/processes/${f.processId}`;
 const get=async(key='specialist')=>(await req(key,p)).process;
 const contract=(await req('specialist',p+'/contract-versions','POST',{body:'SOL TEST fictitious contract: one meeting and a confirmed summary.'},201)).contractVersion;f.contractId=contract.id;persist();
 await req('specialist',p+`/contract-versions/${contract.id}/activate`,'POST',{expectedVersion:(await get()).version});
 const invited=(await req('specialist',p+'/invites','POST',{userId:actors.provider.id},201)).process;
 const part=invited.participants.find(x=>x.userId===actors.provider.id);assert.ok(part);f.participationId=part.id;persist();
 await req('provider',`/api/supervision/participations/${part.id}/respond`,'POST',{action:'accept',contractVersionId:contract.id});
 const active=await get('provider');check('TOOLS-03','supervision_contract_invite_accept_active',active.status==='ACTIVE'&&active.myParticipation.hasAcceptedActiveContract,{status:active.status,acceptedContract:active.myParticipation.hasAcceptedActiveContract});
 await req('provider',p+'/private-items','POST',{kind:'PRIVATE_NOTE',title:'SOL TEST private preparation',body:marker},201);
 const own=await req('provider',p+'/private-items'),other=await req('specialist',p+'/private-items');
 check('TOOLS-03','supervision_participant_note_private',JSON.stringify(own).includes(marker)&&!JSON.stringify(other).includes(marker),{ownerMarkerPresent:JSON.stringify(own).includes(marker),supervisorMarkerAbsent:!JSON.stringify(other).includes(marker)});
 const outside=await call('client',p);check('DATA-01','nonparticipant_supervision_denied',[403,404].includes(outside.status)&&!outside.text.includes(marker),{status:outside.status,privateMarkerAbsent:!outside.text.includes(marker)});
 const topic=(await req('provider',p+'/topics','POST',{title:'SOL TEST shared topic',body:'SOL TEST agreed topic only',audience:'PROCESS'},201)).topic;
 const meeting=(await req('specialist',p+'/meetings','POST',{plannedAt:new Date().toISOString()},201)).meeting;f.meetingId=meeting.id;persist();
 await req('specialist',`/api/supervision/meetings/${meeting.id}`,'PATCH',{status:'HELD',heldAt:new Date().toISOString(),note:'SOL TEST fictional meeting',agendaTopicIds:[topic.id],expectedVersion:meeting.version});
 const visible=await get('provider');check('TOOLS-03','supervision_shared_topic_and_held_meeting',visible.topics.some(t=>t.id===topic.id)&&visible.meetings.some(m=>m.id===meeting.id&&m.status==='HELD'),{topicVisible:true,meetingStatus:visible.meetings.find(m=>m.id===meeting.id)?.status});
 for(const kind of ['MEETING','FINAL']){
  const summary=(await req('specialist',p+'/summaries','POST',{kind,body:'SOL TEST agreed summary: one next step.',...(kind==='MEETING'?{meetingId:meeting.id}:{})},201)).summary;
  await req('specialist',`/api/supervision/summaries/${summary.id}/submit`,'POST',{expectedVersion:summary.version});
  const approved=(await req('provider',`/api/supervision/summaries/${summary.id}/approve`,'POST',{})).summary;
  check('TOOLS-03','supervision_'+kind+'_summary_approved',approved.status==='APPROVED',{status:approved.status});
 }
 const preview=(await req('specialist',p+'/close-preview')).preview;check('TOOLS-03','supervision_close_preview_ready',preview.canClose===true,{canClose:preview.canClose,pending:preview.pendingSummaryIds});
 const closed=(await req('specialist',p+'/close','POST',{expectedVersion:(await get()).version,generalizedTitle:'SOL TEST generalized supervision'})).process;
 const so=await req('specialist','/api/supervision/outcomes'),po=await req('provider','/api/supervision/outcomes');
 check('TOOLS-03','supervision_both_see_closed_outcome',closed.status==='CLOSED'&&JSON.stringify(so).includes(f.processId)&&JSON.stringify(po).includes(f.processId),{status:closed.status,supervisorOutcomePresent:true,participantOutcomePresent:true});
 const late=await call('provider',p+'/topics','POST',{title:'SOL TEST late topic',body:'SOL TEST should not enter closed process',audience:'PROCESS'});
 check('TOOLS-03','closed_supervision_rejects_new_topic',late.status===409,{status:late.status});
}finally{
 if(grant)await prisma.supervisorGrant.update({where:{id:grant.id},data:{revokedAt:new Date(),revokedByUserId:actors.specialist.id}});
 rec.finishedAt=new Date().toISOString();rec.syntheticGrantRevoked=!!grant;save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:f,grantRevoked:!!grant}));
}
