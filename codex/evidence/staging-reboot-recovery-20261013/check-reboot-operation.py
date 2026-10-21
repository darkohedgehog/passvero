"""Targeted local checks. Every unmocked subprocess is forbidden."""
import ast
import contextlib
import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch

HERE = pathlib.Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('reviewed_reboot_operation', HERE / 'reboot-reviewed.py')
h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)


class OperationChecks(unittest.TestCase):
    def setUp(self):
        guard = patch.object(h.subprocess, 'run', side_effect=AssertionError('UNMOCKED_VPS_COMMAND'))
        guard.start(); self.addCleanup(guard.stop)

    def test_exact_window_and_deadline(self):
        h.inside_start_window(h.START); h.inside_start_window(h.START + 60)
        for now in (h.START - 1, h.START + 61):
            with self.assertRaises(RuntimeError): h.inside_start_window(now)
        with patch.object(h, 'data', return_value={'t0': h.START}), patch.object(h.time, 'time', return_value=h.END+1):
            with self.assertRaisesRegex(RuntimeError, 'MAINTENANCE_WINDOW_ELAPSED'): h.elapsed(1800)

    def test_nginx_matching_requires_same_tls_server_block(self):
        good = 'server { listen 443 ssl; server_name passvero.eu www.passvero.eu; location / { proxy_pass http://127.0.0.1:3000; } }'
        self.assertEqual(h.nginx_target(good)['origin'], 'https://passvero.eu/')
        cross = 'server { listen 443 ssl; server_name passvero.eu; } server { listen 443 ssl; server_name other.eu; proxy_pass http://127.0.0.1:3000; }'
        for text in (cross, good.replace('3000','3001'), good.replace('443 ssl','80'), good.replace('passvero.eu','example.eu')):
            with self.assertRaises(RuntimeError): h.nginx_target(text)
        wrong_root = 'server {listen 443 ssl; server_name passvero.eu; location / {proxy_pass http://127.0.0.1:3009;} location /api {proxy_pass http://127.0.0.1:3000;}}'
        with self.assertRaises(RuntimeError): h.nginx_target(wrong_root)

    def test_production_timer_is_only_read_and_conflicting_due_stops(self):
        deploy = type('Deploy', (), {'timer_due': lambda self,name:5000})()
        with patch.object(h,'unit',return_value={'ActiveState':'active','UnitFileState':'enabled'}), \
             patch.object(h.time,'time',return_value=1000):
            self.assertFalse(h.production_job_window(deploy)['changed'])
            with patch.object(h.time,'time',return_value=4500):
                with self.assertRaisesRegex(RuntimeError,'PRODUCTION_BACKUP_TERM_CONFLICT'):
                    h.production_job_window(deploy)

    def test_record_never_overwrites_history(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(h, 'ROOT', pathlib.Path(directory)):
            h.record('attempt.json', {'request': 1})
            with self.assertRaises(FileExistsError): h.record('attempt.json', {'request': 2})
            self.assertEqual(h.data('attempt.json'), {'request': 1})

    def test_healthy_artifact_cannot_be_rolled_back_for_unrelated_failure(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(h,'ROOT',pathlib.Path(directory)), \
             patch.object(h,'components',return_value=(None,None,None)), patch.object(h,'unchanged'), \
             patch.object(h,'CANONICAL_PIN',h.sha(b'canonical')), patch.object(h,'CONFIG_PIN',h.sha(b'config')), \
             patch.object(h,'read',side_effect=lambda path: b'canonical' if path==h.CANONICAL else b'config'), \
             patch.object(h,'release'), patch.object(h,'run') as commands:
            (pathlib.Path(directory)/'first-failure.json').write_text('{}')
            with self.assertRaisesRegex(RuntimeError,'NO_EXECUTABLE_ARTIFACT_FAULT'):
                h.paired_rollback()
            commands.assert_not_called()
            self.assertFalse((pathlib.Path(directory)/'paired-rollback-attempt.json').exists())

    def test_reboot_existing_intent_cannot_issue_second_request(self):
        with tempfile.TemporaryDirectory() as directory, patch.object(h, 'ROOT', pathlib.Path(directory)):
            h.record('quiesced.json', {}); h.record('reboot-intent.json', {'requests': 1})
            base = type('Base', (), {})(); deploy = type('Deploy', (), {})()
            with patch.object(h, 'components', return_value=(base,None,deploy)), patch.object(h, 'elapsed'), \
                 patch.object(h, 'unchanged'), patch.object(h, 'release'), patch.object(h, 'idle'), \
                 patch.object(h, 'locked', side_effect=lambda _: contextlib.nullcontext()), \
                 patch.object(h, 'boot_id', return_value='same'), patch.object(h.time,'time',return_value=h.START+1), \
                 patch.object(h, 'unit', return_value={'ActiveState':'inactive','UnitFileState':'disabled'}), \
                 patch.object(h, 'run') as run:
                with self.assertRaises(FileExistsError): h.reboot()
                run.assert_not_called()

    def test_failed_app_closure_restores_monitor_using_saved_due_not_disabled_zero(self):
        now = 1000
        config = b'config'; state = b'state'
        baseline = {'t0':now,'timers':{name:{'UnitFileState':'enabled'} for name in h.TIMERS},
            'due':{name:now+3600 for name in h.TIMERS[:2]},'backupSha256':h.sha(state),'delivery':{'hash':'same'}}
        statuses = {name:{'ActiveState':'inactive','UnitFileState':'disabled'} for name in h.TIMERS}
        def enable(args, **options):
            self.assertEqual(args[:3], ['/usr/bin/systemctl','enable','--now'])
            statuses[args[3]]={'ActiveState':'active','UnitFileState':'enabled'}
            return ''
        class Base:
            def runtime(self): raise RuntimeError('APP_DOWN')
        class Deploy:
            OLD_CONFIG='old'
            def idle(self): pass
            def timer_due(self,name): return baseline['due'][name] if statuses[name]['ActiveState']=='active' else 0
        with tempfile.TemporaryDirectory() as directory, patch.object(h,'ROOT',pathlib.Path(directory)), \
             patch.object(h,'CONFIG_PIN',h.sha(config)), patch.object(h,'components',return_value=(Base(),None,Deploy())), \
             patch.object(h,'release'), patch.object(h,'delivery',return_value=baseline['delivery']), \
             patch.object(h,'production',return_value={'units':{}}), \
             patch.object(h,'scanner_module',side_effect=RuntimeError('READER_UNAVAILABLE')), \
             patch.object(h,'locked',side_effect=lambda _:contextlib.nullcontext()), \
             patch.object(h,'unit',side_effect=lambda name:statuses.get(name,{'ActiveState':'inactive'})), \
             patch.object(h,'run',side_effect=enable) as calls, patch.object(h.time,'time',return_value=now):
            h.record('baseline.json',baseline)
            real_read=h.read
            def read(path):
                if path==h.CODE/'config.json': return config
                if path==h.BACKUP/'state.json': return state
                return real_read(path)
            with patch.object(h,'read',side_effect=read): result=h.close()
            self.assertEqual(result['closure'],'PARTIAL_AUTOMATION_RESTORE')
            self.assertEqual(result['restored'],[h.TIMERS[1]])
            self.assertIn(h.TIMERS[2],result['pending'])
            self.assertTrue(result['backupStateUnchanged'])
            self.assertEqual(calls.call_count,1)

    def test_source_keeps_single_budget_and_independent_stop_post(self):
        source=(HERE/'reboot-reviewed.py').read_text()
        self.assertIn("'--property=Restart=no'",source)
        self.assertIn("'--property=ExecStopPost=/usr/bin/python3 -I -B '",source)
        self.assertIn("'SCANNER_' + phase",source)
        self.assertNotIn("'--scheduled'",source)
        self.assertNotIn("'--monitor'",source)
        self.assertNotIn("'--telegram-test'",source)
        self.assertNotIn('pg_restore',source)
        self.assertNotIn('initdb',source)
        self.assertEqual(source.count("run(['/usr/bin/systemctl', 'reboot']"),1)
        candidate=(HERE/'recover-release-reviewed.py').read_bytes()
        old=(HERE.parents[2]/'scripts/recover-document-signature-health.py').read_bytes()
        self.assertEqual(candidate,old.replace(b"'8QNIYVVZWEsQaCL9uLZ5Q'",b"'_tkSUOn0PCoHjpx8V7FVr'"))


if __name__=='__main__': unittest.main()
