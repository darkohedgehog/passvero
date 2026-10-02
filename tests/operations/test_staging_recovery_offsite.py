"""Synthetic offsite contract tests; never contact B2, PG, PM2 or run restic."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import stat
import subprocess
import tempfile
import types
import unittest
from unittest.mock import patch

BASE = pathlib.Path(__file__).resolve().parents[2]

def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

OFF = load('offsite', BASE / 'scripts/staging-recovery/offsite.py')
CAP = load('capture', BASE / 'scripts/staging-recovery/capture.py')
REF = load('references', BASE / 'scripts/staging-recovery/reference_preflight.py')

class OffsiteTests(unittest.TestCase):
    def files(self, root):
        work = root / 'sets' / OFF.SET_ID
        control = root / 'control' / OFF.SET_ID
        for path in (work / 'database', work / 'storage', work / 'configuration', control):
            path.mkdir(mode=0o700, parents=True)
        objects, rows = [], []
        for i in range(5):
            bucket = 'passvero-staging-documents' if i < 3 else 'passvero-staging-images'
            data = ('synthetic bytes ' + str(i)).encode()
            name = str(i)
            directory = work / 'storage' / 'objects' / bucket
            directory.mkdir(mode=0o700, parents=True, exist_ok=True)
            (directory / name).write_bytes(data)
            obj = {'bucket': bucket, 'key': 'fixture/' + name, 'file': name,
                   'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            objects.append(obj)
            rows.append({'provider': 'supabase', 'bucket': bucket, 'key': obj['key'],
                         'bytes': str(len(data)), 'sha256': obj['sha256']})
        for i in range(4):
            rows.append({'provider': 'supabase', 'bucket': 'passvero-staging-documents',
                'key': 'absent/' + str(i), 'kind': 'document', 'state': 'ARCHIVED', 'archived': True,
                'same_actor': True, 'links': 0, 'audits': 1, 'scan_state': 'CLEAN', 'policy': 2,
                'id': REF.SECOND_DOCUMENT if i == 3 else str(i), 'bytes': '750',
                'sha256': REF.SECOND_SHA, 'acceptance_marker': 'acceptance:' +
                (REF.SECOND_RUN if i == 3 else REF.FIRST_RUN)})
        CAP.write(work / 'storage' / 'manifest.json', {'objects': objects, 'references': rows,
            'reconciliation': REF.reconcile(objects, rows)})
        CAP.write(root / 'operator.identity.json', {'schema': 1, 'scope': 'passvero-staging-recovery-v1'})
        CAP.write(root / CAP.FIRST_CLAIM, {'setId': CAP.FAILED_SET, 'unit': 'old'})
        CAP.write(root / CAP.ADDITIONAL_CLAIM, {'setId': OFF.SET_ID, 'priorSetId': CAP.FAILED_SET,
            'priorClaimSha256': OFF.digest(root / CAP.FIRST_CLAIM)})
        CAP.write(control / 'closure.json', {'stagingResumed': True, 'serviceResult': 'success', 'pauseSeconds': 3.034})
        CAP.write(control / 'summary.json', {'capture': 'PASS', 'setId': OFF.SET_ID, 'payloadBytes': 964172})
        size = 960000
        for _ in range(10):
            (work / 'database' / 'passvero_acceptance.dump').write_bytes(b'x' * size)
            entries = {str(p.relative_to(work)): {'bytes': p.stat().st_size, 'sha256': OFF.digest(p)}
                       for p in work.rglob('*') if p.is_file() and p.name != 'recovery-set.json'}
            path = work / 'recovery-set.json'
            path.write_text(json.dumps({'schema': 1, 'setId': OFF.SET_ID, 'files': entries,
                'payloadBytes': sum(v['bytes'] for v in entries.values())}))
            total = sum(p.stat().st_size for p in work.rglob('*') if p.is_file())
            if total == 964172:
                break
            size += 964172 - total
        self.assertEqual(total, 964172)
        for p in root.rglob('*'):
            p.chmod(0o700 if p.is_dir() else 0o600)
        return work, control

    def fixture(self, fault=None):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder)
            work, control = self.files(root)
            original = {str(p): p.read_bytes() for p in work.rglob('*') if p.is_file()}
            calls, runtime, sql_calls = [], [], []
            prepare = types.SimpleNamespace(PIN='production-pin', PREFIX='passvero-staging-recovery-v1',
                runtime=lambda: runtime.append(True), sql=lambda query: sql_calls.append(query) or {'enabled': 0})
            def subprocess_run(args, **kwargs):
                if args[:3] == ['/usr/local/bin/restic', 'restore', '--help']:
                    return types.SimpleNamespace(returncode=0, stdout=b'--verify')
                if args[:2] == ['/usr/bin/systemctl', 'show']:
                    return types.SimpleNamespace(returncode=0, stdout=(b'inactive' if '--value' in args
                        else b'ActiveState=inactive\nUnitFileState=disabled'))
                raise AssertionError('unexpected live command')
            class FakeRepository(OFF.Repository):
                def __init__(self):self.rows = []
                def empty_prefix(self):
                    if fault == 'denied':raise OFF.Stop('B2_ACCESS_DENIED')
                    return fault != 'foreign'
                def run(repo, args, writing=False):
                    calls.append((args, writing))
                    if args[0] == 'init':return b'initialized'
                    if args[:2] == ['cat', 'config']:return json.dumps({'id': 'a'*64, 'version': 2}).encode()
                    if args[0] == 'snapshots':
                        rows = [{'id': 'c'*64, 'hostname': 'passvero-production', 'tags': ['production'],
                                 'paths': ['/production']}] if fault == 'foreign' else repo.rows
                        return json.dumps(rows).encode()
                    if args[0] == 'backup':
                        self.assertTrue(writing)
                        self.assertEqual(args[-1], str(work))
                        if fault == 'backup':raise OFF.Stop('RESTIC_BACKUP_EXIT_3')
                        repo.rows = [{'id': 'b'*64, 'hostname': OFF.HOST, 'tags': [OFF.HOST, 'set:'+OFF.SET_ID],
                                      'paths': [str(work)]}]
                        if fault == 'source_changed':(work/'database/passvero_acceptance.dump').write_bytes(b'changed')
                        return b'{}'
                    if args[0] == 'dump':
                        data = (work/'recovery-set.json').read_bytes()
                        return b'changed' if fault == 'remote_manifest' else data
                    if args[0] == 'ls':
                        lines = [{'struct_type': 'snapshot', 'id': 'b'*64}]
                        for p in work.rglob('*'):
                            if p.is_file():lines.append({'struct_type': 'node', 'path': str(p), 'type': 'file', 'size': p.stat().st_size})
                        if fault == 'symlink':lines.append({'struct_type': 'node', 'path': str(work/'escape'), 'type': 'symlink'})
                        if fault == 'missing_tree_file':lines.pop()
                        return '\n'.join(json.dumps(x) for x in lines).encode()
                    if args[0] == 'restore':
                        self.assertFalse(writing)
                        self.assertIn('--verify', args)
                        download = pathlib.Path(args[args.index('--target')+1])
                        restored = download / work.relative_to('/')
                        shutil.copytree(work, restored)
                        if fault == 'restored_bytes':(restored/'database/passvero_acceptance.dump').write_bytes(b'corrupt')
                        return b'restored'
                    raise AssertionError(args)
            real_lstat = pathlib.Path.lstat
            def lstat(p):
                if str(p) == '/usr/local/bin/restic':return types.SimpleNamespace(st_mode=stat.S_IFREG|0o755, st_uid=0)
                st = real_lstat(p)
                return types.SimpleNamespace(st_mode=st.st_mode, st_uid=0)
            real_digest = OFF.digest
            for module in (OFF, CAP):stack.enter_context(patch.object(module, 'ROOT', root))
            stack.enter_context(patch.object(CAP, 'helpers', return_value=(prepare, REF)))
            stack.enter_context(patch.object(OFF, 'digest', side_effect=lambda p: 'production-pin'
                if str(p) == '/usr/local/sbin/passvero-postgres-backup' else real_digest(p)))
            stack.enter_context(patch.object(os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(pathlib.Path, 'lstat', lstat))
            stack.enter_context(patch.object(os, 'access', return_value=True))
            stack.enter_context(patch.object(shutil, 'disk_usage', return_value=types.SimpleNamespace(free=3*OFF.GIB if fault=='space' else 5*OFF.GIB)))
            stack.enter_context(patch.object(subprocess, 'run', side_effect=subprocess_run))
            if fault == 'attempt':CAP.write(control/'offsite-attempt.json', {})
            if fault == 'target':(root/'restore'/OFF.SET_ID).mkdir(parents=True)
            mask = os.umask(0o077)
            try:
                if fault:
                    with self.assertRaises((OFF.Stop, CAP.Stop)), contextlib.redirect_stdout(io.StringIO()):
                        OFF.main(cap=CAP, repository=FakeRepository())
                else:
                    with contextlib.redirect_stdout(io.StringIO()) as output:OFF.main(cap=CAP, repository=FakeRepository())
                    result = json.loads(output.getvalue().splitlines()[-1])
                    self.assertEqual(result['snapshotId'], 'b'*64)
                    self.assertEqual(result['databaseRestore'], 'NOT_YET_RUN')
                    self.assertEqual(result['restoreCluster'], 'NOT_CREATED')
                    self.assertEqual(result['storageProviderRestore'], 'NOT_PERFORMED')
                    self.assertEqual(len([args for args,w in calls if args[0]=='backup']), 1)
                    self.assertEqual(len([args for args,w in calls if args[0]=='restore']), 1)
                    self.assertEqual(len(runtime), 2)
                if fault != 'source_changed':
                    self.assertEqual(original, {str(p):p.read_bytes() for p in work.rglob('*') if p.is_file()})
                if fault in ('denied','foreign','space','attempt','target'):
                    self.assertFalse(any(w for args,w in calls))
                if fault in ('remote_manifest','symlink','missing_tree_file','source_changed'):
                    self.assertFalse(any(args[0]=='restore' for args,w in calls))
                self.assertFalse(any(args[0] in ('forget','prune') for args,w in calls))
            finally:os.umask(mask)

    def test_complete_scoped_backup_and_real_restic_download_contract(self):self.fixture()
    def test_denied_prefix_stops_before_remote_writes(self):self.fixture('denied')
    def test_foreign_repository_stops_before_remote_writes(self):self.fixture('foreign')
    def test_low_space_stops_before_remote_calls(self):self.fixture('space')
    def test_attempt_replay_stops_before_remote_calls(self):self.fixture('attempt')
    def test_existing_restore_target_never_overwritten(self):self.fixture('target')
    def test_partial_backup_failure_retains_attempt_without_restore(self):self.fixture('backup')
    def test_changed_local_capture_is_not_downloaded(self):self.fixture('source_changed')
    def test_wrong_b2_manifest_is_not_downloaded(self):self.fixture('remote_manifest')
    def test_remote_symlink_is_rejected_before_restore(self):self.fixture('symlink')
    def test_missing_remote_tree_file_is_rejected_before_restore(self):self.fixture('missing_tree_file')
    def test_corrupt_restored_bytes_fail_checksums(self):self.fixture('restored_bytes')

if __name__ == '__main__':unittest.main()
