"""Exactly two local adapter paths. No operational helper/TTY/network is loaded.
Lower-level previously reviewed guards are doubles, not renewed live evidence.
Run: python3 -I -B codex/evidence/staging-auth-scanner-continuation-20261020/test_continuation_local.py
"""
import contextlib
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
ORG = 'bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0'
USER = '40e51001-912c-4bcf-aa45-d866632aac85'
OBS_DOWNLOAD = 'Authorized CLEAN PDF download SHA256 matched approved fixture'
OBS_PUBLIC = 'Published synthetic public DPP and image/PDF access without session'


def load_adapter():
    spec = importlib.util.spec_from_file_location('local_continuation_candidate', HERE / 'continuation-reviewed.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class LocalDoubles:
    """All external operations are in-memory or private temporary evidence files."""
    TIMERS = ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer',
              'passvero-subscription-reminders.timer')
    SCANNER_PIN = 'LOCAL_DOUBLE_NO_SCANNER_EXECUTION'

    def __init__(self, root, adapter, selected_org):
        self.root = root
        self.adapter = adapter
        self.BACKUP = root / 'backup-double'
        self.BACKUP.mkdir()
        (self.BACKUP / 'state.json').write_bytes(b'{"mode":"CONTINUOUS","hold":false,"attempts":9}\n')
        self.original_backup = self.read(self.BACKUP / 'state.json')
        self.records = root / 'scanner-records-double'
        self.records.mkdir()
        self.units = {name: {'ActiveState': 'active', 'UnitFileState': 'enabled'} for name in self.TIMERS}
        self.commands = []
        self.lock_paths = []
        self.server_queries = []
        self.prompts = []
        self.flow_calls = 0
        self.published = False
        self.sessions = [{'id': 'synthetic-session', 'user': USER, 'created': 1001,
                          'expires': 5000, 'selected_org': selected_org}]
        self.base = types.SimpleNamespace(runtime=lambda: {'scope': 'LOCAL_RUNTIME_DOUBLE'},
            backup=lambda: {'scope': 'LOCAL_BACKUP_DOUBLE'}, jobs=lambda: None,
            reminders=lambda: {'safeToFinalizePause': True}, fixture=self.fixture, sql=self.sql)
        self.scoped = types.SimpleNamespace(actor=self.actor, validate_actor=self.validate_actor)
        self.deploy = types.SimpleNamespace(idle=lambda: None)
        self.scanner_double = types.SimpleNamespace(RECORDS=self.records, LinuxHost=lambda _: types.SimpleNamespace(
            guard=lambda: None, reader=lambda: {'fresh': 'LOCAL_ACCEPTED_READER_DOUBLE'}))

    @staticmethod
    def require(ok, reason):
        if not ok:
            raise RuntimeError(reason)

    def components(self):
        return self.base, self.scoped, self.deploy

    @staticmethod
    def read(path):
        return Path(path).read_bytes()

    @staticmethod
    def sha(body):
        return hashlib.sha256(body).hexdigest()

    def record(self, name, value):
        # Production record() is immutable. Do not hide a duplicate attempt in tests.
        path = self.root / name
        with path.open('x') as output:
            json.dump(value, output)

    def data(self, name):
        return json.loads((self.root / name).read_text())

    @contextlib.contextmanager
    def locked(self, path):
        self.lock_paths.append(str(path))
        yield

    def actor(self):
        return {'users': [{'membershipRole': 'ADMIN', 'membershipId': 'b954c03b-9c81-4760-bd63-83127b56bbb6'}],
                'product': {'draftId': None if self.published else 'a2e0ebe2-8305-4975-84f2-83b16d505536',
                            'publishedId': 'synthetic-published-version' if self.published else None}}

    def validate_actor(self, actor):
        self.require(actor['users'][0]['membershipRole'] == 'ADMIN', 'LOCAL_ACTOR_REJECTED')
        return {'source': 'LOCAL_MEMBERSHIP_DOUBLE'}

    def fixture(self):
        return {'imageReferences': [], 'documentReferences': []}

    def sql(self, query):
        if 'freshActiveSessions' in query:
            self.require('"AuthIdentity"' in query and '"AuthSessionSelection"' in query
                         and USER in query and ORG in query and 'to_timestamp(1000' in query,
                         'LOCAL_QUERY_BINDING_CHANGED')
            self.server_queries.append(query)
            active = [s for s in self.sessions if s['user'] == USER and s['created'] >= 1000 and s['expires'] > 1002]
            return {'freshActiveSessions': len(active), 'freshSelectedOrganizationSessions':
                    sum(s['selected_org'] == ORG for s in active)}
        if 'unresolvedAccessNotices' in query:
            return {'unresolvedAccessNotices': 0}
        if 'ProductImageAsset' in query and 'Document' in query:
            return {'images': 0, 'pdfs': 0}
        raise AssertionError('UNEXPECTED_SQL_NO_DATABASE_ACCESS')

    def unit(self, name):
        if name in self.units:
            return dict(self.units[name])
        if name == 'passvero-subscription-reminders.service':
            return {'ActiveState': 'inactive', 'TriggeredBy': self.TIMERS[2]}
        if name == self.adapter.UNIT + '.service':
            return {'ActiveState': 'inactive'}
        raise AssertionError('UNEXPECTED_UNIT')

    def run(self, args, **kwargs):
        # Any scanner, worker, subprocess, or other command is rejected by the double.
        self.require(args in (['/usr/bin/systemctl', 'disable', '--now', self.TIMERS[2]],
                              ['/usr/bin/systemctl', 'enable', '--now', self.TIMERS[2]]),
                     'UNEXPECTED_OPERATION_NO_EXECUTION')
        self.commands.append(args)
        self.units[self.TIMERS[2]] = {'ActiveState': 'inactive' if args[1] == 'disable' else 'active',
                                     'UnitFileState': 'disabled' if args[1] == 'disable' else 'enabled'}

    def writer_guard(self, paused=False):
        self.require(self.unit(self.TIMERS[2])['ActiveState'] == ('inactive' if paused else 'active'),
                     'LOCAL_PAUSE_STATE_NOT_MATCHED')
        # Static TriggeredBy survives the deliberate pause.
        self.require(self.unit('passvero-subscription-reminders.service')['TriggeredBy'] == self.TIMERS[2],
                     'LOCAL_STATIC_TRIGGER_CHANGED')

    def release(self, deploy): pass
    def drain_writer(self): pass
    def idle(self, base, deploy): self.writer_guard()
    def due(self, deploy, seconds): return {name: 1000 + seconds + 10 for name in self.TIMERS[:2]}
    def production_job_window(self, deploy): return {'changed': False, 'due': 9000}
    def verify_rollback(self, deploy): return {'scope': 'LOCAL_ROLLBACK_DOUBLE'}
    def scanner_module(self): return self.scanner_double
    def scanner_close(self): raise AssertionError('NO_RECOVERY_ALLOWED_IN_THESE_TWO_PATHS')
    def boot_id(self): return 'synthetic-current-boot'
    def delivery(self, base): return {'digest': 'synthetic-unchanged-delivery'}
    def unchanged(self): self.require(self.read(self.BACKUP / 'state.json') == self.original_backup, 'LOCAL_STATE_CHANGED')
    def http(self, url):
        self.require(url == 'https://staging.passvero.eu/', 'UNEXPECTED_HTTP_TARGET')
        return '200 0'  # In-memory result; no HTTP client exists in this test.
    def readers(self, seconds):
        self.require(seconds == 45, 'LOCAL_READER_BUDGET_CHANGED')
        return [{'syntheticPublication': index} for index in range(3)]
    def ask(self, prompt, timeout):
        self.require(timeout == 600, 'AUTH_TIMEOUT_CHANGED')
        self.prompts.append(prompt)
        return 'PASS'  # No TTY and no password/auth call.
    def flow_proof(self):
        self.flow_calls += 1
        self.require(self.published, 'SYNTHETIC_UI_COMPLETION_REQUIRED')
        result = {'observations': {OBS_DOWNLOAD: 'PASS', OBS_PUBLIC: 'PASS'}}
        self.record('flow-pass.json', result)
        return result


class ContinuationTwoPathProof(unittest.TestCase):
    def path(self, selected_org):
        temporary = tempfile.TemporaryDirectory(prefix='passvero-continuation-two-path-')
        self.addCleanup(temporary.cleanup)
        adapter = load_adapter()
        adapter.ROOT = Path(temporary.name)
        helper = LocalDoubles(adapter.ROOT, adapter, selected_org)
        adapter.H = helper
        for patcher in (patch.object(adapter.os, 'geteuid', return_value=0),
                        patch.object(adapter.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')),
                        patch.object(adapter.time, 'time', return_value=1000.0),
                        patch.object(adapter.time, 'monotonic', return_value=100.0),
                        patch.object(adapter, 'historical_reference', return_value={
                            'classification': 'LOCAL_DOUBLE_OF_ALREADY_ACCEPTED_HISTORY'})):
            patcher.start()
            self.addCleanup(patcher.stop)
        self.assertTrue(adapter.LOCAL_CONTINUATION_PROOF_ACCEPTED)
        return adapter, helper

    def mode(self, adapter, mode):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            result = adapter.main(mode)
        return result, json.loads(output.getvalue())

    def independent_close(self, adapter, helper, failure_before=None):
        # A new module instance, like the separate operator close process. No flow locals survive.
        closing = load_adapter()
        closing.ROOT = adapter.ROOT
        closing.H = helper
        code, result = self.mode(closing, 'close')
        self.assertEqual(code, 0)
        self.assertEqual(result['closure'], 'PASS_BASELINE_RESTORED')
        self.assertEqual(result['pending'], {})
        self.assertTrue(result['backupStateUnchanged'])
        self.assertTrue(result['deliveryUnchangedBeforeSendingResume'])
        self.assertEqual(helper.read(helper.BACKUP / 'state.json'), helper.original_backup)
        self.assertEqual(helper.unit(helper.TIMERS[2]), {'ActiveState': 'active', 'UnitFileState': 'enabled'})
        self.assertEqual(helper.commands, [
            ['/usr/bin/systemctl', 'disable', '--now', helper.TIMERS[2]],
            ['/usr/bin/systemctl', 'enable', '--now', helper.TIMERS[2]]])
        self.assertTrue(all(helper.unit(name) == {'ActiveState': 'active', 'UnitFileState': 'enabled'}
                            for name in helper.TIMERS[:2]))
        if failure_before is not None:
            self.assertEqual((adapter.ROOT / 'first-failure.json').read_bytes(), failure_before)
        return result

    def test_one_successful_continuation_and_independent_close(self):
        adapter, helper = self.path(ORG)
        self.assertEqual(self.mode(adapter, 'coordinate')[0], 0)
        baseline = helper.read(adapter.ROOT / 'baseline.json')
        self.assertEqual(helper.data('baseline.json')['t0'], 1000)
        self.assertEqual(helper.data('baseline.json')['startMonotonic'], 100)
        self.assertEqual(self.mode(adapter, 'auth')[0], 0)
        self.assertEqual(helper.data('auth-pass.json')['serverProof'],
                         {'freshActiveSessions': 1, 'freshSelectedOrganizationSessions': 1})
        self.assertEqual(len(helper.server_queries), 1)
        self.assertEqual(len(helper.prompts), 2)
        self.assertEqual(self.mode(adapter, 'scanner')[1]['recovery'], 'NOT_REQUIRED')
        self.assertEqual(self.mode(adapter, 'begin-flow')[0], 0)
        helper.published = True  # Synthetic in-memory browser outcome, no business mutation.
        self.assertEqual(self.mode(adapter, 'flow-proof')[0], 0)
        self.assertEqual(helper.flow_calls, 1)
        self.assertFalse((adapter.ROOT / 'closure.json').exists())
        result = self.independent_close(adapter, helper)
        self.assertEqual(result['functionalContinuation'], 'PASS_CURRENT_STATE_ONLY')
        self.assertEqual(helper.read(adapter.ROOT / 'baseline.json'), baseline)
        self.assertFalse((adapter.ROOT / 'first-failure.json').exists())

    def test_one_rejected_server_selection_and_independent_close(self):
        adapter, helper = self.path('synthetic-other-organization')
        self.assertEqual(self.mode(adapter, 'coordinate')[0], 0)
        baseline = helper.read(adapter.ROOT / 'baseline.json')
        code, result = self.mode(adapter, 'auth')
        self.assertEqual(code, 1)
        self.assertEqual(result['CHECK_ID'], 'CONTINUATION_AUTH')
        self.assertEqual(result['reason'], 'FRESH_SERVER_SESSION_AND_ORG_SELECTION_NOT_PROVEN')
        self.assertEqual(len(helper.prompts), 2)  # Manual PASS cannot replace the server selection.
        self.assertEqual(len(helper.server_queries), 1)
        for name in ('auth-pass.json', 'scanner-attempt.json', 'scanner-pass.json',
                     'flow-intent.json', 'functional-items.json', 'closure.json'):
            self.assertFalse((adapter.ROOT / name).exists())
        self.assertEqual(helper.flow_calls, 0)
        failure = helper.read(adapter.ROOT / 'first-failure.json')
        result = self.independent_close(adapter, helper, failure)
        self.assertEqual(result['functionalContinuation'], 'NOT_PROVEN')
        self.assertEqual(helper.read(adapter.ROOT / 'baseline.json'), baseline)


if __name__ == '__main__':
    unittest.main(verbosity=2)
