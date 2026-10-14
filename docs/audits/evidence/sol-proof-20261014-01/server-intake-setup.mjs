import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],run='sol-proof-20261014-01';
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const org=await import(pathToFileURL(root+'/lib/org/organizations.js'));
const actors=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
const rec={runId:run,serverRelease:root.split('/').at(-1),startedAt:new Date().toISOString(),checks:[],created:{},limits:['Activation and membership are explicitly synthetic fixture setup, not proof of real organization verification or employee invitation.','Uses the same three normal-role accounts. No new user, administrator, payment or real communication is created.','Real company organization and provider profile stay private DRAFT.'],externalMessagesSent:false,newPaidCalls:false};
const save=()=>fs.writeFileSync('server-intake-setup.json',JSON.stringify(rec,null,2)+'\n');
try{
 assert.equal(fs.existsSync('intake-fixture.json'),false,'Intake fixture exists; reuse it instead of creating a second one.');
 for(const [key,a] of Object.entries(actors)){
  const u=await prisma.user.findUnique({where:{id:a.id},select:{email:true,isAdmin:true,role:true}});
  assert.equal(u.email,`${run}-${key}@example.invalid`);assert.equal(u.isAdmin,false);assert.equal(u.role,a.role);
 }
 const created=await org.createOrganization({userId:actors.provider.id,productRole:'SERVICE_PROVIDER',displayName:'SOL TEST — sünteetiline vastuvõtutiim',legalKind:'OTHER',legalName:'SOL TEST; tegelikku asutust ei esinda',clientActionId:run+'-intake-org'},{db:prisma});
 const oid=created.organization.id,owner=created.membership.id;rec.created.organizationId=oid;rec.created.coordinatorMembershipId=owner;save();
 await org.changeOrganizationStatus(oid,{actorUserId:actors.provider.id,isPlatformAdmin:false,toStatus:'PENDING_VERIFICATION',reason:'SOL TEST kontroll enne sünteetilist aktiveerimist'},{db:prisma});
 let denied;try{await org.changeOrganizationStatus(oid,{actorUserId:actors.provider.id,isPlatformAdmin:false,toStatus:'ACTIVE',reason:'SOL TEST non-admin activation probe'},{db:prisma});}catch(e){denied={status:e.status,message:e.messageKey||e.message};}
 rec.checks.push({case_id:'DATA-01',variant_id:'pending_org_nonadmin_activation',status:denied?.status===403?'PASS':'FAIL',evidence_mode:'CURRENT_RUNTIME',entrypoint:'server service module',actual:{denied:!!denied,error:denied}});save();
 assert.equal(denied?.status,403,'Do not proceed if non-admin activation was accepted.');
 await prisma.organization.update({where:{id:oid},data:{status:'ACTIVE',verifiedAt:new Date(),activatedAt:new Date(),verificationNote:'SOL TEST fixture only; no real identity verification, representation or public endorsement.'}});
 await prisma.organizationModule.create({data:{organizationId:oid,moduleKey:'KOV_INTAKE',status:'ACTIVE',reason:'SOL TEST fixture',validUntil:new Date(Date.now()+86400000)}});
 await prisma.organizationCapabilityGrant.createMany({data:['INBOX_COORDINATOR','WORK_ASSIGNER'].map(capability=>({membershipId:owner,capability,scopeType:'ORGANIZATION',grantedByUserId:actors.provider.id,reason:'SOL TEST fixture coordinator'}))});
 const worker=await prisma.organizationMembership.create({data:{organizationId:oid,userId:actors.specialist.id,seatRole:'SOCIAL_WORKER',status:'ACTIVE',jobTitle:'SOL TEST assigned worker'}});
 rec.created.workerMembershipId=worker.id;
 const fixture={runId:run,organizationId:oid,coordinatorMembershipId:owner,workerMembershipId:worker.id,coordinatorUserId:actors.provider.id,workerUserId:actors.specialist.id,activationMode:'SYNTHETIC_FIXTURE_DB_SETUP',status:'ACTIVE',module:'KOV_INTAKE',cleanupPolicy:'set SUSPENDED after bounded runtime tests; preserve records for continuation'};
 fs.writeFileSync('intake-fixture.json',JSON.stringify(fixture,null,2)+'\n');
 rec.finishedAt=new Date().toISOString();save();console.log(JSON.stringify({checks:rec.checks,created:rec.created,fixtureActivated:true}));
}finally{await prisma.$disconnect();}
