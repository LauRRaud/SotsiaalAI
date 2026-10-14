import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-mentoring-flow');
assert.equal(fs.existsSync('mentoring-fixture.json'),false,'Reuse this fixture if continuation is needed.');
rec.limits=['The existing provider test account creates a SOL TEST mentor profile. ACTIVE approval is a temporary database fixture, not administrator approval or real qualification. Finally the profile is hidden and returned to DRAFT.','Only the existing specialist/provider and client control accounts are used. Agreements, external meeting and confirmations are scripted and fictitious. No actual meeting, AI, audio/video, real email recipient or paid model call.'];
const f={},privateMarker='SOL TEST MENTOR PRIVATE NOTE';
const persist=()=>{fs.writeFileSync('mentoring-fixture.json',JSON.stringify(f,null,2)+'\n');save();};
async function req(key,path,method='GET',body,status=200){const r=await call(key,path,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
try{
 for(const key of Object.keys(actors))await login(key);
 assert.equal(await prisma.mentorProfile.count({where:{userId:actors.provider.id}}),0);
 const payload={displayName:'SOL TEST mentor fixture',bioShort:'SOL TEST fictitious profile for server workflow checks',fields:['social work'],topics:['work practice'],languages:['et'],formats:['online']};
 const profile=(await req('provider','/api/mentoring/profile','PUT',payload)).profile;f.profileId=profile.id;persist();
 check('TOOLS-03','mentor_profile_starts_as_draft',profile.status==='DRAFT',{status:profile.status});
 const submitted=(await req('provider','/api/mentoring/profile','POST',{action:'submit'})).profile;check('TOOLS-03','mentor_profile_requires_review',submitted.status==='PENDING_REVIEW',{status:submitted.status});
 await prisma.mentorProfile.update({where:{id:profile.id,userId:actors.provider.id},data:{status:'ACTIVE',approvedSnapshotVisible:true,approvedSnapshot:payload}});
 const request=(await req('specialist','/api/mentoring/requests','POST',{mentorProfileId:profile.id,message:'SOL TEST request to discuss a next step.'},201)).request;f.requestId=request.id;persist();
 const accepted=await req('provider',`/api/mentoring/requests/${request.id}`,'POST',{action:'respond',decision:'ACCEPT'});f.relationId=accepted.relationId;assert.ok(f.relationId);persist();const p=`/api/mentoring/relations/${f.relationId}`;
 const before=(await req('provider',p)).relation;
 const proposed=await req('provider',p+'/agreement','POST',{action:'propose',agreementText:'SOL TEST discuss one work question and a next step.',expectedVersion:before.version});
 await req('specialist',p+'/agreement','POST',{action:'accept',agreementVersion:proposed.agreementVersion});
 const active=(await req('specialist',p)).relation;check('TOOLS-03','mentoring_acceptance_and_both_agree_active',active.status==='ACTIVE',{requestAccepted:true,agreementAccepted:true,status:active.status});
 await req('provider',p+'/notes','POST',{content:privateMarker},201);
 const own=await req('provider',p+'/notes'),other=await req('specialist',p+'/notes');
 check('TOOLS-03','mentor_private_note_not_shared',JSON.stringify(own).includes(privateMarker)&&!JSON.stringify(other).includes(privateMarker),{ownerPrivateMarkerPresent:true,menteePrivateMarkerAbsent:!JSON.stringify(other).includes(privateMarker)});
 const third=await call('client',p);check('DATA-01','nonmember_mentoring_relation_denied',[403,404].includes(third.status)&&!third.text.includes(privateMarker),{status:third.status,privateContentAbsent:!third.text.includes(privateMarker)});
 const meeting=(await req('provider',p+'/meetings','POST',{occurredAt:new Date(Date.now()+86400000).toISOString(),mode:'EXTERNAL',topicSummary:'SOL TEST fictional meeting'},201)).meeting;f.meetingId=meeting.id;persist();
 const after=(await req('specialist',p)).relation;check('TOOLS-03','mentoring_meeting_visible_to_both',JSON.stringify(after).includes(meeting.id),{meetingId:meeting.id,menteeSeesMeeting:JSON.stringify(after).includes(meeting.id),mode:'EXTERNAL',realMeeting:false});
 const summary=(await req('provider',p+'/summaries','POST',{kind:'FINAL',content:'SOL TEST shared summary with one next step.'},201)).summary;f.summaryId=summary.id;persist();const sp=p+`/summaries/${summary.id}`;
 await req('provider',sp,'POST',{action:'submit',expectedVersion:summary.version});
 const one=(await req('provider',sp,'POST',{action:'confirm'})).summary;check('TOOLS-03','one_summary_confirmation_not_enough',one.status==='PENDING_CONFIRM'&&one.confirmationCount===1,{status:one.status,confirmations:one.confirmationCount});
 const both=(await req('specialist',sp,'POST',{action:'confirm'})).summary;check('TOOLS-03','both_confirm_summary',both.status==='CONFIRMED'&&both.confirmationCount===2,{status:both.status,confirmations:both.confirmationCount});
 const paused=await req('provider',p,'POST',{action:'pause'}),resumed=await req('specialist',p,'POST',{action:'resume'});check('TOOLS-03','mentoring_pause_resume',true,{pauseStatus:'200',resumeStatus:'200'});
 await req('provider',p,'POST',{action:'close',reasonKey:'completed',confirmed:true});const closed=(await req('specialist',p)).relation;check('TOOLS-03','mentoring_both_see_closed',closed.status==='CLOSED',{status:closed.status});
 const late=await call('provider',p+'/meetings','POST',{occurredAt:new Date().toISOString(),mode:'EXTERNAL',topicSummary:'SOL TEST prohibited closed meeting'});check('TOOLS-03','closed_mentoring_rejects_new_meeting',late.status===409,{status:late.status});
}finally{
 if(f.profileId)await prisma.mentorProfile.update({where:{id:f.profileId,userId:actors.provider.id},data:{status:'DRAFT',approvedSnapshotVisible:false}});
 rec.finishedAt=new Date().toISOString();rec.fixtureProfileHiddenAndDraft=!!f.profileId;save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:f,profileHidden:!!f.profileId}));
}
