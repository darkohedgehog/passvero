"""Local systemd doubles only; no live systemd, SSH or sending calls."""
import contextlib
import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('trigger_guard_candidate', HERE/'reboot-reviewed.py')
h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
TIMER = h.TIMERS[2]
SERVICE = 'passvero-subscription-reminders.service'


class TriggerGuardChecks(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.root = pathlib.Path(self.temp.name)
        self.status = {name: {'Id': name, 'LoadState': 'loaded', 'ActiveState': 'active',
            'SubState': 'waiting', 'UnitFileState': 'enabled', 'TriggeredBy': '',
            'FragmentPath': '/etc/systemd/system/'+name} for name in h.TIMERS}
        self.status[SERVICE] = {'Id': SERVICE, 'LoadState': 'loaded', 'ActiveState': 'inactive',
            'SubState': 'dead', 'UnitFileState': 'static', 'TriggeredBy': TIMER,
            'FragmentPath': '/etc/systemd/system/'+SERVICE}
        self.extra = {TIMER: {'Triggers': SERVICE, 'DropInPaths': ''},
                      SERVICE: {'Triggers': '', 'DropInPaths': '', 'MainPID': '0'}}
        self.commands = []; self.paused_trigger = ''; self.failed_pause = False
        self.base = type('Base', (), {'jobs': lambda _: None,
            'reminders': lambda _: {'safeToFinalizePause': True}, 'runtime': lambda _: None})()
        self.deploy = type('Deploy', (), {'idle': lambda _: None,
            'timer_due': lambda _, name: h.START+7200})()
        self.pins = {'service': '256207cc6675d90956b135c4e4a07938ea0fde5749659a2416a7c35ea9fb56cc',
                     'timer': '585a8e11b9279ab5b3c8b82ba0215eb85e03c43ae887654fc8e3ed8d177335ab'}
        real_sha = h.sha
        def digest(body):
            return self.pins[body.decode()] if body in (b'service', b'timer') else real_sha(body)
        real_read = h.read
        def read(path):
            if path == h.BACKUP/'state.json': return b'state'
            if str(path).startswith('/etc/systemd/system/passvero-subscription-reminders.'):
                return path.suffix[1:].encode()
            if 'dump.pm2' in str(path): return b'dump'
            if path == h.CODE/'config.json': return b'config'
            return real_read(path)
        patches = [patch.object(h.subprocess, 'run', side_effect=AssertionError('LIVE_CALL_FORBIDDEN')),
            patch.object(h, 'ROOT', self.root), patch.object(h,'components',return_value=(self.base,None,self.deploy)),
            patch.object(h,'unit',side_effect=lambda name: dict(self.status.get(name, {'ActiveState':'inactive'}))),
            patch.object(h,'run',side_effect=self.command), patch.object(h,'read',side_effect=read),
            patch.object(h,'sha',side_effect=digest), patch.object(h,'release'),
            patch.object(h,'locked',side_effect=lambda _:contextlib.nullcontext()),
            patch.object(h,'inside_start_window'), patch.object(h,'boot_id',return_value='same-boot'),
            patch.object(h,'production_job_window'), patch.object(h,'production',return_value={'units':{}}),
            patch.object(h,'delivery',return_value={'same':'metadata'}),
            patch.object(h.time,'time',return_value=h.START+1), patch.object(h,'CONFIG_PIN',real_sha(b'config')),
            patch.object(h,'http',return_value='200 0'), patch.object(h,'scanner_module',side_effect=RuntimeError('NO_FLOW'))]
        for item in patches:
            item.start(); self.addCleanup(item.stop)
        h.record('preflight.json', {'observedEpoch':h.START,
            'timers':{name:dict(self.status[name]) for name in h.TIMERS},
            'backup':{'sha256':real_sha(b'state')}, 'production':{'units':{}}})
        patcher=patch.object(h,'due',return_value={name:h.START+7200 for name in h.TIMERS[:2]})
        patcher.start();self.addCleanup(patcher.stop)

    def command(self,args,**options):
        self.commands.append(args)
        if args[:2] == ['/usr/bin/systemctl','show']:
            name=args[2]; return '\n'.join(key+'='+value for key,value in self.extra[name].items())
        if args[:3] == ['/usr/bin/systemctl','disable','--now']:
            name=args[3]
            if not (self.failed_pause and name==TIMER):
                self.status[name].update(ActiveState='inactive',SubState='dead',UnitFileState='disabled')
            if name==TIMER: self.status[SERVICE]['TriggeredBy']=self.paused_trigger
            return ''
        if args[:3] == ['/usr/bin/systemctl','enable','--now']:
            self.status[args[3]].update(ActiveState='active',SubState='waiting',UnitFileState='enabled'); return ''
        raise AssertionError('UNREVIEWED_COMMAND '+repr(args))

    def test_saved_post_pause_rejection_now_quiesces_with_empty_runtime_relation(self):
        self.assertEqual(h.quiesce()['result'],'QUIESCED')
        self.assertEqual(h.data('baseline.json')['bootId'],'same-boot')
        self.assertEqual(len([a for a in self.commands if 'disable' in a]),3)

    def test_pause_with_retained_static_relation_is_accepted(self):
        self.paused_trigger=TIMER
        self.assertEqual(h.quiesce()['result'],'QUIESCED')

    def test_baseline_requires_enabled_timer_and_exact_trigger(self):
        h.idle(self.base,self.deploy)
        for change in ({'TriggeredBy':''},{'TriggeredBy':'unexpected.path'}):
            self.status[SERVICE].update(change)
            with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)
        self.status[SERVICE]['TriggeredBy']=TIMER
        self.status[TIMER]['UnitFileState']='disabled'
        with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)

    def test_failed_pause_preserves_baseline_and_closure(self):
        self.failed_pause=True
        with self.assertRaises(RuntimeError): h.quiesce()
        self.assertFalse((self.root/'quiesced.json').exists())
        result=h.close()
        self.assertIn(h.TIMERS[0],result['restored']); self.assertIn(h.TIMERS[1],result['restored'])
        self.assertIn(TIMER,result['pending']); self.assertTrue(result['backupStateUnchanged'])

    def test_unexpected_post_pause_trigger_rejected_and_closure_available(self):
        self.paused_trigger='unreviewed.timer'
        with self.assertRaisesRegex(RuntimeError,'UNREVIEWED_SENDING_TRIGGER'): h.quiesce()
        self.assertFalse((self.root/'quiesced.json').exists())
        self.assertEqual(h.close()['closure'],'PARTIAL_AUTOMATION_RESTORE')

    def test_active_worker_and_incomplete_or_changed_static_inputs_stop(self):
        for key,value in [('MainPID','99'),('MainPID',''),('DropInPaths','/tmp/override.conf')]:
            with self.subTest(key=key,value=value):
                old=self.extra[SERVICE][key];self.extra[SERVICE][key]=value
                with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)
                self.extra[SERVICE][key]=old
        self.extra[TIMER]['Triggers']='other.service'
        with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)
        self.extra[TIMER]['Triggers']=SERVICE
        self.status[SERVICE]['ActiveState']='active'
        with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)
        self.status[SERVICE]['ActiveState']='inactive'
        self.pins['timer']='0'*64
        with self.assertRaises(RuntimeError): h.idle(self.base,self.deploy)


if __name__=='__main__': unittest.main()
