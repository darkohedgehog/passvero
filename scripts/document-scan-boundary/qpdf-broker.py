"""Fixed byte-only validator. systemd owns fd 3; caller cannot supply paths/argv.

Run only in the reviewed passvero-qpdf-acceptance.service envelope. The broker
owns input lifetime; disconnect/timeout terminates and reaps before unlinking.
"""
import hashlib
import json
import os
import pathlib
import pwd
import selectors
import signal
import socket
import struct
import subprocess
import time

LIMIT = 10 * 1024 * 1024
OUTPUT_LIMIT = 65536
ROOT = pathlib.Path('/run/passvero-qpdf/input')
LAUNCHER = '/usr/local/libexec/passvero-qpdf-launch'
CGROUP = pathlib.Path('/sys/fs/cgroup/system.slice/passvero-qpdf-acceptance.service/parser')


def receive(connection, count, deadline):
    result = bytearray()
    while len(result) < count:
        connection.settimeout(max(0.001, deadline - time.monotonic()))
        if time.monotonic() >= deadline:
            raise TimeoutError()
        chunk = connection.recv(min(65536, count - len(result)))
        if not chunk:
            raise ConnectionError()
        result.extend(chunk)
    return bytes(result)


def observe_parser(pid):
    """Acceptance telemetry only, never an execution authorization or PDF verdict."""
    try:
        proc = pathlib.Path('/proc') / str(pid)
        if os.readlink(proc / 'exe') != '/usr/bin/qpdf':
            return None, 'NOT_QPDF_YET'
        observation = {
            'status': 'OBSERVED',
            'profile': (proc / 'attr/current').read_text().strip(),
            'cgroup': (proc / 'cgroup').read_text().strip(),
            'identity': [line for line in (proc / 'status').read_text().splitlines() if line.startswith(('Uid:', 'Gid:', 'Groups:'))],
            'memory_max': (CGROUP / 'memory.max').read_text().strip(),
            'swap_max': (CGROUP / 'memory.swap.max').read_text().strip(),
        }
        return observation, None
    except PermissionError:
        return None, 'PERMISSION_DENIED'
    except (FileNotFoundError, ProcessLookupError):
        return None, 'PROCESS_EXITED'
    except OSError:
        return None, 'READ_ERROR'


def inspect(args, connection, deadline, account, budget, lifecycle=None):
    child = subprocess.Popen(
        [LAUNCHER, *args], stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        env={'LANG': 'C', 'LC_ALL': 'C', 'NODE_ENV': 'production'},
        cwd=ROOT, start_new_session=True,
        user=account.pw_uid, group=account.pw_gid, extra_groups=[])
    child_record = {'operation': 'ENCRYPTION' if args[0] == '--is-encrypted' else 'SYNTAX',
                    'pid': child.pid, 'exit_code': None, 'reaped': False, 'parser_empty': False}
    if lifecycle is not None:
        lifecycle.append(child_record)
    stderr = False
    observation = None
    observation_reason = 'NOT_QPDF_YET'
    try:
        with selectors.DefaultSelector() as poll:
            poll.register(connection, selectors.EVENT_READ)
            poll.register(child.stdout, selectors.EVENT_READ)
            poll.register(child.stderr, selectors.EVENT_READ)
            while len(poll.get_map()) > 1 or child.poll() is None:
                if time.monotonic() >= deadline:
                    raise TimeoutError()
                if observation is None and observation_reason == 'NOT_QPDF_YET':
                    if child.poll() is None:
                        observation, observation_reason = observe_parser(child.pid)
                    else:
                        observation_reason = 'PROCESS_EXITED'
                for key, _ in poll.select(min(0.001, max(0, deadline - time.monotonic()))):
                    if key.fileobj is connection:
                        # EOF is cancellation. Trailing bytes are an invalid operation.
                        connection.recv(1)
                        raise ConnectionError()
                    chunk = os.read(key.fileobj.fileno(), 4096)
                    if not chunk:
                        poll.unregister(key.fileobj)
                    else:
                        budget[0] += len(chunk)
                        stderr |= key.fileobj is child.stderr
                        if budget[0] > OUTPUT_LIMIT:
                            raise ValueError('OUTPUT_LIMIT')
            code = child.wait()
            child_record.update(exit_code=code, reaped=True)
            return code, stderr
    finally:
        # Always replace the last inspection's diagnostic, including absence.
        # A failed diagnostic write must not mask a qpdf result or original error.
        report = ROOT.parent / 'parser-observation.json'
        diagnostic = observation or {'status': 'UNAVAILABLE', 'reason':
            'NOT_OBSERVED' if observation_reason == 'NOT_QPDF_YET' else observation_reason}
        try:
            report.write_text(json.dumps([diagnostic]))
            report.chmod(0o600)
        except OSError:
            # Optional telemetry: absence never changes PDF results or proves isolation.
            import sys
            try:
                print('PARSER_OBSERVATION_WRITE=FAILED', file=sys.stderr)
            except OSError:
                pass  # Diagnostic output failure must not skip parser containment.

        # Also kill descendants after the direct child exits. No input is removed
        # until the whole parser cgroup is empty. Never signal unrelated units.
        try:
            if child.poll() is None:
                try:
                    os.killpg(child.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    child.wait(timeout=0.25)
                except subprocess.TimeoutExpired:
                    try:
                        os.killpg(child.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    child.wait()
            child_record.update(exit_code=child.wait(), reaped=True)
            child.stdout.close()
            child.stderr.close()
            if (CGROUP / 'cgroup.procs').read_text().strip():
                (CGROUP / 'cgroup.kill').write_text('1')
                until = time.monotonic() + 2
                while (CGROUP / 'cgroup.procs').read_text().strip():
                    if time.monotonic() >= until:
                        # Fatal containment: preserve input, let systemd contain unit.
                        os._exit(70)
                    time.sleep(0.01)
            child_record['parser_empty'] = True
        except BaseException:
            os._exit(70)  # systemd contains the group; retain input until then


def validate(connection, account, receipt=None):
    deadline = time.monotonic() + 10
    # Protocol v1: exact magic and network-order length, then immutable bytes.
    header = receive(connection, 8, deadline)
    if header[:4] != b'PVQ1':
        raise ValueError('OPERATION')
    if receipt is not None:
        receipt['operation'] = 'PVQ1'
    size = struct.unpack('!I', header[4:])[0]
    if not 0 < size <= LIMIT:
        raise ValueError('SIZE')
    data = receive(connection, size, deadline)
    # mkdtemp's six-character spelling is part of the accepted launcher contract.
    import secrets
    import string
    while True:
        directory = ROOT / ('passvero-qpdf-' + ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(6)))
        try:
            directory.mkdir(mode=0o700)
            break
        except FileExistsError:
            continue
    filename = directory / 'input.pdf'
    try:
        with filename.open('xb') as output:
            os.fchmod(output.fileno(), 0o600)
            output.write(data)
            os.fchown(output.fileno(), account.pw_uid, account.pw_gid)
        os.chown(directory, account.pw_uid, account.pw_gid)
        budget = [0]
        code, errors = inspect(['--is-encrypted', str(filename)], connection, deadline, account, budget, None if receipt is None else receipt['children'])
        if time.monotonic() >= deadline:
            raise TimeoutError()
        if code == 0 and not errors:
            return {'kind': 'ENCRYPTED'}
        if code != 2:
            return {'kind': 'FAILED'}
        code, check_errors = inspect(['--check', '--suppress-recovery', str(filename)], connection, deadline, account, budget, None if receipt is None else receipt['children'])
        if time.monotonic() >= deadline:
            raise TimeoutError()
        if code == 0 and not errors and not check_errors:
            return {'kind': 'VALID', 'identity': {'sizeBytes': size, 'sha256': hashlib.sha256(data).hexdigest()}}
        if code in (2, 3):
            return {'kind': 'INVALID', 'reason': 'WARNING' if code == 3 else 'STRUCTURE'}
        return {'kind': 'FAILED'}
    finally:
        try:
            filename.unlink(missing_ok=True)
            directory.rmdir()
            if receipt is not None:
                receipt['input_cleanup'] = True
        except OSError:
            os._exit(70)  # No subsequent request after failed private cleanup


def authorized(connection, caller):
    _, uid, _ = struct.unpack('3i', connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    return uid == caller


def start_ticks(pid):
    # Correlation only, not an independent observation of parser execution.
    try:
        return pathlib.Path('/proc', str(pid), 'stat').read_text().rsplit(')', 1)[1].split()[19]
    except (OSError, IndexError):
        return None


def serve_request(connection, account, history):
    pid, uid, gid = struct.unpack('3i', connection.getsockopt(socket.SOL_SOCKET, socket.SO_PEERCRED, 12))
    receipt = {'broker_pid': os.getpid(), 'broker_start': start_ticks(os.getpid()),
               'peer_pid': pid, 'peer_start': start_ticks(pid), 'peer_uid': uid, 'peer_gid': gid,
               'operation': 'REJECTED', 'children': [], 'input_cleanup': False}
    try:
        result = validate(connection, account, receipt)
    except TimeoutError:
        result = {'kind': 'TIMEOUT'}
    except (OSError, ValueError, ConnectionError):
        result = {'kind': 'FAILED'}
    receipt['kind'] = result['kind']
    # At most two parent-owned lifecycle receipts; no bytes, paths or raw output.
    # Missing/failed receipt publication fails acceptance, never PDF validation.
    history.append(receipt)
    del history[:-2]
    try:
        path = ROOT.parent / 'broker-lifecycle.json'
        path.write_text(json.dumps(history))
        path.chmod(0o600)
    except OSError:
        pass
    return result


def main():
    assert os.geteuid() == 0
    assert os.environ.get('LISTEN_PID') == str(os.getpid())
    assert os.environ.get('LISTEN_FDS') == '1'
    account = pwd.getpwnam('passvero-qpdf')
    caller = pwd.getpwnam('passvero-staging').pw_uid
    server = socket.socket(fileno=3)
    # Single worker and finite kernel backlog; no application queue or threads.
    server.listen(1)
    history = []
    while True:
        connection, _ = server.accept()
        with connection:
            if not authorized(connection, caller):
                continue
            result = serve_request(connection, account, history)
            try:
                connection.settimeout(0.25)
                connection.sendall(json.dumps(result, separators=(',', ':')).encode() + b'\n')
            except OSError:
                pass


if __name__ == '__main__':
    main()
