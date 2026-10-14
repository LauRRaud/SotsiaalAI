import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness} from './server-http-support.mjs';
const root=process.argv[2],{prisma,call,login}=await httpHarness(root);
const f=JSON.parse(fs.readFileSync('homecare-fixture.json','utf8')),path='server-homecare-flow.json';
const rec=JSON.parse(fs.readFileSync(path,'utf8'));
assert.equal(rec.checks.length,12);
fs.writeFileSync('server-homecare-flow-raw.json',JSON.stringify(rec,null,2)+'\n');
const before=await prisma.organization.findUnique({where:{id:f.organizationId}});
assert.equal(before.displayName,'SOL TEST — sünteetiline vastuvõtutiim');
try{
 await prisma.organization.update({where:{id:f.organizationId},data:{status:'ACTIVE'}});await login('provider');
 const base=`/api/org/${f.organizationId}/koduteenus/kliendid/${f.clientId}/kirjed`;
 const r=await call('provider',base),h=await call('provider',`${base}/${f.entryIds[0]}/ajalugu`);
 assert.equal(r.status,200);assert.equal(h.status,200);
 const serialized=JSON.stringify(r.data);
 const row=r.data.entries.items.find(e=>e.id===f.entryIds[0]);
 const old=h.data.revisions[0];
 const variant=rec.checks.find(c=>c.variant_id==='care_correction_keeps_original_and_reason');
 const ok=row.visit.minutes===45&&row.text==='SOL TEST corrected visit'&&old.visit.minutes===30&&old.text==='SOL TEST visit 1'&&old.reason==='SOL TEST duration correction';
 variant.status=ok?'PASS':'FAIL';variant.actual={newMinutes:row.visit.minutes,oldMinutes:old.visit.minutes,oldTextAndReasonPreserved:true,historyStatus:h.status,verifyStatus:r.status};
 rec.harnessObservations.push({note:'The API serializes duration as entry.visit.minutes. Initial assertion used nonexistent entry.visitMinutes. Read-only HTTPS verification inspected the corrected row and history without repeating the mutation.',verifiedAt:new Date().toISOString()});
 rec.observations.push({case_id:'TOOLS-01',status:'NOT_PROVEN',note:'The CSV formats 45 minutes as 0,8 hours (one decimal); the JSON source remains 45. Rounding suitability for invoicing and total reconciliation needs a separate requirement and boundary test.'});
 rec.verification={release:root.split('/').at(-1),at:new Date().toISOString(),checksRepeated:0,additionalReadOnlyRequests:2,serializedCurrentEntry:row};
 fs.writeFileSync(path,JSON.stringify(rec,null,2)+'\n');console.log(JSON.stringify({ok,variant:variant.actual}));
}finally{await prisma.organization.update({where:{id:f.organizationId},data:{status:before.status}});await prisma.$disconnect();}
