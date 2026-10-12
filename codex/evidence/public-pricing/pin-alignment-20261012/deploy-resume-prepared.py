"""Exact staging marketing artifact/pin swap with independent paired closure.
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
ROOT = P('/var/lib/passvero-marketing-pin-alignment-20261012')
OLD_BUILD = 'mMVPOjFPkw5L42RIqziS4'
NEW_BUILD = '853RYrj-r5cyoSGuJudap'
OLD_CANONICAL = 'f7039de22d508baac9d70cda13eed9a98b550af93f8b0f92fadbea9fa8106c40'
NEW_CANONICAL = 'b2a5866a532ecc9912fae5ebeb83086ff0a5f2d162b40a5c031723471ab898e9'
OLD_CONFIG = '399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'
NEW_CONFIG = 'c93266b5d07a7afcfb97ab9ebbbac49dc342348ec61344dc1e9d53f1e8ea1f9a'
ARTIFACT_PIN = '8222518bd18a446278df3e375a2fdfe1af92c598cddecc46d072c6b745e13817'
ARCHIVE_PIN = '8c3e74a998966976aa92777a37fb1b040b2d02dea1ac49c4a1f148744e062a1e'
TIMERS = ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer')
CHECK_ID = 'SCOPE'


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def read(path):
    require(stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(), 'REGULAR_FILE_REQUIRED')
    return path.read_bytes()


def atomic(path, body):
    temp = path.with_name(path.name + '.marketing-' + uuid.uuid4().hex)
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
    return int(value[2:]) / 1000000


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
        result.append(load('marketing_' + name, root / (name + '-' + pin + '.py'), pin))
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
                'passvero-stage*restore*.service', 'passvero-stage*capture*.service', 'passvero-stage*resume*.service'])
    require(not any(len(line.split()) >= 4 and line.split()[2] in ('active', 'activating', 'deactivating')
                    for line in body.splitlines()), 'RECOVERY_UNIT_ACTIVE_STOP')
    for entry in P('/proc').iterdir():
        if not entry.name.isdecimal() or int(entry.name) == os.getpid():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().split(b'\0')
        except (FileNotFoundError, ProcessLookupError):
            continue
        require(not any(arg.startswith(b'/var/lib/passvero-staging-recovery/restore/')
                        or arg.startswith(str(CODE).encode()) for arg in args), 'RECOVERY_PROCESS_ACTIVE_STOP')


def health(prepare):
    deadline = time.monotonic() + 45
    while time.monotonic() < deadline:
        try:
            process, _ = prepare.runtime()
            value = run(['/usr/bin/curl', '--silent', '--max-time', '3', '--output', '/dev/null',
                         '--write-out', '%{http_code} %{ssl_verify_result}', 'https://staging.passvero.eu/hr'], timeout=5)
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


def deployment(resume_prepared=False):
    global CHECK_ID
    require(not (ROOT / 'attempt.json').exists(), 'ONE_DEPLOY_ATTEMPT_NO_RETRY')
    if resume_prepared:
        require(not (ROOT / 'resume-attempt.json').exists(), 'ONE_PREPARED_CONTINUATION_ONLY')
        require(json.loads(read(ROOT / 'first-failure.json')) == {'result': 'STOP',
                'CHECK_ID': 'PREPARE_AND_PRESERVE', 'reason': 'NEXT_REGULAR_TERM_TOO_CLOSE_STOP',
                'automaticRetry': False}, 'ORIGINAL_STOP_CHANGED')
        require(json.loads(read(ROOT / 'closure.json')) == {'coordination': 'NOT_STARTED',
                'rollback': 'NOT_NEEDED', 'timerChanges': 'NONE'}, 'ORIGINAL_CLOSURE_CHANGED')
    config_bytes = read(CODE / 'config.json')
    require(sha(config_bytes) == OLD_CONFIG, 'OLD_CONFIG_CHANGED')
    config = json.loads(config_bytes)
    prepare, cap = helpers(config)
    # Reuse the exact reviewed read-only preflight; no backup helper main is called.
    preflight = load('reviewed_marketing_preflight', ROOT / 'preflight-v2.py',
                     'f176a0d74ed133498986d8e9055a19320e77bca1078dbc773ad7b28b195f7892')
    preflight.INPUT = ROOT
    preflight.main()
    old_bytes = read(CANONICAL)
    prior = verify_manifest(old_bytes, OLD_CANONICAL, OLD_BUILD)
    artifact_bytes = read(ROOT / 'artifact-manifest.json')
    require(sha(artifact_bytes) == ARTIFACT_PIN and sha(read(ROOT / 'application.tar.gz')) == ARCHIVE_PIN, 'PACKAGE_CHANGED')
    artifact = json.loads(artifact_bytes)
    candidate = dict(prior)
    candidate['build_id'] = NEW_BUILD
    candidate['marketing_artifact_manifest_sha256'] = ARTIFACT_PIN
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
    prepared = ROOT / 'prepared'
    if resume_prepared:
        require(prepared.is_dir() and not prepared.is_symlink() and prepared.lstat().st_uid == 0
                and stat.S_IMODE(prepared.stat().st_mode) == 0o700, 'PREPARED_DIRECTORY_CHANGED')
        files = {str(path.relative_to(prepared)): path for path in prepared.rglob('*') if path.is_file()}
        require(set(files) == set(artifact['files']), 'PREPARED_INVENTORY_CHANGED')
        for path in prepared.rglob('*'):
            require(not path.is_symlink(), 'PREPARED_SYMLINK')
        for name, path in files.items():
            entry = artifact['files'][name]
            info = path.lstat()
            require(info.st_uid == account.pw_uid and info.st_gid == account.pw_gid
                    and stat.S_IMODE(info.st_mode) == 0o640 and len(read(path)) == entry['bytes']
                    and sha(read(path)) == entry['sha256'], 'PREPARED_ARTIFACT_CHANGED')
        for name, body in [('old-canonical.json', old_bytes), ('old-config.json', config_bytes),
                           ('new-canonical.json', new_canonical), ('new-config.json', json_bytes(new_config))]:
            require(read(ROOT / name) == body, 'SAVED_EXACT_PIN_INPUT_CHANGED')
    else:
        require(not prepared.exists(), 'PREPARED_TARGET_EXISTS')
        prepared.mkdir(mode=0o700)
        with tarfile.open(ROOT / 'application.tar.gz') as archive:
            for item in archive.getmembers():
                require(item.isfile() and item.name in artifact['files'], 'ARCHIVE_SCOPE')
                body = archive.extractfile(item).read()
                require(sha(body) == artifact['files'][item.name]['sha256'], 'ARCHIVE_MEMBER_CHANGED')
                dest = prepared / item.name
                dest.parent.mkdir(parents=True, exist_ok=True, mode=0o750)
                with open(dest, 'xb') as handle:
                    handle.write(body)
                dest.chmod(0o640)
                os.chown(dest, account.pw_uid, account.pw_gid)
                parent = dest.parent
                while parent != prepared:
                    parent.chmod(0o750)
                    os.chown(parent, account.pw_uid, account.pw_gid)
                    parent = parent.parent
        atomic(ROOT / 'old-canonical.json', old_bytes)
        atomic(ROOT / 'old-config.json', config_bytes)
        atomic(ROOT / 'new-canonical.json', new_canonical)
        atomic(ROOT / 'new-config.json', json_bytes(new_config))
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
        if resume_prepared:
            record('resume-attempt.json', {'originalPreparationReused': True, 'automaticRetry': False})
        record('attempt.json', {'automaticRetry': False, 'timers': baseline, 'backupStateSha256': sha(state),
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
        atomic(CANONICAL, new_canonical)
        atomic(CODE / 'config.json', json_bytes(new_config))
        cap.pm2(prepare, 'restart', 12)
        CHECK_ID = 'VERIFY_NEW_ALIGNED_RELEASE'
        verify_manifest(read(CANONICAL), NEW_CANONICAL, NEW_BUILD)
        require(sha(read(CODE / 'config.json')) == NEW_CONFIG, 'NEW_CONFIG_PIN_MISMATCH')
        process = health(prepare)
        require(read(BACKUP / 'state.json') == state, 'BACKUP_STATE_CHANGED')
        for key in ('ActiveState', 'UnitFileState'):
            require(unit('passvero-subscription-reminders.timer')[key] == writer[key], 'WRITER_TIMER_CHANGED')
        record('body-pass.json', {'deployment': 'PASS', 'buildId': NEW_BUILD, 'canonicalSha256': NEW_CANONICAL,
            'configSha256': NEW_CONFIG, 'artifacts': len(candidate['files']), 'httpsTls': '200_0',
            'runtime': process, 'backupStateUnchanged': True, 'captureRestoreWorkerSmtpTelegramCalls': 0})
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
    atomic(CANONICAL, read(ROOT / 'old-canonical.json'))
    atomic(CODE / 'config.json', read(ROOT / 'old-config.json'))
    verify_manifest(read(CANONICAL), OLD_CANONICAL, OLD_BUILD)
    require(sha(read(CODE / 'config.json')) == OLD_CONFIG, 'ROLLBACK_CONFIG_CHANGED')
    cap.pm2(prepare, 'restart', 12)
    health(prepare)


def close(explicit_rollback=False):
    global CHECK_ID
    CHECK_ID = 'INDEPENDENT_CLOSURE'
    path = ROOT / 'attempt.json'
    if not path.exists():
        record('resume-closure.json', {'coordination': 'NOT_STARTED', 'timerChanges': 'NONE', 'rollback': 'NOT_NEEDED'})
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
            for name in TIMERS:
                require(timer_due(name) - time.time() > 900, 'ROLLBACK_NEXT_TERM_TOO_CLOSE_STOP')
            for name in TIMERS:
                run(['/usr/bin/systemctl', 'stop', name])
            idle()
        healthy_new = (ROOT / 'body-pass.json').exists() and not explicit_rollback
        if healthy_new:
            verify_manifest(read(CANONICAL), NEW_CANONICAL, NEW_BUILD)
            require(sha(read(CODE / 'config.json')) == NEW_CONFIG, 'CLOSURE_NEW_CONFIG_CHANGED')
            health(prepare)
        else:
            paired_rollback(prepare, cap)
        require(sha(read(BACKUP / 'state.json')) == expected_state, 'BACKUP_HISTORY_OR_STATE_CHANGED')
        restore_timers(attempt['timers'])
        for key, value in attempt['writerTimer'].items():
            require(unit('passvero-subscription-reminders.timer')[key] == value, 'WRITER_BASELINE_CHANGED')
        record('resume-closure.json', {'release': 'NEW_ALIGNED' if healthy_new else 'OLD_ROLLED_BACK_ALIGNED',
            'backupAndMonitor': {name: unit(name) for name in TIMERS}, 'backupStateUnchanged': True,
            'writerTimerUnchanged': True, 'rollback': 'PREPARED_NOT_EXECUTED' if healthy_new else 'PASS_PAIRED_NO_DELETION',
            'artifactsRetained': True, 'automaticRetry': False})
    finally:
        os.close(fd)


def main():
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    os.umask(0o077)
    mode = sys.argv[1]
    require(mode in ('--resume-prepared', '--close', '--rollback'), 'MODE_SCOPE')
    if mode == '--resume-prepared':
        deployment(resume_prepared=True)
    else:
        close(mode == '--rollback')


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        result = {'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}
        name = 'resume-closure-failure.json' if '--close' in sys.argv or '--rollback' in sys.argv else 'resume-first-failure.json'
        if ROOT.is_dir() and not (ROOT / name).exists():
            record(name, result)
        print(json.dumps(result), flush=True)
        sys.exit(1)
