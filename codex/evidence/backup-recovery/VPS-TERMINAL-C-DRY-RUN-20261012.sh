# PENDING_OPERATOR_COMMAND — VPS TERMINAL C: one approved staging-only retention dry-run
sudo /usr/bin/python3 -I -B - <<'PASSVERO_STAGING_C_ONCE'
import hashlib,importlib.util,json,pathlib,re,subprocess
code=pathlib.Path('/usr/local/libexec/passvero-staging-backup')
state=pathlib.Path('/var/lib/passvero-staging-recovery/recurring')
check_id='PINNED_C_HELPERS';a=None;fd=None
try:
    pins={'recurring.py':'14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
          'recurring_acceptance.py':'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
          'config.json':'399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'}
    for name,pin in pins.items():
        path=code/name;info=path.lstat()
        assert info.st_uid==0 and not info.st_mode&0o077 and not path.is_symlink(),'PIN_POSTURE'
        assert hashlib.sha256(path.read_bytes()).hexdigest()==pin,'PIN_CHANGED'
    spec=importlib.util.spec_from_file_location('accepted_c',code/'recurring_acceptance.py')
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    config,helpers=a.r.scope()
    fd=a.r.lock(state/'job.lock')
    check_id='ACCEPTED_A_B_AND_C_BUDGET'
    row=a.selected(config,helpers)
    assert row['setId']=='20261012T043000Z','LATEST_SET_CHANGED'
    target=a.r.ROOT/'restore'/row['setId']
    assert a.r.read(target/'summary.json')['restore']=='PASS_LATEST_NEW_B2_DB_AND_FILES','B_REQUIRED'
    closure=a.r.read(target/'resume-closure.json')
    assert closure['cluster']=='STOPPED' and closure['parentPermissions']=='PRIVATE_0700','B_CLOSURE_REQUIRED'
    assert not (state/'retention-attempt.json').exists() and not (state/'retention.json').exists(),'C_BUDGET_ONE'
    check_id='STAGING_REPOSITORY_AND_SELECTOR'
    repository=helpers['offsite'].Repository(helpers['prepare'])
    expected_repo='9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35'
    assert config['repositoryId']==expected_repo,'CONFIG_REPOSITORY_CHANGED'
    assert helpers['prepare'].PREFIX=='passvero-staging-recovery-v1','PREFIX_CHANGED'
    assert repository.repo.endswith('/passvero-staging-recovery-v1'),'REPOSITORY_PREFIX_CHANGED'
    assert json.loads(repository.run(['cat','config']))['id']==expected_repo,'REPOSITORY_CHANGED'
    candidates=a.r.select_snapshots(repository.snapshots())
    before_ids=sorted(x['id'] for x in candidates)
    assert row['snapshotId'] in before_ids,'ACCEPTED_SNAPSHOT_MISSING'
    print(json.dumps({'preflight':'PASS_STAGING_REPO_AND_SELECTOR',
        'repositoryId':expected_repo,'prefix':'passvero-staging-recovery-v1',
        'selector':{'host':'passvero-staging-recovery','tag':'passvero-staging-recovery','groupBy':'host',
                    'pathScope':'/var/lib/passvero-staging-recovery/sets/YYYYMMDDTHHMMSSZ'},
        'policy':{'daily':14,'weekly':8,'monthly':6},'snapshotCount':len(candidates),
        'dryRun':True,'noLock':True,'prune':False}),flush=True)
    check_id='ONE_REVIEWED_RETENTION_DRY_RUN'
    a.retention(config,helpers)
    check_id='DRY_RUN_RESULT_AND_INVENTORY'
    result=a.r.read(state/'retention.json')
    assert result['retention']=='PASS_DRY_RUN_ONLY' and result['deletedSnapshots']==0,'C_RESULT_REQUIRED'
    assert sorted(x['id'] for x in a.r.select_snapshots(repository.snapshots()))==before_ids,'SNAPSHOT_INVENTORY_CHANGED'
    print(json.dumps({'C':'PASS','retention':result,'snapshotInventoryUnchanged':True,
                      'automaticRetry':False,'D':'NOT_RUN'},indent=2,sort_keys=True))
except BaseException as error:
    reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
    result={'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}
    if a is not None and fd is not None and not (state/'c-first-failure.json').exists():
        a.r.atomic(state/'c-first-failure.json',result)
    print(json.dumps(result,sort_keys=True))
    raise SystemExit(1)
finally:
    if fd is not None:__import__('os').close(fd)
PASSVERO_STAGING_C_ONCE
