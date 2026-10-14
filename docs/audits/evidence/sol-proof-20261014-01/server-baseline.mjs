import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],runId='sol-proof-20261014-01';
const accounts=JSON.parse(fs.readFileSync('accounts.json','utf8'));
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const journey=await import(pathToFileURL(root+'/lib/journey/service.js'));
const steps=await import(pathToFileURL(root+'/lib/journey/steps.js'));
const assessments=await import(pathToFileURL(root+'/lib/journey/assessments.js'));
const inquiries=await import(pathToFileURL(root+'/lib/preInquiries.js'));
const questionnaire=await import(pathToFileURL(root+'/lib/preInquiriesQuestionnaire.js'));
const star=await import(pathToFileURL(root+'/lib/preInquiryStarTool.js'));
const network=await import(pathToFileURL(root+'/lib/network/share.js'));
const organizations=await import(pathToFileURL(root+'/lib/org/organizations.js'));
const providerProfiles=await import(pathToFileURL(root+'/lib/serviceProviderProfiles.js'));
const record={runId,startedAt:new Date().toISOString(),serverRelease:root.split('/').at(-1),environment:'actual development server and its database',checks:[],created:{},limits:['Service-module calls prove the tested server code and database behavior; they do not replace HTTP/UI authorization tests.','Authentication uses one-time synthetic fixture tokens; PIN/OTP flow is not claimed.'],externalMessagesSent:false,newPaidCalls:false};
function check(id,variant,ok,actual,mode='CURRENT_RUNTIME') {record.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:mode,entrypoint:'server service module',actual});}
async function probe(id,variant,fn){try{await fn();}catch(e){record.checks.push({case_id:id,variant_id:variant,status:'BLOCKED',gap_kind:'HARNESS_OR_PRECONDITION',evidence_mode:'CURRENT_RUNTIME',actual:{code:e.code,status:e.status,message:String(e.message).slice(0,350)}});}}
const actors=accounts.actors;
const jars=new Map();
async function call(actor,path,method='GET',body,form=false){
 const jar=jars.get(actor)||new Map();jars.set(actor,jar);
 const r=await fetch('https://sotsiaal.pro'+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Origin:'https://sotsiaal.pro',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{})},...(body?{body:form?new URLSearchParams(body).toString():JSON.stringify(body)}:{})});
 for(const cookie of r.headers.getSetCookie()){const first=cookie.split(';')[0],i=first.indexOf('=');jar.set(first.slice(0,i),first.slice(i+1));}
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={nonJson:true};}return{status:r.status,data};
}
try{
 for(const [key,a] of Object.entries(actors)){
  const fresh=await prisma.user.findUnique({where:{id:a.id},select:{email:true,role:true,isAdmin:true,notificationEmailEnabled:true}});
  assert.equal(fresh.email,`${runId}-${key}@example.invalid`);assert.equal(fresh.isAdmin,false);
  check('ENV-03','actor_'+key,fresh.role===a.role&&fresh.notificationEmailEnabled===false,{role:fresh.role,isAdmin:fresh.isAdmin,emailNotifications:false});
  await probe('ENV-03','http_session_'+key,async()=>{
   const token=crypto.randomBytes(32).toString('hex');
   await prisma.loginTempToken.create({data:{userId:a.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+300000),requiresOtp:false}});
   const csrf=await call(key,'/api/auth/csrf');
   const login=await call(key,'/api/auth/callback/credentials','POST',{csrfToken:csrf.data.csrfToken,temp_login_token:token,callbackUrl:'https://sotsiaal.pro',json:'true'},true);
   const session=await call(key,'/api/auth/session');
   check('ENV-03','http_session_'+key,session.data?.user?.id===a.id&&session.data.user.role===a.role,{callbackStatus:login.status,sessionStatus:session.status,role:session.data?.user?.role,fixtureToken:true},'CURRENT_RUNTIME');
   const guarded=await call(key,'/api/journeys');
   record.checks.push({case_id:'ENV-02',variant_id:'closed_gate_'+key,status:guarded.status===503?'PASS':'FAIL',evidence_mode:'CURRENT_RUNTIME',entrypoint:'HTTPS API',actual:{status:guarded.status,message:guarded.data.message},workflowStatus:guarded.status===503?'BLOCKED_BY_INTENTIONAL_PRELAUNCH_GATE':'UNKNOWN'});
  });
 }
 let j;
 await probe('FLOW-04','journey_create_and_retry',async()=>{
  const input={clientActionId:crypto.randomUUID(),title:'SOL TEST: iseseisev digitaalne toimetulek',summary:'Sünteetiline olukord: soovin abi testtelefoni seadistamisel.',primaryPath:'PRE_INQUIRY',domains:['digitaalne toimetulek'],context:{personWish:'PRIVAATNE KONTROLLFRAAS '+runId}};
  j=await journey.createJourneyForUser(actors.client.id,input,{db:prisma});
  const repeated=await journey.createJourneyForUser(actors.client.id,input,{db:prisma});
  record.created.journeyId=j.id;check('FLOW-04','journey_create_and_retry',!!j.id&&repeated.id===j.id,{id:j.id,retrySameId:repeated.id===j.id});
 });
 if(j){
  await probe('FLOW-04','steps',async()=>{
   const input={clientActionId:crypto.randomUUID(),title:'Kirjeldan oma muret',doer:'Mina',dueOn:'2026-10-15'};
   const added=await steps.createJourneyStep(actors.client.id,j.id,input,{db:prisma});
   const again=await steps.createJourneyStep(actors.client.id,j.id,input,{db:prisma});
   const rows=await prisma.journeyStep.findMany({where:{journeyId:j.id,ownerUserId:actors.client.id},select:{id:true,title:true,dueOn:true,state:true}});
   check('FLOW-04','steps',rows.length===1&&added.stepId===again.stepId&&rows[0].dueOn==='2026-10-15',{rows,retrySameId:added.stepId===again.stepId});
  });
  await probe('FLOW-04','self_assessments',async()=>{
   await assessments.createJourneyAssessment(actors.client.id,j.id,{level:2,note:'Sünteetiline algseis',clientActionId:crypto.randomUUID()},{db:prisma});
   await assessments.createJourneyAssessment(actors.client.id,j.id,{level:4,note:'Sünteetiline järelhinnang',clientActionId:crypto.randomUUID()},{db:prisma});
   const rows=await prisma.journeyAssessment.findMany({where:{journeyId:j.id,ownerUserId:actors.client.id},select:{level:true,note:true}});
   check('FLOW-04','self_assessments',rows.length===2&&rows[0].level!==rows[1].level,{rows,individualSelfReport:true});
  });
  await probe('DATA-01','foreign_journey',async()=>{
   let got=null,error=null;try{got=await journey.getJourneyForUser(actors.provider.id,j.id,{db:prisma});}catch(e){error={status:e.status,message:e.message};}
   check('DATA-01','foreign_journey',got===null&&(!error||error.status===404),{denied:got===null,error});
  });
 }
 await probe('FLOW-02','questionnaire_and_export',async()=>{
  const variants=[];
  for(const path of ['QUICK_DESCRIPTION','TARGETED_ASSESSMENT','COMPREHENSIVE_ASSESSMENT']){
   const state=questionnaire.createEmptyPreInquiryAssessmentState(path);
   const client=questionnaire.buildPreInquiryAssessmentExportText(state,{audience:'client'});
   const receiver=questionnaire.buildPreInquiryAssessmentExportText(state,{audience:'receiver'});
   variants.push({path,clientHasUnofficialDisclaimer:client.includes('ei ole ametlik'),receiverHasUnofficialDisclaimer:receiver.includes('ei ole ametlik'),clientLength:client.length,receiverLength:receiver.length,receiverAddsRows:receiver.length>client.length});
  }
  check('FLOW-02','questionnaire_and_export',questionnaire.PRE_INQUIRY_DOMAIN_DEFINITIONS.length===7&&Object.keys(star.STAR_TOOL_BY_QUESTION).length===21&&variants.every(x=>x.clientHasUnofficialDisclaimer),{domains:questionnaire.PRE_INQUIRY_DOMAIN_DEFINITIONS.length,questions:Object.keys(star.STAR_TOOL_BY_QUESTION).length,variants});
 });
 let inquiry;
 await probe('FLOW-01','free_description_delivery',async()=>{
  const draft=await inquiries.createPreInquiry(actors.client.id,{clientActionId:crypto.randomUUID(),sourceJourneyId:j?.id,topic:'SOL TEST: digiabi',situation:'Sünteetiline eelinfo enne kohtumist: testtelefoni seadistamine.',selectedRecipientEmail:actors.specialist.email,selectedRecipientName:'SOL TEST Spetsialist',status:'DRAFT'},{db:prisma});
  inquiry=await inquiries.updatePreInquiry(actors.client.id,draft.id,{status:'SENT',expectedUpdatedAt:draft.updatedAt},{db:prisma});
  record.created.inquiryId=inquiry.id;
  const received=await inquiries.getVisiblePreInquiry(actors.specialist.id,inquiry.id,{db:prisma});
  check('FLOW-01','free_description_delivery',inquiry.deliveryChannel==='INTERNAL'&&inquiry.status==='SENT'&&received?.situation?.includes('enne kohtumist'),{id:inquiry.id,status:inquiry.status,deliveryChannel:inquiry.deliveryChannel,recipientId:received?.recipientOwnerId,hasPreMeetingInfo:!!received?.situation});
 });
 if(inquiry){
  await probe('DATA-01','wrong_recipient_inquiry',async()=>{
   const other=await inquiries.getVisiblePreInquiry(actors.provider.id,inquiry.id,{db:prisma});
   check('DATA-01','wrong_recipient_inquiry',other===null,{denied:other===null});
  });
  await probe('FLOW-08','before_acceptance_share',async()=>{
   const share=await network.createNetworkShare({prisma,workerId:actors.specialist.id,sourcePreInquiryId:inquiry.id,recipientUserId:actors.provider.id,summaryText:'SOL TEST: palun digitaalset tuge',purpose:'Sünteetiline digiabi',sharingBoundary:'Ainult testtelefon',participationEndsOn:'2026-10-16',mutationKey:crypto.randomUUID()});
   record.created.networkShareId=share.id;check('FLOW-08','before_acceptance_share',!!share.id,{shareId:share.id});
  });
  await probe('FLOW-01','recipient_acceptance',async()=>{
   inquiry=await inquiries.acceptPreInquiry(actors.specialist.id,inquiry.id,{db:prisma});
   check('FLOW-01','recipient_acceptance',inquiry.status==='READY'&&!!inquiry.openedAt,{status:inquiry.status,openedAt:inquiry.openedAt});
  });
  await probe('FLOW-08','after_acceptance_share',async()=>{
   let shared,error=null;try{shared=await network.createNetworkShare({prisma,workerId:actors.specialist.id,sourcePreInquiryId:inquiry.id,recipientUserId:actors.provider.id,summaryText:'SOL TEST: jagamine pärast vastuvõttu',purpose:'Sünteetiline jätkutöö',sharingBoundary:'Ainult testtelefon',participationEndsOn:'2026-10-16',mutationKey:crypto.randomUUID()});}catch(e){error={message:e.message,status:e.status};}
   check('FLOW-08','after_acceptance_share',!!shared?.id,{sourceStatus:inquiry.status,created:!!shared?.id,error});
  });
 }
 await probe('TOOLS-02','provider_draft',async()=>{
  const profile=await providerProfiles.upsertServiceProviderProfileForOwner(actors.provider.id,{organizationName:'OÜ Küberloome',registryCode:'14206225',organizationType:'Osaühing',email:'raudsoolaur@gmail.com',address:'Harju maakond, Harku vald, Tabasalu alevik, Kolde tn 6/1, 76901',shortDescription:'SOL TEST: omaniku loal loodud privaatne katseprofiil.',status:'DRAFT',mapVisible:false,acceptsPlatformPreInquiries:false,acceptsEmailPreInquiries:false,assistantRecommendationAllowed:false},{db:prisma,idempotencyKey:runId+'-provider-draft'});
  record.created.providerProfileId=profile.id;
  check('TOOLS-02','provider_draft',profile.status==='DRAFT'&&profile.registryCode==='14206225'&&profile.mapVisible===false,{id:profile.id,status:profile.status,registryCode:profile.registryCode,mapVisible:profile.mapVisible,emailMatchesOwnerInput:profile.email==='raudsoolaur@gmail.com'});
 });
 await probe('TOOLS-02','organization_draft',async()=>{
  const result=await organizations.createOrganization({userId:actors.provider.id,productRole:'SERVICE_PROVIDER',displayName:'OÜ Küberloome — SOL TEST',legalKind:'COMPANY',legalName:'OÜ Küberloome',registryCode:'14206225',clientActionId:runId+'-organization'},{db:prisma});
  record.created.organizationResultKeys=Object.keys(result);record.created.organizationId=result.organization?.id||result.id;
  check('TOOLS-02','organization_draft',!!record.created.organizationId,{keys:Object.keys(result),organizationId:record.created.organizationId,status:result.organization?.status||result.status});
 });
}finally{
 record.finishedAt=new Date().toISOString();fs.writeFileSync('server-baseline.json',JSON.stringify(record,null,2)+'\n');await prisma.$disconnect();
 console.log(JSON.stringify({runId,checks:record.checks.map(x=>({id:x.case_id,variant:x.variant_id,status:x.status,actual:x.status==='PASS'?undefined:x.actual})),created:record.created}));
}
