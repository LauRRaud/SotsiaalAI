import fs from 'node:fs';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.argv[2],action=process.argv[3]||'open';
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const f=JSON.parse(fs.readFileSync('homecare-fixture.json','utf8'));
try{
 const org=await prisma.organization.findUnique({where:{id:f.organizationId}});
 assert.equal(org.displayName,'SOL TEST — sünteetiline vastuvõtutiim');
 assert.ok(['open','close'].includes(action));
 await prisma.organization.update({where:{id:org.id},data:{status:action==='open'?'ACTIVE':'SUSPENDED'}});
 console.log(JSON.stringify({syntheticOrgOnly:true,status:action==='open'?'ACTIVE':'SUSPENDED',release:root.split('/').at(-1)}));
}finally{await prisma.$disconnect();}
