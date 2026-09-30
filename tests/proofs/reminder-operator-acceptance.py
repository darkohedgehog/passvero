"""Isolated closure regression; no systemd, database or live transport calls."""
import importlib.util, json, pathlib, sys, tempfile, types, unittest
from unittest.mock import patch
common=types.ModuleType('common')
for name in ['A','S','R','P','sha','regular','run','identity','sql','scope','monitor','execute']:
    setattr(common,name,pathlib.Path if name=='P' else lambda *a,**kw:None)
sys.modules['common']=common
spec=importlib.util.spec_from_file_location('acceptance_operator','scripts/subscription-reminders/acceptance.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class CloseScopeTest(unittest.TestCase):
    def check_close(self,timer_failure=False,sql_failure=False):
        with tempfile.TemporaryDirectory(prefix='reminder-close-') as directory:
            state=pathlib.Path(directory);queries=[]
            def sql(query):
                queries.append(query)
                if sql_failure and query.startswith('BEGIN'):raise RuntimeError('private detail must never be logged')
                return '0'
            with patch.object(module,'run',side_effect=RuntimeError('private detail') if timer_failure else None),patch.object(module,'sql',side_effect=sql),patch.object(module,'timer_state',return_value={'enabled':'disabled','active':'inactive'}),patch.object(module,'service_state',return_value={'ActiveState':'inactive'}):
                result=module.close_sending_scope(['c0db6597-b030-58d5-bfe3-31019b05c427','09877c41-11ef-5e38-b0a2-4089cc40511c'],state)
            self.assertTrue(any(q.startswith('BEGIN') for q in queries))
            self.assertEqual(json.loads((state/'closure.json').read_text()),result)
            self.assertNotIn('private detail',(state/'closure.json').read_text())
            self.assertEqual(bool(result['errors']),timer_failure or sql_failure)
            return result
    def test_timer_failure_still_disables_campaigns(self):
        self.assertIn('TIMER_DISABLE_FAILED',self.check_close(timer_failure=True)['errors'])
    def test_campaign_failure_retains_closure_evidence(self):
        self.assertIn('CAMPAIGNS_DISABLE_FAILED',self.check_close(sql_failure=True)['errors'])
    def test_normal_close(self):self.check_close()
class FixtureIdentityTest(unittest.TestCase):
    def test_preserves_postgres_identity_and_adds_only_staging_supplementary_group(self):
        original={'user':100,'group':101,'extra_groups':[101,102],'cwd':'/','env':{'PATH':'/usr/bin:/bin'}}
        with patch.object(module,'identity',return_value=original),patch.object(module,'A',pathlib.Path('/var/www/passvero-acceptance')),patch.object(module.pwd,'getpwnam',return_value=types.SimpleNamespace(pw_gid=303)):
            result=module.fixture_identity()
        self.assertEqual(result['user'],100)
        self.assertEqual(result['group'],101)
        self.assertEqual(result['extra_groups'],[101,102,303])
        self.assertEqual(result['env']['NODE_PATH'],'/var/www/passvero-acceptance/node_modules')
class RetainedFixtureContinuationTest(unittest.TestCase):
    def check_continuation(self,nonempty=False,wrong_pin=False):
        with tempfile.TemporaryDirectory(prefix='reminder-continuation-') as directory:
            root=pathlib.Path(directory);prior=root/'acceptance-v2';prior.mkdir();package=root/'package';package.mkdir()
            attempt={'manifest':'bad' if wrong_pin else '3fbd3c8a65ce296d5d6450ec97f936e73f6095fce1a23de3f2d71adc3f0913f6','approvalExpiresAt':'2026-10-01T09:00:00.000Z'}
            closure={'timer':{'enabled':'disabled','active':'inactive'},'campaignsEnabled':0,'errors':[],'serviceState':{'ActiveState':'inactive','ExecMainStartTimestampMonotonic':'0'}}
            retained={'organizationIds':['synthetic-test'],'transportCalls':0}
            (prior/'attempt.json').write_text(json.dumps(attempt));(prior/'closure.json').write_text(json.dumps(closure));(prior/'create.json').write_text(json.dumps({'action':'create','result':retained}));(package/'retained-fixtures.json').write_text(json.dumps(retained))
            before={p.name:p.read_bytes() for p in prior.iterdir()}
            counts={'campaigns':2,'enabled':0,'dispatches':0,'outbox':0,'attempts':1 if nonempty else 0}
            with patch.object(module,'R',root),patch.object(module,'S',package),patch.object(module,'sql',return_value=json.dumps(counts)):
                if nonempty or wrong_pin:
                    with self.assertRaisesRegex(AssertionError,'DELIVERY_STATE_REQUIRES_REVIEW' if nonempty else 'PRIOR_ATTEMPT_PIN'):module.retained_created_fixture_evidence()
                else:self.assertEqual(module.retained_created_fixture_evidence(),retained)
            self.assertEqual({p.name:p.read_bytes() for p in prior.iterdir()},before)
            self.assertFalse((root/'acceptance-v3').exists())
    def test_retained_fixture_evidence_preserves_prior_files(self):self.check_continuation()
    def test_any_delivery_attempt_blocks_continuation(self):self.check_continuation(nonempty=True)
    def test_wrong_previous_package_blocks_continuation(self):self.check_continuation(wrong_pin=True)
class TimerMarkerTest(unittest.TestCase):
    def test_systemctl_timespan_is_not_parsed_as_integer(self):
        with patch.object(module,'run',return_value='3d 2h 1min 5.123s'):
            self.assertEqual(module.timer_trigger(),'3d 2h 1min 5.123s')
    def test_missing_timer_marker_stops_explicitly(self):
        with patch.object(module,'run',return_value=''):
            with self.assertRaisesRegex(AssertionError,'TIMER_TRIGGER_MISSING'):module.timer_trigger()
if __name__=='__main__':unittest.main()
