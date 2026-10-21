"""Isolated ask() PTY regression. No harness import, real /dev/tty, sudo or network."""
import ast
import builtins
import errno
import os
from pathlib import Path
import select
import threading
import time
import tty
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


class RawTTYChecks(unittest.TestCase):
    def exercise(self, chunks=(), limit=0.18, disconnect=False, io_fault=None,
                 interrupt=False, partial_write=False, wall_jump=False):
        master, slave = os.openpty()
        tty.setraw(slave)  # Test-only fixture mode; production must not change terminal modes.
        path = os.ttyname(slave)
        opened = []; closed = []; output = {}; writes = []; read_count = 0
        select_count = 0; wall_calls = 0; write_count = 0
        before_attrs = __import__('termios').tcgetattr(slave)
        now = time.time()

        def tty_open(name, flags):
            self.assertEqual(name, '/dev/tty')
            fd = os.open(path, flags); opened.append(fd); return fd

        def old_text_open(name, mode):
            self.assertEqual(name, '/dev/tty')
            raise AssertionError('BUFFERED_TEXT_TTY_OPEN_FORBIDDEN')

        def close(fd):
            closed.append(fd); os.close(fd)

        def read(fd, count):
            nonlocal read_count
            read_count += 1
            if io_fault == 'read': raise OSError(errno.EIO, 'controlled read failure')
            if interrupt and read_count == 1: raise InterruptedError()
            if interrupt and read_count == 2: raise BlockingIOError()
            return os.read(fd, count)

        def write(fd, body):
            nonlocal write_count
            write_count += 1
            if io_fault == 'write': raise OSError(errno.EIO, 'controlled write failure')
            if interrupt and write_count == 1: raise InterruptedError()
            if interrupt and write_count == 2: raise BlockingIOError()
            part = body[:3] if partial_write else body
            n = os.write(fd, part); writes.append(part[:n]); return n

        def wait(*args):
            nonlocal select_count
            select_count += 1
            if interrupt and select_count <= 2: raise InterruptedError()
            return select.select(*args)

        def wall():
            nonlocal wall_calls
            wall_calls += 1
            return now + 100000 if wall_jump and wall_calls > 1 else now

        proxy = types.SimpleNamespace(open=tty_open, close=close, read=read, write=write,
            O_RDWR=os.O_RDWR, O_NOCTTY=os.O_NOCTTY, O_NONBLOCK=os.O_NONBLOCK)
        namespace = {'os': proxy, 'select': types.SimpleNamespace(select=wait),
            'time': types.SimpleNamespace(time=wall, monotonic=time.monotonic),
            'END': now+10, 'data': lambda name: {'t0': now}, 'require': require}
        tree = ast.parse((HERE/'reboot-reviewed.py').read_text())
        ask = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'ask')
        exec(compile(ast.Module(body=[ask], type_ignores=[]), '<isolated-ask>', 'exec'), namespace)

        def run():
            start = time.monotonic()
            try: output['result'] = namespace['ask']('Controlled observation', limit)
            except BaseException as error: output['error'] = error
            finally: output['elapsed'] = time.monotonic()-start

        worker = threading.Thread(target=run, daemon=True)
        try:
            with patch('builtins.open', side_effect=old_text_open):
                worker.start()
                prompt = b''
                deadline = time.monotonic()+0.6
                while b'observed: ' not in prompt and worker.is_alive() and time.monotonic()<deadline:
                    if select.select([master], [], [], 0.01)[0]: prompt += os.read(master, 1024)
                if disconnect:
                    os.close(master); master = None
                else:
                    for delay, body in chunks:
                        time.sleep(delay)
                        if worker.is_alive(): os.write(master, body)
                worker.join(0.7)
            self.assertFalse(worker.is_alive(), 'ask exceeded bounded test deadline')
            self.assertEqual(opened, closed, 'every opened descriptor must close on all paths')
            for fd in opened:
                with self.assertRaises(OSError) as error: os.fstat(fd)
                self.assertEqual(error.exception.errno, errno.EBADF)
            if not disconnect:
                self.assertEqual(__import__('termios').tcgetattr(slave), before_attrs)
            output['writes'] = b''.join(writes)
            return output
        finally:
            if master is not None: os.close(master)
            os.close(slave)
            worker.join(0.3)

    def test_exact_pass_lf_and_crlf_no_seek_and_no_mode_change(self):
        for answer in (b'PASS\n', b'PASS\r\n'):
            with self.subTest(answer=answer):
                result = self.exercise(chunks=[(0, answer)], partial_write=True)
                self.assertEqual(result.get('result', {}).get('result'), 'PASS', result)
                self.assertEqual(result['writes'], 'Controlled observation — type PASS only after actually observed: '.encode())

    def test_invalid_answers_rejected_without_whitespace_or_case_relaxation(self):
        for answer in (b'FAIL\n', b'pass\n', b' PASS\n', b'PASS \n', b'PASS\t\n', b'PASS\nEXTRA'):
            with self.subTest(answer=answer):
                result = self.exercise(chunks=[(0, answer)])
                self.assertIsInstance(result.get('error'), RuntimeError, result)
                self.assertNotIn('result', result)

    def test_disconnect_rejects_and_closes_descriptor(self):
        result = self.exercise(disconnect=True)
        self.assertIsInstance(result.get('error'), (RuntimeError, OSError), result)
        self.assertNotIn('result', result)

    def test_no_response_times_out_without_extension(self):
        result = self.exercise()
        self.assertEqual(str(result.get('error')), 'OPERATOR_OBSERVATION_TIMEOUT')
        self.assertGreaterEqual(result['elapsed'], 0.12)
        self.assertLess(result['elapsed'], 0.45)

    def test_partial_input_and_interruptions_do_not_reset_deadline(self):
        result = self.exercise(chunks=[(0.06,b'P'),(0.06,b'A'),(0.06,b'S')], interrupt=True)
        self.assertEqual(str(result.get('error')), 'OPERATOR_OBSERVATION_TIMEOUT')
        self.assertLess(result['elapsed'], 0.35)

    def test_partial_valid_input_interruptions_and_wall_clock_jump(self):
        result = self.exercise(chunks=[(0,b'PA'),(0.02,b'SS\n')], interrupt=True, wall_jump=True)
        self.assertEqual(result.get('result',{}).get('result'),'PASS',result)

    def test_io_failures_reject_and_close_descriptor(self):
        for fault in ('read', 'write'):
            with self.subTest(fault=fault):
                result = self.exercise(chunks=[(0,b'PASS\n')],io_fault=fault)
                self.assertIsInstance(result.get('error'), (RuntimeError,OSError), result)
                self.assertNotIn('result',result)


if __name__ == '__main__': unittest.main()
