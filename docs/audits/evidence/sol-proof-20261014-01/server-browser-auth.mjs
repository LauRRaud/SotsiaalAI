import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=process.argv[2];
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const actors=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors;
const credentials={};
try{
 for(const [key,a] of Object.entries(actors)){
  const current=await prisma.user.findUnique({where:{id:a.id},select:{email:true,isAdmin:true}});
  assert.equal(current.email,`sol-proof-20261014-01-${key}@example.invalid`);assert.equal(current.isAdmin,false);
  const token=crypto.randomBytes(32).toString('hex');
  await prisma.loginTempToken.create({data:{userId:a.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+300000),requiresOtp:false}});
  credentials[key]={id:a.id,role:a.role,token};
 }
 fs.writeFileSync('browser-auth.json',JSON.stringify(credentials),{mode:0o600});
 console.log(JSON.stringify({ok:true,accounts:3,credentialsPrinted:false,expiryMinutes:5}));
}finally{await prisma.$disconnect();}
