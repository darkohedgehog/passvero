"""No operator entrypoint, live DB, service, network or credential access."""
import datetime
import contextlib
import hashlib
import importlib.util
import io
import json
import pathlib
import tempfile
import types
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[2] / 'scripts/staging-recovery/prepare.py'
SPEC = importlib.util.spec_from_file_location('staging_prepare', PATH)
PREP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PREP)


def file_row(name):
    return {'name': name, 'id': 'object-' + name, 'metadata': {'size': 3},
            'updated_at': '2026-10-01T00:00:00Z'}


class PreparationTests(unittest.TestCase):
    def test_existing_operator_restic_installation_is_used_without_reinstall(self):
        def installed_binary(args, **kwargs):
            if args[0] != '/usr/local/bin/restic':
                raise FileNotFoundError('fixture: only existing operator client is installed')
            self.assertIn('--no-lock', args)
            self.assertIn('--no-cache', args)
            self.assertEqual(args[-2:], ['snapshots', '--json'])
            return b'[]'
        with patch.object(PREP, 'run', side_effect=installed_binary):
            self.assertEqual(PREP.restic('fixture-repository', {}, ['snapshots', '--json']), b'[]')

    def test_destination_preserves_endpoint_bucket_and_uses_sibling_prefix(self):
        host, region, bucket, repo = PREP.destination('s3:https://s3.eu-central-003.backblazeb2.com/existing-bucket/production')
        self.assertEqual((host, region, bucket), ('s3.eu-central-003.backblazeb2.com', 'eu-central-003', 'existing-bucket'))
        self.assertEqual(repo, 's3:https://s3.eu-central-003.backblazeb2.com/existing-bucket/passvero-staging-recovery-v1')

    def test_ambiguous_or_overlapping_destination_is_rejected(self):
        for uri in ('s3:http://s3.eu-central-003.backblazeb2.com/existing-bucket',
                    's3:https://user:private@s3.eu-central-003.backblazeb2.com/existing-bucket',
                    's3:https://s3.eu-central-003.backblazeb2.com/existing-bucket?private=yes',
                    's3:https://other.example/existing-bucket',
                    's3:https://s3.eu-central-003.backblazeb2.com/existing-bucket/passvero-staging-recovery-v1'):
            with self.subTest(uri=uri), self.assertRaises(PREP.Stop):
                PREP.destination(uri)

    def test_complete_pagination_and_nested_folder_not_first_page_only(self):
        pages = {
            ('', 0): [{'name': 'history', 'id': None, 'metadata': None}] + [file_row(str(i)) for i in range(99)],
            ('', 100): [file_row('last')],
            ('history/', 0): [file_row('original.pdf')],
        }
        seen = []
        rows = PREP.inventory(lambda prefix, offset: (seen.append((prefix, offset)) or pages[(prefix, offset)]))
        self.assertEqual(len(rows), 101)
        self.assertIn(('', 100), seen)
        self.assertIn('history/original.pdf', [x['key'] for x in rows])

    def test_duplicate_traversal_and_budget_overflow_are_not_silently_skipped(self):
        fixtures = [[file_row('same'), file_row('same')],
                    [{'name': '..', 'id': None, 'metadata': None}],
                    [dict(file_row('large'), metadata={'size': PREP.GIB + 1})]]
        for page in fixtures:
            with self.subTest(page=page), self.assertRaises(PREP.Stop):
                PREP.inventory(lambda prefix, offset: page)

    def test_credential_parser_does_not_execute_shell_expansion(self):
        values = PREP.credentials("export AWS_ACCESS_KEY_ID='fixture-key'\nAWS_SECRET_ACCESS_KEY=fixture-secret\n")
        self.assertEqual(values['AWS_ACCESS_KEY_ID'], 'fixture-key')
        with self.assertRaises(PREP.Stop):
            PREP.credentials('AWS_ACCESS_KEY_ID=fixture\nAWS_SECRET_ACCESS_KEY=$(unwanted-command)')

    def test_signed_list_is_limited_to_approved_prefix_and_keeps_secret_out_of_url(self):
        keys = {'AWS_ACCESS_KEY_ID': 'fixture-key', 'AWS_SECRET_ACCESS_KEY': 'fixture-secret'}
        when = datetime.datetime(2026, 10, 1, tzinfo=datetime.timezone.utc)
        req = PREP.s3_list_request('s3.eu-central-003.backblazeb2.com', 'eu-central-003', 'existing-bucket', keys, when)
        self.assertIn('prefix=passvero-staging-recovery-v1%2F', req.full_url)
        self.assertNotIn('fixture-secret', req.full_url)
        self.assertIn('/eu-central-003/s3/aws4_request', req.get_header('Authorization'))
        self.assertEqual(req.get_method(), 'GET')

    def test_import_and_pure_tests_do_not_invoke_operator_commands(self):
        with patch.object(PREP.subprocess, 'run', side_effect=AssertionError('operator execution')):
            PREP.destination('s3:s3.eu-central-003.backblazeb2.com/existing-bucket/production')

    def test_http_redirect_does_not_forward_private_key(self):
        self.assertIsNone(PREP.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example'))

    def main_fixture(self, denied):
        with tempfile.TemporaryDirectory() as folder, contextlib.ExitStack() as stack:
            root = pathlib.Path(folder)
            root.chmod(0o700)
            app = root / 'source-fixture'
            (app / '.next').mkdir(parents=True)
            (app / 'package.json').write_text('{}')
            (app / 'package-lock.json').write_text('{}')
            (app / '.next/BUILD_ID').write_text('fixture-build')
            original_stat = pathlib.Path.stat
            original_read = pathlib.Path.read_bytes
            def root_stat(path, *args, **kwargs):
                info = original_stat(path, *args, **kwargs)
                return types.SimpleNamespace(st_uid=0, st_mode=info.st_mode) if path == root else info
            def source_read(path):
                return b'fixture-backup' if str(path) == '/usr/local/sbin/passvero-postgres-backup' else original_read(path)
            secrets = {
                str(root / 'operator.identity.json'): json.dumps({'schema': 1, 'scope': PREP.PREFIX}).encode(),
                '/etc/passvero/backup/restic-repository': b's3:https://s3.eu-central-003.backblazeb2.com/existing-bucket/production',
                '/etc/passvero/backup/restic-password': b'fixture-password',
                '/etc/passvero/backup/restic.env': b'AWS_ACCESS_KEY_ID=fixture-key\nAWS_SECRET_ACCESS_KEY=fixture-secret',
            }
            calls = []
            def command(args, **kwargs):
                calls.append(args)
                if args[-1] == '--property=ActiveState,UnitFileState':
                    return b'ActiveState=inactive\nUnitFileState=disabled'
                self.assertEqual(args[-1], '--property=ActiveState')
                return b'ActiveState=inactive'
            def dump(args, **kwargs):
                calls.append(args)
                self.assertEqual(args[0], '/usr/bin/pg_dump')
                self.assertEqual(args[args.index('-p')+1], '5433')
                self.assertEqual(args[args.index('-d')+1], 'passvero_acceptance')
                self.assertNotIn('DATABASE_URL', kwargs['env'])
                kwargs['stdout'].write(b'fixture-dump')
                return types.SimpleNamespace(returncode=0)
            def remote(request):
                if denied:
                    raise PREP.Stop('REMOTE_HTTP_403_AccessDenied')
                return io.BytesIO(b'<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Prefix>passvero-staging-recovery-v1/</Prefix><IsTruncated>false</IsTruncated></ListBucketResult>')
            def storage(env, path, body=None):
                if path.startswith('bucket/'):
                    data = {'id': path.split('/')[1], 'public': False}
                elif path.startswith('object/list/'):
                    data = [file_row('current.pdf')]
                else:
                    self.assertTrue(path.startswith('object/authenticated/passvero-staging-'))
                    return io.BytesIO(b'PDF')
                return io.BytesIO(json.dumps(data).encode())
            process = {'pid': 2, 'name': 'passvero-acceptance', 'status': 'online', 'cwd': str(app), 'pmId': 0}
            replacements = {
                'ROOT': root, 'APP': app, 'PIN': hashlib.sha256(b'fixture-backup').hexdigest(),
                'protected': lambda path: secrets[str(path)], 'run': command, 'account': lambda name: {},
                'runtime': lambda: (process, {}), 'response': remote, 'storage_request': storage,
                'sql': lambda query: {'port': '5433', 'directory': '/var/lib/postgresql/16/acceptance',
                    'name': 'passvero_acceptance', 'bytes': 100, 'migrations': 31, 'enabledCampaigns': 0},
                'restic': lambda repo, keys, args: json.dumps([{'id': 'a'*64, 'hostname': 'passvero-production',
                    'tags': ['passvero-postgresql']}]).encode(),
            }
            for name, value in replacements.items():
                stack.enter_context(patch.object(PREP, name, value))
            stack.enter_context(patch.object(PREP.os, 'geteuid', return_value=0))
            stack.enter_context(patch.object(PREP.os, 'uname', return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(PREP.os, 'umask'))
            stack.enter_context(patch.object(pathlib.Path, 'stat', root_stat))
            stack.enter_context(patch.object(pathlib.Path, 'read_bytes', source_read))
            stack.enter_context(patch.object(PREP.shutil, 'disk_usage', return_value=types.SimpleNamespace(free=8*PREP.GIB)))
            stack.enter_context(patch.object(PREP.subprocess, 'run', side_effect=dump))
            output = io.StringIO()
            with contextlib.redirect_stdout(output):
                if denied:
                    with self.assertRaisesRegex(PREP.Stop, 'REMOTE_HTTP_403_AccessDenied'):
                        PREP.main()
                    self.assertFalse(list(root.rglob('prepared.json')))
                else:
                    PREP.main()
                    result = json.loads(output.getvalue())
                    self.assertEqual(result['storageObjects'], 2)
                    self.assertEqual(result['staging'], 'ONLINE_UNPAUSED')
                    self.assertEqual(result['remoteWrites'], 0)
                    state = next(root.rglob('prepared.json')).read_text()
                    self.assertNotIn('fixture-secret', state)
                    self.assertNotIn('fixture-password', state)
                    self.assertFalse(json.loads(state)['captureCompleted'])
            self.assertFalse(any('stop' in c or 'restart' in c or 'init' in c for c in calls))

    def test_full_mocked_preparation_preserves_running_app_and_keeps_secrets_in_memory(self):
        self.main_fixture(False)

    def test_denied_prefix_stops_before_download_or_dump_without_pause(self):
        self.main_fixture(True)


if __name__ == '__main__':
    unittest.main()
