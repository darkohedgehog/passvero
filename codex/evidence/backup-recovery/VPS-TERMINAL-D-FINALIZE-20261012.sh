# PENDING_OPERATOR_COMMAND — VPS TERMINAL D: one controlled no-Telegram check, then guarded finalize
sudo /usr/bin/python3 -I -B - <<'PASSVERO_STAGING_D_ONCE'
import hashlib,importlib.util,json,os,pathlib,re,subprocess
code=pathlib.Path('/usr/local/libexec/passvero-staging-backup')
state=pathlib.Path('/var/lib/passvero-staging-recovery/recurring')
a=None;fd=None;check_id='PINNED_D_HELPERS'
def units():
    body=subprocess.run(['/usr/bin/systemctl','show','passvero-staging-backup.timer',
        'passvero-staging-backup-monitor.timer','passvero-subscription-reminders.timer',
        'passvero-subscription-reminders.service',
        '--property=Id,ActiveState,SubState,UnitFileState,LastTriggerUSec,NextElapseUSecRealtime'],
        check=True,capture_output=True,text=True).stdout
    rows={}
    for section in body.strip().split('\n\n'):
        row=dict(line.split('=',1) for line in section.splitlines() if '=' in line)
        if 'Id' in row:rows[row['Id']]=row
    return rows
try:
    pins={'recurring.py':'14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
          'recurring_acceptance.py':'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
          'config.json':'399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'}
    for name,pin in pins.items():
        path=code/name;info=path.lstat()
        assert info.st_uid==0 and not info.st_mode&0o077 and not path.is_symlink(),'PIN_POSTURE'
        assert hashlib.sha256(path.read_bytes()).hexdigest()==pin,'PIN_CHANGED'
    spec=importlib.util.spec_from_file_location('accepted_d',code/'recurring_acceptance.py')
    a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
    config,helpers=a.r.scope();fd=a.r.lock(state/'job.lock')
    check_id='ACCEPTED_A_B_C_AND_NO_TELEGRAM'
    row=a.selected(config,helpers)
    assert row['setId']=='20261012T043000Z','LATEST_SET_CHANGED'
    target=a.r.ROOT/'restore'/row['setId']
    assert a.r.read(target/'summary.json')['restore']=='PASS_LATEST_NEW_B2_DB_AND_FILES','B_REQUIRED'
    closure=a.r.read(target/'resume-closure.json')
    assert closure['cluster']=='STOPPED' and closure['parentPermissions']=='PRIVATE_0700','B_CLOSURE_REQUIRED'
    c=a.r.read(state/'retention.json')
    assert c['retention']=='PASS_DRY_RUN_ONLY' and c['deletedSnapshots']==0 and c['productionCandidates']==0,'C_REQUIRED'
    assert config['testTelegramApproved'] is False,'NO_TEST_TELEGRAM_REQUIRED'
    assert not (state/'signal-proof.json').exists() and not (state/'controlled-dedup.json').exists() and not (state/'d-attempt.json').exists(),'D_BUDGET_ONE'
    before=a.r.read(state/'state.json');before_units=units()
    for name in ('passvero-staging-backup.timer','passvero-staging-backup-monitor.timer'):
        assert before_units[name]['ActiveState']=='active' and before_units[name]['UnitFileState']=='enabled','SCHEDULE_BASELINE_REQUIRED'
    a.r.atomic(state/'d-attempt.json',{'latestSet':row['setId'],'automaticRetry':False,'testTelegram':False})
    check_id='ONE_CONTROLLED_SIGNAL_CHECK'
    a.signals(config,helpers)
    proof=a.r.read(state/'signal-proof.json')
    assert proof['signals']=='PASS_CONTROLLED_NO_LIVE_BACKUP_CORRUPTION','D_REQUIRED'
    assert proof['telegramTest']=='NOT_APPROVED_NOT_SENT' and proof['liveBackupStateAltered'] is False,'NO_LIVE_SIGNAL_MUTATION'
    assert a.r.read(state/'state.json')==before,'SIGNAL_CHANGED_BACKUP_STATE'
    check_id='GUARDED_A_D_CONTINUOUS_PROMOTION'
    a.finalize(config,helpers)
    expected=dict(before);expected['mode']='CONTINUOUS'
    after=a.r.read(state/'state.json');assert after==expected,'UNEXPECTED_FINAL_STATE_CHANGE'
    after_units=units()
    for name in ('passvero-staging-backup.timer','passvero-staging-backup-monitor.timer'):
        assert after_units[name]['ActiveState']=='active' and after_units[name]['UnitFileState']=='enabled','SCHEDULE_NOT_ENABLED'
    for name in ('passvero-subscription-reminders.timer','passvero-subscription-reminders.service'):
        for key in ('ActiveState','SubState','UnitFileState'):
            assert after_units[name][key]==before_units[name][key],'WRITER_BASELINE_CHANGED'
    for name,pin in pins.items():assert hashlib.sha256((code/name).read_bytes()).hexdigest()==pin,'PIN_CHANGED'
    output={'D':'PASS','acceptance':a.r.read(state/'acceptance.json'),'signals':proof,
            'state':after,'units':after_units,'restoreClosure':closure,'pinsUnchanged':True,
            'automaticRetry':False,'snapshotDeletion':'NOT_PERFORMED'}
    monitor=state/'monitor-result.json'
    if monitor.is_file():output['lastMonitorResult']=a.r.read(monitor)
    print(json.dumps(output,indent=2,sort_keys=True))
except BaseException as error:
    reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
    result={'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}
    if a is not None and fd is not None and not (state/'d-first-failure.json').exists():a.r.atomic(state/'d-first-failure.json',result)
    print(json.dumps(result,sort_keys=True))
    raise SystemExit(1)
finally:
    if fd is not None:os.close(fd)
PASSVERO_STAGING_D_ONCE
