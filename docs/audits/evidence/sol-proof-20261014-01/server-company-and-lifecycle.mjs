import fs from 'node:fs';import crypto from 'node:crypto';import {pathToFileURL} from 'node:url';
const root=process.argv[2],runId='sol-proof-20261014-01';
const a=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
const previous=JSON.parse(fs.readFileSync('server-baseline.json','utf8'));
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const inquiries=await import(pathToFileURL(root+'/lib/preInquiries.js'));
const journey=await import(pathToFileURL(root+'/lib/journey/service.js'));
const profile=await import(pathToFileURL(root+'/lib/serviceProviderProfiles.js'));
const org=await import(pathToFileURL(root+'/lib/org/organizations.js'));
const registry=await import(pathToFileURL(root+'/lib/businessRegisterNameCheck.js'));
const record={runId,startedAt:new Date().toISOString(),serverRelease:root.split('/').at(-1),checks:[],created:{},environment:'actual development server and its database',limits:['Server service entrypoints; complete HTTP/UI paths remain separately gated.','No business contact verification emails or external messages sent.']};
const check=(id,variant,ok,actual)=>record.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:'CURRENT_RUNTIME',entrypoint:'server service module',actual});
async function probe(id,variant,fn){try{await fn();}catch(e){record.checks.push({case_id:id,variant_id:variant,status:'BLOCKED',gap_kind:'HARNESS_OR_PRECONDITION',actual:{code:e.code,status:e.status,message:String(e.message).slice(0,350)}});}}
try{
 for(const[key,v]of Object.entries(a)){const u=await prisma.user.findUnique({where:{id:v.id},select:{email:true}});if(u?.email!==`${runId}-${key}@example.invalid`)throw Error('Foreign actor');}
 await probe('TOOLS-02','live_company_name',async()=>{
  const now=await registry.checkRegisterName({registryCode:'14206225',organizationName:'OÜ Küberloome'},{file:root+'/src/server/data/business-register-names.tsv'});
  const old=await registry.checkRegisterName({registryCode:'14206225',organizationName:'SotsiaalAI OÜ'},{file:root+'/src/server/data/business-register-names.tsv'});
  check('TOOLS-02','live_company_name',now.result==='match'&&now.source==='live'&&old.result==='mismatch',{current:now,previousName:old,publicCompanyCode:'14206225'});
 });
 await probe('FLOW-07','send_retry_and_recall',async()=>{
  const draft=await inquiries.createPreInquiry(a.client.id,{clientActionId:crypto.randomUUID(),topic:'SOL TEST: tagasikutsumine',situation:'Sünteetiline saatmise korduse katse.',selectedRecipientEmail:a.specialist.email,selectedRecipientName:'SOL TEST',status:'DRAFT'},{db:prisma});
  const payload={status:'SENT',expectedUpdatedAt:draft.updatedAt};
  const outcomes=await Promise.allSettled([inquiries.updatePreInquiry(a.client.id,draft.id,payload,{db:prisma}),inquiries.updatePreInquiry(a.client.id,draft.id,payload,{db:prisma})]);
  const fresh=await inquiries.getVisiblePreInquiry(a.client.id,draft.id,{db:prisma});
  const recalled=await inquiries.recallPreInquiry(a.client.id,draft.id,{expectedUpdatedAt:fresh.updatedAt,db:prisma});
  const visible=await inquiries.getVisiblePreInquiry(a.specialist.id,draft.id,{db:prisma});
  const rows=await prisma.preInquiry.count({where:{id:draft.id,authorId:a.client.id}});
  record.created.recalledInquiryId=draft.id;
  check('FLOW-07','send_retry_and_recall',rows===1&&!!recalled.recalledAt&&visible===null,{outcomes:outcomes.map(x=>x.status==='fulfilled'?{fulfilled:true,status:x.value.status}:{fulfilled:false,message:x.reason.message}),rowCount:rows,recalledAt:recalled.recalledAt,recipientDeniedAfterRecall:visible===null});
 });
 await probe('OPS-08','receiver_close_and_journey_state',async()=>{
  const current=await inquiries.getVisiblePreInquiry(a.specialist.id,previous.created.inquiryId,{db:prisma});
  const closed=await inquiries.updatePreInquiryReceiverWorkflow(a.specialist.id,current.id,{status:'ARCHIVED',receiverNote:'SOL TEST: järgmine samm kokku lepitud.',expectedUpdatedAt:current.updatedAt},{db:prisma});
  const linked=await journey.listLinkedPreInquiriesForJourney(a.client.id,previous.created.journeyId,{db:prisma});
  check('OPS-08','receiver_close_and_journey_state',closed.status==='ARCHIVED'&&linked.items?.some(x=>x.id===current.id&&x.status==='ARCHIVED'),{status:closed.status,linked:linked.items?.filter(x=>x.id===current.id)});
 });
 await probe('DATA-01','foreign_provider_profile',async()=>{
  const own=await profile.getServiceProviderProfileForOwner(a.provider.id);
  const other=await profile.getServiceProviderProfileForOwner(a.client.id);
  check('DATA-01','foreign_provider_profile',own?.id===previous.created.providerProfileId&&other===null,{ownProfileFound:!!own,otherActorDenied:other===null});
 });
 await probe('TOOLS-02','organization_creation_retry',async()=>{
  const result=await org.createOrganization({userId:a.provider.id,productRole:'SERVICE_PROVIDER',displayName:'OÜ Küberloome — SOL TEST',legalKind:'COMPANY',legalName:'OÜ Küberloome',registryCode:'14206225',clientActionId:runId+'-organization'},{db:prisma});
  check('TOOLS-02','organization_creation_retry',result.organization?.id===previous.created.organizationId&&result.replayed===true,{organizationId:result.organization?.id,replayed:result.replayed});
 });
 const providerRecord=await prisma.serviceProviderProfile.findFirst({where:{id:previous.created.providerProfileId,ownerId:a.provider.id},select:{organizationName:true,registryCode:true,email:true,address:true,status:true,mapVisible:true}});
 record.company={source:'https://ariregister.rik.ee/est/company/14206225/O%C3%9C-K%C3%BCberloome',verifiedBy:'current e-Business Register browser page; cached web extraction still used previous name',checkedAt:new Date().toISOString(),...providerRecord};
}finally{record.finishedAt=new Date().toISOString();fs.writeFileSync('server-company-and-lifecycle.json',JSON.stringify(record,null,2)+'\n');await prisma.$disconnect();console.log(JSON.stringify(record));}
