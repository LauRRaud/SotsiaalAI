import os, subprocess, pathlib, json, datetime

run_id = 'sol-proof-20261014-01'
props = dict(line.split('=', 1) for line in subprocess.check_output(
    ['systemctl', 'show', 'sotsiaalai-frontend.service', '--property=WorkingDirectory,MainPID'], text=True
).splitlines() if '=' in line)
root = pathlib.Path(props['WorkingDirectory']).resolve()
assert str(root).startswith('/home/ubuntu/apps/sotsiaalai-releases/')
frontend_env = dict(item.split('=', 1) for item in pathlib.Path('/proc/' + props['MainPID'] + '/environ').read_text().split('\0') if '=' in item)
work = pathlib.Path('/tmp') / run_id
work.mkdir(mode=0o700, exist_ok=True)
# Working outside the release prevents dotenv from loading provider credentials.
env = {'PATH': os.environ['PATH'], 'NODE_ENV': 'production', 'TZ': 'UTC', 'DATABASE_URL': frontend_env['DATABASE_URL']}
code = r'''
import {pathToFileURL} from 'node:url';
const root=process.argv[2],run='sol-proof-20261014-01';
const {prisma}=await import(pathToFileURL(root+'/lib/prisma.js'));
const actors={};
try {
 for(const [key,role,label] of [['client','CLIENT','Pöörduja'],['specialist','SOCIAL_WORKER','Spetsialist'],['provider','SERVICE_PROVIDER','Teenuseosutaja']]) {
  const email=`${run}-${key}@example.invalid`;
  const existing=await prisma.user.findUnique({where:{email},select:{id:true,role:true,isAdmin:true}});
  if(existing) throw Error('Test account already exists; inspect this run before reuse');
  const plan=await prisma.planDefinition.findFirst({where:{role,active:true,key:{not:'free'}},select:{id:true,key:true}});
  if(!plan)throw Error('No active plan for '+role);
  const account=await prisma.user.create({data:{email,emailVerified:new Date(),role,isAdmin:false,
   notificationEmailEnabled:false,acceptsPreInquiries:role==='SOCIAL_WORKER',
   profile:{create:{firstName:'SOL TEST',lastName:label}},
   subscriptions:{create:{status:'ACTIVE',plan:plan.key,planDefinitionId:plan.id,billingMode:'ONE_OFF',validUntil:new Date(Date.now()+86400000)}}
  },select:{id:true,email:true,role:true,isAdmin:true,notificationEmailEnabled:true,acceptsPreInquiries:true}});
  actors[key]=account;
 }
 console.log(JSON.stringify({runId:run,createdAt:new Date().toISOString(),serverRelease:root.split('/').at(-1),environment:'actual development server and its database; owner-authorized synthetic test accounts',actors,
  realPaymentsCreated:false,newPaidCalls:false,externalMessagesSent:false,normalRoles:true}));
} finally { await prisma.$disconnect(); }
'''
result = subprocess.run(['node', '--import', str(root/'scripts/register-node-source-loader.mjs'), '--input-type=module', '-', str(root)],
    input=code, text=True, cwd=work, env=env, capture_output=True)
if result.returncode:
    print(json.dumps({'ok':False,'error':result.stderr[-3000:]}))
    raise SystemExit(result.returncode)
record=json.loads(result.stdout.strip().splitlines()[-1])
(work/'accounts.json').write_text(json.dumps(record,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(record,ensure_ascii=False))
