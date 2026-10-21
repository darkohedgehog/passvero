# VPS TERMINAL / PENDING_OPERATOR_COMMAND
# SEPARATE CONDITIONAL APPROVAL REQUIRED AFTER BLOCK11 FAILURE REVIEW.
# Not part of the normal success path. Does not restore signature trust.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_RECOVERY_12'
import hashlib, importlib.util, json, os, pathlib, stat, subprocess
P=pathlib.Path
H=P('/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py')
O=P('/var/lib/passvero-signature-continuity-20261021-01/rollback')
ID='recovery-20261021-continuity-01'
CLOSE="import hashlib, importlib.util, json, os, pathlib, stat\nP=pathlib.Path\nO=P('/var/lib/passvero-signature-continuity-20261021-01/rollback')\nH=P('/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py')\nID='recovery-20261021-continuity-01'\nresult={'automaticRetry':False,'attempt':ID}\ntry:\n    st=H.lstat()\n    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and not st.st_mode & 0o022 and st.st_nlink==1\n    assert hashlib.sha256(H.read_bytes()).hexdigest()=='0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44'\n    spec=importlib.util.spec_from_file_location('accepted_recovery',H)\n    h=importlib.util.module_from_spec(spec); spec.loader.exec_module(h)\n    with h.exclusive(h.RECORDS/'operator.lock'):\n        host=h.LinuxHost(ID)\n        state=h.read_state(host.archive/'state.json')\n        if state is None:\n            result['closure']='NO_RECOVERY_PHASE_STARTED_NO_SERVICE_ACTION'\n        else:\n            if state.get('phase')=='ROLLED_BACK':\n                h.require(h.active(h.TIMER) in ('inactive','failed'),'ROLLBACK_TIMER_NOT_DISABLED')\n                value=h.run(['/usr/bin/systemctl','is-enabled',h.TIMER],success=False)\n                h.require(value.stdout.strip()==b'disabled','ROLLBACK_TIMER_NOT_DISABLED')\n                result['closure']='PASS_EXPLICIT_ROLLBACK_PRODUCER_DISABLED_TRUST_NOT_RESTORED'\n            else:\n                host.contain()\n                result['closure']='FAIL_CLOSED_ROLLBACK_INCOMPLETE_OPERATOR_REVIEW'\n                result['phase']=state.get('phase','UNKNOWN')\n    h.write_state(O/'closure.json',result)\nexcept BaseException as error:\n    result.update(closure='PARTIAL_CONTAINMENT_REQUIRES_OPERATOR_REVIEW',reason=type(error).__name__)\n    fd=os.open(O/'closure-failure.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)\n    with os.fdopen(fd,'w') as stream: json.dump(result,stream);stream.flush();os.fsync(stream.fileno())\n    raise SystemExit(1)\n"
if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise SystemExit('HOST_IDENTITY_REQUIRED')
os.umask(0o077)
for p in (H,*H.parents):
    st=p.lstat()
    if stat.S_ISLNK(st.st_mode) or st.st_uid!=0 or st.st_mode & 0o022:raise SystemExit('PROTECTED_HELPER_REQUIRED')
if hashlib.sha256(H.read_bytes()).hexdigest()!='0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44':raise SystemExit('HELPER_CHANGED')
spec=importlib.util.spec_from_file_location('accepted_recovery',H)
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
with h.exclusive(h.RECORDS/'operator.lock'):
    host=h.LinuxHost(ID)
    h.private(host.archive,directory=True)
    phase=h.read_state(host.archive/'state.json')['phase']
    h.require(phase in h.PHASES,'ONLY_FAILED_INCOMPLETE_OWN_ATTEMPT_ALLOWED')
    h.require(not O.exists(),'ROLLBACK_ALREADY_ATTEMPTED')
# Only after separate approval and review of block11 output. Exclusive operator
# window remains required. No automatic rollback or second recovery attempt.
O.mkdir(mode=0o700)
cmd=' '.join(json.dumps(s) for s in ['/usr/bin/python3','-I','-B','-c',CLOSE])
args=['/usr/bin/systemd-run','--quiet','--wait','--unit','passvero-signature-continuity-20261021-rollback',
 '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL',
 '--property=RuntimeMaxSec=9min','--property=TimeoutStopSec=20s','--property=UMask=0077',
 '--property=StandardOutput=append:'+str(O/'rollback-output.log'),'--property=StandardError=null',
 '--property=ExecStopPost='+cmd,'/usr/bin/python3','-I','-B',str(H),'rollback','--id',ID]
result={'attempt':ID,'automaticRetry':False,'SCAN_CALLS':0,'LOCK_REMOVAL_REPEATED':'NO'}
try:result['unitReturnCode']=subprocess.run(args,capture_output=True,text=True,timeout=590).returncode
except BaseException as error:result['reason']=type(error).__name__
finally:
    for name in ('closure.json','closure-failure.json'):
        result[name]=json.loads((O/name).read_text()) if (O/name).exists() else None
    result['phase']=h.read_state(host.archive/'state.json')['phase']
    result['instruction']='RETURN_OUTPUT_AND_STOP_NO_RETRY_NO_AUTOMATIC_TIMER_ENABLE'
    h.write_state(O/'operator-result.json',result)
    print(json.dumps(result,indent=2))
PASSVERO_RECOVERY_12
