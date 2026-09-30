"""Pinned additive migration and application/worker deployment. No fixtures or sending approval."""
from common import A, S, R, P, sha, regular, run, identity, sql, scope, pm, monitor, execute, copy_prisma_runtime
import hashlib, json, os, pathlib, pwd, re, subprocess, sys, tarfile, time, urllib.parse

MIGRATION = '20260930200000_subscription_reminders'
CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
WORKER = P('/usr/local/libexec/passvero-subscription-reminders')

def create_worker_directory():
    WORKER.mkdir(mode=0o755)
    WORKER.chmod(0o755)  # mkdir mode is filtered by the operator umask 0077.

def migrate(m):
    scope()
    assert (A/'.next/BUILD_ID').read_text().strip() == m['previous_build'], 'BUILD_DRIFT'
    history = json.loads(sql("SELECT json_build_object('count',count(*),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name)),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL)) FROM _prisma_migrations"))
    assert history == m['prior_migrations'], 'MIGRATION_HISTORY_DRIFT'
    assert sql("SELECT NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls FROM pg_roles WHERE rolname='passvero_app'") == 't', 'RUNTIME_ROLE_SCOPE'
    for table in ['AuditLog', 'AuthAuditEvent']:
        for right in ['SELECT','INSERT']:
            assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','"+right+"')") == 't', 'EXISTING_AUDIT_ACL_REQUIRED'
    assert not (R/'migration').exists(), 'DO_NOT_RETRY'
    package = json.loads((S/'migration-package.json').read_text())
    assert package['latest'] == MIGRATION
    work = R/'migration-work'; work.mkdir(parents=True, mode=0o755); os.chmod(R,0o755); os.chmod(work,0o755)
    for name, info in package['files'].items():
        assert name in ('schema.prisma','migrations/migration_lock.toml') or re.fullmatch(r'migrations/[a-zA-Z0-9_]+/migration.sql',name), 'MIGRATION_PATH'
        data=info['content'].encode(); assert hashlib.sha256(data).hexdigest()==info['sha256'], 'MIGRATION_HASH'
        p=work/name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data); p.chmod(0o644)
        parent=p.parent
        while parent != work: parent.chmod(0o755); parent=parent.parent
    copy_prisma_runtime(A/'node_modules',work/'node_modules')
    config=work/'prisma.config.ts'
    config.write_text('export default {schema:"./schema.prisma",migrations:{path:"./migrations"},datasource:{url:process.env.OPERATOR_MIGRATION_URL}};'); config.chmod(0o644)
    kw=identity('postgres'); kw['cwd']=str(work)
    kw['env']['OPERATOR_MIGRATION_URL']='postgresql://postgres@localhost:5433/passvero_acceptance?'+urllib.parse.urlencode({'host':'/var/run/postgresql','options':'-c role=passvero_migrator -c lock_timeout=5000 -c statement_timeout=30000'})
    kw['env']['PRISMA_HIDE_UPDATE_MESSAGE']='1'
    cli=['/usr/bin/node',str(work/'node_modules/prisma/build/index.js'),'migrate']
    check=subprocess.run(cli+['status','--config',str(config)],capture_output=True,text=True,timeout=45,**kw)
    assert check.returncode==1 and MIGRATION in check.stdout+check.stderr, 'EXPECTED_PENDING_MIGRATION'
    state=R/'migration'; state.mkdir(); (state/'attempt.json').write_text(json.dumps({'manifest':sys.argv[1]}))
    run(cli+['deploy','--config',str(config)],timeout=120,**kw)
    # Only the four newly introduced tables. Runtime cannot create/expand approvals.
    sql('BEGIN; SET LOCAL lock_timeout=\'5s\'; REVOKE ALL ON "ReminderCampaign","SubscriptionReminder","ReminderAttempt","BillingEmailConfirmation" FROM PUBLIC,passvero_app; '+(S/'runtime-acl.sql').read_text()+' COMMIT;')
    expected={'ReminderCampaign':['SELECT'],'SubscriptionReminder':['SELECT','INSERT','UPDATE'],'ReminderAttempt':['SELECT','INSERT','UPDATE'],'BillingEmailConfirmation':['SELECT','INSERT','UPDATE']}
    for table, allowed in expected.items():
        assert sql("SELECT pg_get_userbyid(relowner) FROM pg_class WHERE oid='public.\""+table+"\"'::regclass")=='passvero_migrator','NEW_TABLE_OWNER'
        for right in ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']:
            assert sql("SELECT has_table_privilege('passvero_app','public.\""+table+"\"','"+right+"')")==('t' if right in allowed else 'f'),'RUNTIME_ACL'
    for column in ['enabled','maxDispatches','organizationIds','recipientEmails','operatorEmails','messageKinds','expiresAt']:
        assert sql("SELECT has_column_privilege('passvero_app','public.\"ReminderCampaign\"','"+column+"','UPDATE')")=='f','APPROVAL_WRITE_FORBIDDEN'
    assert sql('SELECT count(*) FROM "ReminderCampaign"')=='0','NO_SENDING_APPROVAL_EXPECTED'
    after=json.loads(sql("SELECT json_build_object('count',count(*),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name)),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL)) FROM _prisma_migrations"))
    assert after==m['after_migrations'],'POST_MIGRATION_HISTORY'
    run(cli+['status','--config',str(config)],**kw)
    (state/'report.json').write_text(json.dumps({'migration':'PASS','manifest':sys.argv[1],'emailSent':False}))

def deploy(m):
    scope(); assert sql('SELECT count(*) FROM "ReminderCampaign"')=='0','NO_SENDING_APPROVAL_EXPECTED'
    regular(CANONICAL); old_manifest=CANONICAL.read_bytes(); prior=json.loads(old_manifest)
    assert prior['build_id']==m['previous_build'] and (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'],'BUILD_DRIFT'
    before=monitor(); assert before['status']=='online','APP_NOT_ONLINE'
    state=R/'application'; assert not state.exists(),'DO_NOT_RETRY'
    prepared=A/'.reminders-prepared'; assert not prepared.exists(); prepared.mkdir(mode=0o750)
    account=pwd.getpwnam('passvero-staging')
    with tarfile.open(S/'application.tar.gz') as archive:
        entries=archive.getmembers()
        assert len(entries)==len(m['application_files']) and {e.name for e in entries}==set(m['application_files']),'ARCHIVE_INVENTORY'
        for entry in entries:
            assert entry.isfile() and entry.name.startswith(('.next/','messages/')) and '..' not in P(entry.name).parts and not P(entry.name).is_absolute(),'ARCHIVE_PATH'
            data=archive.extractfile(entry).read(); assert hashlib.sha256(data).hexdigest()==m['application_files'][entry.name],'ARTIFACT_HASH'
            p=prepared/entry.name; p.parent.mkdir(parents=True,exist_ok=True); p.write_bytes(data); p.chmod(0o640); os.chown(p,account.pw_uid,account.pw_gid)
            parent=p.parent
            while parent != prepared: parent.chmod(0o750); os.chown(parent,account.pw_uid,account.pw_gid); parent=parent.parent
    for name in ['.next','messages']:
        assert (A/name).is_dir() and not (A/name).is_symlink() and not (A/(name+'.before-reminders')).exists(),'ARTIFACT_SCOPE'
    assert not WORKER.exists(),'WORKER_ALREADY_INSTALLED'
    for name in ['passvero-subscription-reminders.service','passvero-subscription-reminders.timer']:
        assert not P('/etc/systemd/system',name).exists(),'UNIT_ALREADY_INSTALLED'
    assert monitor()==before,'APP_CHANGED'
    state.mkdir(); (state/'previous-runtime-manifest.json').write_bytes(old_manifest)
    (state/'state.json').write_text(json.dumps({'manifest':sys.argv[1],'old_build':m['previous_build']}))
    pm(['stop','passvero-acceptance'])
    for name in ['.next','messages']: (A/name).rename(A/(name+'.before-reminders')); (prepared/name).rename(A/name)
    updated=dict(prior); updated['build_id']=m['build_id']; updated['files']={n:v for n,v in prior['files'].items() if not n.startswith(('.next/','messages/'))}
    updated['files'].update({n:{'sha256':h,'bytes':(A/n).stat().st_size} for n,h in m['application_files'].items()}); updated['reminders_manifest_sha256']=sys.argv[1]
    candidate=CANONICAL.with_name('manifest.reminders-candidate.json'); candidate.write_text(json.dumps(updated,indent=2)); candidate.chmod(0o600); os.replace(candidate,CANONICAL)
    pm(['restart','passvero-acceptance'])
    deadline=time.monotonic()+45; healthy=False
    while time.monotonic()<deadline:
        response=subprocess.run(['curl','--max-time','3','-sS','-L','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/request-access'],capture_output=True,text=True)
        if response.returncode==0 and response.stdout=='200 0': healthy=True; break
        time.sleep(1)
    assert healthy,'HTTPS_NOT_READY'
    response=run(['curl','--max-time','10','-sS','-D','-','-o','/dev/null','-w','\nSTATUS=%{http_code} TLS=%{ssl_verify_result}','https://staging.passvero.eu/platform/billing/deliveries'])
    assert ('STATUS=404 TLS=0' in response or 'STATUS=307 TLS=0' in response) and 'private' in response.lower() and 'no-store' in response.lower(),'ANONYMOUS_BOUNDARY'
    for name,h in m['application_files'].items(): assert sha(A/name)==h,'DEPLOYED_HASH'
    after=monitor(); assert after['status']=='online' and after['pid']!=before['pid'],'APP_RESTART'
    create_worker_directory()
    for name in ['worker.cjs','launch.py']:
        (WORKER/name).write_bytes((S/name).read_bytes()); (WORKER/name).chmod(0o644)
    run(['/usr/bin/node','--check',str(WORKER/'worker.cjs')])
    for name in ['passvero-subscription-reminders.service','passvero-subscription-reminders.timer']:
        target=P('/etc/systemd/system',name); target.write_bytes((S/name).read_bytes()); target.chmod(0o644)
    run(['systemd-analyze','verify','/etc/systemd/system/passvero-subscription-reminders.service','/etc/systemd/system/passvero-subscription-reminders.timer'])
    run(['systemctl','daemon-reload'])
    for command in ['is-enabled','is-active']:
        result=subprocess.run(['systemctl',command,'passvero-subscription-reminders.timer'],capture_output=True,text=True,timeout=10)
        assert result.returncode!=0,'TIMER_MUST_REMAIN_DISABLED'
    assert sql('SELECT count(*) FROM "ReminderCampaign"')=='0','SENDING_SCOPE_CHANGED'
    pm(['save']); prepared.rmdir()
    (state/'report.json').write_text(json.dumps({'deployment':'PASS','manifest':sys.argv[1],'build':m['build_id'],'timerEnabled':False,'campaigns':0,'emailSent':False}))
    print('STAGING_REMINDERS_MIGRATION_AND_DEPLOY=PASS; TIMER_ENABLED=NO; CAMPAIGNS=0; EMAIL_SENT=NO; INBOX_RECEIPT=NOT_PROVEN')

def main(m):
    migrate(m)
    deploy(m)

if __name__=='__main__': execute(main)
