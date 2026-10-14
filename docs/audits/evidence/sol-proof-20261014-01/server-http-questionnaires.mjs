import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {httpHarness,recorder} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call,login}=await httpHarness(root);
const q=await import(pathToFileURL(root+'/lib/preInquiriesQuestionnaire.js'));
const {rec,save,check}=recorder(root,'server-http-questionnaires');
try{
 await login('client');
 for(const path of ['TARGETED_ASSESSMENT','COMPREHENSIVE_ASSESSMENT']){
  const state=q.createEmptyPreInquiryAssessmentState(path),flat=state.domains.flatMap(d=>d.primaryAnswers);
  state.subject.concernsAbout='Minu enda kohta';state.subject.consentStatus='Pöördun enda kohta';
  state.supportContext.personWish='SOL TEST: soovin enne kohtumist valmistuda';
  flat[0].screenAnswer='UNKNOWN';flat[1].screenAnswer='SOME_DIFFICULTY';
  if(path==='COMPREHENSIVE_ASSESSMENT')for(const a of flat){if(!a.screenAnswer)a.screenAnswer='INDEPENDENT';}
  const r=await call('client','/api/pre-inquiries','POST',{clientActionId:crypto.randomUUID(),topic:'SOL TEST '+path,assessmentState:state,selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'});
  assert.equal(r.status,201,JSON.stringify(r.data));rec.created[path]=r.data.inquiry.id;
  const saved=r.data.inquiry.assessmentState,answers=saved.domains.flatMap(d=>d.primaryAnswers),unknown=answers[0],unanswered=answers.filter(a=>!a.screenAnswer);
  check('FLOW-02','filled_'+path+'_corrected_harness',unknown.screenAnswer==='UNKNOWN'&&unknown.status==='UNKNOWN'&&answers.length===21&&(path!=='TARGETED_ASSESSMENT'||unanswered.length>0&&unanswered.every(a=>!a.status)),{status:r.status,path,questionCount:answers.length,unknownRemainsUnknown:unknown.status==='UNKNOWN',unansweredCount:unanswered.length,unansweredStatusValues:[...new Set(unanswered.map(a=>a.status))],recordId:r.data.inquiry.id});
  const clientText=q.buildPreInquiryAssessmentExportText(saved,{audience:'client'}),receiverText=q.buildPreInquiryAssessmentExportText(saved,{audience:'receiver'});
  check('FLOW-02','filled_export_'+path,clientText.includes('ei ole ametlik')&&receiverText.includes('ei ole ametlik')&&/ei oska öelda/i.test(clientText),{clientDisclaimer:clientText.includes('ei ole ametlik'),receiverDisclaimer:receiverText.includes('ei ole ametlik'),unknownLabel:/ei oska öelda/i.test(clientText),clientLength:clientText.length,receiverLength:receiverText.length},'CURRENT_FIXTURE');
  const sent=await call('client',`/api/pre-inquiries/${r.data.inquiry.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:r.data.inquiry.updatedAt});
  assert.equal(sent.status,200,JSON.stringify(sent.data));await login('specialist');
  const viewed=await call('specialist',`/api/pre-inquiries/${r.data.inquiry.id}`);
  check('FLOW-02','filled_receiver_'+path,viewed.status===200&&viewed.data?.inquiry?.assessmentState?.path===path&&viewed.data.inquiry.assessmentState.domains[0].primaryAnswers[0].status==='UNKNOWN',{sendStatus:sent.status,recipientStatus:viewed.status,correctPath:viewed.data?.inquiry?.assessmentState?.path,unknownRetained:viewed.data?.inquiry?.assessmentState?.domains[0]?.primaryAnswers[0]?.status==='UNKNOWN'});
 }
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({checks:rec.checks.length,nonpassing:rec.checks.filter(c=>c.status!=='PASS'),created:rec.created}));}
