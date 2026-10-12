"""Reject cross-environment scope and secret-bearing diagnostic output."""
import importlib.util
import pathlib
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).parents[2] / 'scripts/staging-recovery/recurring_preflight.py'


class PreflightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if PATH.exists():
            spec = importlib.util.spec_from_file_location('recurring_preflight', PATH)
            cls.module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.module)

    def test_non_operator_stops_before_loading_privileged_helpers(self):
        m = self.require_module()
        with patch.object(m.os, 'geteuid', return_value=1000), self.assertRaisesRegex(m.Stop, 'OPERATOR_HOST'):
            m.main()

    def require_module(self):
        if not PATH.exists():
            self.fail('Read-only recurring preflight is not implemented')
        return self.module

    def test_accepts_only_exact_staging_snapshot_paths(self):
        m = self.require_module()
        row = {'id': 'a' * 64, 'hostname': 'passvero-staging-recovery',
               'tags': ['passvero-staging-recovery', 'set:20261001T212354Z'],
               'paths': ['/var/lib/passvero-staging-recovery/sets/20261001T212354Z'],
               'time': '2026-10-01T21:25:00Z'}
        self.assertEqual(m.snapshot_summary([row])[0]['setId'], '20261001T212354Z')
        for changes in ({'hostname': 'passvero-production'},
                        {'tags': ['passvero-postgresql']},
                        {'paths': ['/var/lib/passvero-staging-recovery/sets/../production']},
                        {'paths': row['paths'] + ['/var/lib/passvero-backup']},
                        {'id': 'not-a-snapshot'}):
            with self.subTest(changes=changes), self.assertRaises(m.Stop):
                m.snapshot_summary([dict(row, **changes)])

    def test_diagnostics_never_relay_external_error_text(self):
        m = self.require_module()
        for error in (RuntimeError('postgres://admin:secret@server'),
                      ValueError('https://api.telegram.org/botSECRET'),
                      m.Stop('secret/password')):
            output = m.stop_report(error, 'B2_READ_ONLY')
            self.assertNotIn('secret', str(output).lower())
            self.assertEqual(output['databaseWrites'], 0)
            self.assertFalse(output['workerExecuted'])
        self.assertEqual(m.stop_report(m.Stop('EXACT_PREFIX_MISSING'), 'B2_READ_ONLY')['reason'],
                         'EXACT_PREFIX_MISSING')

    def test_unit_report_discards_credentials_and_exec_environment(self):
        m = self.require_module()
        output = m.unit_report('ActiveState=active\nUnitFileState=enabled\n'
                               'Environment=PASSWORD=secret\nExecStart=token\n')
        self.assertEqual(output, {'ActiveState': 'active', 'UnitFileState': 'enabled'})

    def test_missing_repository_cannot_be_initialized_by_preflight(self):
        m = self.require_module()
        for value in ({'id': 'b' * 64, 'version': 2},):
            self.assertEqual(m.repository_identity(value), 'b' * 64)
        for value in ({}, {'id': 'b' * 64, 'version': 3}, {'id': 'password', 'version': 2}):
            with self.subTest(value=value), self.assertRaises(m.Stop):
                m.repository_identity(value)

    def test_alert_contract_does_not_emit_literal_secrets(self):
        m = self.require_module()
        output = m.alert_contract('''#!/usr/bin/python3
TOKEN = "VERY_SECRET_TOKEN"
STATE = "/var/lib/passvero-backup/state/alerts.json"
def send_alert():
    return TOKEN
''')
        self.assertNotIn('VERY_SECRET_TOKEN', str(output))
        self.assertEqual(output['functions'], ['send_alert'])
        self.assertTrue(output['productionStateReferenced'])


if __name__ == '__main__':
    unittest.main()
