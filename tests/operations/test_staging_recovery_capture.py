"""Synthetic capture/guard fixtures; never invoke systemd, live PG, PM2 or Storage."""
import contextlib
import ast
import base64
import gzip
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[2] / 'scripts/staging-recovery/capture.py'
SPEC = importlib.util.spec_from_file_location('capture', PATH)
CAP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(CAP)
SPEC2 = importlib.util.spec_from_file_location('references', PATH.with_name('reference_preflight.py'))
REF = importlib.util.module_from_spec(SPEC2)
SPEC2.loader.exec_module(REF)


class CaptureTests(unittest.TestCase):
    def test_draft_additional_installer_matches_source_and_stops_on_consumed_extra_claim(self):
        text = (PATH.parents[2] / 'docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md').read_text()
        snippet = text.split("<<'PY_ADDITIONAL_CAPTURE'\n", 1)[1].split('PY_ADDITIONAL_CAPTURE\n', 1)[0]
        historical = text.split("<<'PY_APPROVED_CAPTURE'\n", 1)[1].split('PY_APPROVED_CAPTURE\n', 1)[0]
        payloads = next(ast.literal_eval(item.value) for item in ast.parse(historical).body
                        if isinstance(item, ast.Assign) and any(isinstance(target, ast.Name) and
                        target.id == 'PAYLOADS' for target in item.targets))
        original_lstat = pathlib.Path.lstat
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);(root / 'operator').mkdir(mode=0o700)
            (root / 'operator.identity.json').write_text(json.dumps({'schema': 1, 'scope': 'passvero-staging-recovery-v1'}))
            first = root / CAP.FIRST_CLAIM
            first.write_text(json.dumps({'setId': CAP.FAILED_SET,
                'unit': 'passvero-stage-capture-' + CAP.FAILED_SET + '.service'}))
            prep = root / 'operator' / ('prepare-' + CAP.PREP_PIN + '.py')
            prep.write_bytes(PATH.with_name('prepare.py').read_bytes())
            for name, pin, encoded in payloads:
                (root / 'operator' / (name + '-' + pin + '.py')).write_bytes(
                    gzip.decompress(base64.b64decode(encoded)))
            for path in root.rglob('*'):
                if path.is_file():path.chmod(0o600)
            initial = {str(path): path.read_bytes() for path in root.rglob('*') if path.is_file()}
            snippet = snippet.replace("pathlib.Path('/var/lib/passvero-staging-recovery')", 'pathlib.Path(' + repr(folder) + ')')
            stack.enter_context(patch.object(os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(pathlib.Path, 'lstat', lambda p: types.SimpleNamespace(
                st_uid=0, st_mode=original_lstat(p).st_mode)))
            execute = stack.enter_context(patch.object(os, 'execv'))
            mask = os.umask(0o077)
            try:
                with contextlib.redirect_stdout(io.StringIO()):exec(compile(snippet, 'draft-installer-fixture', 'exec'), {})
                pin = hashlib.sha256(PATH.read_bytes()).hexdigest()
                target = root / 'operator' / ('capture-' + pin + '.py')
                self.assertEqual(target.read_bytes(), PATH.read_bytes())
                self.assertEqual(execute.call_args.args[1][-1], '--launch-additional-after-20261001T203612Z')
                for path, body in initial.items():self.assertEqual(pathlib.Path(path).read_bytes(), body)
                (root / CAP.ADDITIONAL_CLAIM).write_text('{}')
                execute.reset_mock()
                with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
                    exec(compile(snippet, 'draft-installer-fixture', 'exec'), {})
                execute.assert_not_called()
                for path, body in initial.items():self.assertEqual(pathlib.Path(path).read_bytes(), body)
            finally:os.umask(mask)

    def test_mac_clipboard_handoff_reads_exact_marked_block_without_running_server(self):
        runbook = PATH.parents[2] / 'docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md'
        text = runbook.read_text()
        snippet = text.split("<<'PY_COPY_APPROVED_CAPTURE'\n", 1)[1].split('PY_COPY_APPROVED_CAPTURE\n', 1)[0]
        clipboard = []
        def run(args, **kwargs):
            if args == ['/usr/bin/pbcopy']:
                clipboard.append(kwargs['input'])
                return types.SimpleNamespace(returncode=0)
            self.assertEqual(args, ['/usr/bin/pbpaste'])
            return types.SimpleNamespace(stdout=clipboard[0], returncode=0)
        with patch.object(subprocess, 'run', side_effect=run), contextlib.redirect_stdout(io.StringIO()):
            exec(compile(snippet, 'mac-handoff-fixture', 'exec'), {})
        self.assertEqual(len(clipboard), 1)
        self.assertTrue(clipboard[0].startswith(b'sudo /usr/bin/python3 -B - '))
        self.assertTrue(clipboard[0].endswith(b'PY_APPROVED_CAPTURE\n'))

    def test_embedded_installer_matches_reviewed_sources_and_preserves_one_pause_claim(self):
        runbook = PATH.parents[2] / 'docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md'
        block = runbook.read_text().split('\n<!-- BEGIN APPROVED_CAPTURE_VPS -->\n', 1)[1].split(
            '\n<!-- END APPROVED_CAPTURE_VPS -->', 1)[0].split('```sh\n', 1)[1].rsplit('```', 1)[0]
        installer = block.split("<<'PY_APPROVED_CAPTURE'\n", 1)[1].rsplit('PY_APPROVED_CAPTURE\n', 1)[0]
        compile(installer, 'embedded-installer', 'exec')
        original_lstat = pathlib.Path.lstat
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder)
            (root / 'operator').mkdir(mode=0o700)
            pin = CAP.PREP_PIN
            prior = root / 'operator' / ('prepare-' + pin + '.py')
            prior.write_bytes(PATH.with_name('prepare.py').read_bytes());prior.chmod(0o600)
            identity = root / 'operator.identity.json'
            identity.write_text(json.dumps({'schema':1,'scope':'passvero-staging-recovery-v1'}));identity.chmod(0o600)
            installer = installer.replace("pathlib.Path('/var/lib/passvero-staging-recovery')", 'pathlib.Path(' + repr(folder) + ')')
            stack.enter_context(patch.object(os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(pathlib.Path, 'lstat', lambda p: types.SimpleNamespace(
                st_uid=0, st_mode=original_lstat(p).st_mode)))
            execute = stack.enter_context(patch.object(os, 'execv'))
            mask = os.umask(0o077)
            try:
                with contextlib.redirect_stdout(io.StringIO()):exec(compile(installer, 'fixture-installer', 'exec'), {})
                cap_pin = '0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
                source = (root / 'operator' / ('capture-' + cap_pin + '.py')).read_bytes()
                self.assertEqual(hashlib.sha256(source).hexdigest(), cap_pin)
                # The retained historical installer is the failed reviewed version.
                # The parser correction and explicitly gated continuation differ.
                # The original capture transaction, guard and resume stay identical.
                def without_parser(body):
                    tree = ast.parse(body)
                    changed = {'launch', 'main', 'prepare_set', 'retained_failure', 'measure_current_dump'}
                    tree.body = [item for item in tree.body if not (
                        isinstance(item, ast.FunctionDef) and item.name in changed) and not (
                        isinstance(item, ast.Assign) and any(isinstance(target, ast.Name) and
                        target.id in {'FAILED_SET', 'FIRST_CLAIM', 'ADDITIONAL_CLAIM'} for target in item.targets))]
                    for statement in tree.body:
                        if isinstance(statement, ast.FunctionDef) and statement.name == 'capture':
                            # Everything from applied guard validation onward is unchanged.
                            start = next(i for i, item in enumerate(statement.body) if isinstance(item, ast.Expr)
                                         and isinstance(item.value, ast.Call) and isinstance(item.value.func, ast.Name)
                                         and item.value.func.id == 'guard_properties')
                            statement.body = statement.body[start:]
                        if isinstance(statement, ast.ClassDef) and statement.name == 'Snapshot':
                            for method in statement.body:
                                if isinstance(method, ast.FunctionDef) and method.name == 'q':
                                    method.body = []
                    return ast.dump(tree)
                self.assertEqual(without_parser(source), without_parser(PATH.read_bytes()))
                self.assertEqual((root / 'operator' / ('references-' + CAP.REF_PIN + '.py')).read_bytes(),
                                 PATH.with_name('reference_preflight.py').read_bytes())
                self.assertEqual(execute.call_args.args[1][-1], '--launch')
                (root / 'one-pause-approved-20261001.json').write_text('{}')
                execute.reset_mock()
                with contextlib.redirect_stdout(io.StringIO()), self.assertRaises(SystemExit):
                    exec(compile(installer, 'fixture-installer', 'exec'), {})
                execute.assert_not_called()
                self.assertTrue(prior.exists())
            finally:os.umask(mask)

    def test_retained_failure_requires_exact_closed_failure_and_accepted_guard(self):
        unit = 'passvero-stage-capture-' + CAP.FAILED_SET + '.service'
        closure = {'stagingPauseRequested': True, 'stagingResumed': True, 'pauseSeconds': 2.743,
                   'pm2Online': True, 'port3001Reachable': True, 'serviceResult': 'exit-code'}
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);work = root / 'set';control = root / 'control'
            work.mkdir();control.mkdir()
            values = {root / CAP.FIRST_CLAIM: {'setId': CAP.FAILED_SET, 'unit': unit},
                      control / 'failure-capture.json': {'phase': 'LOCK_AND_EXPORT_SNAPSHOT', 'reason': 'SQL_RESULT_SHAPE'},
                      control / 'closure.json': closure,
                      control / 'guard-proof.json': {'serviceResult': 'timeout', 'exitCode': 'killed', 'exitStatus': 'KILL'},
                      control / 'guard-proof-body.json': {'started': True}}
            for path, value in values.items():path.write_text(json.dumps(value))
            stack.enter_context(patch.object(CAP, 'ROOT', root))
            stack.enter_context(patch.object(CAP, 'private'))
            stack.enter_context(patch.object(CAP, 'validate_context', return_value=(work, control)))
            command = stack.enter_context(patch.object(CAP, 'command', return_value=
                b'LoadState=loaded\nActiveState=failed\nResult=exit-code\nExecMainStatus=1'))
            prior_bytes = (root / CAP.FIRST_CLAIM).read_bytes()
            self.assertEqual(CAP.retained_failure(), {'priorSetId': CAP.FAILED_SET,
                'priorClaimSha256': hashlib.sha256(prior_bytes).hexdigest()})
            for path, bad in ((root / CAP.FIRST_CLAIM, {'setId': 'other', 'unit': unit}),
                              (control / 'closure.json', dict(closure, stagingResumed=False)),
                              (control / 'guard-proof.json', {'serviceResult': 'success'}),
                              (control / 'failure-capture.json', {'phase': 'other', 'reason': 'SQL_RESULT_SHAPE'})):
                with self.subTest(path=path.name):
                    path.write_text(json.dumps(bad))
                    with self.assertRaises(CAP.Stop):CAP.retained_failure()
                    path.write_text(json.dumps(values[path]))
            command.return_value = b'LoadState=loaded\nActiveState=active\nResult=exit-code\nExecMainStatus=1'
            with self.assertRaisesRegex(CAP.Stop, 'FAILED_UNIT_NOT_CLOSED'):CAP.retained_failure()
            command.return_value = b'LoadState=loaded\nActiveState=failed\nResult=exit-code\nExecMainStatus=1'
            (work / 'recovery-set.json').write_text('{}')
            with self.assertRaisesRegex(CAP.Stop, 'FAILED_SET_HAS_CAPTURE_ARTIFACTS'):CAP.retained_failure()
            self.assertEqual((root / CAP.FIRST_CLAIM).read_bytes(), prior_bytes)

    def test_additional_launch_preserves_first_claim_reuses_guard_and_cannot_repeat(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);prior = root / CAP.FIRST_CLAIM
            prior.write_bytes(b'preserved first claim')
            retained = {'priorSetId': CAP.FAILED_SET, 'priorClaimSha256': hashlib.sha256(prior.read_bytes()).hexdigest()}
            def prepare_set(prepare, references, sid, claim_name):
                self.assertEqual(claim_name, CAP.ADDITIONAL_CLAIM)
                work = root / 'sets' / sid;control = root / 'control' / sid
                (work / 'database').mkdir(parents=True);(work / 'storage').mkdir();control.mkdir(parents=True)
                (work / 'database' / 'passvero_acceptance.dump').write_bytes(b'dump')
                CAP.write(work / 'storage' / 'manifest.json', {'references': [], 'objects': [],
                    'reconciliation': {'acceptedCleanupTombstones': []}})
                CAP.write(control / 'closure.json', {'stagingResumed': True, 'stagingPauseRequested': True,
                    'pauseSeconds': 3, 'serviceResult': 'success'})
                CAP.write(control / 'capture-core.json', {'capture': 'PASS', 'lockedTables': 51})
                return work, control
            for name, value in {'ROOT': root, 'private': lambda *args: None,
                'retained_failure': lambda: retained, 'helpers': lambda: (object(), object()),
                'prepare_set': prepare_set, 'measure_current_dump': lambda *args: None, 'gates': lambda prepare: None,
                'command': lambda *args, **kwargs: b'TOC'}.items():
                stack.enter_context(patch.object(CAP, name, value))
            stack.enter_context(patch.object(CAP.os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(CAP.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(CAP.os, 'umask'))
            runner = stack.enter_context(patch.object(CAP.subprocess, 'run', return_value=types.SimpleNamespace(returncode=0)))
            with contextlib.redirect_stdout(io.StringIO()) as output:CAP.launch(additional=True)
            summary = json.loads(output.getvalue())
            self.assertEqual(summary['independentTimeoutResumeGuard'], 'REUSED_ACCEPTED_' + CAP.FAILED_SET)
            self.assertEqual(summary['b2Transfer'], 'NOT_YET_RUN')
            self.assertEqual(runner.call_count, 1)
            self.assertNotIn('--proof-body', runner.call_args.args[0])
            claim = json.loads((root / CAP.ADDITIONAL_CLAIM).read_text())
            self.assertEqual(claim['priorClaimSha256'], retained['priorClaimSha256'])
            self.assertEqual(prior.read_bytes(), b'preserved first claim')
            runner.reset_mock()
            with self.assertRaisesRegex(CAP.Stop, 'ONE_PAUSE_ALREADY_CLAIMED'):CAP.launch(additional=True)
            runner.assert_not_called()

    def test_additional_capture_rejects_changed_first_claim_before_guard_or_pause(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);(root / CAP.FIRST_CLAIM).write_bytes(b'changed')
            selected = {'pauseClaim': CAP.ADDITIONAL_CLAIM}
            claim = {'setId': '20261001T000000Z', 'priorSetId': CAP.FAILED_SET, 'priorClaimSha256': 'wrong'}
            stack.enter_context(patch.object(CAP, 'ROOT', root))
            stack.enter_context(patch.object(CAP, 'validate_context', return_value=(root, root)))
            stack.enter_context(patch.object(CAP, 'helpers', return_value=(None, None)))
            stack.enter_context(patch.object(CAP, 'read', side_effect=[selected, claim]))
            guard = stack.enter_context(patch.object(CAP, 'guard_properties'))
            pause = stack.enter_context(patch.object(CAP, 'pm2'))
            with self.assertRaisesRegex(CAP.Stop, 'FAILED_CLAIM_CHANGED'):CAP.capture('20261001T000000Z')
            guard.assert_not_called();pause.assert_not_called()

    def test_measurement_failure_stops_additional_launch_before_claim_or_systemd(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);(root / CAP.FIRST_CLAIM).write_bytes(b'preserved')
            for name, value in {'ROOT': root, 'private': lambda *args: None,
                'retained_failure': lambda: {}, 'helpers': lambda: (None, None),
                'prepare_set': lambda *args: (root, root)}.items():
                stack.enter_context(patch.object(CAP, name, value))
            stack.enter_context(patch.object(CAP.os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(CAP.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(CAP.os, 'umask'))
            stack.enter_context(patch.object(CAP, 'measure_current_dump', side_effect=CAP.Stop('PRE_PAUSE_RESOURCE_LIMIT')))
            runner = stack.enter_context(patch.object(CAP.subprocess, 'run'))
            with self.assertRaisesRegex(CAP.Stop, 'PRE_PAUSE_RESOURCE_LIMIT'):CAP.launch(additional=True)
            runner.assert_not_called()
            self.assertFalse((root / CAP.ADDITIONAL_CLAIM).exists())
            self.assertEqual((root / CAP.FIRST_CLAIM).read_bytes(), b'preserved')

    def test_current_measurement_is_before_claim_and_never_pauses_or_uploads(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder);work = root / 'work';control = root / 'control'
            work.mkdir();control.mkdir();(work / 'object').write_bytes(b'PDF')
            stack.enter_context(patch.object(CAP, 'ROOT', root))
            stack.enter_context(patch.object(CAP.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=5 * CAP.GIB)))
            def dump(args, **kwargs):
                self.assertIn('passvero_acceptance', args)
                self.assertNotIn('--snapshot', ' '.join(args))
                self.assertEqual(kwargs['timeout'], 60)
                self.assertEqual(kwargs['env'], {'PATH': '/usr/bin:/bin', 'LANG': 'C'})
                kwargs['stdout'].write(b'measurement')
                return types.SimpleNamespace(returncode=0)
            runner = stack.enter_context(patch.object(CAP.subprocess, 'run', side_effect=dump))
            pause = stack.enter_context(patch.object(CAP, 'pm2'))
            CAP.measure_current_dump(types.SimpleNamespace(account=lambda user: {}), work, control)
            self.assertEqual(runner.call_count, 1);pause.assert_not_called()
            self.assertFalse((root / CAP.ADDITIONAL_CLAIM).exists())
            result = json.loads((control / 'measurement.json').read_text())
            self.assertEqual(result['measurementDumpBytes'], len(b'measurement'))
            self.assertFalse(result['stagingPauseRequested']);self.assertFalse(result['recoveryProof'])
            runner.reset_mock()
            with patch.object(CAP.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=3 * CAP.GIB)):
                with self.assertRaisesRegex(CAP.Stop, 'PRE_PAUSE_RESOURCE_LIMIT'):
                    CAP.measure_current_dump(None, work, control)
            runner.assert_not_called()

    def test_reminder_service_must_be_inactive_even_with_disabled_timer(self):
        prepare = types.SimpleNamespace(sql=lambda query: {'enabled':0})
        for state in ('inactive', 'active'):
            def reply(args, **kwargs):
                return state.encode() if '--value' in args else b'ActiveState=inactive\nUnitFileState=disabled'
            with patch.object(CAP, 'command', side_effect=reply):
                if state == 'inactive':CAP.gates(prepare)
                else:
                    with self.assertRaisesRegex(CAP.Stop, 'REMINDER_WORKER_SCOPE'):CAP.gates(prepare)

    def test_pm2_control_uses_existing_rpc_id_without_daemon_spawn_or_env_update(self):
        node = shutil.which('node')
        self.assertIsNotNone(node)
        for action in ('stop', 'restart'):
            with self.subTest(action=action), patch.object(CAP, 'command', return_value=b'') as call:
                CAP.pm2(types.SimpleNamespace(account=lambda user: {'user': 123}), action, 8)
                args = call.call_args.args[0]
                self.assertEqual(args[:2], ['/usr/bin/node', '-e'])
                self.assertEqual(call.call_args.kwargs['env'], {'PATH': '/usr/bin:/bin'})
                program = args[2]
            fixture = """const vm=require('vm');const events=[],calls=[];
const socket={once:(event,fn)=>events.push(fn),connect:()=>events[0](),close:()=>{}};
const Client=function(){this.call=(method,arg,cb)=>{
 if(method==='getMonitorData')return cb(null,[{name:'passvero-acceptance',pm2_env:{pm_id:4,pm_cwd:CWD}}]);
 calls.push({method,arg});cb(null);
}};
const context={require:(name)=>name.endsWith('pm2-axon')?{socket:()=>socket}:{Client},
 setTimeout:()=>{},process:{exit:(code)=>{throw {exit:code}}}};
try{vm.runInNewContext(PROGRAM,context)}catch(e){if(e.exit!==0&&e.exit!==1)throw e;}
console.log(JSON.stringify(calls));"""
            for cwd in ('/var/www/passvero-acceptance', '/var/www/passvero'):
                js = fixture.replace('PROGRAM', json.dumps(program)).replace('CWD', json.dumps(cwd))
                result = subprocess.run([node, '-e', js], capture_output=True, check=True)
                calls = json.loads(result.stdout)
                expected = [] if cwd.endswith('/passvero') else [{
                    'method': 'stopProcessId' if action == 'stop' else 'restartProcessId',
                    'arg': 4 if action == 'stop' else {'id': 4}}]
                self.assertEqual(calls, expected)
        with self.assertRaises(CAP.Stop):
            CAP.pm2(None, 'delete', 8)

    def test_second_launch_stops_before_helpers_or_systemd(self):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder)
            (root / 'one-pause-approved-20261001.json').write_text('{}')
            stack.enter_context(patch.object(CAP, 'ROOT', root))
            stack.enter_context(patch.object(CAP.os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(CAP.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(CAP.os, 'umask'))
            stack.enter_context(patch.object(CAP, 'private'))
            helper = stack.enter_context(patch.object(CAP, 'helpers'))
            command = stack.enter_context(patch.object(CAP.subprocess, 'run'))
            with self.assertRaisesRegex(CAP.Stop, 'ONE_PAUSE_ALREADY_CLAIMED'):
                CAP.launch()
            helper.assert_not_called()
            command.assert_not_called()

    def test_guard_has_hard_deadline_kills_only_own_cgroup_and_independent_post(self):
        helper = pathlib.Path('/var/lib/passvero-staging-recovery/operator/capture-pin.py')
        args = CAP.unit_command(helper, '20261001T000000Z')
        self.assertIn('--property=Type=exec', args)
        self.assertIn('--property=RuntimeMaxSec=85s', args)
        self.assertIn('--property=TimeoutStopSec=25s', args)
        self.assertIn('--property=KillSignal=SIGKILL', args)
        self.assertIn('--property=KillMode=control-group', args)
        self.assertIn('--property=Restart=no', args)
        self.assertTrue(any('--resume 20261001T000000Z' in x for x in args))
        self.assertLess(CAP.CAPTURE_SECONDS + CAP.RESUME_SECONDS, 120)
        self.assertFalse(any('OnCalendar' in x or '--pty' in x or '--scope' in x for x in args))

    def test_duration_is_machine_integer_and_unsafe_properties_are_rejected(self):
        helper = pathlib.Path('/var/lib/passvero-staging-recovery/operator/capture-pin.py')
        base = {'Type':'exec','KillMode':'control-group','KillSignal':'9','Restart':'no','User':'root',
                'ExecStopPost':'{ argv[]=/usr/bin/python3 -B '+str(helper)+' --resume 20261001T000000Z ; }'}
        def invoke(changes):
            def command(args, **kwargs):
                if 'GetUnit' in args:return b'o "/org/freedesktop/systemd1/unit/fixture"'
                if args[-1]=='RuntimeMaxUSec':return b't 85000000'
                if args[-1]=='TimeoutStopUSec':return b't 25000000'
                return '\n'.join(k+'='+v for k,v in dict(base,**changes).items()).encode()
            with patch.object(CAP,'command',side_effect=command):
                CAP.guard_properties('fixture',helper,'20261001T000000Z',85,25)
        invoke({})
        for changes in ({'Type':'oneshot'},{'KillMode':'process'},{'Restart':'always'},{'ExecStopPost':''}):
            with self.subTest(changes=changes),self.assertRaises(CAP.Stop):invoke(changes)
        with patch.object(CAP,'command',return_value=b't infinity'),self.assertRaises(CAP.Stop):
            CAP.duration_property('fixture','RuntimeMaxUSec')

    def test_metadata_comparison_includes_id_timestamp_size_and_history(self):
        before=[{'bucket':'stage','key':'history/original.pdf','id':'id','updatedAt':'one','size':3,'file':'local','sha256':'a'}]
        self.assertEqual(CAP.metadata(before),CAP.metadata([dict(before[0],file='other',sha256='b')]))
        for field in ('id','updatedAt','size','key'):
            self.assertNotEqual(CAP.metadata(before),CAP.metadata([dict(before[0],**{field:'changed'})]))

    def test_identifiers_are_quoted_without_sql_interpolation(self):
        self.assertEqual(CAP.identifier('a"b'), 'public."a""b"')
        with self.assertRaises(CAP.Stop):CAP.identifier('a\0b')

    def test_snapshot_channel_handles_combined_lines_and_releases_child(self):
        original = subprocess.Popen
        code = 'import sys\nfor line in sys.stdin:\n sys.stdout.write(\'\\n"fixture-result"\\n__CAPTURE_END__\\n\');sys.stdout.flush()\n'
        def fixture(*args,**kwargs):
            return original([sys.executable,'-u','-c',code],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
        with patch.object(CAP.subprocess,'Popen',side_effect=fixture):
            snapshot=CAP.Snapshot(types.SimpleNamespace(account=lambda user:{}),time.monotonic()+3)
            try:
                self.assertEqual(snapshot.q('SELECT 1'),'fixture-result')
                self.assertEqual(snapshot.q('SELECT 2'),'fixture-result')
            finally:snapshot.close()
            self.assertIsNotNone(snapshot.child.poll())

    def test_one_json_value_can_span_physical_lines_and_packet_boundaries(self):
        expected = {'references': [{'id': i, 'label': 'čuvano'} for i in range(9)], 'enabledCampaigns': 0}
        payload = json.dumps(expected, ensure_ascii=False, indent=2).encode() + b'\n__CAPTURE_END__\n'
        original = subprocess.Popen
        code = ('import sys\nfor line in sys.stdin:\n'
                ' for chunk in ' + repr([payload[:19], payload[19:71], payload[71:]]) + ':\n'
                '  sys.stdout.buffer.write(chunk);sys.stdout.buffer.flush()\n')
        def fixture(*args, **kwargs):
            return original([sys.executable, '-u', '-c', code], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        with patch.object(CAP.subprocess, 'Popen', side_effect=fixture):
            snapshot = CAP.Snapshot(types.SimpleNamespace(account=lambda user: {}), time.monotonic() + 3)
            original_read = os.read
            try:
                with patch.object(CAP.os, 'read', side_effect=lambda fd, size: original_read(fd, min(size, 17))):
                    self.assertEqual(snapshot.q('SELECT fixture_json'), expected)
                    self.assertEqual(snapshot.q('SELECT fixture_json_again'), expected)
            finally:snapshot.close()
            self.assertIsNotNone(snapshot.child.poll())

    def test_multiple_sql_json_values_still_fail_closed(self):
        original = subprocess.Popen
        code = 'import sys\nfor line in sys.stdin:\n sys.stdout.write(\'{"a":1}\\n{"b":2}\\n__CAPTURE_END__\\n\');sys.stdout.flush()\n'
        def fixture(*args, **kwargs):
            return original([sys.executable, '-u', '-c', code], stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        with patch.object(CAP.subprocess, 'Popen', side_effect=fixture):
            snapshot = CAP.Snapshot(types.SimpleNamespace(account=lambda user: {}), time.monotonic() + 3)
            try:
                with self.assertRaisesRegex(CAP.Stop, 'SQL_RESULT_SHAPE'):
                    snapshot.q('SELECT first;SELECT second')
            finally:snapshot.close()

    def capture_fixture(self, failure=None):
        with tempfile.TemporaryDirectory() as folder,contextlib.ExitStack() as stack:
            base=pathlib.Path(folder);work=base/'set';control=base/'control'
            work.mkdir();(work/'database').mkdir();(work/'storage').mkdir();control.mkdir()
            tables=['Table'+str(i) for i in range(51)]
            digest=hashlib.sha256(b'PDF').hexdigest()
            obj={'bucket':'passvero-staging-documents','key':'documents/fixture.pdf','size':3,'sha256':digest,'file':'fixture'}
            row={'kind':'document','id':'fixture-id','provider':'supabase','bucket':obj['bucket'],'key':obj['key'],
                 'bytes':'3','sha256':digest,'state':'AVAILABLE'}
            seed={'objects':[obj],'storageBytes':3}
            selected={'unit':'fixture','process':{'pid':2},'tables':tables}
            reads={str(control/'selected.json'):selected,
                   str(CAP.ROOT/'one-pause-approved-20261001.json'):{'setId':'20261001T000000Z'},
                   str(CAP.ROOT/'preparation'/CAP.SEED/'prepared.json'):seed}
            calls=[];closed=[]
            class Snapshot:
                def __init__(self,*args):pass
                def q(self,query):
                    if query.startswith('BEGIN'):
                        self_test.assertLess(query.index('LOCK TABLE'),query.index('SELECT'))
                        self_test.assertIn('IN SHARE MODE NOWAIT',query)
                        self_test.assertEqual(query.count('public."'),51)
                        return {'snapshot':'fixture-snapshot','clients':1 if failure=='client' else 0,'prepared':0}
                    if query==CAP.TABLES:return tables
                    if query==CAP.CATALOG:return {'pendingDocuments':0,'pendingImages':0,'nonPublicSchemas':0,'largeObjects':0,
                        'migrations':[{'finishedAt':'fixture','rolledBackAt':None} for _ in range(31)]}
                    if query==REF.QUERY:return {'references':[row],'enabledCampaigns':0}
                    if query==CAP.SEQUENCES:return []
                    if query==CAP.OUTSIDE:return {'clients':0,'prepared':0}
                    self_test.assertTrue(query.startswith('SELECT json_object_agg(name,total) FROM ('))
                    self_test.assertEqual(query.count('count(*) AS total'),51)
                    return dict.fromkeys(tables,0)
                def close(self):closed.append(True)
            self_test=self
            def dump(args,**kwargs):
                calls.append(args)
                self.assertEqual(args[args.index('-p')+1],'5433')
                self.assertEqual(args[args.index('-d')+1],'passvero_acceptance')
                self.assertIn('--snapshot=fixture-snapshot',args)
                kwargs['stdout'].write(b'fixture-dump')
                return types.SimpleNamespace(returncode=0)
            prepare=types.SimpleNamespace(runtime=lambda:(selected['process'],{}),account=lambda user:{},
                storage_request=lambda *args:io.BytesIO(b'CHANGED' if failure=='bytes' else b'PDF'))
            for name,value in {'validate_context':lambda sid:(work,control),'helpers':lambda:(prepare,REF),
                'read':lambda path:reads[str(path)],'guard_properties':lambda *args:None,'gates':lambda p:None,
                'inventory':lambda *args:[obj],'pm2':lambda *args:None,'monitor':lambda *args:{'status':'stopped'},
                'source_workers':lambda p:0,'Snapshot':Snapshot}.items():stack.enter_context(patch.object(CAP,name,value))
            stack.enter_context(patch.object(CAP.subprocess,'run',side_effect=dump))
            if failure:
                with self.assertRaisesRegex(CAP.Stop,'UNKNOWN_DATABASE_WRITER' if failure=='client' else 'STORAGE_BYTES_CHANGED'):
                    CAP.capture('20261001T000000Z')
            else:
                CAP.capture('20261001T000000Z')
                self.assertEqual(json.loads((control/'capture-core.json').read_text())['lockedTables'],51)
                self.assertEqual(json.loads((work/'database/manifest.json').read_text())['snapshotId'],'fixture-snapshot')
            self.assertEqual(closed,[True])
            self.assertEqual(len(calls),0 if failure=='client' else 1)
            self.assertTrue((control/'pause-intent.json').exists())

    def test_same_snapshot_dump_manifest_and_complete_storage_verification(self):self.capture_fixture()
    def test_unknown_db_client_aborts_before_dump_and_closes_exporter(self):self.capture_fixture('client')
    def test_changed_storage_bytes_abort_with_dump_retained_and_exporter_closed(self):self.capture_fixture('bytes')

    def test_resume_online_app_is_not_restarted_and_stopped_app_restarts_only_once(self):
        for status in ('online','stopped'):
            with self.subTest(status=status),tempfile.TemporaryDirectory() as folder,contextlib.ExitStack() as stack:
                control=pathlib.Path(folder);(control/'pause-intent.json').write_text('{}')
                prepare=types.SimpleNamespace(runtime=lambda:({'pid':2},{}))
                starts=[]
                values={'validate_context':lambda sid:(control,control),'helpers':lambda:(prepare,None),
                    'read':lambda path:{'monotonic':time.monotonic()-2},'monitor':lambda p:{'status':status},
                    'pm2':lambda *args:starts.append(args[1])}
                for name,value in values.items():stack.enter_context(patch.object(CAP,name,value))
                stack.enter_context(patch.dict(CAP.os.environ,{'SERVICE_RESULT':'success'}))
                stack.enter_context(patch.object(CAP.socket,'create_connection',return_value=contextlib.nullcontext()))
                CAP.resume('20261001T000000Z')
                result=json.loads((control/'closure.json').read_text())
                self.assertTrue(result['stagingResumed']);self.assertLess(result['pauseSeconds'],120)
                self.assertEqual(starts,[] if status=='online' else ['restart'])

    def test_live_guard_proof_receipt_uses_documented_signal_name_not_integer(self):
        with tempfile.TemporaryDirectory() as folder,contextlib.ExitStack() as stack:
            control=pathlib.Path(folder)
            stack.enter_context(patch.object(CAP,'validate_context',return_value=(control,control)))
            stack.enter_context(patch.object(CAP.os,'umask'))
            stack.enter_context(patch.object(CAP.sys,'argv',['capture','--proof-post','20261001T000000Z']))
            stack.enter_context(patch.dict(CAP.os.environ,{'SERVICE_RESULT':'timeout','EXIT_CODE':'killed','EXIT_STATUS':'KILL'}))
            CAP.main()
            result=json.loads((control/'guard-proof.json').read_text())
            self.assertEqual(result,{'serviceResult':'timeout','exitCode':'killed','exitStatus':'KILL'})


if __name__=='__main__':unittest.main()
