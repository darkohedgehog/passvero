"""Local closure-only candidate. No lock removal and no generic-root-interpreter allowlist.
Reuses reviewed protected launch/config/recovery coordination functions verbatim.
Only timer enable --now is permitted after preconditions. No manual producer run.
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

PRIOR = ROOT
ROOT = PRIOR / 'timer-baseline-closure-only'
EXPECTED_FILES = {
    '/etc/passvero-signature-health.json': '28df856a3a8516f8c33d35bc652b5358dd0dcdd49d185be01a64eb1264a22593',
    '/etc/systemd/system/passvero-signature-health.timer': '5db45222db3785a90940b52f8480e2eeb1b912083c111aca18e70ff0075902f4',
    '/etc/systemd/system/passvero-signature-health.service': '5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe',
}
TOKENS = ('passvero-signature-health', 'passvero-signature-recovery', 'passvero-signature-trust',
          'produce-document-signature-health', 'recover-document-signature-health',
          'recover-release-reviewed.py', 'recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py',
          'passvero-signature-lock-release-')


def record(name, value):
    fd = os.open(ROOT / name, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as output:
        json.dump(value, output, indent=2); output.write('\n'); output.flush(); os.fsync(output.fileno())


def job(name):
    path = '/org/freedesktop/systemd1/unit/' + name.replace('-', '_2d').replace('.', '_2e')
    response = run(['/usr/bin/busctl', '--system', '--json=short', 'get-property',
                    'org.freedesktop.systemd1', path, 'org.freedesktop.systemd1.Unit', 'Job'])
    need(response.returncode == 0, 'PENDING_JOB_READ_UNAVAILABLE')
    value = json.loads(response.stdout)
    need(value.get('type') == '(uo)' and value.get('data') == [0, '/'], 'PENDING_SYSTEMD_JOB')


def known_writers():
    """Closure-only scope: known producer/recovery launch markers, not all root Python.
    This function does not replace or modify the stricter rmdir process guard.
    """
    matches = []; other_root_interpreters = 0
    entries = [p for p in Path('/proc').iterdir() if p.name.isdigit()]
    need(len(entries) <= 4096, 'PROCESS_COUNT_BOUND')
    for entry in entries:
        need(time.monotonic() < DEADLINE, 'PROCESS_OBSERVATION_BUDGET')
        try:
            first = (entry / 'stat').read_text(); ticks = first[first.rfind(')') + 2:].split()[19]
            executable = os.readlink(entry / 'exe')
            status = dict(line.split(':', 1) for line in (entry / 'status').read_text().splitlines() if ':' in line)
            uids = list(map(int, status['Uid'].split()))
            with (entry / 'cmdline').open('rb') as stream: raw = stream.read(65537)
            need(len(raw) <= 65536, 'PROCESS_ARG_BOUND')
            args = raw.decode('utf-8', 'replace').split('\0')
            cgroup = (entry / 'cgroup').read_text()
            second = (entry / 'stat').read_text()
            need(second[second.rfind(')') + 2:].split()[19] == ticks and os.readlink(entry / 'exe') == executable,
                 'PROCESS_IDENTITY_UNSTABLE')
            marker = any(token in arg for token in TOKENS for arg in args) or SERVICE in cgroup or any(
                token in cgroup for token in ('passvero-auth-flow-scanner-', 'passvero-reboot-scanner-'))
            if marker:
                need(len(matches) < 64, 'MATCH_COUNT_BOUND')
                matches.append({'pid': int(entry.name), 'startTicks': ticks, 'classification': 'KNOWN_PRODUCER_OR_RECOVERY_MARKER'})
            elif 0 in uids and re.fullmatch(r'(?:node|nodejs|python[0-9.]*)', Path(executable).name):
                other_root_interpreters += 1
        except (FileNotFoundError, ProcessLookupError): continue
        except PermissionError: raise Stop('PROCESS_INSPECTION_INCOMPLETE') from None
    if matches:
        record('blocked-known-processes.json', {'matches': matches})
        raise Stop('KNOWN_PRODUCER_RECOVERY_OR_MAINTENANCE_ACTIVE')
    return {'knownProducerRecoveryMatches': 0, 'otherRootInterpreterCount': other_root_interpreters,
            'scope': 'CLOSURE_ONLY_NOT_LOCK_REMOVAL_NOT_A_GENERAL_ALLOWLIST',
            'exclusiveOperatorWindowRequired': True}


def idle_for_timer_return():
    t, s, files = contracts(paused=True)
    need(files == EXPECTED_FILES, 'UNIT_OR_CONFIG_IDENTITY_DRIFT')
    need(t.get('Id') == TIMER and s.get('Id') == SERVICE, 'UNIT_IDENTITY_DRIFT')
    need(s.get('ActiveState') in ('inactive', 'failed') and s.get('MainPID') == s.get('ControlPID') == '0',
         'PRODUCER_ACTIVE_DO_NOT_STOP')
    job(SERVICE); job(TIMER)
    return known_writers()


def observe_cycle(previous_start, resume_epoch):
    end = time.monotonic() + 35
    latest = None
    while time.monotonic() < end:
        state = unit(SERVICE)
        if state.get('ExecMainStartTimestampMonotonic') not in (None, '', '0', previous_start):
            latest = state
            if state.get('ActiveState') in ('inactive', 'failed') and state.get('MainPID') == state.get('ControlPID') == '0': break
        time.sleep(0.25)
    need(latest is not None and latest.get('ActiveState') in ('inactive', 'failed')
         and latest.get('MainPID') == latest.get('ControlPID') == '0', 'ONE_REGULAR_CYCLE_NOT_OBSERVED_WITHIN_35_SECONDS')
    response = run(['/usr/bin/journalctl', '-u', SERVICE, '--since=@' + str(resume_epoch), '--no-pager', '--quiet',
                    '-n', '16', '-o', 'json', '--output-fields=__REALTIME_TIMESTAMP,_SYSTEMD_UNIT,_SYSTEMD_INVOCATION_ID,_TRANSPORT,MESSAGE'])
    need(response.returncode == 0, 'REGULAR_CYCLE_JOURNAL_UNAVAILABLE')
    reports = []
    for line in response.stdout.splitlines():
        try:
            row = json.loads(line); value = json.loads(row.get('MESSAGE', ''))
            if row.get('_SYSTEMD_UNIT') != SERVICE or row.get('_TRANSPORT') != 'stdout': continue
            if not isinstance(value, dict) or set(value) != {'result', 'phase', 'reason', 'durationMs'}: continue
            if value['result'] not in ('PUBLISHED', 'UNTRUSTED', 'BUSY', 'OPERATIONAL_FAILURE'): continue
            if not isinstance(value['phase'], str) or not re.fullmatch('[A-Z_]{1,48}', value['phase']): continue
            if value['reason'] is not None and (not isinstance(value['reason'], str) or not re.fullmatch('[A-Z_]{1,64}', value['reason'])): continue
            if type(value['durationMs']) not in (int, float) or not math.isfinite(value['durationMs']) or value['durationMs'] < 0: continue
            invocation = row.get('_SYSTEMD_INVOCATION_ID', '')
            if not re.fullmatch('[0-9a-f]{32}', invocation): continue
            reports.append({'timestampUs': row['__REALTIME_TIMESTAMP'], 'invocationId': invocation, **value})
        except (ValueError, TypeError, KeyError): continue
    need(len(reports) == 1, 'ONE_LINKED_REPORT_NOT_UNIQUE_OR_NOT_RECORDED')
    need(not latest.get('InvocationID') or latest['InvocationID'] == reports[0]['invocationId'], 'REGULAR_CYCLE_INVOCATION_MISMATCH')
    return reports[0]


def main():
    global DEADLINE
    DEADLINE = time.monotonic() + 100
    report = {'operation': 'SIGNATURE_PRODUCER_CLOSURE_ONLY_TIMER_BASELINE_RETURN',
              'automaticRetry': False, 'PROCESS_KILL': 'NO', 'LOCK_REMOVAL': 'NOT_PERFORMED',
              'PRODUCER_MANUAL_RUN': 'NO', 'SCAN_CALLS': 0, 'REBOOT_REPEATED': 'NO',
              'BACKUP_ACCEPTANCE_REPEATED': 'NO', 'TIMER_RESTORE': 'PARTIAL_PENDING',
              'mutationAttempted': False, 'scheduledCycle': 'NOT_OBSERVED', 'reader': 'NOT_RUN_IN_THIS_CLOSURE_ONLY_SCOPE'}
    created = False
    try:
        need(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_OPERATOR_HOST')
        os.umask(0o077)
        need(not ROOT.exists() and not ROOT.is_symlink(), 'CLOSURE_EVIDENCE_ALREADY_EXISTS_NO_RETRY')
        for parent in ROOT.parents:
            info = parent.lstat()
            need(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022, 'PRIVATE_PARENT_REQUIRED')
        need(sha(safe_read(PRIOR / 'conditional-lock-release.py', 32768)) ==
             'c6d2d1b153920872aba24e17a47fa26ec601e41cf717a7dad957f2dd57af3a13', 'EXECUTED_HELPER_PIN_CHANGED')
        saved = {name: safe_read(PRIOR / name, 32768) for name in ('baseline.json', 'closure.json', 'stop.json')}
        baseline, closure, stopped = (json.loads(saved[name]) for name in ('baseline.json', 'closure.json', 'stop.json'))
        need(baseline.get('timer') == {'enabled': 'enabled', 'active': 'active'}
             and baseline.get('files') == EXPECTED_FILES, 'SAVED_BASELINE_MISMATCH')
        need(closure.get('partial') is True and closure.get('timerRestored') is False
             and closure.get('closure') == 'PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW'
             and closure.get('pending') == ['PRODUCER_RECOVERY_OR_UNREVIEWED_ROOT_INTERPRETER_ACTIVE'], 'SAVED_PENDING_CLOSURE_CHANGED')
        need(stopped.get('reason') == 'PRODUCER_RECOVERY_OR_UNREVIEWED_ROOT_INTERPRETER_ACTIVE'
             and stopped.get('LOCK_REMOVAL') == 'NOT_PERFORMED', 'SAVED_STOP_CHANGED')
        need(not any((PRIOR / name).exists() or (PRIOR / name).is_symlink()
                     for name in ('removal-intent.json', 'removed.json', 'resume-intent.json')), 'UNREVIEWED_INTERVENING_OPERATION')
        ROOT.mkdir(mode=0o700); created = True
        record('preparation.json', {'at': stamp(), 'baselineTimer': baseline['timer'],
               'preservedEvidenceSha256': {name: sha(body) for name, body in saved.items()},
               'contract': 'CLOSURE_ONLY_NO_LOCK_REMOVAL_GUARD_CHANGE_EXCLUSIVE_OPERATOR_WINDOW'})
        with recovery_gate():
            for name in ('passvero-signature-lock-release-20261020-01.service',
                         'passvero-signature-lock-release-20261020-01-env-continuation.service'):
                response = run(['/usr/bin/systemctl', 'show', name, '--property=Id,LoadState,ActiveState,MainPID,ControlPID'])
                state = dict(line.split('=', 1) for line in response.stdout.splitlines() if '=' in line)
                need(state.get('Id') == name and state.get('LoadState') in ('loaded', 'not-found')
                     and state.get('ActiveState') in ('inactive', 'failed'), 'PRIOR_MAINTENANCE_UNIT_STATE_UNAVAILABLE_OR_ACTIVE')
                if state['LoadState'] == 'loaded':
                    need(response.returncode == 0 and state.get('MainPID') == state.get('ControlPID') == '0', 'PRIOR_MAINTENANCE_PID_ACTIVE_OR_UNAVAILABLE')
                    job(name)
            report['preflight'] = idle_for_timer_return()
            # Two adjacent observations; retain the recovery controller flock through timer readback.
            report['immediatePreflight'] = idle_for_timer_return()
            need(all(safe_read(PRIOR / name, 32768) == body for name, body in saved.items()), 'HISTORICAL_EVIDENCE_CHANGED')
            last = unit(SERVICE)
            resume_epoch = time.time()
            intent = {'at': stamp(), 'epoch': resume_epoch,
                      'previousStart': last.get('ExecMainStartTimestampMonotonic'),
                      'target': TIMER, 'baseline': baseline['timer'],
                      'mayTriggerRegularProducerImmediately': True}
            record('timer-return-intent.json', intent)
            report['mutationAttempted'] = True
            system('enable', '--now', TIMER) # Sole mutating service/timer call; never start producer directly.
            current = unit(TIMER)
            report['timerReadback'] = {k: current.get(k) for k in ('Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'Triggers')}
            need(current.get('Id') == TIMER and current.get('ActiveState') == 'active'
                 and current.get('UnitFileState') == 'enabled' and current.get('Triggers') == SERVICE, 'TIMER_RETURN_READBACK_MISMATCH')
            report['TIMER_RESTORE'] = 'PASS'
            record('timer-readback.json', {'at': stamp(), **report['timerReadback']})
        # Recovery gate is released; observe, never manually invoke, one normal timer cycle.
        try:
            report['scheduledCycle'] = observe_cycle(intent['previousStart'], resume_epoch)
        except BaseException as error:
            report['scheduledCycle'] = {'status': 'NOT_RECORDED', 'reason': str(error) if isinstance(error, Stop) else type(error).__name__}
        result = report['scheduledCycle'].get('result') if isinstance(report['scheduledCycle'], dict) else None
        report['status'] = 'TIMER_BASELINE_RETURNED_ONE_NATURAL_CYCLE_RECORDED' if result else 'TIMER_BASELINE_RETURNED_CYCLE_NOT_RECORDED_NO_RETRY'
        if result == 'BUSY': report['instruction'] = 'BUSY_RECORDED_NO_LOCK_ACTION_NO_RECOVERY_NO_SECOND_INTERVENTION'
    except BaseException as error:
        report.update(status='STOP_NO_RETRY', CHECK_ID='CLOSURE_ONLY_TIMER_RETURN',
                      reason=str(error) if isinstance(error, Stop) else type(error).__name__)
        if created and (ROOT / 'blocked-known-processes.json').exists():
            try: report['blockedProcesses'] = json.loads(safe_read(ROOT / 'blocked-known-processes.json'))
            except BaseException: report['blockedProcessEvidence'] = 'UNAVAILABLE'
    finally:
        # Independent final observation even if the enable command or journal observation failed.
        try:
            current = unit(TIMER)
            report['finalTimerReadback'] = {k: current.get(k) for k in ('Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'Triggers')}
            matches = current.get('Id') == TIMER and current.get('LoadState') == 'loaded' and current.get('ActiveState') == 'active' and current.get('UnitFileState') == 'enabled' and current.get('Triggers') == SERVICE
            if report['mutationAttempted']:
                report['TIMER_RESTORE'] = 'PASS' if matches else 'PARTIAL_PENDING'
            if not matches: report['pending'] = ['TIMER_BASELINE_RETURN_NOT_CONFIRMED']
        except BaseException as error:
            report['TIMER_RESTORE'] = 'PARTIAL_PENDING'
            report['finalReadbackLimitation'] = str(error) if isinstance(error, Stop) else type(error).__name__
        if created:
            try: record('result.json', {'at': stamp(), **report})
            except BaseException as error: report['evidenceSaveLimitation'] = type(error).__name__
        print(json.dumps(report, indent=2))
    return 0 if report['TIMER_RESTORE'] == 'PASS' else 1


if __name__ == '__main__': sys.exit(main())
