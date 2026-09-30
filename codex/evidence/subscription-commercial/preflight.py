"""Operator-only read-only staging scope/identity probe. Never reads credentials."""
import hashlib, json, os, pathlib, pwd, subprocess, sys
P=pathlib.Path
A=P('/var/www/passvero-acceptance')
phase='SCOPE'
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    pg=pwd.getpwnam('postgres')
    def sql(query):
        result=subprocess.run(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance','-v','ON_ERROR_STOP=1','-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; "+query+'; ROLLBACK;'],user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'},capture_output=True,text=True,timeout=15)
        assert result.returncode==0,'READ_ONLY_QUERY_FAILED'
        return json.loads(result.stdout.strip())
    identity=sql("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'dataDirectory',current_setting('data_directory'))")
    assert identity=={'database':'passvero_acceptance','port':'5433','dataDirectory':'/var/lib/postgresql/16/acceptance'},'DATABASE_SCOPE'
    phase='READ_ONLY'
    accounts=sql('''SELECT COALESCE(json_agg(x),'[]'::json) FROM (SELECT u.id, u.email, EXISTS(SELECT 1 FROM "AuthIdentity" i JOIN "AuthProviderUser" p ON p.id=i."providerSubject" WHERE i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL AND p."emailVerified" AND p.email=u.email) AS verified, EXISTS(SELECT 1 FROM "PlatformGrant" g WHERE g."userId"=u.id AND g."revokedAt" IS NULL) AS platform_read_grant FROM "User" u WHERE u.email IN ('zivic.darko79@gmail.com','prodaja@zivic-elektro.com') ORDER BY u.email) x''')
    migrations=sql('''SELECT COALESCE(json_agg(x ORDER BY x.migration_name),'[]'::json) FROM (SELECT migration_name, checksum, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations) x''')
    synthetic=sql('''SELECT json_build_object('matchingOrganizations',count(*)) FROM "Organization" WHERE "displayName"='SYNTHETIC — Subscription commercial acceptance' ''')
    def digest(path):
        assert path.is_file() and not path.is_symlink(),'EXPECTED_REGULAR_FILE'
        return hashlib.sha256(path.read_bytes()).hexdigest()
    print(json.dumps({'preflight':'PASS','database':identity,'buildId':(A/'.next/BUILD_ID').read_text().strip(),'packageHash':digest(A/'package.json'),'lockHash':digest(A/'package-lock.json'),'retainedOperatorHash':digest(A/'.controlled-onboarding/review-access-requests.mjs'),'accounts':accounts,'migrations':migrations,'synthetic':synthetic,'writes':'NONE','billingGrant':'NOT_EXECUTED','organizationChange':'NOT_EXECUTED'},indent=2))
except Exception as error:
    print(json.dumps({'preflight':'STOP','phase':phase,'reason':str(error) if isinstance(error,AssertionError) else 'READ_ONLY_CHECK_FAILED','writes':'NONE'}))
    sys.exit(1)
