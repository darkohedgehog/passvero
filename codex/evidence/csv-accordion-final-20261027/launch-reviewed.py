"""One approved staging swap using the existing bounded unit/independent closure procedure."""
import hashlib,json,os,pathlib,re,stat,subprocess,time,types
P=pathlib.Path
UPLOAD=P('/tmp/passvero-csv-border-ui-release-20261027')
ROOT=P('/var/lib/passvero-csv-border-deploy-20261027')
PINS={'deploy-reviewed.py': '2780cb73c060515b025178cc3259619966fe87281c76f957337d650f70ec76d7', 'package-preflight-v2.py': '6c17e100ebf5e8308ec739b2145e64fe93e32ccca7589d29d898d7c79e27f59f', 'artifact-manifest.json': 'b2692d78b68363cf1b1073a495029fcd0f66836d740695ca57be9b918e4e6412', 'application.tar.gz': '36a0ec847ed240f269887d11baaada65b39ac8cae1054655f936a941a606c903'}
CHECK='HOST_AND_EXACT_UPLOAD'
def main():
 global CHECK
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
 os.umask(0o077)
 assert UPLOAD.is_dir() and not UPLOAD.is_symlink(),'UPLOAD_DIRECTORY_POSTURE'
 assert not ROOT.exists() and not ROOT.is_symlink(),'ONE_DEPLOY_NAMESPACE_ONLY'
 bodies={}
 for name,pin in PINS.items():
  p=UPLOAD/name
  assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'UPLOAD_FILE_POSTURE'
  body=p.read_bytes();assert hashlib.sha256(body).hexdigest()==pin,'EXACT_UPLOAD_HASH_CHANGED'
  bodies[name]=body
 # Execute verified in-memory definitions only; the upload file is never re-imported.
 h=types.ModuleType('reviewed_dashboard_launch_read_only')
 exec(compile(bodies['deploy-reviewed.py'],'reviewed-deploy-helper','exec'),h.__dict__)
 CHECK='FRESH_IDLE_AND_TIMER_WINDOW'
 h.idle()
 remaining={name:round(h.timer_due(name)-time.time(),3) for name in h.TIMERS}
 if not all(v>1200 for v in remaining.values()):
  print(json.dumps({'result':'STOP','CHECK_ID':CHECK,'reason':'NEXT_REGULAR_TERM_TOO_CLOSE_NO_DEPLOY','timerSecondsRemaining':remaining,'mutations':'NONE','automaticRetry':False}),flush=True)
  return 1
 CHECK='SAVE_PRIVATE_PINNED_INPUTS'
 ROOT.mkdir(mode=0o700)
 assert ROOT.stat().st_dev==h.APP.stat().st_dev,'ATOMIC_RENAME_FILESYSTEM_REQUIRED'
 for name,body in bodies.items():
  fd=os.open(ROOT/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  with os.fdopen(fd,'wb') as f:
   f.write(body);f.flush();os.fsync(f.fileno())
 helper=ROOT/'deploy-reviewed.py'
 CHECK='ONE_BOUNDED_UNIT_WITH_INDEPENDENT_CLOSURE'
 args=['/usr/bin/systemd-run','--quiet','--wait','--unit','passvero-csv-border-deploy-20261027','--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s','--property=StandardOutput=null','--property=StandardError=null','--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' --close','/usr/bin/python3','-I','-B',str(helper),'--deploy-reviewed']
 result=subprocess.run(args,capture_output=True,timeout=700)
 output={'unitReturnCode':result.returncode,'automaticRetry':False,'previousHistory':'RETAINED_UNCHANGED','rollbackLocation':str(ROOT),'launchTimerSecondsRemaining':remaining}
 for name in ('canonical-deploy-body-pass.json','canonical-deploy-first-failure.json','canonical-deploy-closure.json','canonical-deploy-closure-failure.json'):
  p=ROOT/name;output[name]=json.loads(h.read(p)) if p.is_file() else None
 output['deployment']='PASS_PENDING_READ_ONLY_VISUAL' if result.returncode==0 and output['canonical-deploy-body-pass.json'] and output['canonical-deploy-closure.json'] and output['canonical-deploy-closure.json'].get('release')=='NEW_ALIGNED' and not output['canonical-deploy-first-failure.json'] and not output['canonical-deploy-closure-failure.json'] else 'STOP_RETURN_OUTPUT_NO_RETRY'
 print(json.dumps(output,sort_keys=True,indent=2),flush=True)
 return 0 if output['deployment']=='PASS_PENDING_READ_ONLY_VISUAL' else 1
if __name__=='__main__':
 try:
  raise SystemExit(main())
 except SystemExit:
  raise
 except BaseException as e:
  reason=str(e) if re.fullmatch('[A-Z0-9_]{1,160}',str(e)) else type(e).__name__
  print(json.dumps({'result':'STOP','CHECK_ID':CHECK,'reason':reason,'automaticRetry':False}),flush=True)
  raise SystemExit(1)
