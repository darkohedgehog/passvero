"""Manifest-pinned staging operation. No database/storage backup or restore."""
import hashlib,json,os,pathlib,pwd,subprocess,sys,stat,time,tarfile,shutil,urllib.parse,re
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
S=P(__file__).resolve().parent
R=P('/var/lib/passvero-subscription-commercial')
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

def copy_prisma_runtime(source,target):
    source=pathlib.Path(source); target=pathlib.Path(target)
    assert not source.is_symlink() and not target.exists()
    target.mkdir(mode=0o755); os.chmod(target,0o755)
    seen=set(); files={}; total=0
    def resolve(name,package):
        assert re.fullmatch(r'(?:@[a-zA-Z0-9_.-]+/)?[a-zA-Z0-9_.-]+',name)
        base=package
        while base==source or source in base.parents:
            candidate=base/name if base.name=='node_modules' else base/'node_modules'/name
            if (candidate/'package.json').is_file():
                assert candidate.resolve()==candidate and source in candidate.parents,'UNSUPPORTED_PACKAGE_LINK'
                return candidate
            base=base.parent
        return None
    def visit(package):
        nonlocal total
        if package in seen:return
        seen.add(package);assert len(seen)<=400
        data=json.loads((package/'package.json').read_text())
        for directory,dirs,names in os.walk(package,followlinks=False):
            dirs[:]=[d for d in dirs if d!='node_modules']
            for d in dirs: assert not (pathlib.Path(directory)/d).is_symlink(),'UNSUPPORTED_DIRECTORY_LINK'
            dest=target/pathlib.Path(directory).relative_to(source)
            dest.mkdir(parents=True,exist_ok=True)
            parent=dest
            while parent!=target:os.chmod(parent,0o755);parent=parent.parent
            for name in names:
                f=pathlib.Path(directory)/name;s=f.lstat()
                assert stat.S_ISREG(s.st_mode) and not name.startswith('.env'),'UNEXPECTED_PACKAGE_FILE'
                total+=s.st_size;assert total<=600*1024*1024 and len(files)<30000
                b=f.read_bytes();relative=f.relative_to(source);out=target/relative
                out.write_bytes(b);os.chmod(out,0o755 if s.st_mode&0o111 else 0o644)
                files[str(relative)]=hashlib.sha256(b).hexdigest()
        optional=data.get('optionalDependencies',{})
        for name in set(data.get('dependencies',{}))|set(optional):
            dep=resolve(name,package)
            assert dep or name in optional,'REQUIRED_DEPENDENCY_MISSING'
            if dep:visit(dep)
    prisma=resolve('prisma',source);assert prisma
    assert json.loads((prisma/'package.json').read_text())['version']=='7.8.0'
    visit(prisma)
    return {'packages':len(seen),'files':files,'bytes':total}

def main(m):
 scope();assert sql("SELECT NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls FROM pg_roles WHERE rolname='passvero_app'")=='t','RUNTIME_ROLE_SCOPE'
 assert (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'],'BUILD_DRIFT'
 for table in ['AuditLog','Plan']:
  assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','SELECT')")=='t','EXISTING_READ_ACL_REQUIRED'
 assert sql("SELECT has_table_privilege('passvero_app','public.\"AuditLog\"','INSERT')")=='t','AUDIT_INSERT_REQUIRED'
 assert sql("SELECT has_column_privilege('passvero_app','public.\"Organization\"','id','UPDATE')")=='t','ORGANIZATION_LOCK_ACL_REQUIRED'
 target=R/'migration';assert not target.exists(),'DO_NOT_RETRY';target.mkdir(parents=True)
 subscription_before={right:sql("SELECT has_table_privilege('passvero_app','public.\"Subscription\"','"+right+"')")=='t' for right in ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']}
 assert subscription_before['SELECT'],'SUBSCRIPTION_READ_PRIVILEGE_REQUIRED'
 (target/'subscription-acl-before.json').write_text(json.dumps(subscription_before))
 package=json.loads((S/'migration-package.json').read_text())
 history=json.loads(sql("SELECT COALESCE(json_agg(json_build_object('migration_name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL) ORDER BY migration_name),'[]'::json) FROM _prisma_migrations"))
 assert history==m['prior_migrations'],'MIGRATION_HISTORY_DRIFT'
 assert package['latest']=='20260930120000_manual_commercial_subscriptions'
 work=R/'migration-work';assert not work.exists();work.mkdir(mode=0o755);os.chmod(R,0o755);os.chmod(work,0o755)
 for name,info in package['files'].items():
  assert name=='schema.prisma' or name=='migrations/migration_lock.toml' or re.fullmatch(r'migrations/[a-zA-Z0-9_]+/migration.sql',name),'MIGRATION_PATH'
  data=info['content'].encode();assert hashlib.sha256(data).hexdigest()==info['sha256']
  p=work/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(data);p.chmod(0o644)
  d=p.parent
  while d!=work:d.chmod(0o755);d=d.parent
 copy_prisma_runtime(A/'node_modules',work/'node_modules')
 config=work/'prisma.config.ts';config.write_text('export default {schema:"./schema.prisma",migrations:{path:"./migrations"},datasource:{url:process.env.OPERATOR_MIGRATION_URL}};');config.chmod(0o644)
 kw=identity('postgres');kw['cwd']=str(work)
 kw['env']['OPERATOR_MIGRATION_URL']='postgresql://postgres@localhost:5433/passvero_acceptance?'+urllib.parse.urlencode({'host':'/var/run/postgresql','options':'-c role=passvero_migrator -c lock_timeout=5000 -c statement_timeout=30000'})
 kw['env']['PRISMA_HIDE_UPDATE_MESSAGE']='1'
 cli=['/usr/bin/node',str(work/'node_modules/prisma/build/index.js'),'migrate']
 p=subprocess.run(cli+['status','--config',str(config)],capture_output=True,text=True,timeout=45,**kw)
 assert p.returncode==1 and package['latest'] in p.stdout+p.stderr,'EXPECTED_PENDING_MIGRATION'
 (target/'attempt.json').write_text(json.dumps({'attempts':1}))
 run(cli+['deploy','--config',str(config)],timeout=120,**kw)
 sql('BEGIN; SET LOCAL lock_timeout=\'5s\'; GRANT SELECT ON TABLE public."PlatformBillingGrant" TO passvero_app; GRANT SELECT,INSERT,UPDATE ON TABLE public."CommercialRequest" TO passvero_app; GRANT SELECT,INSERT ON TABLE public."CommercialOffer",public."SubscriptionPaidPeriod" TO passvero_app; GRANT INSERT,UPDATE ON TABLE public."Subscription" TO passvero_app; COMMIT;')
 for right,allowed in subscription_before.items():assert sql("SELECT has_table_privilege('passvero_app','public.\"Subscription\"','"+right+"')")==('t' if allowed or right in ['INSERT','UPDATE'] else 'f'),'SUBSCRIPTION_ACL_DRIFT'
 for table in ['PlatformBillingGrant','CommercialRequest','CommercialOffer','SubscriptionPaidPeriod']:
  assert sql("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.\""+table+"\"'::regclass")=='passvero_migrator','NEW_TABLE_OWNER'
 expected={'PlatformBillingGrant':['SELECT'],'CommercialRequest':['SELECT','INSERT','UPDATE'],'CommercialOffer':['SELECT','INSERT'],'SubscriptionPaidPeriod':['SELECT','INSERT']}
 for table,allowed in expected.items():
  for right in ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']:
   assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','"+right+"')")==('t' if right in allowed else 'f'),'RUNTIME_ACL'
 after=json.loads(sql("SELECT COALESCE(json_agg(json_build_object('migration_name',migration_name,'checksum',checksum,'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL) ORDER BY migration_name),'[]'::json) FROM _prisma_migrations"))
 latest={'migration_name':package['latest'],'checksum':package['files']['migrations/'+package['latest']+'/migration.sql']['sha256'],'finished':True,'rolled_back':False}
 assert after==m['prior_migrations']+[latest],'POST_MIGRATION_HISTORY'
 run(cli+['status','--config',str(config)],**kw)
 (target/'report.json').write_text(json.dumps({'migration':'PASS','manifest':sys.argv[1],'backupRestore':'NOT_PERFORMED'}));print('STAGING_MIGRATION=PASS')
if __name__=='__main__':execute(main)
