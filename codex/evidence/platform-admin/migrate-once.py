"""One exact staging platform grant migration with backup and minimal runtime grants."""
import datetime,hashlib,json,os,pathlib,pwd,re,shutil,stat,subprocess,urllib.parse
P=pathlib.Path
S=P('/tmp/passvero-platform-c513679')
R=P('/var/lib/passvero-platform-c513679/migration')
W=P('/var/tmp/passvero-platform-migration-c513679')
A=P('/var/www/passvero-acceptance')
PACKAGE_SHA='1525d98a234556487b47da1b1605ea6e6d8aa96bfb7803ee677f2024825b7654'
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

phase='VERIFY';attempted=False
os.umask(0o077)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,timeout=45,**kw):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout,**kw)
    if R.exists():
        with (R/'commands.log').open('a') as f:f.write('PHASE='+phase+' EXIT='+str(result.returncode)+'\n')
    return result
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    assert not R.exists() and not W.exists(),'DO_NOT_RERUN'
    assert sha(S/'migration-package.json')==PACKAGE_SHA,'PACKAGE_DRIFT'
    package=json.loads((S/'migration-package.json').read_text())
    latest='20260929120000_platform_grant'
    assert package['latest']==latest and package['base']=='c5136792ef95c094ab88e0d261dc51dcc69db2fa'
    assert (A/'.next/BUILD_ID').read_text().strip()=='OD9e4NOtu9LlMjE_0U2Dz','STAGING_BUILD_DRIFT'
    assert sha(A/'package.json')=='df4c1ac1b1d409c5db06c9614fc2a2cf8c5fe4fb4c6daa13f1ed3b88088ddd6e','PACKAGE_DRIFT'
    assert sha(A/'package-lock.json')=='f82a6356bd1201994d00d2032eabc7da5334de234bf36998b00c277e61f29b3c','LOCK_DRIFT'
    for name,version in {'next': '16.3.4', 'react': '19.2.4', 'react-dom': '19.2.4', 'next-intl': '4.13.2', '@prisma/client': '7.8.0', '@prisma/adapter-pg': '7.8.0', '@better-auth/prisma-adapter': '1.7.1', 'better-auth': '1.7.1', 'pg': '8.23.0', 'nodemailer': '9.1.1', 'zod': '4.6.2'}.items():
        assert json.loads((A/'node_modules'/name/'package.json').read_text())['version']==version,'DEPENDENCY_VERSION_MISMATCH'
    pg=pwd.getpwnam('postgres')
    identity=dict(user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'})
    psql=['/usr/bin/psql','-X','-q','-A','-t','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance','-v','ON_ERROR_STOP=1']
    def sql(query):
        result=run(psql+['-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; "+query+'; ROLLBACK;'],**identity)
        assert result.returncode==0,'CATALOG_READ_FAILED'
        return [json.loads(x) for x in result.stdout.splitlines() if x.startswith(('{','['))]
    def catalog():
        queries=["SELECT json_build_object('database',current_database(),'port',current_setting('port'),'data_directory',current_setting('data_directory'))",
          "SELECT COALESCE(json_agg(json_build_object('name',migration_name,'sha256',checksum,'finished',finished_at IS NOT NULL,'rolled_back',rolled_back_at IS NOT NULL) ORDER BY migration_name),'[]'::json) FROM \"_prisma_migrations\"",
          "SELECT COALESCE(json_agg(json_build_object('table',relname,'owner',pg_get_userbyid(relowner),'acl',relacl::text) ORDER BY relname),'[]'::json) FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind IN ('r','p') AND relname NOT IN ('PlatformGrant','_prisma_migrations')"]
        for table in ['User','Organization','Membership','AccountActivationIntent','AuthIdentity','AuthAuditEvent','AuditLog','OrganizationBillingProfile']:
            queries.append('SELECT json_build_object(\'table\',\''+table+'\',\'count\',count(*),\'digest\',md5(COALESCE(string_agg(row_to_json(t)::text,E\'\\n\' ORDER BY '+ ('\"organizationId\"' if table=='OrganizationBillingProfile' else 'id') +'),\'\'))) FROM "'+table+'" t')
        return sql(';'.join(queries))
    before=catalog()
    assert before[0]=={'database':'passvero_acceptance','port':'5433','data_directory':'/var/lib/postgresql/16/acceptance'},'WRONG_DATABASE'
    expected=[dict(x,finished=True,rolled_back=False) for x in package['migrations']]
    assert before[1]==expected[:-1],'MIGRATION_HISTORY_DRIFT'
    absent=sql("SELECT json_build_object('absent',to_regclass('public.\"PlatformGrant\"') IS NULL)")[0]
    assert absent['absent'],'PLATFORM_GRANT_ALREADY_EXISTS'
    a=pwd.getpwnam('passvero-staging')
    child=dict(user=a.pw_uid,group=a.pw_gid,extra_groups=os.getgrouplist(a.pw_name,a.pw_gid),cwd='/',env={'PATH':'/usr/bin:/bin','PM2_HOME':a.pw_dir+'/.pm2'})
    js="""const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"""
    monitored=run(['/usr/bin/node','-e',js],**child);assert monitored.returncode==0,'APP_READ'
    apps=json.loads(monitored.stdout);assert len(apps)==1 and apps[0]['name']=='passvero-acceptance' and apps[0]['cwd']==str(A),'APP_SCOPE'
    runtime=dict(x.split(b'=',1) for x in P('/proc',str(apps[0]['pid']),'environ').read_bytes().split(b'\0') if b'=' in x)
    assert runtime.get(b'PASSVERO_RUNTIME_ENV')==b'staging' and runtime.get(b'DOCUMENT_STORAGE_BUCKET')==b'passvero-staging-documents','ENV_SCOPE'
    db=urllib.parse.urlparse(runtime[b'DATABASE_URL'].decode());role=urllib.parse.unquote(db.username or '')
    assert role=='passvero_app' and db.path=='/passvero_acceptance' and db.port==5433,'RUNTIME_DB_SCOPE'
    assert sql("SELECT json_build_object('safe',NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls) FROM pg_roles WHERE rolname='"+role+"'")[0]['safe'],'ROLE_SCOPE'
    phase='BACKUP_AND_STAGE'
    R.mkdir(parents=True,mode=0o700);os.chmod(R.parent,0o700)
    (R/'before.json').write_text(json.dumps(before,indent=2));shutil.copyfile(S/'migration-package.json',R/'migration-package.json')
    shutil.copyfile(__file__,R/'migrate-once.py')
    backup=R/'staging-before.dump'
    with backup.open('wb') as out:
        result=subprocess.run(['/usr/bin/pg_dump','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance','--format=custom'],stdout=out,stderr=subprocess.PIPE,timeout=180,**identity)
    assert result.returncode==0 and backup.stat().st_size>0,'BACKUP_FAILED'
    checked=run(['/usr/bin/pg_restore','--list',str(backup)])
    assert checked.returncode==0 and 'ProductIdentifier' in checked.stdout,'BACKUP_LIST_FAILED'
    (R/'backup.sha256').write_text(sha(backup)+'  staging-before.dump\n')
    W.mkdir(mode=0o755);os.chmod(W,0o755)
    allowed={'schema.prisma','migrations/migration_lock.toml'}|{'migrations/'+x['name']+'/migration.sql' for x in package['migrations']}
    assert set(package['files'])==allowed,'PACKAGE_SCOPE'
    for name,info in package['files'].items():
        data=info['content'].encode();assert hashlib.sha256(data).hexdigest()==info['sha256'],'SOURCE_HASH'
        target=W/name;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);os.chmod(target,0o644)
        parent=target.parent
        while parent!=W:os.chmod(parent,0o755);parent=parent.parent
    config=W/'prisma.config.ts';config.write_text('export default {schema:"./schema.prisma",migrations:{path:"./migrations"},datasource:{url:process.env.OPERATOR_MIGRATION_URL}};\n');os.chmod(config,0o644)
    copied=copy_prisma_runtime(A/'node_modules',W/'node_modules')
    (R/'cli-copy-manifest.json').write_text(json.dumps(copied))
    url='postgresql://postgres@localhost:5433/passvero_acceptance?'+urllib.parse.urlencode({'host':'/var/run/postgresql','options':'-c role=passvero_migrator -c lock_timeout=5000 -c statement_timeout=30000'})
    cli_id=dict(user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd=str(W),env={'PATH':'/usr/bin:/bin','LANG':'C','PRISMA_HIDE_UPDATE_MESSAGE':'1','OPERATOR_MIGRATION_URL':url})
    cli=['/usr/bin/node',str(W/'node_modules/prisma/build/index.js'),'migrate']
    phase='STATUS_BEFORE'
    status=run(cli+['status','--config',str(config)],**cli_id)
    assert status.returncode==1 and latest in status.stdout+status.stderr,'EXPECTED_ONE_PENDING'
    assert catalog()==before,'PRE_DEPLOY_DRIFT'
    phase='MIGRATE_DEPLOY_ONCE';attempted=True
    (R/'attempt.json').write_text(json.dumps({'attempts':1,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}))
    result=run(cli+['deploy','--config',str(config)],timeout=120,**cli_id)
    assert result.returncode==0,'MIGRATION_FAILED_NO_RETRY'
    phase='VERIFY_AFTER';after=catalog()
    assert after[0]==before[0] and after[1]==expected and after[2:]==before[2:],'POST_MIGRATION_DRIFT'
    tables=sql("SELECT json_agg(json_build_object('table',relname,'owner',pg_get_userbyid(relowner)) ORDER BY relname) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN ('PlatformGrant')")[0]
    assert tables==[{'table':n,'owner':'passvero_migrator'} for n in ['PlatformGrant']],'TABLE_OWNER'
    counts=sql('SELECT json_build_object(\'grants\',(SELECT count(*) FROM "PlatformGrant"))')[0]
    assert counts=={'grants':0},'PLATFORM_GRANT_NOT_EMPTY'
    constraints=sql("SELECT json_object_agg(contype,n) FROM (SELECT contype,count(*) n FROM pg_constraint WHERE conrelid IN ('public.\"PlatformGrant\"'::regclass) GROUP BY contype) s")[0]
    assert constraints=={'f':1,'p':1},'CONSTRAINTS_MISSING'
    indexes=sql("SELECT json_build_object('total',count(*),'valid',bool_and(indisvalid),'unique',count(*) FILTER(WHERE indisunique)) FROM pg_index WHERE indrelid IN ('public.\"PlatformGrant\"'::regclass)")[0]
    assert indexes=={'total':1,'valid':True,'unique':1},'INDEXES_MISSING'
    def rights():
        return sql("SELECT json_object_agg(t,json_build_object("+','.join("'"+k.lower()+"',has_table_privilege('"+role+"',quote_ident(t),'"+k+"')" for k in ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'])+")) FROM unnest(ARRAY['PlatformGrant']) t")[0]
    original_rights=rights()
    assert all(not v[k] for v in original_rights.values() for k in ['insert','update','delete','truncate','references','trigger']),'EXCESS_RUNTIME_PRIVILEGES'
    (R/'runtime-grants-before.json').write_text(json.dumps({'role':role,'rights':original_rights},indent=2))
    phase='MINIMAL_RUNTIME_GRANTS'
    result=run(psql+['-c',f'BEGIN; SET LOCAL lock_timeout=\'5s\'; SET LOCAL statement_timeout=\'10s\'; GRANT SELECT ON TABLE public."PlatformGrant" TO "{role}"; COMMIT;'],**identity)
    assert result.returncode==0,'GRANT_FAILED'
    privileges=rights()
    assert all(v=={k:k in ['select'] for k in ['select','insert','update','delete','truncate','references','trigger']} for v in privileges.values()),'PRIVILEGE_VERIFY'
    assert catalog()==after,'EXISTING_DATA_OR_ACL_CHANGED'
    status=run(cli+['status','--config',str(config)],**cli_id)
    assert status.returncode==0 and 'Database schema is up to date!' in status.stdout+status.stderr,'STATUS_AFTER'
    assert (A/'.next/BUILD_ID').read_text().strip()=='OD9e4NOtu9LlMjE_0U2Dz','APP_CHANGED'
    report={'migration':'PASS','applied':latest,'attempts':1,'database':after[0],'grant_counts':counts,'existing_users_organizations_memberships_activations_identity_audit':'UNCHANGED','existing_owner_acl':'UNCHANGED','grant_privileges':privileges,'backup':str(backup),'backup_sha256':sha(backup),'prisma_status':'UP_TO_DATE','application_deployed':False,'production_changes':'NONE','rollback':'Leave additive platform grant and audit intact; application artifact rollback only; no automatic database restore.'}
    (R/'report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
except Exception as error:
    report={'migration':'STOP','phase':phase,'attempted':attempted,'error_type':type(error).__name__,'no_retry':True}
    if isinstance(error,AssertionError) and error.args:report['reason']=str(error.args[0])
    if R.exists():(R/'failure.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report));raise SystemExit(1)
