"""One bounded lock maintenance operation. Not a scan/acceptance/recovery harness.
Private operation copy is run by systemd; ExecStopPost independently restores timer.
No manual producer call, snapshot write, counter reset, or existing-record mutation.
"""
import contextlib
import datetime
import fcntl
import hashlib
import json
import math
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess
import sys
import time

ROOT = Path('/var/lib/passvero-signature-lock-release-20261020-01/env-launch-continuation')
TIMER = 'passvero-signature-health.timer'
SERVICE = 'passvero-signature-health.service'
CONFIG = Path('/etc/passvero-signature-health.json')
OUTPUT = Path('/var/lib/passvero-signature-health/health.json')
LOCK = Path('/var/lib/passvero-signature-health/health.json.lock')
RECORDS = Path('/var/lib/passvero-signature-trust/records/recovery')
PRODUCER = Path('/usr/local/libexec/passvero-signature-health.cjs')
READER = Path('/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs')
PRODUCER_PIN = '725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b'
SERVICE_UNIT_PIN = '5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe'
READER_PIN = '877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62'
PROPERTIES = ('Id,LoadState,ActiveState,SubState,UnitFileState,MainPID,ControlPID,ControlGroup,'
              'InvocationID,ExecMainStartTimestampMonotonic,Result,ExecMainStatus,User,Group,Type,'
              'Triggers,TriggeredBy,FragmentPath,DropInPaths,ExecStartPre,ExecStartPost,'
              'ExecStop,ExecStopPost,StandardOutput,WantedBy,RequiredBy,UpheldBy')
DEADLINE = None


class Stop(Exception): pass


def need(ok, code):
    if not ok: raise Stop(code)


def stamp(): return datetime.datetime.now(datetime.timezone.utc).isoformat()
def sha(body): return hashlib.sha256(body).hexdigest()


def safe_read(path, limit=16384):
    for parent in path.parents:
        s = parent.lstat()
        need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'PRIVATE_PARENT_REQUIRED')
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        before = os.fstat(fd)
        need(stat.S_ISREG(before.st_mode) and before.st_uid == 0 and before.st_nlink == 1
             and not before.st_mode & 0o022 and 0 < before.st_size <= limit, 'PRIVATE_FILE_REQUIRED')
        body = os.read(fd, limit + 1)
        after = os.fstat(fd); current = path.lstat()
        need(len(body) == before.st_size and len(body) <= limit, 'READ_BOUND')
        for s in (after, current):
            need((s.st_dev, s.st_ino, s.st_size, s.st_mtime_ns, s.st_ctime_ns)
                 == (before.st_dev, before.st_ino, before.st_size, before.st_mtime_ns, before.st_ctime_ns), 'INPUT_CHANGED')
        return body
    finally: os.close(fd)


def data(name): return json.loads(safe_read(ROOT / name, 32768))


def save(name, value):
    fd = os.open(ROOT / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(value, output, indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())


def run(args, timeout=5, **options):
    remaining = DEADLINE - time.monotonic()
    need(remaining > 0, 'OPERATION_BUDGET_EXPIRED')
    value = subprocess.run(args, capture_output=True, text=True, timeout=min(timeout, remaining), cwd='/',
                           env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C'}, **options)
    need(len(value.stdout.encode()) <= 65536, 'COMMAND_OUTPUT_BOUND')
    return value


def system(*args):
    value = run(['/usr/bin/systemctl', *args])
    need(value.returncode == 0, 'SYSTEMCTL_FAILED')
    return value.stdout


def unit(name):
    return dict(line.split('=', 1) for line in system('show', name, '--property=' + PROPERTIES).splitlines() if '=' in line)


def producer_launch_contract():
    """Exact current protected declaration, not a reconstruction of installer history.
    Compare all argv values privately; never emit environment values or their hashes.
    """
    object_path = '/org/freedesktop/systemd1/unit/passvero_2dsignature_2dhealth_2eservice'
    fragment = Path('/etc/systemd/system/passvero-signature-health.service')

    def prop(interface, name, signature):
        response = run(['/usr/bin/busctl', '--system', '--json=short', 'get-property',
                        'org.freedesktop.systemd1', object_path, interface, name])
        need(response.returncode == 0, 'TYPED_EXECSTART_UNAVAILABLE')
        parsed = json.loads(response.stdout)
        need(isinstance(parsed, dict) and parsed.get('type') == signature and 'data' in parsed,
             'TYPED_EXECSTART_INVALID')
        value = parsed['data']
        need((signature == 's' and isinstance(value, str))
             or (signature == 'as' and isinstance(value, list) and all(isinstance(v, str) for v in value))
             or (signature == 'b' and type(value) is bool)
             or (signature == 'a(sasbttttuii)' and isinstance(value, list)), 'TYPED_PROPERTY_VALUE_INVALID')
        return value

    def metadata():
        interface = 'org.freedesktop.systemd1.Unit'
        return (prop(interface, 'Id', 's'), prop(interface, 'FragmentPath', 's'),
                prop(interface, 'DropInPaths', 'as'), prop(interface, 'NeedDaemonReload', 'b'))

    before = metadata()
    need(before == (SERVICE, str(fragment), [], False), 'LOADED_PRODUCER_UNIT_DRIFT')
    body = safe_read(fragment, 32768)
    need(sha(body) == SERVICE_UNIT_PIN, 'PROTECTED_PRODUCER_UNIT_PIN_CHANGED')
    section, commands = None, []
    for line in body.decode('utf-8').splitlines():
        text = line.strip()
        if not text or text.startswith(('#', ';')): continue
        if text.startswith('[') and text.endswith(']'):
            section = text
            continue
        if section == '[Service]' and '=' in line:
            key, value = line.split('=', 1)
            if key.strip() == 'ExecStart': commands.append(value.strip())
    need(len(commands) == 1, 'PROTECTED_EXECSTART_COUNT_CHANGED')
    command = commands[0]
    # Only the plain grammar confirmed by diagnostic05; never emulate shell/expansion.
    need(not any(c in command for c in ('\\', '"', "'", '$', '%'))
         and not any(ord(c) < 32 and c != '\t' for c in command), 'UNREVIEWED_UNIT_EXECSTART_GRAMMAR')
    declared = command.split()
    entries = prop('org.freedesktop.systemd1.Service', 'ExecStart', 'a(sasbttttuii)')
    need(isinstance(entries, list) and len(entries) == 1, 'PRODUCER_EXECSTART_COUNT_DRIFT')
    entry = entries[0]
    need(isinstance(entry, list) and len(entry) == 10, 'PRODUCER_EXECSTART_SHAPE_INVALID')
    executable, args, ignore_failure = entry[:3]
    need(executable == '/usr/bin/env' and ignore_failure is False, 'PRODUCER_LAUNCH_POLICY_DRIFT')
    need(isinstance(args, list) and len(args) == 8
         and all(isinstance(arg, str) and len(arg) <= 8192 for arg in args), 'PRODUCER_ARGV_SHAPE_DRIFT')
    need(args[0:2] == ['/usr/bin/env', '-i']
         and args[2].startswith('PATH=') and args[3].startswith('LANG=')
         and args[4:] == ['/usr/bin/node', str(PRODUCER), '--config', str(CONFIG)],
         'PRODUCER_EXACT_LAUNCH_STRUCTURE_DRIFT')
    need(args == declared, 'PRODUCER_PRIVATE_ARGV_DECLARATION_MISMATCH')
    need(metadata() == before and safe_read(fragment, 32768) == body, 'PRODUCER_LAUNCH_CHANGED_DURING_READ')


def contracts(paused=False):
    t, s = unit(TIMER), unit(SERVICE)
    need(t.get('LoadState') == s.get('LoadState') == 'loaded', 'UNIT_NOT_LOADED')
    need(t.get('Triggers') == SERVICE and set(s.get('TriggeredBy', '').split()) <= {TIMER}, 'UNREVIEWED_TRIGGER')
    need(all(not s.get(k) for k in ('WantedBy', 'RequiredBy', 'UpheldBy')), 'UNREVIEWED_DEPENDENCY_LAUNCHER')
    need(s.get('User') in ('', 'root') and s.get('Group') in ('', 'root') and s.get('Type') == 'oneshot', 'PRODUCER_UNIT_IDENTITY')
    need(not t.get('DropInPaths') and not s.get('DropInPaths'), 'UNIT_OVERRIDE_REQUIRES_REVIEW')
    producer_launch_contract()
    need(all(not s.get(k) for k in ('ExecStartPre', 'ExecStartPost', 'ExecStop', 'ExecStopPost')), 'ADDITIONAL_EXEC_TRIGGER_REQUIRES_REVIEW')
    need(s.get('StandardOutput') == 'journal', 'PRODUCER_JOURNAL_SINK_DRIFT')
    if paused:
        need(t.get('ActiveState') == 'inactive' and t.get('UnitFileState') == 'disabled', 'TIMER_PAUSE_NOT_PROVEN')
    config = safe_read(CONFIG)
    need(json.loads(config)['outputPath'] == str(OUTPUT) and str(OUTPUT) + '.lock' == str(LOCK), 'EXACT_LOCK_SCOPE_MISMATCH')
    need(sha(safe_read(PRODUCER, 2097152)) == PRODUCER_PIN, 'PRODUCER_PIN_CHANGED')
    need(sha(safe_read(READER, 2097152)) == READER_PIN, 'READER_PIN_CHANGED')
    files = {str(CONFIG): sha(config)}
    for name, value in ((TIMER, t), (SERVICE, s)):
        path = Path(value['FragmentPath'])
        need(path == Path('/etc/systemd/system') / name, 'UNIT_FRAGMENT_CHANGED')
        files[str(path)] = sha(safe_read(path))
    return t, s, files


@contextlib.contextmanager
def recovery_gate():
    # Existing reviewed recovery controllers use this same persistent flock inode.
    path = RECORDS / 'operator.lock'
    for parent in path.parents:
        s = parent.lstat()
        need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and not s.st_mode & 0o022, 'RECOVERY_PARENT_POSTURE')
    fd = os.open(path, os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        s = os.fstat(fd)
        need(stat.S_ISREG(s.st_mode) and s.st_uid == 0 and s.st_nlink == 1
             and stat.S_IMODE(s.st_mode) == 0o600, 'RECOVERY_GATE_POSTURE')
        try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise Stop('RECOVERY_CONTROLLER_ACTIVE') from None
        entries = list(RECORDS.iterdir()); need(len(entries) <= 96, 'RECOVERY_RECORD_BOUND')
        for entry in entries:
            if entry.is_dir():
                path = entry / 'state.json'
                if path.exists():
                    need(json.loads(safe_read(path)).get('phase') in ('COMPLETE', 'ROLLED_BACK'), 'UNRESOLVED_RECOVERY_RECORD')
        yield
    finally: os.close(fd)


def processes():
    """Two-observation real PID identity; never print command lines or environments."""
    matches = []
    controller = data('controller.json')
    ancestors = {os.getpid()}
    pid = os.getppid()
    while pid > 1:
        ancestors.add(pid)
        text = Path('/proc', str(pid), 'stat').read_text()
        pid = int(text[text.rfind(')') + 2:].split()[1])
    for entry in Path('/proc').iterdir():
        if not entry.name.isdigit() or int(entry.name) in ancestors: continue
        try:
            first = (entry / 'stat').read_text(); ticks = first[first.rfind(')') + 2:].split()[19]
            status = dict(line.split(':', 1) for line in (entry / 'status').read_text().splitlines() if ':' in line)
            uids = list(map(int, status['Uid'].split()))
            executable = os.readlink(entry / 'exe')
            with (entry / 'cmdline').open('rb') as stream: raw = stream.read(65537)
            need(len(raw) <= 65536, 'PROCESS_ARG_BOUND')
            args = raw.decode('utf-8', 'replace').split('\0')
            cgroup = (entry / 'cgroup').read_text()
            second = (entry / 'stat').read_text()
            need(second[second.rfind(')') + 2:].split()[19] == ticks and os.readlink(entry / 'exe') == executable, 'PROCESS_IDENTITY_UNSTABLE')
            if int(entry.name) == controller['pid']:
                need(ticks == controller['startTicks'] and executable == controller['executable'] and uids == controller['uids'], 'OPERATOR_CONTROLLER_IDENTITY_CHANGED')
                continue
            known = (any('passvero-signature-health' in a or 'passvero-signature-recovery' in a or 'passvero-signature-trust' in a or 'produce-document-signature-health' in a or 'recover-document-signature-health' in a
                         or 'recover-release-reviewed.py' in a or 'recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py' in a for a in args)
                     or SERVICE in cgroup or 'passvero-auth-flow-scanner-' in cgroup or 'passvero-reboot-scanner-' in cgroup)
            # Unknown root interpreters can execute inline/imported producer code. Refuse uncertainty.
            interpreter = 0 in uids and re.fullmatch(r'(?:node|nodejs|python[0-9.]*)', Path(executable).name)
            tail = [a for a in args[1:] if a]
            unrelated_qpdf = tail in ([['-I', name] for name in ('/usr/local/libexec/passvero-qpdf-broker.py', '/usr/local/libexec/passvero-qpdf-broker-setup.py')] + [['-I', '-B', name] for name in ('/usr/local/libexec/passvero-qpdf-broker.py', '/usr/local/libexec/passvero-qpdf-broker-setup.py')])
            if known or (interpreter and not unrelated_qpdf):
                matches.append({'pid': int(entry.name), 'startTicks': ticks, 'classification': 'KNOWN_PRODUCER_OR_RECOVERY' if known else 'UNREVIEWED_ROOT_INTERPRETER'})
        except (FileNotFoundError, ProcessLookupError): continue
        except PermissionError: raise Stop('PROCESS_INSPECTION_INCOMPLETE') from None
    return matches


def idle():
    s = unit(SERVICE)
    need(s.get('ActiveState') in ('inactive', 'failed') and s.get('MainPID') == '0'
         and s.get('ControlPID') == '0', 'PRODUCER_STILL_ACTIVE')
    found = processes()
    need(not found, 'PRODUCER_RECOVERY_OR_UNREVIEWED_ROOT_INTERPRETER_ACTIVE')
    return {'serviceIdle': True, 'realProcessScan': 'PASS_NO_KNOWN_OR_UNREVIEWED_WRITER', 'recoveryFlock': 'EXCLUSIVE_HELD'}


def lock_state(parent_fd):
    s = os.stat(LOCK.name, dir_fd=parent_fd, follow_symlinks=False)
    need(stat.S_ISDIR(s.st_mode) and s.st_uid == 0 and s.st_gid == 0
         and stat.S_IMODE(s.st_mode) == 0o700, 'LOCK_NOT_EXPECTED_ROOT_PRIVATE_DIRECTORY')
    fd = os.open(LOCK.name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent_fd)
    try:
        actual = os.fstat(fd)
        need((actual.st_dev, actual.st_ino) == (s.st_dev, s.st_ino), 'LOCK_IDENTITY_CHANGED')
        need(not os.listdir(fd), 'LOCK_NOT_EMPTY')
        return {'device': s.st_dev, 'inode': s.st_ino, 'mode': '0700', 'uid': s.st_uid, 'gid': s.st_gid,
                'ctimeNs': s.st_ctime_ns, 'mtimeNs': s.st_mtime_ns, 'empty': True}
    finally: os.close(fd)


def operation():
    with recovery_gate():
        t, s, files = contracts()
        need(t.get('ActiveState') == 'active' and t.get('UnitFileState') == 'enabled', 'NO_ACTIVE_ENABLED_TIMER_BASELINE')
        parent = OUTPUT.parent
        parent_info = parent.lstat()
        need(stat.S_ISDIR(parent_info.st_mode) and parent_info.st_uid == 0 and not parent_info.st_mode & 0o022, 'LOCK_PARENT_POSTURE')
        fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            identity = lock_state(fd)
            save('baseline.json', {'timer': {'enabled': t['UnitFileState'], 'active': t['ActiveState']},
                 'files': files, 'parent': {'device': parent_info.st_dev, 'inode': parent_info.st_ino},
                 'lock': identity, 'at': stamp(), 'operatorWindow': 'EXCLUSIVE_NO_PARALLEL_ROOT_LAUNCH_REQUIRED'})
            save('pause-intent.json', {'timer': TIMER, 'at': stamp()})
            system('disable', '--now', TIMER)
            contracts(paused=True)
            # Same existing bounded drain envelope; no kill, scan or active-process stop.
            end = time.monotonic() + 20
            while unit(SERVICE).get('ActiveState') in ('active', 'activating', 'deactivating') and time.monotonic() < end:
                time.sleep(0.2)
            first = idle()
            need(lock_state(fd) == identity, 'LOCK_CHANGED_OR_REPLACED_AFTER_PAUSE')
            current = parent.lstat()
            need((current.st_dev, current.st_ino) == (parent_info.st_dev, parent_info.st_ino), 'LOCK_PARENT_CHANGED')
            _, _, final_files = contracts(paused=True)
            need(final_files == files, 'CONFIG_OR_UNIT_DRIFT')
            second = idle()
            need(lock_state(fd) == identity, 'LOCK_CHANGED_IMMEDIATELY_BEFORE_RMDIR')
            # Only this exact empty directory, relative to the verified parent fd.
            save('removal-intent.json', {'path': str(LOCK), 'identity': identity, 'at': stamp()})
            try:
                os.rmdir(LOCK.name, dir_fd=fd)
            except OSError as error:
                save('removal-rejected.json', {'LOCK_REMOVAL': 'NOT_PERFORMED', 'exceptionClass': type(error).__name__})
                raise Stop('RMDIR_REJECTED_NO_RETRY') from None
            save('removed.json', {'LOCK_REMOVAL': 'PERFORMED', 'at': stamp(), 'path': str(LOCK),
                 'identity': identity, 'absenceChecks': [first, second],
                 'abandoned': 'CONFIRMED_UNDER_EXCLUSIVE_OPERATOR_WINDOW_AND_KNOWN_LAUNCH_GATES'})
        finally: os.close(fd)


def close():
    if (ROOT / 'closure.json').exists(): return data('closure.json')
    result = {'timerRestored': False, 'partial': False, 'pending': [], 'at': stamp()}
    if not (ROOT / 'pause-intent.json').exists():
        result.update(timerRestored=True, closure='NO_TIMER_CHANGE_STARTED')
    else:
        try:
            with recovery_gate():
                baseline = data('baseline.json')
                current_timer, _, files = contracts()
                need(files == baseline['files'], 'RESTORE_CONFIG_OR_UNIT_DRIFT')
                if current_timer.get('ActiveState') == baseline['timer']['active'] and current_timer.get('UnitFileState') == baseline['timer']['enabled']:
                    result.update(timerRestored=True, closure='PASS_TIMER_ALREADY_AT_SAVED_BASELINE', timer=baseline['timer'])
                    save('closure.json', result); return result
                need(current_timer.get('ActiveState') == 'inactive' and current_timer.get('UnitFileState') in ('disabled', 'enabled'), 'TIMER_INTERMEDIATE_STATE_REQUIRES_REVIEW')
                idle()
                if (ROOT / 'removed.json').exists():
                    need(not LOCK.exists() and not LOCK.is_symlink(), 'NEW_LOCK_APPEARED_WHILE_PAUSED')
                else:
                    need(not ((ROOT / 'removal-intent.json').exists() and not LOCK.exists() and not LOCK.is_symlink()), 'REMOVAL_RESULT_INTERRUPTED_UNCONFIRMED')
                    if LOCK.exists() or LOCK.is_symlink():
                        fd = os.open(OUTPUT.parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
                        try: need(lock_state(fd) == baseline['lock'], 'UNREMOVED_LOCK_CHANGED_REVIEW_REQUIRED')
                        finally: os.close(fd)
                    else:
                        result['lockAtClose'] = 'ABSENT_NO_RMDIR_CONFIRMED_NO_ACTIVE_WRITER'
                last = unit(SERVICE)
                save('resume-intent.json', {'epoch': time.time(), 'at': stamp(),
                     'previousStart': last.get('ExecMainStartTimestampMonotonic'), 'previousInvocation': last.get('InvocationID')})
                system('enable', '--now', TIMER)
                t = unit(TIMER)
                need(t.get('ActiveState') == baseline['timer']['active'] and t.get('UnitFileState') == baseline['timer']['enabled'], 'TIMER_BASELINE_RESTORE_NOT_VERIFIED')
                result.update(timerRestored=True, closure='PASS_TIMER_BASELINE_RESTORED', timer=baseline['timer'])
        except BaseException as error:
            result.update(partial=True, closure='PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW',
                          pending=[str(error) if isinstance(error, Stop) else type(error).__name__])
    save('closure.json', result)
    return result


def removal_status():
    if (ROOT / 'removed.json').exists(): return 'PERFORMED'
    if (ROOT / 'removal-rejected.json').exists(): return 'NOT_PERFORMED'
    if (ROOT / 'removal-intent.json').exists(): return 'UNCONFIRMED_REQUIRES_OPERATOR_REVIEW'
    return 'NOT_PERFORMED'


def final_read():
    closure = data('closure.json')
    result = {'closure': closure, 'LOCK_REMOVAL': removal_status(),
              'PRODUCER_MANUAL_RUN': 'NO', 'SCAN_CALLS': 0, 'REBOOT_REPEATED': 'NO', 'BACKUP_ACCEPTANCE_REPEATED': 'NO'}
    if (ROOT / 'stop.json').exists(): result['firstStop'] = data('stop.json')
    if not closure['timerRestored'] or not (ROOT / 'removed.json').exists():
        result['scheduledCycle'] = 'NOT_OBSERVED_OPERATION_STOPPED'; return result
    try:
        resume = data('resume-intent.json'); end = time.monotonic() + 35
        latest = None
        while time.monotonic() < end:
            s = unit(SERVICE)
            if s.get('ExecMainStartTimestampMonotonic') not in (None, '', '0', resume['previousStart']):
                latest = s
                if s.get('ActiveState') in ('inactive', 'failed') and s.get('MainPID') == '0': break
            time.sleep(0.25)
        need(latest is not None and latest.get('ActiveState') in ('inactive', 'failed'), 'ONE_REGULAR_CYCLE_NOT_OBSERVED_WITHIN_35_SECONDS')
        journal = run(['/usr/bin/journalctl', '-u', SERVICE, '--since=@' + str(resume['epoch']),
                       '--no-pager', '--quiet', '-n', '16', '-o', 'json',
                       '--output-fields=__REALTIME_TIMESTAMP,_SYSTEMD_UNIT,_SYSTEMD_INVOCATION_ID,_TRANSPORT,MESSAGE'])
        need(journal.returncode == 0, 'ONE_CYCLE_JOURNAL_READ_FAILED')
        reports = []
        for line in journal.stdout.splitlines():
            try:
                row = json.loads(line); v = json.loads(row.get('MESSAGE', ''))
                if row.get('_SYSTEMD_UNIT') != SERVICE or row.get('_TRANSPORT') != 'stdout': continue
                if not isinstance(v, dict) or set(v) != {'result', 'reason', 'phase', 'durationMs'}: continue
                if v['result'] not in ('PUBLISHED', 'UNTRUSTED', 'BUSY', 'OPERATIONAL_FAILURE'): continue
                if not isinstance(v['phase'], str) or not re.fullmatch('[A-Z_]{1,48}', v['phase']): continue
                if v['reason'] is not None and (not isinstance(v['reason'], str) or not re.fullmatch('[A-Z_]{1,64}', v['reason'])): continue
                if type(v['durationMs']) not in (int, float) or not math.isfinite(v['durationMs']) or v['durationMs'] < 0: continue
                invocation = row.get('_SYSTEMD_INVOCATION_ID', '')
                if not re.fullmatch('[0-9a-f]{32}', invocation): continue
                reports.append({'timestampUs': row['__REALTIME_TIMESTAMP'], 'invocationId': invocation, **v})
            except (ValueError, TypeError, KeyError): continue
        need(len(reports) == 1, 'ONE_LINKED_REGULAR_REPORT_NOT_UNIQUE_OR_NOT_RECORDED')
        need(not latest.get('InvocationID') or latest['InvocationID'] == reports[0]['invocationId'], 'SCHEDULED_INVOCATION_LINK_CHANGED')
        result['scheduledCycle'] = reports[0]
    except BaseException as error:
        result['scheduledCycle'] = {'status': 'NOT_RECORDED', 'reason': str(error) if isinstance(error, Stop) else type(error).__name__}
    try:
        account = pwd.getpwnam('passvero-staging'); need(account.pw_uid == 1001, 'STAGING_UID_CHANGED')
        need(sha(safe_read(READER, 2097152)) == READER_PIN, 'READER_PIN_CHANGED')
        reader = run(['/usr/bin/node', str(READER)], timeout=10, user=account.pw_uid, group=account.pw_gid,
                     extra_groups=os.getgrouplist(account.pw_name, account.pw_gid))
        parsed = json.loads(reader.stdout)
        need(isinstance(parsed, dict) and type(parsed.get('accepted')) is bool, 'READER_RESPONSE_INVALID')
        result['reader'] = {'returnCode': reader.returncode, **{k: parsed[k] for k in ('accepted', 'sequence', 'observedAt', 'expiresAt') if k in parsed}}
    except BaseException as error:
        result['reader'] = {'accepted': False, 'status': 'UNAVAILABLE', 'reason': str(error) if isinstance(error, Stop) else type(error).__name__}
    result['functionalUiCheck'] = 'PENDING_USER_SCAN_STATUS_DOWNLOAD_NOT_RUN_BY_TERMINAL'
    result['status'] = 'PASS_ONE_REGULAR_PUBLICATION_AND_READER' if isinstance(result.get('scheduledCycle'), dict) and result['scheduledCycle'].get('result') == 'PUBLISHED' and result['reader'].get('returnCode') == 0 and result['reader'].get('accepted') is True else 'STOP_ONE_REGULAR_CYCLE_OR_READER_REJECTED_NO_RETRY'
    return result


def main():
    global DEADLINE
    need(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_HOST')
    need(len(sys.argv) == 2 and sys.argv[1] in ('body', 'close', 'final'), 'MODE_INVALID')
    DEADLINE = time.monotonic() + (55 if sys.argv[1] == 'body' else 70 if sys.argv[1] == 'final' else 25)
    try:
        if sys.argv[1] == 'body': operation(); return 0
        if sys.argv[1] == 'close': print(json.dumps(close(), indent=2)); return 0
        result = final_read(); save('final.json', result); print(json.dumps(result, indent=2)); return 0
    except BaseException as error:
        cause = str(error) if isinstance(error, Stop) else type(error).__name__
        result = {'status': 'STOP', 'CHECK_ID': 'LOCK_RELEASE_' + sys.argv[1].upper(), 'reason': cause,
                  'LOCK_REMOVAL': removal_status(),
                  'PRODUCER_MANUAL_RUN': 'NO', 'SCAN_CALLS': 0, 'REBOOT_REPEATED': 'NO', 'BACKUP_ACCEPTANCE_REPEATED': 'NO'}
        if sys.argv[1] == 'body' and not (ROOT / 'stop.json').exists(): save('stop.json', result)
        if sys.argv[1] == 'final':
            if (ROOT / 'closure.json').exists(): result['closure'] = data('closure.json')
            if (ROOT / 'stop.json').exists(): result['firstStop'] = data('stop.json')
            if not (ROOT / 'final.json').exists(): save('final.json', result)
        print(json.dumps(result, indent=2)); return 1


if __name__ == '__main__': sys.exit(main())
