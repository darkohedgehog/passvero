# VPS TERMINAL / PENDING_OPERATOR_COMMAND — admin notifications

REVIEW ONLY. Agent has not executed any VPS command. These blocks require separate
operator approval before execution. No staging deploy, synthetic request, test email,
SMTP probe, migration, ACL change, DB restore or backup acceptance is included.

Release: **2eaa5a54770843828e0aae4c16f71bae4927c12b**.
Expected current production: **4223f917073c170c5706e0c9f186804e9a02cd7a**, main,
/var/www/passvero; darko PM2 passvero; existing /etc/passvero/passvero-start.
No npm ci: package.json, lockfile and Prisma schema must be identical across releases.
One build covers both notification source corrections; the documentation commit requires
no separate build/deployment. The already accepted public/customer onboarding stays open
in its existing ingress configuration; it is not reprovisioned or retested here.

## Concrete impact and allowed writes

- Expected outage: from block01 PM2 stop through block02 successful start, at most the
  block01 15-minute budget plus result review and block02 three-minute budget. Build usually
  finishes sooner, but this procedure does not promise a shorter interruption. Existing
  Nginx will return upstream unavailability during the stop. No shared Nginx reload or
  configuration change is needed. Execute in an attended window; no unrelated deploy/reboot.
- Old whole tree is copied while the app is stopped to
  /var/www/passvero.before-admin-notifications-20261101. Copy includes source/.git, .next,
  public, node_modules and generated Prisma client with cp --archive --preserve=all.
  A full recursive content/symlink diff checks the stopped source against the saved copy.
  Mutable .next/cache is copied only while stopped, not claimed coherent under live writes.
  Runtime rollback itself is not claimed until the explicit return block succeeds.
- Private state, before-runtime/wrapper/vhost/PM2-saved copies and private build log:
  /var/lib/passvero-admin-notifications-deploy-20261101, root0700. Secrets are not printed.
  Active runtime env, wrapper, vhost, saved PM2 dump and SMTP credentials are not rewritten.
- Active /var/www/passvero is fast-forwarded only to the exact release and .next is built
  once using the saved production public build input. All service secret build variables are
  explicitly empty. No old/new source/build/assets/dependencies are mixed on return: whole
  preserved old tree replaces the whole failed new tree while passvero is stopped.
- Configuration DML only in production 127.0.0.1:5432/passvero:
  OnboardingNotificationSettings id1 recipientEmail=zivic.darko79@gmail.com, enabled=true,
  updatedAt=actual cutoff; one existing ONBOARDING_NOTIFICATION_SETTINGS_CONFIGURED audit.
  Original row/absence is captured. An unexplained recipient/extra settings row causes STOP
  before interruption. There are no schema, role, credential or migration writes.
- The only new active file is the production-only policy:
  /var/lib/passvero-production-onboarding-notifications/policy.json. Existing directory
  conflict causes STOP before downtime. Root:darko directory0750/file0640 allows the app to
  read but not write it. Actual reader admission is checked as darko, without SMTP/DB calls.
- Exact policy: {mode:NEW_REQUESTS,recipient:zivic.darko79@gmail.com,activatedAt:cutoff}.
  Cutoff is a fresh DB UTC clock_timestamp formatted to exactly milliseconds, captured while
  app is stopped and written identically to settings updatedAt. No backdating/copying of
  staging cutoff. Requests are not replayed; old pending outbox is not scanned/retried.
- Existing staging /var/lib/passvero-onboarding-notifications/policy.json is only hashed
  for an unchanged-content check; its contents/recipient/cutoff are not changed or printed.
  No staging DB/process/env is touched. No worker/timer is added or enabled.
- Existing backup timer remains active throughout. An ordinarily due backup may run under
  its already authorized B2/retention/alert behavior; these blocks do not invoke it manually.

## Order, STOP and return

Run block01 only after approval; send its sanitized JSON. Do not automatically run block02.
On NOTIFICATION_RELEASE_BUILT_APP_STOPPED, app intentionally remains stopped. Proceed
promptly to the already reviewed block02 after result review, or execute the return block.
Never leave production stopped waiting for unrelated documentation work.

Stop on wrong host/branch/head, dirty Git, unexpected origin/SSH alias/hooks/filter,
config/settings/policy conflict, insufficient disk/memory, hash drift, failed build/admission
or failed startup/HTTPS. No force, reset, rebase, merge fallback, automatic retry, or second
build is permitted. A pre-stop failure leaves production running; fetch only changes Git
object/FETCH_HEAD metadata. A stop/build failure keeps full/partial copies and private logs.
The scripts contain no hidden terminal getpass/editor input, avoiding prior stopped-TTY
helper behavior. The only interactive sudo authentication happens before Python starts.

Block02 configures settings/policy while app remains stopped, then restarts only passvero
through its existing wrapper with --update-env. Actual process environment is compared
privately with the unchanged loader source. Policy/config, process/port, appended startup
errors, two harmless page GETs and timer are checked. No submit/approve/activation endpoint
is called. The block itself sends no mail; naturally arriving requests after startup may
send their authorized single admin notification. Their inbox receipt is the later functional
acceptance, not something this technical block claims.

On block01/02 failure after stop use the separate return block, not a blind retry. It first
stops only passvero and refuses tree replacement if any process still has a cwd under the
app. It preserves the new policy by moving it into private disabled-policy storage,
restores the original settings row/absence with a configuration audit, and restores the
entire old code/build/dependency tree. Unexpected policy/settings/config drift stops return
rather than overwriting it. Active env is unchanged and guarded, so it is not overwritten.
No requests/users/orgs/audit/delivery records are deleted. No DB restore is appropriate;
code return does not undo any real email or real request created after startup.
A failed return reports PARTIAL/STOP for review, with no forced retry or cleanup.

The accepted backup validator/schema and saved pre-migration recovery snapshot are not
rerun or restored. That old DB snapshot predates accepted customer writes and is not a
lossless rollback for this change. Scanner/PDF, Storage-byte and legal approvals remain
outside this deployment.

## 1. Preserve, exact fast-forward, one build

```bash
sudo /usr/bin/timeout --foreground --signal=TERM --kill-after=10s 900s /usr/bin/python3 -I -S -B - <<'NOTIFICATION_RELEASE_BUILD'
import hashlib,json,os,pathlib,pwd,re,shlex,socket,subprocess,time
APP=pathlib.Path('/var/www/passvero');OLDTREE=pathlib.Path('/var/www/passvero.before-admin-notifications-20261101')
OUT=pathlib.Path('/var/lib/passvero-admin-notifications-deploy-20261101')
ENV=pathlib.Path('/etc/passvero/passvero-runtime.env');WRAP=pathlib.Path('/etc/passvero/passvero-start')
CONF=pathlib.Path('/etc/nginx/sites-available/passvero.eu')
STAGE=pathlib.Path('/var/lib/passvero-onboarding-notifications/policy.json')
PRODDIR=pathlib.Path('/var/lib/passvero-production-onboarding-notifications')
OLD='4223f917073c170c5706e0c9f186804e9a02cd7a';RELEASE='2eaa5a54770843828e0aae4c16f71bae4927c12b'
stopped=False;phase='PRECHECKS';os.umask(0o077);deadline=time.monotonic()+850
def check(ok,code):
    if not ok:raise RuntimeError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,budget=15):
    budget=min(budget,int(deadline-time.monotonic()));check(budget>0,'TIME_BUDGET_STOP')
    r=subprocess.run(args,capture_output=True,timeout=budget,env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LC_ALL':'C'})
    check(r.returncode==0,'COMMAND_FAILED_STOP');return r.stdout
def copy(a,b,budget=20):run(['/bin/cp','--archive','--preserve=all','--reflink=auto','--',str(a),str(b)],budget)
def save(n,v):
    with (OUT/n).open('x') as f:json.dump(v,f);f.write('\n')
def git(*args,budget=20):return run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i','HOME=/home/darko','PATH=/usr/bin:/bin','GIT_TERMINAL_PROMPT=0','GIT_SSH_COMMAND=/usr/bin/ssh -o BatchMode=yes -o ConnectTimeout=10 -o ConnectionAttempts=1','/usr/bin/git','-c','gc.auto=0','-c','maintenance.auto=false','-C',str(APP),*args],budget)
def pm2(*args):return run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i','HOME=/home/darko','PM2_HOME=/home/darko/.pm2','PATH=/usr/bin:/bin','/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args])
def app():
    rows=[r for r in json.loads(pm2('jlist')) if r['name']=='passvero'];check(len(rows)==1,'PM2_SCOPE_STOP');r=rows[0]
    check(r['pm2_env']['pm_cwd']==str(APP) and r['pm2_env']['pm_exec_path']==str(WRAP),'PM2_STARTUP_TARGET_STOP');return r
def timer():return run(['/usr/bin/systemctl','show','passvero-postgres-backup.timer','--property=ActiveState,SubState,UnitFileState']).decode().splitlines()
def pg(sql):
    r=subprocess.run(['/usr/bin/sudo','-n','-u','postgres','/usr/bin/psql','-X','-qAt','-w','-p','5432','-d','passvero','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,timeout=12,cwd='/tmp',env={'PATH':'/usr/bin:/bin','PGOPTIONS':'-c default_transaction_read_only=on -c statement_timeout=8000 -c lock_timeout=2000 -c TimeZone=UTC'})
    check(r.returncode==0,'READ_ONLY_DB_STOP');return json.loads(r.stdout)
print(json.dumps({'status':'NOTIFICATION_DEPLOY_PRECHECKS'}),flush=True)
try:
    check(os.geteuid()==0 and socket.gethostname()=='srv1834647' and pwd.getpwnam('darko').pw_uid==1000,'HOST_USER_STOP')
    check(APP.resolve()==APP and (APP/'.git').is_dir() and not (APP/'.git').is_symlink(),'APP_TARGET_STOP')
    for p in [OUT,OLDTREE,PRODDIR]:check(not p.exists() and not p.is_symlink(),'EXISTING_DESTINATION_STOP')
    for p in [ENV,WRAP,CONF,STAGE]:check(p.is_file() and not p.is_symlink(),'CONFIG_TARGET_STOP')
    check(STAGE.parent.resolve()==STAGE.parent and STAGE.stat().st_uid==0,'STAGING_POLICY_SOURCE_STOP')
    check(git('rev-parse','HEAD').decode().strip()==OLD and git('branch','--show-current').decode().strip()=='main' and not git('status','--porcelain=v1','--untracked-files=normal').strip(),'GIT_STATE_STOP')
    check(not any((APP/'.git'/n).exists() for n in ['index.lock','MERGE_HEAD','CHERRY_PICK_HEAD','rebase-merge','rebase-apply']),'GIT_CONFLICT_STOP')
    check(app()['pm2_env']['status']=='online','APP_NOT_ONLINE_STOP')
    t=timer();check('ActiveState=active' in t and 'UnitFileState=enabled' in t,'BACKUP_TIMER_STOP')
    config={}
    for line in ENV.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        k,v=line.removeprefix('export ').split('=',1);parts=shlex.split(v,comments=True);check(len(parts)<=1,'ENV_PARSE_STOP');config[k]=parts[0] if parts else ''
    check(config.get('PASSVERO_RUNTIME_ENV')=='production' and config.get('BETTER_AUTH_URL')=='https://passvero.eu' and all(config.get(k) for k in ['SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','AUTH_EMAIL_FROM','AUTH_EMAIL_REPLY_TO']),'RUNTIME_SMTP_TARGET_STOP')
    inputs=json.loads(pathlib.Path('/var/lib/passvero-production-build-fix-20261101/public-input.private.json').read_text())
    key=inputs['NEXT_PUBLIC_TURNSTILE_SITE_KEY'];check(inputs['origin']=='https://passvero.eu' and inputs['runtimeEnvironment']=='production' and re.fullmatch(r'[A-Za-z0-9_-]{10,256}',key) and config.get('NEXT_PUBLIC_TURNSTILE_SITE_KEY')==key,'PUBLIC_BUILD_INPUT_STOP')
    db=pg('SELECT json_build_object(\'database\',current_database(),\'port\',current_setting(\'port\'),\'directory\',current_setting(\'data_directory\'),\'settings\',(SELECT COALESCE(json_agg(s),\'[]\'::json) FROM public."OnboardingNotificationSettings" s));')
    check((db['database'],db['port'],db['directory'])==('passvero','5432','/var/lib/postgresql/16/main'),'DB_TARGET_STOP')
    check(not db['settings'] or (len(db['settings'])==1 and db['settings'][0]['id']==1 and db['settings'][0]['recipientEmail']=='zivic.darko79@gmail.com'),'SETTINGS_CONFLICT_STOP')
    remote=git('remote','get-url','origin').decode().strip()
    if remote!='https://github.com/darkohedgehog/passvero.git':
        match=re.fullmatch(r'git@([A-Za-z0-9_.-]+):darkohedgehog/passvero(?:\.git)?',remote);check(match is not None,'ORIGIN_STOP')
        ssh=run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/ssh','-G',match[1]]).decode();opts=dict(x.split(None,1) for x in ssh.splitlines() if ' ' in x)
        check(opts.get('hostname')=='github.com' and opts.get('user')=='git' and opts.get('port')=='22' and opts.get('proxycommand','none')=='none' and opts.get('proxyjump','none')=='none' and opts.get('permitlocalcommand','no') in ['no','false'],'SSH_ALIAS_STOP')
    cfg=git('config','--list').decode();check(not re.search(r'(?mi)^(core\.sshcommand|core\.hookspath|filter\.)',cfg),'CUSTOM_GIT_EXECUTION_STOP')
    hooks=APP/'.git/hooks';check(not hooks.is_symlink() and not any(p.is_file() and os.access(p,os.X_OK) and not p.name.endswith('.sample') for p in hooks.iterdir()),'ACTIVE_GIT_HOOK_STOP')
    print(json.dumps({'status':'NOTIFICATION_DEPLOY_STEP','phase':'FETCH_EXACT_RELEASE'}),flush=True)
    git('fetch','--no-tags','origin',RELEASE,budget=60)
    check(git('rev-parse','FETCH_HEAD').decode().strip()==RELEASE,'FETCH_TARGET_STOP');git('merge-base','--is-ancestor',OLD,RELEASE)
    for n in ['package.json','package-lock.json','prisma/schema.prisma']:check(git('show',OLD+':'+n)==git('show',RELEASE+':'+n),'DEPENDENCY_OR_SCHEMA_DELTA_STOP')
    changed=git('diff','--name-only',OLD,RELEASE).decode().splitlines()
    check(len(changed)==12 and all(n.startswith(('codex/evidence/','docs/superpowers/reviews/')) or n in ['src/infrastructure/persistence/prisma/onboarding-notification-policy.ts','src/infrastructure/persistence/prisma/prisma-access-request-notifications.ts','tests/infrastructure/onboarding-notification-policy-origin.test.ts','tests/infrastructure/production-onboarding-notifications.test.ts'] for n in changed),'RELEASE_SCOPE_STOP')
    lock=json.loads((APP/'package-lock.json').read_text())
    for n in ['next','typescript']:check(json.loads((APP/'node_modules'/n/'package.json').read_text())['version']==lock['packages']['node_modules/'+n]['version'],'INSTALLED_DEPENDENCY_STOP')
    size=int(run(['/usr/bin/du','-sb',str(APP)],30).split()[0]);v=os.statvfs(APP)
    check(v.f_bavail*v.f_frsize>=size+8*1024**3,'DISK_SPACE_STOP')
    logs=os.statvfs(OUT.parent);check(logs.f_bavail*logs.f_frsize>=100*1024**2,'PRIVATE_LOG_SPACE_STOP')
    mem=dict(x.split(':',1) for x in pathlib.Path('/proc/meminfo').read_text().splitlines());check(int(mem['MemAvailable'].split()[0])*1024>=4*1024**3,'BUILD_MEMORY_STOP')
    OUT.mkdir(mode=0o700)
    before={'oldHead':OLD,'release':RELEASE,'runtimeHash':sha(ENV),'wrapperHash':sha(WRAP),'vhostHash':sha(CONF),'stagingPolicyHash':sha(STAGE),'settings':db['settings'],'timerActive':True,'buildId':(APP/'.next/BUILD_ID').read_text().strip()}
    save('before.private.json',before);save('public-input.private.json',inputs)
    for src,n in [(ENV,'runtime.before.env'),(WRAP,'wrapper.before'),(CONF,'nginx.before.conf'),(pathlib.Path('/home/darko/.pm2/dump.pm2'),'pm2-saved.before')]:copy(src,OUT/n)
    phase='STOP_AND_PRESERVE';print(json.dumps({'status':'NOTIFICATION_DEPLOY_STEP','phase':phase}),flush=True)
    pm2('stop','passvero');stopped=True
    check(app()['pm2_env']['status']=='stopped' and not run(['/usr/bin/ss','-H','-ltn','sport = :3000']).strip(),'APP_HOLD_STOP')
    copy(APP,OLDTREE,180)
    run(['/usr/bin/diff','--recursive','--brief','--no-dereference',str(APP),str(OLDTREE)],150)
    check((OLDTREE/'.next/BUILD_ID').read_text().strip()==before['buildId'],'PRESERVED_BUILD_STOP');save('copy-complete.json',{'complete':True})
    phase='FAST_FORWARD';print(json.dumps({'status':'NOTIFICATION_DEPLOY_STEP','phase':phase}),flush=True)
    check(app()['pm2_env']['status']=='stopped' and not run(['/usr/bin/ss','-H','-ltn','sport = :3000']).strip(),'PRE_FF_HOLD_STOP')
    check(not git('status','--porcelain=v1','--untracked-files=normal').strip(),'PRE_FF_DIRTY_STOP');git('merge','--ff-only','--no-edit',RELEASE)
    check(git('rev-parse','HEAD').decode().strip()==RELEASE and not git('status','--porcelain=v1','--untracked-files=normal').strip(),'FF_POSTCHECK_STOP')
    phase='ONE_PRODUCTION_BUILD';print(json.dumps({'status':'NOTIFICATION_DEPLOY_STEP','phase':phase}),flush=True)
    empty=['DATABASE_URL','AUTH_DATABASE_URL','BETTER_AUTH_SECRET','AUTH_ABUSE_HMAC_SECRET','AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET','AUTH_ACTIVATION_EMAIL_HMAC_SECRET','PASSVERO_TRUSTED_PROXY_SECRET','TURNSTILE_SECRET_KEY','DOCUMENT_STORAGE_SUPABASE_URL','DOCUMENT_STORAGE_SUPABASE_KEY','DOCUMENT_STORAGE_BUCKET','DOCUMENT_SCAN_CONFIG','SMTP_HOST','SMTP_PORT','SMTP_SECURE','SMTP_USER','SMTP_PASSWORD','AUTH_EMAIL_FROM','AUTH_EMAIL_REPLY_TO']
    buildenv=['PATH=/usr/bin:/bin','HOME=/home/darko','CI=1','NEXT_TELEMETRY_DISABLED=1','NODE_ENV=production','PASSVERO_RUNTIME_ENV=production','BETTER_AUTH_URL=https://passvero.eu','DOCUMENT_SCAN_ENABLED=false','NEXT_PUBLIC_TURNSTILE_SITE_KEY='+key,*[n+'=' for n in empty]]
    budget=min(480,int(deadline-time.monotonic())-30);check(budget>0,'BUILD_TIME_BUDGET_STOP')
    with (OUT/'build.private.log').open('xb') as log:
        r=subprocess.run(['/usr/bin/timeout','--signal=TERM','--kill-after=10s',str(budget)+'s','/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i',*buildenv,'/usr/bin/npm','run','build','--','--webpack'],cwd=APP,stdout=log,stderr=subprocess.STDOUT,timeout=budget+15)
    check(r.returncode==0,'BUILD_FAILED_PRIVATE_LOG_STOP')
    check(bool((APP/'.next/BUILD_ID').read_text().strip()) and app()['pm2_env']['status']=='stopped','BUILD_OR_HOLD_STOP')
    check(sha(ENV)==before['runtimeHash'] and sha(WRAP)==before['wrapperHash'] and sha(CONF)==before['vhostHash'] and sha(STAGE)==before['stagingPolicyHash'],'CONFIG_OR_STAGING_CHANGED_STOP')
    check('ActiveState=active' in timer(),'BACKUP_TIMER_CHANGED_STOP')
    save('build-complete.json',{'head':RELEASE,'buildId':(APP/'.next/BUILD_ID').read_text().strip(),'buildRuns':1})
    print(json.dumps({'status':'NOTIFICATION_RELEASE_BUILT_APP_STOPPED','head':RELEASE,'buildRuns':1,'npmCiRuns':0,'previousTree':str(OLDTREE),'stateRoot':str(OUT),'appStatus':'stopped','backupTimer':'active','settingsChanged':False,'policyCreated':False,'next':'REVIEW_RESULT_THEN_BLOCK_02_OR_CONFIG_CODE_RETURN'}))
except Exception as e:
    print(json.dumps({'status':'NOTIFICATION_BUILD_STOP_NO_RETRY','phase':phase,'reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,'stopSubmitted':stopped,'stateRoot':str(OUT),'next':'IF_STOP_SUBMITTED_USE_SUPPLIED_RETURN_BLOCK; OTHERWISE_PRODUCTION_UNCHANGED'}));raise SystemExit(1)
NOTIFICATION_RELEASE_BUILD
```

## 2. Production-only activation and existing wrapper/PM2 start

```bash
sudo /usr/bin/timeout --foreground --signal=TERM --kill-after=10s 180s /usr/bin/python3 -I -S -B - <<'ACTIVATE_PRODUCTION_NOTIFICATION_POLICY'
import hashlib,json,os,pathlib,pwd,shlex,socket,subprocess,time,uuid
APP=pathlib.Path('/var/www/passvero');OUT=pathlib.Path('/var/lib/passvero-admin-notifications-deploy-20261101')
ENV=pathlib.Path('/etc/passvero/passvero-runtime.env');CONF=pathlib.Path('/etc/nginx/sites-available/passvero.eu');WRAP=pathlib.Path('/etc/passvero/passvero-start')
STAGE=pathlib.Path('/var/lib/passvero-onboarding-notifications/policy.json')
DIR=pathlib.Path('/var/lib/passvero-production-onboarding-notifications');POLICY=DIR/'policy.json'
RELEASE='2eaa5a54770843828e0aae4c16f71bae4927c12b';RECIPIENT='zivic.darko79@gmail.com'
config=False;started=False;os.umask(0o077)
def check(ok,code):
    if not ok:raise RuntimeError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def save(n,v):
    with (OUT/n).open('x') as f:json.dump(v,f);f.write('\n')
def run(args,budget=12):
    r=subprocess.run(args,capture_output=True,timeout=budget,env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LC_ALL':'C'})
    check(r.returncode==0,'COMMAND_FAILED_STOP');return r.stdout
def pm2(*args):return run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i','HOME=/home/darko','PM2_HOME=/home/darko/.pm2','PATH=/usr/bin:/bin','/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args])
def app():
    rows=[r for r in json.loads(pm2('jlist')) if r['name']=='passvero'];check(len(rows)==1,'PM2_SCOPE_STOP');r=rows[0]
    check(r['pm2_env']['pm_cwd']==str(APP) and r['pm2_env']['pm_exec_path']==str(WRAP),'PM2_TARGET_STOP');return r
def pg(sql,readonly=True):
    options='-c statement_timeout=8000 -c lock_timeout=2000 -c TimeZone=UTC'+(' -c default_transaction_read_only=on' if readonly else '')
    r=subprocess.run(['/usr/bin/sudo','-n','-u','postgres','/usr/bin/psql','-X','-qAt','-w','-p','5432','-d','passvero','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,timeout=12,cwd='/tmp',env={'PATH':'/usr/bin:/bin','PGOPTIONS':options})
    check(r.returncode==0,'PRODUCTION_SETTINGS_SQL_STOP');return r.stdout.decode().strip()
def quote(v):return "'"+v.replace("'","''")+"'"
print(json.dumps({'status':'PRODUCTION_NOTIFICATION_ACTIVATION_PRECHECKS'}),flush=True)
try:
    check(os.geteuid()==0 and socket.gethostname()=='srv1834647','HOST_STOP')
    check(OUT.resolve()==OUT and OUT.stat().st_uid==0 and OUT.stat().st_mode&0o777==0o700,'PRIVATE_STATE_STOP')
    before=json.loads((OUT/'before.private.json').read_text());built=json.loads((OUT/'build-complete.json').read_text())
    check(not (OUT/'activation-intent.private.json').exists() and not DIR.exists() and not DIR.is_symlink(),'ACTIVATION_ALREADY_PRESENT_STOP')
    check(built['head']==RELEASE and (APP/'.next/BUILD_ID').read_text().strip()==built['buildId'],'BUILD_IDENTITY_STOP')
    check(run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/git','-C',str(APP),'rev-parse','HEAD']).decode().strip()==RELEASE,'RELEASE_STOP')
    check(not run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/git','-C',str(APP),'status','--porcelain=v1','--untracked-files=normal']).strip(),'WORKTREE_DRIFT_STOP')
    check(app()['pm2_env']['status']=='stopped' and not run(['/usr/bin/ss','-H','-ltn','sport = :3000']).strip(),'APP_HOLD_STOP')
    check(sha(ENV)==before['runtimeHash'] and sha(CONF)==before['vhostHash'] and sha(WRAP)==before['wrapperHash'] and sha(STAGE)==before['stagingPolicyHash'],'CONFIG_OR_STAGING_DRIFT_STOP')
    target=json.loads(pg('SELECT json_build_object(\'database\',current_database(),\'port\',current_setting(\'port\'),\'directory\',current_setting(\'data_directory\'));'))
    check(target=={'database':'passvero','port':'5432','directory':'/var/lib/postgresql/16/main'},'DB_TARGET_STOP')
    expected=json.dumps(before['settings'],sort_keys=True,separators=(',',':'))
    cutoff=pg("SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"');")
    policy={'mode':'NEW_REQUESTS','activatedAt':cutoff,'recipient':RECIPIENT}
    policybytes=(json.dumps(policy,sort_keys=True)+'\n').encode()
    save('activation-intent.private.json',{'cutoff':cutoff,'policySha256':hashlib.sha256(policybytes).hexdigest(),'recipient':RECIPIENT})
    sql='''BEGIN;
LOCK TABLE public."OnboardingNotificationSettings" IN SHARE ROW EXCLUSIVE MODE;
DO $$ BEGIN
 IF (SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]'::jsonb) FROM public."OnboardingNotificationSettings" s) <> '''+quote(expected)+'''::jsonb THEN RAISE EXCEPTION 'SETTINGS_CHANGED'; END IF;
END $$;
INSERT INTO public."OnboardingNotificationSettings" (id,"recipientEmail",enabled,"updatedAt") VALUES (1,'''+quote(RECIPIENT)+''',true,'''+quote(cutoff)+'''::timestamptz AT TIME ZONE 'UTC')
ON CONFLICT (id) DO UPDATE SET "recipientEmail"=EXCLUDED."recipientEmail",enabled=EXCLUDED.enabled,"updatedAt"=EXCLUDED."updatedAt";
INSERT INTO public."AuthAuditEvent" (id,action,"correlationId",metadata,summary,"occurredAt","createdAt") VALUES ('''+quote(str(uuid.uuid4()))+''','ONBOARDING_NOTIFICATION_SETTINGS_CONFIGURED','''+quote(str(uuid.uuid4()))+''','{"operator":"darko","enabled":true}'::jsonb,'Explicit operator onboarding notification configuration.',clock_timestamp(),clock_timestamp());
COMMIT;'''
    config=True;pg(sql,False)
    DIR.mkdir(mode=0o750);os.chown(DIR,0,pwd.getpwnam('darko').pw_gid);os.chmod(DIR,0o750)
    with POLICY.open('xb') as f:f.write(policybytes);os.fchown(f.fileno(),0,pwd.getpwnam('darko').pw_gid);os.fchmod(f.fileno(),0o640)
    # Read the real existing policy API as the runtime OS identity; no DB/provider call.
    node="require('./src/infrastructure/persistence/prisma/onboarding-notification-policy.ts').readOnboardingNotificationPolicy('https://passvero.eu').then(p=>{if(!p)process.exit(2);console.log(JSON.stringify(p))}).catch(()=>process.exit(3))"
    r=subprocess.run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i','HOME=/home/darko','PATH=/usr/bin:/bin','/usr/bin/node','--import','tsx','-e',node],cwd=APP,capture_output=True,timeout=12)
    check(r.returncode==0 and json.loads(r.stdout)==policy,'RUNTIME_POLICY_ADMISSION_STOP')
    check(sha(STAGE)==before['stagingPolicyHash'],'STAGING_POLICY_CHANGED_STOP')
    previous=app();err=pathlib.Path(previous['pm2_env']['pm_err_log_path']);check(str(err).startswith('/home/darko/.pm2/logs/'),'LOG_TARGET_STOP');offset=err.stat().st_size if err.exists() else 0
    print(json.dumps({'status':'PRODUCTION_NOTIFICATION_START','cutoffUTC':cutoff}),flush=True)
    started=True;pm2('restart','passvero','--update-env')
    deadline=time.monotonic()+35
    while True:
        current=app()
        if current['pm2_env']['status']=='online' and b'127.0.0.1:3000' in run(['/usr/bin/ss','-H','-ltn','sport = :3000']):break
        check(time.monotonic()<deadline,'START_TIMEOUT_STOP');time.sleep(1)
    effective=dict(v.split(b'=',1) for v in pathlib.Path('/proc',str(current['pid']),'environ').read_bytes().split(b'\0') if b'=' in v)
    expectedenv={}
    for line in ENV.read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#'):continue
        k,v=line.removeprefix('export ').split('=',1);parts=shlex.split(v,comments=True);expectedenv[k]=parts[0] if parts else ''
    check(all(effective.get(k.encode())==v.encode() for k,v in expectedenv.items()),'WRAPPER_EFFECTIVE_ENV_STOP')
    responses={}
    for path in ['/request-access','/login']:
        code=run(['/usr/bin/curl','--silent','--show-error','--retry','0','--max-time','8','--resolve','passvero.eu:443:127.0.0.1','--output','/dev/null','--write-out','%{http_code}','https://passvero.eu'+path]).decode();check(code=='200','HTTPS_STOP');responses[path]=200
    row=json.loads(pg('SELECT json_build_object(\'recipientEmail\',"recipientEmail",\'enabled\',enabled,\'cutoff\',to_char("updatedAt",\'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"\')) FROM public."OnboardingNotificationSettings" WHERE id=1;'))
    check(row=={'recipientEmail':RECIPIENT,'enabled':True,'cutoff':cutoff},'SETTINGS_POSTCHECK_STOP')
    check(sha(POLICY)==hashlib.sha256(policybytes).hexdigest() and sha(STAGE)==before['stagingPolicyHash'] and sha(ENV)==before['runtimeHash'] and sha(CONF)==before['vhostHash'] and sha(WRAP)==before['wrapperHash'],'CONFIG_POSTCHECK_STOP')
    if err.exists():
        check(offset<=err.stat().st_size<=offset+1024**2,'LOG_ROTATION_OR_VOLUME_STOP')
        with err.open('rb') as f:f.seek(offset);errors=f.read(1024**2)
        check(not any(x in errors.lower() for x in [b'error',b'fatal',b'uncaught']),'STARTUP_ERROR_STOP')
    timer=run(['/usr/bin/systemctl','show','passvero-postgres-backup.timer','--property=ActiveState,SubState,UnitFileState']).decode().splitlines();check('ActiveState=active' in timer,'TIMER_CHANGED_STOP')
    result={'status':'PRODUCTION_ADMIN_NOTIFICATIONS_ENABLED_PENDING_NEXT_REAL_REQUEST','head':RELEASE,'appStatus':app()['pm2_env']['status'],'https':responses,'recipient':RECIPIENT,'policy':str(POLICY),'mode':'NEW_REQUESTS','cutoffUTC':cutoff,'automaticRetry':False,'retroactiveDispatch':False,'testSubmissions':0,'messagesSentByBlock':0,'backupTimer':timer,'stagingPolicyUnchanged':True,'runtimeEnvChanged':False,'nginxChanged':False,'buildRuns':1}
    save('activation-result.json',result);print(json.dumps(result))
except Exception as e:
    stopped=None
    if started:
        try:pm2('stop','passvero');stopped=app()['pm2_env']['status']=='stopped'
        except Exception:pass
    print(json.dumps({'status':'NOTIFICATION_ACTIVATION_STOP_NO_RETRY','reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,'settingsWriteSubmitted':config,'startSubmitted':started,'appStoppedAfterFailure':stopped,'next':'USE_SUPPLIED_CONFIG_CODE_RETURN; NO_DB_RESTORE_OR_RESEND','messagesSentByBlock':0}));raise SystemExit(1)
ACTIVATE_PRODUCTION_NOTIFICATION_POLICY
```

## Return only if needed — preserve identities and delivery evidence

```bash
sudo /usr/bin/timeout --foreground --signal=TERM --kill-after=10s 180s /usr/bin/python3 -I -S -B - <<'RETURN_NOTIFICATION_RELEASE'
import hashlib,json,os,pathlib,socket,subprocess,time,uuid
APP=pathlib.Path('/var/www/passvero');OLDTREE=pathlib.Path('/var/www/passvero.before-admin-notifications-20261101')
FAILED=pathlib.Path('/var/www/passvero.admin-notifications-partial-20261101')
OUT=pathlib.Path('/var/lib/passvero-admin-notifications-deploy-20261101')
ENV=pathlib.Path('/etc/passvero/passvero-runtime.env');WRAP=pathlib.Path('/etc/passvero/passvero-start');CONF=pathlib.Path('/etc/nginx/sites-available/passvero.eu')
STAGE=pathlib.Path('/var/lib/passvero-onboarding-notifications/policy.json');POLICY=pathlib.Path('/var/lib/passvero-production-onboarding-notifications/policy.json')
OLD='4223f917073c170c5706e0c9f186804e9a02cd7a';RELEASE='2eaa5a54770843828e0aae4c16f71bae4927c12b'
restartSubmitted=False
def check(ok,code):
    if not ok:raise RuntimeError(code)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def run(args,budget=12):
    r=subprocess.run(args,capture_output=True,timeout=budget,env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LC_ALL':'C'})
    check(r.returncode==0,'RETURN_COMMAND_STOP');return r.stdout
def git(path,*args):return run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/git','-C',str(path),*args])
def pm2(*args):return run(['/usr/bin/sudo','-n','-u','darko','/usr/bin/env','-i','HOME=/home/darko','PM2_HOME=/home/darko/.pm2','PATH=/usr/bin:/bin','/usr/bin/node','/usr/lib/node_modules/pm2/bin/pm2',*args])
def app():
    rows=[r for r in json.loads(pm2('jlist')) if r['name']=='passvero'];check(len(rows)==1,'PM2_SCOPE_STOP');r=rows[0]
    check(r['pm2_env']['pm_cwd']==str(APP) and r['pm2_env']['pm_exec_path']==str(WRAP),'PM2_TARGET_STOP');return r
def pg(sql):
    r=subprocess.run(['/usr/bin/sudo','-n','-u','postgres','/usr/bin/psql','-X','-qAt','-w','-p','5432','-d','passvero','-v','ON_ERROR_STOP=1'],input=sql.encode(),capture_output=True,timeout=12,cwd='/tmp',env={'PATH':'/usr/bin:/bin','PGOPTIONS':'-c statement_timeout=8000 -c lock_timeout=2000 -c TimeZone=UTC'})
    check(r.returncode==0,'SETTINGS_RETURN_SQL_STOP');return r.stdout.decode().strip()
def q(v):return "'"+v.replace("'","''")+"'"
print(json.dumps({'status':'NOTIFICATION_CODE_CONFIG_RETURN_PRECHECKS'}),flush=True)
try:
    check(os.geteuid()==0 and socket.gethostname()=='srv1834647','HOST_STOP')
    check(OUT.resolve()==OUT and OUT.stat().st_uid==0 and OUT.stat().st_mode&0o777==0o700,'PRIVATE_STATE_STOP')
    check(not (OUT/'return-result.json').exists() and not FAILED.exists() and not FAILED.is_symlink(),'RETURN_CONFLICT_STOP')
    before=json.loads((OUT/'before.private.json').read_text())
    check(APP.resolve()==APP and git(APP,'rev-parse','HEAD').decode().strip() in [OLD,RELEASE] and not git(APP,'status','--porcelain=v1','--untracked-files=normal').strip(),'RETURN_SOURCE_SCOPE_STOP')
    check(sha(ENV)==before['runtimeHash'] and sha(WRAP)==before['wrapperHash'] and sha(CONF)==before['vhostHash'] and sha(STAGE)==before['stagingPolicyHash'],'UNEXPECTED_CONFIG_DRIFT_STOP')
    complete=(OUT/'copy-complete.json').exists()
    if complete:
        check(OLDTREE.resolve()==OLDTREE and git(OLDTREE,'rev-parse','HEAD').decode().strip()==OLD and (OLDTREE/'.next/BUILD_ID').read_text().strip()==before['buildId'],'PRESERVED_RELEASE_STOP')
    else:
        check(git(APP,'rev-parse','HEAD').decode().strip()==OLD and (APP/'.next/BUILD_ID').read_text().strip()==before['buildId'],'NO_COMPLETE_RETURN_COPY_STOP')
    intent=json.loads((OUT/'activation-intent.private.json').read_text()) if (OUT/'activation-intent.private.json').exists() else None
    if POLICY.exists() or POLICY.is_symlink():check(intent is not None and POLICY.is_file() and not POLICY.is_symlink() and sha(POLICY)==intent['policySha256'],'UNKNOWN_POLICY_STOP')
    target=json.loads(pg("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'directory',current_setting('data_directory'));"))
    check(target=={'database':'passvero','port':'5432','directory':'/var/lib/postgresql/16/main'},'DB_TARGET_STOP')
    app();pm2('stop','passvero')
    check(app()['pm2_env']['status']=='stopped' and not run(['/usr/bin/ss','-H','-ltn','sport = :3000']).strip(),'RETURN_HOLD_STOP')
    # Refuse to rename trees while an unfinished install/build can still write them.
    for proc in pathlib.Path('/proc').iterdir():
        if not proc.name.isdigit():continue
        try:
            check(not str((proc/'cwd').resolve(strict=True)).startswith(str(APP)+'/') and (proc/'cwd').resolve(strict=True)!=APP,'APP_CWD_PROCESS_REMAINS_STOP')
        except (FileNotFoundError,PermissionError,ProcessLookupError):pass
    if POLICY.exists():
        check(not (OUT/'disabled-policy.private.json').exists(),'DISABLED_POLICY_CONFLICT_STOP')
        POLICY.rename(OUT/'disabled-policy.private.json')
    if intent:
        expected=json.dumps(before['settings'],sort_keys=True,separators=(',',':'))
        own="(SELECT count(*) FROM public.\"OnboardingNotificationSettings\")=1 AND EXISTS(SELECT 1 FROM public.\"OnboardingNotificationSettings\" WHERE id=1 AND \"recipientEmail\"='zivic.darko79@gmail.com' AND enabled=true AND \"updatedAt\"=("+q(intent['cutoff'])+"::timestamptz AT TIME ZONE 'UTC'))"
        sql='BEGIN; LOCK TABLE public."OnboardingNotificationSettings" IN SHARE ROW EXCLUSIVE MODE; DO $$ BEGIN IF NOT ((SELECT COALESCE(jsonb_agg(to_jsonb(s)),\'[]\'::jsonb) FROM public."OnboardingNotificationSettings" s)='+q(expected)+'::jsonb OR ('+own+")) THEN RAISE EXCEPTION 'SETTINGS_DRIFT'; END IF; END $$;"
        if before['settings']:
            s=before['settings'][0];sql+='INSERT INTO public."OnboardingNotificationSettings" (id,"recipientEmail",enabled,"updatedAt") VALUES (1,'+q(s['recipientEmail'])+','+('true' if s['enabled'] else 'false')+','+q(s['updatedAt'])+'::timestamp) ON CONFLICT(id) DO UPDATE SET "recipientEmail"=EXCLUDED."recipientEmail",enabled=EXCLUDED.enabled,"updatedAt"=EXCLUDED."updatedAt";'
        else:sql+='DELETE FROM public."OnboardingNotificationSettings" WHERE id=1;'
        metadata=json.dumps({'operator':'darko','enabled':bool(before['settings'] and before['settings'][0]['enabled']),'operation':'restore_previous_settings'})
        sql+='INSERT INTO public."AuthAuditEvent" (id,action,"correlationId",metadata,summary,"occurredAt","createdAt") VALUES ('+q(str(uuid.uuid4()))+",'ONBOARDING_NOTIFICATION_SETTINGS_CONFIGURED',"+q(str(uuid.uuid4()))+','+q(metadata)+"::jsonb,'Explicit operator onboarding notification configuration.',clock_timestamp(),clock_timestamp()); COMMIT;"
        pg(sql)
    if complete:
        run(['/bin/mv','--no-clobber','-T',str(APP),str(FAILED)]);check(not APP.exists(),'TREE_RENAME_CONFLICT_STOP')
        run(['/bin/mv','--no-clobber','-T',str(OLDTREE),str(APP)])
    check(git(APP,'rev-parse','HEAD').decode().strip()==OLD and (APP/'.next/BUILD_ID').read_text().strip()==before['buildId'],'RETURN_RELEASE_STOP')
    restartSubmitted=True;pm2('restart','passvero','--update-env');deadline=time.monotonic()+35
    while True:
        if app()['pm2_env']['status']=='online' and b'127.0.0.1:3000' in run(['/usr/bin/ss','-H','-ltn','sport = :3000']):break
        check(time.monotonic()<deadline,'RETURN_START_TIMEOUT_STOP');time.sleep(1)
    code=run(['/usr/bin/curl','--silent','--show-error','--retry','0','--max-time','8','--resolve','passvero.eu:443:127.0.0.1','--output','/dev/null','--write-out','%{http_code}','https://passvero.eu/login']).decode();check(code=='200','RETURN_HTTPS_STOP')
    timer=run(['/usr/bin/systemctl','show','passvero-postgres-backup.timer','--property=ActiveState,SubState,UnitFileState']).decode().splitlines();check('ActiveState=active' in timer,'TIMER_CHANGED_STOP')
    check(sha(STAGE)==before['stagingPolicyHash'],'STAGING_POLICY_CHANGED_STOP')
    result={'status':'PREVIOUS_RELEASE_AND_NOTIFICATION_SETTINGS_RETURNED','head':OLD,'appStatus':'online','httpsLogin':200,'backupTimer':timer,'databaseRestored':False,'requestsIdentitiesAndDeliveryEvidencePreserved':True,'stagingPolicyUnchanged':True,'testMessages':0}
    with (OUT/'return-result.json').open('x') as f:json.dump(result,f);f.write('\n')
    print(json.dumps(result))
except Exception as e:
    state='UNKNOWN'
    if restartSubmitted:
        try:pm2('stop','passvero');state=app()['pm2_env']['status']
        except Exception:pass
    else:
        try:state=app()['pm2_env']['status']
        except Exception:pass
    print(json.dumps({'status':'NOTIFICATION_RETURN_PARTIAL_STOP','reason':str(e) if isinstance(e,RuntimeError) else type(e).__name__,'automaticRetry':False,'databaseRestored':False,'appStatus':state,'next':'REVIEW_PARTIAL_STATE; DO_NOT_RETRY_OR_RESTORE_DB'}));raise SystemExit(1)
RETURN_NOTIFICATION_RELEASE
```

