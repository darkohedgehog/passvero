# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one exact staging marketing deploy and paired pin alignment
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_DEPLOY_ONCE'
import hashlib,json,os,pathlib,re,stat,subprocess
P=pathlib.Path
source=P('/tmp/passvero-marketing-pin-alignment-20261012')
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
pins={
 'deploy.py':'4eb70f1c42602cded01ff9e5e80fcfa3ff5fdfaad611a0452ec2830cd01b2ddd',
 'preflight-v2.py':'f176a0d74ed133498986d8e9055a19320e77bca1078dbc773ad7b28b195f7892',
 'artifact-manifest.json':'8222518bd18a446278df3e375a2fdfe1af92c598cddecc46d072c6b745e13817',
 'application.tar.gz':'8c3e74a998966976aa92777a37fb1b040b2d02dea1ac49c4a1f148744e062a1e'}
check_id='SEAL_EXACT_REVIEWED_INPUTS'
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST'
 os.umask(0o077)
 assert not root.exists() and not root.is_symlink(),'EXISTING_DEPLOYMENT_STOP_NO_RETRY'
 inputs={}
 for name,pin in pins.items():
  path=source/name
  assert stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(),'UPLOAD_FILE_POSTURE'
  body=path.read_bytes()
  assert hashlib.sha256(body).hexdigest()==pin,'UPLOAD_PIN_CHANGED'
  inputs[name]=body
 root.mkdir(mode=0o700)
 for name,body in inputs.items():
  fd=os.open(root/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb') as handle:
   handle.write(body);handle.flush();os.fsync(handle.fileno())
 check_id='ONE_BOUNDED_UNIT_WITH_INDEPENDENT_CLOSE'
 helper=str(root/'deploy.py')
 args=['/usr/bin/systemd-run','--quiet','--wait',
  '--unit','passvero-marketing-pin-alignment-20261012',
  '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group',
  '--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s',
  '--property=StandardOutput=null','--property=StandardError=null',
  '--property=ExecStopPost=/usr/bin/python3 -I -B '+helper+' --close',
  '/usr/bin/python3','-I','-B',helper,'--deploy']
 result=subprocess.run(args,capture_output=True,timeout=700)
 output={'unitReturnCode':result.returncode,'automaticRetry':False}
 for name in ('body-pass.json','first-failure.json','closure.json','closure-failure.json'):
  path=root/name
  output[name]=json.loads(path.read_text()) if path.is_file() else None
 output['deployment']='PASS_PENDING_READ_ONLY_VISUAL' if result.returncode==0 and output['body-pass.json'] and output['closure.json'] and output['closure.json'].get('release')=='NEW_ALIGNED' and not output['closure-failure.json'] else 'STOP_RETURN_OUTPUT_NO_RETRY'
 print(json.dumps(output,sort_keys=True,indent=2),flush=True)
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_DEPLOY_ONCE
