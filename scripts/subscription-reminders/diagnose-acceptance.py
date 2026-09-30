"""Read-only failed-create diagnosis. Never executes the fixture bundle or imports transport."""
import hashlib, json, os, pathlib, pwd, subprocess, sys
sys.dont_write_bytecode=True
P=pathlib.Path
PACKAGE=P('/var/lib/passvero-subscription-reminders-acceptance-package')
PIN='1da0601584c8228acb12dde447fe690c876b32ed808573c640f2eb6d6cd778c3'
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    manifest=PACKAGE/'manifest.json'
    assert hashlib.sha256(manifest.read_bytes()).hexdigest()==PIN,'MANIFEST_DRIFT'
    m=json.loads(manifest.read_text())
    for p in [PACKAGE,*PACKAGE.parents]:
        info=p.lstat();assert p.is_dir() and not p.is_symlink() and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_DIRECTORY'
    for name in ['common.py','manifest.json']:
        p=PACKAGE/name;info=p.lstat();assert p.is_file() and not p.is_symlink() and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_FILE'
    assert hashlib.sha256((PACKAGE/'common.py').read_bytes()).hexdigest()==m['package_files']['common.py'],'COMMON_HASH'
    sys.path.insert(0,str(PACKAGE));sys.argv=[sys.argv[0],PIN]
    import common
    common.verify();common.scope()
    def query(statement):
        return json.loads(common.sql("BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; "+statement+'; ROLLBACK;'))
    counts=query('''SELECT json_build_object(
      'fixtureOrganizations',(SELECT count(*) FROM "Organization" WHERE id IN ('8c789610-9953-58c8-9cd7-1b5815dd6fd4','371ef379-7e1f-5775-842f-9eba78838046','8504ae2e-059e-5b7d-974d-175e3d3c39c1')),
      'campaigns',(SELECT count(*) FROM "ReminderCampaign"),
      'enabledCampaigns',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled),
      'outbox',(SELECT count(*) FROM "SubscriptionReminder"),
      'attempts',(SELECT count(*) FROM "ReminderAttempt"))''')
    actors=query('''SELECT json_agg(x ORDER BY id) FROM (SELECT u.id,
      (SELECT count(*) FROM "AuthIdentity" i JOIN "AuthProviderUser" p ON p.id=i."providerSubject" WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL AND p."emailVerified" AND p.email=u.email) AS verifiedIdentities,
      EXISTS(SELECT 1 FROM "PlatformBillingGrant" g WHERE g."userId"=u.id AND g."revokedAt" IS NULL) AS billingGrant,
      EXISTS(SELECT 1 FROM "PlatformRegulatoryGrant" g WHERE g."userId"=u.id AND g."revokedAt" IS NULL) AS regulatoryGrant
      FROM "User" u WHERE u.id IN ('cbb590fa-1c67-41bf-883d-c2eb96bf6edb','40e51001-912c-4bcf-aa45-d866632aac85')) x''')
    # Loading these dependency libraries does not run acceptance.cjs or open a DB connection.
    probe="""const fs=require('node:fs'),r=require('node:module').createRequire('/var/lib/passvero-subscription-reminders/acceptance-runtime/acceptance.cjs');const result={};try{fs.accessSync('/var/lib/passvero-subscription-reminders/acceptance-runtime/acceptance.cjs',fs.constants.R_OK);result.bundleReadable=true}catch{result.bundleReadable=false}for(const name of ['@prisma/adapter-pg','@prisma/client/runtime/client','zod']){try{r(name);result[name]='PASS'}catch(e){result[name]=['MODULE_NOT_FOUND','EACCES','ERR_REQUIRE_ESM','ERR_PACKAGE_PATH_NOT_EXPORTED'].includes(e.code)?e.code:'LOAD_FAILED'}}console.log(JSON.stringify(result));"""
    probes={}
    for label,with_group in [('currentIdentity',False),('withStagingGroup',True)]:
        kw=common.identity('postgres');kw['env']['NODE_PATH']=str(common.A/'node_modules')
        if with_group:kw['extra_groups']=sorted(set(kw['extra_groups']+[pwd.getpwnam('passvero-staging').pw_gid]))
        result=subprocess.run(['/usr/bin/node','-e',probe],capture_output=True,text=True,timeout=15,**kw)
        probes[label]=json.loads(result.stdout) if result.returncode==0 else {'result':'NODE_PROBE_FAILED'}
    print(json.dumps({'diagnostic':'READ_ONLY_COMPLETE','counts':counts,'actors':actors,'dependencyAccess':probes,'writes':'NONE','fixtureBundleExecuted':False,'smtpCalls':0},indent=2))
except Exception as error:
    print(json.dumps({'diagnostic':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'writes':'NONE','fixtureBundleExecuted':False,'smtpCalls':0}))
    sys.exit(1)
