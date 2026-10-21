# VPS TERMINAL / PENDING_OPERATOR_COMMAND — restore saved writer after pre-reboot abort
# Only after reviewed QUIESCE trigger STOP and partial closure; no reboot/retry/worker invocation.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_REBOOT_PHASE'
import json,re
try:
    import hashlib,importlib.util,json,os,pathlib,stat
    P=pathlib.Path
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
    root=P('/var/lib/passvero-reboot-recovery-20261014')
    st=root.lstat();assert stat.S_ISDIR(st.st_mode) and not root.is_symlink() and st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o700,'ROOT_POSTURE'
    expected_manifest='9d165f83cecc87aa5a3cee557d36fc2c95f043f13bd32d345b5a4cef06eda622'
    manifest=root/'package.json'
    assert not manifest.is_symlink() and hashlib.sha256(manifest.read_bytes()).hexdigest()==expected_manifest,'PACKAGE_MANIFEST_CHANGED'
    for name,pin in json.loads(manifest.read_text())['files'].items():
     path=root/name;info=path.lstat()
     assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_uid==0 and not info.st_mode&0o077,'SOURCE_POSTURE'
     assert hashlib.sha256(path.read_bytes()).hexdigest()==pin,'REVIEWED_SOURCE_CHANGED'
    spec=importlib.util.spec_from_file_location('one_reviewed_reboot',root/'reboot-reviewed.py')
    h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    with h.locked(root/'operation.lock'):
        h.require(not (root/'abort-writer-resume-intent.json').exists(), 'ONE_ABORT_RESUME_ONLY')
        failure=h.data('first-failure.json'); baseline=h.data('baseline.json'); closure=h.data('closure.json')
        h.require(failure['CHECK_ID']=='QUIESCE' and failure['reason']=='UNREVIEWED_SENDING_TRIGGER', 'OTHER_FAILURE_NOT_REVIEWED')
        h.require(closure['closure']=='PARTIAL_AUTOMATION_RESTORE' and set(closure['pending'])=={'passvero-subscription-reminders.timer'}, 'OTHER_CLOSURE_NOT_REVIEWED')
        h.require(h.boot_id()==baseline['bootId'], 'BOOT_CHANGED_ABORT_RESUME_NOT_ALLOWED')
        for name in ('reboot-intent.json','quiesced.json','startup-attempt.json','auth-pass.json','scanner-attempt.json','flow-pass.json'):
            h.require(not (root/name).exists(), 'LATER_OPERATION_PHASE_PRESENT')
        base,scoped,deploy=h.components()
        with h.locked(h.BACKUP/'job.lock'):
            h.unchanged(); h.release(deploy); deploy.idle(); base.jobs()
            base.runtime(); h.require(h.http('https://staging.passvero.eu/')=='200 0', 'STAGING_NOT_READY')
            production=h.production()
            h.require(h.unit('passvero-reboot-scanner-20261014.service')['ActiveState'] in ('inactive','failed'), 'SCANNER_OPERATION_ACTIVE')
            timer='passvero-subscription-reminders.timer'; service='passvero-subscription-reminders.service'
            for path,pin in {
              '/etc/systemd/system/passvero-subscription-reminders.timer':'585a8e11b9279ab5b3c8b82ba0215eb85e03c43ae887654fc8e3ed8d177335ab',
              '/etc/systemd/system/passvero-subscription-reminders.service':'256207cc6675d90956b135c4e4a07938ea0fde5749659a2416a7c35ea9fb56cc'
            }.items():
                info=P(path).lstat()
                h.require(info.st_uid==0 and not info.st_mode&0o022 and h.sha(h.read(P(path)))==pin, 'WRITER_UNIT_DRIFT')
            h.require(baseline['timers'][timer]['ActiveState']=='active' and baseline['timers'][timer]['UnitFileState']=='enabled', 'BASELINE_WRITER_NOT_ENABLED')
            t=h.unit(timer); s=h.unit(service)
            h.require(t['ActiveState']=='inactive' and t['UnitFileState']=='disabled' and s['ActiveState']=='inactive', 'WRITER_NOT_PAUSED_IDLE')
            h.require(not t.get('DropInPaths') and not h.run(['/usr/bin/systemctl','show',timer,service,'--property=DropInPaths','--value']).strip(), 'WRITER_DROPIN_NOT_REVIEWED')
            for name in h.TIMERS[:2]:
                value=h.unit(name)
                h.require(value['ActiveState']=='active' and value['UnitFileState']=='enabled' and deploy.timer_due(name)==baseline['due'][name], 'RESTORED_BACKUP_TIMER_DRIFT')
            h.require(base.reminders()['safeToFinalizePause'], 'UNRESOLVED_SENDING_STOP')
            h.require(h.delivery(base)==baseline['delivery'], 'DELIVERY_HISTORY_CHANGED_BEFORE_RESUME')
            h.record('abort-writer-resume-intent.json', {'scope':'RESTORE_SAVED_WRITER_AFTER_PRE_REBOOT_ABORT','automaticRetry':False,'rebootRequested':False})
            h.run(['/usr/bin/systemctl','enable','--now',timer])
            t=h.unit(timer); s=h.unit(service)
            h.require(t['ActiveState']=='active' and t['UnitFileState']=='enabled' and s['TriggeredBy']==timer, 'WRITER_BASELINE_RESTORE_NOT_VERIFIED')
            result={'closure':'PASS_ABORTED_BEFORE_REBOOT_BASELINE_RESTORED','writerTimer':t,'writerService':s,'backupStateUnchanged':h.sha(h.read(h.BACKUP/'state.json'))==baseline['backupSha256'],'production':production,'ordinaryApprovedSending':'RESUMED_BY_SAVED_TIMER_NO_MANUAL_WORKER_CALL','firstFailureAndPartialClosure':'RETAINED','automaticStartup':'NOT_PROVEN','rebootRequested':False,'automaticRetry':False}
            h.record('abort-writer-resume-pass.json',result)
            print(json.dumps(result,indent=2,sort_keys=True))
except SystemExit:
    raise
except BaseException as error:
    reason=str(error) if re.fullmatch("[A-Z0-9_]{1,160}",str(error)) else type(error).__name__
    print(json.dumps({"result":"STOP","CHECK_ID":'ABORT_WRITER_BASELINE_RESTORE',"reason":reason,"automaticRetry":False}))
    raise SystemExit(1)
PASSVERO_REBOOT_PHASE
