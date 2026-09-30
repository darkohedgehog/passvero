"""Manifest-pinned code-directory permission correction; campaigns stay disabled; no SMTP."""
import hashlib, json, os, pathlib, stat, subprocess, sys
sys.dont_write_bytecode=True
P=pathlib.Path
PACKAGE=P('/var/lib/passvero-subscription-reminders-package-v2')
PIN='1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf'
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    assert hashlib.sha256((PACKAGE/'manifest.json').read_bytes()).hexdigest()==PIN,'MANIFEST_DRIFT'
    m=json.loads((PACKAGE/'manifest.json').read_text())
    for p in [PACKAGE,*PACKAGE.parents]:
        info=p.lstat();assert p.is_dir() and not p.is_symlink() and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_DIRECTORY'
    p=PACKAGE/'common.py';info=p.lstat()
    assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'COMMON_FILE'
    assert hashlib.sha256(p.read_bytes()).hexdigest()==m['package_files']['common.py'],'COMMON_HASH'
    sys.path.insert(0,str(PACKAGE));sys.argv=[sys.argv[0],PIN]
    import common
    common.verify();common.scope()
    def inventory():
        return json.loads(common.sql('''BEGIN READ ONLY; SELECT json_build_object(
          'campaigns',(SELECT count(*) FROM "ReminderCampaign"),
          'enabled',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled),
          'dispatches',(SELECT COALESCE(sum(dispatches),0) FROM "ReminderCampaign"),
          'outbox',(SELECT count(*) FROM "SubscriptionReminder"),
          'attempts',(SELECT count(*) FROM "ReminderAttempt")); ROLLBACK;'''))
    before=inventory()
    assert before=={'campaigns':2,'enabled':0,'dispatches':0,'outbox':0,'attempts':0},'STATE_REQUIRES_REVIEW'
    assert common.run(['systemctl','show','passvero-subscription-reminders.timer','--property=ActiveState','--value'])=='inactive','TIMER_ACTIVE'
    assert common.run(['systemctl','show','passvero-subscription-reminders.service','--property=ActiveState','--value'])=='inactive','WORKER_ACTIVE'
    worker=P('/usr/local/libexec/passvero-subscription-reminders')
    info=worker.lstat()
    assert stat.S_ISDIR(info.st_mode) and info.st_uid==0 and worker.resolve()==worker,'WORKER_DIRECTORY_SCOPE'
    assert stat.S_IMODE(info.st_mode)==0o700,'EXPECTED_UMASK_DEFECT_NOT_PRESENT'
    for name in ['worker.cjs','launch.py']:
        common.regular(worker/name)
        assert common.sha(worker/name)==m['package_files'][name],'WORKER_FILE_DRIFT'
    worker.chmod(0o755)
    probe="""const fs=require('node:fs'),r=require('node:module').createRequire('/usr/local/libexec/passvero-subscription-reminders/worker.cjs');fs.accessSync('/usr/local/libexec/passvero-subscription-reminders/worker.cjs',fs.constants.R_OK);for(const name of ['@prisma/adapter-pg','@prisma/client/runtime/client','zod','nodemailer'])r(name);console.log('WORKER_LIBRARIES=PASS');"""
    kw=common.identity('passvero-staging');kw['env']['NODE_PATH']=str(common.A/'node_modules')
    assert common.run(['/usr/bin/node','-e',probe],timeout=15,**kw)=='WORKER_LIBRARIES=PASS','LIBRARY_ACCESS_FAILED'
    # Existing pinned enqueue code returns before mutations for a disabled campaign.
    check=subprocess.run(['/usr/bin/python3',str(worker/'launch.py'),'enqueue','c0db6597-b030-58d5-bfe3-31019b05c427'],capture_output=True,text=True,timeout=195)
    output=json.loads(check.stdout)
    assert check.returncode==0 and output=={'worker':'ENQUEUED','campaignId':'c0db6597-b030-58d5-bfe3-31019b05c427','transportCalls':0},'DISABLED_ENQUEUE_CHECK_FAILED'
    assert inventory()==before,'DISABLED_PROBE_CHANGED_STATE'
    print(json.dumps({'repair':'WORKER_DIRECTORY_0700_TO_0755_PASS','workerLibraries':'PASS','disabledCampaignEnqueue':'PASS','inventory':before,'codeFilesChanged':False,'environmentFilesChanged':False,'smtpCalls':0,'fixturesRetained':True},indent=2))
except Exception as error:
    print(json.dumps({'repair':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED','automaticSendingEnabled':False}))
    sys.exit(1)
