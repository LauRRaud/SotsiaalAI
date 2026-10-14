import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-homecare-flow');
const f=JSON.parse(fs.readFileSync('intake-fixture.json','utf8'));
const oid=f.organizationId,mid=f.coordinatorMembershipId,base=`/api/org/${oid}/koduteenus`;
const orgBefore=await prisma.organization.findUnique({where:{id:oid}});
assert.equal(orgBefore.displayName,'SOL TEST — sünteetiline vastuvõtutiim');
assert.equal(process.env.HOME_CARE_ENABLED,'1');
const resume=fs.existsSync('homecare-fixture.json');
if(resume){Object.assign(rec,JSON.parse(fs.readFileSync('server-homecare-flow.json','utf8')));assert.equal(rec.checks.length,3,'Resume is bounded to the first team response.');rec.harnessObservations=[{note:'Team POST correctly returned 201; initial harness expected 200. No product defect. Existing client and team are reused.'}];}
rec.limits=['HOME_CARE_ENABLED=1 was measured from the active frontend. Only the existing synthetic organization is temporarily activated.','A HOME_CARE module and coordinator grant are explicit database fixtures, not evidence of commercial onboarding.','Only the same three non-admin accounts and fictitious care content are used. No STAR API transmission or paid model call.'];
const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Tallinn',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const month=day.slice(0,7),weekday=new Date(day+'T12:00:00Z').getUTCDay()||7;
const fixture=resume?JSON.parse(fs.readFileSync('homecare-fixture.json','utf8')):{organizationId:oid,coordinatorMembershipId:mid,day,month,slotIds:[],entryIds:[]};
assert.equal(fixture.day,day,'Use a new bounded continuation if the server date changed.');
const persist=()=>{fs.writeFileSync('homecare-fixture.json',JSON.stringify(fixture,null,2)+'\n');save();};
async function expected(path,method,body,status=200){const r=await call('provider',path,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
try{
 await prisma.organization.update({where:{id:oid},data:{status:'ACTIVE'}});
 if(!resume){
  await prisma.organizationModule.create({data:{organizationId:oid,moduleKey:'HOME_CARE',status:'ACTIVE',reason:'SOL TEST care fixture',validUntil:new Date(Date.now()+86400000)}});
  await prisma.organizationCapabilityGrant.create({data:{membershipId:mid,capability:'HOME_CARE_COORDINATOR',scopeType:'ORGANIZATION',grantedByUserId:actors.provider.id,reason:'SOL TEST care fixture'}});
 }
 for(const key of Object.keys(actors))await login(key);
 let cid=fixture.clientId;
 if(!resume){
  const c=await expected(base+'/kliendid','POST',{displayName:'SOL TEST koduteenuse klient',internalCode:'SOL-20261014-01',contactNote:'SOL TEST PRIVATE CARE'},201);
  cid=c.client.id;fixture.clientId=cid;rec.created.clientId=cid;persist();
  check('TOOLS-01','care_client_created_in_own_organization',true,{status:201,clientId:cid});
  for(const key of ['client','specialist']){const r=await call(key,base+`/kliendid/${cid}`);check('DATA-01','care_foreign_or_ended_member_denied_'+key,[403,404].includes(r.status)&&!r.text.includes('SOL TEST PRIVATE CARE'),{status:r.status,privateContentAbsent:!r.text.includes('SOL TEST PRIVATE CARE')});}
  await expected(base+`/kliendid/${cid}/meeskond`,'POST',{membershipId:mid},201);
 }
 for(const startTime of ['00:10','00:20','00:30'])await expected(base+`/kliendid/${cid}/kaigud`,'POST',{weekdays:[weekday],startTime,plannedMinutes:10,workerMembershipId:mid,validFrom:day,validUntil:day},201);
 const slots=await prisma.careVisitSlot.findMany({where:{clientId:cid,organizationId:oid},orderBy:{startMinute:'asc'}});
 assert.equal(slots.length,3);fixture.slotIds=slots.map(s=>s.id);persist();
 check('TOOLS-01','three_planned_visits_assigned',slots.every(s=>s.workerMembershipId===mid),{count:slots.length,allAssignedToSyntheticCoordinator:true,day});
 const cancelled=await expected(base+`/kliendid/${cid}/kaigud/${slots[2].id}/erand`,'PUT',{kind:'CANCELLED',day,reason:'CLIENT_CANCELLED',note:'SOL TEST cancellation'});
 const visitRows=(data)=>[...(data.workers||[]).flatMap(w=>w.visits||[]),...(data.obstacles||[]).flatMap(w=>w.visits||[]),...(data.unassigned||[]),...(data.uncovered||[])].filter(v=>v.client.id===cid);
 const cv=visitRows(cancelled).find(v=>v.slotId===slots[2].id);
 check('TOOLS-01','planned_cancellation_visible',cv?.state==='CANCELLED',{state:cv?.state,reason:cv?.change?.reason});
 for(const [i,minutes] of [[0,30],[1,20]]){
  const body={kind:'NOTE',contactMode:'VISIT',text:`SOL TEST visit ${i+1}`,visitMinutes:minutes,occurredAt:day+`T00:${i===0?'10':'20'}:00+03:00`,clientRequestId:`sol-proof-care-${i+1}`};
  const created=await expected(base+`/kliendid/${cid}/kirjed`,'POST',body,201);fixture.entryIds.push(created.entry.id);persist();
  if(i===0){const repeat=await expected(base+`/kliendid/${cid}/kirjed`,'POST',body);const count=await prisma.careClientEntry.count({where:{clientId:cid,clientRequestId:body.clientRequestId}});check('TOOLS-01','care_retry_has_one_entry',repeat.entry.id===created.entry.id&&count===1,{sameId:repeat.entry.id===created.entry.id,count});}
 }
 const initial=await expected(base+`/kuu?kuu=${month}`,'GET');
 check('TOOLS-01','month_excludes_planned_cancelled_visit',initial.totals.visits===2&&initial.totals.minutes===50&&initial.totals.cancelled===1,{totals:initial.totals});
 const first=await prisma.careClientEntry.findUnique({where:{id:fixture.entryIds[0]}});
 const corrected=await expected(base+`/kliendid/${cid}/kirjed/${first.id}`,'PATCH',{revision:first.revision,reason:'SOL TEST duration correction',text:'SOL TEST corrected visit',visitMinutes:45});
 const history=await expected(base+`/kliendid/${cid}/kirjed/${first.id}/ajalugu`,'GET');
 fs.writeFileSync('homecare-revision-history.json',JSON.stringify(history,null,2)+'\n');
 const old=await prisma.careClientEntryRevision.findMany({where:{entryId:first.id}});
 check('TOOLS-01','care_correction_keeps_original_and_reason',corrected.entry.visit?.minutes===45&&old.length===1&&JSON.stringify(old).includes('SOL TEST duration correction')&&JSON.stringify(old).includes('SOL TEST visit 1'),{newMinutes:corrected.entry.visit?.minutes,revisionCount:old.length,reasonAndOldTextPresent:true,historyStatus:200});
 const stale=await call('provider',base+`/kliendid/${cid}/kirjed/${first.id}`,'PATCH',{revision:first.revision,reason:'SOL TEST stale form',text:'SOL TEST stale',visitMinutes:99});
 check('TOOLS-01','care_stale_correction_denied',stale.status===409,{status:stale.status,error:stale.data?.error});
 const second=await prisma.careClientEntry.findUnique({where:{id:fixture.entryIds[1]}});
 const retracted=await expected(base+`/kliendid/${cid}/kirjed/${second.id}/tuhista`,'POST',{revision:second.revision,reason:'SOL TEST duplicate visit removed'});
 const final=await expected(base+`/kuu?kuu=${month}`,'GET');
 fs.writeFileSync('homecare-month-report.json',JSON.stringify(final,null,2)+'\n');
 const row=final.clients.find(r=>r.client.id===cid);
 check('TOOLS-01','care_month_uses_correction_excludes_retraction',final.totals.visits===1&&final.totals.minutes===45&&final.totals.cancelled===1&&row.minutes===45&&!!retracted.entry.retractedAt,{totals:final.totals,clientMinutes:row.minutes,retracted:true});
 const dayPlan=await expected(base+`/paev?paev=${day}`,'GET');
 const states=visitRows(dayPlan).map(v=>({slotId:v.slotId,state:v.state}));
 check('TOOLS-01','care_day_has_one_done_and_one_cancelled',states.filter(v=>v.state==='DONE').length===1&&states.filter(v=>v.state==='CANCELLED').length===1,{states});
 const sheet=await import(pathToFileURL(root+'/lib/homeCare/monthSheet.js'));
 // Translation keys remain visible so this CSV is an inspectable technical fixture, not a localized UI download.
 const csv=sheet.composeMonthSheet((key)=>key,final);fs.writeFileSync('homecare-report-synthetic.csv',csv);
 check('TOOLS-01','month_csv_uses_same_report_data',csv.includes('SOL TEST koduteenuse klient')&&sheet.monthSheetState(final)==='RUNNING',{state:sheet.monthSheetState(final),sameInputAsHttpsReport:true,translationKeysInsteadOfLocalizedLabels:true},'CURRENT_FIXTURE');
 rec.observations=[{case_id:'TOOLS-01',status:'NOT_PROVEN',note:'No STAR API call was made. Care month CSV and service-log STAR statistics are separate outputs; actual field mapping, billing prices and state receipt require separate proof.'},{case_id:'TOOLS-01',status:'NOT_PROVEN',note:'UI planning/entry/report path, completed month locking and actual worker paired timing are not proved by these HTTPS checks.'}];
}finally{
 await prisma.organization.update({where:{id:oid},data:{status:orgBefore.status}});
 rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created,organizationRestoredTo:orgBefore.status}));
}
