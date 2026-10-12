# PENDING_OPERATOR_COMMAND — VPS TERMINAL: approved restored-design staging deploy, one bounded execution
sudo /usr/bin/python3 -I -B - <<'PASSVERO_VISUAL_APPROVED_DEPLOY'
import hashlib,importlib.util,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
upload=P('/tmp/passvero-marketing-visual-deploy-20261012')
root=P('/var/lib/passvero-marketing-visual-deploy-20261012')
check_id='REVIEWED_HELPERS_AND_FRESH_WINDOW'
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
 os.umask(0o077)
 previous=P('/var/lib/passvero-marketing-pin-alignment-20261012/deploy-canonical-reviewed.py')
 assert stat.S_ISREG(previous.lstat().st_mode) and not previous.is_symlink() and previous.lstat().st_uid==0 and not previous.stat().st_mode & 0o077,'PREVIOUS_HELPER_POSTURE'
 assert hashlib.sha256(previous.read_bytes()).hexdigest()=='2074b486e1c54aeb8a5938751d1d688c690f99cd6704f78b255713ef8be3731a','PREVIOUS_HELPER_CHANGED'
 spec=importlib.util.spec_from_file_location('visual_launch_read_only',previous)
 h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
 h.idle()
 assert all(h.timer_due(name)-time.time()>1200 for name in h.TIMERS),'NEXT_TERM_TOO_CLOSE_NO_DEPLOY'
 assert not root.exists() and not root.is_symlink(),'ONE_VISUAL_DEPLOY_ONLY'
 assert upload.is_dir() and not upload.is_symlink(),'UPLOAD_DIRECTORY_POSTURE'
 pins={'deploy-reviewed.py':'db04d71b65c6b382b0796bdf3fe32aea07b9fd97c82b13c996b0c26be1af2082','preflight.py':'e74a2a3b8c1387015bfa7e8a05ad19394242095905a8dde1000ae2ddbf10bfed','artifact-manifest.json':'f99e967366651aeca151d68a5c9b243196023b8eb10e0294df767c9c2d985c82','application.tar.gz':'0fa2668e2ce1eaa5aac34fb7e7ff44add1bd66aeca7c13d2439d448ac73ce3e0'}
 bodies={}
 for name,pin in pins.items():
  path=upload/name
  assert stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(),'UPLOAD_FILE_POSTURE'
  body=path.read_bytes()
  assert hashlib.sha256(body).hexdigest()==pin,'REVIEWED_UPLOAD_CHANGED'
  bodies[name]=body
 root.mkdir(mode=0o700)
 for name,body in bodies.items():
  fd=os.open(root/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb') as handle:
   handle.write(body);handle.flush();os.fsync(handle.fileno())
 helper=root/'deploy-reviewed.py'
 check_id='ONE_BOUNDED_UNIT_WITH_INDEPENDENT_CLOSURE'
 args=['/usr/bin/systemd-run','--quiet','--wait','--unit','passvero-marketing-visual-deploy-20261012','--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s','--property=StandardOutput=null','--property=StandardError=null','--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' --close','/usr/bin/python3','-I','-B',str(helper),'--deploy-reviewed']
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
PASSVERO_VISUAL_APPROVED_DEPLOY
