# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one guarded continuation of existing preparation; original STOP retained
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_RESUME_PREPARED_ONCE'
import hashlib,json,os,pathlib,re,stat,subprocess
P=pathlib.Path
source=P('/tmp/passvero-marketing-pin-alignment-20261012')
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
pins={'deploy-resume-prepared.py':'497c298b074574120c863c4d1b904dd9dc311f8f22a999e1f58d5c8fada5fb76'}
check_id='SEAL_EXACT_REVIEWED_INPUTS'
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST'
 os.umask(0o077)
 assert root.is_dir() and not root.is_symlink() and root.lstat().st_uid==0 and stat.S_IMODE(root.stat().st_mode)==0o700,'EXISTING_PRIVATE_ROOT_REQUIRED'
 assert hashlib.sha256((root/'deploy.py').read_bytes()).hexdigest()=='4eb70f1c42602cded01ff9e5e80fcfa3ff5fdfaad611a0452ec2830cd01b2ddd','ORIGINAL_HELPER_CHANGED'
 assert not (root/'attempt.json').exists() and not (root/'resume-attempt.json').exists(),'COORDINATION_OR_CONTINUATION_ALREADY_RESERVED'
 inputs={}
 for name,pin in pins.items():
  path=source/name
  assert stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(),'UPLOAD_FILE_POSTURE'
  body=path.read_bytes()
  assert hashlib.sha256(body).hexdigest()==pin,'UPLOAD_PIN_CHANGED'
  inputs[name]=body
 for name,body in inputs.items():
  fd=os.open(root/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb') as handle:
   handle.write(body);handle.flush();os.fsync(handle.fileno())
 check_id='ONE_BOUNDED_UNIT_WITH_INDEPENDENT_CLOSE'
 helper=str(root/'deploy-resume-prepared.py')
 args=['/usr/bin/systemd-run','--quiet','--wait',
  '--unit','passvero-marketing-pin-alignment-20261012-resume',
  '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group',
  '--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s',
  '--property=StandardOutput=null','--property=StandardError=null',
  '--property=ExecStopPost=/usr/bin/python3 -I -B '+helper+' --close',
  '/usr/bin/python3','-I','-B',helper,'--resume-prepared']
 result=subprocess.run(args,capture_output=True,timeout=700)
 output={'unitReturnCode':result.returncode,'automaticRetry':False}
 for name in ('body-pass.json','first-failure.json','resume-first-failure.json','closure.json','resume-closure.json','resume-closure-failure.json'):
  path=root/name
  output[name]=json.loads(path.read_text()) if path.is_file() else None
 output['deployment']='PASS_PENDING_READ_ONLY_VISUAL' if result.returncode==0 and output['body-pass.json'] and output['resume-closure.json'] and output['resume-closure.json'].get('release')=='NEW_ALIGNED' and not output['resume-closure-failure.json'] else 'STOP_RETURN_OUTPUT_NO_RETRY'
 print(json.dumps(output,sort_keys=True,indent=2),flush=True)
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_RESUME_PREPARED_ONCE
