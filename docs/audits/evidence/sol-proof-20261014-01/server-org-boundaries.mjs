import fs from 'node:fs';import {pathToFileURL} from 'node:url';
const root=process.argv[2],runId='sol-proof-20261014-01';
const a=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
const baseline=JSON.parse(fs.readFileSync('server-baseline.json','utf8'));
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const access=await import(pathToFileURL(root+'/lib/org/accessContext.js'));
const org=await import(pathToFileURL(root+'/lib/org/organizations.js'));
const members=await import(pathToFileURL(root+'/lib/org/members.js'));
const representation=await import(pathToFileURL(root+'/lib/serviceProviderRepresentation.js'));
const report={runId,serverRelease:root.split('/').at(-1),startedAt:new Date().toISOString(),checks:[],limits:['Own draft test organization only; active institution intake and staff handover not tested by these variants.']};
const check=(id,variant,ok,actual,mode='CURRENT_RUNTIME')=>report.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:mode,entrypoint:'server service module',actual});
try{
 const own=await access.resolveOrgAccessContext({userId:a.provider.id,requestedOrganizationId:baseline.created.organizationId,productRole:'SERVICE_PROVIDER'},{db:prisma});
 check('DATA-01','draft_organization_owner',own.organization?.id===baseline.created.organizationId,{organizationId:own.organization?.id,status:own.organization?.status,kind:own.kind,membershipId:own.membership?.id});
 let foreign=null,error=null;try{foreign=await access.resolveOrgAccessContext({userId:a.specialist.id,requestedOrganizationId:baseline.created.organizationId,productRole:'SOCIAL_WORKER'},{db:prisma});}catch(e){error={status:e.status,message:e.message};}
 check('DATA-01','foreign_organization',!foreign&&error?.status===404,{denied:!foreign,error});
 let writeError=null;try{access.assertWritable(own);}catch(e){writeError={status:e.status,message:e.message};}
 check('DATA-01','draft_organization_write',!!writeError,{denied:!!writeError,error:writeError});
 let activateError=null;try{await org.changeOrganizationStatus(baseline.created.organizationId,{actorUserId:a.provider.id,isPlatformAdmin:false,toStatus:'ACTIVE',reason:'SOL TEST direct self-activation probe'},{db:prisma});}catch(e){activateError={status:e.status,message:e.message};}
 check('DATA-01','direct_draft_self_activation',!!activateError,{denied:!!activateError,error:activateError,note:'Direct DRAFT→ACTIVE is itself invalid; this variant does not test the full PENDING→ACTIVE admin check.'});
 const membership=await prisma.organizationMembership.findFirst({where:{organizationId:baseline.created.organizationId,userId:a.provider.id,status:'ACTIVE'},select:{id:true}});
 let endError=null;try{await members.endMembership(baseline.created.organizationId,membership.id,{actorUserId:a.provider.id,reason:'SOL TEST sole-owner probe'},{db:prisma});}catch(e){endError={status:e.status,message:e.message};}
 const stillActive=await prisma.organizationMembership.count({where:{id:membership.id,status:'ACTIVE'}});
 check('OPS-02','sole_owner_cannot_leave',!!endError&&stillActive===1,{denied:!!endError,error:endError,membershipStillActive:stillActive===1});
 const profile=await prisma.serviceProviderProfile.findFirst({where:{id:baseline.created.providerProfileId,ownerId:a.provider.id}});
 let publishError=null;try{representation.assertRepresentationForPublication({...profile,status:'PUBLISHED'},profile);}catch(e){publishError={status:e.status,message:e.message};}
 check('TOOLS-02','unverified_company_publication_guard',!!publishError,{denied:!!publishError,error:publishError,publicationAttempted:false},'CURRENT_FIXTURE');
 const guarded=await fetch('https://sotsiaal.pro/api/jobs/notifications',{method:'GET',redirect:'manual',signal:AbortSignal.timeout(10000)});
 const body=await guarded.json().catch(()=>null);
 report.observations=[{case_id:'OPS-06',variant_id:'closed_background_route',httpStatus:guarded.status,message:body?.message,error:body?.error,method:'GET only; no job was started'}];
}finally{report.finishedAt=new Date().toISOString();fs.writeFileSync('server-org-boundaries.json',JSON.stringify(report,null,2)+'\n');await prisma.$disconnect();console.log(JSON.stringify(report));}
