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

ROOT = Path('/var/lib/passvero-signature-lock-release-20261020-01/precise-owner-release')
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
EXPECTED_FILES = {'/etc/passvero-signature-health.json': '28df856a3a8516f8c33d35bc652b5358dd0dcdd49d185be01a64eb1264a22593', '/etc/systemd/system/passvero-signature-health.timer': '5db45222db3785a90940b52f8480e2eeb1b912083c111aca18e70ff0075902f4', '/etc/systemd/system/passvero-signature-health.service': '5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe'}
EXPECTED_PARENT_ID = {'device': 2049, 'inode': 1573155}
EXPECTED_LOCK_ID = {'device': 2049, 'inode': 2161968, 'mode': '0700', 'uid': 0, 'gid': 0, 'ctimeNs': 1791900359945693579, 'mtimeNs': 1791900359945693579, 'empty': True}
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


def data(name): return json.loads(safe_read(ROOT / name, 262144))


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
    need(files == EXPECTED_FILES, 'REVIEWED_CONFIG_OR_UNIT_PIN_CHANGED')
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


# These are reference markers, not an allowlist of unrelated interpreters/services.
REFERENCE_TOKENS = ('passvero-signature-health', 'passvero-signature-recovery',
                    'passvero-signature-trust', 'produce-document-signature-health',
                    'recover-document-signature-health', 'recover-release-reviewed.py',
                    'recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py', 'passvero-signature-lock-release-')
PROCESS_SCAN_NUMBER = 0
MAINTENANCE_UNIT = 'passvero-signature-lock-release-20261021-precise'


def reviewed_runner_argv():
    helper = ROOT / 'conditional-lock-release.py'
    return ['/usr/bin/systemd-run', '--quiet', '--wait', '--unit', MAINTENANCE_UNIT,
            '--property=Type=exec', '--property=Restart=no', '--property=RuntimeMaxSec=65s',
            '--property=TimeoutStopSec=30s', '--property=KillMode=control-group',
            '--property=KillSignal=SIGKILL', '--property=UMask=0077',
            '--property=StandardOutput=null', '--property=StandardError=null',
            '--property=ExecStopPost=/usr/bin/python3 -I -B ' + str(helper) + ' close',
            '/usr/bin/python3', '-I', '-B', str(helper), 'body']


def launch_reasons(row):
    reasons = []
    if str(PRODUCER) in row['args']:
        exact = (row['exe'] == row['nodeExecutable'] and row['args'] ==
                 ['/usr/bin/node', str(PRODUCER), '--config', str(CONFIG)])
        reasons.append('EXACT_PRODUCER_EXEC_ARGV' if exact else 'UNREVIEWED_PRODUCER_REFERENCE')
    if any(token in arg for token in REFERENCE_TOKENS for arg in row['args']):
        reasons.append('KNOWN_LAUNCH_PATH_OR_REFERENCE')
    if any(token in row['cgroup'] for token in
           (SERVICE, 'passvero-auth-flow-scanner-', 'passvero-reboot-scanner-',
            'passvero-signature-lock-release-')):
        reasons.append('KNOWN_PRODUCER_RECOVERY_MAINTENANCE_CGROUP')
    return reasons


def classify_rows(rows, exemptions):
    classified = {pid: launch_reasons(row) for pid, row in rows.items() if pid not in exemptions}
    for _ in range(len(rows) + 1):
        changed = False
        for pid, row in rows.items():
            if pid in exemptions or classified[pid]: continue
            parent = row['ppid']
            if classified.get(parent):
                classified[pid] = ['DESCENDANT_OF_RELEVANT_LAUNCH']
                changed = True
        if not changed: break
    return {pid: reasons for pid, reasons in classified.items() if reasons}


def process_public(row, reasons):
    safe = {'/usr/bin/node', '/usr/bin/python3', str(PRODUCER), str(CONFIG), '--config',
            '-I', '-B', '-', 'body', 'close', 'final', 'recover', '--id',
            str(ROOT / 'conditional-lock-release.py')}
    executable = row['exe'] if re.fullmatch(r'/(?:usr/(?:local/)?(?:s?bin|libexec)|bin|sbin)/[A-Za-z0-9_.+-]+', row['exe']) else '<REDACTED_EXECUTABLE_PATH>'
    units = sorted(set(re.findall(r'(?:^|/)([A-Za-z0-9_.@-]{1,160}\.(?:service|scope))(?:/|$)', row['cgroup'], re.MULTILINE)))
    return {'pid': row['pid'], 'ppid': row['ppid'], 'startTicks': row['ticks'], 'uids': row['uids'],
            'executable': executable, 'systemdUnits': units[:4], 'reasons': reasons,
            'arguments': [{'index': i, 'argument': arg if arg in safe else '<REDACTED>'}
                          for i, arg in enumerate(row['args'][:8])],
            'argumentCount': len(row['args']), 'roleOrLockUseBeyondCriteria': 'NOT_INFERRED'}


def processes():
    """Relevant launch paths/cgroups and lineage, never a generic root interpreter ban."""
    global PROCESS_SCAN_NUMBER
    PROCESS_SCAN_NUMBER += 1
    controller = data('controller.json')
    rows = {}; exited = []; incomplete = []; exemptions = {}
    entries = [p for p in Path('/proc').iterdir() if p.name.isdigit()]
    need(len(entries) <= 4096, 'PROCESS_COUNT_BOUND')
    total = 0
    node_executable = os.path.realpath('/usr/bin/node')
    python_executable = os.path.realpath('/usr/bin/python3')
    for entry in entries:
        need(time.monotonic() < DEADLINE, 'PROCESS_OBSERVATION_BUDGET')
        pid = int(entry.name); args = []; cgroup = ''; ticks = 'NOT_RECORDED'
        try:
            first = (entry / 'stat').read_text(); fields = first[first.rfind(')') + 2:].split()
            ticks = fields[19]; ppid = int(fields[1])
            status = dict(line.split(':', 1) for line in (entry / 'status').read_text().splitlines() if ':' in line)
            uids = list(map(int, status['Uid'].split()))
            with (entry / 'cmdline').open('rb') as stream: raw = stream.read(65537)
            need(len(raw) <= 65536, 'PROCESS_ARG_BOUND'); total += len(raw)
            need(total <= 8388608, 'PROCESS_TOTAL_ARG_BOUND')
            args = raw.decode('utf-8', 'replace').split('\0')
            if args and args[-1] == '': args.pop()
            cgroup = (entry / 'cgroup').read_text()
            try: executable = os.readlink(entry / 'exe')
            except FileNotFoundError:
                if not entry.exists(): raise
                if any(token in arg for token in REFERENCE_TOKENS for arg in args) or any(token in cgroup for token in (SERVICE, 'passvero-auth-flow-scanner-', 'passvero-reboot-scanner-', 'passvero-signature-lock-release-')):
                    incomplete.append({'pid': pid, 'startTicks': ticks, 'reason': 'RELEVANT_EXECUTABLE_UNAVAILABLE'})
                elif args:
                    incomplete.append({'pid': pid, 'startTicks': ticks, 'reason': 'NONEMPTY_ARGV_EXECUTABLE_UNAVAILABLE_RELEVANCE_UNCERTAIN'})
                continue # Empty kernel-thread cmdline is not an interpreter exemption.
            second = (entry / 'stat').read_text(); after = second[second.rfind(')') + 2:].split()
            if after[19] != ticks or int(after[1]) != ppid or os.readlink(entry / 'exe') != executable:
                incomplete.append({'pid': pid, 'startTicks': ticks, 'reason': 'PROCESS_IDENTITY_UNSTABLE'})
                continue
            row = {'pid': pid, 'ppid': ppid, 'ticks': ticks, 'uids': uids, 'exe': executable,
                   'args': args, 'cgroup': cgroup, 'nodeExecutable': node_executable}
            rows[pid] = row
            if pid == os.getpid():
                need(uids == [0] * 4 and executable == python_executable and args ==
                     ['/usr/bin/python3', '-I', '-B', str(ROOT / 'conditional-lock-release.py'), sys.argv[1]], 'MAINTENANCE_SELF_IDENTITY_UNVERIFIED')
                exemptions[pid] = 'EXACT_MAINTENANCE_SELF_PID_EXEC_ARGV'
            elif pid == controller['pid']:
                need(ticks == controller['startTicks'] and executable == controller['executable']
                     and uids == controller['uids'] == [0] * 4
                     and args == ['/usr/bin/python3', '-I', '-B', '-'], 'OPERATOR_CONTROLLER_IDENTITY_CHANGED')
                exemptions[pid] = 'EXACT_SAVED_OPERATOR_CONTROLLER_PID_EXEC_ARGV'
            elif (ppid == controller['pid'] and executable == '/usr/bin/systemd-run'
                  and uids == [0] * 4 and args == reviewed_runner_argv()):
                exemptions[pid] = 'EXACT_CONTROLLER_CHILD_SYSTEMD_RUN_ARGV'
        except (FileNotFoundError, ProcessLookupError):
            relevant = any(token in arg for token in REFERENCE_TOKENS for arg in args) or any(token in cgroup for token in (SERVICE, 'passvero-auth-flow-scanner-', 'passvero-reboot-scanner-', 'passvero-signature-lock-release-'))
            target = incomplete if relevant else exited
            need(len(target) < 64, 'PROCESS_EXIT_RECORD_BOUND')
            target.append({'pid': pid, 'startTicks': ticks, 'reason': 'PROCESS_EXITED_DURING_READ', 'role': 'NOT_INFERRED'})
        except PermissionError:
            incomplete.append({'pid': pid, 'startTicks': ticks, 'reason': 'PROCESS_INSPECTION_INCOMPLETE'})
    need(os.getpid() in exemptions, 'MAINTENANCE_SELF_NOT_OBSERVED')
    classified = classify_rows(rows, exemptions)
    blockers = [process_public(rows[pid], reasons) for pid, reasons in sorted(classified.items())]
    need(len(blockers) <= 64 and len(incomplete) <= 64, 'RELEVANT_PROCESS_RECORD_BOUND')
    proof = {'at': stamp(), 'selfPid': os.getpid(), 'mode': sys.argv[1],
             'coordinationExemptions': [{**process_public(rows[pid], []), 'identity': reason}
                                        for pid, reason in sorted(exemptions.items())],
             'blockers': blockers, 'incomplete': incomplete, 'exitedUnclassified': exited,
             'rootInterpreterAloneIsBlocker': False, 'perServiceInterpreterAllowlist': False,
             'enumeration': 'BOUNDED_NONATOMIC_PROVENANCE_SNAPSHOT',
             'exclusiveOperatorWindow': 'REQUIRED_NO_PARALLEL_MANUAL_ROOT_LAUNCH'}
    save('process-' + sys.argv[1] + '-' + str(PROCESS_SCAN_NUMBER) + '.json', proof)
    if blockers or incomplete:
        name = 'first-process-blocker-' + sys.argv[1] + '.json'
        if not (ROOT / name).exists(): save(name, proof)
    need(not incomplete, 'RELEVANT_PROCESS_IDENTIFICATION_INCOMPLETE')
    return blockers


def pending_launches():
    for name in (SERVICE, TIMER):
        path = '/org/freedesktop/systemd1/unit/' + name.replace('-', '_2d').replace('.', '_2e')
        response = run(['/usr/bin/busctl', '--system', '--json=short', 'get-property',
                        'org.freedesktop.systemd1', path, 'org.freedesktop.systemd1.Unit', 'Job'])
        need(response.returncode == 0, 'PENDING_JOB_READ_UNAVAILABLE')
        value = json.loads(response.stdout)
        need(value.get('type') == '(uo)' and value.get('data') == [0, '/'], 'PRODUCER_OR_TIMER_PENDING_LAUNCH')
    response = run(['/usr/bin/busctl', '--system', '--json=short', 'call',
                    'org.freedesktop.systemd1', '/org/freedesktop/systemd1',
                    'org.freedesktop.systemd1.Manager', 'ListJobs'])
    need(response.returncode == 0, 'QUEUED_RECOVERY_JOB_READ_UNAVAILABLE')
    value = json.loads(response.stdout)
    # busctl call serializes the entire output message: one output array => data[0].
    need(value.get('type') == 'a(usssoo)' and isinstance(value.get('data'), list)
         and len(value['data']) == 1 and isinstance(value['data'][0], list), 'QUEUED_JOB_REPLY_SHAPE_UNVERIFIED')
    jobs = value['data'][0]; need(len(jobs) <= 128, 'QUEUED_JOB_COUNT_BOUND')
    blocked = []
    for row in jobs:
        need(isinstance(row, list) and len(row) == 6 and type(row[0]) is int
             and all(isinstance(item, str) for item in row[1:]), 'QUEUED_JOB_ROW_INVALID')
        name = row[1]
        if name == MAINTENANCE_UNIT + '.service': continue # This exact reviewed maintenance unit only.
        if name == TIMER or any(token in name for token in REFERENCE_TOKENS) or any(
                token in name for token in ('passvero-auth-flow-scanner-', 'passvero-reboot-scanner-')):
            shown = name if re.fullmatch('[A-Za-z0-9_.@-]{1,160}', name) else '<REDACTED_UNIT>'
            blocked.append({'jobId': row[0], 'unit': shown,
                            'jobType': row[2] if re.fullmatch('[a-z-]{1,32}', row[2]) else 'UNREVIEWED',
                            'state': row[3] if row[3] in ('waiting', 'running') else 'UNREVIEWED'})
    if blocked:
        name = 'first-job-blocker-' + sys.argv[1] + '.json'
        if not (ROOT / name).exists(): save(name, {'jobs': blocked})
    need(not blocked, 'RELEVANT_PRODUCER_RECOVERY_JOB_PENDING')

def idle():
    s = unit(SERVICE)
    need(s.get('ActiveState') in ('inactive', 'failed') and s.get('MainPID') == '0'
         and s.get('ControlPID') == '0', 'PRODUCER_STILL_ACTIVE')
    pending_launches()
    found = processes()
    need(not found, 'RELEVANT_PRODUCER_RECOVERY_OR_MAINTENANCE_ACTIVE')
    return {'serviceIdle': True, 'realProcessScan': 'PASS_NO_RELEVANT_LAUNCH_OR_DESCENDANT', 'recoveryFlock': 'EXCLUSIVE_HELD'}


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
        pending_launches()
        before_pause = processes()
        need(not before_pause, 'RELEVANT_PROCESS_ACTIVE_BEFORE_PAUSE')
        parent = OUTPUT.parent
        parent_info = parent.lstat()
        need(stat.S_ISDIR(parent_info.st_mode) and parent_info.st_uid == 0 and not parent_info.st_mode & 0o022, 'LOCK_PARENT_POSTURE')
        fd = os.open(parent, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        try:
            identity = lock_state(fd)
            need({'device': parent_info.st_dev, 'inode': parent_info.st_ino} == EXPECTED_PARENT_ID, 'EXPECTED_LOCK_PARENT_IDENTITY_CHANGED')
            need(identity == EXPECTED_LOCK_ID, 'EXPECTED_SAVED_LOCK_IDENTITY_CHANGED')
            save('baseline.json', {'timer': {'enabled': t['UnitFileState'], 'active': t['ActiveState']},
                 'files': files, 'parent': {'device': parent_info.st_dev, 'inode': parent_info.st_ino},
                 'lock': identity, 'parentPosture': {'uid': parent_info.st_uid, 'gid': parent_info.st_gid, 'mode': oct(stat.S_IMODE(parent_info.st_mode))},
                 'at': stamp(), 'operatorWindow': 'EXCLUSIVE_NO_PARALLEL_ROOT_LAUNCH_REQUIRED'})
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
            current_parent = parent.lstat()
            need(stat.S_ISDIR(current_parent.st_mode) and current_parent.st_uid == 0
                 and not current_parent.st_mode & 0o022
                 and (current_parent.st_dev, current_parent.st_ino) == (parent_info.st_dev, parent_info.st_ino),
                 'LOCK_PARENT_CHANGED_IMMEDIATELY_BEFORE_RMDIR')
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
    """Baseline return only: no directory-identity/absence requirement for resuming timer."""
    if (ROOT / 'closure.json').exists(): return data('closure.json')
    result = {'timerRestored': False, 'partial': False, 'pending': [], 'at': stamp()}
    if not (ROOT / 'pause-intent.json').exists():
        try:
            timer = unit(TIMER)
            result['timerReadback'] = {k: timer.get(k) for k in ('Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'Triggers')}
            observed = timer.get('Id') == TIMER and timer.get('ActiveState') == 'active' and timer.get('UnitFileState') == 'enabled' and timer.get('Triggers') == SERVICE
            result.update(timerRestored=observed, partial=not observed, closure='NO_TIMER_CHANGE_STARTED')
            if not observed: result['pending'] = ['UNCHANGED_TIMER_NOT_AT_EXPECTED_ACTIVE_ENABLED_BASELINE']
        except BaseException as error:
            result.update(partial=True, closure='NO_TIMER_CHANGE_STARTED_READBACK_UNAVAILABLE',
                          pending=[str(error) if isinstance(error, Stop) else type(error).__name__])
    else:
        baseline = None
        try:
            with recovery_gate():
                baseline = data('baseline.json')
                current_timer, _, files = contracts()
                need(files == baseline['files'], 'RESTORE_CONFIG_OR_UNIT_DRIFT')
                if current_timer.get('ActiveState') == baseline['timer']['active'] and current_timer.get('UnitFileState') == baseline['timer']['enabled']:
                    result.update(timerRestored=True, closure='PASS_TIMER_ALREADY_AT_SAVED_BASELINE', timer=baseline['timer'])
                else:
                    need(current_timer.get('ActiveState') == 'inactive' and current_timer.get('UnitFileState') in ('disabled', 'enabled'), 'TIMER_INTERMEDIATE_STATE_REQUIRES_REVIEW')
                    idle() # Precise known-launch/provenance check; no generic root interpreter ban.
                    last = unit(SERVICE)
                    save('resume-intent.json', {'epoch': time.time(), 'at': stamp(),
                         'previousStart': last.get('ExecMainStartTimestampMonotonic'), 'previousInvocation': last.get('InvocationID')})
                    system('enable', '--now', TIMER)
                    result.update(closure='TIMER_RETURN_COMMAND_COMPLETED')
        except BaseException as error:
            result.update(partial=True, closure='PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW',
                          pending=[str(error) if isinstance(error, Stop) else type(error).__name__])
        finally:
            try:
                timer = unit(TIMER)
                result['timerReadback'] = {k: timer.get(k) for k in ('Id', 'LoadState', 'ActiveState', 'SubState', 'UnitFileState', 'Triggers')}
                if baseline is not None:
                    restored = (timer.get('Id') == TIMER and timer.get('LoadState') == 'loaded'
                                and timer.get('ActiveState') == baseline['timer']['active']
                                and timer.get('UnitFileState') == baseline['timer']['enabled']
                                and timer.get('Triggers') == SERVICE)
                    result['timerRestored'] = restored
                    if restored:
                        if result['pending']: result['commandWarning'] = result['pending']
                        result.update(partial=False, pending=[], closure='PASS_TIMER_BASELINE_RESTORED', timer=baseline['timer'])
                    else:
                        result.update(partial=True, closure='PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW')
                        if not result['pending']: result['pending'] = ['TIMER_BASELINE_READBACK_MISMATCH']
            except BaseException as error:
                result.update(timerRestored=False, partial=True, closure='PARTIAL_TIMER_RESTORE_REQUIRES_OPERATOR_REVIEW')
                result['pending'].append(str(error) if isinstance(error, Stop) else type(error).__name__)
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
              'PRODUCER_MANUAL_RUN': 'NO', 'SCAN_CALLS': 0, 'REBOOT_REPEATED': 'NO', 'BACKUP_ACCEPTANCE_REPEATED': 'NO',
              'LOCK_ABANDONMENT': 'CONFIRMED' if (ROOT / 'removed.json').exists() else 'NOT_CONFIRMED',
              'TIMER_RESTORE': 'PASS' if closure['timerRestored'] else 'PARTIAL_PENDING',
              'reader': {'status': 'NOT_RUN', 'reason': 'CYCLE_OBSERVATION_NOT_REACHED'}}
    for mode in ('body', 'close'):
        path = ROOT / ('first-process-blocker-' + mode + '.json')
        if path.exists(): result['processBlocker-' + mode] = data(path.name)
    for mode in ('body', 'close'):
        path = ROOT / ('first-job-blocker-' + mode + '.json')
        if path.exists(): result['jobBlocker-' + mode] = data(path.name)
    if (ROOT / 'stop.json').exists(): result['firstStop'] = data('stop.json')
    if not closure['timerRestored'] or not (ROOT / 'resume-intent.json').exists():
        result['scheduledCycle'] = 'NOT_OBSERVED_OPERATION_STOPPED'
        result['status'] = 'STOP_BODY_OR_CLOSURE_NO_SCHEDULED_OBSERVATION'
        return result
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
    if 'firstStop' in result: result['status'] = 'STOP_BODY_FAILURE_RETAINED_WITH_SEPARATE_CLOSURE_AND_CYCLE_RESULTS'
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
        detail = ROOT / ('first-process-blocker-' + sys.argv[1] + '.json')
        if detail.exists(): result['processBlocker'] = data(detail.name)
        job_detail = ROOT / ('first-job-blocker-' + sys.argv[1] + '.json')
        if job_detail.exists(): result['jobBlocker'] = data(job_detail.name)
        if sys.argv[1] == 'body' and not (ROOT / 'stop.json').exists(): save('stop.json', result)
        if sys.argv[1] == 'final':
            if (ROOT / 'closure.json').exists(): result['closure'] = data('closure.json')
            if (ROOT / 'stop.json').exists(): result['firstStop'] = data('stop.json')
            if not (ROOT / 'final.json').exists(): save('final.json', result)
        print(json.dumps(result, indent=2)); return 1


if __name__ == '__main__': sys.exit(main())
