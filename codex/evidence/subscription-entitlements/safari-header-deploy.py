"""Manifest-pinned staging operation. No database/storage backup or restore."""
import hashlib,json,os,pathlib,pwd,subprocess,sys,stat,time,tarfile,shutil,urllib.parse,re
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
S=P(__file__).resolve().parent
R=P('/var/lib/passvero-subscription-entitlements')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def regular(p):
 s=p.lstat();assert stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'UNSAFE_PACKAGE_FILE'
def run(args,timeout=60,**kw):
 p=subprocess.run(args,capture_output=True,text=True,timeout=timeout,**kw)
 assert p.returncode==0,'COMMAND_FAILED'
 return p.stdout.strip()
def verify():
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
 assert len(sys.argv)>=2 and re.fullmatch('[0-9a-f]{64}',sys.argv[1]),'MANIFEST_PIN_REQUIRED'
 for p in [S,*S.parents]:
  s=p.lstat();assert stat.S_ISDIR(s.st_mode) and s.st_uid==0 and not s.st_mode&0o022,'UNSAFE_PACKAGE_DIRECTORY'
 regular(S/'manifest.json');assert sha(S/'manifest.json')==sys.argv[1],'MANIFEST_DRIFT'
 m=json.loads((S/'manifest.json').read_text())
 for name,h in m['package_files'].items():
  assert '/' not in name and name not in ('.','..'),'PACKAGE_PATH'
  regular(S/name);assert sha(S/name)==h,'PACKAGE_HASH'
 assert sha(A/'package.json')==m['runtime_package'] and sha(A/'package-lock.json')==m['runtime_lock'],'RUNTIME_PACKAGE_DRIFT'
 for name,h in m['runtime_files'].items():assert sha(A/name)==h,'DEPENDENCY_DRIFT'
 return m
def identity(name):
 a=pwd.getpwnam(name)
 return dict(user=a.pw_uid,group=a.pw_gid,extra_groups=os.getgrouplist(name,a.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C',**({'PM2_HOME':a.pw_dir+'/.pm2'} if name=='passvero-staging' else {})})
def sql(query):
 return run(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance','-v','ON_ERROR_STOP=1','-c',query],**identity('postgres'))
def scope():
 assert json.loads(sql("BEGIN READ ONLY; SELECT json_build_object('database',current_database(),'port',current_setting('port'),'directory',current_setting('data_directory')); ROLLBACK;"))=={'database':'passvero_acceptance','port':'5433','directory':'/var/lib/postgresql/16/acceptance'},'DATABASE_SCOPE'
def pm(args):return run(['/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args],**identity('passvero-staging'))
def monitor():
 js="const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd,script:p.pm2_env.pm_exec_path}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
 rows=json.loads(run(['/usr/bin/node','-e',js],**identity('passvero-staging')))
 assert len(rows)==1 and rows[0]['name']=='passvero-acceptance' and rows[0]['cwd']==str(A) and rows[0]['script']==str(A/'node_modules/next/dist/bin/next'),'PM2_SCOPE'
 return rows[0]
def execute(fn):
 os.umask(0o077)
 try:fn(verify())
 except Exception as e:
  print(json.dumps({'result':'STOP','reason':str(e) if isinstance(e,AssertionError) else type(e).__name__,'retry':'MANUAL_REVIEW_REQUIRED','automaticRollback':False}));sys.exit(1)

def main(m):
 scope();assert json.loads((R/'migration/report.json').read_text())=={'migration':'PASS','manifest':m['migration_manifest'],'backupRestore':'NOT_PERFORMED'},'MIGRATION_REQUIRED'

 assert sql("SELECT count(*) FROM \"OrganizationEntitlementEnrollment\" WHERE reason='Approved SUBSCRIPTION_ENTITLEMENTS_STAGING_TRANSITION_PROPOSAL 2026-09-30' AND \"trialStartedAt\" IS NULL AND \"trialEndsAt\" IS NULL AND ((\"organizationId\" IN ('6d686789-6379-4824-ae02-df97043cbbc0','bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0') AND \"exceptionStartsAt\"=timestamp '2026-09-30 00:00:00' AND \"exceptionEndsAt\"=timestamp '2026-10-31 00:00:00' AND \"exceptionLimits\"='{\"maxPublishedProducts\":25,\"maxStoredProducts\":100,\"maxStorageBytes\":2147483648,\"maxPdfAttachments\":10}'::jsonb) OR (\"organizationId\"='ffe171d1-b6a6-43d5-83bb-890e2fa23c9f' AND \"exceptionStartsAt\" IS NULL AND \"exceptionEndsAt\" IS NULL AND \"exceptionLimits\" IS NULL))")=='3','APPROVED_ENROLLMENTS_REQUIRED'
 assert sql('SELECT count(*) FROM "Organization"')=='10','ORGANIZATION_SET_DRIFT'
 assert sql("SELECT count(*) FROM \"PlatformRegulatoryGrant\" WHERE \"userId\"='40e51001-912c-4bcf-aa45-d866632aac85' AND \"revokedAt\" IS NULL")=='1','REGULATORY_GRANT_REQUIRED'
 assert sql("SELECT count(*) FROM \"Product\" WHERE \"organizationId\"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0' AND \"regulatoryClassification\"='UNRESOLVED'")=='9','CLASSIFICATION_DRIFT'
 state=R/'application-safari-header';assert not state.exists(),'DO_NOT_RETRY'
 canonical=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json');regular(canonical);old_manifest=canonical.read_bytes()
 prior=json.loads(old_manifest);assert prior['build_id']==m['previous_build'],'CANONICAL_MANIFEST_DRIFT'
 assert (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'],'BUILD_DRIFT'
 before=monitor();assert before['status']=='online','APP_NOT_ONLINE'
 prepared=A/'.entitlements-safari-header-prepared';assert not prepared.exists();prepared.mkdir(mode=0o750)
 with tarfile.open(S/'application.tar.gz') as tar:
  entries=tar.getmembers();assert len(entries)==len(m['application_files']) and {e.name for e in entries}==set(m['application_files']),'ARCHIVE_INVENTORY'
  for e in entries:
   assert e.isfile() and e.name.startswith(('.next/','messages/')) and '..' not in P(e.name).parts and not P(e.name).is_absolute(),'ARCHIVE_PATH'
   data=tar.extractfile(e).read();assert hashlib.sha256(data).hexdigest()==m['application_files'][e.name],'ARTIFACT_HASH'
   p=prepared/e.name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(0o640);os.chown(p,pwd.getpwnam('passvero-staging').pw_uid,pwd.getpwnam('passvero-staging').pw_gid)
   d=p.parent
   while d!=prepared:d.chmod(0o750);os.chown(d,pwd.getpwnam('passvero-staging').pw_uid,pwd.getpwnam('passvero-staging').pw_gid);d=d.parent
 for n in ['.next','messages']:assert (A/n).is_dir() and not (A/n).is_symlink() and not (A/(n+'.before-entitlements-safari-header')).exists(),'ARTIFACT_SCOPE'
 assert monitor()==before,'APP_CHANGED'
 state.mkdir();(state/'previous-runtime-manifest.json').write_bytes(old_manifest);(state/'before-app.json').write_text(json.dumps(before));(state/'state.json').write_text(json.dumps({'manifest':sys.argv[1],'old_build':m['previous_build']}))
 pm(['stop','passvero-acceptance'])
 for n in ['.next','messages']:(A/n).rename(A/(n+'.before-entitlements-safari-header'));(prepared/n).rename(A/n)
 updated=dict(prior);updated['build_id']=m['build_id'];updated['files']={n:v for n,v in prior['files'].items() if not n.startswith(('.next/','messages/'))};updated['files'].update({n:{'sha256':h,'bytes':(A/n).stat().st_size} for n,h in m['application_files'].items()});updated['entitlements_manifest_sha256']=sys.argv[1]
 candidate=canonical.with_name('manifest.entitlements-candidate.json');candidate.write_text(json.dumps(updated,indent=2));candidate.chmod(0o600);os.replace(candidate,canonical)
 pm(['restart','passvero-acceptance'])
 deadline=time.monotonic()+45;healthy=False
 while time.monotonic()<deadline:
  p=subprocess.run(['curl','--max-time','3','-sS','-L','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/request-access'],capture_output=True,text=True)
  if p.returncode==0 and p.stdout=='200 0':healthy=True;break
  time.sleep(1)
 assert healthy,'HTTPS_NOT_READY'
 for route in ['/dashboard/subscription','/platform/billing','/platform/regulatory']:
  response=run(['curl','--max-time','10','-sS','-D','-','-o','/dev/null','-w','\nSTATUS=%{http_code} TLS=%{ssl_verify_result}','https://staging.passvero.eu'+route])
  assert ('STATUS=404 TLS=0' in response or 'STATUS=307 TLS=0' in response) and 'private' in response.lower() and 'no-store' in response.lower(),'ANONYMOUS_BOUNDARY'
 after=monitor();assert after['status']=='online' and after['pid']!=before['pid'],'RESTART_FAILED'
 for name,h in m['application_files'].items():assert sha(A/name)==h,'DEPLOYED_HASH'
 assert (A/'.next/BUILD_ID').read_text().strip()==m['build_id']
 for name,h in m['runtime_files'].items():assert sha(A/name)==h,'RETAINED_RUNTIME_CHANGED'
 pm(['save']);prepared.rmdir()
 (state/'report.json').write_text(json.dumps({'deployment':'PASS','manifest':sys.argv[1],'build':m['build_id'],'acceptance':'NOT_PROVEN'}));print('STAGING_ARTIFACT_AND_HTTPS=PASS; AUTHENTICATED_ACCEPTANCE=NOT_PROVEN')
if __name__=='__main__':execute(main)
