"""Staging-only scheduled adapter around accepted capture/offsite primitives.

No historical helper is edited or its main entrypoint called. Incomplete attempts
HOLD the new job; resume is independently invoked by systemd on timeout/death.
"""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import resource
import socket
import stat
import subprocess
import sys
import time
import urllib.parse
import urllib.request
import uuid

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
STATE = ROOT / 'recurring'
CODE = pathlib.Path('/usr/local/libexec/passvero-staging-backup')
CONFIG = CODE / 'config.json'
APP = pathlib.Path('/var/www/passvero-acceptance')
CANONICAL = pathlib.Path('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
REMINDER_TIMER = 'passvero-subscription-reminders.timer'
REMINDER_SERVICE = 'passvero-subscription-reminders.service'
GIB = 1024 ** 3
PHASE = 'SCOPE'


class Stop(Exception):
    pass


def require(value, code):
    if not value:
        raise Stop(code)


def read(path):
    require(path.is_file() and not path.is_symlink() and path.stat().st_size < 32 * 1024 ** 2,
            'JSON_INPUT_POSTURE')
    return json.loads(path.read_text())


def atomic(path, value):
    require(not path.is_symlink(), 'STATE_SYMLINK')
    tmp = path.with_name(path.name + '.' + uuid.uuid4().hex)
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as handle:
        json.dump(value, handle, sort_keys=True, indent=2)
        handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
    os.replace(tmp, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def command(args, timeout=15, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=timeout, **kwargs)
    require(result.returncode == 0, 'COMMAND_FAILED')
    require(len(result.stdout) <= 32 * 1024 ** 2, 'COMMAND_OUTPUT_LIMIT')
    return result.stdout


def unit(name):
    require(name in (REMINDER_TIMER, REMINDER_SERVICE, 'passvero-postgres-backup.service',
                     'passvero-staging-backup.timer', 'passvero-staging-backup.service'), 'UNIT_SCOPE')
    body = command(['/usr/bin/systemctl', 'show', name,
                    '--property=ActiveState,UnitFileState,InvocationID,ExecMainStartTimestampMonotonic,LastTriggerUSecMonotonic']).decode()
    return dict(line.split('=', 1) for line in body.splitlines() if '=' in line)


def ctl(action, name):
    require(action in ('stop', 'start') and name == REMINDER_TIMER, 'REMINDER_TIMER_ACTION_SCOPE')
    command(['/usr/bin/systemctl', action, name], timeout=10)


def reserve_attempt(path, set_id):
    state = read(path)
    require(not state['hold'], 'CAPTURE_ON_HOLD')
    require(state['mode'] in ('ACCEPTANCE', 'CONTINUOUS'), 'MODE_SCOPE')
    require(state['mode'] != 'ACCEPTANCE' or state['attempts'] < 2, 'ACCEPTANCE_CAPTURE_BUDGET')
    state.update(attempts=state['attempts'] + 1, attempt={'setId': set_id, 'complete': False})
    atomic(path, state)
    return state


def quiesce(control):
    timer = unit(REMINDER_TIMER)
    require(timer['UnitFileState'] in ('enabled', 'disabled'), 'REMINDER_TIMER_ENABLEMENT')
    require(timer['ActiveState'] in ('active', 'inactive'), 'REMINDER_TIMER_STATE')
    atomic(control / 'writer-baseline.json', {'timerActive': timer['ActiveState'] == 'active',
           'timerEnabled': timer['UnitFileState'] == 'enabled'})
    # Persist the restore intent before stopping the timer; never kill the worker.
    ctl('stop', REMINDER_TIMER)
    deadline = time.monotonic() + 240
    while time.monotonic() < deadline:
        service = unit(REMINDER_SERVICE)
        if service['ActiveState'] == 'inactive':
            return
        require(service['ActiveState'] in ('active', 'activating', 'deactivating'), 'REMINDER_SERVICE_FAILED')
        time.sleep(1)
    raise Stop('REMINDER_DRAIN_TIMEOUT')


def resume_timer(control):
    path = control / 'writer-baseline.json'
    if not path.exists():
        return
    baseline = read(path)
    current = unit(REMINDER_TIMER)
    require((current['UnitFileState'] == 'enabled') == baseline['timerEnabled'], 'REMINDER_ENABLEMENT_CHANGED')
    if baseline['timerActive'] and current['ActiveState'] != 'active':
        ctl('start', REMINDER_TIMER)
    elif not baseline['timerActive'] and current['ActiveState'] != 'inactive':
        ctl('stop', REMINDER_TIMER)


def residual_reminder():
    """Catch a detached launcher/bundle even when its systemd service is inactive."""
    for path in pathlib.Path('/proc').iterdir():
        if not path.name.isdigit():
            continue
        try:
            args = (path / 'cmdline').read_bytes()
            require(b'/usr/local/libexec/passvero-subscription-reminders/' not in args,
                    'RESIDUAL_REMINDER_PROCESS')
        except (FileNotFoundError, ProcessLookupError):
            pass


def signal(state, now):
    if state.get('failure'):
        return 'BACKUP_FAILED'
    if state.get('attempt') and not state['attempt']['complete']:
        return 'SET_INCOMPLETE'
    if not state.get('valid'):
        return 'VALID_SET_MISSING'
    age = now - state['valid']['captureEpoch']
    if age < 0:
        return 'CLOCK_INVALID'
    return 'SET_STALE' if age > 90000 else 'HEALTHY'


def reserve_alert(path, kind, revision, now):
    state = read(path) if path.exists() else {'sent': {}}
    key = kind + ':' + revision
    if key in state['sent']:
        return False
    state['sent'][key] = now
    state.update(delivery='UNKNOWN', signal=kind, reservedAt=now)
    atomic(path, state)  # uncertainty is durable before external I/O; never retry blindly
    return True


def select_snapshots(rows):
    require(isinstance(rows, list), 'SNAPSHOT_LIST')
    for row in rows:
        require(re.fullmatch('[a-f0-9]{64}', row.get('id', ''))
                and row.get('hostname') == 'passvero-staging-recovery'
                and 'passvero-staging-recovery' in row.get('tags', [])
                and len(row.get('paths', [])) == 1
                and re.fullmatch(re.escape(str(ROOT / 'sets')) + r'/[0-9]{8}T[0-9]{6}Z', row['paths'][0]),
                'STAGING_RETENTION_SELECTOR')
    return rows


def load(path, pin, name):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077
            and hashlib.sha256(path.read_bytes()).hexdigest() == pin, 'PINNED_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def scope(closing=False):
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    os.umask(0o077); sys.dont_write_bytecode = True
    for path in (ROOT, STATE, CODE):
        info = path.lstat()
        acl_closure = path == ROOT and stat.S_IMODE(info.st_mode) == 0o710
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0
                and (not info.st_mode & 0o077 or acl_closure), 'PRIVATE_ROOT')
    config = read(CONFIG)
    require(CONFIG.lstat().st_uid == 0 and not CONFIG.stat().st_mode & 0o077, 'CONFIG_POSTURE')
    require(config['approved'] and config['repositoryId'] ==
            '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35', 'APPROVED_POLICY_REQUIRED')
    helpers = {}
    for name, pin in config['helpers'].items():
        path = CODE / (name + '.py') if name in ('offsite', 'recurring_catalog') else ROOT / 'operator' / (name + '-' + pin + '.py')
        helpers[name] = load(path, pin, 'accepted_' + name)
    if stat.S_IMODE(ROOT.stat().st_mode) == 0o710:
        restore = helpers['restore-database']
        postgres_uid = __import__('pwd').getpwnam('postgres').pw_uid
        require(restore.get_acl(ROOT) == restore.traversal_acl(postgres_uid), 'UNREVIEWED_ROOT_ACL')
    return config, helpers


def lock(path):
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd); raise Stop('JOB_LOCK_BUSY') from None
    return fd


def runtime(config, helpers):
    prepare = helpers['prepare']; cap = helpers['capture']
    process, env = prepare.runtime()
    require(hashlib.sha256(CANONICAL.read_bytes()).hexdigest() == config['canonicalSha256'], 'CANONICAL_RELEASE_CHANGED')
    canonical = read(CANONICAL)
    require(canonical['build_id'] == config['buildId'] == (APP / '.next/BUILD_ID').read_text().strip(), 'BUILD_CHANGED')
    for name, entry in canonical['files'].items():
        path = APP / name
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
                and path.resolve().is_relative_to(APP.resolve()) and not path.is_symlink()
                and path.is_file() and helpers['offsite'].digest(path) == entry['sha256'], 'EXECUTABLE_ARTIFACT_CHANGED')
    for name, pin in config['worker'].items():
        path = pathlib.Path('/usr/local/libexec/passvero-subscription-reminders') / name
        require(path.is_file() and not path.is_symlink() and helpers['offsite'].digest(path) == pin, 'WORKER_CHANGED')
    migrations = prepare.sql("SELECT json_build_object('count',count(*),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name))) FROM _prisma_migrations")
    require(migrations == config['migrations'], 'MIGRATION_HISTORY_CHANGED')
    require(unit('passvero-postgres-backup.service')['ActiveState'] == 'inactive', 'PRODUCTION_BACKUP_BUSY')
    require(__import__('shutil').disk_usage(ROOT).free >= 4 * GIB, 'FREE_SPACE_LIMIT')
    return process, env


def contexts(set_id):
    require(re.fullmatch('[0-9]{8}T[0-9]{6}Z', set_id), 'SET_ID')
    return ROOT / 'sets' / set_id, ROOT / 'control' / set_id


def stage_bytes(config, helpers, set_id):
    global PHASE
    process, env = runtime(config, helpers)
    prepare, cap = helpers['prepare'], helpers['capture']
    work, control = contexts(set_id)
    work.mkdir(mode=0o700); control.mkdir(mode=0o700)
    atomic(STATE / 'active.json', {'setId': set_id})
    for name in ('database', 'storage', 'configuration'):
        (work / name).mkdir(mode=0o700)
    (work / 'storage/objects').mkdir(mode=0o700)
    PHASE = 'ONLINE_STORAGE_PRECOPY'
    objects = cap.inventory(prepare, env)
    require(sum(x['size'] for x in objects) < GIB - 128 * 1024 ** 2, 'STORAGE_PAYLOAD_LIMIT')
    for item in objects:
        item['file'] = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        directory = work / 'storage/objects' / item['bucket']; directory.mkdir(mode=0o700, exist_ok=True)
        path = directory / item['file']; checksum = hashlib.sha256(); size = 0
        with prepare.storage_request(env, 'object/authenticated/' + item['bucket'] + '/' + urllib.parse.quote(item['key'], safe='/')) as response, open(path, 'xb') as output:
            for chunk in iter(lambda: response.read(1024 * 1024), b''):
                size += len(chunk); require(size <= item['size'], 'STORAGE_PRECOPY_CHANGED')
                checksum.update(chunk); output.write(chunk)
        require(size == item['size'], 'STORAGE_PRECOPY_CHANGED'); item['sha256'] = checksum.hexdigest()
    seed = {'sourcePackageSha256': helpers['offsite'].digest(APP / 'package.json'),
            'sourceLockSha256': helpers['offsite'].digest(APP / 'package-lock.json'), 'buildId': config['buildId']}
    for name, value in cap.configurations(prepare, process, env, seed).items():
        atomic(work / 'configuration' / name, value)
    tables = prepare.sql(cap.TABLES)
    require(len(tables) == config['tables'], 'TABLE_TOPOLOGY_CHANGED')
    atomic(control / 'selected.json', {'process': process, 'objects': objects, 'tables': tables,
           'captureEpoch': int(time.time()), 'unit': 'passvero-stage-recurring-capture-' + set_id + '.service'})
    cap.measure_current_dump(prepare, work, control)
    return work, control


def child(set_id, config, helpers):
    global PHASE
    prepare, cap, references = helpers['prepare'], helpers['capture'], helpers['references']
    work, control = contexts(set_id); selected = read(control / 'selected.json')
    cap.guard_properties(selected['unit'], CODE / 'recurring.py', set_id, 85, 25)
    require(unit(REMINDER_TIMER)['ActiveState'] == 'inactive'
            and unit(REMINDER_SERVICE)['ActiveState'] == 'inactive', 'REMINDER_NOT_DRAINED')
    residual_reminder()
    process, env = prepare.runtime()
    require(process == selected['process'], 'RUNTIME_CHANGED_BEFORE_PAUSE')
    deadline = time.monotonic() + 75
    atomic(control / 'pause-intent.json', {'monotonic': time.monotonic()})
    PHASE = 'STOP_STAGING_WEB'
    cap.pm2(prepare, 'stop', 8)
    require(cap.monitor(prepare)['status'] == 'stopped' and cap.source_workers(prepare) == 0, 'WEB_NOT_STOPPED')
    objects = selected['objects']
    require(cap.metadata(cap.inventory(prepare, env)) == cap.metadata(objects), 'STORAGE_PRECOPY_STALE')
    snapshot = cap.Snapshot(prepare, deadline)
    try:
        PHASE = 'LOCK_AND_SNAPSHOT'
        capture_epoch = int(time.time())
        opening = snapshot.q("BEGIN ISOLATION LEVEL REPEATABLE READ;SET LOCAL lock_timeout='1000ms';SET LOCAL statement_timeout='6000ms';SET LOCAL stats_fetch_consistency='none';LOCK TABLE " + ','.join(cap.identifier(x) for x in selected['tables']) + " IN SHARE MODE NOWAIT;SELECT json_build_object('snapshot',pg_export_snapshot(),'clients',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()),'prepared',(SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()))")
        require(opening['clients'] == 0 and opening['prepared'] == 0, 'UNKNOWN_DATABASE_WRITER')
        require(snapshot.q(cap.TABLES) == selected['tables'], 'TABLE_TOPOLOGY_CHANGED')
        catalog = snapshot.q(cap.CATALOG)
        require(catalog['pendingDocuments'] == 0 and catalog['pendingImages'] == 0
                and catalog['nonPublicSchemas'] == 0 and catalog['largeObjects'] == 0, 'UNSETTLED_SOURCE')
        counts = snapshot.q('SELECT json_object_agg(name,total) FROM (' + ' UNION ALL '.join(
            "SELECT '" + name.replace("'", "''") + "'::text name,count(*) total FROM " + cap.identifier(name)
            for name in selected['tables']) + ') x')
        assets = snapshot.q(references.QUERY); sequences = snapshot.q(cap.SEQUENCES)
        reconciliation = references.reconcile(objects, assets['references'])
        PHASE = 'CONSISTENT_DUMP'
        remaining = deadline - time.monotonic(); require(remaining > 5, 'CAPTURE_DEADLINE')
        limit = GIB - sum(x['size'] for x in objects) - 128 * 1024 ** 2
        with open(work / 'database/passvero_acceptance.dump', 'xb') as output:
            result = subprocess.run([cap.PG + 'pg_dump', '-h', '/var/run/postgresql', '-p', '5433', '-U', 'postgres',
                '-d', 'passvero_acceptance', '-Fc', '--no-password', '--lock-wait-timeout=1000', '--snapshot=' + opening['snapshot']],
                stdout=output, stderr=subprocess.DEVNULL, timeout=remaining, **prepare.account('postgres'),
                env={'PATH': '/usr/bin:/bin', 'LANG': 'C'},
                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (limit, limit)))
        require(result.returncode == 0, 'SNAPSHOT_DUMP_FAILED')
        PHASE = 'CAPTURE_CLOSURE'
        residual_reminder()
        cap.verify_storage_bytes(prepare, env, objects)
        require(cap.metadata(cap.inventory(prepare, env)) == cap.metadata(objects), 'STORAGE_CHANGED_DURING_CAPTURE')
        require(snapshot.q(cap.SEQUENCES) == sequences and snapshot.q(cap.OUTSIDE) == {'clients': 0, 'prepared': 0}
                and cap.source_workers(prepare) == 0 and unit(REMINDER_SERVICE)['ActiveState'] == 'inactive'
                and time.monotonic() < deadline, 'WRITER_CLOSURE_CHANGED')
        atomic(work / 'database/manifest.json', {'schema': 1, 'counts': counts, 'catalog': catalog,
               'sequences': sequences, 'sourceDatabase': 'passvero_acceptance', 'snapshotId': opening['snapshot']})
        atomic(work / 'storage/manifest.json', {'objects': objects, 'references': assets['references'],
               'reconciliation': reconciliation, 'enabledCampaigns': assets['enabledCampaigns']})
        atomic(control / 'capture-core.json', {'capture': 'PASS', 'outsideDbClients': 0,
               'stagingWriters': 0, 'lockedTables': len(selected['tables']), 'captureEpoch': capture_epoch})
    finally:
        snapshot.close()


def resume(set_id, helpers):
    prepare, cap = helpers['prepare'], helpers['capture']
    _, control = contexts(set_id)
    fd = lock(control / 'resume.lock')
    try:
        service_result = os.environ.get('SERVICE_RESULT', 'unknown')
        if service_result not in ('unknown', 'success'):
            failure = {'result': 'STOP', 'phase': 'SYSTEMD_CAPTURE_EXIT',
                       'reason': service_result, 'setId': set_id, 'automaticRetry': False}
            if not (control / 'first-failure.json').exists():
                atomic(control / 'first-failure.json', failure)
            state = read(STATE / 'state.json'); state['hold'] = True
            state.setdefault('failure', failure); atomic(STATE / 'state.json', state)
        intent = control / 'pause-intent.json'
        if intent.exists():
            started = read(intent)['monotonic']
            if cap.monitor(prepare)['status'] != 'online':
                try:
                    cap.pm2(prepare, 'restart', 8)
                except Exception:
                    pass  # RPC may have completed even if response timed out; verify online.
            ready_deadline = time.monotonic() + 5
            while True:
                try:
                    prepare.runtime()
                    with socket.create_connection(('127.0.0.1', 3001), timeout=1):
                        pass
                    break
                except Exception:
                    require(time.monotonic() < ready_deadline, 'WEB_RESUME_NOT_READY')
                    time.sleep(0.25)
            elapsed = time.monotonic() - started
            require(elapsed <= 120 or (control / 'closure.json').exists(), 'WEB_PAUSE_LIMIT_EXCEEDED')
        else:
            elapsed = 0; prepare.runtime()
        resume_timer(control)
        if not (control / 'closure.json').exists():
            atomic(control / 'closure.json', {'stagingResumed': True, 'pauseSeconds': round(elapsed, 3),
                   'timerBaselineRestored': True, 'serviceResult': os.environ.get('SERVICE_RESULT', 'unknown')})
    finally:
        # A failed web restart must not leave the previously enabled writer timer stopped.
        try:
            resume_timer(control)
        finally:
            os.close(fd)


def publish(set_id, helpers):
    cap, offsite = helpers['capture'], helpers['offsite']
    work, control = contexts(set_id)
    core, closure = read(control / 'capture-core.json'), read(control / 'closure.json')
    require(core['capture'] == 'PASS' and closure['stagingResumed'] and closure['pauseSeconds'] <= 120
            and closure['serviceResult'] == 'success', 'CAPTURE_CLOSURE_NOT_ACCEPTED')
    dump = work / 'database/passvero_acceptance.dump'
    (work / 'database/passvero_acceptance.toc').write_bytes(command([cap.PG + 'pg_restore', '--list', str(dump)]))
    (work / 'database/passvero_acceptance.sha256').write_text(offsite.digest(dump) + '  passvero_acceptance.dump\n')
    files = {str(p.relative_to(work)): {'bytes': p.stat().st_size, 'sha256': offsite.digest(p)}
             for p in sorted(work.rglob('*')) if p.is_file()}
    require(sum(x['bytes'] for x in files.values()) < GIB, 'PAYLOAD_LIMIT')
    atomic(work / 'recovery-set.json', {'schema': 1, 'setId': set_id, 'files': files,
           'payloadBytes': sum(x['bytes'] for x in files.values()), 'writerClosure': core, 'stagingClosure': closure,
           'sourceRolesPasswords': 'INDEPENDENT_PROTECTED_ESCROW', 'storageProviderRestore': 'NOT_PERFORMED'})
    offsite.SET_ID = set_id
    manifest, payload, manifest_sha = offsite.verify_set(work, cap)
    repository = offsite.Repository(helpers['prepare'])
    before = select_snapshots(repository.snapshots())
    config = json.loads(repository.run(['cat', 'config']))
    require(config['id'] == read(CONFIG)['repositoryId'], 'REPOSITORY_CHANGED')
    require(not any(row['paths'] == [str(work)] for row in before), 'SET_ALREADY_OFFSITE')
    atomic(control / 'offsite-attempt.json', {'setId': set_id, 'automaticRetry': False})
    repository.run(['backup', '--json', '--force', '--host', 'passvero-staging-recovery',
                    '--tag', 'passvero-staging-recovery', '--tag', 'set:' + set_id, str(work)], writing=True)
    after = select_snapshots(repository.snapshots())
    require({x['id'] for x in before} <= {x['id'] for x in after}, 'OLD_SNAPSHOTS_CHANGED')
    added = [x for x in after if x['id'] not in {y['id'] for y in before}]
    require(len(added) == 1 and added[0]['paths'] == [str(work)], 'NEW_SNAPSHOT_IDENTITY')
    snapshot_id = added[0]['id']
    require(hashlib.sha256(repository.run(['dump', snapshot_id, str(work / 'recovery-set.json')])).hexdigest() == manifest_sha,
            'OFFSITE_MANIFEST_CHANGED')
    offsite.validate_tree(repository.run(['ls', '--json', snapshot_id]), snapshot_id, work, manifest)
    require(offsite.verify_set(work, cap) == (manifest, payload, manifest_sha), 'CAPTURE_CHANGED_DURING_UPLOAD')
    result = {'setId': set_id, 'snapshotId': snapshot_id, 'manifestSha256': manifest_sha,
              'repositoryId': config['id'], 'captureEpoch': core['captureEpoch'], 'payloadBytes': payload,
              'pauseSeconds': closure['pauseSeconds'], 'offsite': 'PASS_VALID_OFFSITE_TREE_AND_MANIFEST'}
    atomic(control / 'offsite-summary.json', result)
    return result


def monotonic_microseconds(name, interface, property_name, code):
    """Read a typed uint64; systemctl formats Timer timestamps as durations."""
    try:
        reply = command(['/usr/bin/busctl', 'call', 'org.freedesktop.systemd1',
            '/org/freedesktop/systemd1', 'org.freedesktop.systemd1.Manager',
            'GetUnit', 's', name]).decode().strip()
        require(re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"', reply), code + '_INVALID')
        value = command(['/usr/bin/busctl', 'get-property', 'org.freedesktop.systemd1',
                         reply[3:-1], interface, property_name]).decode().strip()
    except Stop as error:
        if str(error) == code + '_INVALID':
            raise
        raise Stop(code + '_READ_FAILED') from None
    except Exception:
        raise Stop(code + '_READ_FAILED') from None
    require(re.fullmatch(r't [0-9]{1,20}', value), code + '_INVALID')
    number = int(value[2:])
    require(0 < number <= 2 ** 64 - 1, code + '_INVALID')
    return number


def scheduled(config, helpers):
    global PHASE
    PHASE = 'TIMER_INVOCATION_PRE_RESERVATION'
    service = unit('passvero-staging-backup.service')
    invocation = os.environ.get('INVOCATION_ID', '')
    start = monotonic_microseconds('passvero-staging-backup.service', 'org.freedesktop.systemd1.Service',
                                  'ExecMainStartTimestampMonotonic', 'TIMER_START_MONOTONIC')
    trigger = monotonic_microseconds('passvero-staging-backup.timer', 'org.freedesktop.systemd1.Timer',
                                    'LastTriggerUSecMonotonic', 'TIMER_TRIGGER_MONOTONIC')
    require(re.fullmatch('[a-f0-9]{32}', invocation) and service['InvocationID'] == invocation
            and 0 <= start - trigger <= 5000000 and time.monotonic() * 1e6 - trigger < 30000000,
            'ORDINARY_TIMER_INVOCATION_REQUIRED')
    set_id = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    state = reserve_attempt(STATE / 'state.json', set_id)
    PHASE = 'PREPARATION'
    _, control = stage_bytes(config, helpers, set_id)
    atomic(control / 'timer-invocation.json', {'invocationId': invocation, 'startMonotonic': start,
           'triggerMonotonic': trigger, 'scheduledSetId': set_id})
    PHASE = 'DRAIN_REMINDER'
    quiesce(control)
    PHASE = 'BOUNDED_CAPTURE'
    helper = CODE / 'recurring.py'
    args = ['/usr/bin/systemd-run', '--quiet', '--wait', '--unit', 'passvero-stage-recurring-capture-' + set_id,
            '--property=Type=exec', '--property=Restart=no', '--property=KillMode=control-group',
            '--property=KillSignal=SIGKILL', '--property=RuntimeMaxSec=85s', '--property=TimeoutStopSec=25s',
            '--property=StandardOutput=null', '--property=StandardError=null',
            '--property=ExecStopPost=/usr/bin/python3 -B ' + str(helper) + ' --resume ' + set_id,
            '/usr/bin/python3', '-B', str(helper), '--capture', set_id]
    command(args, timeout=125)
    PHASE = 'OFFSITE'
    result = publish(set_id, helpers)
    state = read(STATE / 'state.json')
    state['attempt']['complete'] = True; state['valid'] = result; state.pop('failure', None)
    state.setdefault('completed', []).append(result)
    atomic(STATE / 'state.json', state)
    print(json.dumps(result))


def telegram(text, prepare):
    token = prepare.protected('/etc/passvero/backup/telegram-bot-token').decode().strip()
    chat = prepare.protected('/etc/passvero/backup/telegram-chat-id').decode().strip()
    require(re.fullmatch('[0-9]+:[A-Za-z0-9_-]+', token) and re.fullmatch('-?[0-9]+', chat), 'TELEGRAM_PROTECTED_INPUT')
    request = urllib.request.Request('https://api.telegram.org/bot' + token + '/sendMessage',
        data=urllib.parse.urlencode({'chat_id': chat, 'text': text}).encode(), method='POST')
    # Same existing bot/chat/API mechanism, independent staging state; no redirect/retry.
    with prepare.HTTP.open(request, timeout=10) as response:
        body = json.loads(response.read(16384))
        require(body.get('ok') is True, 'TELEGRAM_NOT_ACCEPTED')


def monitor(config, helpers, test=False):
    require(not test or config['testTelegramApproved'], 'TEST_TELEGRAM_NOT_APPROVED')
    fd = lock(STATE / 'monitor.lock')
    try:
        state = read(STATE / 'state.json'); now = int(time.time())
        kind = 'CONTROLLED_TEST' if test else signal(state, now)
        if kind == 'VALID_SET_MISSING' and now < state['firstDueEpoch'] + 3600:
            atomic(STATE / 'monitor-result.json', {'signal': 'WAIT_FIRST_SCHEDULE', 'observedEpoch': now})
            return
        if kind == 'HEALTHY':
            atomic(STATE / 'monitor-result.json', {'signal': kind, 'observedEpoch': now})
            return
        revision = 'controlled-once' if test else state.get('failure', {}).get('setId', state.get('valid', {}).get('snapshotId', 'initial'))
        path = STATE / 'alerts.json'
        if reserve_alert(path, kind, revision, now):
            text = ('Passvero STAGING backup monitoring — controlled test; no live backup failure.' if test
                    else 'Passvero STAGING backup: ' + kind + '. Operator review required; no automatic retry.')
            telegram(text, helpers['prepare'])
            result = read(path); result['delivery'] = 'PROVIDER_ACCEPTED'; atomic(path, result)
        atomic(STATE / 'monitor-result.json', {'signal': kind, 'observedEpoch': now})
    finally:
        os.close(fd)


def post(helpers):
    active = STATE / 'active.json'
    if os.environ.get('SERVICE_RESULT') == 'exec-condition':
        return  # budget/hold guard skipped ExecStart; no new attempt or cleanup
    state = read(STATE / 'state.json')
    if os.environ.get('SERVICE_RESULT') not in (None, 'success'):
        state['hold'] = True
        state.setdefault('failure', {'phase': 'SYSTEMD_JOB_EXIT', 'reason': os.environ.get('SERVICE_RESULT'),
                                   'setId': state.get('attempt', {}).get('setId', 'preparation')})
        atomic(STATE / 'state.json', state)
    if active.exists() and read(active)['setId'] == state.get('attempt', {}).get('setId'):
        set_id = read(active)['setId']; _, control = contexts(set_id)
        try:
            resume(set_id, helpers)
        except Exception as error:
            atomic(control / 'resume-failure.json', {'phase': 'INDEPENDENT_RESUME', 'reason': type(error).__name__})
            raise


def main():
    global PHASE
    config, helpers = scope(); mode = sys.argv[1]
    if mode == '--eligible':
        state = read(STATE / 'state.json')
        sys.exit(0 if not state['hold'] and (state['mode'] == 'CONTINUOUS' or state['attempts'] < 2) else 1)
    if mode in ('--capture', '--resume'):
        require(len(sys.argv) == 3, 'CHILD_ARGUMENTS')
        (child(sys.argv[2], config, helpers) if mode == '--capture' else resume(sys.argv[2], helpers))
    elif mode == '--post':
        post(helpers)
    elif mode in ('--monitor', '--telegram-test'):
        monitor(config, helpers, mode == '--telegram-test')
    elif mode == '--scheduled':
        fd = lock(STATE / 'job.lock')
        try:
            scheduled(config, helpers)
        finally:
            os.close(fd)
    else:
        raise Stop('MODE_SCOPE')


if __name__ == '__main__':
    try:
        main()
    except SystemExit:
        raise
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        output = {'result': 'STOP', 'phase': PHASE, 'reason': reason, 'automaticRetry': False}
        # Save first normalized failure before independent systemd resume/cleanup.
        if os.geteuid() == 0 and STATE.is_dir():
            try:
                state = read(STATE / 'state.json')
                if '--scheduled' in sys.argv or '--capture' in sys.argv:
                    state['hold'] = True
                    state.setdefault('failure', dict(output, setId=state.get('attempt', {}).get('setId', 'preparation')))
                    atomic(STATE / 'state.json', state)
                    if state.get('attempt'):
                        _, control = contexts(state['attempt']['setId'])
                        if control.is_dir() and not (control / 'first-failure.json').exists():
                            atomic(control / 'first-failure.json', output)
            except Exception:
                pass
        print(json.dumps(output), flush=True)
        sys.exit(1)
