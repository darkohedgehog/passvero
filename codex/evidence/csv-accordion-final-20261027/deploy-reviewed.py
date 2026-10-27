"""Exact staging dashboard artifact/pin swap with independent paired closure.
No DB/Storage mutation, package installation, worker or backup entrypoint execution.
"""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import stat
import subprocess
import sys
import tarfile
import time
import uuid

P = pathlib.Path
APP = P('/var/www/passvero-acceptance')
CODE = P('/usr/local/libexec/passvero-staging-backup')
BACKUP = P('/var/lib/passvero-staging-recovery/recurring')
CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
ROOT = P('/var/lib/passvero-csv-border-deploy-20261027')
OLD_BUILD = 'o881QhduK5s1O2SuiT9jr'
NEW_BUILD = 'YNJg-e6igvm0cUQHZ1S3I'
OLD_CANONICAL = '44ce5b70fa98620b0c9166e1a666e2a750c881c039bbfac64a8d7c052bb9cefa'
NEW_CANONICAL = '83dc0c660cc32ddd3bc00aede88df122ad06265d141e9383b06bbcbcd3f3da92'
OLD_CONFIG = '6bec53494e9b81485c27684f981c80bd57628da6f80d677f2c4aa55ce4734c04'
NEW_CONFIG = '529c802727373c1c5db610e63e093f291d5cdf5cb0faf8e34fe5de4cf1a03bbe'
ARTIFACT_PIN = 'b2692d78b68363cf1b1073a495029fcd0f66836d740695ca57be9b918e4e6412'
ARCHIVE_PIN = '36a0ec847ed240f269887d11baaada65b39ac8cae1054655f936a941a606c903'
TIMERS = ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer')
CHECK_ID = 'SCOPE'
ASSETS = ()
RETAINED = ('.controlled-onboarding/review-access-requests.mjs', '.onboarding-flow/onboarding-access.cjs', '.onboarding-flow/review-access-requests.cjs', 'public/marketing/dashboard-preview-restored.png', 'public/marketing/flags/LICENSE', 'public/marketing/flags/de.svg', 'public/marketing/flags/gb.svg', 'public/marketing/flags/hr.svg', 'public/marketing/flags/pl.svg', 'public/marketing/flags/rs.svg', 'public/marketing/flags/si.svg', 'public/marketing/hero-passport-restored.png', 'public/marketing/passvero-logo.png')


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def read(path):
    require(stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(), 'REGULAR_FILE_REQUIRED')
    return path.read_bytes()


def atomic(path, body):
    temp = path.with_name(path.name + '.dashboard-' + uuid.uuid4().hex)
    fd = os.open(temp, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(body)
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)
    fd = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def json_bytes(value):
    return (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()


def record(name, value):
    atomic(ROOT / name, json_bytes(value))


def run(args, timeout=15):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    require(result.returncode == 0, 'BOUNDED_COMMAND_FAILED')
    return result.stdout.decode().strip()


def unit(name):
    return dict(line.split('=', 1) for line in run(['/usr/bin/systemctl', 'show', name,
        '--property=Id,ActiveState,SubState,UnitFileState,NextElapseUSecRealtime']).splitlines() if '=' in line)


def timer_due(name):
    reply = run(['/usr/bin/busctl', 'call', 'org.freedesktop.systemd1', '/org/freedesktop/systemd1',
                 'org.freedesktop.systemd1.Manager', 'GetUnit', 's', name])
    require(re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"', reply), 'TIMER_DBUS_OBJECT')
    value = run(['/usr/bin/busctl', 'get-property', 'org.freedesktop.systemd1', reply[3:-1],
                 'org.freedesktop.systemd1.Timer', 'NextElapseUSecRealtime'])
    require(re.fullmatch(r't [0-9]{1,20}', value), 'TIMER_TYPED_DUE_REQUIRED')
    numeric = int(value[2:])
    require(0 < numeric < 18446744073709551615, 'TIMER_DUE_VALUE_REQUIRED')
    return numeric / 1000000


def load(name, path, pin):
    info = path.lstat()
    require(info.st_uid == 0 and not info.st_mode & 0o077 and sha(read(path)) == pin, 'PINNED_HELPER_CHANGED')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def helpers(config):
    root = P('/var/lib/passvero-staging-recovery/operator')
    result = []
    for name in ('prepare', 'capture'):
        pin = config['helpers'][name]
        result.append(load('dashboard_' + name, root / (name + '-' + pin + '.py'), pin))
    return result


def verify_manifest(body, pin, build):
    require(sha(body) == pin, 'CANONICAL_EXACT_PIN_CHANGED')
    manifest = json.loads(body)
    require(manifest['build_id'] == build == read(APP / '.next/BUILD_ID').decode().strip(), 'BUILD_ID_CHANGED')
    for name, entry in manifest['files'].items():
        path = APP / name
        require(not P(name).is_absolute() and '..' not in P(name).parts
                and path.resolve().is_relative_to(APP.resolve()), 'CANONICAL_PATH_SCOPE')
        require(sha(read(path)) == entry['sha256'], 'EXECUTABLE_ARTIFACT_CHANGED')
    return manifest


def idle():
    require(unit('passvero-staging-backup.service')['ActiveState'] in ('inactive', 'failed'), 'BACKUP_ACTIVE_STOP')
    require(unit('passvero-staging-backup-monitor.service')['ActiveState'] in ('inactive', 'failed'), 'MONITOR_ACTIVE_STOP')
    body = run(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend',
                'passvero-stag*restore*.service', 'passvero-stag*capture*.service', 'passvero-stag*resume*.service', 'passvero-stag*recovery*.service'])
    require(not any(len(line.split()) >= 4 and line.split()[2] in ('active', 'activating', 'deactivating')
                    for line in body.splitlines()), 'RECOVERY_UNIT_ACTIVE_STOP')
    for entry in P('/proc').iterdir():
        if not entry.name.isdecimal() or int(entry.name) == os.getpid():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().split(b'\0')
        except (FileNotFoundError, ProcessLookupError):
            continue
        require(not any(arg.startswith(b'/var/lib/passvero-staging-recovery/')
                        or arg.startswith(str(CODE).encode()) for arg in args), 'RECOVERY_PROCESS_ACTIVE_STOP')


def health(prepare):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            process, _ = prepare.runtime()
            value = run(['/usr/bin/curl', '--silent', '--max-time', '3', '--output', '/dev/null',
                         '--write-out', '%{http_code} %{ssl_verify_result}', '--header', 'Accept-Language: hr',
                         '--cookie', 'NEXT_LOCALE=hr', 'https://staging.passvero.eu/'], timeout=5)
            if value == '200 0':
                return process
        except Exception:
            pass
        time.sleep(1)
    raise RuntimeError('STAGING_HTTPS_OR_RUNTIME_NOT_READY')


def restore_timers(baseline):
    for name, wanted in baseline.items():
        current = unit(name)
        require(current['UnitFileState'] == wanted['UnitFileState'], 'TIMER_ENABLEMENT_CHANGED')
        require(wanted['ActiveState'] == 'active', 'UNREVIEWED_TIMER_BASELINE')
        if current['ActiveState'] != 'active':
            run(['/usr/bin/systemctl', 'start', name])
        current = unit(name)
        require(current['ActiveState'] == 'active' and current['UnitFileState'] == 'enabled', 'TIMER_NOT_RESTORED')


def verify_retained_members():
    saved = ROOT / 'old-canonical.json'
    body = read(saved if saved.exists() else CANONICAL)
    require(sha(body) == OLD_CANONICAL, 'RETAINED_CANONICAL_MANIFEST_CHANGED')
    public = {name: entry for name, entry in json.loads(body)['files'].items() if not name.startswith(('.next/', 'messages/'))}
    require(set(public) == set(RETAINED), 'CANONICAL_RETAINED_SCOPE')
    for name, entry in public.items():
        target = APP / name
        require(target.resolve().is_relative_to(APP.resolve()) and sha(read(target)) == entry['sha256'], 'RETAINED_CANONICAL_MEMBER_CHANGED')


def deployment():
    global CHECK_ID
    require(not (ROOT / 'canonical-deploy-attempt.json').exists(), 'ONE_REVIEWED_CANONICAL_DEPLOY_ONLY')
    config_bytes = read(CODE / 'config.json')
    require(sha(config_bytes) == OLD_CONFIG, 'OLD_CONFIG_CHANGED')
    config = json.loads(config_bytes)
    prepare, cap = helpers(config)
    # Reuse the exact reviewed read-only preflight; no backup helper main is called.
    preflight = load('reviewed_dashboard_preflight', ROOT / 'package-preflight-v2.py',
                     '6c17e100ebf5e8308ec739b2145e64fe93e32ccca7589d29d898d7c79e27f59f')
    preflight.INPUT = ROOT
    preflight.main()
    old_bytes = read(CANONICAL)
    prior = verify_manifest(old_bytes, OLD_CANONICAL, OLD_BUILD)
    artifact_bytes = read(ROOT / 'artifact-manifest.json')
    require(sha(artifact_bytes) == ARTIFACT_PIN and sha(read(ROOT / 'application.tar.gz')) == ARCHIVE_PIN, 'PACKAGE_CHANGED')
    artifact = json.loads(artifact_bytes)
    candidate = dict(prior)
    candidate['build_id'] = NEW_BUILD
    candidate['csv_artifact_manifest_sha256'] = ARTIFACT_PIN
    candidate['files'] = {name: entry for name, entry in prior['files'].items() if not name.startswith(('.next/', 'messages/'))}
    candidate['files'].update(artifact['files'])
    new_canonical = json_bytes(candidate)
    new_config = dict(config, buildId=NEW_BUILD, canonicalSha256=NEW_CANONICAL)
    require(sha(new_canonical) == NEW_CANONICAL and sha(json_bytes(new_config)) == NEW_CONFIG, 'EXACT_CANDIDATE_CHANGED')
    CHECK_ID = 'PREPARE_AND_PRESERVE'
    account = pwd.getpwnam('passvero-staging')
    require(ROOT.lstat().st_uid == 0 and stat.S_IMODE(ROOT.stat().st_mode) == 0o700
            and not ROOT.is_symlink() and APP.is_dir() and not APP.is_symlink(), 'DEPLOY_DIRECTORY_POSTURE')
    require(ROOT.stat().st_dev == APP.stat().st_dev, 'ATOMIC_RENAME_FILESYSTEM_REQUIRED')
    verify_retained_members()
    prepared = ROOT / 'prepared'
    require(not prepared.exists(), 'PREPARATION_ALREADY_PRESENT')
    prepared.mkdir(mode=0o700)
    with tarfile.open(ROOT / 'application.tar.gz') as archive:
        members = archive.getmembers()
        require({item.name for item in members} == set(artifact['files'])
                and len(members) == len(artifact['files']), 'ARCHIVE_INVENTORY')
        for item in members:
            require(item.isfile() and not P(item.name).is_absolute() and '..' not in P(item.name).parts
                    and (item.name.startswith(('.next/', 'messages/')) or item.name in ASSETS), 'ARCHIVE_PATH_SCOPE')
            body = archive.extractfile(item).read()
            entry = artifact['files'][item.name]
            require(len(body) == entry['bytes'] and sha(body) == entry['sha256'], 'ARCHIVE_MEMBER_CHANGED')
            target = prepared / item.name
            target.parent.mkdir(mode=0o750, parents=True, exist_ok=True)
            fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o640)
            with os.fdopen(fd, 'wb') as handle:
                handle.write(body)
                handle.flush()
                os.fsync(handle.fileno())
            os.chown(target, account.pw_uid, account.pw_gid)
            os.chmod(target, 0o640)
    for path in prepared.rglob('*'):
        require(not path.is_symlink(), 'PREPARED_SYMLINK')
        if path.is_dir():
            os.chown(path, account.pw_uid, account.pw_gid)
            os.chmod(path, 0o750)
    for name, body in [('old-canonical.json', old_bytes), ('old-config.json', config_bytes),
                       ('new-canonical.json', new_canonical), ('new-config.json', json_bytes(new_config))]:
        require(not (ROOT / name).exists(), 'SAVED_INPUT_ALREADY_PRESENT')
        atomic(ROOT / name, body)
    # Let an already running writer finish naturally; never stop/start its service.
    deadline = time.monotonic() + 60
    while unit('passvero-subscription-reminders.service')['ActiveState'] != 'inactive':
        require(time.monotonic() < deadline, 'WRITER_NOT_IDLE_STOP_NO_KILL')
        time.sleep(1)
    baseline = {name: unit(name) for name in TIMERS}
    state = read(BACKUP / 'state.json')
    writer = unit('passvero-subscription-reminders.timer')
    for name in TIMERS:
        require(baseline[name]['ActiveState'] == 'active' and baseline[name]['UnitFileState'] == 'enabled', 'TIMER_BASELINE_CHANGED')
        require(timer_due(name) - time.time() > 900, 'NEXT_REGULAR_TERM_TOO_CLOSE_STOP')
    require(writer['ActiveState'] == 'active' and writer['UnitFileState'] == 'enabled', 'WRITER_TIMER_BASELINE_CHANGED')
    require(unit('passvero-subscription-reminders.service')['ActiveState'] == 'inactive', 'WRITER_NOT_IDLE_STOP_NO_KILL')
    lock_fd = os.open(BACKUP / 'job.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        idle()
        verify_manifest(read(CANONICAL), OLD_CANONICAL, OLD_BUILD)
        require(read(CODE / 'config.json') == config_bytes and read(BACKUP / 'state.json') == state, 'BASELINE_CHANGED')
        record('canonical-deploy-attempt.json', {'automaticRetry': False, 'timers': baseline, 'backupStateSha256': sha(state),
                'writerTimer': {'ActiveState': writer['ActiveState'], 'UnitFileState': writer['UnitFileState']},
                'mode': 'CONTINUOUS', 'hold': False, 'newBuild': NEW_BUILD})
        CHECK_ID = 'COORDINATE_ONLY_STAGING_TIMERS'
        for name in TIMERS:
            run(['/usr/bin/systemctl', 'stop', name])
        idle()
        CHECK_ID = 'SWAP_APPLICATION_AND_EXACT_PINS'
        cap.pm2(prepare, 'stop', 12)
        for name in ('.next', 'messages'):
            previous = ROOT / ('previous-' + name)
            require(not previous.exists(), 'PREVIOUS_ARTIFACT_TARGET_EXISTS')
            require((APP / name).is_dir() and not (APP / name).is_symlink(), 'APPLICATION_DIRECTORY_SCOPE')
            (APP / name).rename(previous)
            (prepared / name).rename(APP / name)
        verify_retained_members()
        atomic(CANONICAL, new_canonical)
        atomic(CODE / 'config.json', json_bytes(new_config))
        cap.pm2(prepare, 'restart', 12)
        CHECK_ID = 'VERIFY_NEW_ALIGNED_RELEASE'
        verify_manifest(read(CANONICAL), NEW_CANONICAL, NEW_BUILD)
        require(sha(read(CODE / 'config.json')) == NEW_CONFIG, 'NEW_CONFIG_PIN_MISMATCH')
        verify_retained_members()
        process = health(prepare)
        require(read(BACKUP / 'state.json') == state, 'BACKUP_STATE_CHANGED')
        for key in ('ActiveState', 'UnitFileState'):
            require(unit('passvero-subscription-reminders.timer')[key] == writer[key], 'WRITER_TIMER_CHANGED')
        record('canonical-deploy-body-pass.json', {'deployment': 'PASS', 'buildId': NEW_BUILD, 'canonicalSha256': NEW_CANONICAL,
            'configSha256': NEW_CONFIG, 'artifacts': len(candidate['files']), 'httpsTls': '200_0_CANONICAL_ROOT',
            'runtime': process, 'publicAssets': 'ALL_RETAINED_CANONICAL_MEMBERS_UNCHANGED', 'backupStateUnchanged': True, 'captureRestoreWorkerSmtpTelegramCalls': 0})
    finally:
        os.close(lock_fd)


def paired_rollback(prepare, cap):
    global CHECK_ID
    CHECK_ID = 'PAIRED_ROLLBACK'
    cap.pm2(prepare, 'stop', 12)
    for name in ('.next', 'messages'):
        previous = ROOT / ('previous-' + name)
        if previous.exists():
            if (APP / name).exists():
                preserved = ROOT / ('failed-new-' + name)
                require(not preserved.exists(), 'FAILED_ARTIFACT_TARGET_EXISTS')
                (APP / name).rename(preserved)
            previous.rename(APP / name)
    verify_retained_members()
    atomic(CANONICAL, read(ROOT / 'old-canonical.json'))
    atomic(CODE / 'config.json', read(ROOT / 'old-config.json'))
    verify_manifest(read(CANONICAL), OLD_CANONICAL, OLD_BUILD)
    verify_retained_members()
    require(sha(read(CODE / 'config.json')) == OLD_CONFIG, 'ROLLBACK_CONFIG_CHANGED')
    cap.pm2(prepare, 'restart', 12)
    health(prepare)


def close(explicit_rollback=False):
    global CHECK_ID
    CHECK_ID = 'INDEPENDENT_CLOSURE'
    path = ROOT / 'canonical-deploy-attempt.json'
    if not path.exists():
        record('canonical-deploy-closure.json', {'coordination': 'NOT_STARTED', 'timerChanges': 'NONE', 'rollback': 'NOT_NEEDED'})
        return
    attempt = json.loads(read(path))
    require(sha(read(ROOT / 'old-config.json')) == OLD_CONFIG, 'SAVED_CONFIG_CHANGED')
    prepare, cap = helpers(json.loads(read(ROOT / 'old-config.json')))
    fd = os.open(BACKUP / 'job.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        idle()
        expected_state = sha(read(BACKUP / 'state.json')) if explicit_rollback else attempt['backupStateSha256']
        if explicit_rollback:
            require(not (ROOT / 'rollback-attempt.json').exists(), 'ONE_ROLLBACK_ONLY')
            verify_manifest(read(CANONICAL), NEW_CANONICAL, NEW_BUILD)
            require(sha(read(CODE / 'config.json')) == NEW_CONFIG, 'ROLLBACK_CURRENT_CONFIG_CHANGED')
            require(unit('passvero-subscription-reminders.service')['ActiveState'] == 'inactive', 'WRITER_NOT_IDLE_STOP_NO_KILL')
            for name in TIMERS:
                require(unit(name)['ActiveState'] == 'active' and unit(name)['UnitFileState'] == 'enabled', 'ROLLBACK_TIMER_BASELINE_CHANGED')
            for name in TIMERS:
                require(timer_due(name) - time.time() > 900, 'ROLLBACK_NEXT_TERM_TOO_CLOSE_STOP')
            record('rollback-attempt.json', {'automaticRetry': False, 'backupStateSha256': expected_state})
            for name in TIMERS:
                run(['/usr/bin/systemctl', 'stop', name])
            idle()
        healthy_new = (ROOT / 'canonical-deploy-body-pass.json').exists() and not explicit_rollback
        if healthy_new:
            verify_manifest(read(CANONICAL), NEW_CANONICAL, NEW_BUILD)
            require(sha(read(CODE / 'config.json')) == NEW_CONFIG, 'CLOSURE_NEW_CONFIG_CHANGED')
            verify_retained_members()
            health(prepare)
        else:
            paired_rollback(prepare, cap)
        require(sha(read(BACKUP / 'state.json')) == expected_state, 'BACKUP_HISTORY_OR_STATE_CHANGED')
        restore_timers(attempt['timers'])
        for key, value in attempt['writerTimer'].items():
            require(unit('passvero-subscription-reminders.timer')[key] == value, 'WRITER_BASELINE_CHANGED')
        record('rollback-closure.json' if explicit_rollback else 'canonical-deploy-closure.json', {'release': 'NEW_ALIGNED' if healthy_new else 'OLD_ROLLED_BACK_ALIGNED',
            'backupAndMonitor': {name: unit(name) for name in TIMERS}, 'backupStateUnchanged': True,
            'writerTimerUnchanged': True, 'rollback': 'PREPARED_NOT_EXECUTED' if healthy_new else 'PASS_PAIRED_NO_DELETION',
            'artifactsRetained': True, 'automaticRetry': False})
    finally:
        os.close(fd)


def main():
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    os.umask(0o077)
    mode = sys.argv[1]
    require(mode in ('--deploy-reviewed', '--close', '--rollback'), 'MODE_SCOPE')
    if mode == '--deploy-reviewed':
        deployment()
    else:
        close(mode == '--rollback')


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        result = {'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}
        name = 'rollback-closure-failure.json' if '--rollback' in sys.argv else ('canonical-deploy-closure-failure.json' if '--close' in sys.argv else 'canonical-deploy-first-failure.json')
        if ROOT.is_dir() and not (ROOT / name).exists():
            record(name, result)
        print(json.dumps(result), flush=True)
        sys.exit(1)
