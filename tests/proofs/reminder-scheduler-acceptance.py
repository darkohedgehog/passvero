"""Scheduler-only proof against isolated systemd/SQL boundaries; no live commands."""
import copy, importlib.util, pathlib, tempfile, unittest
from unittest.mock import patch
spec=importlib.util.spec_from_file_location('scheduler','scripts/subscription-reminders/scheduler-acceptance.py')
m=importlib.util.module_from_spec(spec)
if pathlib.Path(spec.origin).exists():spec.loader.exec_module(m)
class SchedulerProofTest(unittest.TestCase):
    def test_empty_or_formatted_timestamp_is_rejected_with_context(self):
        for value in ['', 'infinity', '2min', '-1']:
            with self.subTest(value=value),self.assertRaisesRegex(AssertionError,'TIMER_MONOTONIC_INVALID'):
                m.monotonic_value({'LastTriggerUSecMonotonic':value},'LastTriggerUSecMonotonic','TIMER')
    def exercise(self,fault=None):
        snapshot={'campaigns':[{'id':x,'enabled':False,'dispatches':2,'maxDispatches':2} for x in m.CAMPAIGNS],
          'outbox':[{'id':str(i),'status':'SENT' if i<4 else 'CANCELLED','attempts':1 if i<4 else 0} for i in range(6)],
          'attempts':[{'id':str(i),'status':'ACCEPTED'} for i in range(4)]}
        calls=[];enabled=False;finished=False
        def props(unit):
            if unit==m.TIMER:
                return {'ActiveState':'active' if enabled else 'inactive','UnitFileState':'enabled' if enabled else 'disabled','LastTriggerUSecMonotonic':'2min 30.001s' if finished else '0','LoadState':'loaded'}
            return {'ActiveState':'failed' if fault=='service' and finished else 'inactive','Result':'exit-code' if fault=='service' and finished else 'success','ExecMainStatus':'1' if fault=='service' and finished else '0','ExecMainStartTimestampMonotonic':'101' if finished else '0'}
        def run(args,**kw):
            nonlocal enabled,finished
            calls.append(args)
            if args[:3]==['systemctl','enable','--now']:enabled=True
            if args[:3]==['systemctl','disable','--now']:enabled=False
            return ''
        def tick(_):
            nonlocal finished
            finished=True
        def inventory():
            s=copy.deepcopy(snapshot)
            if fault=='drift' and finished:s['attempts'].append({'status':'ACCEPTED'})
            if fault=='budget':s['campaigns'][0]['dispatches']=1
            return s
        journal=[] if fault=='journal' else [{'invocationId':'a'*32,'worker':'IDLE','sending':'NO_APPROVED_CAMPAIGN'}]
        with tempfile.TemporaryDirectory() as tmp,patch.object(m,'properties',side_effect=props),patch.object(m,'inventory',side_effect=inventory),patch.object(m,'command',side_effect=run),patch.object(m,'journal_evidence',return_value=journal),patch.object(m.time,'sleep',side_effect=tick):
            state=pathlib.Path(tmp)
            if fault:
                with self.assertRaises(AssertionError):m.observe(state)
            else:
                result=m.observe(state)
                self.assertEqual(result['scheduler'],'PASS_TIMER_TRIGGERED_IDLE_CYCLE')
                self.assertEqual(result['additionalSmtpDispatches'],0)
                self.assertTrue(result['databaseUnchanged'])
            self.assertFalse(enabled)
            if fault=='budget':self.assertFalse(any(c[:2]==['systemctl','enable'] for c in calls))
            else:self.assertTrue((state/'closure.json').exists())
        self.assertFalse(any(c[:2]==['systemctl','start'] for c in calls))
    def test_real_trigger_idle_and_unchanged_state(self):self.exercise()
    def test_unconsumed_budget_blocks_enable(self):self.exercise('budget')
    def test_failed_service_closes_timer(self):self.exercise('service')
    def test_database_drift_closes_timer(self):self.exercise('drift')
    def test_missing_worker_evidence_closes_timer(self):self.exercise('journal')
if __name__=='__main__':unittest.main()
