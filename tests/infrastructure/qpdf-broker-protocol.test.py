import importlib.util
import pathlib
import socket
import struct
import unittest
from unittest.mock import patch, Mock

spec = importlib.util.spec_from_file_location('broker', pathlib.Path(__file__).parents[2] / 'scripts/document-scan-boundary/qpdf-broker.py')
broker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(broker)

class Protocol(unittest.TestCase):
    def test_peer_identity_not_group_or_payload_authorizes_caller(self):
        connection = Mock()
        with patch.object(broker.socket, 'SO_PEERCRED', 17, create=True):
            for uid, expected in [(1001, True), (0, False), (999, False), (1000, False)]:
                connection.getsockopt.return_value = struct.pack('3i', 1, uid, 1001)
                self.assertEqual(broker.authorized(connection, 1001), expected)
    def test_arbitrary_operation_and_size_rejected_before_filesystem_or_spawn(self):
        for header in [b'SHELLxxx', b'PVQ1'+struct.pack('!I', 0), b'PVQ1'+struct.pack('!I', broker.LIMIT+1)]:
            client, server = socket.socketpair()
            try:
                client.sendall(header)
                with patch.object(broker, 'inspect', side_effect=AssertionError('must not spawn')):
                    with self.assertRaises(ValueError):
                        broker.validate(server, None)
            finally:
                client.close(); server.close()
    def test_disconnect_rejects_incomplete_input(self):
        client, server = socket.socketpair()
        client.sendall(b'PVQ1'+struct.pack('!I', 5)+b'a'); client.close()
        try:
            with self.assertRaises(ConnectionError): broker.validate(server, None)
        finally: server.close()

class Lifetime(unittest.TestCase):
    def test_private_snapshot_and_fixed_arguments(self):
        import tempfile, pwd, os
        with tempfile.TemporaryDirectory() as directory:
            client, server = socket.socketpair()
            client.sendall(b'PVQ1' + struct.pack('!I', 3) + b'pdf')
            calls = []
            def inspect(args, connection, deadline, account, budget, lifecycle=None):
                calls.append(args[:-1])
                filename = pathlib.Path(args[-1])
                self.assertEqual(filename.parent.parent, pathlib.Path(directory))
                self.assertFalse(filename.is_symlink())
                self.assertEqual(filename.stat().st_mode & 0o777, 0o600)
                self.assertEqual(filename.read_bytes(), b'pdf')
                return (2, False) if len(calls) == 1 else (0, False)
            try:
                with patch.object(broker, 'ROOT', pathlib.Path(directory)), patch.object(broker, 'inspect', inspect):
                    result = broker.validate(server, pwd.getpwuid(os.getuid()))
                self.assertEqual(result['kind'], 'VALID')
                self.assertEqual(calls, [['--is-encrypted'], ['--check', '--suppress-recovery']])
                self.assertEqual(list(pathlib.Path(directory).iterdir()), [])
            finally:
                client.close(); server.close()

    def test_deadline_kills_and_reaps_process_double(self):
        import tempfile, os, pwd, time, sys, subprocess
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            (root / 'cgroup.procs').write_text('')
            client, server = socket.socketpair()
            spawn = subprocess.Popen
            processes = []
            def controlled_spawn(args, **kwargs):
                for key in ['user', 'group', 'extra_groups']: kwargs.pop(key)
                child = spawn([sys.executable, '-c', 'import time; time.sleep(30)'], **kwargs)
                processes.append(child)
                return child
            try:
                with patch.object(broker, 'ROOT', root), patch.object(broker, 'CGROUP', root), patch.object(broker.subprocess, 'Popen', controlled_spawn):
                    with self.assertRaises(TimeoutError):
                        broker.inspect(['--is-encrypted', 'not-used'], server, time.monotonic() + 0.05, pwd.getpwuid(os.getuid()), [0])
                self.assertIsNotNone(processes[0].returncode)
            finally:
                client.close(); server.close()


class Observation(unittest.TestCase):
    """Local doubles verify classification/lifetime, not Linux privileges."""
    def test_allowed_and_denied_partial_observations(self):
        with patch.object(broker.os, 'readlink', return_value='/usr/bin/qpdf'), patch.object(pathlib.Path, 'read_text', return_value='observed'):
            value, reason = broker.observe_parser(123)
            self.assertEqual(value['status'], 'OBSERVED')
            self.assertIsNone(reason)
        for error, reason in [(PermissionError('SECRET'), 'PERMISSION_DENIED'),
                              (FileNotFoundError('SECRET'), 'PROCESS_EXITED'),
                              (ProcessLookupError('SECRET'), 'PROCESS_EXITED'),
                              (OSError('SECRET'), 'READ_ERROR')]:
            for stage in ('exe', 'fields'):
                with patch.object(broker.os, 'readlink', **({'side_effect': error} if stage == 'exe' else {'return_value': '/usr/bin/qpdf'})), patch.object(pathlib.Path, 'read_text', side_effect=error):
                    self.assertEqual(broker.observe_parser(123), (None, reason))

    def run_local(self, error, timeout=False, write_failure=False, cleanup_failure=False):
        import tempfile, pwd, os, sys, subprocess, time, json, io, contextlib
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory); inputs = root / 'input'; inputs.mkdir()
            (root / 'cgroup.procs').write_text('')
            (root / 'memory.max').write_text('268435456')
            (root / 'memory.swap.max').write_text('0')
            client, server = socket.socketpair()
            if not timeout and not cleanup_failure:
                client.sendall(b'PVQ1' + struct.pack('!I', 3) + b'pdf')
            spawn = subprocess.Popen; children = []; real_write = pathlib.Path.write_text
            def controlled_spawn(args, **kwargs):
                for key in ('user', 'group', 'extra_groups'): kwargs.pop(key)
                code = 2 if args[1] == '--is-encrypted' else 0
                child = spawn([sys.executable, '-c', 'import time;time.sleep(%s);raise SystemExit(%s)' % (2 if timeout else 0.05, code)], **kwargs)
                children.append(child); return child
            def write(path, *args, **kwargs):
                if write_failure and path.name == 'parser-observation.json':
                    raise PermissionError('SECRET')
                return real_write(path, *args, **kwargs)
            stderr = io.StringIO()
            real_read = pathlib.Path.read_text
            def read(path, *args, **kwargs):
                if error is None and str(path).startswith('/proc/'):
                    return {'current': 'passvero-qpdf (enforce)', 'cgroup': '0::/parser', 'status': 'Uid: 999 999 999 999\nGid: 987 987 987 987\nGroups:'}[path.name]
                if cleanup_failure and path.name == 'cgroup.procs':
                    raise PermissionError('SECRET')
                return real_read(path, *args, **kwargs)
            class Contained(BaseException):
                pass
            def fatal(code):
                self.assertEqual(code, 70)
                raise Contained()
            try:
                with patch.object(broker, 'ROOT', inputs), patch.object(broker, 'CGROUP', root), patch.object(broker.subprocess, 'Popen', controlled_spawn), patch.object(broker.os, 'readlink', side_effect=error, return_value='/usr/bin/qpdf'), patch.object(pathlib.Path, 'write_text', write), patch.object(pathlib.Path, 'read_text', read), patch.object(broker.os, '_exit', fatal), contextlib.redirect_stderr(stderr):
                    if cleanup_failure:
                        with self.assertRaises(Contained):
                            broker.inspect(['--is-encrypted', 'unused'], server, time.monotonic() + 2, pwd.getpwuid(os.getuid()), [0])
                    elif timeout:
                        with self.assertRaises(TimeoutError):
                            broker.inspect(['--is-encrypted', 'unused'], server, time.monotonic() + 0.1, pwd.getpwuid(os.getuid()), [0])
                    else:
                        receipt = {'children': []}
                        result = broker.validate(server, pwd.getpwuid(os.getuid()), receipt)
                        self.assertTrue(receipt['input_cleanup'])
                        self.assertEqual([c['operation'] for c in receipt['children']], ['ENCRYPTION', 'SYNTAX'])
                        self.assertEqual([c['exit_code'] for c in receipt['children']], [2, 0])
                        self.assertEqual([c['pid'] for c in receipt['children']], [c.pid for c in children])
                        self.assertTrue(all(c['reaped'] and c['parser_empty'] for c in receipt['children']))
                        self.assertEqual(result['kind'], 'VALID')
                self.assertTrue(children and all(child.poll() is not None for child in children))
                self.assertEqual(list(inputs.iterdir()), [])
                self.assertNotIn('SECRET', stderr.getvalue())
                if write_failure:
                    self.assertEqual(stderr.getvalue().strip(), 'PARSER_OBSERVATION_WRITE=FAILED')
                else:
                    report = json.loads((root / 'parser-observation.json').read_text())
                    if error is None:
                        self.assertEqual(report[0]['status'], 'OBSERVED')
                    else:
                        self.assertEqual(report[0]['status'], 'UNAVAILABLE')
                        self.assertIn(report[0]['reason'], ('PERMISSION_DENIED', 'PROCESS_EXITED'))
                    self.assertNotIn('SECRET', json.dumps(report))
            finally:
                client.close(); server.close()

    def test_allowed_observation_preserves_pdf_result_and_cleanup(self):
        self.run_local(None)

    def test_denied_observation_preserves_pdf_result_and_cleanup(self):
        self.run_local(PermissionError('SECRET'))

    def test_exit_during_observation_preserves_pdf_result_and_cleanup(self):
        self.run_local(ProcessLookupError('SECRET'))

    def test_timeout_remains_primary_after_observation_denial_and_write_failure(self):
        self.run_local(PermissionError('SECRET'), timeout=True, write_failure=True)

    def test_observation_reason_written_before_fatal_cleanup(self):
        self.run_local(PermissionError('SECRET'), cleanup_failure=True)

class Containment(unittest.TestCase):
    def test_reaping_failure_cannot_record_completed_lifecycle(self):
        import tempfile, time
        class Contained(BaseException):
            pass
        child = Mock(pid=321)
        child.poll.return_value = None
        child.wait.side_effect = OSError('SYNTHETIC_REAP_FAILURE')
        lifecycle = []
        with tempfile.TemporaryDirectory() as directory, patch.object(broker, 'ROOT', pathlib.Path(directory) / 'input'), patch.object(broker.subprocess, 'Popen', return_value=child), patch.object(broker.selectors, 'DefaultSelector') as selector, patch.object(broker.os, 'killpg'), patch.object(broker.os, '_exit', side_effect=Contained) as fatal:
            selector.return_value.__enter__.return_value.get_map.return_value = {}
            with self.assertRaises(Contained):
                broker.inspect(['--is-encrypted', 'unused'], Mock(), time.monotonic() - 1, Mock(), [0], lifecycle)
            fatal.assert_called_with(70)
            self.assertFalse(lifecycle[0]['reaped'])
            self.assertFalse(lifecycle[0]['parser_empty'])

    def test_input_cleanup_failure_cannot_return_valid(self):
        import tempfile, pwd, os
        class Contained(BaseException):
            pass
        with tempfile.TemporaryDirectory() as directory:
            client, server = socket.socketpair()
            receipt = {'children': []}
            client.sendall(b'PVQ1' + struct.pack('!I', 3) + b'pdf')
            try:
                with patch.object(broker, 'ROOT', pathlib.Path(directory)), patch.object(broker, 'inspect', side_effect=[(2, False), (0, False)]), patch.object(pathlib.Path, 'rmdir', side_effect=PermissionError()), patch.object(broker.os, '_exit', side_effect=Contained) as fatal:
                    with self.assertRaises(Contained):
                        broker.validate(server, pwd.getpwuid(os.getuid()), receipt)
                    fatal.assert_called_with(70)
                    self.assertNotIn('input_cleanup', receipt)
            finally:
                client.close(); server.close()


class Receipts(unittest.TestCase):
    def test_request_binding_bounded_history_and_write_failure(self):
        import json, tempfile, os
        connection = Mock()
        connection.getsockopt.return_value = struct.pack('3i', 44, 1001, 1001)
        history = []
        with tempfile.TemporaryDirectory() as directory, patch.object(broker.socket, 'SO_PEERCRED', 17, create=True), patch.object(broker, 'ROOT', pathlib.Path(directory) / 'input'), patch.object(broker, 'start_ticks', side_effect=lambda pid: str(pid * 10)), patch.object(broker, 'validate', return_value={'kind': 'VALID'}):
            for _ in range(3):
                self.assertEqual(broker.serve_request(connection, None, history), {'kind': 'VALID'})
            self.assertEqual(len(history), 2)
            data = json.loads((pathlib.Path(directory) / 'broker-lifecycle.json').read_text())
            self.assertEqual(data[0]['peer_pid'], 44)
            self.assertEqual(data[0]['peer_start'], '440')
            self.assertEqual(data[0]['broker_pid'], os.getpid())
            with patch.object(pathlib.Path, 'write_text', side_effect=PermissionError()):
                self.assertEqual(broker.serve_request(connection, None, history), {'kind': 'VALID'})

    def test_forbidden_request_receipt_never_claims_child_or_cleanup(self):
        import tempfile
        connection = Mock()
        connection.getsockopt.return_value = struct.pack('3i', 44, 1001, 1001)
        history = []
        with tempfile.TemporaryDirectory() as directory, patch.object(broker.socket, 'SO_PEERCRED', 17, create=True), patch.object(broker, 'ROOT', pathlib.Path(directory) / 'input'), patch.object(broker, 'start_ticks', return_value='123'), patch.object(broker, 'validate', side_effect=ValueError('OPERATION')):
            self.assertEqual(broker.serve_request(connection, None, history), {'kind': 'FAILED'})
            self.assertEqual(history[0]['children'], [])
            self.assertEqual(history[0]['operation'], 'REJECTED')
            self.assertFalse(history[0]['input_cleanup'])


if __name__ == '__main__': unittest.main()
