"""Only the approved exact-pair delta and existing-cluster continuation guards."""
import copy
import importlib.util
import json
import pathlib
import types
import unittest
from unittest.mock import patch

ROOT = pathlib.Path(__file__).parents[2]


def module(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / 'scripts/staging-recovery' / (name + '.py'))
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


class ResumeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.resume = module('recurring_resume')
        cls.catalog = module('recurring_catalog')
        cls.historical = module('verify_database').REVIEWED_CONSTRAINTS
        cls.rows = json.loads((ROOT / 'codex/evidence/backup-recovery/operator-recurring-schema-differences-20261012.json').read_text())['constraintDifferences']

    def catalogs(self):
        return ({'database': {}, 'constraints': [row['source'] for row in self.rows], 'relations': []},
                {'database': {}, 'constraints': [row['restored'] for row in self.rows], 'relations': []})

    def test_evidenced_three_pairs_fail_old_then_all_eight_pass_exact_delta(self):
        source, current = self.catalogs()
        self.catalog.REVIEWED_CONSTRAINTS = dict(self.historical)
        with self.assertRaisesRegex(RuntimeError, 'UNREVIEWED_CONSTRAINT_DIFFERENCE'):
            self.catalog.verify_catalog(source, current, None)
        self.catalog.REVIEWED_CONSTRAINTS = self.resume.reviewed_pairs(self.historical)
        self.assertEqual(len(self.catalog.verify_catalog(source, current, None)['constraints']), 8)
        self.assertEqual(len(self.catalog.REVIEWED_CONSTRAINTS), 8)
        for key, pair in self.historical.items():
            if key != ('ReminderCampaign', 'reminder_campaign_budget'):
                self.assertEqual(self.catalog.REVIEWED_CONSTRAINTS[key], pair)
        self.assertEqual(len(self.historical), 6)

    def test_unknown_constraint_definition_and_unknown_name_still_rejected(self):
        self.catalog.REVIEWED_CONSTRAINTS = self.resume.reviewed_pairs(self.historical)
        for row in self.rows:
            for change in ('definition', 'name'):
                source, current = {'database': {}, 'constraints': [copy.deepcopy(row['source'])], 'relations': []}, {'database': {}, 'constraints': [copy.deepcopy(row['restored'])], 'relations': []}
                if change == 'definition':
                    current['constraints'][0]['definition'] += ' AND TRUE'
                else:
                    source['constraints'][0]['name'] = current['constraints'][0]['name'] = 'unreviewed'
                with self.subTest(row=row['name'], change=change), self.assertRaisesRegex(RuntimeError, 'UNREVIEWED_CONSTRAINT_DIFFERENCE'):
                    self.catalog.verify_catalog(source, current, None)

    def test_old_campaign_hash_pair_not_accepted_by_new_staging_override(self):
        pair = self.resume.reviewed_pairs(self.historical)[('ReminderCampaign', 'reminder_campaign_budget')]
        self.assertNotEqual(pair, self.historical[('ReminderCampaign', 'reminder_campaign_budget')])

    def test_acl_shape_without_equal_effective_sql_privileges_fails(self):
        source = {'database': {}, 'constraints': [], 'relations': [{'name': 'BackgroundJob', 'owner': 'passvero_migrator', 'kind': 'r', 'acl': '{passvero_migrator=arwdDxt/passvero_migrator}'}]}
        current = copy.deepcopy(source); current['relations'][0]['acl'] = None
        calls = []
        def sql(query):
            calls.append(query)
            return {'source': list(range(7)), 'restored': list(range(6))}
        restore = types.SimpleNamespace(literal=lambda x: "'" + x + "'", sql=sql)
        with self.assertRaisesRegex(RuntimeError, 'RESTORED_EFFECTIVE_TABLE_ACL'):
            self.catalog.verify_catalog(source, current, restore)
        self.assertEqual(len(calls), 1)
        self.assertIn('aclexplode(coalesce(c.relacl,acldefault', calls[0])

    def test_unknown_nonconstraint_catalog_difference_still_rejected(self):
        source, current = self.catalogs()
        self.catalog.REVIEWED_CONSTRAINTS = self.resume.reviewed_pairs(self.historical)
        source['roles'] = []; current['roles'] = [{'name': 'unexpected'}]
        with self.assertRaisesRegex(RuntimeError, 'RESTORED_CATALOG_UNREVIEWED_DIFFERENCE'):
            self.catalog.verify_catalog(source, current, None)

    def test_wrong_existing_set_stops_before_cluster_or_storage_operations(self):
        a = types.SimpleNamespace(r=None, selected=lambda *_: {'setId': 'wrong'})
        with self.assertRaisesRegex(RuntimeError, 'EXISTING_SET_CHANGED'):
            self.resume.resume(a, {}, {})
        self.assertEqual(self.resume.CHECK_ID, 'EXISTING_SET_AND_ATTEMPT')

    def test_second_continuation_marker_stops_before_unit_or_start(self):
        row = {'setId': self.resume.SET_ID, 'snapshotId': self.resume.SNAPSHOT,
               'manifestSha256': self.resume.MANIFEST, 'payloadBytes': 1417314}
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            state = pathlib.Path(folder); (state / 'resume-attempt.json').write_text('{}')
            r = types.SimpleNamespace(STATE=state, read=lambda _: {'setId': self.resume.SET_ID, 'automaticRetry': False})
            a = types.SimpleNamespace(r=r, selected=lambda *_: row,
                                     restore_context=lambda *_: types.SimpleNamespace(TARGET=state))
            with patch.object(self.resume, 'private'), patch.object(self.resume, 'unit_guard') as guard:
                with self.assertRaisesRegex(RuntimeError, 'RESUME_BUDGET_ONE'):
                    self.resume.resume(a, {}, {})
                guard.assert_not_called()

    def test_independent_close_records_success_only_after_all_checks(self):
        from unittest.mock import Mock
        r = types.SimpleNamespace(STATE=pathlib.Path('/state'), ROOT=pathlib.Path('/root'),
            read=Mock(side_effect=[{'completed': [{'setId': self.resume.SET_ID}]},
                                   {'parents': [], 'postgresUid': 10}]),
            resume_timer=Mock(), atomic=Mock())
        restore = types.SimpleNamespace(TARGET=pathlib.Path('/target'), restore_parents=Mock())
        a = types.SimpleNamespace(r=r, restore_context=lambda *_: restore)
        prepare = types.SimpleNamespace(runtime=Mock())
        with patch.object(self.resume, 'no_private_process'):
            self.resume.close(a, {}, {'prepare': prepare})
        restore.restore_parents.assert_called_once_with([], 10)
        prepare.runtime.assert_called_once()
        r.resume_timer.assert_called_once()
        self.assertEqual(r.atomic.call_args.args[1]['cluster'], 'STOPPED')

    def test_independent_close_never_claims_success_if_private_process_remains(self):
        from unittest.mock import Mock
        r = types.SimpleNamespace(STATE=pathlib.Path('/state'),
            read=lambda _: {'completed': [{'setId': self.resume.SET_ID}]}, atomic=Mock())
        a = types.SimpleNamespace(r=r, restore_context=lambda *_: None)
        with patch.object(self.resume, 'no_private_process', side_effect=RuntimeError('PRIVATE_CLUSTER_ALREADY_RUNNING')):
            with self.assertRaisesRegex(RuntimeError, 'PRIVATE_CLUSTER_ALREADY_RUNNING'):
                self.resume.close(a, {}, {})
        r.atomic.assert_not_called()
        self.assertEqual(self.resume.CHECK_ID, 'INDEPENDENT_CLUSTER_AND_PARENT_CLOSURE')

    def test_failure_retains_check_id_without_raw_error_or_retry(self):
        self.resume.CHECK_ID = 'ALL_TABLE_COUNTS'
        result = self.resume.failure(ValueError('untrusted detail'))
        self.assertEqual(result, {'result': 'STOP', 'CHECK_ID': 'ALL_TABLE_COUNTS',
                                  'reason': 'ValueError', 'automaticRetry': False})


if __name__ == '__main__':
    unittest.main()
