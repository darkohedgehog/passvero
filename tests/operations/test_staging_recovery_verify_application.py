"""Synthetic full operator flow; no real PG/PM2, network, privilege or ACL calls."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
import pathlib
import shutil
import stat
import tempfile
import types
import unittest
from unittest.mock import patch

BASE=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('app_operator',BASE/'scripts/staging-recovery/verify_application.py')
A=importlib.util.module_from_spec(spec);spec.loader.exec_module(A)

class ApplicationOperatorTests(unittest.TestCase):
    def fixture(self,fault=None):
        with tempfile.TemporaryDirectory() as directory,contextlib.ExitStack() as stack:
            root=pathlib.Path(directory);control=root/'control';control.mkdir()
            operator=root/'operator';operator.mkdir()
            source=root/'source';(source/'configuration').mkdir(parents=True);(source/'storage').mkdir()
            app=root/'app';(app/'.next').mkdir(parents=True)
            target=root/'restore'/A.SET;data=target/'pgdata';socket=target/'socket';data.mkdir(parents=True);socket.mkdir()
            (data/'PG_VERSION').write_text('16')
            def write(path,value):
                with open(path,'x') as f:json.dump(value,f)
            name='src/application/documents/pdf.ts'
            bundle_bytes=b'isolated synthetic operator fixture'
            build={'bundleSha256':hashlib.sha256(bundle_bytes).hexdigest(),
                'applicationModules':{name:hashlib.sha256((BASE/name).read_bytes()).hexdigest()}}
            build_bytes=json.dumps(build).encode()
            (operator/'application-read-build.json').write_bytes(build_bytes)
            stack.enter_context(patch.object(A,'BUILD_PIN',hashlib.sha256(build_bytes).hexdigest()))
            bundle=operator/('application-read-'+build['bundleSha256']+'.cjs')
            bundle.write_bytes(bundle_bytes)
            for name in build['applicationModules']:
                file=app/name;file.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(BASE/name,file)
            (app/'package.json').write_text('{}');(app/'package-lock.json').write_text('{}');(app/'.next/BUILD_ID').write_text('fixture')
            artifact=app/'.next/server/chunk.js';artifact.parent.mkdir();artifact.write_bytes(b'executable fixture')
            artifact_pin=hashlib.sha256(artifact.read_bytes()).hexdigest()
            runtime=app/'node_modules/zod/package.json';runtime.parent.mkdir(parents=True);runtime.write_bytes(b'{}')
            digest=hashlib.sha256(b'{}').hexdigest()
            deployment={'build_id':'fixture','runtime_package':digest,'runtime_lock':digest,
                'application_files':{'.next/server/chunk.js':artifact_pin},'runtime_files':{'node_modules/zod/package.json':digest}}
            deployment_bytes=json.dumps(deployment).encode();deploy_pin=hashlib.sha256(deployment_bytes).hexdigest()
            deploy_file=root/'accepted-deployment.json';deploy_file.write_bytes(deployment_bytes)
            canonical=root/'canonical.json';write(canonical,{'build_id':'changed' if fault=='canonical' else 'fixture',
                'reminders_manifest_sha256':deploy_pin,'files':{'.next/server/chunk.js':{'sha256':artifact_pin}}})
            provenance={'buildManifestSha256':hashlib.sha256(build_bytes).hexdigest(),'deploymentManifestSha256':deploy_pin,
                'applicationModules':build['applicationModules'],'deploymentBuildId':'fixture','deployedArtifactFiles':1}
            provenance_bytes=json.dumps(provenance).encode();provenance_pin=hashlib.sha256(provenance_bytes).hexdigest()
            provenance_file=operator/('application-read-provenance-'+provenance_pin+'.json');provenance_file.write_bytes(provenance_bytes)
            for key,value in [('DEPLOY_MANIFEST',deploy_file),('CANONICAL_MANIFEST',canonical),('PROVENANCE_PIN',provenance_pin),
                ('DEPLOY_PIN',deploy_pin),('ARTIFACT_FILES',1)]:stack.enter_context(patch.object(A,key,value))
            write(source/'configuration/source.json',{'packageSha256':digest,'lockSha256':digest,'buildId':'fixture','node':'v22.0.0'})
            write(source/'storage/manifest.json',{'objects':[]})
            write(control/'database-final-closure.json',{'databaseFinalClosure':'PASS','restoreCluster':'STOPPED'})
            write(control/'database-restore-summary.json',{'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP_VERIFIED','snapshotId':'accepted','setId':A.SET})
            write(control/'database-final-catalog.json',{'fixture':'catalog'})
            parents=[root,root/'restore',target]
            baseline=[{'path':str(p)} for p in parents]
            write(control/'restore-parent-acl-stdlib.json',{'parents':baseline,'postgresUid':501})
            if fault=='bundle':bundle.write_bytes(b'changed')
            if fault=='source':artifact.write_bytes(b'changed')
            if fault=='runtime':runtime.write_bytes(b'changed')
            if fault=='provenance':provenance_file.write_bytes(b'changed')
            if fault=='stalecheckout':
                for name in build['applicationModules']:(app/name).unlink()
            if fault=='attempt':write(control/'application-recovery-artifact-attempt.json',{})
            for p in root.rglob('*'):p.chmod(0o700 if p.is_dir() else 0o600)
            runtime=[];commands=[];node_calls=[]
            prepare=types.SimpleNamespace(runtime=lambda:runtime.append(True),account=lambda name:{})
            cap=types.SimpleNamespace(validate_context=lambda *args:None,helpers=lambda:(prepare,None),private=lambda *args:None,
                read=lambda p:json.loads(p.read_text()),write=write,gates=lambda *args:None,CATALOG='SELECT fixture catalog')
            def command(args,**kwargs):
                commands.append(args)
                if args==['/usr/bin/node','--version']:return b'v22.0.0'
                assert args[0].endswith('/pg_ctl') and str(data) in args
                assert '--clean' not in args
                return b''
            restore=types.SimpleNamespace(cap_module=lambda:cap,verify_download=lambda cap:source,SNAPSHOT='accepted',DATA=data,
                SOCKET=socket,DB='passvero_staging_recovery',PG='/usr/lib/postgresql/16/bin/',run=command,
                acl_baseline=lambda parents:baseline,ACL_NAME='system.posix_acl_access',traversal_acl=lambda uid:b'acl',get_acl=lambda p:b'acl')
            def sql(query):
                if query==cap.CATALOG:return {'fixture':'changed'} if fault=='catalog' else {'fixture':'catalog'}
                return {'data':str(data),'tcp':'','port':'55434','readonly':'on'}
            restore.sql=sql
            real_lstat=pathlib.Path.lstat
            def lstat(p):
                info=real_lstat(p)
                return types.SimpleNamespace(st_mode=info.st_mode,st_uid=501 if p in (data,socket) else 0)
            def node_run(args,**kwargs):
                node_calls.append(args)
                self.assertEqual(set(kwargs['env']),{'PATH','LANG','NODE_PATH'})
                self.assertEqual(kwargs['env']['NODE_PATH'],str(app/'node_modules'))
                if '-e' in args:return types.SimpleNamespace(returncode=0,stdout=b'PASS')
                result={'applicationRead':'PASS_PRIVATE_RECOVERY_PORTS','schemaWrites':'NONE','businessWrites':'NONE','smtpCalls':0,
                    'product':'PASS_APPLICATION_CATALOG_EXPORT','pdf':'PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA',
                    'image':'PASS_APPLICATION_DOWNLOAD_AND_RECHECK'}
                return types.SimpleNamespace(returncode=1 if fault=='application' else 0,stdout=json.dumps(result).encode())
            for name,value in [('ROOT',root),('CONTROL',control),('APP',app),('TARGET',target)]:stack.enter_context(patch.object(A,name,value))
            stack.enter_context(patch.object(A,'helper',return_value=restore))
            stack.enter_context(patch.object(A.os,'geteuid',return_value=0))
            stack.enter_context(patch.object(A.os,'uname',return_value=types.SimpleNamespace(nodename='srv1834647')))
            stack.enter_context(patch.object(A.pwd,'getpwnam',return_value=types.SimpleNamespace(pw_uid=501)))
            stack.enter_context(patch.object(pathlib.Path,'lstat',lstat))
            stack.enter_context(patch.object(A.os,'setxattr',create=True))
            stack.enter_context(patch.object(A.subprocess,'run',side_effect=node_run))
            mask=os.umask(0o077)
            try:
                if fault and fault!='stalecheckout':
                    with self.assertRaises(RuntimeError),contextlib.redirect_stdout(io.StringIO()):A.main()
                    if fault in ('bundle','source','attempt','canonical','runtime','provenance'):
                        self.assertFalse(any('start' in c for c in commands))
                else:
                    with contextlib.redirect_stdout(io.StringIO()) as output:A.main()
                    summary=json.loads(output.getvalue().splitlines()[-1])
                    self.assertTrue(summary['catalogUnchanged'])
                    self.assertEqual(summary['deployedArtifactFilesMatched'],1)
                    self.assertFalse(summary['rawCheckoutIsExecutionIdentity'])
                    self.assertEqual(summary['webServiceRecovery'],'NOT_TESTED')
                    self.assertEqual(summary['storageProviderRestore'],'NOT_PERFORMED')
                    self.assertEqual(len([c for c in commands if 'start' in c]),1)
                    self.assertEqual(len([c for c in commands if 'stop' in c]),1)
                    self.assertTrue((control/'application-recovery-artifact-summary.json').is_file())
                self.assertFalse(any('pg_restore' in c[0] or 'initdb' in c[0] for c in commands))
                self.assertFalse(any('/var/run/postgresql' in c for c in commands))
            finally:os.umask(mask)
    def test_full_private_application_operator_contract(self):self.fixture()
    def test_changed_bundle_stops_before_cluster_start(self):self.fixture('bundle')
    def test_changed_executable_artifact_stops_before_cluster_start(self):self.fixture('source')
    def test_existing_attempt_stops_before_cluster_start(self):self.fixture('attempt')
    def test_application_error_preserves_stop_without_summary(self):self.fixture('application')
    def test_stale_or_missing_raw_checkout_does_not_invalidate_matching_executable_artifacts(self):self.fixture('stalecheckout')
    def test_canonical_manifest_mismatch_stops_before_cluster_start(self):self.fixture('canonical')
    def test_runtime_dependency_change_stops_before_cluster_start(self):self.fixture('runtime')
    def test_provenance_change_stops_before_cluster_start(self):self.fixture('provenance')
    def test_catalog_change_during_read_blocks_summary(self):self.fixture('catalog')

if __name__=='__main__':unittest.main()
