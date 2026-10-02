"""Only synthetic SQL/command fixtures; no local database or privileged operations."""
import importlib.util
import ast
import re
import contextlib
import io
import os
import hashlib
import errno
import struct
import stat
import tempfile
import types
import json
import pathlib
import subprocess
import unittest
from unittest.mock import patch

PATH = pathlib.Path(__file__).resolve().parents[2]/'scripts/staging-recovery/restore_database.py'
spec = importlib.util.spec_from_file_location('restore_database',PATH)
R = importlib.util.module_from_spec(spec)
spec.loader.exec_module(R)

class RestoreTests(unittest.TestCase):
    def test_identifier_quotes_without_sql_execution(self):
        self.assertEqual(R.quote('a"b'),'"a""b"')
        with self.assertRaises(R.Stop):R.quote('a\0b')
    def test_literal_escapes_quotes_and_rejects_backslash(self):
        self.assertEqual(R.literal("a'b"),"'a''b'")
        with self.assertRaises(R.Stop):R.literal('a\\b')
    def test_role_properties_preserved_without_passwords(self):
        row={'name':'passvero_app','superuser':False,'inherit':True,'createRole':False,
             'createDb':False,'login':True,'bypassRls':False}
        self.assertEqual(R.role_sql([row]),'CREATE ROLE "passvero_app" NOSUPERUSER INHERIT NOCREATEROLE NOCREATEDB LOGIN NOBYPASSRLS;')
        with self.assertRaises(R.Stop):R.role_sql([{**row,'name':'postgres'}])
        with self.assertRaises(R.Stop):R.role_sql([{**row,'superuser':True}])
    def test_command_failure_does_not_print_sensitive_stderr(self):
        with patch.object(subprocess,'run',return_value=type('Result',(),{'returncode':1,'stdout':b'','stderr':b'secret'})()):
            with self.assertRaisesRegex(R.Stop,'COMMAND_PG_RESTORE_FAILED'):R.run([R.PG+'pg_restore'])
    def test_command_environment_contains_no_runtime_or_credentials(self):
        with patch.object(subprocess,'run',return_value=type('Result',(),{'returncode':0,'stdout':b'{}'})()) as run:
            R.sql('SELECT 1')
            kwargs=run.call_args.kwargs
            self.assertEqual(set(kwargs['env']),{'PATH','LANG','PGAPPNAME'})
            args=run.call_args.args[0]
            self.assertIn(str(R.SOCKET),args)
            self.assertIn(R.DB,args)
            self.assertTrue(args[-1].startswith('BEGIN READ ONLY;'))
    def test_default_database_acl_never_changes_permissions(self):
        with patch.object(R,'sql') as sql:
            self.assertIsNone(R.database_acl(None,apply=True));sql.assert_not_called()
    def test_explicit_database_acl_reconstructs_grant_options_and_grantors(self):
        rows=[{'grantor':'passvero_migrator','grantee':'passvero_app','privilege':'CONNECT','option':False},
              {'grantor':'passvero_migrator','grantee':'passvero_migrator','privilege':'CREATE','option':True}]
        calls=[]
        def sql(query,**kwargs):
            calls.append(query)
            if 'aclexplode' in query:return rows
            if 'to_json' in query:return 'passvero_migrator'
        with patch.object(R,'sql',side_effect=sql):R.database_acl('{fixture}',apply=True)
        self.assertIn('REVOKE ALL ON DATABASE "passvero_staging_recovery" FROM PUBLIC, "passvero_migrator"',calls)
        self.assertTrue(any('WITH GRANT OPTION' in s for s in calls))
        self.assertTrue(any('SET ROLE "passvero_migrator"' in s for s in calls))
    def test_unknown_database_privilege_is_rejected(self):
        def sql(query,**kwargs):
            if 'aclexplode' in query:return [{'grantor':'postgres','grantee':'PUBLIC','privilege':'DELETE','option':False}]
            if 'to_json' in query:return 'passvero_migrator'
        with patch.object(R,'sql',side_effect=sql):
            with self.assertRaisesRegex(R.Stop,'DATABASE_PRIVILEGE'):R.database_acl('{fixture}',apply=True)
    def test_no_source_or_other_database_in_psql_commands(self):
        with patch.object(subprocess,'run',return_value=type('Result',(),{'returncode':0,'stdout':b'{}'})()) as run:
            R.sql('SELECT 1',database='postgres')
            args=run.call_args.args[0]
            self.assertNotIn('5433',args);self.assertNotIn('5432',args)
            self.assertNotIn('/var/run/postgresql',args)
    def download_fixture(self,fault=None):
        with tempfile.TemporaryDirectory() as directory:
            target=pathlib.Path(directory)
            source=target/'download'/(R.ROOT/'sets'/R.SET).relative_to('/')
            source.mkdir(parents=True)
            data=source/'dump'
            size=963900
            for _ in range(10):
                data.write_bytes(b'x'*size)
                manifest={'files':{'dump':{'bytes':size,'sha256':hashlib.sha256(data.read_bytes()).hexdigest()}}}
                manifest_path=source/'recovery-set.json'
                manifest_path.write_text(json.dumps(manifest))
                total=size+manifest_path.stat().st_size
                if total==964172:break
                size+=964172-total
            digest=hashlib.sha256(manifest_path.read_bytes()).hexdigest()
            proof={'offsite':'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED','snapshotId':R.SNAPSHOT,
                   'repositoryId':R.REPOSITORY,'manifestSha256':digest,'setId':R.SET}
            if fault=='snapshot':proof['snapshotId']='wrong'
            (target/'download-proof.json').write_text(json.dumps(proof))
            if fault=='bytes':data.write_bytes(b'changed')
            if fault=='extra':(source/'unreviewed').write_bytes(b'new')
            if fault=='symlink':(source/'escape').symlink_to(data)
            cap=types.SimpleNamespace(read=lambda p:json.loads(p.read_text()),private=lambda *args:None)
            with patch.object(R,'TARGET',target),patch.object(R,'MANIFEST',digest):
                if fault:
                    with self.assertRaises(R.Stop):R.verify_download(cap)
                else:self.assertEqual(R.verify_download(cap),source)
    def test_download_accepted_only_with_exact_b2_identity_and_bytes(self):self.download_fixture()
    def test_different_snapshot_is_rejected(self):self.download_fixture('snapshot')
    def test_changed_download_is_rejected(self):self.download_fixture('bytes')
    def test_extra_download_file_is_rejected(self):self.download_fixture('extra')
    def test_download_symlink_is_rejected(self):self.download_fixture('symlink')
    def test_linux_acl_encoding_has_only_postgres_execute_permission(self):
        data=R.traversal_acl(123)
        self.assertEqual(struct.unpack('<I',data[:4]),(2,))
        self.assertEqual([struct.unpack('<HHI',data[i:i+8]) for i in range(4,len(data),8)],
            [(1,7,0xffffffff),(2,1,123),(4,0,0xffffffff),(16,1,0xffffffff),(32,0,0xffffffff)])
        with self.assertRaises(R.Stop):R.traversal_acl(0)
    def test_absent_acl_is_distinct_from_unavailable_acl_support(self):
        with patch.object(R.os,'getxattr',create=True,side_effect=OSError(errno.ENODATA,'absent')):
            self.assertIsNone(R.get_acl(R.ROOT))
        with patch.object(R.os,'getxattr',create=True,side_effect=OSError(errno.EOPNOTSUPP,'unsupported')):
            with self.assertRaises(OSError):R.get_acl(R.ROOT)
    def acl_fixture(self,fault=None):
        paths=[R.ROOT,R.ROOT/'restore',R.TARGET]
        rows=[{'path':str(p),'device':1,'inode':i+1,'uid':0,'gid':0,'mode':0o700} for i,p in enumerate(paths)]
        acls={str(p):R.traversal_acl(123) for p in paths}
        def lstat(p):
            row=next(row for row in rows if row['path']==str(p))
            return types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_dev=1,
                st_ino=row['inode']+(1 if fault=='inode' and p==R.ROOT else 0),st_uid=0,st_gid=0)
        if fault=='unexpected':acls[str(R.ROOT)]=b'other acl'
        def remove(p,name,**kwargs):acls[str(p)]=None
        with patch.object(pathlib.Path,'lstat',lstat),patch.object(R,'get_acl',side_effect=lambda p:acls[str(p)]), \
             patch.object(R.os,'removexattr',create=True,side_effect=remove) as removals,patch.object(R.os,'chmod') as chmod:
            if fault:
                with self.assertRaisesRegex(R.Stop,'ACL_PARENT_CLOSURE_FAILED'):R.restore_parents(rows,123)
                self.assertEqual(removals.call_count,2)
            else:
                R.restore_parents(rows,123)
                self.assertEqual(removals.call_count,3)
                self.assertEqual(chmod.call_count,3)
                self.assertTrue(all(v is None for v in acls.values()))
    def test_named_acl_removed_and_all_three_parents_restored(self):self.acl_fixture()
    def test_unexpected_acl_not_overwritten_other_parents_still_closed(self):self.acl_fixture('unexpected')
    def test_changed_parent_inode_not_modified_other_parents_still_closed(self):self.acl_fixture('inode')
    def test_acl_closure_rejects_paths_outside_approved_parents(self):
        with self.assertRaisesRegex(R.Stop,'ACL_RESTORE_SCOPE'):R.restore_parents([{'path':'/etc'}],123)
    def test_existing_extended_acl_prevents_new_attempt(self):
        fake=types.SimpleNamespace(st_mode=stat.S_IFDIR|0o700,st_uid=0)
        with patch.object(pathlib.Path,'lstat',return_value=fake),patch.object(R,'get_acl',return_value=b'extended'):
            with self.assertRaisesRegex(R.Stop,'EXISTING_PARENT_ACL_REQUIRES_REVIEW'):R.acl_baseline([R.ROOT])
    def permission_fixture(self,fault=None):
        with tempfile.TemporaryDirectory() as directory,contextlib.ExitStack() as stack:
            root=pathlib.Path(directory);control=root/'control';control.mkdir()
            operator=root/'operator';operator.mkdir()
            previous=operator/'restore-database-9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7.py'
            runbook=PATH.parents[2]/'docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md'
            history=runbook.read_text().split('<!-- BEGIN PRIVATE_DATABASE_RESTORE_STDLIB_VPS -->',1)[1].split('<!-- END PRIVATE_DATABASE_RESTORE_STDLIB_VPS -->',1)[0]
            block=re.findall(r'```sh\n(.*?)\n```',history,re.S)[0]
            tree=ast.parse('\n'.join(block.splitlines()[1:-1]))
            prior_source=next(ast.literal_eval(node.value) for node in tree.body if isinstance(node,ast.Assign) and isinstance(node.targets[0],ast.Name) and node.targets[0].id=='SOURCE')
            previous.write_text(prior_source)
            expected={'restoreClosure':'PASS','setId':R.SET,'restoreCluster':'STOPPED',
                'parentPermissions':'PRIVATE_0700_RESTORED','staging':'ONLINE_UNPAUSED',
                'reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
                'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
            paths=[control/'restore-closure.json',control/'restore-closure-stdlib.json']
            bodies=[]
            for path in paths:
                body=json.dumps(expected).encode();path.write_bytes(body);path.chmod(0o644);bodies.append(body)
            if fault=='content':paths[1].write_bytes(b'{}')
            if fault=='mode':paths[1].chmod(0o666)
            if fault=='attempt':(control/'restore-attempt.json').write_text('{}')
            real_fstat=os.fstat
            def fstat(fd):
                values=list(real_fstat(fd));values[4]=0;return os.stat_result(values)
            def write(path,value):
                with open(path,'x') as f:json.dump(value,f)
            cap=types.SimpleNamespace(private=lambda *args:None,write=write)
            for name,value in [('ROOT',root),('CONTROL',control),('DATA',root/'pgdata'),('SOCKET',root/'socket')]:
                stack.enter_context(patch.object(R,name,value))
            stack.enter_context(patch.object(R.os,'fstat',side_effect=fstat))
            unit=b'Result=exit-code\nExecMainStatus=1\nActiveState=failed\nInvocationID=d3b214d0c90944acb5be57f7656da545\n'
            if fault=='unit':unit=b'Result=success\n'
            stack.enter_context(patch.object(R,'run',return_value=unit))
            if fault:
                with self.assertRaises(R.Stop),contextlib.redirect_stdout(io.StringIO()):R.repair_closure_permissions(cap)
                self.assertEqual(paths[0].stat().st_mode&0o777,0o644)
                self.assertFalse((control/'closure-permission-repair.json').exists())
            else:
                with contextlib.redirect_stdout(io.StringIO()):R.repair_closure_permissions(cap)
                self.assertEqual([p.read_bytes() for p in paths],bodies)
                self.assertEqual([p.stat().st_mode&0o777 for p in paths],[0o600,0o600])
                self.assertTrue((control/'closure-permission-repair.json').exists())
    def test_both_confirmed_closures_repaired_without_content_change(self):self.permission_fixture()
    def test_different_closure_content_blocks_both_repairs(self):self.permission_fixture('content')
    def test_world_writable_closure_blocks_both_repairs(self):self.permission_fixture('mode')
    def test_prior_restore_attempt_blocks_permission_continuation(self):self.permission_fixture('attempt')
    def test_changed_previous_unit_blocks_permission_continuation(self):self.permission_fixture('unit')
    def test_close_writes_private_evidence_even_when_process_starts_with_umask022(self):
        with tempfile.TemporaryDirectory() as directory:
            control=pathlib.Path(directory)
            def write(path,value):
                with open(path,'x') as f:json.dump(value,f)
            prepare=types.SimpleNamespace(runtime=lambda:None)
            cap=types.SimpleNamespace(private=lambda *args:None,helpers=lambda:(prepare,None),gates=lambda *_:None,write=write)
            prior=os.umask(0o022)
            try:
                with patch.object(R,'CONTROL',control),patch.object(R,'cap_module',return_value=cap), \
                     patch.object(pathlib.Path,'iterdir',return_value=iter([])),contextlib.redirect_stdout(io.StringIO()):R.close()
                self.assertEqual((control/'restore-closure-private.json').stat().st_mode&0o777,0o600)
            finally:os.umask(prior)
    def test_restore_source_does_not_discard_owners_acls_or_clean(self):
        source=PATH.read_text()
        self.assertIn("'--exit-on-error','--single-transaction'",source)
        self.assertIn("listen_addresses=''",source)
        self.assertIn("'--no-clean'",source)
        self.assertNotIn("'--no-owner'",source);self.assertNotIn("'--no-acl'",source)

if __name__=='__main__':unittest.main()
