import fs from 'node:fs';
import assert from 'node:assert/strict';
import {httpHarness} from './server-http-support.mjs';
const root=process.argv[2],mode=process.argv[3]||'open',{prisma,actors,call}=await httpHarness(root),file='ui-contact-fixture.json';
assert.ok(['open','hide'].includes(mode));
try{
 let f=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(mode==='open'){
  const anon=await call('anonymous','/api/service-map/entries?type=KOV_CONTACT');
  assert.equal(anon.status,503,'Do not publish a test contact if this map API is anonymously visible.');
  assert.equal(anon.data?.error,'platform_not_open');
  const user=await prisma.user.findUnique({where:{id:actors.specialist.id},select:{email:true,isAdmin:true,acceptsPreInquiries:true}});
  assert.equal(user.email,actors.specialist.email);assert.equal(user.isAdmin,false);assert.equal(user.acceptsPreInquiries,true);
  if(!f){const entry=await prisma.serviceMapEntry.create({data:{type:'KOV_SOCIAL_CONTACT',title:'SOL TEST — katseadressaat',description:'Sünteetiline katsekontakt; ei esinda ühtki KOV-i ega päris asutust.',email:user.email,sourceNamespace:'sol-proof-20261014-01',sourceDocId:'sol-proof-20261014-01-ui-contact',status:'DRAFT'}});f={entryId:entry.id,specialistId:actors.specialist.id,email:user.email,fixtureOnly:true};fs.writeFileSync(file,JSON.stringify(f,null,2)+'\n');}
 }
 assert.ok(f);const own=await prisma.serviceMapEntry.findUnique({where:{id:f.entryId}});
 assert.equal(own.sourceNamespace,'sol-proof-20261014-01');assert.equal(own.email,actors.specialist.email);
 await prisma.serviceMapEntry.update({where:{id:own.id},data:{status:mode==='open'?'PUBLISHED':'HIDDEN'}});
 console.log(JSON.stringify({entryId:own.id,status:mode==='open'?'PUBLISHED':'HIDDEN',fixtureOnly:true,anonymousMapStillClosed:mode==='open'?true:undefined,serverRelease:root.split('/').at(-1)}));
}finally{await prisma.$disconnect();}
