# Subscription reminder staging operator runbook

Current status: APPROVED_STAGING_DEMONSTRATION_COMPLETE; NO_PENDING_OPERATOR_COMMAND.
Four provider accepts and four user-confirmed receipts, renewal cancellation2, replay0,
and one successful real timer-triggered IDLE cycle are retained in evidence.
Final timer disabled/inactive, campaigns disabled/exhausted2/2; database unchanged by scheduler.
Do not repeat any block below. All are historical executed handoffs retained for review.
Scheduler result: operator-scheduler-acceptance.json. Receipt DB attestation remains unrecorded.
Bounded authorized Chrome desktop/mobile delivery UI review PASS on 2026-10-01;
see browser-ui-review.json. Prior unrelated NOT_PROVEN boundaries remain separate.

## VPS TERMINAL — complete read-only block

```bash
sudo python3 - <<'PY_PREFLIGHT'
"""Operator-only staging preflight. Read-only DB/files/service state; no credentials or emails sent."""
import hashlib, json, os, pathlib, pwd, subprocess, sys
A = pathlib.Path('/var/www/passvero-acceptance')
try:
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_HOST'
    pg = pwd.getpwnam('postgres')
    def sql(query):
        result = subprocess.run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql', '-p', '5433', '-d', 'passvero_acceptance', '-v', 'ON_ERROR_STOP=1', '-c', "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; " + query + '; ROLLBACK;'], user=pg.pw_uid, group=pg.pw_gid, extra_groups=[], cwd='/', env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}, capture_output=True, text=True, timeout=15)
        assert result.returncode == 0, 'READ_ONLY_QUERY_FAILED'
        return json.loads(result.stdout.strip())
    database = sql("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'directory',current_setting('data_directory'))")
    assert database == {'database': 'passvero_acceptance', 'port': '5433', 'directory': '/var/lib/postgresql/16/acceptance'}, 'DATABASE_SCOPE'
    migrations = sql("SELECT json_build_object('count',count(*),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name)),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL)) FROM _prisma_migrations")
    assert migrations == {'count': 30, 'digest': '8840cc1de88a64a1049bac4725d84805', 'finished': True}, 'MIGRATION_DRIFT'
    accounts = sql('''SELECT json_agg(x ORDER BY email) FROM (SELECT u.id,u.email,
      (SELECT count(*) FROM "AuthIdentity" i JOIN "AuthProviderUser" p ON p.id=i."providerSubject" WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL AND p."emailVerified" AND p.email=u.email)=1 AS verified,
      EXISTS(SELECT 1 FROM "PlatformBillingGrant" g WHERE g."userId"=u.id AND g."revokedAt" IS NULL) AS billing_grant
      FROM "User" u WHERE u.email IN ('prodaja@zivic-elektro.com','zivic.darko79@gmail.com')) x''')
    def digest(path):
        assert path.is_file() and not path.is_symlink(), 'EXPECTED_REGULAR_FILE'
        return hashlib.sha256(path.read_bytes()).hexdigest()
    dependencies = {name: digest(A / 'node_modules' / name / 'package.json') for name in ['next','react','react-dom','next-intl','@prisma/client','@prisma/adapter-pg','@better-auth/prisma-adapter','better-auth','pg','nodemailer','zod','prisma']}
    timers = subprocess.run(['systemctl', 'list-timers', '--all', '--no-pager', '--no-legend', 'passvero-*'], capture_output=True, text=True, timeout=10)
    assert timers.returncode == 0, 'TIMER_INVENTORY_FAILED'
    appuser = pwd.getpwnam('passvero-staging')
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    result = subprocess.run(['/usr/bin/node','-e',probe], user=appuser.pw_uid, group=appuser.pw_gid, extra_groups=os.getgrouplist(appuser.pw_name, appuser.pw_gid), cwd='/', env={'PATH':'/usr/bin:/bin'}, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, 'PM2_READ_FAILED'
    processes = json.loads(result.stdout)
    assert len(processes) == 1 and processes[0]['name'] == 'passvero-acceptance' and processes[0]['cwd'] == str(A) and processes[0]['status'] == 'online', 'APP_SCOPE'
    worker_installed = pathlib.Path('/etc/systemd/system/passvero-subscription-reminders.timer').exists()
    print(json.dumps({'preflight':'PASS','database':database,'migrations':migrations,'utcNow':sql("SELECT to_json(clock_timestamp())"),'buildId':(A/'.next/BUILD_ID').read_text().strip(),'packageHash':digest(A/'package.json'),'lockHash':digest(A/'package-lock.json'),'retainedOperatorHash':digest(A/'.controlled-onboarding/review-access-requests.mjs'),'runtimeDependencies':dependencies,'accounts':accounts,'processes':processes,'timers':timers.stdout.strip(),'reminderTimerInstalled':worker_installed,'writes':'NONE','emailSent':False},indent=2))
except Exception as error:
    print(json.dumps({'preflight':'STOP','reason':str(error) if isinstance(error,AssertionError) else 'READ_ONLY_PREFLIGHT_FAILED','writes':'NONE','emailSent':False}))
    sys.exit(1)
PY_PREFLIGHT
```

Expected sanitized result: `preflight=PASS`, database `passvero_acceptance`, port `5433`,
30 matching completed baseline migrations, the current build identifier, two candidate account
records with verification/billing-grant booleans, dependency hashes and timer inventory;
`writes=NONE`, `emailSent=false`. A STOP is not permission to repair or rerun mutations.
Return the complete JSON output. No passwords or environment values are requested.

## Subsequent gates

1. Preflight and local runtime compatibility comparison PASS; pinned deploy package prepared.
2. Operator applies additive migration/runtime ACL and deploys reviewed artifacts below. Keep sending disabled.
3. Obtain one explicit approval of delivery-proposal.json, including exact new fixture IDs/names,
   recipient addresses, operator list, message types and maximum four SMTP dispatches.
4. Only approved synthetic fixtures/campaigns are provisioned. Manual `enqueue` can prove stale renewal
   cancellation without calling the provider. `run` and `scheduled` share the same persisted budget.
5. Confirm provider acceptance and actual inbox receipt separately. Record actual fixture/campaign IDs,
   timer state/last success, remaining budgets and rollback artifacts in the acceptance report.

Prepared source: `scripts/subscription-reminder-worker.ts`, `scripts/subscription-reminders/launch.py`,
`passvero-subscription-reminders.service`, `passvero-subscription-reminders.timer`, `runtime-acl.sql`.
Local bundler: `node scripts/prepare-reminder-worker.mjs /private/tmp/<new-output-directory>`.
Installing or enabling a timer is intentionally absent from this preflight block.

Rollback ordering: disable the dedicated timer/campaigns, account for in-flight/unknown sends, then
restore pinned previous application/worker artifacts. Preserve schema, audit, outbox and fixtures.
Production, existing commercial periods, actual payments, backups and automatic deletion are excluded.

## Current LOCAL MAC TERMINAL — verified package upload

```bash
python3 - <<'PY_UPLOAD'
import hashlib, pathlib, subprocess
p=pathlib.Path('/private/tmp/passvero-reminders-deploy-20260930-v2.tar.gz')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='95847a809095414fda5ef3de94d3a56e9e07f56f0219c60798208eb80cd3fd47', 'PACKAGE_HASH_MISMATCH'
subprocess.run(['scp',str(p),'passvero:/tmp/'+p.name],check=True)
print('STAGING_PACKAGE_UPLOAD=PASS')
PY_UPLOAD
```

Expected: `STAGING_PACKAGE_UPLOAD=PASS`. The configured `passvero` SSH alias is darko@passvero.eu.

## Current VPS TERMINAL — pinned additive migration and deploy

```bash
sudo python3 - <<'PY_INSTALL'
import hashlib, io, json, os, pathlib, subprocess, sys, tarfile
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    p=pathlib.Path('/tmp/passvero-reminders-deploy-20260930-v2.tar.gz')
    assert p.is_file() and not p.is_symlink(),'PACKAGE_FILE_REQUIRED'
    data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()=='95847a809095414fda5ef3de94d3a56e9e07f56f0219c60798208eb80cd3fd47','PACKAGE_HASH_MISMATCH'
    pin='1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        entries=archive.getmembers()
        assert 1<len(entries)<=20 and len({e.name for e in entries})==len(entries),'PACKAGE_INVENTORY'
        assert all(e.isfile() and '/' not in e.name and e.name not in ('.','..') for e in entries),'PACKAGE_PATH'
        assert sum(e.size for e in entries)<=100*1024*1024,'PACKAGE_SIZE'
        files={e.name:archive.extractfile(e).read() for e in entries}
    assert hashlib.sha256(files['manifest.json']).hexdigest()==pin,'MANIFEST_HASH'
    manifest=json.loads(files['manifest.json'])
    assert set(files)==set(manifest['package_files'])|{'manifest.json'},'MANIFEST_INVENTORY'
    assert all(hashlib.sha256(files[n]).hexdigest()==h for n,h in manifest['package_files'].items()),'PACKAGE_CONTENT_HASH'
    dest=pathlib.Path('/var/lib/passvero-subscription-reminders-package-v2')
    assert not dest.exists() and not dest.is_symlink(),'DO_NOT_RETRY_EXISTING_PACKAGE'
    dest.mkdir(mode=0o700)
    for name,content in files.items():
        target=dest/name; target.write_bytes(content); target.chmod(0o600)
    result=subprocess.run(['/usr/bin/python3',str(dest/'install.py'),pin],capture_output=True,text=True,timeout=420)
    print(result.stdout.strip())
    if result.returncode:print('OPERATOR_INSTALL=STOP; MANUAL_REVIEW_REQUIRED; DO_NOT_RERUN')
    sys.exit(result.returncode)
except Exception as error:
    print(json.dumps({'result':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_INSTALL
```

Expected sanitized output:

```text
STAGING_REMINDERS_MIGRATION_AND_DEPLOY=PASS; TIMER_ENABLED=NO; CAMPAIGNS=0; EMAIL_SENT=NO; INBOX_RECEIPT=NOT_PROVEN
```

PENDING_OPERATOR_COMMAND. Return the full sanitized output; a STOP requires review, not a blind rerun.
This package installs four additive tables and narrow runtime ACL, replaces only `.next`/`messages`,
updates the existing canonical artifact manifest, restarts only passvero-acceptance, verifies HTTPS,
and installs the worker/systemd files without enabling the timer. It creates no fixture or campaign.
Existing runtime package metadata and dependencies stay hash-pinned; the two newer dependency-free
libraries (bwip-js/csv-parse) are verified to be bundled and absent from external runtime traces.

Rollback implementation is included as `rollback.py` in the root-owned package, but is not invoked
by installation. It verifies current deployment identity and prior artifact hashes, handles partial
swaps and absent units, and preserves schema/history. Six isolated mocked scenarios passed; live
rollback remains NOT_PROVEN. Do not execute rollback concurrently with an active installer or worker.

## Exact sending scope (subsequently explicitly approved)

See `codex/evidence/subscription-reminders/delivery-proposal.json` for all exact UUIDs, names, dates,
recipients, two campaign limits and the sequence. Three new synthetic organizations; two recipients
only: OWNER prodaja@zivic-elektro.com and sole billing operator zivic.darko79@gmail.com.
Trial threshold 1: one email each; VOLUNTARY public threshold 1: one each; renewal cancellation: zero.
Maximum four SMTP dispatches total, shared across manual/replay/scheduled calls; retries consume
this budget. Proposed approval expires 2026-10-01 11:00 Europe/Zagreb. If expired, re-propose dates
and scope; do not silently shift fixtures or extend approval. No existing period is changed.
BillingEmail is not separately used in this demonstration. The two proposed business rules are
latest due threshold only after downtime, and audited operator attestation of independently verified
billing-address ownership bound to exact address/profile revision. Approval was not inferred from preflight; it was subsequently given explicitly by the user.

## Approved acceptance — current handoff

User returned deployment PASS and explicitly approved the exact proposal together with both
business rules. The proposal remains bounded to its original dates, organizations and recipients.
Run before 2026-10-01 10:45 Europe/Zagreb (15-minute execution reserve before approval expiry11:00).
Expected runtime is normally short; the actual timer-cycle observation allows up to six minutes.
Do not rerun on STOP. Return full sanitized output and separate inbox confirmation per recipient.

LOCAL MAC TERMINAL:

```bash
python3 - <<'PY_UPLOAD'
import hashlib, pathlib, subprocess
p=pathlib.Path('/private/tmp/passvero-reminders-acceptance-20260930.tar.gz')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='705e831b0d086aac7e6eb7bebf05a20709eac770a3e8771ed98a56fc919b3221', 'PACKAGE_HASH_MISMATCH'
subprocess.run(['scp',str(p),'passvero:/tmp/'+p.name],check=True)
print('APPROVED_ACCEPTANCE_PACKAGE_UPLOAD=PASS')
PY_UPLOAD
```

VPS TERMINAL:

```bash
sudo python3 - <<'PY_ACCEPTANCE'
import hashlib, io, json, os, pathlib, subprocess, sys, tarfile
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    p=pathlib.Path('/tmp/passvero-reminders-acceptance-20260930.tar.gz')
    assert p.is_file() and not p.is_symlink(),'PACKAGE_FILE_REQUIRED'
    data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()=='705e831b0d086aac7e6eb7bebf05a20709eac770a3e8771ed98a56fc919b3221','PACKAGE_HASH_MISMATCH'
    pin='1da0601584c8228acb12dde447fe690c876b32ed808573c640f2eb6d6cd778c3'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        entries=archive.getmembers()
        assert 1<len(entries)<=10 and len({e.name for e in entries})==len(entries),'PACKAGE_INVENTORY'
        assert all(e.isfile() and '/' not in e.name and e.name not in ('.','..') for e in entries),'PACKAGE_PATH'
        assert sum(e.size for e in entries)<=25*1024*1024,'PACKAGE_SIZE'
        files={e.name:archive.extractfile(e).read() for e in entries}
    assert hashlib.sha256(files['manifest.json']).hexdigest()==pin,'MANIFEST_HASH'
    manifest=json.loads(files['manifest.json'])
    assert set(files)==set(manifest['package_files'])|{'manifest.json'},'MANIFEST_INVENTORY'
    assert all(hashlib.sha256(files[n]).hexdigest()==h for n,h in manifest['package_files'].items()),'PACKAGE_CONTENT_HASH'
    dest=pathlib.Path('/var/lib/passvero-subscription-reminders-acceptance-package')
    assert not dest.exists() and not dest.is_symlink(),'DO_NOT_RETRY_EXISTING_PACKAGE'
    dest.mkdir(mode=0o700)
    for name,content in files.items():
        target=dest/name; target.write_bytes(content); target.chmod(0o600)
    result=subprocess.run(['/usr/bin/python3',str(dest/'acceptance.py'),pin],timeout=1000)
    if result.returncode:print('APPROVED_ACCEPTANCE=STOP; MANUAL_REVIEW_REQUIRED; DO_NOT_RERUN')
    sys.exit(result.returncode)
except Exception as error:
    print(json.dumps({'result':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_ACCEPTANCE
```

Expected successful result: `acceptance=PASS_PROVIDER_AND_SCHEDULER`,
`renewalCancelled=2`, `replayAdditionalDispatches=0`, `actualSmtpDispatches=4`,
`providerAccepted=4`, `inboxReceipt=NOT_PROVEN`, actual timer trigger/service timestamps,
closure timer disabled/inactive, campaignsEnabled0, errors[]. Exact retained fixture,
period, product, version, passport and delivery IDs are emitted and retained under
`/var/lib/passvero-subscription-reminders/acceptance/`. No raw provider output or credentials.

PENDING_OPERATOR_COMMAND. On any uncertain/failed SMTP result, the script stops further
phases and attempts to close both delivery gates independently; no automatic rerun, budget
reset or UNKNOWN resend. Retain the report and review the named phase.

Local verification: all31 migrations and the new disposable fixture sequence PASS with
in-memory mock transport; public resolver PUBLIC; three isolated closure tests PASS;
TypeScript/scoped lint and package hashes PASS. These are not live SMTP/inbox proofs.

## Current VPS TERMINAL — read-only create-failure diagnosis

Hypothesis: unlike the previous successful operator process, the new fixture child lacks the
staging supplementary group needed to read node_modules. Compare both identities using only
module imports and read-only SQL; never execute acceptance.cjs, create fixtures or call SMTP.

```bash
sudo python3 - <<'PY_DIAGNOSE'
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
PY_DIAGNOSE
```

Expected: diagnostic READ_ONLY_COMPLETE, exact scoped counts, verified-identity/grant booleans,
module-load results under both identities, writes NONE, fixtureBundleExecuted false, smtpCalls0.
A differential currentIdentity MODULE_NOT_FOUND/EACCES versus withStagingGroup PASS confirms
the access hypothesis. Otherwise inspect the returned evidence before selecting a fix.
PENDING_OPERATOR_COMMAND. Return the whole sanitized JSON. No state reset or retry.

## Current guarded continuation — 2026-10-01

Root cause confirmed by returned diagnostic: postgres can read the fixture bundle but cannot
load app dependencies without the staging supplementary group. All fixture, campaign, outbox
and attempt counts are zero. No SMTP occurred. The corrected child uses the established
previous operator pattern, without altering user/group membership or filesystem permissions.
Seven focused Python tests PASS; bundle/common/approval/source manifest are byte-identical
to the prior package. No unchanged application build or PostgreSQL suite rerun required.

This continuation preserves the original package and failed attempt. It verifies the original
manifest/closure and fresh zero counts before creating v2 state. A nonempty state stops for
review; it never resets a budget or retries a delivery. Original approval remains valid only
until2026-10-01 11:00 Europe/Zagreb; execute before10:45.

LOCAL MAC TERMINAL:

```bash
python3 - <<'PY_UPLOAD'
import hashlib, pathlib, subprocess
p=pathlib.Path('/private/tmp/passvero-reminders-acceptance-20261001-v2.tar.gz')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='1a0496056ee57ac650fd7bb7b05ad500190f928992c1486008d7413c05b2618f', 'PACKAGE_HASH_MISMATCH'
subprocess.run(['scp',str(p),'passvero:/tmp/'+p.name],check=True)
print('APPROVED_ACCEPTANCE_PACKAGE_UPLOAD=PASS')
PY_UPLOAD
```

VPS TERMINAL:

```bash
sudo python3 - <<'PY_ACCEPTANCE'
import hashlib, io, json, os, pathlib, subprocess, sys, tarfile
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    p=pathlib.Path('/tmp/passvero-reminders-acceptance-20261001-v2.tar.gz')
    assert p.is_file() and not p.is_symlink(),'PACKAGE_FILE_REQUIRED'
    data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()=='1a0496056ee57ac650fd7bb7b05ad500190f928992c1486008d7413c05b2618f','PACKAGE_HASH_MISMATCH'
    pin='3fbd3c8a65ce296d5d6450ec97f936e73f6095fce1a23de3f2d71adc3f0913f6'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        entries=archive.getmembers()
        assert 1<len(entries)<=10 and len({e.name for e in entries})==len(entries),'PACKAGE_INVENTORY'
        assert all(e.isfile() and '/' not in e.name and e.name not in ('.','..') for e in entries),'PACKAGE_PATH'
        assert sum(e.size for e in entries)<=25*1024*1024,'PACKAGE_SIZE'
        files={e.name:archive.extractfile(e).read() for e in entries}
    assert hashlib.sha256(files['manifest.json']).hexdigest()==pin,'MANIFEST_HASH'
    manifest=json.loads(files['manifest.json'])
    assert set(files)==set(manifest['package_files'])|{'manifest.json'},'MANIFEST_INVENTORY'
    assert all(hashlib.sha256(files[n]).hexdigest()==h for n,h in manifest['package_files'].items()),'PACKAGE_CONTENT_HASH'
    dest=pathlib.Path('/var/lib/passvero-subscription-reminders-acceptance-package-v2')
    assert not dest.exists() and not dest.is_symlink(),'DO_NOT_RETRY_EXISTING_PACKAGE'
    dest.mkdir(mode=0o700)
    for name,content in files.items():
        target=dest/name; target.write_bytes(content); target.chmod(0o600)
    result=subprocess.run(['/usr/bin/python3',str(dest/'acceptance.py'),pin],timeout=1000)
    if result.returncode:print('APPROVED_ACCEPTANCE=STOP; MANUAL_REVIEW_REQUIRED; DO_NOT_RERUN')
    sys.exit(result.returncode)
except Exception as error:
    print(json.dumps({'result':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_ACCEPTANCE
```

Expected: acceptance PASS_PROVIDER_AND_SCHEDULER, cancelled2, replay additional dispatches0,
provider accepted4, actual SMTP dispatches4, inbox NOT_PROVEN; closure timer disabled/inactive,
campaignsEnabled0, errors[]. New evidence is retained at
`/var/lib/passvero-subscription-reminders/acceptance-v2/`; prior acceptance evidence remains intact.
PENDING_OPERATOR_COMMAND. Return the complete sanitized output and separate inbox confirmation.
Do not repeat any acceptance block after STOP.

## Current VPS TERMINAL — read-only worker diagnosis

```bash
sudo python3 - <<'PY_WORKER_DIAG'
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
PY_WORKER_DIAG
```

Expected READ_ONLY_COMPLETE, campaign counters and current outbox/attempt inventory,
required environment-key presence booleans, exact staging marker booleans, library load
results under the real runtime UID, read/write ACL booleans and retained fixture IDs.
No credential values, environment-file reads, worker execution or SMTP.
PENDING_OPERATOR_COMMAND. Return full sanitized JSON. Do not recreate the existing fixtures.

## Current VPS TERMINAL — scoped worker directory repair

The installer runs under umask0077, so its mkdir(mode0755) created the code directory0700.
A local regression reproduces this and passes after explicit chmod0755. The block below
requires exactly root-owned0700 with original pinned nonsecret worker/launcher files, changes
only that directory mode, and runs library imports under the runtime UID. It then exercises
enqueue against a verified disabled campaign (no writes/provider calls), and confirms counters
are unchanged. It does not enable campaigns, recreate fixtures, alter env files or reset history.

```bash
sudo python3 - <<'PY_WORKER_REPAIR'
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
PY_WORKER_REPAIR
```

Expected repair WORKER_DIRECTORY_0700_TO_0755_PASS, workerLibraries PASS,
disabledCampaignEnqueue PASS, campaigns2/enabled0/dispatches0/outbox0/attempts0, smtpCalls0.
PENDING_OPERATOR_COMMAND. Return complete sanitized output. On STOP do not repeat.
After PASS, prepare guarded continuation of the existing fixtures under the original approval.

## Historical handoff — v3 retained-fixture continuation (executed; DO NOT RERUN)

The original exact sending scope remains approved. This package reuses all three existing
fixtures, checks zero prior attempts and dispatches, proves renewal cancellation, sends at
most four messages to the original two recipients, checks replay and one real timer cycle,
then closes timer/campaigns independently. Prior attempt evidence is retained.
The renewal fixture receives a new approved simulated period; existing periods remain intact.
On STOP return the sanitized output for manual review; do not rerun.

### LOCAL MAC TERMINAL

```bash
python3 - <<'PY_UPLOAD'
import hashlib, pathlib, subprocess
p=pathlib.Path('/private/tmp/passvero-reminders-acceptance-20261001-v3.tar.gz')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='f52c34d4b50c5e163e948a6de4e24c0bbc7cf5ba93b14170b1df4dae28471e08', 'PACKAGE_HASH_MISMATCH'
subprocess.run(['scp',str(p),'passvero:/tmp/'+p.name],check=True)
print('APPROVED_ACCEPTANCE_PACKAGE_UPLOAD=PASS')
PY_UPLOAD
```

### VPS TERMINAL

```bash
sudo python3 - <<'PY_ACCEPTANCE'
import hashlib, io, json, os, pathlib, subprocess, sys, tarfile
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    p=pathlib.Path('/tmp/passvero-reminders-acceptance-20261001-v3.tar.gz')
    assert p.is_file() and not p.is_symlink(),'PACKAGE_FILE_REQUIRED'
    data=p.read_bytes()
    assert hashlib.sha256(data).hexdigest()=='f52c34d4b50c5e163e948a6de4e24c0bbc7cf5ba93b14170b1df4dae28471e08','PACKAGE_HASH_MISMATCH'
    pin='94de46dc9668485c75c3b47058093acf77c436213ae47ea59fd454648b6da2fb'
    with tarfile.open(fileobj=io.BytesIO(data),mode='r:gz') as archive:
        entries=archive.getmembers()
        assert 1<len(entries)<=10 and len({e.name for e in entries})==len(entries),'PACKAGE_INVENTORY'
        assert all(e.isfile() and '/' not in e.name and e.name not in ('.','..') for e in entries),'PACKAGE_PATH'
        assert sum(e.size for e in entries)<=25*1024*1024,'PACKAGE_SIZE'
        files={e.name:archive.extractfile(e).read() for e in entries}
    assert hashlib.sha256(files['manifest.json']).hexdigest()==pin,'MANIFEST_HASH'
    manifest=json.loads(files['manifest.json'])
    assert set(files)==set(manifest['package_files'])|{'manifest.json'},'MANIFEST_INVENTORY'
    assert all(hashlib.sha256(files[n]).hexdigest()==h for n,h in manifest['package_files'].items()),'PACKAGE_CONTENT_HASH'
    dest=pathlib.Path('/var/lib/passvero-subscription-reminders-acceptance-package-v3')
    assert not dest.exists() and not dest.is_symlink(),'DO_NOT_RETRY_EXISTING_PACKAGE'
    dest.mkdir(mode=0o700)
    for name,content in files.items():
        target=dest/name; target.write_bytes(content); target.chmod(0o600)
    result=subprocess.run(['/usr/bin/python3',str(dest/'acceptance.py'),pin],timeout=1000)
    if result.returncode:print('APPROVED_ACCEPTANCE=STOP; MANUAL_REVIEW_REQUIRED; DO_NOT_RERUN')
    sys.exit(result.returncode)
except Exception as error:
    print(json.dumps({'result':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_ACCEPTANCE
```

Expected: EXISTING_SYNTHETIC_FIXTURES=REUSED; acceptance PASS_PROVIDER_AND_SCHEDULER;
renewalCancelled2; replayAdditionalDispatches0; actualSmtpDispatches4; providerAccepted4;
inboxReceipt NOT_PROVEN; closure timer disabled/inactive, campaignsEnabled0, errors[].
PENDING_OPERATOR_COMMAND. Return the complete sanitized output. Inbox confirmation remains
a separate observation for both approved addresses; do not infer it from SMTP acceptance.

## Historical handoff — read-only timer diagnosis (completed)

VPS TERMINAL. Reads selected timer/service properties, saved v3 evidence and staging delivery
counts only. No worker execution, timer changes, campaign changes or SMTP calls.

```bash
sudo python3 - <<'PY_TIMER_DIAG'
import hashlib, json, os, pathlib, stat, subprocess, sys
sys.dont_write_bytecode=True
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    package=pathlib.Path('/var/lib/passvero-subscription-reminders-acceptance-package-v3')
    pin='94de46dc9668485c75c3b47058093acf77c436213ae47ea59fd454648b6da2fb'
    for p in [package,*package.parents]:
        info=p.lstat()
        assert stat.S_ISDIR(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_DIRECTORY'
    def read_safe(p):
        info=p.lstat()
        assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'EVIDENCE_FILE'
        return p.read_bytes()
    raw=read_safe(package/'manifest.json')
    assert hashlib.sha256(raw).hexdigest()==pin,'MANIFEST_HASH'
    manifest=json.loads(raw)
    assert hashlib.sha256(read_safe(package/'common.py')).hexdigest()==manifest['package_files']['common.py'],'COMMON_HASH'
    sys.path.insert(0,str(package));sys.argv=[sys.argv[0],pin]
    import common
    common.verify();common.scope()
    state=common.R/'acceptance-v3'
    attempt=json.loads(read_safe(state/'attempt.json'))
    assert attempt['manifest']==pin,'ATTEMPT_PIN'
    saved=json.loads(read_safe(state/'before-scheduled.json'))
    closure=json.loads(read_safe(state/'closure.json'))
    def show(unit,properties,all_values=False):
        args=['systemctl','show',unit,'--property='+properties]
        if all_values:args.append('--all')
        return common.run(args)
    timer='passvero-subscription-reminders.timer'
    probe=subprocess.run(['systemctl','show',timer,'--property=LastTriggerUSecMonotonic','--value'],capture_output=True,text=True,timeout=10)
    assert probe.returncode==0,'TIMER_PROPERTY_QUERY_FAILED'
    live=json.loads(common.sql('''BEGIN READ ONLY;
      SELECT json_build_object(
        'campaigns',(SELECT json_agg(x ORDER BY x.id) FROM
          (SELECT id,enabled,dispatches,"maxDispatches" FROM "ReminderCampaign") x),
        'outbox',(SELECT json_agg(x ORDER BY x.id) FROM
          (SELECT id,recipient,kind,status,attempts,"acceptedAt","receiptConfirmedAt" FROM "SubscriptionReminder") x),
        'attempts',(SELECT count(*) FROM "ReminderAttempt"),
        'acceptedAttempts',(SELECT count(*) FROM "ReminderAttempt" WHERE status='ACCEPTED'));
      ROLLBACK;'''))
    print(json.dumps({
      'diagnostic':'READ_ONLY_COMPLETE',
      'timerPropertyRaw':probe.stdout,
      'timerPropertyIntegerCompatible':probe.stdout.strip().isascii() and probe.stdout.strip().isdecimal(),
      'timerProperties':show(timer,'LoadState,ActiveState,UnitFileState,LastTriggerUSec,LastTriggerUSecMonotonic,NextElapseUSecMonotonic',True),
      'serviceProperties':show('passvero-subscription-reminders.service','ActiveState,Result,ExecMainStatus,ExecMainStartTimestampMonotonic,InvocationID',True),
      'stateFiles':sorted(p.name for p in state.iterdir()),
      'savedBeforeScheduled':{'dispatches':sum(c['dispatches'] for c in saved['campaigns']),'attempts':len(saved['attempts']),'acceptedAttempts':sum(a['status']=='ACCEPTED' for a in saved['attempts'])},
      'savedClosure':closure,'liveInventory':live,
      'writes':'NONE','workerExecuted':False,'smtpCalls':0
    },indent=2))
except Exception as error:
    print(json.dumps({'diagnostic':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'writes':'NONE'}))
    sys.exit(1)
PY_TIMER_DIAG
```

Expected READ_ONLY_COMPLETE, four accepted attempts, four SENT plus two CANCELLED rows,
disabled campaigns and inactive timer/service. timerPropertyRaw is diagnostic evidence;
do not infer or normalize it before reviewing the returned value.
PENDING_OPERATOR_COMMAND. Return sanitized output; do not rerun the v3 acceptance block.

## Historical handoff — scheduler-only proof (PASS; DO NOT RERUN)

Original delivery acceptance must not be repeated. Both approved campaigns remain disabled
and exhausted2/2. The pinned tool changes only timer enabled state and writes its own evidence
under a new scheduler-proof-v1 directory. It requires an actual timer trigger, successful
service exit, a unique IDLE worker journal invocation, and identical before/after campaign,
outbox and attempt records. Finally disables timer. No new SMTP dispatch or DB writes.
Run before 2026-10-01 10:45 Europe/Zagreb under the original approval window.
Prior ValueError input was not captured; current marker is0. Nonzero systemctl USec values
may be timespan text, so compare markers and separately verify numeric service start.

### LOCAL MAC TERMINAL

```bash
python3 - <<'PY_UPLOAD'
import hashlib, pathlib, subprocess
p=pathlib.Path('/private/tmp/passvero-reminder-scheduler-20261001-v1.py')
assert hashlib.sha256(p.read_bytes()).hexdigest()=='966f582287fa5c55f68a3484e9f4f2bca9c7e9eb69a200d79b2064650ccb1836','PACKAGE_HASH_MISMATCH'
subprocess.run(['scp',str(p),'passvero:/tmp/'+p.name],check=True)
print('SCHEDULER_PROOF_UPLOAD=PASS')
PY_UPLOAD
```

### VPS TERMINAL

```bash
sudo python3 - <<'PY_SCHEDULER'
import hashlib, json, os, pathlib, stat, subprocess, sys
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    source=pathlib.Path('/tmp/passvero-reminder-scheduler-20261001-v1.py')
    assert source.is_file() and not source.is_symlink(),'PACKAGE_FILE_REQUIRED'
    data=source.read_bytes()
    assert hashlib.sha256(data).hexdigest()=='966f582287fa5c55f68a3484e9f4f2bca9c7e9eb69a200d79b2064650ccb1836','PACKAGE_HASH_MISMATCH'
    root=pathlib.Path('/var/lib/passvero-subscription-reminders')
    for p in [root,*root.parents]:
        info=p.lstat()
        assert stat.S_ISDIR(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'STATE_DIRECTORY'
    target=root/'scheduler-proof-v1.py'
    assert not target.exists() and not target.is_symlink(),'DO_NOT_RERUN'
    with target.open('xb') as f:f.write(data)
    target.chmod(0o600)
    result=subprocess.run(['/usr/bin/python3',str(target)],timeout=600)
    if result.returncode:print('SCHEDULER_PROOF=STOP; MANUAL_REVIEW_REQUIRED; DO_NOT_RERUN')
    sys.exit(result.returncode)
except Exception as error:
    print(json.dumps({'scheduler':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_SCHEDULER
```

Expected PASS_TIMER_TRIGGERED_IDLE_CYCLE, databaseUnchanged true,
existingSmtpDispatches4, additionalSmtpDispatches0, campaignsEnabled0,
closure timerDisabledInactive true/errors[]. Wait up to about seven minutes.
PENDING_OPERATOR_COMMAND. Return complete sanitized output. On STOP do not rerun.

## Final returned result

PASS_TIMER_TRIGGERED_IDLE_CYCLE; service success/exit0; invocation8f41d476624547248dd60efc650cc285;
databaseUnchanged true; existingSmtpDispatches4; additionalSmtpDispatches0; campaignsEnabled0;
timerDisabledInactive true; errors[]. No further command is pending.
