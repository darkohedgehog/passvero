# VPS TERMINAL / PENDING_OPERATOR_COMMAND
# NOT AUTHORIZED YET. One exclusive operator window; no parallel root recovery.
# Mutates scanner state and performs official signature downloads; no PDF scan.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_RECOVERY_11'
import hashlib, importlib.util, json, os, pathlib, re, stat, subprocess
P=pathlib.Path
ID='recovery-20261021-continuity-01'
O=P('/var/lib/passvero-signature-continuity-20261021-01')
H=P('/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py')
UNIT='passvero-signature-continuity-20261021-01'
CLOSE="import hashlib, importlib.util, json, os, pathlib, stat\nP=pathlib.Path\nO=P('/var/lib/passvero-signature-continuity-20261021-01')\nH=P('/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py')\nID='recovery-20261021-continuity-01'\nresult={'automaticRetry':False,'attempt':ID}\ntry:\n    st=H.lstat()\n    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and not st.st_mode & 0o022 and st.st_nlink==1\n    assert hashlib.sha256(H.read_bytes()).hexdigest()=='0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44'\n    spec=importlib.util.spec_from_file_location('accepted_recovery',H)\n    h=importlib.util.module_from_spec(spec); spec.loader.exec_module(h)\n    with h.exclusive(h.RECORDS/'operator.lock'):\n        host=h.LinuxHost(ID)\n        state=h.read_state(host.archive/'state.json')\n        if state is None:\n            result['closure']='NO_RECOVERY_PHASE_STARTED_NO_SERVICE_ACTION'\n        else:\n            accepted=False\n            if state.get('phase')=='COMPLETE':\n                try: accepted=host.accepted()\n                except Exception: accepted=False\n            if accepted:\n                result['closure']='PASS_COMPLETE_EXISTING_READER_ACCEPTED'\n            else:\n                host.contain()\n                result['closure']='FAIL_CLOSED_ARTIFACTS_RETAINED_EXPLICIT_ROLLBACK_REQUIRED'\n                result['phase']=state.get('phase','UNKNOWN')\n    h.write_state(O/'closure.json',result)\nexcept BaseException as error:\n    result.update(closure='PARTIAL_CONTAINMENT_REQUIRES_OPERATOR_REVIEW',reason=type(error).__name__)\n    fd=os.open(O/'closure-failure.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)\n    with os.fdopen(fd,'w') as stream: json.dump(result,stream);stream.flush();os.fsync(stream.fileno())\n    raise SystemExit(1)\n"

def need(ok, reason):
    if not ok: raise RuntimeError(reason)
def digest(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def protected(p):
    for q in (p,*p.parents):
        st=q.lstat()
        need(not stat.S_ISLNK(st.st_mode) and st.st_uid==0 and not st.st_mode & 0o022,'PROTECTED_PATH_REQUIRED')
    need(stat.S_ISREG(p.lstat().st_mode) and p.lstat().st_nlink==1,'REGULAR_SINGLE_LINK_REQUIRED')
def show(unit, names):
    result=subprocess.run(['/usr/bin/systemctl','show',unit,*['--property='+n for n in names]],capture_output=True,text=True,timeout=10,check=True)
    return dict(line.split('=',1) for line in result.stdout.splitlines() if '=' in line)
def save(name, obj):
    fd=os.open(O/name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w') as stream:json.dump(obj,stream,indent=2);stream.write('\n');stream.flush();os.fsync(stream.fileno())

result={'attempt':ID,'automaticRetry':False,'RECOVERY_EXECUTED':'NO','SCAN_CALLS':0,'LOCK_REMOVAL_REPEATED':'NO'}
started=False
try:
    need(os.geteuid()==0 and os.uname().nodename=='srv1834647','HOST_IDENTITY_REQUIRED')
    os.umask(0o077)
    protected(H)
    need(digest(H)=='0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44','HELPER_CHANGED')
    spec=importlib.util.spec_from_file_location('accepted_recovery',H)
    h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    pins={str(h.CONFIG):'28df856a3a8516f8c33d35bc652b5358dd0dcdd49d185be01a64eb1264a22593',
      str(h.PACKAGE/'pins.json'):'24f0c02990df2c255269923c44a2a470bde1c5f1dd69b3d8f30a056b5c77c44d',
      str(h.PACKAGE/'producer.cjs'):'725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b',
      str(h.PRODUCER):'725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b',
      str(h.PACKAGE/'reader.cjs'):'877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62',
      '/etc/systemd/system/passvero-signature-health.service':'5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe',
      '/etc/systemd/system/passvero-signature-health.timer':'5db45222db3785a90940b52f8480e2eeb1b912083c111aca18e70ff0075902f4'}
    for name,pin in pins.items():protected(P(name));need(digest(P(name))==pin,'EXACT_INPUT_CHANGED')
    need(P('/var/www/passvero-acceptance/.next/BUILD_ID').read_text().strip()=='_tkSUOn0PCoHjpx8V7FVr','BUILD_CHANGED')
    need(digest(P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json'))=='e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590','CANONICAL_CHANGED')
    need(show(UNIT,['LoadState'])['LoadState']=='not-found','UNIT_ALREADY_USED')
    with h.exclusive(h.RECORDS/'operator.lock'):
        host=h.LinuxHost(ID);host.guard()
        need(not host.archive.exists() and not host.db.exists() and not host.up_log.exists() and not host.da_log.exists(),'ATTEMPT_PATH_ALREADY_EXISTS')
        for p in h.RECORDS.glob('*/state.json'):
            need(h.read_state(p).get('phase') in ('COMPLETE','ROLLED_BACK'),'UNRESOLVED_PREVIOUS_ATTEMPT')
        need(not P(str(h.HEALTH)+'.lock').exists(),'PRODUCER_LOCK_PRESENT_NO_REMOVAL')
        timer=show(h.TIMER,['Id','LoadState','ActiveState','SubState','UnitFileState'])
        need(timer['Id']==h.TIMER and timer['LoadState']=='loaded' and timer['ActiveState']=='active' and timer['UnitFileState']=='enabled','TIMER_BASELINE_CHANGED')
        for u in (h.SERVICE,h.TIMER,h.UPDATER,h.CLAMD,h.SOCKET):
            facts=show(u,['Id','LoadState','NeedDaemonReload','Job'])
            need(facts['Id']==u and facts['LoadState']=='loaded' and facts['NeedDaemonReload']=='no' and facts.get('Job','') in ('','0'),'UNIT_JOB_OR_RELOAD_PENDING')
        # This flock is a preflight, not a reservation: exclusive operator window
        # remains required. The unchanged helper reacquires it before any phase.
    need(not O.exists(),'OPERATOR_BLOCK_ALREADY_ATTEMPTED')
    O.mkdir(mode=0o700)
    save('baseline.json',{'timer':timer,'configSha256':pins[str(h.CONFIG)],'helperSha256':digest(H),'attempt':ID,'exclusiveOperatorWindowRequired':True})
    # systemd command-line grammar uses C-quoted arguments, no shell wrapper.
    close_command=' '.join(json.dumps(s) for s in ['/usr/bin/python3','-I','-B','-c',CLOSE])
    args=['/usr/bin/systemd-run','--quiet','--wait','--unit',UNIT,
      '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL',
      '--property=RuntimeMaxSec=9min','--property=TimeoutStopSec=20s','--property=UMask=0077',
      '--property=StandardOutput=append:'+str(O/'recovery-output.log'),'--property=StandardError=null',
      '--property=ExecStopPost='+close_command,
      '/usr/bin/python3','-I','-B',str(H),'recover','--id',ID]
    save('submission.json',{'attempt':ID,'maximumRuns':1,'automaticRetry':False})
    started=True
    completed=subprocess.run(args,capture_output=True,text=True,timeout=590)
    result['unitReturnCode']=completed.returncode
except BaseException as error:
    result['reason']=str(error) if type(error) is RuntimeError else type(error).__name__
    result['instruction']='STOP_NO_RETRY_RETURN_OUTPUT'
finally:
    if started:
        # Never launch another helper/closure from this driver. ExecStopPost is
        # systemd-owned and survives loss of this terminal/driver.
        result['unit']=show(UNIT,['LoadState','ActiveState','SubState','Result'])
        for name in ('closure.json','closure-failure.json'):
            result[name]=json.loads((O/name).read_text()) if (O/name).exists() else None
        state=host.archive/'state.json'
        result['units']={u:show(u,['Id','LoadState','ActiveState','SubState','UnitFileState']) for u in (h.TIMER,h.SERVICE,h.UPDATER,h.CLAMD,h.SOCKET)}
        result['phase']=h.read_state(state).get('phase') if state.exists() else 'NOT_STARTED'
        result['RECOVERY_EXECUTED']='YES' if state.exists() else 'NO'
        result['firstFailure']='NOT_RECORDED'
        output=O/'recovery-output.log'
        if output.exists():
            text=output.read_text();decoder=json.JSONDecoder()
            while text.strip():
                try:obj,end=decoder.raw_decode(text.lstrip())
                except ValueError:break
                text=text.lstrip()[end:]
                if obj.get('recovery')=='STOP':
                    reason=obj.get('reason','')
                    result['firstFailure']=reason if re.fullmatch('[A-Za-z0-9_]{1,120}',reason) else 'UNNORMALIZED_NOT_EXPOSED'
                elif obj.get('recovery')=='RECOVERED':
                    result['scheduledPublications']=obj.get('scheduled_publications')
                    result['reader']=obj.get('staging_reader')
        good=(result.get('unitReturnCode')==0 and result.get('phase')=='COMPLETE'
              and (result.get('closure.json') or {}).get('closure')=='PASS_COMPLETE_EXISTING_READER_ACCEPTED'
              and result.get('closure-failure.json') is None)
        result['status']='PASS_RECOVERY_PENDING_USER_UI' if good else 'STOP_RETAIN_EVIDENCE_NO_RETRY'
        save('operator-result.json',result)
    print(json.dumps(result,indent=2))
PASSVERO_RECOVERY_11
