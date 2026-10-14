import os, sys, pathlib, subprocess, json
props=dict(line.split('=',1) for line in subprocess.check_output(['systemctl','show','sotsiaalai-frontend.service','--property=WorkingDirectory,MainPID'],text=True).splitlines() if '=' in line)
root=pathlib.Path(props['WorkingDirectory']).resolve()
assert str(root).startswith('/home/ubuntu/apps/sotsiaalai-releases/')
front=dict(item.split('=',1) for item in pathlib.Path('/proc/'+props['MainPID']+'/environ').read_text().split('\0') if '=' in item)
work=pathlib.Path('/tmp/sol-proof-20261014-01')
script=work/sys.argv[1]
assert script.parent==work and script.suffix=='.mjs' and script.exists()
env={'PATH':os.environ['PATH'],'NODE_ENV':'production','TZ':'UTC','DATABASE_URL':front['DATABASE_URL']}
for key in ['ORG_WORKSPACE_ENABLED','ORG_CREATION_ENABLED','ORG_SEATS_ENABLED','ORG_INBOX_ENABLED','CASEWORK_V1_ENABLED','SERVICE_LOG_ENABLED']:
    if key in front: env[key]=front[key]
# No dotenv files or provider credentials are available in the working directory.
result=subprocess.run(['node','--import',str(root/'scripts/register-node-source-loader.mjs'),str(script),str(root)],cwd=work,env=env,text=True,capture_output=True)
if result.stderr: print(json.dumps({'scriptStderr':result.stderr[-2000:]}))
print(result.stdout)
raise SystemExit(result.returncode)
