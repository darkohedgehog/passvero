"""New schema equivalence, bounded restore selection and dry-run boundary tests."""
import copy
import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts/staging-recovery' / (name + '.py'))
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value


class AcceptanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.a = module('recurring_acceptance')
        cls.catalog = module('recurring_catalog')
        cls.catalog.REVIEWED_CONSTRAINTS = module('verify_database').REVIEWED_CONSTRAINTS

    def test_new_catalog_can_match_exactly_without_historical_six_delta(self):
        source = {'database': {}, 'constraints': [], 'relations': [], 'migrations': ['new']}
        self.assertEqual(self.catalog.verify_catalog(source, copy.deepcopy(source), None),
                         {'constraints': [], 'relations': []})

    def test_new_catalog_accepts_only_reviewed_exact_constraint_pair(self):
        rows = json.loads((ROOT / 'codex/evidence/backup-recovery/operator-saved-constraint-definitions.json').read_text())['differences']
        row = rows[0]
        source = {'database': {}, 'constraints': [{'table': row['table'], 'name': row['constraint'], 'definition': row['sourceDefinition']}], 'relations': []}
        current = copy.deepcopy(source); current['constraints'][0]['definition'] = row['restoredDefinition']
        self.assertEqual(len(self.catalog.verify_catalog(source, current, None)['constraints']), 1)
        current['constraints'][0]['definition'] += ' AND TRUE'
        with self.assertRaisesRegex(RuntimeError, 'UNREVIEWED_CONSTRAINT_DIFFERENCE'):
            self.catalog.verify_catalog(source, current, None)

    def test_unknown_new_catalog_difference_is_not_a_waiver(self):
        source = {'database': {}, 'constraints': [], 'relations': [], 'roles': []}
        current = copy.deepcopy(source); current['roles'] = [{'name': 'new_grant'}]
        with self.assertRaisesRegex(RuntimeError, 'RESTORED_CATALOG_UNREVIEWED_DIFFERENCE'):
            self.catalog.verify_catalog(source, current, None)

    def test_restore_budget_reserved_before_any_download_and_never_reused(self):
        a = self.a; r = a.r
        with tempfile.TemporaryDirectory() as folder:
            target = pathlib.Path(folder) / 'restore'
            target.mkdir()
            fake = types.SimpleNamespace(TARGET=target)
            with patch.object(a, 'selected', return_value={'setId': 'new'}), patch.object(a, 'restore_context', return_value=fake), patch.object(r, 'STATE', pathlib.Path(folder)):
                with self.assertRaisesRegex(r.Stop, 'RESTORE_BUDGET_ONE'):
                    a.restore_latest({}, {'capture': None, 'offsite': None, 'prepare': None})
                self.assertFalse((pathlib.Path(folder) / 'restore-attempt.json').exists())

    def test_retention_dry_run_rejects_production_response(self):
        a = self.a; r = a.r
        class Repository:
            repo='staging-selector';keys={}
            def run(self, args):return json.dumps({'id':'repo'}).encode()
            def snapshots(self):return []
        offsite=types.SimpleNamespace(Repository=lambda _:Repository())
        body=[{'keep':[{'id':'a'*64,'hostname':'production','tags':['passvero-postgresql'],'paths':['/production']}]}]
        output=types.SimpleNamespace(returncode=0,stdout=json.dumps(body).encode())
        with tempfile.TemporaryDirectory() as folder, patch.object(r,'STATE',pathlib.Path(folder)), patch.object(a,'selected',return_value={'setId':'new'}), patch.object(a.subprocess,'run',return_value=output) as call:
            with self.assertRaisesRegex(r.Stop,'STAGING_RETENTION_SELECTOR'):
                a.retention({'repositoryId':'repo'},{'offsite':offsite,'prepare':None})
            command=call.call_args.args[0]
            self.assertIn('--dry-run',command);self.assertIn('--no-lock',command)
            self.assertNotIn('prune',command)
            self.assertTrue((pathlib.Path(folder)/'retention-attempt.json').exists())
            self.assertFalse((pathlib.Path(folder)/'retention.json').exists())

    def test_controlled_signals_do_not_modify_live_state_or_send_unapproved_message(self):
        a = self.a; r = a.r
        with tempfile.TemporaryDirectory() as folder, patch.object(r,'STATE',pathlib.Path(folder)), patch.object(r,'monitor') as monitor:
            path=pathlib.Path(folder)/'state.json';r.atomic(path,{'valid':{'snapshotId':'live'}})
            before=path.read_bytes();a.signals({'testTelegramApproved':False},{})
            self.assertEqual(path.read_bytes(),before);monitor.assert_not_called()
            self.assertEqual(r.read(pathlib.Path(folder)/'signal-proof.json')['inboxReceipt'],'NOT_PROVEN')

if __name__ == '__main__':
    unittest.main()
