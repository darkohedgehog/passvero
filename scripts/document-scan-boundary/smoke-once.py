"""Single operator smoke. Local tests inject operations; never contact the VPS."""
import hashlib
import stat
import json
import math
import os
import pathlib
import pwd
import subprocess
import sys
import time

P = pathlib.Path
R = P('/var/lib/passvero-qpdf-staging-20260914/execution-boundary-975dc04')
SPECS = [
    ('HOST_ROOT', 'PREFLIGHT', 'MATCH'),
    ('ATTEMPT_RECORD', 'PREFLIGHT', 'CREATED'),
    ('ARTIFACTS_MATCH', 'STATIC_BASELINE', 'MATCH'),
    ('SOCKET_START', 'START', 'SUCCESS'),
    ('CLIENT_EXEC', 'CLIENT', 'RETURNED'),
    ('CLIENT_REPORT', 'CLIENT', 'VALID_REPORT'),
    ('CLIENT_VALID_PDF', 'CLIENT', 'VALID'),
    ('CLIENT_FORBIDDEN_OPERATION', 'CLIENT', 'REJECTED_REQUEST'),
    ('CLIENT_EXIT', 'CLIENT', 'SUCCESS'),
    ('BROKER_IDENTITY', 'BROKER', 'MATCH'),
    ('REQUEST_LIFECYCLE', 'LIFECYCLE', 'MATCH'),
    ('INPUT_CLEANUP', 'LIFECYCLE', 'EMPTY'),
    ('PARSER_EMPTY', 'LIFECYCLE', 'EMPTY'),
    ('OBSERVATION_CLEANUP', 'CLEANUP', 'REMOVED'),
]
OUTCOMES = {x[2] for x in SPECS} | {
    'MISMATCH', 'IDENTITY_FAILURE', 'ISOLATION_FAILURE', 'INTERNAL_HARNESS_ERROR',
    'CONNECTION_FAILURE', 'TIMEOUT', 'MALFORMED_RESPONSE', 'INCOMPLETE_RESPONSE',
    'UNEXPECTED_VALID_RESPONSE', 'PROCESS_FAILED', 'INVALID_REPORT',
    'OBSERVATION_PERMISSION_DENIED', 'OBSERVATION_PROCESS_EXITED',
    'OBSERVATION_READ_ERROR', 'OBSERVATION_NOT_OBSERVED', 'OBSERVATION_MISSING',
}
CLIENT_OUTCOMES = {'VALID', 'REJECTED_REQUEST', 'CONNECTION_FAILURE', 'TIMEOUT',
                   'MALFORMED_RESPONSE', 'INCOMPLETE_RESPONSE', 'UNEXPECTED_VALID_RESPONSE',
                   'IDENTITY_FAILURE', 'INTERNAL_HARNESS_ERROR', 'UNAVAILABLE'}
CLIENT_KINDS = {'VALID', 'ENCRYPTED', 'INVALID', 'UNSUPPORTED', 'INDETERMINATE', 'TIMEOUT', 'FAILED', 'UNAVAILABLE'}
FIELDS = {'client_kind', 'CHECK_ID', 'phase', 'expected', 'actual', 'duration_ms', 'exit_code', 'signal', 'result'}


def row(spec):
    key, phase, expected = spec
    return dict(client_kind='UNAVAILABLE', CHECK_ID=key, phase=phase, expected=expected, actual='UNAVAILABLE',
                duration_ms=0, exit_code='UNAVAILABLE', signal='UNAVAILABLE', result='NOT_RUN')


def process_fields(code):
    if type(code) is not int:
        return {}
    return {'exit_code': code if code >= 0 else 'UNAVAILABLE',
            'signal': -code if code < 0 else 'UNAVAILABLE'}


def parse_client(raw):
    if len(raw.encode('utf8')) > 4096:
        raise ValueError()
    data = json.loads(raw)
    if not isinstance(data, dict) or set(data) != {'checks'}:
        raise ValueError()
    checks = data['checks']
    if not isinstance(checks, list) or len(checks) != 2:
        raise ValueError()
    failed = False
    for item, spec in zip(checks, [s for s in SPECS if s[0] in ('CLIENT_VALID_PDF', 'CLIENT_FORBIDDEN_OPERATION')]):
        template = row(spec)
        if not isinstance(item, dict) or set(item) != FIELDS:
            raise ValueError()
        if any(item[k] != template[k] for k in ('CHECK_ID', 'phase', 'expected', 'exit_code', 'signal')):
            raise ValueError()
        duration = item['duration_ms']
        if type(duration) not in (int, float) or not math.isfinite(duration) or not 0 <= duration <= 60000:
            raise ValueError()
        if item['client_kind'] not in CLIENT_KINDS:
            raise ValueError()
        if item['actual'] not in CLIENT_OUTCOMES:
            raise ValueError()
        expected_result = 'NOT_RUN' if failed else ('PASS' if item['actual'] == item['expected'] else 'FAIL')
        if item['result'] != expected_result or (failed and item['actual'] != 'UNAVAILABLE'):
            raise ValueError()
        if not failed and item['actual'] == 'UNAVAILABLE':
            raise ValueError()
        failed = failed or item['result'] == 'FAIL'
    return checks


def lifecycle_matches(receipts, broker, client_pid, client_start, uid, gid):
    """Parent-owned records, deliberately NOT independent child isolation proof."""
    if not isinstance(receipts, list) or len(receipts) != 2 or not client_start:
        return False
    for receipt in receipts:
        if not isinstance(receipt, dict) or any(receipt.get(k) != v for k, v in {
                'broker_pid': broker['pid'], 'broker_start': broker['start'],
                'peer_pid': client_pid, 'peer_start': client_start,
                'peer_uid': uid, 'peer_gid': gid}.items()):
            return False
    valid, forbidden = receipts
    children = valid.get('children')
    if (valid.get('operation') != 'PVQ1' or valid.get('kind') != 'VALID'
            or valid.get('input_cleanup') is not True or not isinstance(children, list) or len(children) != 2):
        return False
    for child, operation, code in zip(children, ('ENCRYPTION', 'SYNTAX'), (2, 0)):
        if (not isinstance(child, dict) or child.get('operation') != operation
                or type(child.get('pid')) is not int or child['pid'] <= 0
                or child.get('exit_code') != code or child.get('reaped') is not True
                or child.get('parser_empty') is not True):
            return False
    return (forbidden.get('operation') == 'REJECTED' and forbidden.get('kind') == 'FAILED'
            and forbidden.get('children') == [] and forbidden.get('input_cleanup') is False)


def start_ticks(pid):
    return P('/proc', str(pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]


def broker_identity():
    unit = subprocess.run(['systemctl', 'show', 'passvero-qpdf-acceptance.service',
                           '-p', 'MainPID', '-p', 'ActiveState'], check=True,
                          capture_output=True, text=True, timeout=5)
    fields = dict(line.split('=', 1) for line in unit.stdout.splitlines())
    assert fields['ActiveState'] == 'active'
    pid = int(fields['MainPID']); assert pid > 0
    before = start_ticks(pid)
    proc = P('/proc', str(pid))
    status = dict(line.split(':', 1) for line in (proc / 'status').read_text().splitlines())
    assert status['Uid'].split() == ['0'] * 4 and status['Gid'].split() == ['0'] * 4
    assert status['Groups'].split() in ([], ['0']) and status['NoNewPrivs'].strip() == '1'
    assert os.readlink(proc / 'exe') == str(P('/usr/bin/python3').resolve())
    assert (proc / 'cmdline').read_bytes().split(b'\0') == [
        b'/usr/bin/python3', b'-I', b'/usr/local/libexec/passvero-qpdf-broker.py', b'']
    assert before == start_ticks(pid)
    return {'pid': pid, 'start': before}


def write_report(record, report):
    # Only locally constructed allowlisted values reach this writer; never raw observations.
    text = json.dumps(report, indent=2, allow_nan=False)
    if len(text.encode()) > 16384:
        raise ValueError()
    name = 'smoke.json' if report['result'] == 'PASS' else 'smoke-failure.json'
    (record / name).write_text(text)


def execute(operations, record=R, writer=write_report, stderr=sys.stderr):
    report = {'result': 'FAIL', 'first_failure': None, 'checks': [row(s) for s in SPECS],
              'cleanup': row(('ROLLBACK', 'ROLLBACK', 'SUCCESS')),
              'report_write': row(('REPORT_WRITE', 'REPORT', 'SUCCESS')), 'document_mutations': False,
              'scope': 'BROKER_FUNCTIONAL_AND_LIFECYCLE',
              'NEW_HANDOFF_RUNTIME_ISOLATION': 'NOT_PROVEN',
              'AUTH_REAL_SESSION_CHECK': 'NOT_PROVEN',
              'LIVE_ACCEPTANCE_CLEANUP': 'NOT_PROVEN'}
    write_failed = False

    def save():
        nonlocal write_failed
        try:
            if not write_failed:
                report['report_write'].update(actual='SUCCESS', result='PASS')
            writer(record, report)
        except Exception:
            write_failed = True
            report['report_write'].update(actual='INTERNAL_HARNESS_ERROR', result='FAIL')
            if report['first_failure'] is None:
                report['first_failure'] = dict(report['report_write'])
            print('SMOKE_REPORT_WRITE=FAIL; EVIDENCE_PRESERVATION=NOT_CONFIRMED', file=stderr)
            return False
        return True

    def perform(item):
        start = time.monotonic()
        try:
            observed = operations[item['CHECK_ID']]()
            actual, code, duration = observed[:3]
            if len(observed) == 4 and observed[3] in CLIENT_KINDS:
                item['client_kind'] = observed[3]
            item['actual'] = actual if actual in OUTCOMES else 'INTERNAL_HARNESS_ERROR'
            item.update(process_fields(code))
            if duration is not None:
                item['duration_ms'] = duration
        except subprocess.TimeoutExpired:
            item['actual'] = 'TIMEOUT'
        except subprocess.CalledProcessError as error:
            item['actual'] = 'PROCESS_FAILED'
            item.update(process_fields(error.returncode))
        except Exception:
            item['actual'] = 'INTERNAL_HARNESS_ERROR'
        if not item['duration_ms']:
            item['duration_ms'] = min(60000, max(0, round((time.monotonic() - start) * 1000)))
        item['result'] = 'PASS' if item['actual'] == item['expected'] else 'FAIL'

    for item in report['checks']:
        perform(item)
        if item['result'] == 'FAIL':
            report['first_failure'] = dict(item)
            save()  # Evidence is written BEFORE invoking rollback.
            break
    else:
        report['result'] = 'PASS'
        if save() and not write_failed:
            return 0, report
    report['result'] = 'FAIL'
    perform(report['cleanup'])
    save()
    return 1, report


def production_operations(record=R):
    state = {}
    def simple(value):
        return value, None, None
    def host():
        return simple('MATCH' if os.geteuid() == 0 and os.uname().nodename == 'srv1834647' else 'MISMATCH')
    def attempt():
        with (record / 'smoke-attempt').open('x') as stream:
            stream.write('1\n')
        return simple('CREATED')
    def artifacts():
        # Static artifact equality is reported separately from runtime identity.
        manifest = json.loads((record / 'artifacts.json').read_text())
        targets = json.loads((record / 'targets.json').read_text())
        for name, target in targets.items():
            path = P(target); meta = path.lstat()
            assert stat.S_ISREG(meta.st_mode) and meta.st_uid == meta.st_gid == 0
            assert stat.S_IMODE(meta.st_mode) == 0o644
            assert hashlib.sha256(path.read_bytes()).hexdigest() == manifest[name]
        old = json.loads(P('/var/lib/passvero-qpdf-staging-20260914/final-report.json').read_text())
        expected = {path: old['persistent_files_sha256'][path] for path in (
            '/usr/local/libexec/passvero-qpdf-launch', '/usr/local/libexec/passvero-qpdf-cgroup-setup.py')}
        expected['/etc/apparmor.d/passvero-qpdf'] = '4293ff64d77930135c1cc5ac1585af5d1c87c22b3ebea39a1fca9cade1225a5e'
        for target, digest in expected.items():
            path = P(target); meta = path.lstat()
            assert stat.S_ISREG(meta.st_mode) and meta.st_uid == 0 and not meta.st_mode & 0o022
            assert hashlib.sha256(path.read_bytes()).hexdigest() == digest
        return simple('MATCH')
    def start():
        subprocess.run(['systemctl', 'start', 'passvero-qpdf-broker.socket', 'passvero-qpdf-acceptance.service'],
                       check=True, timeout=15, capture_output=True)
        state['broker'] = broker_identity()
        sock = P('/run/passvero-qpdf-broker/validate.sock').lstat()
        assert stat.S_ISSOCK(sock.st_mode) and sock.st_uid == 0
        assert sock.st_gid == pwd.getpwnam('passvero-staging').pw_gid
        assert stat.S_IMODE(sock.st_mode) == 0o660
        return 'SUCCESS', 0, None
    def client():
        # Never accept a prior request's observation after a failed telemetry write.
        P('/run/passvero-qpdf/parser-observation.json').unlink(missing_ok=True)
        account = pwd.getpwnam('passvero-staging')
        P('/run/passvero-qpdf/broker-lifecycle.json').unlink(missing_ok=True)
        state['stage'] = account
        with subprocess.Popen(
            ['/usr/bin/node', '/opt/passvero-scan-boundary/smoke-client.cjs'],
            user=account.pw_uid, group=account.pw_gid, extra_groups=[], cwd='/',
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, text=True) as child:
            try:
                state['client_pid'] = child.pid
                state['client_start'] = start_ticks(child.pid)
                stdout, stderr = child.communicate(timeout=20)
            except BaseException:
                child.kill(); child.communicate()
                raise
            state['client'] = subprocess.CompletedProcess([], child.returncode, stdout, stderr)
        return 'RETURNED', state['client'].returncode, None
    def client_report():
        try:
            state['checks'] = parse_client(state['client'].stdout)
            return simple('VALID_REPORT')
        except (ValueError, TypeError, KeyError):
            return simple('INVALID_REPORT')
    def client_check(index):
        item = state['checks'][index]
        return item['actual'], state['client'].returncode, item['duration_ms'], item['client_kind']
    def lifecycle():
        path = P('/run/passvero-qpdf/broker-lifecycle.json')
        meta = path.lstat()
        if not stat.S_ISREG(meta.st_mode) or meta.st_uid != 0 or stat.S_IMODE(meta.st_mode) != 0o600 or meta.st_size > 8192:
            return simple('MISMATCH')
        receipts = json.loads(path.read_text())
        stage = state['stage']
        return simple('MATCH' if lifecycle_matches(receipts, state['broker'], state['client_pid'],
                      state['client_start'], stage.pw_uid, stage.pw_gid) else 'MISMATCH')
    def remove_observations():
        # Optional parser telemetry is not read as an isolation acceptance gate.
        P('/run/passvero-qpdf/parser-observation.json').unlink(missing_ok=True)
        P('/run/passvero-qpdf/broker-lifecycle.json').unlink()
        return simple('REMOVED')
    def rollback():
        result = subprocess.run(['/usr/bin/python3', '-B', str(record / 'rollback.py')],
                                check=True, capture_output=True)
        return 'SUCCESS', result.returncode, None
    return {
        'HOST_ROOT': host, 'ATTEMPT_RECORD': attempt, 'SOCKET_START': start, 'ARTIFACTS_MATCH': artifacts,
        'CLIENT_EXEC': client, 'CLIENT_REPORT': client_report,
        'CLIENT_VALID_PDF': lambda: client_check(0), 'CLIENT_FORBIDDEN_OPERATION': lambda: client_check(1),
        'CLIENT_EXIT': lambda: ('SUCCESS' if state['client'].returncode == 0 else 'PROCESS_FAILED', state['client'].returncode, None),
        'BROKER_IDENTITY': lambda: simple('MATCH' if broker_identity() == state['broker'] else 'MISMATCH'),
        'REQUEST_LIFECYCLE': lifecycle,
        'INPUT_CLEANUP': lambda: simple('EMPTY' if not list(P('/run/passvero-qpdf/input').iterdir()) else 'ISOLATION_FAILURE'),
        'PARSER_EMPTY': lambda: simple('EMPTY' if not P('/sys/fs/cgroup/system.slice/passvero-qpdf-acceptance.service/parser/cgroup.procs').read_text().strip() else 'ISOLATION_FAILURE'),
        'OBSERVATION_CLEANUP': remove_observations, 'ROLLBACK': rollback,
    }


if __name__ == '__main__':
    code, result = execute(production_operations())
    print('BROKER_FUNCTIONAL_SMOKE=PASS; NEW_HANDOFF_RUNTIME_ISOLATION=NOT_PROVEN' if code == 0 else 'SMOKE=STOP; NO_RETRY; REVIEW_NORMALIZED_REPORT_AND_STDERR')
    raise SystemExit(code)
