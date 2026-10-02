"""One approved staging pause; independent systemd post-stop resume; no B2 writes."""
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import resource
import select
import shutil
import socket
import stat
import subprocess
import sys
import time

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
APP = pathlib.Path('/var/www/passvero-acceptance')
SEED = '20261001T190516Z'
PREP_PIN = 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
REF_PIN = '2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376'
PG = '/usr/lib/postgresql/16/bin/'
GIB = 1024 ** 3
CAPTURE_SECONDS = 85
RESUME_SECONDS = 25
FAILED_SET = '20261001T203612Z'
FIRST_CLAIM = 'one-pause-approved-20261001.json'
ADDITIONAL_CLAIM = 'additional-pause-after-20261001T203612Z.json'
PHASE = 'BOOTSTRAP'


class Stop(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Stop(reason)


def write(path, value):
    with open(path, 'x', encoding='utf8') as handle:
        json.dump(value, handle, indent=2, sort_keys=True)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def private(path, directory=False):
    info = path.lstat()
    require(info.st_uid == 0 and not info.st_mode & 0o077 and
            (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)), 'PRIVATE_PATH')
    return info


def read(path):
    private(path)
    require(path.stat().st_size < 32 * 1024 ** 2, 'PRIVATE_MANIFEST_SIZE')
    return json.loads(path.read_text())


def module(path, pin, name):
    private(path)
    require(hashlib.sha256(path.read_bytes()).hexdigest() == pin, 'REVIEWED_HELPER_HASH')
    spec = importlib.util.spec_from_file_location(name, path)
    loaded = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(loaded)
    return loaded


def helpers():
    return (module(ROOT / 'operator' / ('prepare-' + PREP_PIN + '.py'), PREP_PIN, 'prepare'),
            module(ROOT / 'operator' / ('references-' + REF_PIN + '.py'), REF_PIN, 'references'))


def command(args, timeout=8, **kwargs):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                            timeout=timeout, **kwargs)
    require(result.returncode == 0, 'COMMAND_FAILED')
    return result.stdout


def duration_property(object_path, name):
    raw = command(['/usr/bin/busctl', 'get-property', 'org.freedesktop.systemd1',
                   object_path, 'org.freedesktop.systemd1.Service', name]).decode().strip()
    require(re.fullmatch(r't [0-9]+', raw), 'SYSTEMD_DURATION_FORMAT')
    return int(raw.split()[1])


def guard_properties(unit, helper, set_id, maximum, stop_timeout):
    raw = command(['/usr/bin/busctl', 'call', 'org.freedesktop.systemd1',
                   '/org/freedesktop/systemd1', 'org.freedesktop.systemd1.Manager',
                   'GetUnit', 's', unit]).decode().strip()
    require(re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"', raw), 'SYSTEMD_UNIT_IDENTITY')
    object_path = raw[3:-1]
    require(duration_property(object_path, 'RuntimeMaxUSec') == maximum * 1000000
            and duration_property(object_path, 'TimeoutStopUSec') == stop_timeout * 1000000,
            'SYSTEMD_DEADLINE_NOT_APPLIED')
    output = command(['/usr/bin/systemctl', 'show', unit,
                      '--property=Type,KillMode,KillSignal,Restart,User,ExecStopPost']).decode()
    properties = dict(x.split('=', 1) for x in output.splitlines() if '=' in x)
    expected = f'/usr/bin/python3 -B {helper} --resume {set_id}'
    require(properties.get('Type') == 'exec' and properties.get('KillMode') == 'control-group'
            and properties.get('KillSignal') == '9' and properties.get('Restart') == 'no'
            and properties.get('User') in ('', 'root')
            and ('argv[]=' + expected) in properties.get('ExecStopPost', ''), 'SYSTEMD_RESUME_NOT_APPLIED')


def unit_command(helper, set_id, proof=False):
    unit = 'passvero-stage-' + ('guard-proof-' if proof else 'capture-') + set_id
    post_mode = '--proof-post' if proof else '--resume'
    return ['/usr/bin/systemd-run', '--quiet', '--wait', '--unit', unit,
            '--property=Type=exec', '--property=Restart=no', '--property=KillMode=control-group',
            '--property=KillSignal=SIGKILL', '--property=RuntimeMaxSec=' + ('1s' if proof else '85s'),
            '--property=TimeoutStopSec=' + ('3s' if proof else '25s'),
            '--property=StandardInput=null', '--property=StandardOutput=null', '--property=StandardError=null',
            '--property=ExecStopPost=/usr/bin/python3 -B ' + str(helper) + ' ' + post_mode + ' ' + set_id,
            '/usr/bin/python3', '-B', str(helper), '--proof-body' if proof else '--capture', set_id]


def monitor(prepare, timeout=4):
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),3000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    rows = json.loads(command(['/usr/bin/node', '-e', probe], timeout=timeout,
                              **prepare.account('passvero-staging'), env={'PATH': '/usr/bin:/bin'}))
    require(len(rows) == 1 and rows[0]['name'] == 'passvero-acceptance'
            and rows[0]['cwd'] == str(APP), 'PM2_SCOPE')
    return rows[0]


def pm2(prepare, action, timeout):
    require(action in ('stop', 'restart'), 'PM2_ACTION_SCOPE')
    # RPC uses the existing daemon only; the PM2 CLI could spawn a new daemon
    # inside this transient unit and lose the resumed app when the unit exits.
    probe = """const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon');
const r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc');
const s=a.socket('req'),c=new r.Client(s);
setTimeout(()=>process.exit(2),TIMEOUT);
s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{
 if(e||!Array.isArray(v)||v.length!==1)process.exit(1);
 const p=v[0],id=p.pm2_env.pm_id;
 if(p.name!=='passvero-acceptance'||p.pm2_env.pm_cwd!=='/var/www/passvero-acceptance'
    ||!Number.isInteger(id)||id<0)process.exit(1);
 c.call(METHOD,ARGUMENT,(error)=>{
  if(error)process.exit(1);s.close();process.exit(0);
 });
}));
s.connect('/home/passvero-staging/.pm2/rpc.sock');"""
    method = 'stopProcessId' if action == 'stop' else 'restartProcessId'
    probe = probe.replace('TIMEOUT', str(max(1, timeout - 1) * 1000))
    probe = probe.replace('METHOD', json.dumps(method)).replace('ARGUMENT', 'id' if action == 'stop' else '{id}')
    return command(['/usr/bin/node', '-e', probe], timeout=timeout,
                   **prepare.account('passvero-staging'),
                   env={'PATH': '/usr/bin:/bin'})


def source_workers(prepare):
    uid = prepare.account('passvero-staging')['user']
    count = 0
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            if path.stat().st_uid == uid and (path / 'cwd').resolve() == APP:
                count += 1
        except (FileNotFoundError, ProcessLookupError, PermissionError):
            continue
    return count


def inventory(prepare, env):
    objects = []
    for bucket in prepare.BUCKETS:
        with prepare.storage_request(env, 'bucket/' + bucket) as response:
            info = json.loads(response.read(16385))
        require(info.get('id') == bucket and info.get('public') is False, 'STORAGE_PRIVACY')
        def page(prefix, offset):
            with prepare.storage_request(env, 'object/list/' + bucket, {'prefix': prefix, 'offset': offset,
                    'limit': 100, 'sortBy': {'column': 'name', 'order': 'asc'}}) as response:
                data = response.read(2 * 1024 ** 2 + 1)
                require(len(data) <= 2 * 1024 ** 2, 'STORAGE_PAGE_SIZE')
                return json.loads(data)
        objects.extend(dict(x, bucket=bucket) for x in prepare.inventory(page))
    return objects


def metadata(objects):
    return sorted([{k: v for k, v in x.items() if k not in ('file', 'sha256')}
                   for x in objects], key=lambda x: (x['bucket'], x['key']))


def verify_storage_bytes(prepare, env, objects):
    for item in objects:
        import urllib.parse
        path = 'object/authenticated/' + item['bucket'] + '/' + urllib.parse.quote(item['key'], safe='/')
        size = 0
        digest = hashlib.sha256()
        with prepare.storage_request(env, path) as response:
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= item['size'], 'STORAGE_BYTES_CHANGED')
                digest.update(chunk)
        require(size == item['size'] and digest.hexdigest() == item['sha256'], 'STORAGE_BYTES_CHANGED')


def configurations(prepare, process, env, seed):
    raw = dict(x.split(b'=', 1) for x in (pathlib.Path('/proc') / str(process['pid']) / 'environ').read_bytes().split(b'\0') if b'=' in x)
    scanner = json.loads(raw[b'DOCUMENT_SCAN_CONFIG'])
    fields = {'qpdfLauncherPath', 'qpdfTemporaryRoot', 'clamavSocketPath', 'healthEvidencePath', 'malwareSignatures'}
    require(set(scanner) == fields and scanner['qpdfLauncherPath'] == '/usr/local/libexec/passvero-qpdf-launch'
            and scanner['qpdfTemporaryRoot'] == '/run/passvero-qpdf/input', 'SCANNER_CONFIG_SCOPE')
    for key in fields - {'malwareSignatures'}:
        require(isinstance(scanner[key], str) and re.fullmatch(r'/(?:[A-Za-z0-9_-][A-Za-z0-9_.-]*/)*[A-Za-z0-9_-][A-Za-z0-9_.-]*', scanner[key]), 'SCANNER_PATH')
    signatures = scanner['malwareSignatures']
    require(isinstance(signatures, list) and 1 <= len(signatures) <= 256
            and all(isinstance(x, str) and len(x) <= 256 and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.:-]*', x)
                    and not re.match(r'(?i)(Heuristics|PUA)\.', x) for x in signatures)
            and len(set(x.lower() for x in signatures)) == len(signatures), 'SCANNER_SIGNATURES')
    require(raw[b'DOCUMENT_SCAN_ENABLED'] in (b'true', b'false'), 'SCANNER_ENABLED')
    require(re.fullmatch(r'https://[a-z0-9]{20}\.supabase\.co', env['DOCUMENT_STORAGE_SUPABASE_URL']), 'STORAGE_ORIGIN')
    source = {'packageSha256': hashlib.sha256((APP / 'package.json').read_bytes()).hexdigest(),
              'lockSha256': hashlib.sha256((APP / 'package-lock.json').read_bytes()).hexdigest(),
              'buildId': (APP / '.next/BUILD_ID').read_text().strip(), 'node': command(['/usr/bin/node', '--version']).decode().strip(),
              'pgDump': command([PG + 'pg_dump', '--version']).decode().strip()}
    require(source['packageSha256'] == seed['sourcePackageSha256'] and source['lockSha256'] == seed['sourceLockSha256']
            and source['buildId'] == seed['buildId'] and re.fullmatch(r'[A-Za-z0-9_-]{1,128}', source['buildId'])
            and ' 16.' in source['pgDump'], 'SOURCE_BUILD_CHANGED')
    source['qpdfLauncherSha256'] = hashlib.sha256(pathlib.Path(scanner['qpdfLauncherPath']).read_bytes()).hexdigest()
    actions = pathlib.Path('/usr/lib/node_modules/pm2/lib/God/ActionMethods.js')
    info = actions.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
            'EXISTING_PM2_ACTION_POSTURE')
    body = actions.read_bytes()
    require(b'God.stopProcessId = function' in body and b'God.restartProcessId = function' in body,
            'EXISTING_PM2_ACTION_COMPATIBILITY')
    source['pm2ActionsSha256'] = hashlib.sha256(body).hexdigest()
    source['pm2Version'] = json.loads(pathlib.Path('/usr/lib/node_modules/pm2/package.json').read_text())['version']
    settings = prepare.sql("SELECT json_build_object('settings',(SELECT json_object_agg(name,setting) FROM pg_settings WHERE name IN ('server_version_num','port','listen_addresses','server_encoding','TimeZone','lc_collate','lc_ctype','max_connections','shared_buffers','ssl')),'hba',(SELECT json_agg(json_build_object('type',type,'database',database,'roles',user_name,'address',address,'netmask',netmask,'method',auth_method,'optionNames',(SELECT json_agg(split_part(v,'=',1)) FROM unnest(options) v),'error',error) ORDER BY line_number) FROM pg_hba_file_rules))")
    require(all(x['error'] is None for x in settings['hba']), 'HBA_PARSE_ERROR')
    return {'runtime.json': {'environment': 'staging', 'origin': env['BETTER_AUTH_URL'],
            'storageOrigin': env['DOCUMENT_STORAGE_SUPABASE_URL'], 'buckets': list(prepare.BUCKETS),
            'pm2': {'name': process['name'], 'cwd': str(APP), 'uid': prepare.account('passvero-staging')['user']},
            'database': {'socket': '/var/run/postgresql', 'port': 5433, 'name': 'passvero_acceptance',
                         'runtimeRole': 'passvero_app', 'authRole': 'passvero_auth', 'ownerRole': 'passvero_migrator'}},
            'scanner.json': {'enabled': raw[b'DOCUMENT_SCAN_ENABLED'] == b'true', 'configuration': scanner,
                             'freshTrustRestored': False, 'secretRecovery': 'INDEPENDENT_PROTECTED_ESCROW'},
            'source.json': source, 'postgresql.json': settings}


CATALOG = '''SELECT json_build_object(
 'database',(SELECT json_build_object('owner',pg_get_userbyid(datdba),'encoding',pg_encoding_to_char(encoding),
 'collate',datcollate,'ctype',datctype,'acl',datacl::text) FROM pg_database WHERE datname=current_database()),
 'schemas',(SELECT json_agg(json_build_object('name',nspname,'owner',pg_get_userbyid(nspowner),'acl',nspacl::text) ORDER BY nspname)
 FROM pg_namespace WHERE nspname='public'),
 'relations',(SELECT json_agg(json_build_object('name',c.relname,'kind',c.relkind,'owner',pg_get_userbyid(c.relowner),
 'acl',c.relacl::text,'rls',c.relrowsecurity,'forceRls',c.relforcerowsecurity) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind IN ('r','p','S','v','m','f')),
 'columns',(SELECT json_agg(json_build_object('table',c.relname,'column',a.attname,'type',format_type(a.atttypid,a.atttypmod),
 'notNull',a.attnotnull,'default',pg_get_expr(d.adbin,d.adrelid),'identity',a.attidentity,'generated',a.attgenerated) ORDER BY c.relname,a.attnum)
 FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace
 LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname='public' AND a.attnum>0 AND NOT a.attisdropped AND c.relkind IN ('r','p')),
 'constraints',(SELECT json_agg(json_build_object('table',c.relname,'name',k.conname,'definition',pg_get_constraintdef(k.oid)) ORDER BY c.relname,k.conname)
 FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'),
 'indexes',(SELECT json_agg(json_build_object('name',c.relname,'definition',pg_get_indexdef(c.oid)) ORDER BY c.relname)
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='i'),
 'enums',(SELECT json_agg(json_build_object('name',t.typname,'owner',pg_get_userbyid(t.typowner),'acl',t.typacl::text,'label',e.enumlabel) ORDER BY t.typname,e.enumsortorder)
 FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public'),
 'functions',(SELECT json_agg(json_build_object('name',p.proname,'arguments',pg_get_function_identity_arguments(p.oid),
 'owner',pg_get_userbyid(p.proowner),'acl',p.proacl::text,'definition',pg_get_functiondef(p.oid)) ORDER BY p.proname,pg_get_function_identity_arguments(p.oid))
 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind IN ('f','p')),
 'defaultAcls',(SELECT json_agg(json_build_object('role',pg_get_userbyid(d.defaclrole),'schema',coalesce(n.nspname,''),'type',d.defaclobjtype,'acl',d.defaclacl::text)
 ORDER BY pg_get_userbyid(d.defaclrole),coalesce(n.nspname,''),d.defaclobjtype) FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid=d.defaclnamespace),
 'roles',(SELECT json_agg(json_build_object('name',rolname,'superuser',rolsuper,'inherit',rolinherit,'createRole',rolcreaterole,
 'createDb',rolcreatedb,'login',rolcanlogin,'bypassRls',rolbypassrls) ORDER BY rolname) FROM pg_roles WHERE rolname LIKE 'passvero_%'),
 'migrations',(SELECT json_agg(json_build_object('name',migration_name,'checksum',checksum,'finishedAt',finished_at,'rolledBackAt',rolled_back_at)
 ORDER BY migration_name) FROM _prisma_migrations),
 'pendingDocuments',(SELECT count(*) FROM "Document" WHERE status='PENDING_UPLOAD' OR "malwareScanStatus"='PENDING'),
 'pendingImages',(SELECT count(*) FROM "ProductImageAsset" WHERE state='PENDING'),
 'nonPublicSchemas',(SELECT count(*) FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('information_schema','public')),
 'largeObjects',(SELECT count(*) FROM pg_largeobject_metadata))'''
TABLES = "SELECT coalesce(json_agg(tablename ORDER BY tablename),'[]'::json) FROM pg_tables WHERE schemaname='public'"
SEQUENCES = "SELECT coalesce(json_agg(json_build_object('name',sequencename,'start',start_value,'min',min_value,'max',max_value,'increment',increment_by,'cycle',cycle,'cache',cache_size,'last',last_value) ORDER BY sequencename),'[]'::json) FROM pg_sequences WHERE schemaname='public'"
# Refresh session statistics independently of the retained MVCC data snapshot.
OUTSIDE = "SELECT pg_stat_clear_snapshot();SELECT json_build_object('clients',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()),'prepared',(SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()))"


def identifier(name):
    require(isinstance(name, str) and name and '\0' not in name, 'TABLE_NAME')
    return 'public."' + name.replace('"', '""') + '"'


class Snapshot:
    def __init__(self, prepare, deadline):
        self.deadline = deadline
        self.buffer = b''
        self.child = subprocess.Popen([PG + 'psql', '-XqAt', '-h', '/var/run/postgresql', '-p', '5433',
            '-U', 'postgres', '-d', 'passvero_acceptance', '-v', 'ON_ERROR_STOP=1'],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            **prepare.account('postgres'), env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'PGAPPNAME': 'passvero_staging_capture'})

    def q(self, query):
        token = '__CAPTURE_END__'
        self.child.stdin.write((query + ";SELECT '" + token + "';\n").encode())
        self.child.stdin.flush()
        rows = []
        result_bytes = 0
        while True:
            while b'\n' in self.buffer:
                line, self.buffer = self.buffer.split(b'\n', 1)
                if line == token.encode():
                    # PostgreSQL json_agg(record) may format one value over
                    # multiple lines. The sentinel frames the complete value.
                    require(rows, 'SQL_RESULT_SHAPE')
                    try:
                        return json.loads(b'\n'.join(rows))
                    except (json.JSONDecodeError, UnicodeDecodeError):
                        raise Stop('SQL_RESULT_SHAPE') from None
                if line:
                    result_bytes += len(line) + 1
                    require(result_bytes < 32 * 1024 ** 2, 'SQL_RESULT_SIZE')
                    rows.append(line)
            left = min(8, self.deadline - time.monotonic())
            require(left > 0, 'CAPTURE_DEADLINE')
            ready, _, _ = select.select([self.child.stdout], [], [], left)
            require(ready, 'SQL_TIMEOUT')
            chunk = os.read(self.child.stdout.fileno(), 65536)
            require(chunk and len(self.buffer) + len(chunk) < 32 * 1024 ** 2, 'SQL_CHANNEL_FAILED')
            self.buffer += chunk

    def close(self):
        if self.child.poll() is None:
            self.child.terminate()
            try:
                self.child.wait(timeout=1)
            except subprocess.TimeoutExpired:
                self.child.kill()
                self.child.wait(timeout=1)
        for handle in (self.child.stdin, self.child.stdout):
            try:
                handle.close()
            except OSError:
                pass


def validate_context(set_id):
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647'
            and re.fullmatch(r'[0-9]{8}T[0-9]{6}Z', set_id), 'OPERATOR_SCOPE')
    private(ROOT, True)
    require(read(ROOT / 'operator.identity.json') == {'schema': 1, 'scope': 'passvero-staging-recovery-v1'}, 'ROOT_IDENTITY')
    work = ROOT / 'sets' / set_id
    control = ROOT / 'control' / set_id
    private(work, True)
    private(control, True)
    return work, control


def gates(prepare):
    timer = command(['/usr/bin/systemctl', 'show', 'passvero-subscription-reminders.timer',
                     '--property=ActiveState,UnitFileState']).decode()
    require('ActiveState=inactive' in timer and 'UnitFileState=disabled' in timer, 'REMINDER_TIMER_SCOPE')
    service = command(['/usr/bin/systemctl', 'show', 'passvero-subscription-reminders.service',
                       '--property=ActiveState', '--value']).decode().strip()
    require(service == 'inactive', 'REMINDER_WORKER_SCOPE')
    require(prepare.sql('SELECT json_build_object(\'enabled\',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled))')['enabled'] == 0,
            'REMINDER_CAMPAIGN_SCOPE')


def capture(set_id):
    global PHASE
    work, control = validate_context(set_id)
    prepare, references = helpers()
    selected = read(control / 'selected.json')
    claim_name = selected.get('pauseClaim', FIRST_CLAIM)
    require(claim_name in (FIRST_CLAIM, ADDITIONAL_CLAIM), 'PAUSE_CLAIM_SCOPE')
    claim = read(ROOT / claim_name)
    require(claim['setId'] == set_id, 'ONE_PAUSE_CLAIM')
    if claim_name == ADDITIONAL_CLAIM:
        require(claim['priorSetId'] == FAILED_SET and claim['priorClaimSha256'] ==
                hashlib.sha256((ROOT / FIRST_CLAIM).read_bytes()).hexdigest(), 'FAILED_CLAIM_CHANGED')
    guard_properties(selected['unit'], pathlib.Path(__file__).resolve(), set_id, CAPTURE_SECONDS, RESUME_SECONDS)
    deadline = time.monotonic() + 75
    seed = read(ROOT / 'preparation' / SEED / 'prepared.json')
    process, env = prepare.runtime()
    require(process == selected['process'], 'RUNTIME_CHANGED_BEFORE_PAUSE')
    gates(prepare)
    require(metadata(inventory(prepare, env)) == metadata(seed['objects']), 'STORAGE_CHANGED_BEFORE_PAUSE')
    PHASE = 'STOP_STAGING_ONCE'
    require(deadline - time.monotonic() > 15, 'INSUFFICIENT_CAPTURE_WINDOW')
    write(control / 'pause-intent.json', {'monotonic': time.monotonic(), 'originalPid': process['pid']})
    pm2(prepare, 'stop', 8)
    require(monitor(prepare)['status'] == 'stopped' and source_workers(prepare) == 0, 'STAGING_WRITER_NOT_STOPPED')
    paused_inventory = inventory(prepare, env)
    require(metadata(paused_inventory) == metadata(seed['objects']), 'IN_FLIGHT_STORAGE_CHANGE')
    PHASE = 'LOCK_AND_EXPORT_SNAPSHOT'
    snapshot = Snapshot(prepare, deadline)
    try:
        table_list = selected['tables']
        locks = ','.join(identifier(name) for name in table_list)
        opening = snapshot.q("BEGIN ISOLATION LEVEL REPEATABLE READ;SET LOCAL lock_timeout='1000ms';SET LOCAL statement_timeout='6000ms';SET LOCAL stats_fetch_consistency='none';LOCK TABLE " + locks + " IN SHARE MODE NOWAIT;SELECT json_build_object('snapshot',pg_export_snapshot(),'clients',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()),'prepared',(SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()))")
        require(opening['clients'] == 0 and opening['prepared'] == 0, 'UNKNOWN_DATABASE_WRITER')
        require(snapshot.q(TABLES) == table_list, 'TABLE_TOPOLOGY_CHANGED')
        catalogue = snapshot.q(CATALOG)
        require(catalogue['pendingDocuments'] == 0 and catalogue['pendingImages'] == 0
                and catalogue['nonPublicSchemas'] == 0 and catalogue['largeObjects'] == 0, 'UNSETTLED_OR_UNREVIEWED_SOURCE')
        require(len(catalogue['migrations']) == 31 and all(x['finishedAt'] and not x['rolledBackAt'] for x in catalogue['migrations']), 'MIGRATION_SCOPE')
        # 51 tables exceed json_build_object's PostgreSQL 100-argument limit.
        counts_query = 'SELECT json_object_agg(name,total) FROM (' + ' UNION ALL '.join(
            "SELECT '" + name.replace("'", "''") + "'::text AS name,count(*) AS total FROM "
            + identifier(name) for name in table_list) + ') AS table_counts'
        counts = snapshot.q(counts_query)
        asset_state = snapshot.q(references.QUERY)
        require(asset_state['enabledCampaigns'] == 0, 'REMINDER_CAMPAIGN_SCOPE')
        reconciliation = references.reconcile(seed['objects'], asset_state['references'])
        sequences = snapshot.q(SEQUENCES)
        PHASE = 'DUMP_FROM_SAME_SNAPSHOT'
        dump = work / 'database' / 'passvero_acceptance.dump'
        remaining = deadline - time.monotonic()
        require(remaining > 5, 'CAPTURE_DEADLINE')
        with open(dump, 'xb') as handle:
            result = subprocess.run([PG + 'pg_dump', '-h', '/var/run/postgresql', '-p', '5433', '-U', 'postgres',
                '-d', 'passvero_acceptance', '-Fc', '--no-password', '--lock-wait-timeout=1000', '--snapshot=' + opening['snapshot']],
                stdout=handle, stderr=subprocess.DEVNULL, timeout=remaining, **prepare.account('postgres'),
                env={'PATH': '/usr/bin:/bin', 'LANG': 'C'},
                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE,
                    (GIB - seed['storageBytes'] - 128 * 1024 ** 2, GIB - seed['storageBytes'] - 128 * 1024 ** 2)))
        require(result.returncode == 0, 'SNAPSHOT_DUMP_FAILED')
        PHASE = 'STORAGE_AND_WRITER_CLOSURE'
        verify_storage_bytes(prepare, env, seed['objects'])
        require(metadata(inventory(prepare, env)) == metadata(paused_inventory), 'STORAGE_CHANGED_DURING_CAPTURE')
        require(snapshot.q(SEQUENCES) == sequences and snapshot.q(OUTSIDE) == {'clients': 0, 'prepared': 0}
                and source_workers(prepare) == 0, 'WRITER_CLOSURE_CHANGED')
        require(time.monotonic() < deadline, 'CAPTURE_DEADLINE')
        write(work / 'database' / 'manifest.json', {'schema': 1, 'counts': counts, 'catalog': catalogue,
              'sequences': sequences, 'sourceDatabase': 'passvero_acceptance', 'snapshotId': opening['snapshot']})
        write(work / 'storage' / 'manifest.json', {'objects': seed['objects'], 'references': asset_state['references'],
              'reconciliation': reconciliation, 'storageBeforeAfterUnchanged': True})
        write(control / 'capture-core.json', {'capture': 'PASS', 'lockedTables': len(table_list),
              'outsideDbClients': 0, 'stagingWriters': 0, 'storageMetadataAndBytesUnchanged': True})
    finally:
        snapshot.close()


def resume(set_id):
    work, control = validate_context(set_id)
    prepare, _ = helpers()
    intent = control / 'pause-intent.json'
    if not intent.exists():
        prepare.runtime()
        write(control / 'closure.json', {'stagingPauseRequested': False, 'stagingResumed': True,
              'serviceResult': os.environ.get('SERVICE_RESULT', 'unknown')})
        return
    started = read(intent)['monotonic']
    deadline = time.monotonic() + 22
    row = monitor(prepare)
    if row['status'] != 'online':
        try:
            pm2(prepare, 'restart', 12)
        except (Stop, subprocess.TimeoutExpired):
            pass  # A timed-out RPC may already have restarted the existing app; verify it.
    while deadline - time.monotonic() > 6:
        try:
            process, _ = prepare.runtime()
            with socket.create_connection(('127.0.0.1', 3001), timeout=1):
                pass
            elapsed = time.monotonic() - started
            require(elapsed <= 120, 'PAUSE_LIMIT_EXCEEDED')
            write(control / 'closure.json', {'stagingPauseRequested': True, 'stagingResumed': True,
                  'pauseSeconds': round(elapsed, 3), 'pm2Online': True, 'port3001Reachable': True,
                  'serviceResult': os.environ.get('SERVICE_RESULT', 'unknown')})
            return
        except (OSError, prepare.Stop):
            time.sleep(0.3)
    raise Stop('STAGING_RESUME_NOT_PROVEN')


def prepare_set(prepare, references, set_id, claim_name=FIRST_CLAIM):
    seed = read(ROOT / 'preparation' / SEED / 'prepared.json')
    prior = read(ROOT / 'preparation' / SEED / 'reference-preflight.json')
    require(prior['setId'] == SEED and prior['reconciliation'] == references.reconcile(seed['objects'], prior['references']), 'REFERENCE_PREFLIGHT')
    process, env = prepare.runtime()
    gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB and seed['storageBytes'] + seed['measurementDumpBytes'] < GIB, 'RESOURCE_LIMIT')
    require(hashlib.sha256(pathlib.Path('/usr/local/sbin/passvero-postgres-backup').read_bytes()).hexdigest() == prepare.PIN, 'PRODUCTION_SOURCE_CHANGED')
    for executable in (PG + 'psql', PG + 'pg_dump', PG + 'pg_restore', '/usr/bin/systemd-run', '/usr/bin/busctl'):
        info = pathlib.Path(executable).stat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022
                and os.access(executable, os.X_OK), 'EXISTING_EXECUTABLE_POSTURE')
    require(metadata(inventory(prepare, env)) == metadata(seed['objects']), 'PREPARED_STORAGE_STALE')
    tables = prepare.sql(TABLES)
    require(len(tables) == 51, 'TABLE_SCOPE')
    catalog = prepare.sql(CATALOG)
    require(catalog['pendingDocuments'] == 0 and catalog['pendingImages'] == 0
            and catalog['nonPublicSchemas'] == 0 and catalog['largeObjects'] == 0, 'PRE_PAUSE_SOURCE_UNSETTLED')
    config = configurations(prepare, process, env, seed)
    work = ROOT / 'sets' / set_id
    control = ROOT / 'control' / set_id
    work.mkdir(parents=True, mode=0o700, exist_ok=False)
    control.mkdir(parents=True, mode=0o700, exist_ok=False)
    for name in ('database', 'storage', 'configuration'):
        (work / name).mkdir(mode=0o700)
    (work / 'storage' / 'objects').mkdir(mode=0o700)
    for item in seed['objects']:
        require(item['file'] == hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest(), 'OBJECT_PATH')
        payload = prepare.protected(ROOT / 'preparation' / SEED / 'objects' / item['file'])
        require(len(payload) == item['size'] and hashlib.sha256(payload).hexdigest() == item['sha256'], 'PREPARED_BYTES_CHANGED')
        directory = work / 'storage' / 'objects' / item['bucket']
        directory.mkdir(mode=0o700, exist_ok=True)
        with open(directory / item['file'], 'xb') as handle:
            handle.write(payload)
    for name, value in config.items():
        write(work / 'configuration' / name, value)
    unit = 'passvero-stage-capture-' + set_id + '.service'
    write(control / 'selected.json', {'setId': set_id, 'unit': unit, 'process': process,
          'tables': tables, 'pauseClaim': claim_name})
    return work, control


def retained_failure():
    """Read the exact closed failure before an explicitly approved extra pause."""
    claim = read(ROOT / FIRST_CLAIM)
    unit = 'passvero-stage-capture-' + FAILED_SET + '.service'
    require(claim == {'setId': FAILED_SET, 'unit': unit}, 'FAILED_CLAIM_IDENTITY')
    work, control = validate_context(FAILED_SET)
    require(read(control / 'failure-capture.json') ==
            {'phase': 'LOCK_AND_EXPORT_SNAPSHOT', 'reason': 'SQL_RESULT_SHAPE'}, 'FAILED_CAPTURE_IDENTITY')
    closure = read(control / 'closure.json')
    require(closure.get('stagingPauseRequested') is True and closure.get('stagingResumed') is True
            and closure.get('pm2Online') is True and closure.get('port3001Reachable') is True
            and 0 < closure.get('pauseSeconds', 121) <= 120
            and closure.get('serviceResult') == 'exit-code', 'FAILED_CAPTURE_NOT_CLOSED')
    marker = read(control / 'guard-proof.json')
    require(marker == {'serviceResult': 'timeout', 'exitCode': 'killed', 'exitStatus': 'KILL'}
            and read(control / 'guard-proof-body.json').get('started') is True, 'RETAINED_GUARD_PROOF')
    output = command(['/usr/bin/systemctl', 'show', unit,
                      '--property=LoadState,ActiveState,Result,ExecMainStatus']).decode()
    properties = dict(x.split('=', 1) for x in output.splitlines() if '=' in x)
    require(properties.get('LoadState') == 'loaded' and properties.get('ActiveState') == 'failed'
            and properties.get('Result') == 'exit-code' and properties.get('ExecMainStatus') == '1',
            'FAILED_UNIT_NOT_CLOSED')
    require(not any((work / path).exists() for path in
            ('database/passvero_acceptance.dump', 'database/manifest.json',
             'storage/manifest.json', 'recovery-set.json')), 'FAILED_SET_HAS_CAPTURE_ARTIFACTS')
    return {'priorSetId': FAILED_SET,
            'priorClaimSha256': hashlib.sha256((ROOT / FIRST_CLAIM).read_bytes()).hexdigest()}


def measure_current_dump(prepare, work, control):
    """Bounded read-only size check while staging is still online; retain evidence."""
    stored_bytes = sum(p.stat().st_size for p in work.rglob('*') if p.is_file())
    limit = GIB - stored_bytes - 128 * 1024 ** 2
    require(limit > 0 and shutil.disk_usage(ROOT).free >= 4 * GIB, 'PRE_PAUSE_RESOURCE_LIMIT')
    path = control / 'measurement.dump'
    with open(path, 'xb') as handle:
        result = subprocess.run([PG + 'pg_dump', '-h', '/var/run/postgresql', '-p', '5433', '-U', 'postgres',
            '-d', 'passvero_acceptance', '-Fc', '--no-password', '--lock-wait-timeout=1000'],
            stdout=handle, stderr=subprocess.DEVNULL, timeout=60, **prepare.account('postgres'),
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C'},
            preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (limit, limit)))
    require(result.returncode == 0 and path.stat().st_size < limit
            and shutil.disk_usage(ROOT).free >= 4 * GIB, 'PRE_PAUSE_RESOURCE_LIMIT')
    write(control / 'measurement.json', {'measurementDumpBytes': path.stat().st_size,
          'preparedStorageAndConfigBytes': stored_bytes, 'reservedBytes': 128 * 1024 ** 2,
          'stagingPauseRequested': False, 'recoveryProof': False})


def launch(additional=False):
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    private(ROOT, True)
    claim_name = ADDITIONAL_CLAIM if additional else FIRST_CLAIM
    require(not (ROOT / claim_name).exists() and not (ROOT / claim_name).is_symlink(),
            'ONE_PAUSE_ALREADY_CLAIMED')
    retained = retained_failure() if additional else {}
    prepare, references = helpers()
    set_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    PHASE = 'PRE_PAUSE_PREPARATION'
    work, control = prepare_set(prepare, references, set_id, claim_name)
    if additional:
        PHASE = 'CURRENT_DUMP_SIZE_WHILE_ONLINE'
        measure_current_dump(prepare, work, control)
    helper = pathlib.Path(__file__).resolve()
    if not additional:
        PHASE = 'LIVE_GUARD_PROOF_WITHOUT_APP_PAUSE'
        proof = subprocess.run(unit_command(helper, set_id, proof=True), stdout=subprocess.DEVNULL,
                               stderr=subprocess.DEVNULL, timeout=8)
        marker = read(control / 'guard-proof.json')
        require(proof.returncode != 0 and marker['serviceResult'] == 'timeout' and marker['exitCode'] == 'killed'
                and marker['exitStatus'] == 'KILL' and (control / 'guard-proof-body.json').exists(), 'GUARD_PROOF_FAILED')
    write(ROOT / claim_name, {'setId': set_id, 'unit': 'passvero-stage-capture-' + set_id + '.service', **retained})
    PHASE = 'ONE_BOUNDED_CAPTURE_WITH_SYSTEMD_RESUME'
    result = subprocess.run(unit_command(helper, set_id), stdout=subprocess.DEVNULL,
                            stderr=subprocess.DEVNULL, timeout=125)
    closure = read(control / 'closure.json')
    require(closure.get('stagingResumed') and closure.get('pauseSeconds', 0) <= 120, 'STAGING_CLOSURE_NOT_PROVEN')
    if result.returncode != 0 or closure['serviceResult'] != 'success':
        failure = control / 'failure-capture.json'
        reason = read(failure)['reason'] if failure.exists() else closure['serviceResult']
        raise Stop('CAPTURE_FAILED_STAGING_RESUMED_' + reason)
    evidence = read(control / 'capture-core.json')
    require(evidence['capture'] == 'PASS' and closure.get('stagingPauseRequested'), 'CAPTURE_NOT_COMPLETED')
    gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FINAL_FREE_SPACE_LIMIT')
    dump = work / 'database' / 'passvero_acceptance.dump'
    toc = command([PG + 'pg_restore', '--list', str(dump)], timeout=15)
    with open(work / 'database' / 'passvero_acceptance.toc', 'xb') as handle:
        handle.write(toc)
    with open(work / 'database' / 'passvero_acceptance.sha256', 'x') as handle:
        handle.write(hashlib.sha256(dump.read_bytes()).hexdigest() + '  passvero_acceptance.dump\n')
    files = {str(p.relative_to(work)): {'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
             for p in sorted(work.rglob('*')) if p.is_file()}
    payload = sum(v['bytes'] for v in files.values())
    require(payload < GIB, 'FINAL_PAYLOAD_LIMIT')
    write(work / 'recovery-set.json', {'schema': 1, 'setId': set_id, 'preparationId': SEED,
          'files': files, 'payloadBytes': payload, 'writerClosure': evidence, 'stagingClosure': closure,
          'storageProviderRestore': 'NOT_PERFORMED', 'sourceRolesPasswords': 'INDEPENDENT_PROTECTED_ESCROW'})
    require(sum(p.stat().st_size for p in work.rglob('*') if p.is_file()) <= GIB, 'FINAL_PAYLOAD_LIMIT')
    manifest = read(work / 'storage' / 'manifest.json')
    summary = {'capture': 'PASS', 'setId': set_id, 'staging': 'ONLINE_RESUMED', 'pauseSeconds': closure['pauseSeconds'],
        'independentTimeoutResumeGuard': 'REUSED_ACCEPTED_' + FAILED_SET if additional else 'PASS_LIVE_NO_PAUSE_PROOF',
        'lockedTables': evidence['lockedTables'],
        'outsideDbClients': 0, 'stagingWritersDuringCapture': 0, 'storageMetadataAndBytesUnchanged': True,
        'databaseAssetReferences': len(manifest['references']), 'storageObjects': len(manifest['objects']),
        'acceptedCleanupTombstones': len(manifest['reconciliation']['acceptedCleanupTombstones']),
        'payloadBytes': sum(p.stat().st_size for p in work.rglob('*') if p.is_file()),
        'b2Transfer': 'NOT_YET_RUN', 'restore': 'NOT_YET_RUN', 'reminderTimer': 'DISABLED_INACTIVE',
        'campaignsEnabled': 0, 'remoteWrites': 0, 'smtpCalls': 0, 'telegramCalls': 0, 'automaticRetry': False}
    write(control / 'summary.json', summary)
    print(json.dumps(summary))


def main():
    global PHASE
    os.umask(0o077)
    mode = sys.argv[1] if len(sys.argv) > 1 else '--launch'
    if mode in ('--launch', '--launch-additional-after-20261001T203612Z'):
        require(len(sys.argv) <= 2, 'OPERATOR_MODE_ARGUMENTS')
        launch(additional=mode != '--launch')
        return
    set_id = sys.argv[2]
    work, control = validate_context(set_id)
    if mode == '--proof-body':
        write(control / 'guard-proof-body.json', {'started': True})
        time.sleep(30)
    elif mode == '--proof-post':
        write(control / 'guard-proof.json', {'serviceResult': os.environ.get('SERVICE_RESULT'),
              'exitCode': os.environ.get('EXIT_CODE'), 'exitStatus': os.environ.get('EXIT_STATUS')})
    elif mode == '--capture':
        capture(set_id)
    elif mode == '--resume':
        resume(set_id)
    else:
        raise Stop('OPERATOR_MODE')


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if isinstance(error, Stop) else type(error).__name__
        if len(sys.argv) == 3 and re.fullmatch(r'[0-9]{8}T[0-9]{6}Z', sys.argv[2]):
            try:
                write(ROOT / 'control' / sys.argv[2] / ('failure-' + sys.argv[1].strip('-') + '.json'),
                      {'phase': PHASE, 'reason': reason})
            except Exception:
                pass
        print(json.dumps({'capture': 'STOP', 'phase': PHASE, 'reason': reason,
              'retry': 'MANUAL_REVIEW_REQUIRED', 'artifactsRetained': True,
              'remoteWrites': 0, 'smtpCalls': 0, 'telegramCalls': 0}))
        sys.exit(1)
