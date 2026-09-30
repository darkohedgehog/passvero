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
 scope()
 assert sql('SELECT count(*) FROM "SubscriptionUpgradeReceipt"')=='0','NEW_UPGRADES_REQUIRE_REVIEW'
 assert sql('SELECT count(*) FROM "SubscriptionPaidPeriodActivation"')=='0','NEW_PERIOD_ACTIVATIONS_REQUIRE_REVIEW'
 assert sql('SELECT count(*) FROM "SubscriptionPaidPeriod"')=='1','NEW_PAID_PERIODS_REQUIRE_REVIEW'
 assert sql('SELECT count(*) FROM "OrganizationEntitlementEnrollment"')=='3','NEW_ENROLLMENTS_REQUIRE_REVIEW'
 state=json.loads((R/'application/state.json').read_text());assert state['manifest']==sys.argv[1],'STATE_DRIFT'
 assert not (R/'application/rollback-attempt.json').exists(),'DO_NOT_RETRY'
 monitor();(R/'application/rollback-attempt.json').write_text('{}');pm(['stop','passvero-acceptance'])
 for n in ['.next','messages']:
  old=A/(n+'.before-entitlements')
  if old.exists():
   assert old.is_dir() and not old.is_symlink()
   failed=A/(n+'.failed-entitlements');assert not failed.exists()
   if (A/n).exists():(A/n).rename(failed)
   old.rename(A/n)
 assert (A/'.next/BUILD_ID').read_text().strip()==state['old_build'],'OLD_BUILD_MISSING'
 canonical=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json');candidate=canonical.with_name('manifest.entitlements-rollback.json');candidate.write_bytes((R/'application/previous-runtime-manifest.json').read_bytes());candidate.chmod(0o600);os.replace(candidate,canonical)
 pm(['restart','passvero-acceptance']);assert monitor()['status']=='online';pm(['save'])
 print('APPLICATION_ROLLBACK=PASS; DATABASE_AND_STORAGE_UNCHANGED')
if __name__=='__main__':execute(main)
