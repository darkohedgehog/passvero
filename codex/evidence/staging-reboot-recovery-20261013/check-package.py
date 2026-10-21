"""Local regression checks for this operator package only; no runtime commands."""
import ast
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[2]


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


p = load('package_readonly_preflight', HERE / 'preflight.py')


class PackageChecks(unittest.TestCase):
    def setUp(self):
        # A new subprocess branch must fail locally instead of reaching a real host.
        guard = patch.object(p.subprocess, 'run', side_effect=AssertionError('UNMOCKED_OPERATOR_COMMAND'))
        guard.start()
        self.addCleanup(guard.stop)

    def test_retained_record_requires_completed_set_closure_and_idle_service(self):
        import copy
        sid = '20261013T043000Z'
        state = {'attempt': {'complete': True, 'setId': sid}, 'valid': {'setId': sid}}
        record = {'setId': sid}
        closure = {'stagingResumed': True, 'timerBaselineRestored': True, 'serviceResult': 'success'}
        service = {'ActiveState': 'inactive', 'SubState': 'dead'}
        self.assertEqual(p.retained_capture_record(state, record, closure, service)['classification'],
                         'RETAINED_COMPLETED_CAPTURE_RECORD')
        cases = [({'attempt': {'complete': False, 'setId': sid}, 'valid': {'setId': sid}}, record, closure, service),
                 (state, {'setId': '20261012T043000Z'}, closure, service),
                 (state, {'setId': '../escape'}, closure, service),
                 (state, record, dict(closure, stagingResumed=False), service),
                 (state, record, dict(closure, timerBaselineRestored=False), service),
                 (state, record, dict(closure, serviceResult='failed'), service),
                 (state, record, closure, {'ActiveState': 'active', 'SubState': 'running'})]
        for case in cases:
            with self.assertRaises(RuntimeError):
                p.retained_capture_record(*copy.deepcopy(case))

    def test_finalization_actor_requires_real_org_membership(self):
        import copy
        scoped = load('scoped_finalization', HERE / 'remaining-backup-and-actor-readonly.py')
        user = {'userId': '40e51001-912c-4bcf-aa45-d866632aac85', 'verified': True,
                'authEmailMatches': True, 'hasPassword': True,
                'organizationId': 'bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0',
                'membershipStatus': 'ACTIVE', 'organizationStatus': 'ACTIVE', 'membershipRole': 'ADMIN'}
        value = {'users': [user], 'product': {'id': p.PRODUCT, 'organizationId': p.ORG, 'lifecycle': 'ACTIVE'}}
        with patch.object(scoped.subprocess, 'run', side_effect=AssertionError('NO_OPERATOR_COMMAND')):
            self.assertEqual(scoped.validate_actor(value)['authority'],
                             'ACTIVE_ORGANIZATION_MEMBERSHIP_NOT_PLATFORM_GRANT')
            for key, bad in [('verified', False), ('authEmailMatches', False), ('hasPassword', False),
                             ('membershipStatus', 'INACTIVE'), ('organizationStatus', 'SUSPENDED'),
                             ('membershipRole', 'VIEWER'), ('organizationId', 'other'), ('userId', 'other')]:
                broken = copy.deepcopy(value); broken['users'][0][key] = bad
                with self.assertRaises(RuntimeError): scoped.validate_actor(broken)
            with self.assertRaises(RuntimeError): scoped.validate_actor({'users': [], 'platformAdmin': True})

    def test_scoped_backup_logic_is_reused_without_guard_drift(self):
        scoped_tree = ast.parse((HERE / 'remaining-backup-and-actor-readonly.py').read_text())
        original_tree = ast.parse((HERE / 'preflight.py').read_text())
        for name in ('backup', 'retained_capture_record', 'jobs', 'unit', 'sql'):
            original = next(n for n in original_tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
            scoped = next(n for n in scoped_tree.body if isinstance(n, ast.FunctionDef) and n.name == name)
            self.assertEqual(ast.dump(original), ast.dump(scoped))

    def test_candidate_only_changes_exact_release_literal(self):
        old = (ROOT / 'scripts/recover-document-signature-health.py').read_bytes()
        candidate = (HERE / 'recover-release-reviewed.py').read_bytes()
        self.assertEqual(hashlib.sha256(old).hexdigest(), p.OLD_SCANNER_PIN)
        self.assertEqual(candidate, old.replace(b"'8QNIYVVZWEsQaCL9uLZ5Q'", b"'_tkSUOn0PCoHjpx8V7FVr'"))
        tree = ast.parse(candidate)
        calls = [node for node in ast.walk(tree) if isinstance(node, ast.Call)
                 and isinstance(node.func, ast.Name) and node.func.id == 'require'
                 and len(node.args) == 2 and isinstance(node.args[1], ast.Constant)
                 and node.args[1].value == 'STAGING_RELEASE_CHANGED']
        self.assertEqual(len(calls), 1)
        expression = compile(ast.Expression(calls[0]), '<actual-candidate-release-guard>', 'eval')
        def require(value, reason):
            if not value:
                raise RuntimeError(reason)
        for build in (p.BUILD, '8QNIYVVZWEsQaCL9uLZ5Q', 'arbitrary-head', p.BUILD + '-other'):
            scope = {'P': lambda _: types.SimpleNamespace(read_text=lambda: build), 'require': require}
            if build == p.BUILD:
                eval(expression, scope)
            else:
                with self.assertRaisesRegex(RuntimeError, 'STAGING_RELEASE_CHANGED'):
                    eval(expression, scope)

    def test_typed_due_rejects_formatted_zero_and_marks_short_window(self):
        for raw in ('1h 30min', 's 12345', 't 0', 't -1'):
            with patch.object(p, 'run', return_value=raw):
                with self.assertRaises(RuntimeError):
                    p.due(p.TIMERS[0], 1000)
        with patch.object(p, 'run', return_value='t 5000000000\n'):
            self.assertTrue(p.due(p.TIMERS[0], 1000)['wholeWindowAndReserve'])
            self.assertFalse(p.due(p.TIMERS[0], 4999)['wholeWindowAndReserve'])

    def test_release_rejects_changed_executable_build_and_config(self):
        with tempfile.TemporaryDirectory() as directory:
            root = pathlib.Path(directory)
            app, code = root / 'app', root / 'code'
            (app / '.next').mkdir(parents=True)
            code.mkdir()
            (app / '.next/BUILD_ID').write_text(p.BUILD)
            (app / 'safe.js').write_bytes(b'exact executable')
            manifest = {'build_id': p.BUILD, 'files': {'safe.js': {'sha256': p.sha(b'exact executable')}}}
            canonical = root / 'canonical.json'
            canonical.write_text(json.dumps(manifest))
            config = {'buildId': p.BUILD, 'canonicalSha256': p.sha(canonical.read_bytes())}
            (code / 'config.json').write_text(json.dumps(config))
            # Helper bytes are injected only in the local fixture; all production constants remain strict.
            pins = {
                'recurring.py': '14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
                'recurring_acceptance.py': 'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
                'recurring_catalog.py': 'b0b84b1a06035c04949777d664ffe73e9362b063357f72ee7205097c1b2513f7'}
            for name, pin in pins.items():
                (code / name).write_text(pin)
            real_sha = p.sha
            def fixture_sha(body):
                text = body.decode()
                return text if text in pins.values() else real_sha(body)
            with (patch.multiple(p, APP=app, CODE=code, CANONICAL=canonical,
                    CANONICAL_PIN=real_sha(canonical.read_bytes()), CONFIG_PIN=real_sha((code / 'config.json').read_bytes())),
                    patch.object(p, 'sha', fixture_sha)):
                self.assertEqual(p.release()['buildId'], p.BUILD)
                (app / 'safe.js').write_bytes(b'changed')
                with self.assertRaisesRegex(RuntimeError, 'EXECUTABLE_CHANGED'):
                    p.release()
                (app / 'safe.js').write_bytes(b'exact executable')
                (app / '.next/BUILD_ID').write_text('unknown')
                with self.assertRaisesRegex(RuntimeError, 'BUILD_MISMATCH'):
                    p.release()
                (app / '.next/BUILD_ID').write_text(p.BUILD)
                (code / 'config.json').write_text('{}')
                with self.assertRaisesRegex(RuntimeError, 'BACKUP_CONFIG_CHANGED'):
                    p.release()

    def test_invalid_host_runs_no_command(self):
        with patch.object(p.os, 'geteuid', return_value=1000), patch.object(p, 'run') as command:
            with self.assertRaisesRegex(RuntimeError, 'HOST_IDENTITY_REQUIRED'):
                p.main()
            command.assert_not_called()

    def test_collection_never_unlocks_execution_or_exposes_exception_message(self):
        functions = ('release', 'runtime', 'backup', 'jobs', 'startup', 'scanner', 'fixture', 'reminders', 'rollback')
        mocks = {name: (lambda: {}) for name in functions}
        with (patch.multiple(p, **mocks), patch.object(p.os, 'geteuid', return_value=0),
                patch.object(p.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')),
                patch.object(p, 'read', return_value=b'boot-id'), patch.object(p, 'due', return_value={}),
                patch.object(p, 'run', return_value='200 0'),
                patch.object(p, 'runtime', side_effect=ValueError('postgres://private:secret@host/db'))):
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                self.assertEqual(p.main(), 1)
            result = json.loads(output.getvalue())
            self.assertFalse(result['executionUnlocked'])
            self.assertEqual(result['failures'], [{'CHECK_ID': 'RUNTIME', 'reason': 'ValueError'}])
            self.assertNotIn('secret', output.getvalue())


if __name__ == '__main__':
    unittest.main()
