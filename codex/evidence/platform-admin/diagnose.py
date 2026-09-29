"""Read-only diagnostic after failed operator CLI. Never invokes grant/revoke."""
import hashlib,json,os,pathlib,pwd,re,subprocess,sys,uuid
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
S=P('/tmp/passvero-platform-c513679')
R=P('/var/lib/passvero-platform-c513679')
BUNDLE_SHA='61b68081f8474b3d6a38943b2f1ca61b01a23250c852e3f2dfea75f8fee4c76d'
phase='PREFLIGHT';attempted=False

def run(args,**kw):
    result=subprocess.run(args,capture_output=True,text=True,timeout=30,**kw)
    assert result.returncode==0,'COMMAND_FAILED'
    return result.stdout.strip()

def main():
    global phase,attempted
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    assert len(sys.argv)==3,'USAGE_EMAIL_EXPECTED_UUID'
    email,expected=sys.argv[1:]
    email=email.strip().lower()
    assert re.fullmatch(r'[a-z0-9._%+@-]{3,254}',email),'INVALID_EMAIL'
    assert str(uuid.UUID(expected))==expected,'INVALID_EXPECTED_USER'
    assert (A/'.next/BUILD_ID').read_text().strip()=='GYvXvPhAmXDRhwUj_u9nm','BUILD_DRIFT'
    report=json.loads((R/'application/report.json').read_text())
    assert report['deployment']=='PASS' and report['build_id']=='GYvXvPhAmXDRhwUj_u9nm','DEPLOYMENT_REQUIRED'
    bundle=S/'platform-access.cjs'
    assert not bundle.is_symlink() and bundle.stat().st_uid==0 and bundle.stat().st_mode&0o022==0,'BUNDLE_PERMISSIONS'
    assert hashlib.sha256(bundle.read_bytes()).hexdigest()==BUNDLE_SHA,'BUNDLE_DRIFT'
    pg=pwd.getpwnam('postgres');app=pwd.getpwnam('passvero-staging')
    pg_identity=dict(user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'})
    psql=['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance','-v','ON_ERROR_STOP=1']
    def sql(query):
        return json.loads(run(psql+['-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; "+query+'; ROLLBACK;'],**pg_identity))
    target=sql("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'data',current_setting('data_directory'))")
    assert target=={'database':'passvero_acceptance','port':'5433','data':'/var/lib/postgresql/16/acceptance'},'DATABASE_SCOPE'
    def snapshot():
        return sql("SELECT json_build_object('userId',u.id,'verified',EXISTS(SELECT 1 FROM \"AuthIdentity\" i JOIN \"AuthProviderUser\" p ON p.id=i.\"providerSubject\" WHERE i.\"userId\"=u.id AND i.provider='BETTER_AUTH' AND i.\"revokedAt\" IS NULL AND p.\"emailVerified\" AND p.email=u.email),'active',EXISTS(SELECT 1 FROM \"PlatformGrant\" g WHERE g.\"userId\"=u.id AND g.\"revokedAt\" IS NULL),'events',(SELECT count(*) FROM \"AuthAuditEvent\" e WHERE e.\"userId\"=u.id AND e.action IN ('PLATFORM_ACCESS_GRANTED','PLATFORM_ACCESS_REVOKED')),'memberships',(SELECT count(*) FROM \"Membership\" m WHERE m.\"userId\"=u.id)) FROM \"User\" u WHERE u.id='"+expected+"'::uuid AND u.email='"+email+"'")
    before=snapshot();assert before['userId']==expected,'ACCOUNT_IDENTITY_MISMATCH'
    print(json.dumps({'diagnostic':'GRANT_STATE','grant_state':before,'writes':'NONE','grant_retried':False}),flush=True)
    child=dict(user=app.pw_uid,group=app.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C','PM2_HOME':app.pw_dir+'/.pm2'})
    js="""const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"""
    apps=json.loads(run(['/usr/bin/node','-e',js],**child))
    assert len(apps)==1 and apps[0]['name']=='passvero-acceptance' and apps[0]['status']=='online' and apps[0]['cwd']==str(A),'APP_SCOPE'
    runtime=dict(x.split(b'=',1) for x in P('/proc',str(apps[0]['pid']),'environ').read_bytes().split(b'\0') if b'=' in x)
    assert runtime.get(b'PASSVERO_RUNTIME_ENV')==b'staging' and runtime.get(b'BETTER_AUTH_URL')==b'https://staging.passvero.eu','RUNTIME_SCOPE'
    # Whitelist only existing required configuration. No PM2 IPC or Node options survive.
    environment={key:runtime[key.encode()].decode() for key in ['PASSVERO_RUNTIME_ENV','BETTER_AUTH_URL','DATABASE_URL','AUTH_DATABASE_URL']}
    environment.update({'PATH':'/usr/bin:/bin','LANG':'C','NODE_PATH':str(A/'node_modules')})
    # Temporary child supplementary group permits reading existing app dependencies;
    # no OS account/group or filesystem permissions are changed.
    operator_identity=dict(user=pg.pw_uid,group=pg.pw_gid,extra_groups=[app.pw_gid],cwd='/',env=environment)
    probe=S/'diagnostic.cjs'
    assert not probe.is_symlink() and probe.stat().st_uid==0 and probe.stat().st_mode&0o022==0,'PROBE_PERMISSIONS'
    assert hashlib.sha256(probe.read_bytes()).hexdigest()=='b4245d12704511c1e2a0b68dc45ac344f7bb25887e5a0bde4a6847305c0b61a8','PROBE_HASH_MISMATCH'
    phase='READ_ONLY_PROBE'
    loader="""try { require(process.argv[1]); } catch(e) { const c=typeof e.code==='string'&&/^[A-Z_0-9]{3,64}$/.test(e.code)?e.code:'UNCLASSIFIED';console.log(JSON.stringify({probe:'IMPORT_FAIL',code:c})); }"""
    result=subprocess.run(['/usr/bin/node','-e',loader,str(probe),expected],capture_output=True,text=True,timeout=30,**operator_identity)
    diagnostics=[]
    for line in result.stdout.splitlines():
        try: item=json.loads(line)
        except ValueError: continue
        if isinstance(item,dict) and item.get('probe') in ['PASS','FAIL','IMPORT_FAIL','CLEANUP_FAIL']:diagnostics.append(item)
    print(json.dumps({'diagnostic':'COMPLETE','grant_state':before,'exit_code':result.returncode,'probe':diagnostics,'writes':'NONE','grant_retried':False},indent=2))

try:
    os.umask(0o077)
    main()
except Exception as error:
    failure={'operator':'STOP','phase':phase,'attempted':attempted,'no_blind_retry':True}
    if isinstance(error,AssertionError) and error.args:failure['reason']=str(error.args[0])
    print(json.dumps(failure));sys.exit(1)
