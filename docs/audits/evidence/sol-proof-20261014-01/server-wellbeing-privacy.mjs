import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root),{rec,save,check}=recorder(root,'server-wellbeing-privacy');
const schemas=await import(pathToFileURL(root+'/lib/wellbeing/fieldSchemas.js'));
const aggregate=await import(pathToFileURL(root+'/lib/wellbeing/aggregate.js'));
const cells=await import(pathToFileURL(root+'/lib/wellbeing/cellSuppression.js'));
const marker='SOL TEST PRIVATE WELLBEING';
rec.limits=['Only this run specialist private record is stored or read. Aggregate uses an isolated fake database returning only this synthetic record.','No actual cohort, colleague data, national feed or AI recommendation is requested.'];
try{
 for(const key of Object.keys(actors))await login(key);
 const fields={};
 for(const [name,f] of Object.entries(schemas.WELLBEING_FIELD_SCHEMAS['hard-case'].fields)){
  fields[name]=f.kind==='enum'?f.values[0]:f.kind==='boolean'?false:f.kind==='text'?marker:[];
 }
 const body={standardizedFields:fields};
 const created=await call('specialist','/api/wellbeing/hard-case','POST',body);assert.equal(created.status,201,JSON.stringify(created.data));
 const rid=created.data.record.id;rec.created.recordId=rid;save();
 const stored=await prisma.wellbeingRecord.findUnique({where:{id:rid}});assert.equal(stored.ownerUserId,actors.specialist.id);
 check('DATA-06','personal_wellbeing_saved_private',stored.visibility==='private'&&stored.standardizedFields.generalizedDescription===marker,{status:created.status,visibility:stored.visibility,ownerMatches:true,privateMarkerSaved:stored.standardizedFields.generalizedDescription===marker,workflowType:stored.workflowType});
 const retry=await call('specialist','/api/wellbeing/hard-case','POST',body);
 check('TOOLS-04','wellbeing_same_intent_deduplicated',retry.status===200&&retry.data?.record?.id===rid&&retry.data.deduplicated===true,{status:retry.status,sameId:retry.data?.record?.id===rid,deduplicated:retry.data?.deduplicated});
 const owner=await call('specialist',`/api/wellbeing/records/${rid}`);
 check('DATA-06','owner_wellbeing_visible',owner.status===200&&owner.text.includes(marker),{status:owner.status,ownMarkerPresent:owner.text.includes(marker)});
 for(const key of ['provider','client']){
  const read=await call(key,`/api/wellbeing/records/${rid}`),del=await call(key,`/api/wellbeing/records/${rid}`,'DELETE');
  check('DATA-06','foreign_wellbeing_denied_'+key,[403,404].includes(read.status)&&[403,404].includes(del.status)&&!read.text.includes(marker),{readStatus:read.status,deleteStatus:del.status,privateMarkerAbsent:!read.text.includes(marker)});
 }
 const admin=await call('provider','/api/admin/wellbeing/aggregate');
 check('DATA-06','normal_role_cannot_read_admin_wellbeing',admin.status===403&&!admin.text.includes(marker),{status:admin.status,privateMarkerAbsent:!admin.text.includes(marker)});
 const countBefore=await prisma.wellbeingRecord.count({where:{ownerUserId:actors.specialist.id}});
 const invalid=await call('specialist','/api/wellbeing/hard-case','POST',{standardizedFields:{...fields,immediateDanger:'UNKNOWN_NOT_AN_ALLOWED_OPTION'}});
 const countAfter=await prisma.wellbeingRecord.count({where:{ownerUserId:actors.specialist.id}});
 check('DATA-06','unknown_danger_not_saved_as_safe',invalid.status===400&&countAfter===countBefore,{status:invalid.status,countBefore,countAfter,recordAdded:false});
 const fake={wellbeingRecord:{findMany:async()=>[stored]}};
 const data=await aggregate.buildWellbeingAggregateDataset({}, {prisma:fake,env:{WELLBEING_MIN_GROUP_SIZE:'1'},now:new Date()});
 check('DATA-06','small_cohort_hidden_and_floor_not_lowered',data.suppressed===true&&data.minimumGroupSize>=5&&data.sampleSize===1&&data.metrics.length===0&&!JSON.stringify(data).includes(marker),{suppressed:data.suppressed,minimumGroupSize:data.minimumGroupSize,sampleSize:data.sampleSize,metricCount:data.metrics.length,privateTextAbsent:!JSON.stringify(data).includes(marker)},'CURRENT_FIXTURE');
 const suppressed=cells.suppressSmallCells(new Map([['rare_risk',1],['ordinary',9]]),{minimumGroupSize:5,partitionsPublishedTotal:true});
 check('DATA-06','complementary_cell_suppression',suppressed.withheldKeys.includes('rare_risk')&&suppressed.withheldKeys.includes('ordinary')&&suppressed.published.length===0,{withheldKeys:suppressed.withheldKeys,published:suppressed.published,familyWithheld:suppressed.familyWithheld},'CURRENT_FIXTURE');
 rec.observations=[{case_id:'DATA-06',status:'NOT_PROVEN',note:'Suppression mechanism and API role guards were checked. A real pilot cohort with explicit participation, viewer grant, exports and representativeness is a separate test.'}];
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created}));}
