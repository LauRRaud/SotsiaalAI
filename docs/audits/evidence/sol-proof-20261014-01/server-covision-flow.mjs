import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-covision-flow');
const {COVISION_STAGE_PROGRESS_PHASES:phases,COVISION_STAGE_COMPLETION_PHASES:ends}=await import(pathToFileURL(root+'/lib/covisionSessionShared.js'));
assert.equal(fs.existsSync('covision-fixture.json'),false,'Resume this run fixture instead of creating a new case.');
rec.actions=[];rec.limits=['Reuses the reviewed eight-stage local audit logic with this run and actual server normal-role accounts. No AI, audio, video or human professional quality assessment.','Only synthetic specialist and provider participate; the client is a role-denial control. Invitation delivery to real people is not tested.'];
const privateMarker='SOL TEST COV PRIVATE DIRECTION';
const stages={
 2:[['SUBMIT_WORK_ITEM','specialist','case_anchor',{text:'SOL TEST next small step?'},'shared'],['SAVE_PRIVATE_STATE','specialist','case_anchor',{ownerPictureConfirmed:true,ownerFocusConfirmed:true,privacyReviewed:true}]],
 3:[['SUBMIT_WORK_ITEM','provider','question',{text:'SOL TEST what is within your control?',answer:'Check one channel.'},'answered'],['SAVE_PRIVATE_STATE','specialist','question',{ownerEnough:true}]],
 4:[['SUBMIT_WORK_ITEM','provider','reflection',{text:'SOL TEST a smaller step could help.'},'shared'],['SAVE_PRIVATE_STATE','specialist','reflection',{ownerReady:true}]],
 5:[['SUBMIT_WORK_ITEM','provider','possibility',{text:'SOL TEST check one channel.'},'shared'],['SAVE_PRIVATE_STATE','specialist','possibility',{ownerResonanceReady:true}]],
 6:[['SUBMIT_WORK_ITEM','provider','resource',{text:'SOL TEST time and a public channel are available.'},'shared'],['SAVE_PRIVATE_STATE','specialist','resource',{impactReviewed:true,ownerReady:true}]],
 7:[['SAVE_PRIVATE_STATE','specialist','selected_direction',{text:privateMarker}],['SAVE_PRIVATE_STATE','specialist','next_step',{nextStep:{text:'SOL TEST check one public contact.',actorType:'owner',withinOwnerInfluence:true},timeframe:'Within one week'}],['SAVE_PRIVATE_STATE','specialist','progress_marker',{text:'SOL TEST contact identified.'}],['SAVE_PRIVATE_STATE','specialist','follow_up',{followUp:{when:'Next session',responsibleParty:'owner',channel:'platform'},ownerConfirmed:true}]],
 8:[['SUBMIT_WORK_ITEM','specialist','owner_package',{text:'SOL TEST next step reviewed.'},'owner_confirmed'],['SAVE_PRIVATE_STATE','specialist','owner_package',{packageConfirmed:true,followUpConfirmed:true,generalizationDecision:'not_retained',learningDecision:'skipped',retentionDecision:'retain',practiceDecision:'skip',ownerFinalConfirmed:true}]]
};
try{
 for(const key of Object.keys(actors))await login(key);
 const created=await call('specialist','/api/covision','POST',{title:'SOL TEST eight-stage covision',anonymizedDescription:'SOL TEST fictitious case: find one practical next step.',centralQuestion:'SOL TEST what next?',anonymityConfirmed:true,participants:[{email:actors.provider.email,role:'participant'}]});
 assert.equal(created.status,201,JSON.stringify(created.data));const id=created.data.case.id;rec.created.caseId=id;fs.writeFileSync('covision-fixture.json',JSON.stringify({caseId:id})+'\n');save();
 let state=(await call('specialist',`/api/covision/${id}/session`)).data.session;
 async function act(action,payload={},who='specialist'){
  const r=await call(who,`/api/covision/${id}/session/actions`,'POST',{action,expectedVersion:state.version,payload});
  rec.actions.push({stage:state.stage,phase:state.phase,action,who,status:r.status});save();assert.equal(r.status,200,JSON.stringify(r.data));state=r.data.session;return r;
 }
 await act('START_SESSION');await act('CONFIRM_CASE');await act('CONFIRM_SETTINGS',{settings:{durationMinutes:30}});
 await act('CONFIRM_PARTICIPANT',{present:true,roleConfirmed:true,agreementConfirmed:true,ready:true});await act('CONFIRM_PARTICIPANT',{present:true,roleConfirmed:true,agreementConfirmed:true,ready:true},'provider');
 const outsider=await call('client',`/api/covision/${id}/session`);
 check('DATA-01','client_cannot_read_professional_covision',[403,404].includes(outsider.status),{status:outsider.status});
 await act('PAUSE');await act('RESUME');
 const msg=await call('provider',`/api/covision/${id}/messages`,'POST',{body:'SOL TEST shared group text',messageType:'free_text'});
 const messages=await call('specialist',`/api/covision/${id}/messages`);
 check('TOOLS-05','covision_text_reaches_other_participant',msg.status===201&&messages.status===200&&messages.text.includes('SOL TEST shared group text'),{writeStatus:msg.status,readStatus:messages.status,sharedTextVisible:messages.text.includes('SOL TEST shared group text')});
 for(let stage=1;stage<=8;stage++){
  assert.equal(state.stage,stage);
  for(const [action,who,kind,content,status] of stages[stage]||[])await act(action,{stage,kind,content,...(status?{status}:{})},who);
  if(stage===7){const own=await call('specialist',`/api/covision/${id}/session`),other=await call('provider',`/api/covision/${id}/session`);check('TOOLS-03','covision_owner_private_direction_not_shared',own.text.includes(privateMarker)&&!other.text.includes(privateMarker),{ownerPrivateMarkerPresent:own.text.includes(privateMarker),participantMarkerAbsent:!other.text.includes(privateMarker)});}
  for(const phase of phases[stage].slice(Math.max(0,phases[stage].indexOf(state.phase))+1))await act('SET_PHASE',{phase});
  await act('COMPLETE_STAGE',{stage,phase:ends[stage],evidence:{}});
  check('TOOLS-03','covision_stage_'+stage+'_completed',true,{nextStage:state.stage,phase:state.phase,version:state.version,snapshots:state.stageSnapshots?.length});
 }
 const other=await call('provider',`/api/covision/${id}/session`);
 check('TOOLS-03','covision_both_see_final_state',state.phase==='complete'&&other.data.session?.phase==='complete',{ownerPhase:state.phase,participantPhase:other.data.session?.phase});
 rec.observations=[{case_id:'TOOLS-05',status:'NOT_PROVEN',note:'Text path was tested. Microphone refusal, real two-session audio, reconnection and participant removal were not exercised.'}];
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,actions:rec.actions.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created}));}
