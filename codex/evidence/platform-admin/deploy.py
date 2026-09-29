"""Single prebuilt staging artifact replacement. No secrets, installs, migration or scanner changes."""
import pathlib,os,json,hashlib,pwd,subprocess,tarfile,time,shutil,stat
P=pathlib.Path;S=P('/tmp/passvero-platform-c513679');A=P('/var/www/passvero-acceptance');R=P('/var/lib/passvero-platform-c513679/application');T=A/'.platform-prepared-c513679';suffix='.before-platform-c513679'
os.umask(0o077);phase='VERIFY';owned=False;state={'stop_attempted':False,'old_build':'OD9e4NOtu9LlMjE_0U2Dz'}
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,**kw):
 p=subprocess.run(args,capture_output=True,text=True,timeout=45,**kw)
 assert p.returncode==0,'COMMAND_FAILED'
 return p.stdout.strip()
def show(unit,keys):return dict(x.split('=',1) for x in run(['systemctl','show',unit,*[v for k in keys for v in ['-p',k]]]).splitlines())
def dependencies():return {u:show(u,['MainPID','ExecMainStartTimestampMonotonic','ActiveState']) for u in ['clamav-daemon.service','clamav-freshclam.service','passvero-qpdf-acceptance.service','passvero-qpdf-broker.socket','pm2-passvero-staging.service','nginx.service']}
def timer():return show('passvero-signature-health.timer',['ActiveState','UnitFileState'])
def pm(args):return run(['/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args],**child)
def monitor():
 js="""const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd,script:p.pm2_env.pm_exec_path,error:p.pm2_env.pm_err_log_path}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"""
 rows=json.loads(run(['/usr/bin/node','-e',js],**child));assert len(rows)==1 and rows[0]['name']=='passvero-acceptance','PM2_SCOPE_MISMATCH';return rows[0]
def env(pid):return dict(x.split(b'=',1) for x in P('/proc',str(pid),'environ').read_bytes().split(b'\0') if b'=' in x)
def checkpoint():(R/'state.json').write_text(json.dumps(state))
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
 assert not R.exists() and not T.exists(),'DO_NOT_RERUN'
 migration_report=json.loads(P('/var/lib/passvero-platform-c513679/migration/report.json').read_text());assert migration_report['migration']=='PASS' and migration_report['applied']=='20260929120000_platform_grant','MIGRATION_REQUIRED'
 assert sha(S/'manifest.json')=='2045d0cbf380a41ffe1222c45e2ee7f255de310ba77736f10fd0018935cef611','MANIFEST_MISMATCH'
 m=json.loads((S/'manifest.json').read_text());assert sha(S/'application.tar.gz')==m['archive_sha256']
 assert sha(S/'source.sha256')==m['review_sha256']
 assert m['base']=='c5136792ef95c094ab88e0d261dc51dcc69db2fa' and m['build_origin']=='https://staging.passvero.eu'
 assert sha(S/'rollback.py')=='13d165e642296f6d053b5097f7f66d13eccf51f355b151a35b4759f86b88c858','ROLLBACK_MISMATCH'
 O=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
 old=json.loads(O.read_text())
 assert old['build_id']==state['old_build'],'PREVIOUS_MANIFEST_BUILD'
 assert sha(A/'.controlled-onboarding/review-access-requests.mjs')==m['retained_operator_sha256'],'OPERATOR_DRIFT'
 operator_before=sha(A/'.controlled-onboarding/review-access-requests.mjs')
 for n,h in old.get('runtime_unchanged_files',{}).items():assert sha(A/n)==h,'RUNTIME_SOURCE_DRIFT'
 for n,info in old['files'].items():assert sha(A/n)==info['sha256'],'OLD_ARTIFACT_DRIFT'
 assert (A/'.next/BUILD_ID').read_text().strip()==state['old_build'],'OLD_BUILD_DRIFT'
 assert sha(A/'package.json')==m['expected_runtime_package_sha256'] and sha(A/'package-lock.json')==m['expected_runtime_lock_sha256'],'RUNTIME_PACKAGE_DRIFT'
 for n,v in m['runtime_versions'].items():assert json.loads((A/'node_modules'/n/'package.json').read_text())['version']==v,'DEPENDENCY_VERSION_MISMATCH'
 for n in ['.next','messages']:assert (A/n).is_dir() and not (A/n).is_symlink() and not (A/(n+suffix)).exists()
 a=pwd.getpwnam('passvero-staging');assert (a.pw_uid,a.pw_gid)==(1001,1001)
 child=dict(user=a.pw_uid,group=a.pw_gid,extra_groups=os.getgrouplist(a.pw_name,a.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C','PM2_HOME':a.pw_dir+'/.pm2'})
 before_app=monitor();assert before_app['status']=='online' and before_app['cwd']==str(A) and before_app['script']==str(A/'node_modules/next/dist/bin/next'),'APP_IDENTITY'
 old_env=env(before_app['pid']);assert old_env.get(b'PASSVERO_RUNTIME_ENV')==b'staging' and old_env.get(b'DOCUMENT_SCAN_ENABLED')==b'true' and old_env.get(b'NEXT_PUBLIC_SITE_URL')==b'https://staging.passvero.eu','RUNTIME_GATE'
 old_groups=next(x for x in P('/proc',str(before_app['pid']),'status').read_text().splitlines() if x.startswith('Groups:'))
 protected=[P('/etc/systemd/system/pm2-passvero-staging.service'),P('/etc/passvero-staging/runtime.env'),P('/etc/passvero-staging/document-app.config.cjs'),P('/etc/clamav/freshclam.conf'),P('/etc/clamav/clamd.conf'),P('/etc/apparmor.d/passvero-qpdf'),P('/usr/local/libexec/passvero-qpdf-launch'),P('/usr/local/libexec/passvero-qpdf-broker.py'),P('/usr/local/libexec/passvero-qpdf-broker-setup.py'),P('/usr/local/libexec/passvero-signature-health.cjs'),P('/etc/passvero-signature-health.json')]
 for unit in ['passvero-qpdf-acceptance.service','passvero-qpdf-broker.socket','passvero-signature-health.service','passvero-signature-health.timer']:protected.append(P('/etc/systemd/system')/unit)
 protected_before={str(p):sha(p) for p in protected}
 deps_before=dependencies();timer_before=timer();assert all(v['ActiveState']=='active' for u,v in deps_before.items() if u!='passvero-qpdf-acceptance.service') and deps_before['passvero-qpdf-acceptance.service']['ActiveState'] in ['active','inactive'] and timer_before['ActiveState']=='active','DEPENDENCY_NOT_ACTIVE'
 socket_state=show('passvero-qpdf-broker.socket',['ActiveState','SubState','Triggers','Accept'])
 assert socket_state['ActiveState']=='active' and socket_state['SubState'] in ['listening','running'] and socket_state['Accept']=='no' and socket_state['Triggers'].split()==['passvero-qpdf-acceptance.service'],'QPDF_SOCKET_IDENTITY_OR_STATE'
 if socket_state['SubState']=='running':
  qpdf_service=show('passvero-qpdf-acceptance.service',['ActiveState','SubState','MainPID'])
  assert qpdf_service['ActiveState']=='active' and qpdf_service['SubState']=='running' and int(qpdf_service['MainPID'])>0,'QPDF_ACTIVATED_SERVICE_NOT_RUNNING'
 assert any('/run/passvero-qpdf-broker/validate.sock' in line.split() and 'LISTEN' in line.split() for line in run(['ss','-xlH']).splitlines()),'QPDF_SOCKET_NOT_LISTENING'
 assert show('pm2-passvero-staging.service',['UnitFileState'])['UnitFileState']=='enabled','STAGING_STARTUP_NOT_ENABLED'
 assert shutil.disk_usage(A).free>1024**3,'DISK_SPACE'
 log=P(before_app['error']);assert str(log).startswith('/home/passvero-staging/.pm2/logs/');log_size=log.stat().st_size if log.exists() else 0
 phase='PREPARE';R.mkdir(mode=0o700,parents=True);owned=True;checkpoint()
 for n in ['rollback.py','deploy.py','manifest.json','source.sha256']:shutil.copyfile(S/n,R/n)
 (R/'previous-runtime-manifest.json').write_bytes(O.read_bytes())
 (R/'before.json').write_text(json.dumps({'app':before_app,'dependencies':deps_before,'timer':timer_before,'protected':protected_before},indent=2))
 T.mkdir(mode=0o750);os.chown(T,0,1001)
 with tarfile.open(S/'application.tar.gz','r:gz') as tar:
  members=tar.getmembers();assert len(members)==len(m['files']) and {x.name for x in members}==set(m['files'])
  for x in members:
   assert x.isfile() and x.name.startswith(('.next/','messages/')) and '..' not in P(x.name).parts and not P(x.name).is_absolute()
   info=m['files'][x.name];assert x.size==info['bytes'] and x.size<64*1024*1024
   data=tar.extractfile(x).read();assert hashlib.sha256(data).hexdigest()==info['sha256']
   p=T/x.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);os.chown(p,1001,1001);os.chmod(p,0o640)
   d=p.parent
   while d!=T:os.chown(d,1001,1001);os.chmod(d,0o750);d=d.parent
 assert monitor()==before_app,'APP_CHANGED_DURING_PREPARE'
 phase='REPLACE_STAGING';state['stop_attempted']=True;checkpoint();pm(['stop','passvero-acceptance'])
 for n in ['.next','messages']:(A/n).rename(A/(n+suffix));(T/n).rename(A/n)
 updated=dict(old);updated['build_id']=m['build_id'];updated['files']={n:v for n,v in old['files'].items() if not n.startswith(('.next/','messages/'))};updated['files'].update(m['files']);updated['ui_build_overlay']={'base':m['base'],'review_sha256':m['review_sha256'],'previous_build_id':state['old_build'],'scope':'NEXT_BUILD_AND_MESSAGES'}
 metadata=O.with_name('manifest.ui-candidate.json');metadata.write_text(json.dumps(updated,indent=2)+'\n');metadata.chmod(0o600);os.replace(metadata,O)
 pm(['restart','passvero-acceptance'])
 phase='VERIFY';deadline=time.monotonic()+45;healthy=False
 while time.monotonic()<deadline:
  p=subprocess.run(['curl','--max-time','3','-sS','-L','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/request-access'],capture_output=True,text=True)
  if p.returncode==0 and p.stdout=='200 0':healthy=True;break
  time.sleep(1)
 assert healthy,'HTTPS_NOT_READY'
 for prefix in ['en/','de/','sr/','sl/','pl/']:
  assert run(['curl','--max-time','10','-sS','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/'+prefix+'request-access'])=='200 0','LOCALE_NOT_READY'
 for prefix in ['', 'en/', 'de/', 'sr/', 'sl/', 'pl/']:
  for route in ['platform/organizations','platform/organizations/00000000-0000-4000-8000-000000000001']:
   response=run(['curl','--max-time','10','-sS','-D','-','-o','/dev/null','-w','\nSTATUS=%{http_code} TLS=%{ssl_verify_result}','https://staging.passvero.eu/'+prefix+route])
   assert 'STATUS=404 TLS=0' in response and 'no-store' in response.lower() and 'private' in response.lower(),'ANONYMOUS_PLATFORM_BOUNDARY_FAILED'
 after=monitor();assert after['status']=='online' and after['pid']!=before_app['pid'] and after['cwd']==str(A),'APP_NOT_RESTARTED'
 new_env=env(after['pid'])
 for key in [b'PASSVERO_RUNTIME_ENV',b'NEXT_PUBLIC_SITE_URL',b'BETTER_AUTH_URL',b'DATABASE_URL',b'AUTH_DATABASE_URL',b'DOCUMENT_SCAN_ENABLED',b'DOCUMENT_SCAN_CONFIG',b'DOCUMENT_STORAGE_SUPABASE_URL',b'DOCUMENT_STORAGE_SUPABASE_KEY',b'DOCUMENT_STORAGE_BUCKET']:assert new_env.get(key)==old_env.get(key),'RUNTIME_ENV_CHANGED'
 status=P('/proc',str(after['pid']),'status').read_text().splitlines();assert next(x for x in status if x.startswith('Uid:')).split()[1:]==['1001']*4
 assert next(x for x in status if x.startswith('Groups:'))==old_groups,'GROUPS_CHANGED'
 assert dependencies()==deps_before and timer()==timer_before,'DEPENDENCY_CHANGED'
 assert {str(p):sha(p) for p in protected}==protected_before,'CONFIGURATION_CHANGED'
 assert sha(A/'.controlled-onboarding/review-access-requests.mjs')==operator_before,'OPERATOR_CHANGED'
 assert (A/'.next/BUILD_ID').read_text().strip()==m['build_id']
 for n,info in m['files'].items():assert sha(A/n)==info['sha256'],'DEPLOYED_ARTIFACT_MISMATCH'
 new_errors=b''
 if log.exists():
  with log.open('rb') as f:f.seek(log_size);new_errors=f.read(65537)
 assert len(new_errors)<=65536,'STARTUP_LOG_BOUND_EXCEEDED'
 errors=sum(b'Error' in line or b'ERR_' in line for line in new_errors.splitlines())
 assert errors==0,'STARTUP_ERROR_PRESENT'
 pm(['save']);T.rmdir()
 report={'deployment':'PASS','source_base':m['base'],'reviewed_diff_files':len(m['reviewed_source']),'review_sha256':m['review_sha256'],'build_id':m['build_id'],'artifact_files_verified':len(m['files']),'staging_pid':after['pid'],'staging_https':'200 0','runtime_configuration':'UNCHANGED','scanners_broker_producer':'UNCHANGED','production_access_or_changes':False,'startup_error_count':errors,'platform_acceptance':'PENDING_APPROVED_GRANT','anonymous_platform_reads':'404_PRIVATE_NO_STORE_6_LOCALES','platform_grant':'NOT_EXECUTED','rollback':str(R/'rollback.py'),'migration':'PASS_PREVIOUS_PHASE','producer_recovery':'PRIOR_ACCEPTED_EVIDENCE_UNCHANGED','scanner_acceptance':'NOT_RERUN','reboot_acceptance':'NOT_PROVEN','retained_operator_sha256':operator_before}
 (R/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
except Exception as e:
 failure={'deployment':'STOP','phase':phase,'error_type':type(e).__name__,'no_retry':True}
 if isinstance(e,AssertionError) and e.args:failure['reason']=str(e.args[0])
 if owned:
  if state['stop_attempted']:
   p=subprocess.run(['/usr/bin/python3','-I','-B',str(R/'rollback.py')],capture_output=True,text=True,timeout=150);failure['rollback']='PASS' if p.returncode==0 else 'STOP'
  (R/'failure.json').write_text(json.dumps(failure,indent=2))
 print(json.dumps(failure));raise SystemExit(1)
