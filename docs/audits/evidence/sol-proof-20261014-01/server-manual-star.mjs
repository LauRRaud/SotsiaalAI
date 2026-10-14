import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-manual-star');
assert.equal(fs.existsSync('manual-star-fixture.json'),false,'Reuse the existing case if a continuation is needed.');
rec.limits=['Only a new synthetic specialist-owned case and draft are created. The client name and text are fictional.','Review and transfer decisions are scripted by the synthetic specialist account; no human professional assessment is claimed.','The target is a local neutral form object explicitly marked SIMULATOR_NOT_STAR. No clipboard, STAR credentials, state endpoint or official schema is used. No human timing.'];
const fixture={};
const persist=()=>{fs.writeFileSync('manual-star-fixture.json',JSON.stringify(fixture,null,2)+'\n');save();};
async function req(path,method='GET',body,status=200){const r=await call('specialist',path,method,body);assert.equal(r.status,status,JSON.stringify(r.data));return r.data;}
try{
 for(const key of Object.keys(actors))await login(key);
 const c=await req('/api/casework/cases','POST',{clientDisplayName:'SOL TEST STAR simulator client',clientExternalRef:'SOL-MANUAL-20261014',clientActionId:crypto.randomUUID()},201);
 fixture.caseId=c.case.id;persist();const base=`/api/casework/cases/${fixture.caseId}/drafts`;
 const d=await req(base,'POST',{draftType:'POORDUMISE_KOKKUVOTE',transferState:'ULE_KANTUD'},201);fixture.draftId=d.draft.id;persist();const p=`${base}/${fixture.draftId}`;
 check('TOOLS-06','draft_cannot_be_created_already_transferred',d.draft.transferState==='MUSTAND',{initialState:d.draft.transferState,injectedStateIgnored:true});
 await req(p+'/fields','PUT',{fieldKey:'CLIENT_REPORT',text:'SOL TEST client says: I need help using a test phone.',provenance:'KLIENDI_OELDUD'});
 await req(p+'/fields','PUT',{fieldKey:'SPECIALIST_ASSESSMENT',text:'SOL TEST specialist interpretation: clarify the requested support at the meeting.',provenance:'TOOTAJA_TOLGENDUS'});
 const changed=await req(p+'/fields','PUT',{fieldKey:'CLIENT_REPORT',text:'SOL TEST client says: I need digital support.',provenance:'AMETLIKULT_KONTROLLITUD'});
 check('TOOLS-06','editing_does_not_promote_reported_origin',changed.field.provenance==='KLIENDI_OELDUD',{actualProvenance:changed.field.provenance});
 const jump=await call('specialist',p+'/transition','POST',{expectedFrom:'MUSTAND',to:'ULE_KANTUD'});
 check('TOOLS-06','transfer_requires_separate_action',jump.status===400,{status:jump.status});
 for(const [from,to] of [['MUSTAND','VAJAB_KONTROLLI'],['VAJAB_KONTROLLI','KONTROLLITUD'],['KONTROLLITUD','VALMIS_ULEKANDEKS']])await req(p+'/transition','POST',{expectedFrom:from,to,...(to==='VAJAB_KONTROLLI'?{reviewKind:'KLIENDIGA'}:{})});
 const block=(await req(p+'/star2-block')).block;
 const form={mode:'SIMULATOR_NOT_STAR',fields:{CLIENT_REPORT:'SOL TEST client says: I need digital support.',SPECIALIST_ASSESSMENT:'SOL TEST specialist interpretation: clarify the requested support at the meeting.'},officialSchemaVerified:false,humanDuration:null};
 fs.writeFileSync('manual-transfer-map.json',JSON.stringify({caseId:fixture.caseId,draftId:fixture.draftId,block,simulator:form,missingFields:block.fieldKeys.filter(k=>!(k in form.fields)),steps:['scripted specialist review transitions','fetch prepared block','map two synthetic fields into local neutral form','record simulated copy','mark simulated transfer separately'],stepCount:5},null,2)+'\n');
 check('TOOLS-06','prepared_block_has_warning_and_two_fields',block.fieldKeys.length===2&&block.text.includes('CLIENT_REPORT:')&&block.text.includes('SPECIALIST_ASSESSMENT:')&&block.text.split('\n')[0].length>0,{fieldKeys:block.fieldKeys,warningLine:block.text.split('\n')[0],contentHash:block.contentHash,simulatorOnly:true});
 const key=crypto.randomUUID(),body={fieldKeys:block.fieldKeys,clientActionId:key,contentHash:block.contentHash};
 const copied=await req(p+'/copy-events','POST',body),again=await req(p+'/copy-events','POST',body);
 const beforeMark=await prisma.caseWorkDraft.findUnique({where:{id:fixture.draftId}});
 check('TOOLS-06','copy_does_not_mean_transfer_and_retry_is_single',beforeMark.transferState==='VALMIS_ULEKANDEKS'&&beforeMark.transferredAt===null&&again.event.id===copied.event.id,{stateAfterCopy:beforeMark.transferState,transferredAt:beforeMark.transferredAt,sameAuditId:again.event.id===copied.event.id,kind:copied.event.kind});
 const marked=await req(p+'/mark-transferred','POST',{expectedFrom:'VALMIS_ULEKANDEKS'});
 check('TOOLS-06','explicit_transfer_mark_is_user_declaration',marked.draft.transferState==='ULE_KANTUD'&&!!marked.draft.transferredAt&&marked.event.kind==='MARKED_AS_TRANSFERRED',{state:marked.draft.transferState,transferredAt:marked.draft.transferredAt,eventKind:marked.event.kind,officialReceipt:null,realStarCall:false});
 const edit=await call('specialist',p+'/fields','PUT',{fieldKey:'CLIENT_REPORT',text:'SOL TEST forbidden terminal edit',provenance:'KLIENDI_OELDUD'});
 check('TOOLS-06','transferred_draft_write_protected',edit.status===409,{status:edit.status});
 for(const key of ['client','provider']){const foreign=await call(key,p+'/star2-block');check('DATA-01','foreign_star_preparation_denied_'+key,[403,404].includes(foreign.status)&&!foreign.text.includes('SOL TEST client says'),{status:foreign.status,contentAbsent:!foreign.text.includes('SOL TEST client says')});}
 const events=await prisma.caseWorkTransferEvent.findMany({where:{caseWorkAssistId:fixture.caseId}});
 check('DATA-04','transfer_audit_contains_no_field_text',events.length===2&&!JSON.stringify(events).includes('SOL TEST client says'),{eventCount:events.length,fieldTextAbsent:!JSON.stringify(events).includes('SOL TEST client says')});
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:fixture}));}
