import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {recorder} from './server-http-support.mjs';
const root=process.argv[2],{rec,save,check}=recorder(root,'server-safety-mail');
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const pre=await import(pathToFileURL(root+'/lib/preInquiries.js'));
const q=await import(pathToFileURL(root+'/lib/preInquiriesQuestionnaire.js'));
const actors=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
rec.limits=['Mail transport is a capturing or failing fixture; no actual SMTP or paid provider call is made by this script.','Urgency checks exercise deterministic form normalization, not clinical assessment or model answer accuracy.'];
try{
 const a=await prisma.user.findUnique({where:{id:actors.specialist.id},select:{email:true,isAdmin:true,notificationEmailEnabled:true}});
 assert.equal(a.email,actors.specialist.email);assert.equal(a.isAdmin,false);
 const captured=[],mailer={sendMail:async m=>{captured.push(m);return {messageId:'synthetic-capture'};}};
 const result=await pre.sendInternalPreInquiryArrivalEmail(actors.specialist.id,{db:prisma,mailer,from:'sol-test@example.invalid',resolveUrl:()=> 'https://sotsiaal.pro/admin'});
 const mail=captured[0],text=JSON.stringify(mail);
 check('OPS-04','arrival_mail_minimal_correct_recipient',result.sent===true&&captured.length===1&&mail.to===actors.specialist.email&&text.includes('https://sotsiaal.pro/admin')&&!text.includes('PRIVAATNE KONTROLLFRAAS')&&!text.includes('testtelefoni'),{capturedCalls:captured.length,recipientMatches:true,containsLoginLink:text.includes('https://sotsiaal.pro/admin'),containsCaseText:text.includes('testtelefoni'),transport:'capture fixture'},'CURRENT_FIXTURE');
 const failed=await pre.dispatchInternalArrivalEmail(actors.specialist.id,{db:prisma,mailer:{sendMail:async()=>{throw Error('SOL TEST synthetic SMTP failure');}},from:'sol-test@example.invalid',resolveUrl:()=> 'https://sotsiaal.pro/admin'});
 check('OPS-05','arrival_mail_failure_not_reported_as_sent',failed.sent===false&&failed.reason==='send_failed',{result:failed,transport:'failing fixture'},'CURRENT_FIXTURE');
 const retry=await pre.dispatchInternalArrivalEmail(actors.specialist.id,{db:prisma,mailer,from:'sol-test@example.invalid',resolveUrl:()=> 'https://sotsiaal.pro/admin'});
 check('OPS-05','captured_mail_transport_recovers',retry.sent===true&&captured.length===2,{retryReportedSent:retry.sent,capturedTotal:captured.length,attemptsControlled:true},'CURRENT_FIXTURE');
 rec.observations=[{case_id:'OPS-04',variant_id:'arrival_mail_account_preference',status:'NOT_PROVEN',actual:{notificationEmailEnabled:a.notificationEmailEnabled,capturedSendCallsForDisabledAccount:1},note:'This arrival-mail function does not check the account email-notification switch. Whether this is a mandatory exception or preference bug needs a product decision. Earlier .invalid fixture HTTPS requests do not establish absence of external SMTP attempts.'}];
 for(const [urgency,level,needs112] of [
  ['Keegi võib olla vahetus ohus','CRISIS',true],
  ['Olukord on tõsine ja vajab kiiret sekkumist','WARNING',false],
  ['Ei ole kiire, saan oodata','NONE',false]
 ]){
  const s=q.createEmptyPreInquiryAssessmentState('TARGETED_ASSESSMENT');s.subject.urgency=urgency;
  const n=q.normalizePreInquiryAssessmentState(s);
  check('OPS-07','deterministic_urgency_'+level,n.riskGate.level===level&&(!needs112||n.riskGate.userVisibleMessage.includes('112')),{level:n.riskGate.level,notice:n.riskGate.userVisibleMessage,modelCalled:false},'CURRENT_FIXTURE');
 }
 const client=actors.client.id;
 const external=await pre.createPreInquiry(client,{clientActionId:crypto.randomUUID(),topic:'SOL TEST väline kanal',situation:'SOL TEST DETAILS: soovin oma olukorra enne kohtumist kirja panna.',selectedRecipientEmail:'sol-proof-external@example.invalid',selectedRecipientName:'SOL TEST väline kontakt',status:'DRAFT'},{db:prisma});
 rec.created.externalInquiryId=external.id;
 check('DATA-03','external_draft_channel_explicit',external.deliveryChannel==='EXTERNAL_EMAIL'&&!external.recipientOwnerId,{id:external.id,status:external.status,channel:external.deliveryChannel,platformRecipientAssigned:!!external.recipientOwnerId});
 fs.writeFileSync('external-fixture.json',JSON.stringify({runId:rec.runId,inquiryId:external.id,detailMarker:'SOL TEST DETAILS',recipient:'sol-proof-external@example.invalid'},null,2)+'\n');
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),observations:rec.observations,created:rec.created}));}
