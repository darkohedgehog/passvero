"""Restore only the verified B2 download into a new private socket-only PG16 cluster."""
import datetime
import contextlib
import errno
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import stat
import struct
import subprocess
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET = '20261001T212354Z'
SNAPSHOT = '2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2'
REPOSITORY = '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35'
MANIFEST = '2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132'
CAPTURE = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PG = '/usr/lib/postgresql/16/bin/'
DB = 'passvero_staging_recovery'
TARGET = ROOT / 'restore' / SET
DATA = TARGET / 'pgdata'
SOCKET = TARGET / 'socket'
CONTROL = ROOT / 'control' / SET
PHASE = 'RESTORE_PREFLIGHT'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'PGAPPNAME': 'passvero_isolated_recovery'}

class Stop(Exception):
    pass

def require(value, reason):
    if not value:
        raise Stop(reason)

def quote(value):
    require(isinstance(value, str) and '\0' not in value, 'SQL_IDENTIFIER')
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    require(isinstance(value, str) and '\0' not in value and '\\' not in value, 'SQL_LITERAL')
    return "'" + value.replace("'", "''") + "'"

def run(args, data=None, account=None, timeout=30):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout,
                            env=ENV, **(account or {}))
    require(result.returncode == 0, 'COMMAND_' + pathlib.Path(args[0]).name.upper().replace('-', '_') + '_FAILED')
    require(len(result.stdout) <= 32 * 1024 ** 2, 'COMMAND_RESPONSE_SIZE')
    return result.stdout

def cap_module():
    path = ROOT / 'operator' / ('capture-' + CAPTURE + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077
            and hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE, 'CAPTURE_IDENTITY')
    spec = importlib.util.spec_from_file_location('restore_capture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def sql(text, database=DB, readonly=True):
    prefix = "BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; " if readonly else ''
    output = run([PG+'psql', '-XqAt', '-h', str(SOCKET), '-p', '55434', '-U', 'postgres',
                  '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', prefix+text])
    return json.loads(output) if readonly else output

def verify_download(cap):
    proof = cap.read(TARGET / 'download-proof.json')
    require(proof['offsite'] == 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED'
            and proof['snapshotId'] == SNAPSHOT and proof['repositoryId'] == REPOSITORY
            and proof['manifestSha256'] == MANIFEST and proof['setId'] == SET,
            'OFFSITE_PROOF_IDENTITY')
    source = TARGET / 'download' / (ROOT / 'sets' / SET).relative_to('/')
    require(hashlib.sha256((source/'recovery-set.json').read_bytes()).hexdigest() == MANIFEST,
            'DOWNLOADED_MANIFEST_CHANGED')
    manifest = cap.read(source/'recovery-set.json')
    expected = manifest['files']
    found = set()
    for path in source.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'DOWNLOAD_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if path.is_file():found.add(str(path.relative_to(source)))
    require(found == set(expected) | {'recovery-set.json'}, 'DOWNLOAD_INVENTORY')
    for name, item in expected.items():
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,
                'DOWNLOAD_PATH')
        path = source/name
        require(path.stat().st_size == item['bytes']
                and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], 'DOWNLOAD_CHECKSUM')
    require(sum((source/name).stat().st_size for name in found) == 964172, 'PAYLOAD_CHANGED')
    return source

def role_sql(rows):
    statements = []
    for row in rows:
        name = row['name']
        require(re.fullmatch('passvero_[a-z0-9_]+', name) and not row['superuser'], 'SOURCE_ROLE_SCOPE')
        # No role password is restored. Local peer rules reject these roles; only postgres connects.
        flags = ['NOSUPERUSER', 'INHERIT' if row['inherit'] else 'NOINHERIT',
                 'CREATEROLE' if row['createRole'] else 'NOCREATEROLE',
                 'CREATEDB' if row['createDb'] else 'NOCREATEDB',
                 'LOGIN' if row['login'] else 'NOLOGIN',
                 'BYPASSRLS' if row['bypassRls'] else 'NOBYPASSRLS']
        statements.append('CREATE ROLE '+quote(name)+' '+' '.join(flags)+';')
    return '\n'.join(statements)

def database_acl(value, apply=False):
    if value is None:return None
    rows = sql("SELECT coalesce(json_agg(json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable) ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json) FROM aclexplode("+literal(value)+"::aclitem[])")
    if apply:
        owner = sql("SELECT to_json(pg_get_userbyid(datdba)) FROM pg_database WHERE datname=current_database()")
        sql('REVOKE ALL ON DATABASE '+quote(DB)+' FROM PUBLIC, '+quote(owner),readonly=False)
        for row in rows:
            require(row['privilege'] in ('CONNECT','CREATE','TEMPORARY'), 'DATABASE_PRIVILEGE')
            for key in ('grantor','grantee'):
                require(row[key] in ('postgres','PUBLIC') or re.fullmatch('passvero_[a-z0-9_]+',row[key]), 'DATABASE_ACL_ROLE')
            target = 'PUBLIC' if row['grantee']=='PUBLIC' else quote(row['grantee'])
            sql('SET ROLE '+quote(row['grantor'])+'; GRANT '+row['privilege']+' ON DATABASE '+quote(DB)+' TO '+target+
                (' WITH GRANT OPTION' if row['option'] else '')+'; RESET ROLE;',readonly=False)
    return sorted(rows,key=lambda r:(r['grantor'],r['grantee'],r['privilege'],r['option']))

ACL_NAME = 'system.posix_acl_access'

def get_acl(path):
    try:return os.getxattr(path, ACL_NAME, follow_symlinks=False)
    except OSError as error:
        if error.errno == errno.ENODATA:return None
        raise

def traversal_acl(uid):
    require(type(uid) is int and 0 < uid < 0xffffffff, 'POSTGRES_UID')
    return struct.pack('<I',2)+b''.join(struct.pack('<HHI',tag,perm,identity) for tag,perm,identity in
        ((1,7,0xffffffff),(2,1,uid),(4,0,0xffffffff),(16,1,0xffffffff),(32,0,0xffffffff)))

def acl_baseline(parents):
    rows=[]
    for path in parents:
        info=path.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700,
                'PRIVATE_PARENT_IDENTITY')
        require(get_acl(path) is None,'EXISTING_PARENT_ACL_REQUIRES_REVIEW')
        rows.append({'path':str(path),'device':info.st_dev,'inode':info.st_ino,'uid':info.st_uid,
                     'gid':info.st_gid,'mode':0o700})
    return rows

def restore_parents(rows, uid):
    require([row['path'] for row in rows] == [str(ROOT),str(ROOT/'restore'),str(TARGET)], 'ACL_RESTORE_SCOPE')
    errors=[]
    for row in rows:
        try:
            path=pathlib.Path(row['path']);info=path.lstat()
            require(stat.S_ISDIR(info.st_mode) and (info.st_dev,info.st_ino,info.st_uid,info.st_gid) ==
                    (row['device'],row['inode'],row['uid'],row['gid']) and row['mode']==0o700,
                    'ACL_PARENT_CHANGED')
            current=get_acl(path)
            require(current in (None,traversal_acl(uid)),'ACL_PARENT_UNEXPECTED')
            if current is not None:os.removexattr(path,ACL_NAME,follow_symlinks=False)
            os.chmod(path,0o700,follow_symlinks=False)
            require(get_acl(path) is None and stat.S_IMODE(path.lstat().st_mode)==0o700,'ACL_CLOSE_VERIFY')
        except Exception:errors.append(row['path'])
    require(not errors,'ACL_PARENT_CLOSURE_FAILED')

def prior_preflight_stop(cap):
    previous=ROOT/'operator'/'restore-database-15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034.py'
    cap.private(previous)
    require(hashlib.sha256(previous.read_bytes()).hexdigest() == '15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034','PRIOR_HELPER_CHANGED')
    closure=cap.read(CONTROL/'restore-closure.json')
    require(closure['restoreClosure']=='PASS' and closure['restoreCluster']=='STOPPED'
            and closure['parentPermissions']=='PRIVATE_0700_RESTORED','PRIOR_CLOSURE')
    properties=run(['/usr/bin/systemctl','show','passvero-stage-restore-20261001T212354Z.service',
                    '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode()
    values=dict(line.split('=',1) for line in properties.splitlines() if '=' in line)
    require(values == {'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                       'InvocationID':'e2d37c7e744149efb0afbe3ea63f76c8'},'PRIOR_UNIT_CHANGED')
    require(not (CONTROL/'restore-attempt.json').exists() and not (CONTROL/'restore-parent-acl.txt').exists(),
            'PRIOR_RESTORE_MUTATION_FOUND')

def repair_closure_permissions(cap):
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists()
            and not (CONTROL/'restore-parent-acl-stdlib.json').exists(), 'PREVIOUS_RESTORE_MUTATION_FOUND')
    unit='passvero-stage-restore-20261001T212354Z-acl-stdlib.service'
    values=dict(line.split('=',1) for line in run(['/usr/bin/systemctl','show',unit,
        '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode().splitlines() if '=' in line)
    require(values=={'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                     'InvocationID':'d3b214d0c90944acb5be57f7656da545'},'STDLIB_PRIOR_UNIT_CHANGED')
    previous=ROOT/'operator'/'restore-database-9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7.py'
    cap.private(previous)
    require(hashlib.sha256(previous.read_bytes()).hexdigest()=='9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7','STDLIB_PRIOR_HELPER_CHANGED')
    expected={'restoreClosure':'PASS','setId':SET,'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED','staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
              'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    with contextlib.ExitStack() as stack:
        files=[]
        for name in ('restore-closure.json','restore-closure-stdlib.json'):
            fd=os.open(CONTROL/name,os.O_RDONLY|os.O_NOFOLLOW)
            stack.callback(os.close,fd)
            info=os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_nlink==1
                    and stat.S_IMODE(info.st_mode)==0o644 and info.st_size<8192,'CLOSURE_REPAIR_POSTURE')
            body=os.read(fd,8192)
            require(json.loads(body)==expected,'CLOSURE_REPAIR_CONTENT')
            files.append((name,fd,body,info))
        cap.write(CONTROL/'closure-permission-repair.json',{'setId':SET,'scope':'TWO_NONSECRET_CLOSURE_FILES_ONLY',
            'files':[{'name':name,'beforeMode':'0644','afterMode':'0600','sha256':hashlib.sha256(body).hexdigest()}
                     for name,fd,body,info in files]})
        for name,fd,body,info in files:
            os.fchmod(fd,0o600)
            os.lseek(fd,0,os.SEEK_SET)
            after=os.fstat(fd)
            require(os.read(fd,8192)==body and stat.S_IMODE(after.st_mode)==0o600
                    and (after.st_ino,after.st_dev,after.st_uid)==(info.st_ino,info.st_dev,info.st_uid),
                    'CLOSURE_REPAIR_VERIFY')
    print(json.dumps({'closurePermissionRepair':'PASS_TWO_FILES_0644_TO_0600',
                      'contentsUnchanged':True,'stagingPauseRequested':False}),flush=True)

def close():
    """ExecStopPost runs after systemd has terminated every process in this private unit."""
    os.umask(0o077)
    cap = cap_module()
    saved = CONTROL/'restore-parent-acl-stdlib.json'
    if saved.exists():
        state=cap.read(saved)
        restore_parents(state['parents'],state['postgresUid'])
    for path in (ROOT, ROOT/'restore', TARGET):cap.private(path, True)
    active = []
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry/'cmdline').read_bytes().split(b'\0')
                if str(DATA).encode() in args and args and args[0] == (PG+'postgres').encode():
                    active.append(entry.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):pass
    require(not active, 'RESTORE_CLUSTER_STILL_RUNNING')
    prepare, _ = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    result = {'restoreClosure':'PASS', 'setId':SET, 'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED', 'staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE', 'campaignsEnabled':0,
              'artifactsRetained':True, 'smtpCalls':0, 'telegramCalls':0}
    cap.write(CONTROL/'restore-closure-private.json', result)
    print(json.dumps(result))

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap_module()
    cap.validate_context(SET)
    for path in (ROOT/'restore', TARGET):cap.private(path, True)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    repair_closure_permissions(cap)
    prior_preflight_stop(cap)
    source = verify_download(cap)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4*1024**3, 'FREE_SPACE_LIMIT')
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists(), 'RESTORE_ALREADY_ATTEMPTED')
    for executable in ('initdb','pg_ctl','pg_restore','psql'):
        require(' 16.' in run([PG+executable,'--version']).decode(), 'PG16_BINARY')
    parents = [ROOT, ROOT/'restore', TARGET]
    acl = acl_baseline(parents)
    meta = cap.read(source/'database/manifest.json')
    owner = meta['catalog']['database']['owner']
    require(owner in {row['name'] for row in meta['catalog']['roles']}, 'DATABASE_OWNER_NOT_CAPTURED')
    require(meta['catalog']['database']['encoding'] == 'UTF8', 'DATABASE_ENCODING')
    role_commands = role_sql(meta['catalog']['roles'])
    cap.write(CONTROL/'restore-attempt.json', {'setId':SET,'snapshotId':SNAPSHOT,'automaticRetry':False})
    postgres = pwd.getpwnam('postgres')
    account = prepare.account('postgres')
    cap.write(CONTROL/'restore-parent-acl-stdlib.json', {'parents':acl,'postgresUid':postgres.pw_uid})
    # Same execute-only named-user ACL as setfacl; direct Linux xattr, no package dependency.
    for path in parents:
        os.setxattr(path,ACL_NAME,traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(get_acl(path)==traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    for path in (DATA,SOCKET):
        path.mkdir(mode=0o700)
        os.chown(path,postgres.pw_uid,postgres.pw_gid)
    PHASE = 'INITIALIZE_NEW_PRIVATE_PG16'
    run([PG+'initdb','-D',str(DATA),'--no-clean','--encoding=UTF8','--locale-provider=libc',
         '--lc-collate='+meta['catalog']['database']['collate'],
         '--lc-ctype='+meta['catalog']['database']['ctype'],'--auth-local=peer','--auth-host=reject'],
        account=account,timeout=90)
    # Only local root/postgres can authenticate as postgres. No trust/passwords or TCP listener.
    (DATA/'pg_ident.conf').write_text('recovery_operator root postgres\nrecovery_operator postgres postgres\n')
    (DATA/'pg_hba.conf').write_text('local all postgres peer map=recovery_operator\nlocal all all reject\n')
    for name in ('pg_ident.conf','pg_hba.conf'):
        os.chown(DATA/name,postgres.pw_uid,postgres.pw_gid)
        (DATA/name).chmod(0o600)
    run([PG+'pg_ctl','-D',str(DATA),'-l',str(DATA/'restore.log'),'-w','-t','30','start','-o',
         "-c listen_addresses='' -c port=55434 -c unix_socket_directories="+str(SOCKET)+
         ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'],account=account)
    PHASE = 'RESTORE_DATABASE_OWNERS_AND_ACLS'
    settings = sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'))",database='postgres')
    require(settings == {'data':str(DATA),'tcp':'','port':'55434'}, 'ISOLATED_CLUSTER_IDENTITY')
    sql(role_commands,database='postgres',readonly=False)
    sql('CREATE DATABASE '+quote(DB)+' OWNER '+quote(owner)+" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE "+
        literal(meta['catalog']['database']['collate'])+' LC_CTYPE '+literal(meta['catalog']['database']['ctype']),database='postgres',readonly=False)
    # Stream the root-private downloaded dump; preserve ownership/ACLs. Never --clean/--create/no-owner/no-acl.
    with open(source/'database/passvero_acceptance.dump','rb') as dump:
        result = subprocess.run([PG+'pg_restore','--exit-on-error','--single-transaction','-h',str(SOCKET),
            '-p','55434','-U','postgres','-d',DB],stdin=dump,capture_output=True,env=ENV,timeout=120)
    require(result.returncode == 0, 'PG_RESTORE_FAILED')
    database_acl(meta['catalog']['database']['acl'],apply=True)
    PHASE = 'VERIFY_RESTORED_DATABASE'
    current = sql(cap.CATALOG)
    # CREATE DATABASE is intentionally renamed. Database-level ACL has a separate explicit check below.
    require({k:v for k,v in current.items() if k != 'database'} ==
            {k:v for k,v in meta['catalog'].items() if k != 'database'}, 'RESTORED_CATALOG_MISMATCH')
    tables = sql(cap.TABLES)
    counts = {name:sql('SELECT count(*) FROM '+cap.identifier(name)) for name in tables}
    require(counts == meta['counts'], 'RESTORED_COUNTERS_MISMATCH')
    require(sql(cap.SEQUENCES) == meta['sequences'], 'RESTORED_SEQUENCES_MISMATCH')
    assets = sql(references.QUERY)
    storage = cap.read(source/'storage/manifest.json')
    require(assets['enabledCampaigns'] == 0 and assets['references'] == storage['references'], 'RESTORED_ASSET_REFERENCES')
    require(references.reconcile(storage['objects'],assets['references']) == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    require(current['database']['owner'] == owner and all(current['database'][k] == meta['catalog']['database'][k]
            for k in ('encoding','collate','ctype')), 'RESTORED_DATABASE_SETTINGS')
    require(database_acl(current['database']['acl']) == database_acl(meta['catalog']['database']['acl']),
            'RESTORED_DATABASE_ACL_MISMATCH')
    result = {'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP', 'setId':SET,'snapshotId':SNAPSHOT,
        'database':DB,'tables':len(tables),'migrations':len(current['migrations']),
        'catalogOwnersAndAcls':'MATCH','databaseAcl':'MATCH_SEMANTIC_PRIVILEGES','allTableCounters':'MATCH',
        'sequences':'MATCH','databaseAssetReferences':len(assets['references']),
        'storageObjects':len(storage['objects']),'acceptedCleanupTombstones':4,
        'tcpListener':False,'isolatedApplicationRead':'NOT_YET_RUN','storageProviderRestore':'NOT_PERFORMED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'automaticRetry':False}
    prepare.runtime()
    cap.gates(prepare)
    cap.write(CONTROL/'database-restore-summary.json',result)
    print(json.dumps(result),flush=True)
    PHASE = 'STOP_PRIVATE_RESTORE_CLUSTER'
    run([PG+'pg_ctl','-D',str(DATA),'-m','fast','-w','-t','20','stop'],account=account)

if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--close']:close()
        else:
            signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(Stop('OPERATOR_INTERRUPTED')))
            main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
        result = {'databaseRestore':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
                  'stagingPauseRequested':False,'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
        print(json.dumps(result),flush=True)
        sys.exit(1)
