"""Pinned staging-only additive install. No enrollment enable, fixtures or worker execution."""
from common import A, R, S, P, sha, regular, run, identity, sql, scope, pm, monitor, execute, copy_prisma_runtime
import contextlib, hashlib, importlib.util, io, json, os, pwd, re, subprocess, sys, tarfile, time, urllib.parse

CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
WORKER = P('/usr/local/libexec/passvero-subscription-reminders')
TIMER = 'passvero-subscription-reminders.timer'
SERVICE = 'passvero-subscription-reminders.service'
BACKUP_SUFFIX = '.before-future-enrollment'
FAILED_SUFFIX = '.failed-future-enrollment'
HISTORY = "SELECT json_build_object('count',count(*),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name)),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL)) FROM _prisma_migrations"
# Scheduler timestamps may advance between the read-only inventory and timer drain.
VOLATILE = {'lastStartedAt', 'lastSuccessAt', 'lastError'}

def business_snapshot(inventory):
    return {'organizations': inventory['organizations'],
            'campaigns': [{k:v for k,v in c.items() if k not in VOLATILE} for c in inventory['campaigns']],
            'outbox': inventory['outbox'], 'attemptCounts': inventory['attemptCounts']}

def inventory():
    spec = importlib.util.spec_from_file_location('enrollment_preflight', S/'enrollment-preflight.py')
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    output = io.StringIO()
    with contextlib.redirect_stdout(output): module.main()
    return json.loads(output.getvalue())

def drain():
    run(['systemctl', 'stop', TIMER])
    deadline = time.monotonic()+30
    while time.monotonic()<deadline:
        if run(['systemctl','show',SERVICE,'--property=ActiveState','--value']) in ('inactive','failed'): return
        time.sleep(1)
    raise AssertionError('WORKER_STILL_ACTIVE_NO_FORCED_STOP')

def verify_artifacts(base, files):
    for name, value in files.items():
        assert name.startswith(('.next/', 'messages/')) and '..' not in P(name).parts, 'ARTIFACT_PATH'
        path = base/name
        assert path.is_file() and not path.is_symlink() and sha(path)==(value['sha256'] if isinstance(value,dict) else value), 'ARTIFACT_DRIFT'

def healthy():
    deadline = time.monotonic()+45
    while time.monotonic()<deadline:
        result = subprocess.run(['curl','--max-time','3','-sS','-L','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/request-access'],capture_output=True,text=True)
        if result.returncode==0 and result.stdout=='200 0': return
        time.sleep(1)
    raise AssertionError('HTTPS_NOT_READY')

def prepare_application(m):
    prepared=A/'.future-enrollment-prepared'
    assert not prepared.exists(), 'DO_NOT_RETRY_PREPARED'
    prepared.mkdir(mode=0o750)
    account=pwd.getpwnam('passvero-staging'); os.chown(prepared,account.pw_uid,account.pw_gid)
    with tarfile.open(S/'application.tar.gz') as archive:
        entries=archive.getmembers()
        assert len(entries)==len(m['application_files']) and {e.name for e in entries}==set(m['application_files']), 'ARCHIVE_INVENTORY'
        for entry in entries:
            assert entry.isfile() and entry.name.startswith(('.next/','messages/')) and '..' not in P(entry.name).parts and not P(entry.name).is_absolute(), 'ARCHIVE_PATH'
            data=archive.extractfile(entry).read()
            assert hashlib.sha256(data).hexdigest()==m['application_files'][entry.name], 'ARTIFACT_HASH'
            path=prepared/entry.name; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data)
            path.chmod(0o640); os.chown(path,account.pw_uid,account.pw_gid)
            parent=path.parent
            while parent!=prepared:
                parent.chmod(0o750); os.chown(parent,account.pw_uid,account.pw_gid); parent=parent.parent
    return prepared

def migrate(m):
    assert json.loads(sql(HISTORY))==m['prior_migrations'], 'MIGRATION_HISTORY_DRIFT'
    package=json.loads((S/'migration-package.json').read_text())
    assert package['latest']=='20261008120000_reminder_future_enrollment', 'MIGRATION_SCOPE'
    work=R/'migration-work'; assert not work.exists(), 'DO_NOT_RETRY_MIGRATION'; work.mkdir(mode=0o755); R.chmod(0o755); work.chmod(0o755)
    for name, info in package['files'].items():
        assert name in ('schema.prisma','migrations/migration_lock.toml') or re.fullmatch(r'migrations/[a-zA-Z0-9_]+/migration.sql',name), 'MIGRATION_PATH'
        data=info['content'].encode(); assert hashlib.sha256(data).hexdigest()==info['sha256'], 'MIGRATION_HASH'
        path=work/name; path.parent.mkdir(parents=True,exist_ok=True); path.write_bytes(data); path.chmod(0o644)
        parent=path.parent
        while parent!=work: parent.chmod(0o755); parent=parent.parent
    copy_prisma_runtime(A/'node_modules',work/'node_modules')
    config=work/'prisma.config.ts'; config.write_text('export default {schema:"./schema.prisma",migrations:{path:"./migrations"},datasource:{url:process.env.OPERATOR_MIGRATION_URL}};'); config.chmod(0o644)
    kw=identity('postgres'); kw['cwd']=str(work)
    kw['env']['OPERATOR_MIGRATION_URL']='postgresql://postgres@localhost:5433/passvero_acceptance?'+urllib.parse.urlencode({'host':'/var/run/postgresql','options':'-c role=passvero_migrator -c lock_timeout=5000 -c statement_timeout=30000'})
    kw['env']['PRISMA_HIDE_UPDATE_MESSAGE']='1'
    cli=['/usr/bin/node',str(work/'node_modules/prisma/build/index.js'),'migrate']
    check=subprocess.run(cli+['status','--config',str(config)],capture_output=True,text=True,timeout=45,**kw)
    assert check.returncode==1 and package['latest'] in check.stdout+check.stderr, 'EXPECTED_PENDING_MIGRATION'
    (R/'migration-attempt.json').write_text(json.dumps({'manifest':sys.argv[1]}))
    run(cli+['deploy','--config',str(config)],timeout=120,**kw)
    sql('BEGIN; SET LOCAL lock_timeout=\'5s\'; '+(S/'runtime-acl.sql').read_text()+' COMMIT;')
    assert json.loads(sql(HISTORY))==m['after_migrations'], 'POST_MIGRATION_HISTORY'
    run(cli+['status','--config',str(config)],**kw)
    for table in ['ReminderEnrollmentPolicy','OrganizationReminderEnrollment']:
        assert sql("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.\""+table+"\"'::regclass")=='passvero_migrator', 'TABLE_OWNER'
        for right in ['INSERT','DELETE','TRUNCATE','TRIGGER','REFERENCES','UPDATE']:
            assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','"+right+"')")=='f', 'APPROVAL_WRITE_FORBIDDEN'
        assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','SELECT')")=='t', 'ENROLLMENT_READ_REQUIRED'
    for table,column in [('ReminderEnrollmentPolicy','enabled'),('OrganizationReminderEnrollment','enabled'),('OrganizationReminderEnrollment','approvalReference'),('ReminderCampaign','maxDispatches'),('ReminderCampaign','enabled')]:
        assert sql("SELECT has_column_privilege('passvero_app','public.\""+table+"\"','"+column+"','UPDATE')")=='f', 'APPROVAL_COLUMN_FORBIDDEN'
    disabled_state()

def disabled_state():
    assert sql('SELECT count(*) FROM "ReminderEnrollmentPolicy" WHERE id=1 AND NOT enabled AND "enabledAt" IS NULL')=='1', 'FUTURE_POLICY_MUST_REMAIN_DISABLED'
    assert sql('SELECT count(*) FROM "OrganizationReminderEnrollment"')=='0', 'NO_ENROLLMENTS_APPROVED'
    assert sql('SELECT count(*) FROM "ReminderCampaign" WHERE "automaticRecipients" OR "enrollmentOrganizationId" IS NOT NULL OR "periodKey" IS NOT NULL')=='0', 'NO_MANAGED_CAMPAIGN_APPROVED'

def retained_business(m):
    # Use the pre-migration row shape: added nullable/default columns are not history changes.
    expected=json.loads((S/'preflight.json').read_text())['inventory']
    columns=[k for k in expected['campaigns'][0] if k not in VOLATILE]
    select=','.join('"'+c+'"' for c in columns)
    rows=json.loads(sql('SELECT COALESCE(json_agg(c ORDER BY c.id),\'[]\') FROM (SELECT '+select+' FROM "ReminderCampaign") c'))
    assert rows==business_snapshot(expected)['campaigns'], 'CAMPAIGN_APPROVAL_OR_COUNTER_DRIFT'
    assert sql('SELECT count(*) FROM "SubscriptionReminder"')==str(len(expected['outbox'])), 'OUTBOX_DRIFT'
    assert sql('SELECT count(*) FROM "ReminderAttempt"')==str(sum(int(a['count']) for a in expected['attemptCounts'])), 'ATTEMPT_DRIFT'
    disabled_state()

def rollback(m):
    scope(); regular(R/'state.json'); state=json.loads((R/'state.json').read_text())
    assert state['manifest']==sys.argv[1], 'ROLLBACK_STATE_DRIFT'
    assert not (R/'rollback-attempt.json').exists(), 'DO_NOT_RETRY_ROLLBACK'
    drain()
    assert sql('SELECT count(*) FROM "SubscriptionReminder" WHERE status IN (\'CLAIMED\',\'SENDING\',\'DELIVERY_UNKNOWN\')')=='0', 'RESOLVE_DELIVERY_BEFORE_ROLLBACK'
    if sql("SELECT to_regclass('public.\"ReminderEnrollmentPolicy\"') IS NOT NULL")=='t':
        assert sql('SELECT count(*) FROM "ReminderEnrollmentPolicy" WHERE enabled')=='0', 'DISABLE_FUTURE_ENROLLMENT_BEFORE_ROLLBACK'
        assert sql('SELECT count(*) FROM "ReminderCampaign" WHERE "automaticRecipients" AND enabled')=='0', 'DISABLE_MANAGED_CAMPAIGNS_BEFORE_ROLLBACK'
    previous=(R/'previous-canonical.json').read_bytes(); prior=json.loads(previous)
    assert hashlib.sha256(previous).hexdigest()==m['previous_canonical'], 'PREVIOUS_CANONICAL_DRIFT'
    current=json.loads(CANONICAL.read_text())
    assert current==prior or (current.get('future_enrollment_manifest_sha256')==sys.argv[1] and current['build_id']==m['build_id']), 'CURRENT_DEPLOYMENT_DRIFT'
    oldfiles={k:v for k,v in prior['files'].items() if k.startswith(('.next/','messages/'))}
    for name in ['.next','messages']:
        old=A/(name+BACKUP_SUFFIX)
        if old.exists():
            for path,pin in oldfiles.items():
                if path.startswith(name+'/'): assert sha(old/path[len(name)+1:])==pin['sha256'], 'ROLLBACK_ARTIFACT_DRIFT'
            assert not (A/(name+FAILED_SUFFIX)).exists(), 'ROLLBACK_ALREADY_EXISTS'
            if (A/name).exists(): verify_artifacts(A,{k:v for k,v in m['application_files'].items() if k.startswith(name+'/')})
        else:
            verify_artifacts(A,{k:v for k,v in oldfiles.items() if k.startswith(name+'/')})
    for name in ['worker.cjs','launch.py']:
        assert sha(R/('previous-'+name))==m['previous_'+name.split('.')[0]], 'ROLLBACK_WORKER_DRIFT'
    (R/'rollback-attempt.json').write_text('{}'); pm(['stop','passvero-acceptance'])
    for name in ['.next','messages']:
        old=A/(name+BACKUP_SUFFIX)
        if old.exists():
            if (A/name).exists(): (A/name).rename(A/(name+FAILED_SUFFIX))
            old.rename(A/name)
    for name in ['worker.cjs','launch.py']:
        (WORKER/name).write_bytes((R/('previous-'+name)).read_bytes()); (WORKER/name).chmod(0o644)
    candidate=CANONICAL.with_name('manifest.future-enrollment-rollback.json'); candidate.write_bytes(previous); candidate.chmod(0o600); os.replace(candidate,CANONICAL)
    assert (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'], 'ROLLBACK_BUILD_DRIFT'
    verify_artifacts(A,oldfiles); pm(['restart','passvero-acceptance']); healthy(); pm(['save'])
    if state['timerActive']: run(['systemctl','start',TIMER])
    report={'rollback':'PASS','buildId':m['previous_build'],'database':'ADDITIVE_SCHEMA_AND_HISTORY_RETAINED','futureEnrollment':False,'workerExecutedByInstaller':False}
    (R/'rollback-report.json').write_text(json.dumps(report)); print(json.dumps(report))

def main(m):
    if len(sys.argv)==3 and sys.argv[2]=='rollback': return rollback(m)
    assert len(sys.argv)==2, 'INSTALL_OR_EXPLICIT_ROLLBACK_ONLY'
    scope(); assert not (R/'state.json').exists(), 'DO_NOT_RETRY_INSTALL'
    pre=inventory(); expected=json.loads((S/'preflight.json').read_text())
    for key in ['scope','runtimeEndpoints','buildId','canonicalSha256','packageSha256','lockSha256','runtimeDependencies','workerSha256','launcherSha256']:
        assert pre[key]==expected[key], 'PREFLIGHT_RUNTIME_DRIFT'
    assert business_snapshot(pre['inventory'])==business_snapshot(expected['inventory']), 'BUSINESS_INVENTORY_DRIFT'
    assert pre['inventory']['migrations']==m['prior_migrations'] and not pre['inventory']['futurePolicyTable'], 'SCHEMA_DRIFT'
    assert all(r['status'] not in ('PENDING','CLAIMED','SENDING','DELIVERY_UNKNOWN') for r in pre['inventory']['outbox']), 'DELIVERY_REQUIRES_REVIEW'
    assert run(['systemctl','show',TIMER,'--property=UnitFileState','--value'])=='enabled', 'TIMER_ENABLEMENT_DRIFT'
    assert run(['systemctl','show',TIMER,'--property=ActiveState','--value'])=='active', 'TIMER_ACTIVITY_DRIFT'
    R.mkdir(mode=0o700); (R/'previous-canonical.json').write_bytes(CANONICAL.read_bytes())
    for name in ['worker.cjs','launch.py']: (R/('previous-'+name)).write_bytes((WORKER/name).read_bytes())
    (R/'state.json').write_text(json.dumps({'manifest':sys.argv[1],'timerActive':True,'previousBuild':m['previous_build']}))
    drain()
    drained=inventory(); assert business_snapshot(drained['inventory'])==business_snapshot(expected['inventory']), 'DRAIN_INVENTORY_DRIFT'
    prepared=prepare_application(m)
    for name in ['.next','messages']: assert not (A/(name+BACKUP_SUFFIX)).exists(), 'BACKUP_PATH_EXISTS'
    pm(['stop','passvero-acceptance'])
    try:
        migrate(m); retained_business(m)
        for name in ['.next','messages']: (A/name).rename(A/(name+BACKUP_SUFFIX)); (prepared/name).rename(A/name)
        for name in ['worker.cjs','launch.py']: (WORKER/name).write_bytes((S/name).read_bytes()); (WORKER/name).chmod(0o644)
        prior=json.loads((R/'previous-canonical.json').read_text()); updated=dict(prior)
        updated['build_id']=m['build_id']; updated['future_enrollment_manifest_sha256']=sys.argv[1]
        updated['files']={k:v for k,v in prior['files'].items() if not k.startswith(('.next/','messages/'))}
        updated['files'].update({k:{'sha256':v,'bytes':(A/k).stat().st_size} for k,v in m['application_files'].items()})
        candidate=CANONICAL.with_name('manifest.future-enrollment-candidate.json'); candidate.write_text(json.dumps(updated,indent=2)); candidate.chmod(0o600); os.replace(candidate,CANONICAL)
        verify_artifacts(A,m['application_files']); run(['/usr/bin/node','--check',str(WORKER/'worker.cjs')])
        pm(['restart','passvero-acceptance']); healthy()
        response=run(['curl','--max-time','10','-sS','-D','-','-o','/dev/null','-w','\nSTATUS=%{http_code} TLS=%{ssl_verify_result}','https://staging.passvero.eu/platform/billing/deliveries'])
        assert ('STATUS=404 TLS=0' in response or 'STATUS=307 TLS=0' in response) and 'private' in response.lower() and 'no-store' in response.lower(), 'ANONYMOUS_BOUNDARY'
        assert monitor()['status']=='online', 'APP_NOT_ONLINE'
        post=inventory()
        assert post['runtimeEndpoints']==expected['runtimeEndpoints'] and post['buildId']==m['build_id'], 'DEPLOYED_RUNTIME_SCOPE'
        assert post['workerSha256']==sha(S/'worker.cjs') and post['launcherSha256']==sha(S/'launch.py'), 'DEPLOYED_WORKER_DRIFT'
        retained_business(m); pm(['save'])
    except Exception:
        # Never retry a failed migration or worker delivery. Restore executable artifacts only.
        rollback(m)
        raise
    prepared.rmdir(); run(['systemctl','start',TIMER])
    report={'deployment':'PASS','migration':'PASS','buildId':m['build_id'],'migrationCount':m['after_migrations']['count'],'artifacts':len(m['application_files']),'futureEnrollmentEnabled':False,'enrollments':0,'managedCampaigns':0,'retainedCampaigns':3,'milankLimit':12,'milankDispatches':0,'timer':'RESTORED_EXISTING_APPROVED_SCOPE','workerExecutedByInstaller':False,'newRecipients':0,'emailsSentByInstaller':0,'inboxReceipt':'NOT_CLAIMED','rollbackCommand':'python3 -I -B '+str(S/'enrollment-install.py')+' '+sys.argv[1]+' rollback'}
    (R/'report.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2))

if __name__=='__main__': execute(main)
