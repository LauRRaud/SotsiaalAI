import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],h=await httpHarness(root),{prisma,actors,call,login}=h;
const {rec,save,check}=recorder(root,'server-http-lifecycle');
async function draft(suffix){
 const r=await call('client','/api/pre-inquiries','POST',{clientActionId:crypto.randomUUID(),topic:'SOL TEST lifecycle '+suffix,situation:'SOL TEST: sünteetiline digiabi vajadus.',selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'});
 assert.equal(r.status,201,JSON.stringify(r.data));rec.created[suffix]=r.data.inquiry.id;save();return r.data.inquiry;
}
async function probe(id,name,fn){try{await fn();}catch(e){rec.checks.push({case_id:id,variant_id:name,status:'BLOCKED',gap_kind:'HARNESS_OR_PRECONDITION',actual:{message:String(e.message).slice(0,300)}});save();}}
try{
 for(const key of Object.keys(actors))await login(key);
 await probe('FLOW-07','concurrent_create_and_send_http',async()=>{
  const key=crypto.randomUUID(),body={clientActionId:key,topic:'SOL TEST korduskatse',situation:'Sünteetiline korduv pöördumine.',selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'};
  const created=await Promise.all([call('client','/api/pre-inquiries','POST',body),call('client','/api/pre-inquiries','POST',body)]);
  const ids=created.map(r=>r.data?.inquiry?.id);
  check('FLOW-07','concurrent_create_http',created.every(r=>r.status===201)&&ids.every(id=>id&&id===ids[0]),{statuses:created.map(r=>r.status),sameId:!!ids[0]&&ids[0]===ids[1]});
  assert.ok(ids[0]);rec.created.retryId=ids[0];const d=created[0].data.inquiry;
  const sent=await Promise.all([call('client',`/api/pre-inquiries/${d.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:d.updatedAt}),call('client',`/api/pre-inquiries/${d.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:d.updatedAt})]);
  const count=await prisma.preInquiry.count({where:{id:d.id,authorId:actors.client.id}});
  check('FLOW-07','concurrent_send_http',count===1&&sent.some(r=>r.status===200)&&sent.every(r=>[200,409].includes(r.status)),{statuses:sent.map(r=>r.status),messages:sent.map(r=>r.data?.message||null),recordCount:count,notificationCountNotMeasured:true});
  const fresh=await call('client',`/api/pre-inquiries/${d.id}`);
  const recalled=await call('client',`/api/pre-inquiries/${d.id}/recall`,'POST',{expectedUpdatedAt:fresh.data.inquiry.updatedAt});
  const hidden=await call('specialist',`/api/pre-inquiries/${d.id}`);
  check('FLOW-07','http_recall_before_accept',recalled.status===200&&hidden.status===404&&!hidden.text.includes('Sünteetiline korduv'),{recallStatus:recalled.status,recipientStatus:hidden.status,recipientContentAbsent:!hidden.text.includes('Sünteetiline korduv')});
 });
 await probe('DATA-02','correction_provenance_http',async()=>{
  const d=await draft('correction');
  const sent=await call('client',`/api/pre-inquiries/${d.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:d.updatedAt});assert.equal(sent.status,200);
  const accepted=await call('specialist',`/api/pre-inquiries/${d.id}/accept`,'POST',{});assert.equal(accepted.status,200);
  const original=await call('client',`/api/pre-inquiries/${d.id}`);
  const change=await call('client',`/api/pre-inquiries/${d.id}`,'PATCH',{situation:'SOL TEST muudetud pärast saatmist',expectedUpdatedAt:original.data.inquiry.updatedAt});
  check('DATA-02','sent_original_not_silently_changed',change.status===409,{status:change.status,message:change.data?.message});
  const body={situation:'SOL TEST PARANDUS: vajan juhendamist, mitte seadme ostmist.',userEditedDraft:'SOL TEST PARANDUS: täpsustan oma eelinfot.',expectedUpdatedAt:original.data.inquiry.updatedAt};
  const correction=await call('client',`/api/pre-inquiries/${d.id}/corrections`,'POST',body);
  check('DATA-02','separate_corrected_version',correction.status===201&&correction.data?.inquiry?.id!==d.id,{status:correction.status,created:correction.data?.created,newId:correction.data?.inquiry?.id,originalId:d.id});
  assert.ok(correction.data?.inquiry?.id,JSON.stringify(correction.data));rec.created.correctionId=correction.data.inquiry.id;
  const repeat=await call('client',`/api/pre-inquiries/${d.id}/corrections`,'POST',body);
  check('DATA-02','correction_retry_same_record',repeat.status===200&&repeat.data?.inquiry?.id===correction.data.inquiry.id&&repeat.data.created===false,{status:repeat.status,sameId:repeat.data?.inquiry?.id===correction.data.inquiry.id,created:repeat.data?.created});
  const oldView=await call('specialist',`/api/pre-inquiries/${d.id}`),newView=await call('specialist',`/api/pre-inquiries/${correction.data.inquiry.id}`);
  check('DATA-02','original_and_correction_distinguished',oldView.status===200&&newView.status===200&&oldView.data?.inquiry?.situation===original.data.inquiry.situation&&newView.data?.inquiry?.situation?.includes('PARANDUS')&&oldView.data.inquiry.supersededById===correction.data.inquiry.id,{originalStatus:oldView.status,correctedStatus:newView.status,originalUnchanged:oldView.data?.inquiry?.situation===original.data.inquiry.situation,correctionOfId:newView.data?.inquiry?.correctionOfId,supersededById:oldView.data?.inquiry?.supersededById,correctedAt:newView.data?.inquiry?.createdAt});
  const cannotRecall=await call('client',`/api/pre-inquiries/${d.id}/recall`,'POST',{expectedUpdatedAt:oldView.data.inquiry.updatedAt});
  check('FLOW-07','opened_original_not_recalled',cannotRecall.status===409,{status:cannotRecall.status,message:cannotRecall.data?.message});
 });
 await probe('FLOW-06','receiver_changed_before_send_http',async()=>{
  const d=await draft('receiver-disabled');
  try{
   await prisma.user.update({where:{id:actors.specialist.id},data:{acceptsPreInquiries:false}});
   const send=await call('client',`/api/pre-inquiries/${d.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:d.updatedAt});
   const retained=await call('client',`/api/pre-inquiries/${d.id}`);
   check('FLOW-06','receiver_changed_before_send_http',[400,409].includes(send.status)&&retained.data?.inquiry?.status==='DRAFT',{sendStatus:send.status,message:send.data?.message,retainedStatus:retained.data?.inquiry?.status,retainedChannel:retained.data?.inquiry?.deliveryChannel});
  }finally{await prisma.user.update({where:{id:actors.specialist.id},data:{acceptsPreInquiries:true}});}
 });
 await probe('ENV-03','suspended_test_account_http',async()=>{
  try{
   await prisma.user.update({where:{id:actors.client.id},data:{accessSuspendedAt:new Date()}});
   const r=await call('client','/api/journeys');
   check('ENV-03','suspended_test_account_http',r.status===503&&r.data?.error==='platform_not_open',{status:r.status,error:r.data?.error});
  }finally{await prisma.user.update({where:{id:actors.client.id},data:{accessSuspendedAt:null}});}
 });
 await probe('ENV-03','revoked_test_session_http',async()=>{
  await login('client');const user=await prisma.user.findUnique({where:{id:actors.client.id},select:{sessionVersion:true}});
  try{
   await prisma.user.update({where:{id:actors.client.id},data:{sessionVersion:user.sessionVersion+1}});
   const r=await call('client','/api/journeys');
   check('ENV-03','revoked_test_session_http',r.status===503&&r.data?.error==='platform_not_open',{status:r.status,error:r.data?.error});
  }finally{await prisma.user.update({where:{id:actors.client.id},data:{sessionVersion:user.sessionVersion}});}
  await login('client');const r=await call('client','/api/journeys');
  check('ENV-03','fresh_restored_test_session_http',r.status===200,{status:r.status,isAdmin:false});
 });
}finally{
 rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();
 console.log(JSON.stringify({checks:rec.checks.length,pass:rec.checks.filter(c=>c.status==='PASS').length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created}));
}
