"""Read-only worker boundary diagnosis. Does not execute launcher/worker or contact SMTP."""
import hashlib, json, os, pathlib, pwd, subprocess, sys
sys.dont_write_bytecode=True
P=pathlib.Path
PACKAGE=P('/var/lib/passvero-subscription-reminders-acceptance-package-v2')
PIN='3fbd3c8a65ce296d5d6450ec97f936e73f6095fce1a23de3f2d71adc3f0913f6'
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    assert hashlib.sha256((PACKAGE/'manifest.json').read_bytes()).hexdigest()==PIN,'MANIFEST_DRIFT'
    m=json.loads((PACKAGE/'manifest.json').read_text())
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
    inventory=query('''SELECT json_build_object(
      'campaigns',(SELECT json_agg(json_build_object('id',id,'enabled',enabled,'dispatches',dispatches,'maxDispatches',"maxDispatches") ORDER BY id) FROM "ReminderCampaign"),
      'outbox',(SELECT COALESCE(json_agg(x),'[]') FROM (SELECT status,count(*) AS count FROM "SubscriptionReminder" GROUP BY status) x),
      'attempts',(SELECT count(*) FROM "ReminderAttempt"))''')
    acl=query('''SELECT json_agg(json_build_object('table',t,'select',has_table_privilege('passvero_app',format('public.%I',t),'SELECT'))) FROM unnest(ARRAY['Organization','Membership','User','AuthIdentity','PlatformBillingGrant','OrganizationBillingProfile','BillingEmailConfirmation','OrganizationEntitlementEnrollment','SubscriptionPaidPeriod','SubscriptionPaidPeriodActivation','SubscriptionUpgradeReceipt','Product','ProductVersion','Passport','ReminderCampaign','SubscriptionReminder','ReminderAttempt','AuditLog']) t''')
    writes=query('''SELECT json_build_object(
      'outboxInsert',has_table_privilege('passvero_app','public."SubscriptionReminder"','INSERT'),
      'outboxUpdate',has_table_privilege('passvero_app','public."SubscriptionReminder"','UPDATE'),
      'attemptInsert',has_table_privilege('passvero_app','public."ReminderAttempt"','INSERT'),
      'attemptUpdate',has_table_privilege('passvero_app','public."ReminderAttempt"','UPDATE'),
      'auditInsert',has_table_privilege('passvero_app','public."AuditLog"','INSERT'),
      'authProviderRead',has_table_privilege('passvero_auth','public."AuthProviderUser"','SELECT'))''')
    process=common.monitor();assert process['status']=='online','APP_NOT_ONLINE'
    account=pwd.getpwnam('passvero-staging');proc=P('/proc')/str(process['pid'])
    assert proc.stat().st_uid==account.pw_uid and (proc/'cwd').resolve()==common.A,'PROCESS_SCOPE'
    keys=['PASSVERO_RUNTIME_ENV','BETTER_AUTH_URL','DATABASE_URL','AUTH_DATABASE_URL','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','AUTH_EMAIL_FROM','AUTH_EMAIL_REPLY_TO']
    raw=dict(part.split(b'=',1) for part in (proc/'environ').read_bytes().split(b'\0') if b'=' in part)
    presence={key:bool(raw.get(key.encode())) for key in keys}
    markers={'runtimeStaging':raw.get(b'PASSVERO_RUNTIME_ENV')==b'staging','originStaging':raw.get(b'BETTER_AUTH_URL')==b'https://staging.passvero.eu'}
    probe="""const r=require('node:module').createRequire('/usr/local/libexec/passvero-subscription-reminders/worker.cjs');const result={};for(const name of ['@prisma/adapter-pg','@prisma/client/runtime/client','zod','nodemailer']){try{r(name);result[name]='PASS'}catch(e){result[name]=['MODULE_NOT_FOUND','EACCES','ERR_REQUIRE_ESM'].includes(e.code)?e.code:'LOAD_FAILED'}}console.log(JSON.stringify(result));"""
    kw=common.identity('passvero-staging');kw['env']['NODE_PATH']=str(common.A/'node_modules')
    result=subprocess.run(['/usr/bin/node','-e',probe],capture_output=True,text=True,timeout=15,**kw)
    libraries=json.loads(result.stdout) if result.returncode==0 else {'result':'MODULE_PROBE_FAILED'}
    created=json.loads((common.R/'acceptance-v2/create.json').read_text())['result']
    fields=['organizationIds','campaignIds','publicPeriodId','productId','publicCode','versionId','passportId','billingEmailConfirmed','transportCalls']
    print(json.dumps({'diagnostic':'READ_ONLY_COMPLETE','inventory':inventory,'runtimeEnvironmentKeyPresence':presence,'runtimeMarkers':markers,'workerLibraries':libraries,'appReadPrivileges':acl,'otherRequiredPrivileges':writes,'createdFixtureEvidence':{k:created[k] for k in fields},'writes':'NONE','workerExecuted':False,'smtpCalls':0},indent=2))
except Exception as error:
    print(json.dumps({'diagnostic':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'writes':'NONE','workerExecuted':False,'smtpCalls':0}))
    sys.exit(1)
