import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-service-report');
const resume=fs.existsSync('service-report-fixture.json');
if(resume){Object.assign(rec,JSON.parse(fs.readFileSync('server-service-report.json','utf8')));assert.equal(rec.checks.length,3);rec.harnessObservations=[{note:'Initial harness attempted to select nonexistent retentionUntil. The actual schema stores retentionClass and recordedFiscalYear. Existing entries and correction are reused; three checks are not repeated.'}];}
const month='2026-10',marker='SOL TEST PRIVATE SERVICE NOTE',name='SOL TEST teenuspäeviku klient';
rec.limits=['Only this run private SOLO provider profile and fictitious service entries are used. No invoice payment, email recipient, model call or STAR delivery.','The export HTTP route may archive its own synthetic report document. This is a separate service-log workflow, not automatic home-care journal synchronization.'];
const fixture=resume?JSON.parse(fs.readFileSync('service-report-fixture.json','utf8')):{month,entryIds:[]};
const persist=()=>{fs.writeFileSync('service-report-fixture.json',JSON.stringify(fixture,null,2)+'\n');save();};
async function req(path,method='GET',body,status=200){const r=await call('provider',path,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r;}
try{
 for(const key of Object.keys(actors))await login(key);
 if(!resume){
 for(const [i,quantity] of [[0,1],[1,2],[2,3]]){
  const body={clientDisplayName:name,clientExternalRef:'SOL-REPORT-20261014',date:'2026-10-14',unit:'HOUR',quantity,note:marker,clientRequestId:`sol-proof-report-${i+1}`};
  const r=await req('/api/service-entries','POST',body,201);fixture.entryIds.push(r.data.entry.id);persist();
  if(i===0){const repeated=await req('/api/service-entries','POST',body,201);const count=await prisma.serviceEntry.count({where:{id:r.data.entry.id}});check('TOOLS-01','service_entry_replay_one_row',repeated.data.entry.id===r.data.entry.id&&count===1,{sameId:repeated.data.entry.id===r.data.entry.id,count});}
 }
 for(const id of fixture.entryIds.slice(0,2))await req(`/api/service-entries/${id}/lifecycle`,'POST',{action:'finalize'});
 const first=await prisma.serviceEntry.findUnique({where:{id:fixture.entryIds[0]}});
 const noReason=await call('provider',`/api/service-entries/${first.id}`,'PATCH',{expectedUpdatedAt:first.updatedAt.toISOString(),quantity:1.5});
 check('TOOLS-01','final_service_correction_requires_reason',noReason.status===400,{status:noReason.status});
 const corrected=await req(`/api/service-entries/${first.id}`,'PATCH',{expectedUpdatedAt:first.updatedAt.toISOString(),quantity:1.5,reason:'SOL TEST service quantity correction'});
 const history=await req(`/api/service-entries/${first.id}/corrections`);
 fs.writeFileSync('service-report-corrections.json',JSON.stringify(history.data,null,2)+'\n');
 const old=await prisma.serviceEntryCorrection.findMany({where:{entryId:first.id}});
 check('TOOLS-01','final_service_correction_is_traceable',Number(corrected.data.entry.quantity)===1.5&&old.length===1&&old[0].reason==='SOL TEST service quantity correction'&&Number(old[0].previousValues.quantity)===1,{newQuantity:Number(corrected.data.entry.quantity),previousQuantity:Number(old[0].previousValues.quantity),reason:old[0].reason,corrections:old.length});
 }
 const first=await prisma.serviceEntry.findUnique({where:{id:fixture.entryIds[0]}});
 const deletion=await call('provider',`/api/service-entries/${first.id}`,'DELETE');
 const remains=await prisma.serviceEntry.findUnique({where:{id:first.id},select:{id:true,status:true,retentionClass:true,recordedFiscalYear:true}});
 check('DATA-04','final_service_record_not_deleted_early',deletion.status===409&&!!remains,{status:deletion.status,recordPreserved:!!remains,retentionClass:remains?.retentionClass,recordedFiscalYear:remains?.recordedFiscalYear});
 await req(`/api/service-entries/${fixture.entryIds[1]}/lifecycle`,'POST',{action:'void',reason:'SOL TEST work did not occur'});
 const report=await req(`/api/service-log/month?month=${month}`);fs.writeFileSync('service-month-report.json',JSON.stringify(report.data,null,2)+'\n');
 const summary=report.data.report.summary,unit=summary.totalsByUnit.find(t=>t.unit==='HOUR');
 check('TOOLS-01','service_month_separates_final_draft_void',unit.final===1.5&&unit.draft===3&&summary.entryCounts.final===1&&summary.entryCounts.draft===1&&summary.entryCounts.voided===1,{totals:summary.totalsByUnit,counts:summary.entryCounts});
 rec.observations=[{case_id:'TOOLS-01',status:'NOT_PROVEN',note:'Export request without browser Fetch Metadata received 403. Actual browser same-origin export was subsequently checked separately in server-service-browser.json.'},{case_id:'DATA-04',status:'NOT_PROVEN',note:'Early deletion guard is proved for the own final record; complete retention/deletion across all stores requires an isolated test.'}];
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:fixture}));}
