"""Privileged, explicit staging grant/revoke wrapper. No environment-file changes."""
import hashlib,json,os,pathlib,pwd,re,subprocess,sys,uuid
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
S=P('/tmp/passvero-platform-c513679')
R=P('/var/lib/passvero-platform-c513679')
BUNDLE_SHA='25f94bea99c9da8f6a827b1ce3385961c107ed96037be24cefad6cd5691f7cb6'
phase='PREFLIGHT';attempted=False

def run(args,**kw):
    result=subprocess.run(args,capture_output=True,text=True,timeout=30,**kw)
    assert result.returncode==0,'COMMAND_FAILED'
    return result.stdout.strip()

def main():
    global phase,attempted
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    assert len(sys.argv)==5,'USAGE_ACTION_EMAIL_EXPECTED_UUID_OPERATOR_REFERENCE'
    action,email,expected,reference=sys.argv[1:]
    email=email.strip().lower()
    assert action in ['grant','revoke'],'INVALID_ACTION'
    assert re.fullmatch(r'[a-z0-9._%+@-]{3,254}',email),'INVALID_EMAIL'
    assert str(uuid.UUID(expected))==expected,'INVALID_EXPECTED_USER'
    assert re.fullmatch(r'[a-zA-Z0-9._@ -]{1,100}',reference),'INVALID_OPERATOR_REFERENCE'
    assert (A/'.next/BUILD_ID').read_text().strip()=='GYvXvPhAmXDRhwUj_u9nm','BUILD_DRIFT'
    report=json.loads((R/'application/report.json').read_text())
    assert report['deployment']=='PASS' and report['build_id']=='GYvXvPhAmXDRhwUj_u9nm','DEPLOYMENT_REQUIRED'
    bundle=S/'platform-access-fixed.cjs'
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
    if action=='grant':assert before['verified'],'VERIFIED_IDENTITY_REQUIRED'
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
    phase='CLI_ONCE';attempted=True
    result=subprocess.run(['/usr/bin/node',str(bundle),action,email,reference],capture_output=True,text=True,timeout=30,**operator_identity)
    assert result.returncode==0,'OPERATOR_CLI_FAILED_CHECK_STATE_NO_BLIND_RETRY'
    outcome=json.loads(result.stdout)
    assert outcome['userId']==expected and outcome['status'] in ['GRANTED','REVOKED','NO_CHANGE'],'UNEXPECTED_CLI_RESULT'
    phase='VERIFY';after=snapshot()
    changed=before['active']!=(action=='grant')
    assert after['active']==(action=='grant') and after['memberships']==before['memberships'],'POSTCONDITION_FAILED'
    assert after['events']==before['events']+int(changed),'AUDIT_DELTA_MISMATCH'
    expected_status=('GRANTED' if action=='grant' else 'REVOKED') if changed else 'NO_CHANGE'
    assert outcome['status']==expected_status,'RESULT_MISMATCH'
    evidence={'operator':'PASS','action':action,'status':outcome['status'],'userId':expected,'grant_active':after['active'],'audit_delta':int(changed),'memberships':'UNCHANGED','database':'passvero_acceptance:5433','production_changes':'NONE'}
    evidence_dir=R/'operator';evidence_dir.mkdir(mode=0o700,exist_ok=True)
    with (evidence_dir/(str(uuid.uuid4())+'.json')).open('x') as f:json.dump(evidence,f,indent=2)
    print(json.dumps(evidence,indent=2))

try:
    os.umask(0o077)
    main()
except Exception as error:
    failure={'operator':'STOP','phase':phase,'attempted':attempted,'no_blind_retry':True}
    if isinstance(error,AssertionError) and error.args:failure['reason']=str(error.args[0])
    print(json.dumps(failure));sys.exit(1)
