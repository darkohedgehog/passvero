"""Pure operator acceptance checks; no DB, timer, SMTP or runtime credentials."""
import importlib.util, pathlib, unittest
ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('enable',ROOT/'scripts/subscription-reminders/enrollment-enable.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)

class Acceptance(unittest.TestCase):
    def baseline(self):
        return {'organizations':[{'id':module.ORG,'owners':[{'email':'milanko.zivic@optinet.hr'}]}], 'campaigns':[{'id':module.CAMPAIGN,'dispatches':0,'maxDispatches':12,'enrollmentOrganizationId':None,'periodKey':None,'automaticRecipients':False,'lastStartedAt':None,'leaseToken':None}], 'outbox':[{'status':'SENT','attempts':1}], 'attemptCounts':[{'status':'ACCEPTED','count':4}]}
    def test_link_and_normal_scheduler_metadata_preserve_business_scope(self):
        import copy
        before=self.baseline(); after=copy.deepcopy(before)
        after['campaigns'][0].update({'enrollmentOrganizationId':module.ORG,'periodKey':'trial:2026-10-05T15:27:58.877Z','lastStartedAt':'later','leaseToken':'ordinary_cycle'})
        module.validate_scope(after,before)
    def test_budget_or_delivery_or_recipient_change_stops_acceptance(self):
        import copy
        before=self.baseline()
        for change in ['budget','recipient','outbox','attempt']:
            with self.subTest(change=change):
                after=copy.deepcopy(before)
                if change=='budget': after['campaigns'][0]['dispatches']=1
                elif change=='recipient': after['organizations'][0]['owners'][0]['email']='unapproved@example.test'
                elif change=='outbox': after['outbox'].append({'status':'PENDING','attempts':0})
                else: after['attemptCounts'][0]['count']=5
                with self.assertRaisesRegex(module.ScopeDrift,'MATERIAL_SCOPE') as raised: module.validate_scope(after,before)
                self.assertTrue(raised.exception.differences)
    def test_unresolved_delivery_is_rejected_even_if_snapshot_matches(self):
        baseline=self.baseline(); baseline['outbox'][0]['status']='DELIVERY_UNKNOWN'
        with self.assertRaisesRegex(AssertionError,'UNEXPECTED_DUE_OR_UNRESOLVED'): module.validate_scope(baseline,baseline)
    def test_requires_two_distinct_completed_new_invocations(self):
        unit={'ExecMainStartTimestampMonotonic':'20','InvocationID':'a'*32,'ActiveState':'inactive','Result':'success','ExecMainStatus':'0'}
        self.assertTrue(module.cycle_complete(unit,10,[]))
        self.assertFalse(module.cycle_complete(unit,20,[]))
        self.assertFalse(module.cycle_complete(unit,10,['a'*32]))
        self.assertFalse(module.cycle_complete({**unit,'ActiveState':'active'},10,[]))
        self.assertFalse(module.cycle_complete({**unit,'ExecMainStatus':'1'},10,[]))
        self.assertFalse(module.cycle_complete({**unit,'InvocationID':''},10,[]))

if __name__=='__main__': unittest.main(verbosity=2)
