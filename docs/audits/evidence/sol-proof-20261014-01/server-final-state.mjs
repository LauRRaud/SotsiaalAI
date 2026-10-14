import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness} from './server-http-support.mjs';
const root=process.argv[2],{prisma,actors,call}=await httpHarness(root);
const read=name=>JSON.parse(fs.readFileSync(name,'utf8'));
try{
 const org=read('intake-fixture.json'),mentor=read('mentoring-fixture.json'),sup=read('supervision-fixture.json');
 const users=[];
 for(const [key,actor] of Object.entries(actors)){
  const u=await prisma.user.findUnique({where:{id:actor.id},select:{role:true,isAdmin:true,email:true,notificationEmailEnabled:true,acceptsPreInquiries:true}});
  assert.equal(u.email,`sol-proof-20261014-01-${key}@example.invalid`);assert.equal(u.isAdmin,false);assert.equal(u.role,actor.role);
  users.push({actor:key,role:u.role,isAdmin:u.isAdmin,emailNotifications:u.notificationEmailEnabled,acceptsPreInquiries:u.acceptsPreInquiries});
 }
 const organization=await prisma.organization.findUnique({where:{id:org.organizationId},select:{id:true,displayName:true,status:true}});
 assert.equal(organization.displayName,'SOL TEST — sünteetiline vastuvõtutiim');assert.equal(organization.status,'SUSPENDED');
 const profile=await prisma.mentorProfile.findUnique({where:{id:mentor.profileId},select:{userId:true,status:true,approvedSnapshotVisible:true}});
 assert.equal(profile.userId,actors.provider.id);assert.equal(profile.status,'DRAFT');assert.equal(profile.approvedSnapshotVisible,false);
 const grant=await prisma.supervisorGrant.findUnique({where:{id:sup.grantId},select:{userId:true,revokedAt:true}});
 assert.equal(grant.userId,actors.specialist.id);assert.ok(grant.revokedAt);
 const publicApi=await call('anonymous','/api/journeys');assert.equal(publicApi.status,503);assert.equal(publicApi.data?.error,'platform_not_open');
 const result={runId:'sol-proof-20261014-01',checkedAt:new Date().toISOString(),serverRelease:root.split('/').at(-1),users,organization,mentorProfile:{status:profile.status,approvedSnapshotVisible:profile.approvedSnapshotVisible},supervisorFixtureGrant:{revokedAt:grant.revokedAt.toISOString()},publicWorkApi:{status:publicApi.status,error:publicApi.data.error},allChecksSatisfied:true};
 fs.writeFileSync('server-final-state.json',JSON.stringify(result,null,2)+'\n');
 const files=['covision-fixture.json','supervision-fixture.json','mentoring-fixture.json','provider-inquiry-fixture.json'];
 console.log(JSON.stringify({result,fixtures:Object.fromEntries(files.map(name=>[name,read(name)]))}));
}finally{await prisma.$disconnect();}
