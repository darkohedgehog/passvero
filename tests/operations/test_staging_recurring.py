"""Changed orchestration: drain/resume, attempt bounds, freshness and selector."""
import importlib.util
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).parents[2] / 'scripts/staging-recovery/recurring.py'


class RecurringTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('recurring', PATH)
        cls.m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.m)

    def test_attempt_reservation_stops_after_two_and_never_refills(self):
        m = self.m
        with tempfile.TemporaryDirectory() as folder:
            path = pathlib.Path(folder)/'state.json'
            m.atomic(path, {'mode': 'ACCEPTANCE', 'attempts': 0, 'hold': False})
            self.assertEqual(m.reserve_attempt(path, 'one')['attempts'], 1)
            self.assertEqual(m.reserve_attempt(path, 'two')['attempts'], 2)
            with self.assertRaisesRegex(m.Stop, 'ACCEPTANCE_CAPTURE_BUDGET'):
                m.reserve_attempt(path, 'three')
            self.assertEqual(m.read(path)['attempts'], 2)

    def test_failed_attempt_holds_all_future_capture(self):
        m = self.m
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/'state.json'
            m.atomic(path, {'mode':'CONTINUOUS','attempts':8,'hold':True})
            with self.assertRaisesRegex(m.Stop, 'CAPTURE_ON_HOLD'):
                m.reserve_attempt(path, 'next')
            self.assertEqual(m.read(path)['attempts'], 8)

    def test_drain_does_not_kill_worker_or_mutate_timer_enablement(self):
        m=self.m; actions=[]; states=iter(['active','inactive'])
        def unit(name):
            return {'ActiveState':next(states),'UnitFileState':'static'} if name.endswith('.service') else {'ActiveState':'active','UnitFileState':'enabled'}
        with tempfile.TemporaryDirectory() as folder, patch.object(m,'unit',side_effect=unit), patch.object(m,'ctl',side_effect=lambda *args:actions.append(args)), patch.object(m.time,'sleep'):
            control=pathlib.Path(folder)
            m.quiesce(control)
            self.assertEqual(actions, [('stop', m.REMINDER_TIMER)])
            self.assertTrue(m.read(control/'writer-baseline.json')['timerActive'])
            self.assertFalse((control/'pause-intent.json').exists())

    def test_disabled_timer_is_not_enabled_by_resume(self):
        m=self.m; actions=[]
        with tempfile.TemporaryDirectory() as folder, patch.object(m,'ctl',side_effect=lambda *args:actions.append(args)), patch.object(m,'unit',return_value={'ActiveState':'inactive','UnitFileState':'disabled'}):
            control=pathlib.Path(folder)
            m.atomic(control/'writer-baseline.json', {'timerActive':False,'timerEnabled':False})
            m.resume_timer(control)
            self.assertEqual(actions, [])

    def test_timeout_preserves_resume_baseline_and_never_pauses_web(self):
        m=self.m; actions=[]
        def unit(name):return {'ActiveState':'active','UnitFileState':'enabled' if name.endswith('.timer') else 'static'}
        with tempfile.TemporaryDirectory() as folder, patch.object(m,'unit',side_effect=unit), patch.object(m,'ctl',side_effect=lambda *args:actions.append(args)), patch.object(m.time,'monotonic',side_effect=[0,241]):
            control=pathlib.Path(folder)
            with self.assertRaisesRegex(m.Stop,'REMINDER_DRAIN_TIMEOUT'):m.quiesce(control)
            self.assertTrue((control/'writer-baseline.json').exists())
            self.assertFalse((control/'pause-intent.json').exists())
            self.assertEqual(actions,[('stop',m.REMINDER_TIMER)])

    def test_signal_distinguishes_failure_missing_incomplete_stale(self):
        m=self.m
        cases=[({'failure':{'reason':'FAIL'}},'BACKUP_FAILED'),
               ({},'VALID_SET_MISSING'),
               ({'attempt':{'complete':False}},'SET_INCOMPLETE'),
               ({'valid':{'captureEpoch':100,'snapshotId':'a'*64}},'SET_STALE')]
        for state,want in cases:
            with self.subTest(want=want):self.assertEqual(m.signal(state,90201),want)
        self.assertEqual(m.signal({'valid':{'captureEpoch':201,'snapshotId':'a'*64}},90201),'HEALTHY')
        self.assertEqual(m.signal({'valid':{'captureEpoch':90202,'snapshotId':'a'*64}},90201),'CLOCK_INVALID')

    def test_unknown_alert_is_reserved_before_io_and_not_retried(self):
        m=self.m
        with tempfile.TemporaryDirectory() as folder:
            path=pathlib.Path(folder)/'alert.json'
            self.assertTrue(m.reserve_alert(path,'SET_STALE','snapshot',100))
            self.assertEqual(m.read(path)['delivery'],'UNKNOWN')
            self.assertFalse(m.reserve_alert(path,'SET_STALE','snapshot',999999))

    def test_selector_rejects_production_and_mixed_paths(self):
        m=self.m
        row={'id':'a'*64,'hostname':'passvero-staging-recovery','tags':['passvero-staging-recovery'],'paths':['/var/lib/passvero-staging-recovery/sets/20261010T043000Z']}
        self.assertEqual(m.select_snapshots([row])[0]['id'],'a'*64)
        for key,bad in [('hostname','passvero-production'),('paths',['/var/lib/passvero-backup']),('tags',['passvero-postgresql'])]:
            with self.subTest(key=key),self.assertRaises(m.Stop):m.select_snapshots([dict(row,**{key:bad})])

    def test_timeout_reason_is_saved_before_independent_resume(self):
        m=self.m
        with tempfile.TemporaryDirectory() as folder, patch.object(m,'STATE',pathlib.Path(folder)), patch.dict(m.os.environ,{'SERVICE_RESULT':'timeout'}):
            state=pathlib.Path(folder)
            m.atomic(state/'state.json',{'hold':False,'attempt':{'setId':'new','complete':False}})
            m.atomic(state/'active.json',{'setId':'new'})
            def resume(*_):
                saved=m.read(state/'state.json')
                self.assertTrue(saved['hold'])
                self.assertEqual(saved['failure']['reason'],'timeout')
            with patch.object(m,'contexts',return_value=(state,state)),patch.object(m,'resume',side_effect=resume):
                m.post({})

    def test_unapproved_test_message_does_not_reserve_or_send(self):
        m=self.m
        with patch.object(m,'reserve_alert') as reserve,patch.object(m,'telegram') as send:
            with self.assertRaisesRegex(m.Stop,'TEST_TELEGRAM_NOT_APPROVED'):
                m.monitor({'testTelegramApproved':False},{},test=True)
            reserve.assert_not_called();send.assert_not_called()

    def test_web_readiness_failure_still_restores_reminder_timer(self):
        m=self.m
        with tempfile.TemporaryDirectory() as folder:
            control=pathlib.Path(folder);m.atomic(control/'pause-intent.json',{'monotonic':1})
            prepare=types.SimpleNamespace(runtime=lambda:(_ for _ in ()).throw(RuntimeError('not ready')))
            cap=types.SimpleNamespace(monitor=lambda _:{'status':'online'})
            with patch.object(m,'contexts',return_value=(control,control)),patch.object(m,'resume_timer') as restore,patch.object(m.time,'monotonic',side_effect=[10,16]),patch.dict(m.os.environ,{'SERVICE_RESULT':'success'}):
                with self.assertRaisesRegex(m.Stop,'WEB_RESUME_NOT_READY'):
                    m.resume('new',{'prepare':prepare,'capture':cap})
                restore.assert_called_once_with(control)
                self.assertFalse((control/'closure.json').exists())

    def test_acceptance_budget_skip_does_not_create_failure_or_resume_again(self):
        m=self.m
        with patch.dict(m.os.environ,{'SERVICE_RESULT':'exec-condition'}),patch.object(m,'read') as read,patch.object(m,'resume') as resume:
            m.post({})
            read.assert_not_called();resume.assert_not_called()

    def scheduled_fixture(self, folder, replies):
        m=self.m
        m.PHASE='SCOPE'
        state=pathlib.Path(folder)/'state.json'
        m.atomic(state,{'mode':'ACCEPTANCE','attempts':0,'hold':False,'completed':[]})
        invocation='4e7a0623a33b44b5989419d9cb0e2aa4'
        service={'InvocationID':invocation,'ExecMainStartTimestampMonotonic':'738347225648'}
        timer={'LastTriggerUSecMonotonic':'1w 1d 13h 5min 47.034136s'}
        calls=[]
        def command(args,**_):
            calls.append(args)
            if 'GetUnit' in args:
                return b'o "/org/freedesktop/systemd1/unit/test"'
            return next(replies)
        return state,invocation,service,timer,calls,command

    def test_recorded_formatted_timer_uses_typed_dbus_before_one_reservation(self):
        m=self.m
        with tempfile.TemporaryDirectory() as folder:
            state,invocation,service,timer,calls,command=self.scheduled_fixture(folder,iter([b't 738347225648',b't 738347034136']))
            with patch.object(m,'STATE',pathlib.Path(folder)),patch.object(m,'unit',side_effect=lambda name:service if name.endswith('.service') else timer),patch.object(m,'command',side_effect=command),patch.object(m.time,'monotonic',return_value=738348),patch.dict(m.os.environ,{'INVOCATION_ID':invocation}),patch.object(m,'stage_bytes',side_effect=RuntimeError('TEST_STOP_AFTER_RESERVATION')):
                try:m.scheduled({}, {})
                except Exception as error:observed=str(error)
                else:observed='UNEXPECTED_COMPLETION'
            self.assertEqual(observed,'TEST_STOP_AFTER_RESERVATION')
            self.assertEqual(m.read(state)['attempts'],1)
            self.assertFalse(m.read(state)['attempt']['complete'])
            reads=[args for args in calls if 'get-property' in args]
            self.assertEqual([args[-2:] for args in reads],[['org.freedesktop.systemd1.Service','ExecMainStartTimestampMonotonic'],['org.freedesktop.systemd1.Timer','LastTriggerUSecMonotonic']])

    def test_invalid_typed_timer_has_precise_code_without_reservation(self):
        m=self.m
        with tempfile.TemporaryDirectory() as folder:
            state,invocation,service,timer,calls,command=self.scheduled_fixture(folder,iter([b't 738347225648',b's "1w 1d"']))
            with patch.object(m,'STATE',pathlib.Path(folder)),patch.object(m,'unit',side_effect=lambda name:service if name.endswith('.service') else timer),patch.object(m,'command',side_effect=command),patch.object(m.time,'monotonic',return_value=738348),patch.dict(m.os.environ,{'INVOCATION_ID':invocation}),patch.object(m,'stage_bytes') as stage:
                try:m.scheduled({}, {})
                except Exception as error:observed=str(error)
                else:observed='UNEXPECTED_COMPLETION'
                stage.assert_not_called()
            self.assertEqual(observed,'TIMER_TRIGGER_MONOTONIC_INVALID')
            self.assertEqual(m.PHASE,'TIMER_INVOCATION_PRE_RESERVATION')
            self.assertEqual(m.read(state)['attempts'],0)

    def test_typed_read_failure_has_property_code(self):
        m=self.m
        with patch.object(m,'command',side_effect=m.Stop('COMMAND_FAILED')):
            with self.assertRaisesRegex(m.Stop,'TIMER_TRIGGER_MONOTONIC_READ_FAILED'):
                m.monotonic_microseconds('passvero-staging-backup.timer','org.freedesktop.systemd1.Timer',
                                         'LastTriggerUSecMonotonic','TIMER_TRIGGER_MONOTONIC')

    def test_typed_timestamp_rejects_zero_overflow_and_wrong_bus_type(self):
        m=self.m
        for reply in (b't 0',b't 18446744073709551616',b'x 738347034136'):
            with self.subTest(reply=reply),patch.object(m,'command',side_effect=[b'o "/org/freedesktop/systemd1/unit/test"',reply]):
                with self.assertRaisesRegex(m.Stop,'TIMER_TRIGGER_MONOTONIC_INVALID'):
                    m.monotonic_microseconds('passvero-staging-backup.timer','org.freedesktop.systemd1.Timer',
                                             'LastTriggerUSecMonotonic','TIMER_TRIGGER_MONOTONIC')

    def test_identity_delay_and_age_guards_still_stop_before_reservation(self):
        m=self.m
        for delay,now,wrong_identity in ((6000000,738348,False),(191512,738379,False),(191512,738348,True)):
            with self.subTest(delay=delay,now=now,identity=wrong_identity),tempfile.TemporaryDirectory() as folder:
                trigger=738347034136
                state,invocation,service,timer,calls,command=self.scheduled_fixture(folder,iter([
                    ('t '+str(trigger+delay)).encode(),('t '+str(trigger)).encode()]))
                with patch.object(m,'STATE',pathlib.Path(folder)),patch.object(m,'unit',return_value=service),patch.object(m,'command',side_effect=command),patch.object(m.time,'monotonic',return_value=now),patch.dict(m.os.environ,{'INVOCATION_ID':'a'*32 if wrong_identity else invocation}),patch.object(m,'stage_bytes') as stage:
                    with self.assertRaisesRegex(m.Stop,'ORDINARY_TIMER_INVOCATION_REQUIRED'):
                        m.scheduled({}, {})
                    stage.assert_not_called()
                self.assertEqual(m.read(state)['attempts'],0)


if __name__=='__main__':unittest.main()
