import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
export async function httpHarness(root){
 const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
 const actors=JSON.parse(fs.readFileSync('accounts.json','utf8')).actors,jars=new Map();
 async function call(key,path,method='GET',body,form=false,extraHeaders={}){
  const jar=jars.get(key)||new Map();jars.set(key,jar);
  const r=await fetch('https://sotsiaal.pro'+path,{method,redirect:'manual',signal:AbortSignal.timeout(30000),headers:{Origin:'https://sotsiaal.pro',Cookie:[...jar].map(([k,v])=>`${k}=${v}`).join('; '),...(body?{'Content-Type':form?'application/x-www-form-urlencoded':'application/json'}:{}),...extraHeaders},...(body?{body:form?new URLSearchParams(body).toString():JSON.stringify(body)}:{})});
  for(const c of r.headers.getSetCookie()){const f=c.split(';')[0],i=f.indexOf('=');jar.set(f.slice(0,i),f.slice(i+1));}
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=null;}
  return{status:r.status,data,text,cache:r.headers.get('cache-control'),location:r.headers.get('location')};
 }
 async function login(key){
  const a=actors[key],u=await prisma.user.findUnique({where:{id:a.id},select:{email:true,isAdmin:true,role:true}});
  assert.equal(u.email,`sol-proof-20261014-01-${key}@example.invalid`);assert.equal(u.isAdmin,false);
  const token=crypto.randomBytes(32).toString('hex');
  await prisma.loginTempToken.create({data:{userId:a.id,tokenHash:crypto.createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+300000),requiresOtp:false}});
  const csrf=await call(key,'/api/auth/csrf');
  await call(key,'/api/auth/callback/credentials','POST',{csrfToken:csrf.data.csrfToken,temp_login_token:token,callbackUrl:'https://sotsiaal.pro/admin',json:'true'},true);
  const s=await call(key,'/api/auth/session');assert.equal(s.data?.user?.id,a.id);assert.equal(s.data.user.role,a.role);assert.equal(s.data.user.isAdmin,false);
 }
 return {prisma,actors,call,login};
}
export function recorder(root,name){
 const rec={runId:'sol-proof-20261014-01',serverRelease:root.split('/').at(-1),startedAt:new Date().toISOString(),checks:[],created:{},externalMessagesSent:false,newPaidCalls:false};
 const save=()=>fs.writeFileSync(name+'.json',JSON.stringify(rec,null,2)+'\n');
 const check=(id,variant,ok,actual,mode='CURRENT_RUNTIME')=>{rec.checks.push({case_id:id,variant_id:variant,status:ok?'PASS':'FAIL',evidence_mode:mode,entrypoint:'actual HTTPS API with synthetic normal-role session',actual});save();};
 return {rec,save,check};
}
