"""Operator-only read-only staging inventory. Never calls coverage, enrollment or SMTP."""
import hashlib, json, os, pathlib, pwd, subprocess, sys, urllib.parse

APP = pathlib.Path('/var/www/passvero-acceptance')
CANONICAL = pathlib.Path('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')

def runtime_database_endpoints(raw):
    observed = {}
    for key, role in [(b'DATABASE_URL', 'passvero_app'), (b'AUTH_DATABASE_URL', 'passvero_auth')]:
        item = {'valid': False, 'state': 'MISSING_OR_MALFORMED'}
        try:
            value = raw[key].decode()
            url = urllib.parse.urlparse(value)
            username = urllib.parse.unquote(url.username or '')
            database = urllib.parse.unquote(url.path[1:])
            item = {'role': username if username in ('passvero_app', 'passvero_auth') else 'UNEXPECTED',
                    'host': url.hostname if url.hostname in ('localhost', '127.0.0.1') else 'UNEXPECTED',
                    'port': url.port, 'database': database if database in ('passvero', 'passvero_acceptance') else 'UNEXPECTED',
                    'valid': url.scheme in ('postgres', 'postgresql') and username == role and url.hostname == '127.0.0.1'
                    and url.port == 5433 and database == 'passvero_acceptance' and bool(url.password)
                    and value == value.strip() and not any(c.isspace() or c in '\\?#' for c in value)}
        except (KeyError, UnicodeDecodeError, ValueError):
            pass
        observed[key.decode()] = item
    return observed

class RuntimeDatabaseScopeError(AssertionError):
    def __init__(self, endpoints):
        super().__init__('RUNTIME_DATABASE_SCOPE')
        self.endpoints = endpoints

def digest(path):
    assert path.is_file() and not path.is_symlink(), 'REGULAR_FILE_REQUIRED'
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_HOST'
    pg = pwd.getpwnam('postgres')
    def sql(query):
        result = subprocess.run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql', '-p', '5433', '-d', 'passvero_acceptance', '-v', 'ON_ERROR_STOP=1', '-c', "BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; " + query + '; ROLLBACK;'], user=pg.pw_uid, group=pg.pw_gid, extra_groups=[], cwd='/', env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}, capture_output=True, text=True, timeout=20)
        assert result.returncode == 0, 'READ_ONLY_QUERY_FAILED'
        return json.loads(result.stdout.strip())
    scope = sql("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'directory',current_setting('data_directory'))")
    assert scope == {'database': 'passvero_acceptance', 'port': '5433', 'directory': '/var/lib/postgresql/16/acceptance'}, 'DATABASE_SCOPE'
    user = pwd.getpwnam('passvero-staging')
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    result = subprocess.run(['/usr/bin/node', '-e', probe], user=user.pw_uid, group=user.pw_gid, extra_groups=os.getgrouplist(user.pw_name, user.pw_gid), cwd='/', env={'PATH': '/usr/bin:/bin'}, capture_output=True, text=True, timeout=10)
    assert result.returncode == 0, 'PM2_READ_FAILED'
    processes = json.loads(result.stdout)
    assert len(processes) == 1 and processes[0]['name'] == 'passvero-acceptance' and processes[0]['status'] == 'online' and processes[0]['cwd'] == str(APP), 'PROCESS_SCOPE'
    proc = pathlib.Path('/proc') / str(processes[0]['pid'])
    assert proc.stat().st_uid == user.pw_uid and (proc / 'cwd').resolve() == APP, 'PROCESS_IDENTITY'
    raw = dict(part.split(b'=', 1) for part in (proc / 'environ').read_bytes().split(b'\0') if b'=' in part)
    assert raw.get(b'PASSVERO_RUNTIME_ENV') == b'staging' and raw.get(b'BETTER_AUTH_URL') == b'https://staging.passvero.eu', 'RUNTIME_SCOPE'
    endpoints = runtime_database_endpoints(raw)
    if not all(item['valid'] for item in endpoints.values()):
        raise RuntimeDatabaseScopeError(endpoints)
    # No raw environment, passwords, token digests, message bodies or offer billing snapshots.
    inventory = sql('''SELECT json_build_object(
      'observedAt',clock_timestamp(),
      'migrations',(SELECT json_build_object('count',count(*),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name)),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL)) FROM _prisma_migrations),
      'organizations',(SELECT COALESCE(json_agg(x ORDER BY x.id),'[]') FROM (SELECT o.id,o."displayName",o.status,o."createdAt",
        (SELECT row_to_json(e) FROM "OrganizationEntitlementEnrollment" e WHERE e."organizationId"=o.id) AS entitlement,
        (SELECT json_agg(json_build_object('id',p.id,'planSlug',p."planSlug",'startsAt',p."startsAt",'endsAt',p."endsAt",'activationStatus',a.status,'limits',p.snapshot->'limits') ORDER BY p."startsAt") FROM "SubscriptionPaidPeriod" p LEFT JOIN "SubscriptionPaidPeriodActivation" a ON a."periodId"=p.id WHERE p."organizationId"=o.id) AS periods,
        (SELECT json_agg(json_build_object('basePeriodId',u."basePeriodId",'sequence',u.sequence,'startsAt',u."startsAt",'planSlug',u."planSlug")) FROM "SubscriptionUpgradeReceipt" u WHERE u."organizationId"=o.id) AS upgrades,
        (SELECT json_agg(json_build_object('userId',u.id,'email',lower(btrim(u.email)),'role',m.role,'membershipStatus',m.status,'verified',(SELECT count(*) FROM "AuthIdentity" i WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL)=1 AND (SELECT count(*) FROM "AuthIdentity" i JOIN "AuthProviderUser" a ON a.id=i."providerSubject" AND a.email=u.email AND a."emailVerified" WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL)=1)) FROM "Membership" m JOIN "User" u ON u.id=m."userId" WHERE m."organizationId"=o.id AND m.role='OWNER') AS owners,
        (SELECT json_build_object('email',p."billingEmail",'revision',p.revision,'confirmedEmail',c.email,'confirmedRevision',c."profileRevision",'revokedAt',c."revokedAt") FROM "OrganizationBillingProfile" p LEFT JOIN "BillingEmailConfirmation" c ON c."organizationId"=p."organizationId" WHERE p."organizationId"=o.id) AS billing
      FROM "Organization" o) x),
      'campaigns',(SELECT COALESCE(json_agg(c ORDER BY c.id),'[]') FROM "ReminderCampaign" c),
      'outbox',(SELECT COALESCE(json_agg(json_build_object('id',r.id,'organizationId',r."organizationId",'campaignId',r."campaignId",'revision',r.revision,'kind',r.kind,'threshold',r.threshold,'recipient',r.recipient,'deadline',r.deadline,'status',r.status,'attempts',r.attempts,'leaseUntil',r."leaseUntil",'nextAttemptAt',r."nextAttemptAt",'acceptedAt',r."acceptedAt",'receiptConfirmedAt',r."receiptConfirmedAt") ORDER BY r.id),'[]') FROM "SubscriptionReminder" r),
      'attemptCounts',(SELECT COALESCE(json_agg(a),'[]') FROM (SELECT status,count(*) FROM "ReminderAttempt" GROUP BY status) a),
      'futurePolicyTable',to_regclass('public."ReminderEnrollmentPolicy"') IS NOT NULL,
      'runtimeRoleSafe',(SELECT NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolbypassrls FROM pg_roles WHERE rolname='passvero_app'))''')
    canonical = json.loads(CANONICAL.read_text())
    build = (APP / '.next/BUILD_ID').read_text().strip()
    assert canonical['build_id'] == build, 'CANONICAL_BUILD_DRIFT'
    artifacts = {name: entry['sha256'] for name, entry in canonical['files'].items() if name.startswith(('.next/', 'messages/'))}
    for name, pin in artifacts.items():
        assert '..' not in pathlib.Path(name).parts and digest(APP / name) == pin, 'CANONICAL_ARTIFACT_DRIFT'
    dependencies = {name: digest(APP / 'node_modules' / name / 'package.json') for name in ['next', 'react', 'react-dom', 'next-intl', '@prisma/client', '@prisma/adapter-pg', '@better-auth/prisma-adapter', 'better-auth', 'pg', 'nodemailer', 'zod', 'prisma']}
    def unit(name):
        result = subprocess.run(['/usr/bin/systemctl', 'show', name, '--property=ActiveState,UnitFileState,Result,ExecMainStatus,InvocationID,ExecMainStartTimestamp,ExecMainExitTimestamp'], capture_output=True, text=True, timeout=10)
        assert result.returncode == 0, 'UNIT_READ_FAILED'
        return result.stdout.strip()
    print(json.dumps({'preflight': 'PASS', 'scope': scope, 'runtimeEndpoints': endpoints, 'buildId': build, 'canonicalSha256': digest(CANONICAL), 'verifiedArtifacts': len(artifacts), 'packageSha256': digest(APP / 'package.json'), 'lockSha256': digest(APP / 'package-lock.json'), 'runtimeDependencies': dependencies, 'workerSha256': digest(pathlib.Path('/usr/local/libexec/passvero-subscription-reminders/worker.cjs')), 'launcherSha256': digest(pathlib.Path('/usr/local/libexec/passvero-subscription-reminders/launch.py')), 'processes': processes, 'timer': unit('passvero-subscription-reminders.timer'), 'service': unit('passvero-subscription-reminders.service'), 'inventory': inventory, 'databaseWrites': 0, 'workerExecuted': False, 'emailsSent': 0}, indent=2))

if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        report = {'preflight': 'STOP', 'reason': str(error) if isinstance(error, AssertionError) else 'READ_ONLY_PREFLIGHT_FAILED', 'databaseWrites': 0, 'workerExecuted': False, 'emailsSent': 0}
        if isinstance(error, RuntimeDatabaseScopeError):
            report['runtimeEndpoints'] = error.endpoints
        print(json.dumps(report))
        sys.exit(1)
