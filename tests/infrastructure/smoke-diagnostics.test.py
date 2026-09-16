"""Local doubles only: no service, socket, user lookup, DB or storage access."""
import contextlib
import importlib.util
import io
import json
import pathlib
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('smoke', pathlib.Path(__file__).parents[2] / 'scripts/document-scan-boundary/smoke-once.py')
smoke = importlib.util.module_from_spec(spec)
spec.loader.exec_module(smoke)


class Diagnostics(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.record = pathlib.Path(self.tmp.name)
        self.ops = {key: (lambda expected=expected: (expected, None, None)) for key, _, expected in smoke.SPECS}
        self.ops['ROLLBACK'] = lambda: ('SUCCESS', 0, None)

    def run_smoke(self):
        return smoke.execute(self.ops, self.record)

    def test_unexpected_then_cleanup_failure_preserves_first(self):
        self.ops['CLIENT_VALID_PDF'] = lambda: ('UNEXPECTED_VALID_RESPONSE', 1, 12)
        def rollback():
            before = json.loads((self.record / 'smoke-failure.json').read_text())
            self.assertEqual(before['first_failure']['CHECK_ID'], 'CLIENT_VALID_PDF')
            raise subprocess.CalledProcessError(7, ['secret-command'], stderr='SECRET')
        self.ops['ROLLBACK'] = rollback
        code, report = self.run_smoke()
        self.assertEqual(code, 1)
        self.assertEqual(report['first_failure']['expected'], 'VALID')
        self.assertEqual(report['first_failure']['actual'], 'UNEXPECTED_VALID_RESPONSE')
        self.assertEqual(report['cleanup']['exit_code'], 7)
        self.assertEqual(next(r for r in report['checks'] if r['CHECK_ID'] == 'CLIENT_FORBIDDEN_OPERATION')['result'], 'NOT_RUN')
        self.assertEqual(json.loads((self.record / 'smoke-failure.json').read_text()), report)

    def test_transport_categories(self):
        for outcome in ('CONNECTION_FAILURE', 'TIMEOUT', 'REJECTED_REQUEST', 'MALFORMED_RESPONSE', 'INCOMPLETE_RESPONSE', 'IDENTITY_FAILURE'):
            self.ops['CLIENT_VALID_PDF'] = lambda outcome=outcome: (outcome, 1, 2)
            code, report = self.run_smoke()
            self.assertEqual(code, 1)
            self.assertEqual(report['first_failure']['actual'], outcome)

    def test_timeout_and_signal_are_not_invented(self):
        def timeout():
            raise subprocess.TimeoutExpired('SECRET', 20, output='SECRET')
        self.ops['CLIENT_EXEC'] = timeout
        _, report = self.run_smoke()
        self.assertEqual(report['first_failure']['actual'], 'TIMEOUT')
        self.assertEqual(report['first_failure']['signal'], 'UNAVAILABLE')
        self.ops['CLIENT_EXEC'] = lambda: ('RETURNED', -9, None)
        self.ops['CLIENT_REPORT'] = lambda: ('INVALID_REPORT', None, None)
        _, report = self.run_smoke()
        self.assertEqual(next(r for r in report['checks'] if r['CHECK_ID'] == 'CLIENT_EXEC')['signal'], 9)

    def test_success_requires_every_check(self):
        code, report = self.run_smoke()
        self.assertEqual(code, 0)
        self.assertTrue(all(r['result'] == 'PASS' for r in report['checks']))
        self.assertEqual(report['cleanup']['result'], 'NOT_RUN')
        self.assertTrue((self.record / 'smoke.json').exists())
        for key, _, _ in smoke.SPECS:
            ops = dict(self.ops)
            ops[key] = lambda: ('MISMATCH', None, None)
            code, report = smoke.execute(ops, self.record)
            self.assertEqual(code, 1)
            self.assertEqual(report['first_failure']['CHECK_ID'], key)

    def test_raw_secret_not_output_or_report(self):
        def failure():
            raise RuntimeError('SYNTHETIC_COOKIE_TOKEN_PDF_SECRET')
        self.ops['CLIENT_EXEC'] = failure
        self.ops['ROLLBACK'] = failure
        output = io.StringIO()
        with contextlib.redirect_stdout(output), contextlib.redirect_stderr(output):
            _, report = self.run_smoke()
        self.assertNotIn('SYNTHETIC', json.dumps(report) + output.getvalue())
        self.assertEqual(report['first_failure']['actual'], 'INTERNAL_HARNESS_ERROR')

    def test_write_failure_nonzero_and_containment(self):
        calls = []
        self.ops['ROLLBACK'] = lambda: (calls.append('rollback') or 'SUCCESS', 0, None)
        def broken(*_):
            raise OSError('SECRET')
        stderr = io.StringIO()
        code, report = smoke.execute(self.ops, self.record, broken, stderr)
        self.assertEqual(code, 1)
        self.assertEqual(report['result'], 'FAIL')
        self.assertEqual(calls, ['rollback'])
        self.assertIn('EVIDENCE_PRESERVATION=NOT_CONFIRMED', stderr.getvalue())
        self.assertNotIn('SECRET', stderr.getvalue())

    def test_client_kind_survives_report_and_write_failure_keeps_first(self):
        self.ops['CLIENT_VALID_PDF'] = lambda: ('UNEXPECTED_VALID_RESPONSE', 1, 4, 'ENCRYPTED')
        _, report = self.run_smoke()
        self.assertEqual(report['first_failure']['client_kind'], 'ENCRYPTED')
        def broken(*_):
            raise OSError('SECRET')
        code, report = smoke.execute(self.ops, self.record, broken, io.StringIO())
        self.assertEqual(code, 1)
        self.assertEqual(report['first_failure']['CHECK_ID'], 'CLIENT_VALID_PDF')
        self.assertEqual(report['report_write']['result'], 'FAIL')
        self.assertEqual(report['cleanup']['result'], 'PASS')

    def test_optional_observation_never_claims_isolation_pass(self):
        # No operation reads parser telemetry; even a successful smoke is not isolation proof.
        self.assertFalse(any('PARSER_PROFILE' == key or 'OBSERVATIONS_READ' == key for key, _, _ in smoke.SPECS))
        code, report = self.run_smoke()
        self.assertEqual(code, 0)
        self.assertEqual(report['scope'], 'BROKER_FUNCTIONAL_AND_LIFECYCLE')
        self.assertEqual(report['NEW_HANDOFF_RUNTIME_ISOLATION'], 'NOT_PROVEN')
        self.assertEqual(report['AUTH_REAL_SESSION_CHECK'], 'NOT_PROVEN')
        self.assertEqual(report['LIVE_ACCEPTANCE_CLEANUP'], 'NOT_PROVEN')

    def test_lifecycle_binding_rejects_stale_missing_and_incomplete_evidence(self):
        import copy
        broker = {'pid': 200, 'start': '500'}
        common = dict(broker_pid=200, broker_start='500', peer_pid=300, peer_start='600', peer_uid=1001, peer_gid=1001)
        receipts = [dict(common, operation='PVQ1', kind='VALID', input_cleanup=True,
                         children=[dict(pid=401, operation='ENCRYPTION', exit_code=2, reaped=True, parser_empty=True),
                                   dict(pid=402, operation='SYNTAX', exit_code=0, reaped=True, parser_empty=True)]),
                    dict(common, operation='REJECTED', kind='FAILED', input_cleanup=False, children=[])]
        def matches(value):
            return smoke.lifecycle_matches(value, broker, 300, '600', 1001, 1001)
        self.assertTrue(matches(receipts))
        for field, value in [('peer_pid', 301), ('peer_start', '599'), ('broker_start', '499'), ('peer_uid', 0), ('peer_gid', 0), ('input_cleanup', False), ('kind', 'FAILED')]:
            changed = copy.deepcopy(receipts); changed[0][field] = value
            self.assertFalse(matches(changed), field)
        for field, value in [('reaped', False), ('parser_empty', False), ('exit_code', -9), ('pid', None), ('operation', 'OTHER')]:
            changed = copy.deepcopy(receipts); changed[0]['children'][0][field] = value
            self.assertFalse(matches(changed), field)
        for missing in (None, [], [{}], [receipts[0]], [receipts[0], {}]):
            self.assertFalse(matches(missing))
        changed = copy.deepcopy(receipts); changed[1]['children'] = [receipts[0]['children'][0]]
        self.assertFalse(matches(changed))

    def test_reaping_and_cleanup_failure_fail_smoke_without_replacing_first(self):
        for key in ('REQUEST_LIFECYCLE', 'PARSER_EMPTY', 'INPUT_CLEANUP', 'OBSERVATION_CLEANUP'):
            ops = dict(self.ops)
            ops[key] = lambda: ('MISMATCH', None, None)
            ops['ROLLBACK'] = lambda: ('PROCESS_FAILED', 70, None)
            code, report = smoke.execute(ops, self.record)
            self.assertEqual(code, 1)
            self.assertEqual(report['first_failure']['CHECK_ID'], key)
            self.assertEqual(report['cleanup']['result'], 'FAIL')
            self.assertEqual(report['NEW_HANDOFF_RUNTIME_ISOLATION'], 'NOT_PROVEN')

    def test_client_allowlist(self):
        rows = [smoke.row(s) for s in [s for s in smoke.SPECS if s[0] in ('CLIENT_VALID_PDF', 'CLIENT_FORBIDDEN_OPERATION')]]
        for r in rows:
            r.update(actual=r['expected'], result='PASS')
        self.assertEqual(smoke.parse_client(json.dumps({'checks': rows})), rows)
        rows[0]['secret'] = 'SECRET'
        with self.assertRaises(ValueError):
            smoke.parse_client(json.dumps({'checks': rows}))
        with self.assertRaises(ValueError):
            smoke.parse_client('x' * 4097)


if __name__ == '__main__':
    unittest.main()
