# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one reviewed canonical-health deploy of retained exact artifacts
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CANONICAL_REVIEWED_DEPLOY'
import hashlib,importlib.util,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
source=P('/tmp/passvero-marketing-pin-alignment-20261012')
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
helper=root/'deploy-canonical-reviewed.py'
check_id='REVIEWED_CANONICAL_HEALTH_AND_FRESH_WINDOW'
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
 os.umask(0o077)
 assert root.is_dir() and not root.is_symlink() and root.lstat().st_uid==0 and stat.S_IMODE(root.stat().st_mode)==0o700,'PRIVATE_ROOT_CHANGED'
 original=root/'deploy-resume-prepared.py'
 assert hashlib.sha256(original.read_bytes()).hexdigest()=='497c298b074574120c863c4d1b904dd9dc311f8f22a999e1f58d5c8fada5fb76','PREVIOUS_HELPER_CHANGED'
 spec=importlib.util.spec_from_file_location('canonical_launch_read_only_definitions',original)
 h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
 assert not helper.exists() and not (root/'canonical-deploy-attempt.json').exists(),'REVIEWED_DEPLOY_BUDGET_ONE'
 h.idle()
 assert all(h.timer_due(name)-time.time()>1200 for name in h.TIMERS),'NEXT_TERM_TOO_CLOSE_NO_DEPLOY'
 closure=json.loads(h.read(root/'canonical-closure.json'))
 assert closure['closure']=='PASS_OLD_ROLLED_BACK_ALIGNED_BASELINE_RESTORED','OLD_CLOSURE_NOT_CONFIRMED'
 upload=source/'deploy-canonical-reviewed.py'
 assert stat.S_ISREG(upload.lstat().st_mode) and not upload.is_symlink(),'UPLOAD_POSTURE'
 body=upload.read_bytes()
 assert hashlib.sha256(body).hexdigest()=='2074b486e1c54aeb8a5938751d1d688c690f99cd6704f78b255713ef8be3731a','REVIEWED_HELPER_CHANGED'
 fd=os.open(helper,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 with os.fdopen(fd,'wb') as handle:
  handle.write(body);handle.flush();os.fsync(handle.fileno())
 check_id='ONE_BOUNDED_UNIT_INDEPENDENT_CANONICAL_CLOSE'
 args=['/usr/bin/systemd-run','--quiet','--wait',
  '--unit','passvero-marketing-pin-alignment-20261012-canonical-reviewed',
  '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group',
  '--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s',
  '--property=StandardOutput=null','--property=StandardError=null',
  '--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' --close',
  '/usr/bin/python3','-I','-B',str(helper),'--deploy-reviewed']
 result=subprocess.run(args,capture_output=True,timeout=700)
 output={'unitReturnCode':result.returncode,'automaticRetry':False,'previousHistory':'RETAINED_UNCHANGED'}
 for name in ('canonical-deploy-body-pass.json','canonical-deploy-first-failure.json','canonical-deploy-closure.json','canonical-deploy-closure-failure.json'):
  path=root/name;output[name]=json.loads(h.read(path)) if path.is_file() else None
 output['deployment']='PASS_PENDING_READ_ONLY_VISUAL' if result.returncode==0 and output['canonical-deploy-body-pass.json'] and output['canonical-deploy-closure.json'] and output['canonical-deploy-closure.json'].get('release')=='NEW_ALIGNED' and not output['canonical-deploy-first-failure.json'] and not output['canonical-deploy-closure-failure.json'] else 'STOP_RETURN_OUTPUT_NO_RETRY'
 print(json.dumps(output,sort_keys=True,indent=2),flush=True)
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}),flush=True)
 raise SystemExit(1)
PASSVERO_CANONICAL_REVIEWED_DEPLOY
