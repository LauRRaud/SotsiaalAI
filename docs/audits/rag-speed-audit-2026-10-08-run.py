"""Run the bounded read-only probe over SSH. Secrets stay in the remote process environment.
Prepared only: the owner paused testing on 08.10.2026.
Run only after a new explicit instruction and after the owner stops server work:
python docs/audits/rag-speed-audit-2026-10-08-run.py --server-work-paused
Requires the frontend stopped and the pinned release still configured. Never stops/starts it.
"""
import base64
import json
import pathlib
import subprocess
import sys

if sys.argv[1:] != ['--server-work-paused']:
    raise SystemExit('NOT_RUN: server work must first be stopped by the owner; explicit --server-work-paused required.')

root = pathlib.Path(__file__).resolve().parent
source = base64.b64encode(root.joinpath('rag-speed-audit-2026-10-08-read.mjs').read_bytes()).decode()
remote = '''import base64,json,os,subprocess
pid=subprocess.check_output(['systemctl','show','sotsiaalai-frontend.service','-p','MainPID','--value'],text=True).strip()
state=subprocess.check_output(['systemctl','show','sotsiaalai-frontend.service','-p','ActiveState','--value'],text=True).strip()
if pid!='0' or state not in ['inactive','failed']: raise RuntimeError('NOT_RUN_frontend_is_not_stopped')
cwd=subprocess.check_output(['systemctl','show','sotsiaalai-frontend.service','-p','WorkingDirectory','--value'],text=True).strip()
if not cwd.endswith('18f5cf256c9e82db35ba86587c47056d8fa8869b'): raise RuntimeError('active_release_changed')
env={k:os.environ[k] for k in ['PATH','HOME'] if k in os.environ}; env['TZ']='UTC'
envfile='/etc/sotsiaalai/releases/'+os.path.basename(cwd)+'.env'
p=subprocess.run(['/usr/bin/node','--env-file='+envfile,'--import','./scripts/register-node-source-loader.mjs','--input-type=module','-e',base64.b64decode(SOURCE).decode()],cwd=cwd,env=env,text=True,capture_output=True,timeout=180)
lines=[s[len('SPEED_AUDIT_RESULT '):] for s in p.stdout.splitlines() if s.startswith('SPEED_AUDIT_RESULT ')]
if not lines:
 print(json.dumps({'failed':True,'code':p.returncode,'diagnostic':'details withheld'})); raise SystemExit(1)
print(lines[-1])
'''.replace('SOURCE', repr(source))
result = subprocess.run(['ssh', 'sotsiaalai', 'sudo python3 -'], input=remote, text=True, capture_output=True, encoding='utf-8', timeout=200)
if result.returncode:
    print(result.stdout or 'Read-only probe failed; sensitive diagnostics withheld.')
    raise SystemExit(result.returncode)
data = json.loads(result.stdout)
target = root / 'evidence' / 'rag-speed-audit-runtime-2026-10-08.json'
target.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'file': str(target), 'rows': len(data['turnMetrics']), 'release': data['release'], 'paidCalls': data['paidCalls']}))
