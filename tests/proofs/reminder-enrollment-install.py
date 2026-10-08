"""Operator guards tested without a server, database, systemd or SMTP."""
import importlib.util, pathlib, sys, tempfile, types, unittest
from unittest.mock import Mock, patch
ROOT=pathlib.Path(__file__).resolve().parents[2]
common=types.ModuleType('common')
for name in ['A','R','S']: setattr(common,name,pathlib.Path('/nonexistent')/name)
common.P=pathlib.Path
for name in ['sha','regular','run','identity','sql','scope','pm','monitor','execute','copy_prisma_runtime']: setattr(common,name,Mock())
sys.modules['common']=common
spec=importlib.util.spec_from_file_location('install',ROOT/'scripts/subscription-reminders/enrollment-install.py')
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)

class Guards(unittest.TestCase):
    def test_scheduler_metadata_can_advance_but_budget_cannot(self):
        base={'organizations':[], 'campaigns':[{'id':'1','maxDispatches':12,'dispatches':0,'lastStartedAt':None}], 'outbox':[], 'attemptCounts':[]}
        changed={**base,'campaigns':[{**base['campaigns'][0],'lastStartedAt':'later'}]}
        self.assertEqual(module.business_snapshot(base),module.business_snapshot(changed))
        changed['campaigns'][0]['dispatches']=1
        self.assertNotEqual(module.business_snapshot(base),module.business_snapshot(changed))

    def test_inventory_drift_prevents_timer_or_application_mutation(self):
        pre={key:'same' for key in ['scope','runtimeEndpoints','buildId','canonicalSha256','packageSha256','lockSha256','runtimeDependencies','workerSha256','launcherSha256']}
        pre['inventory']={'organizations':[], 'campaigns':[], 'outbox':[], 'attemptCounts':[], 'migrations':{}, 'futurePolicyTable':False}
        with tempfile.TemporaryDirectory() as directory:
            import json
            root=pathlib.Path(directory); (root/'preflight.json').write_text(json.dumps(pre))
            with patch.object(module,'S',root), patch.object(module,'R',root/'absent'), patch.object(module,'inventory',return_value={**pre,'buildId':'drift'}), patch.object(module,'run') as run, patch.object(module,'pm') as pm, patch.object(module,'scope'), patch.object(sys,'argv',['install','pin']):
                with self.assertRaisesRegex(AssertionError,'PREFLIGHT_RUNTIME_DRIFT'): module.main({})
                run.assert_not_called(); pm.assert_not_called()

    def test_migration_history_drift_prevents_prisma_execution(self):
        with patch.object(module,'sql',return_value='{"count":34}'), patch.object(module,'run') as run, patch.object(module,'copy_prisma_runtime') as copy:
            with self.assertRaisesRegex(AssertionError,'MIGRATION_HISTORY_DRIFT'): module.migrate({'prior_migrations':{'count':32}})
            run.assert_not_called(); copy.assert_not_called()

    def test_unsafe_artifact_path_is_rejected_before_file_read(self):
        with self.assertRaisesRegex(AssertionError,'ARTIFACT_PATH'): module.verify_artifacts(pathlib.Path('/nonexistent'),{'.next/../../secret':'hash'})

    def test_failed_install_restores_artifacts_before_propagating_failure(self):
        # Exercise orchestration with real state files and mocked OS/external boundaries.
        import json
        pre={'scope':{},'runtimeEndpoints':{},'buildId':'old','canonicalSha256':'pin','packageSha256':'pkg','lockSha256':'lock','runtimeDependencies':{},'workerSha256':'worker','launcherSha256':'launch','inventory':{'organizations':[],'campaigns':[],'outbox':[],'attemptCounts':[],'migrations':{'count':32},'futurePolicyTable':False}}
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory); package=root/'package'; package.mkdir(); (package/'preflight.json').write_text(json.dumps(pre)); worker=root/'worker'; worker.mkdir()
            for name in ['worker.cjs','launch.py']: (worker/name).write_text('previous')
            canonical=root/'canonical.json'; canonical.write_text('{}')
            with patch.multiple(module,S=package,R=root/'state',A=root/'app',CANONICAL=canonical,WORKER=worker), patch.object(module,'scope'), patch.object(module,'inventory',return_value=pre), patch.object(module,'run',side_effect=['enabled','active']), patch.object(module,'drain'), patch.object(module,'prepare_application',return_value=root/'prepared'), patch.object(module,'pm'), patch.object(module,'migrate',side_effect=AssertionError('INJECTED_MIGRATION_FAILURE')), patch.object(module,'rollback') as rollback, patch.object(sys,'argv',['install','pin']):
                with self.assertRaisesRegex(AssertionError,'INJECTED_MIGRATION_FAILURE'): module.main({'prior_migrations':{'count':32},'previous_build':'old'})
                rollback.assert_called_once()
                self.assertEqual((root/'state'/'previous-worker.cjs').read_text(),'previous')

    def test_rollback_restores_both_directories_worker_and_manifest_keeps_database(self):
        import hashlib, json
        def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory); app=root/'app'; app.mkdir(); state=root/'state'; state.mkdir(); worker=root/'worker'; worker.mkdir()
            oldfiles={}; newfiles={}
            for name,relative in [('.next','BUILD_ID'),('messages','hr.json')]:
                old=app/(name+module.BACKUP_SUFFIX); old.mkdir(); (old/relative).write_text('old')
                current=app/name; current.mkdir(); (current/relative).write_text('new')
                oldfiles[name+'/'+relative]={'sha256':digest(old/relative)}; newfiles[name+'/'+relative]=digest(current/relative)
            previous=json.dumps({'build_id':'old','files':oldfiles}).encode(); (state/'previous-canonical.json').write_bytes(previous)
            canonical=root/'canonical.json'; canonical.write_text(json.dumps({'build_id':'new','future_enrollment_manifest_sha256':'pin','files':newfiles}))
            (state/'state.json').write_text(json.dumps({'manifest':'pin','timerActive':True}))
            manifest={'previous_canonical':hashlib.sha256(previous).hexdigest(),'previous_build':'old','build_id':'new','application_files':newfiles}
            for name in ['worker.cjs','launch.py']:
                (state/('previous-'+name)).write_text('oldworker'); (worker/name).write_text('newworker'); manifest['previous_'+name.split('.')[0]]=digest(state/('previous-'+name))
            with patch.multiple(module,A=app,R=state,WORKER=worker,CANONICAL=canonical), patch.object(module,'sha',side_effect=digest), patch.object(module,'scope'), patch.object(module,'drain'), patch.object(module,'sql',side_effect=['0','f']) as sql, patch.object(module,'pm') as pm, patch.object(module,'healthy'), patch.object(module,'run') as run, patch.object(sys,'argv',['install','pin','rollback']):
                module.rollback(manifest)
                self.assertEqual(canonical.read_bytes(),previous)
                self.assertEqual((app/'.next/BUILD_ID').read_text(),'old')
                self.assertEqual((app/('messages'+module.FAILED_SUFFIX)/'hr.json').read_text(),'new')
                self.assertEqual((worker/'worker.cjs').read_text(),'oldworker')
                self.assertTrue((state/'rollback-report.json').is_file())
                self.assertFalse(any('DROP' in call.args[0] or 'DELETE' in call.args[0] for call in sql.call_args_list))
                run.assert_called_once_with(['systemctl','start',module.TIMER])

if __name__=='__main__': unittest.main(verbosity=2)
