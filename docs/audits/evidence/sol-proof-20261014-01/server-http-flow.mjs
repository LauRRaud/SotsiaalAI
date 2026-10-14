import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
const root=process.argv[2],runId='sol-proof-20261014-01';
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const q=await import(pathToFileURL(root+'/lib/preInquiriesQuestionnaire.js'));
const actors=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
const baseline=JSON.parse(fs.readFileSync('server-baseline.json','utf8'));
const rec={runId,startedAt:new Date().toISOString(),serverRelease:root.split('/').at(-1),entrypoint:'actual HTTPS API, normal-role fixture sessions',checks:[],created:{},externalMessagesSent:false,newPaidCalls:false,limits:['No PIN/OTP email flow is claimed.','No human time savings or answer accuracy is measured.','Only the three owner-authorized actors and their records are used.']};
const jars=new Map();
function save(){fs.writeFileSync('server-http-flow.json',JSON.stringify(rec,null,2)+'\n');}
function check(id,variant,ok,actual,mode='CURRENT_RUNTIME'){rec.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:mode,entrypoint:rec.entrypoint,actual});save();}
async function probe(id,variant,fn){try{await fn();}catch(e){rec.checks.push({case_id:id,variant_id:variant,status:'BLOCKED',gap_kind:'HARNESS_OR_PRECONDITION',actual:{message:String(e.message).slice(0,400)}});save();}}
async function call(actor,path,method='GET',body,form=false){
 const jar=jars.get(actor)||new Map();jars.set(actor,jar);
 const r=await fetch('https://sotsiaal.pro'+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Origin:'https://sotsiaal.pro',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{})},...(body?{body:form?new URLSearchParams(body).toString():JSON.stringify(body)}:{})});
 for(const c of r.headers.getSetCookie()){const f=c.split(';')[0],i=f.indexOf('=');jar.set(f.slice(0,i),f.slice(i+1));}
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=null;}
 return {status:r.status,data,text,cache:r.headers.get('cache-control'),location:r.headers.get('location')};
}
async function login(key){
 const a=actors[key];const own=await prisma.user.findUnique({where:{id:a.id},select:{email:true,isAdmin:true,role:true}});
 assert.equal(own.email,`${runId}-${key}@example.invalid`);assert.equal(own.isAdmin,false);
 const token=crypto.randomBytes(32).toString('hex');
 await prisma.loginTempToken.create({data:{userId:a.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+300000),requiresOtp:false}});
 const csrf=await call(key,'/api/auth/csrf');
 await call(key,'/api/auth/callback/credentials','POST',{csrfToken:csrf.data.csrfToken,temp_login_token:token,callbackUrl:'https://sotsiaal.pro/admin',json:'true'},true);
 const s=await call(key,'/api/auth/session');
 assert.equal(s.data?.user?.id,a.id);assert.equal(s.data.user.role,a.role);assert.equal(s.data.user.isAdmin,false);
}
try{
 for(const key of Object.keys(actors)){
  await login(key);
  const r=await call(key,'/api/journeys');
  check('ENV-03','https_ordinary_role_access_'+key,r.status===200&&r.data?.ok===true,{role:actors[key].role,status:r.status,isAdmin:false});
  if(r.status!==200)throw Error('Prelaunch test access not yet available: '+key);
  const adm=await call(key,'/admin');
  check('ENV-02','admin_entry_redirect_'+key,[200,307].includes(adm.status)&&(adm.location?.includes('toolaud')||adm.text.includes('/toolaud')),{status:adm.status,location:adm.location,containsWorkspaceRedirect:adm.text.includes('/toolaud')});
  const adminApi=await call(key,'/api/admin/service-availability');
  check('DATA-01','no_admin_api_'+key,[401,403].includes(adminApi.status),{status:adminApi.status,returnedProfileData:!!adminApi.data?.profiles});
 }
 const anon=await call('anonymous','/api/journeys');
 check('ENV-02','anonymous_stays_closed',anon.status===503&&anon.data?.error==='platform_not_open',{status:anon.status,error:anon.data?.error});
 const jid=baseline.created.journeyId;
 await probe('FLOW-03','selected_handoff_http',async()=>{
  const own=await call('client',`/api/journeys/${jid}`);
  assert.equal(own.status,200);
  const pre=await call('client',`/api/journeys/${jid}/pre-inquiry-draft`,'POST',{shareKeys:['summary','title']});
  const marker='PRIVAATNE KONTROLLFRAAS '+runId;
  check('FLOW-03','selected_handoff_http',pre.status===200&&!!pre.data?.prefill?.situation&&!pre.text.includes(marker),{status:pre.status,shared:pre.data?.shared,persisted:pre.data?.persisted,confirmedKeys:pre.data?.prefill?.sharedJourneyInfo?.confirmedKeys,privateMarkerAbsent:!pre.text.includes(marker)});
  if(pre.status===200)rec.created.prefill=pre.data.prefill;
 });
 for(const key of ['specialist','provider']){
  for(const [suffix,method,body] of [['','GET'],['/export','GET'],['','PATCH',{title:'SOL TEST unauthorized write'}],['/pre-inquiry-draft','POST',{shareKeys:['summary','wish']}]]){
   const r=await call(key,`/api/journeys/${jid}${suffix}`,method,body);
   check('DATA-01',`${key}_foreign_journey_${method}_${suffix||'detail'}`,r.status===404&&!r.text.includes('PRIVAATNE KONTROLLFRAAS'),{status:r.status,privateMarkerAbsent:!r.text.includes('PRIVAATNE KONTROLLFRAAS')});
  }
 }
 let draft;
 await probe('FLOW-01','free_draft_edit_send',async()=>{
  const pre=rec.created.prefill||{};
  const r=await call('client','/api/pre-inquiries','POST',{...pre,sourceJourneyId:jid,clientActionId:crypto.randomUUID(),topic:'SOL TEST: ettevalmistus enne kohtumist',situation:pre.situation||'Sünteetiline digiabi vajadus enne kohtumist.',selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'});
  assert.equal(r.status,201,JSON.stringify(r.data));draft=r.data.inquiry;rec.created.freeInquiryId=draft.id;
  const edited=await call('client',`/api/pre-inquiries/${draft.id}`,'PATCH',{situation:'SOL TEST: Mul on lihtsam oma abivajadus enne kohtumist kirja panna. Vajan abi testtelefoni seadistamisel.',expectedUpdatedAt:draft.updatedAt});
  assert.equal(edited.status,200,JSON.stringify(edited.data));draft=edited.data.inquiry;
  const sent=await call('client',`/api/pre-inquiries/${draft.id}`,'PATCH',{status:'SENT',expectedUpdatedAt:draft.updatedAt});
  check('FLOW-01','free_draft_edit_send',sent.status===200&&sent.data?.inquiry?.status==='SENT'&&sent.data.inquiry.deliveryChannel==='INTERNAL',{createStatus:r.status,editStatus:edited.status,sendStatus:sent.status,inquiryId:draft.id,status:sent.data?.inquiry?.status,channel:sent.data?.inquiry?.deliveryChannel,questionnaireRequired:false});
  draft=sent.data?.inquiry||draft;
  const received=await call('specialist',`/api/pre-inquiries/${draft.id}`);
  check('FLOW-01','specialist_reads_before_meeting',received.status===200&&received.data?.inquiry?.situation?.includes('enne kohtumist'),{status:received.status,hasSender:!!received.data?.inquiry?.owner,hasSentAt:!!received.data?.inquiry?.sentAt,hasPreMeetingText:received.data?.inquiry?.situation?.includes('enne kohtumist')});
  check('FLOW-03','recipient_selected_copy_privacy',received.status===200&&!received.text.includes('PRIVAATNE KONTROLLFRAAS'),{status:received.status,privateJourneyMarkerAbsent:!received.text.includes('PRIVAATNE KONTROLLFRAAS'),sharedKeys:received.data?.inquiry?.sharedJourneyInfo?.confirmedKeys});
  for(const [suffix,method,body] of [['','GET'],['','PATCH',{situation:'SOL TEST unauthorized edit'}],['/accept','POST',{}],['/workflow','PATCH',{status:'ARCHIVED'}]]){
   const denied=await call('provider',`/api/pre-inquiries/${draft.id}${suffix}`,method,body);
   check('DATA-01',`provider_foreign_inquiry_${method}_${suffix||'detail'}`,denied.status===404&&!denied.text.includes('Vajan abi testtelefoni'),{status:denied.status,contentAbsent:!denied.text.includes('Vajan abi testtelefoni')});
  }
  // Leave sent and not accepted for the specialist's UI observation.
 });
 for(const path of ['TARGETED_ASSESSMENT','COMPREHENSIVE_ASSESSMENT']){
  await probe('FLOW-02','filled_'+path,async()=>{
   const state=q.createEmptyPreInquiryAssessmentState(path);
   state.subject.concernsAbout='Minu enda kohta';state.subject.consentStatus='Pöördun enda kohta';
   state.supportContext.personWish='SOL TEST: soovin enne kohtumist valmistuda';
   state.domains[0].primaryAnswers[0].screenAnswer='UNKNOWN';
   state.domains[0].primaryAnswers[1].screenAnswer='SOME_DIFFICULTY';
   if(path==='COMPREHENSIVE_ASSESSMENT'){
    for(const domain of state.domains)for(const answer of domain.primaryAnswers){if(!answer.screenAnswer)answer.screenAnswer='INDEPENDENT';}
   }
   const r=await call('client','/api/pre-inquiries','POST',{clientActionId:crypto.randomUUID(),topic:'SOL TEST '+path,assessmentState:state,selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'});
   assert.equal(r.status,201,JSON.stringify(r.data));rec.created[path]=r.data.inquiry.id;
   const saved=r.data.inquiry.assessmentState;
   const secondDomain=saved.domains[1];
   const answer=saved.domains[0].primaryAnswers[0];
   const count=saved.domains.reduce((n,d)=>n+d.primaryAnswers.length,0);
   check('FLOW-02','filled_'+path,answer.screenAnswer==='UNKNOWN'&&answer.status==='UNKNOWN'&&count===21&&(path!=='TARGETED_ASSESSMENT'||secondDomain.primaryAnswers.every(a=>!a.screenAnswer&&!a.status)),{status:r.status,path,questionCount:count,unknownRemainsUnknown:answer.status==='UNKNOWN',unansweredDomainStatuses:secondDomain.primaryAnswers.map(a=>a.status),recordId:r.data.inquiry.id});
   const normalized=q.normalizePreInquiryAssessmentState(saved);
   const clientExport=q.buildPreInquiryAssessmentExportText(normalized,{audience:'client'}),receiverExport=q.buildPreInquiryAssessmentExportText(normalized,{audience:'receiver'});
   check('FLOW-02','filled_export_'+path,clientExport.includes('ei ole ametlik')&&receiverExport.includes('ei ole ametlik')&&clientExport.includes('Ei oska öelda'),{clientDisclaimer:clientExport.includes('ei ole ametlik'),receiverDisclaimer:receiverExport.includes('ei ole ametlik'),unknownLabel:clientExport.includes('Ei oska öelda'),clientLength:clientExport.length,receiverLength:receiverExport.length},'CURRENT_FIXTURE');
  });
 }
 await probe('FLOW-06','draft_org_not_recipient_http',async()=>{
  const r=await call('client','/api/pre-inquiries','POST',{clientActionId:crypto.randomUUID(),topic:'SOL TEST suletud asutus',situation:'Sünteetiline katse',recipientOrganizationId:baseline.created.organizationId,recipientType:'ORGANIZATION_INBOX',status:'DRAFT'});
  check('FLOW-06','draft_org_not_recipient_http',r.status===409,{status:r.status,message:r.data?.message,successfulReceipt:false});
 });
 for(const key of Object.keys(actors)){
  const r=await call(key,'/api/service-provider/profile');
  check('TOOLS-02','provider_profile_role_'+key,key==='provider'?r.status===200:[401,403].includes(r.status),{status:r.status,role:actors[key].role,ownProfileOnly:key==='provider'?r.data?.profile?.id===baseline.created.providerProfileId:undefined});
 }
}finally{rec.finishedAt=new Date().toISOString();save();await prisma.$disconnect();console.log(JSON.stringify({release:rec.serverRelease,checks:rec.checks.length,pass:rec.checks.filter(x=>x.status==='PASS').length,fail:rec.checks.filter(x=>x.status==='FAIL').length,blocked:rec.checks.filter(x=>x.status==='BLOCKED').length,nonpassing:rec.checks.filter(x=>x.status!=='PASS'),created:rec.created}));}
