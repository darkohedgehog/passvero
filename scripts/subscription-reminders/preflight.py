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
