# PENDING_OPERATOR_COMMAND — VPS TERMINAL, srv1834647, staging READ ONLY
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_FINAL_PREFLIGHT'
import datetime,fcntl,hashlib,json,os,pathlib,pwd,re,stat,subprocess,time
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
C=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
B=P('/usr/local/libexec/passvero-staging-backup/config.json')
R=P('/var/lib/passvero-staging-recovery/recurring')
def read(p):
 assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'FILE_POSTURE'
 return p.read_bytes()
def sha(b): return hashlib.sha256(b).hexdigest()
check_id='HOST'
failure_detail={}
def run(args,check=None,**kwargs):
 global check_id,failure_detail
 check_id=check or pathlib.Path(args[0]).name+':'+(args[1] if len(args)>1 else 'read')
 r=subprocess.run(args,capture_output=True,text=True,timeout=20,**kwargs)
 if r.returncode:
  kind=next((k for k,p in [('MODULE_NOT_FOUND','MODULE_NOT_FOUND'),('ACCESS_DENIED','Permission denied'),('CONNECTION_REFUSED','ECONNREFUSED')] if p.lower() in r.stderr.lower()),'OTHER')
  failure_detail={'exitCode':r.returncode,'stderrClass':kind,'stderrBytes':len(r.stderr.encode()),'stdoutBytes':len(r.stdout.encode())}
  raise RuntimeError('READ_COMMAND_FAILED')
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
 account=pwd.getpwnam('passvero-staging')
 probe="const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
 rows=json.loads(run(['/usr/bin/node','-e',probe],user=account.pw_uid,group=account.pw_gid,extra_groups=os.getgrouplist(account.pw_name,account.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin'}))
 assert len(rows)==1 and rows[0]['name']=='passvero-acceptance' and rows[0]['status']=='online' and rows[0]['cwd']==str(A),'RUNTIME_IDENTITY'
 proc=P('/proc')/str(rows[0]['pid'])
 assert proc.stat().st_uid==account.pw_uid and (proc/'cwd').resolve()==A,'RUNTIME_PID_SCOPE'
 runtime_env=(proc/'environ').read_bytes()
 environment=dict(v.split(b'=',1) for v in runtime_env.split(b'\0') if b'=' in v)
 assert environment.get(b'BETTER_AUTH_URL')==b'https://staging.passvero.eu' and environment.get(b'PASSVERO_RUNTIME_ENV')==b'staging','RUNTIME_ORIGIN_SCOPE'
 env_probe="const {loadEnvConfig}=require('/var/www/passvero-acceptance/node_modules/@next/env');const {createHash}=require('node:crypto');loadEnvConfig('/var/www/passvero-acceptance',false,{info(){},error(){throw Error('BUILD_ENV_READ_FAILED')}});const k=process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;console.log(JSON.stringify({canonicalOrigin:process.env.BETTER_AUTH_URL,runtimeEnvironment:process.env.PASSVERO_RUNTIME_ENV,publicTurnstile:{present:!!k,sha256:k?createHash('sha256').update(k).digest('hex'):null}}));"
 assert os.path.samefile('/usr/bin/node',proc/'exe'),'RUNTIME_NODE_BINARY_MISMATCH'
 child_env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8','NODE_ENV':'production'}
 child_env.update({k.decode():v.decode() for k,v in environment.items() if k in (b'BETTER_AUTH_URL',b'PASSVERO_RUNTIME_ENV') or k.startswith(b'NEXT_PUBLIC_')})
 excluded_node_controls=[k for k in ('NODE_CHANNEL_FD','NODE_CHANNEL_SERIALIZATION_MODE','NODE_UNIQUE_ID','NODE_OPTIONS','NODE_V8_COVERAGE','NODE_REPL_EXTERNAL_MODULE') if k.encode() in environment]
 effective=json.loads(run(['/usr/bin/node','-e',env_probe],check='EFFECTIVE_BUILD_SETTINGS_CONTROLLED_CHILD',user=account.pw_uid,group=account.pw_gid,extra_groups=os.getgrouplist(account.pw_name,account.pw_gid),cwd=str(A),env=child_env))
 assert effective['canonicalOrigin']=='https://staging.passvero.eu' and effective['runtimeEnvironment']=='staging','EFFECTIVE_BUILD_ORIGIN_SCOPE'
 build_settings={'runtimeNode':run(['/usr/bin/node','--version'],check='RUNTIME_NODE_VERSION',env={'PATH':'/usr/bin:/bin','LANG':'C.UTF-8'}),'packageSha256':sha(read(A/'package.json')),'lockSha256':sha(read(A/'package-lock.json')),**effective}
 required=json.loads(read(A/'.next/required-server-files.json'))['config']
 build_settings['nextConfig']={k:required.get(k) for k in ['basePath','assetPrefix','trailingSlash','output','distDir']}
 build_settings['explicitEnvKeys']=sorted(required.get('env',{}))
 build_settings['diagnosticChildExcludedNodeControlKeys']=excluded_node_controls
 build_settings['dependencyVersions']={n:json.loads(read(A/'node_modules'/n/'package.json'))['version'] for n in ['next','react','react-dom','next-intl']}
 assert (proc/'environ').read_bytes()==runtime_env,'RUNTIME_ENV_CHANGED_DURING_READ'
 assert read(C)==canonical and read(B)==config and read(R/'state.json')==state,'BASELINE_CHANGED_DURING_READ'
 print(json.dumps({'result':'PASS_READ_ONLY_BASELINE','observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'buildId':build,'canonicalSha256':sha(canonical),'backupConfigSha256':sha(config),'backupStateSha256':sha(state),'canonicalMembersVerified':len(c['files']),'canonicalOrigin':origin[1],'httpsTls':tls,'automationBaseline':units,'timerSecondsRemaining':due,'deployWindowOver20Minutes':all(due.get(n) is not None and due[n]>1200 for n in names[:2]),'runtimeIdentity':rows[0],'buildTimeBaseline':build_settings,'localPackageGate':'ONE_STAGING_ORIGIN_BUILD_APPROVED_PENDING_BASELINE_MATCH','mutations':'NONE','scannerBackupRestoreWorkerSmtpTelegramCalls':0},indent=2),flush=True)
except BaseException as e:
 reason=str(e) if re.fullmatch('[A-Z0-9_]{1,100}',str(e)) else type(e).__name__
 print(json.dumps({'result':'STOP','check':check_id,'reason':reason,**failure_detail,'automaticRetry':False,'mutations':'NONE'}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_FINAL_PREFLIGHT
