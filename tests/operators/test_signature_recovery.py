"""Recovery state transitions; no services, network, databases or sudo."""
import importlib.util
import pathlib
import os
import stat
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('recovery', pathlib.Path(__file__).parents[2] / 'scripts/recover-document-signature-health.py')
recovery = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recovery)


class Host:
    def __init__(self, fail=None):
        self.calls = []
        self.fail = fail
        self.healthy = False

    def action(self, name):
        self.calls.append(name)
        if name == self.fail:
            raise recovery.Stop('INJECTED_FAILURE')
        if name == 'scheduled':
            self.healthy = True
        if name == 'contain':
            self.healthy = False

    def accepted(self):
        return self.healthy

    def __getattr__(self, name):
        return lambda: self.action(name)


class RecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = pathlib.Path(self.tmp.name) / 'state.json'

    def tearDown(self):
        self.tmp.cleanup()

    def test_success_and_repeat_do_not_publish_again(self):
        host = Host()
        self.assertEqual(recovery.execute(self.path, host), 'RECOVERED')
        calls = list(host.calls)
        self.assertEqual(recovery.execute(self.path, host), 'ALREADY_RECOVERED')
        self.assertEqual(host.calls, calls)
        host.healthy = False
        with self.assertRaisesRegex(recovery.Stop, 'RECOVERY_REQUIRED'):
            recovery.execute(self.path, host)

    def test_failure_at_every_mutating_phase_contains_and_never_completes(self):
        for phase in recovery.PHASES:
            with self.subTest(phase=phase):
                path = self.path.with_name(phase + '.json')
                host = Host(phase)
                with self.assertRaisesRegex(recovery.Stop, 'INJECTED_FAILURE'):
                    recovery.execute(path, host)
                self.assertFalse(host.healthy)
                self.assertEqual(host.calls[-1], 'contain')
                self.assertNotEqual(recovery.read_state(path)['phase'], 'COMPLETE')

    def test_interrupted_attempt_is_not_replayed(self):
        recovery.write_state(self.path, {'phase': 'candidate'})
        host = Host()
        with self.assertRaisesRegex(recovery.Stop, 'INTERRUPTED_REQUIRES_ROLLBACK'):
            recovery.execute(self.path, host)
        self.assertEqual(host.calls, ['contain'])

    def test_lock_exclusion_and_release_without_deleting_lock(self):
        lock = self.path.with_name('lock')
        with recovery.exclusive(lock):
            with self.assertRaisesRegex(recovery.Stop, 'RECOVERY_BUSY'):
                with recovery.exclusive(lock):
                    self.fail('second recovery entered')
        self.assertTrue(lock.exists())
        with recovery.exclusive(lock):
            pass

    def test_directive_replacement_preserves_unrelated_settings(self):
        text = '# preserved\nDatabaseDirectory /old\nFIPSCryptoHashLimits yes\n'
        self.assertEqual(recovery.replace_directive(text, 'DatabaseDirectory', '/new'),
                         text.replace('/old', '/new'))
        for bad in ['# none\n', text + 'DatabaseDirectory /other\n']:
            with self.assertRaisesRegex(recovery.Stop, 'CONFIGURATION_INVALID'):
                recovery.replace_directive(bad, 'DatabaseDirectory', '/new')

    def test_rollback_is_explicit_and_repeated_rollback_has_no_effect(self):
        host = Host('candidate')
        with self.assertRaises(recovery.Stop):
            recovery.execute(self.path, host)
        host.fail = None
        self.assertEqual(recovery.execute(self.path, host, rollback=True), 'ROLLED_BACK_FAIL_CLOSED')
        calls = list(host.calls)
        self.assertEqual(recovery.execute(self.path, host, rollback=True), 'ALREADY_ROLLED_BACK')
        self.assertEqual(calls, host.calls)
        self.assertFalse(host.healthy)


class RegressionTests(unittest.TestCase):
    def test_atomic_modes_survive_private_umask_including_rollback(self):
        with tempfile.TemporaryDirectory() as directory:
            previous = os.umask(0o077)
            try:
                path = pathlib.Path(directory) / 'config'
                for mode in (0o444, 0o644, 0o640, 0o600):
                    recovery.atomic(path, b'configuration', mode)
                    self.assertEqual(stat.S_IMODE(path.stat().st_mode), mode)
            finally:
                os.umask(previous)

    def test_waits_for_exec_without_accepting_root_identity(self):
        ready = {'pid': 22, 'exe': '/usr/bin/freshclam', 'uids': [108]*4,
                 'profile': '/usr/bin/freshclam (enforce)',
                 'cgroup': '0::/passveroclamav.slice/clamav-freshclam.service'}
        pending = dict(ready, exe='/usr/lib/systemd/systemd-executor', uids=[0]*4)
        observations = iter([dict(pending, exe="/usr/lib/systemd/systemd"), pending, ready])
        self.assertEqual(recovery.await_confined(lambda: next(observations),
                         'clamav-freshclam.service', '/usr/bin/freshclam', sleep=lambda _: None), 22)
        for field, value, reason in [('uids', [0]*4, 'SCANNER_IDENTITY_CHANGED'),
                                      ('profile', 'unconfined', 'CONFINEMENT_CHANGED'),
                                      ('cgroup', '0::/other', 'CONFINEMENT_CHANGED')]:
            with self.assertRaisesRegex(recovery.Stop, reason):
                recovery.await_confined(lambda: dict(ready, **{field: value}),
                                        'clamav-freshclam.service', '/usr/bin/freshclam')
        clock = iter([0, 0, 6])
        with self.assertRaisesRegex(recovery.Stop, 'SCANNER_START_TIMEOUT'):
            recovery.await_confined(lambda: pending, 'clamav-freshclam.service',
                                    '/usr/bin/freshclam', now=lambda: next(clock), sleep=lambda _: None)


class DaemonReadinessTests(unittest.TestCase):
    def test_waits_for_loaded_log_and_version_before_returning(self):
        observations = iter([False, False, True])
        sleeps = []
        recovery.await_ready(lambda: next(observations), sleep=lambda delay: sleeps.append(delay))
        self.assertEqual(len(sleeps), 2)

    def test_version_probe_is_read_only_and_rejects_invalid_response(self):
        with patch.object(recovery.socket, 'socket') as factory:
            client = factory.return_value.__enter__.return_value
            client.recv.return_value = b'ClamAV 1.5.4/28132/Wed Sep 23 08:24:42 2026\0'
            self.assertTrue(recovery.version_ready('/unused-fixture'))
            client.sendall.assert_called_once_with(b'zVERSION\0')
            client.recv.return_value = b'invalid\0'
            with self.assertRaisesRegex(recovery.Stop, 'DAEMON_RESPONSE_INVALID'):
                recovery.version_ready('/unused-fixture')
            client.recv.side_effect = TimeoutError()
            self.assertFalse(recovery.version_ready('/unused-fixture'))

    def test_start_failure_is_not_retried_and_timeout_is_bounded(self):
        def failed():
            raise recovery.Stop('DAEMON_START_FAILED')
        with self.assertRaisesRegex(recovery.Stop, 'DAEMON_START_FAILED'):
            recovery.await_ready(failed)
        clock = iter([0, 0, 121])
        with self.assertRaisesRegex(recovery.Stop, 'DAEMON_READINESS_TIMEOUT'):
            recovery.await_ready(lambda: False, now=lambda: next(clock), sleep=lambda _: None)


class CandidateTests(unittest.TestCase):
    def test_isolated_candidate_keeps_history_and_cooldown_and_changes_only_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            for name in ('db', 'updater', 'daemon', 'records', 'package'):
                (root / name).mkdir()
            fresh, daemon, config, producer = [root / n for n in ('fresh.conf', 'daemon.conf', 'config.json', 'producer.cjs')]
            fresh.write_text(f'DatabaseDirectory {root}/db\nUpdateLogFile {root}/updater/evidence.log\nTestDatabases yes\n')
            daemon.write_text(f'DatabaseDirectory {root}/db\nLogFile {root}/daemon/evidence.log\nBytecodeSecurity TrustSigned\n')
            old = {'databaseDirectory': str(root / 'db'), 'updaterLog': str(root / 'updater/evidence.log'),
                   'daemonLog': str(root / 'daemon/evidence.log')}
            import json
            config.write_text(json.dumps(old))
            (root / 'db/daily.cld').write_bytes(b'old untrusted history')
            (root / 'db/freshclam.dat').write_bytes(b'preserved cooldown')
            (root / 'updater/evidence.log').write_bytes(b'old log\n')
            (root / 'package/producer.cjs').write_bytes(b'reviewed producer')
            with patch.multiple(recovery, ROOT=root, RECORDS=root / 'records', CONFIG=config,
                                FRESH=fresh, DAEMON=daemon, PRODUCER=producer, PACKAGE=root / 'package'), \
                 patch.object(recovery.LinuxHost, 'no_writers'), \
                 patch.object(recovery, 'private'), patch.object(recovery.os, 'chown'):
                host = recovery.LinuxHost('test')
                host.candidate()
                self.assertEqual((root / 'db/daily.cld').read_bytes(), b'old untrusted history')
                self.assertEqual((root / 'updater/evidence.log').read_bytes(), b'old log\n')
                self.assertEqual((host.db / 'freshclam.dat').read_bytes(), b'preserved cooldown')
                self.assertEqual(list(host.db.iterdir()), [host.db / 'freshclam.dat'])
                self.assertIn('TestDatabases yes\n', fresh.read_text())
                self.assertIn('BytecodeSecurity TrustSigned\n', daemon.read_text())
                self.assertEqual(json.loads(config.read_text())['updaterConfigSha256'], recovery.digest(fresh))
                with self.assertRaises(FileExistsError):
                    host.candidate()

    def test_failed_reader_never_completes_recovery(self):
        with tempfile.TemporaryDirectory() as directory:
            host = Host()
            host.accepted = lambda: False
            with self.assertRaisesRegex(recovery.Stop, 'READER_REJECTED'):
                recovery.execute(pathlib.Path(directory) / 'state.json', host)
            self.assertFalse(host.healthy)
            self.assertEqual(host.calls[-1], 'contain')


if __name__ == '__main__':
    unittest.main()
