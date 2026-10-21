# PENDING_OPERATOR_COMMAND — VPS TERMINAL, srv1834647, staging READ ONLY
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_FINAL_PREFLIGHT'
import datetime,fcntl,hashlib,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
C=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
B=P('/usr/local/libexec/passvero-staging-backup/config.json')
R=P('/var/lib/passvero-staging-recovery/recurring')
def read(p):
 assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'FILE_POSTURE'
 return p.read_bytes()
def sha(b): return hashlib.sha256(b).hexdigest()
def run(args):
 r=subprocess.run(args,capture_output=True,text=True,timeout=20)
 assert r.returncode==0,'READ_COMMAND_FAILED'
 return r.stdout.strip()
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST_OR_USER'
 canonical=read(C);config=read(B);state=read(R/'state.json')
 c=json.loads(canonical);b=json.loads(config);s=json.loads(state)
 build=read(A/'.next/BUILD_ID').decode().strip()
 assert c['build_id']==b['buildId']==build and b['canonicalSha256']==sha(canonical),'RELEASE_PIN_MISMATCH'
 drift=0
 for name,item in c['files'].items():
  p=A/name
  assert not P(name).is_absolute() and '..' not in P(name).parts and p.resolve().is_relative_to(A.resolve()),'ARTIFACT_PATH_SCOPE'
  drift+=sha(read(p))!=item['sha256']
 assert drift==0,'CURRENT_ARTIFACT_DRIFT'
 names=['passvero-staging-backup.timer','passvero-staging-backup-monitor.timer','passvero-subscription-reminders.timer','passvero-staging-backup.service','passvero-staging-backup-monitor.service','passvero-subscription-reminders.service']
 units={n:dict(line.split('=',1) for line in run(['/usr/bin/systemctl','show',n,'--property=Id,LoadState,ActiveState,SubState,UnitFileState']).splitlines() if '=' in line) for n in names}
 assert all(units[n]['ActiveState'] not in ('active','activating','deactivating') for n in names if n.endswith('.service')),'AUTOMATION_JOB_ACTIVE'
 jobs=run(['/usr/bin/systemctl','list-units','--all','--plain','--no-legend','passvero-stage*capture*.service','passvero-stage*restore*.service','passvero-stage*recovery*.service','passvero-stage*resume*.service','passvero-marketing*deploy*.service'])
 assert not any(len(l.split())>=4 and l.split()[2] in ('active','activating','deactivating') for l in jobs.splitlines()),'RECOVERY_JOB_ACTIVE'
 for p in P('/proc').iterdir():
  if not p.name.isdecimal() or int(p.name)==os.getpid(): continue
  try: args=(p/'cmdline').read_bytes().split(b'\0')
  except (FileNotFoundError,ProcessLookupError): continue
  assert not any(a.startswith(b'/usr/local/libexec/passvero-staging-backup/') or a.startswith(b'/var/lib/passvero-staging-recovery/restore') or re.search(rb'/(?:capture|restore-database|verify-application)-[^/]+\.py$',a) for a in args),'RECOVERY_PROCESS_ACTIVE'
 fd=os.open(R/'job.lock',os.O_RDONLY|os.O_NOFOLLOW)
 try: fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 finally: os.close(fd)
 due={}
 for n in names:
  if not n.endswith('.timer') or units[n]['ActiveState']!='active': continue
  obj=run(['/usr/bin/busctl','call','org.freedesktop.systemd1','/org/freedesktop/systemd1','org.freedesktop.systemd1.Manager','GetUnit','s',n])
  assert re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"',obj),'TIMER_OBJECT'
  remaining=[]
  for prop,now in [('NextElapseUSecRealtime',time.time()),('NextElapseUSecMonotonic',time.monotonic())]:
   v=run(['/usr/bin/busctl','get-property','org.freedesktop.systemd1',obj[3:-1],'org.freedesktop.systemd1.Timer',prop])
   assert re.fullmatch(r't [0-9]{1,20}',v),'TIMER_TYPED_VALUE'
   value=int(v[2:])
   if 0<value<18446744073709551615: remaining.append(round(value/1000000-now,3))
  due[n]=min(remaining) if remaining else None
 assert s.get('mode')=='CONTINUOUS' and s.get('hold') is False and s.get('attempt',{}).get('complete') is True,'BACKUP_BASELINE_NOT_READY'
 html=read(A/'.next/server/app/hr.html').decode()
 origin=re.search(r'<link rel="canonical" href="(https://[^"/]+)',html)
 assert origin and origin[1]=='https://staging.passvero.eu','STAGING_CANONICAL_ORIGIN_UNEXPECTED'
 tls=run(['/usr/bin/curl','--silent','--show-error','--max-time','15','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/'])
 assert tls=='200 0','STAGING_HTTPS_TLS'
 assert read(C)==canonical and read(B)==config and read(R/'state.json')==state,'BASELINE_CHANGED_DURING_READ'
 print(json.dumps({'result':'PASS_READ_ONLY_BASELINE','observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'buildId':build,'canonicalSha256':sha(canonical),'backupConfigSha256':sha(config),'backupStateSha256':sha(state),'canonicalMembersVerified':len(c['files']),'canonicalOrigin':origin[1],'httpsTls':tls,'automationBaseline':units,'timerSecondsRemaining':due,'deployWindowOver20Minutes':all(due.get(n) is not None and due[n]>1200 for n in names[:2]),'localPackageGate':'STOP_CANONICAL_ORIGIN_MISMATCH','mutations':'NONE','scannerBackupRestoreWorkerSmtpTelegramCalls':0},indent=2),flush=True)
except BaseException as e:
 reason=str(e) if re.fullmatch('[A-Z0-9_]{1,100}',str(e)) else type(e).__name__
 print(json.dumps({'result':'STOP','reason':reason,'automaticRetry':False,'mutations':'NONE'}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_FINAL_PREFLIGHT
