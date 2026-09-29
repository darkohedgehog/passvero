#!/usr/bin/env python3
"""Read-only, sanitized staging preflight; run by the operator with sudo python3 -I -B."""
import hashlib
import json
import os
from pathlib import Path
import pwd
import subprocess
import sys

APP = Path('/var/www/passvero-acceptance')

def run(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('PREFLIGHT_COMMAND_FAILED')
    return result.stdout.strip()

def sql(query):
    return run(['runuser', '-u', 'postgres', '--', 'psql', '-XAt', '-v', 'ON_ERROR_STOP=1', '-p', '5433', '-d', 'passvero_acceptance', '-c', query])

def main():
    if os.geteuid() != 0 or len(sys.argv) != 2:
        raise RuntimeError('ROOT_AND_APPROVED_EMAIL_REQUIRED')
    email = sys.argv[1].strip().lower()
    if not email or len(email) > 254 or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789@._+-' for c in email):
        raise RuntimeError('INVALID_EMAIL')
    if run(['hostname']) != 'srv1834647' or not APP.is_dir():
        raise RuntimeError('STAGING_TARGET_MISMATCH')
    identity = sql("SELECT json_build_object('database',current_database(),'port',current_setting('port'),'dataDirectory',current_setting('data_directory'))")
    identity = json.loads(identity)
    if identity != {'database':'passvero_acceptance','port':'5433','dataDirectory':'/var/lib/postgresql/16/acceptance'}:
        raise RuntimeError('DATABASE_TARGET_MISMATCH')
    approved = sql("SELECT COALESCE(json_agg(x),'[]'::json) FROM (SELECT u.id AS user_id, EXISTS(SELECT 1 FROM \"AuthIdentity\" i JOIN \"AuthProviderUser\" p ON p.id=i.\"providerSubject\" WHERE i.\"userId\"=u.id AND i.provider='BETTER_AUTH' AND i.\"revokedAt\" IS NULL AND p.\"emailVerified\"=true AND p.email=u.email) AS verified FROM \"User\" u WHERE u.email='" + email + "') x")
    home = pwd.getpwnam('passvero-staging').pw_dir
    processes = json.loads(run(['runuser','-u','passvero-staging','--','env','PM2_HOME='+home+'/.pm2','pm2','jlist']))
    matches = [p for p in processes if p.get('name') == 'passvero-acceptance']
    if len(matches) != 1:
        raise RuntimeError('STAGING_PROCESS_MISMATCH')
    env = matches[0]['pm2_env']
    if env.get('pm_cwd') != str(APP):
        raise RuntimeError('STAGING_CWD_MISMATCH')
    report = {'preflight':'PASS','database':identity,'build':(APP/'.next/BUILD_ID').read_text().strip(),
              'packageHash':hashlib.sha256((APP/'package.json').read_bytes()).hexdigest(),
              'lockHash':hashlib.sha256((APP/'package-lock.json').read_bytes()).hexdigest(),
              'runtime':{'status':env.get('status'),'cwd':env.get('pm_cwd'),'node':run(['node','--version'])},
              'approvedAccount':json.loads(approved),
              'migrationState':json.loads(sql("SELECT json_build_object('latest',(SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1),'unfinished',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL),'platformTable',to_regclass('public.\"PlatformGrant\"') IS NOT NULL)")),
              'acl':json.loads(sql("SELECT json_build_object('migratorRole',EXISTS(SELECT 1 FROM pg_roles WHERE rolname='passvero_migrator'),'appProviderRead',has_table_privilege('passvero_app','\"AuthProviderSession\"','SELECT'),'appIdentityRead',has_table_privilege('passvero_app','\"AuthIdentity\"','SELECT'),'migratorAuditInsert',has_table_privilege('passvero_migrator','\"AuthAuditEvent\"','INSERT'),'migratorAuditRead',has_table_privilege('passvero_migrator','\"AuthAuditEvent\"','SELECT'))")),
              'migrationPackages':[str(p) for p in Path('/var/lib').glob('passvero-billing*') if p.is_dir()],
              'writes':'NONE','grant':'NOT_EXECUTED'}
    print(json.dumps(report,indent=2))

try:
    main()
except Exception:
    print('PLATFORM_PREFLIGHT_STOPPED: no mutation performed; inspect the preflight locally.',file=sys.stderr)
    sys.exit(1)
