# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one existing-helper continuation after exact timer review
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_RESUME_AFTER_TIMER_REVIEW'
import fcntl,hashlib,importlib.util,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
helper=root/'deploy-resume-prepared.py'
check_id='REVIEWED_EXISTING_HELPER_AND_TIMER_WINDOW';fd=None
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST'
 os.umask(0o077)
 info=helper.lstat()
 assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077,'HELPER_POSTURE'
 assert hashlib.sha256(helper.read_bytes()).hexdigest()=='497c298b074574120c863c4d1b904dd9dc311f8f22a999e1f58d5c8fada5fb76','HELPER_CHANGED'
 spec=importlib.util.spec_from_file_location('reviewed_prepared_continuation',helper)
 h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
 assert not (root/'attempt.json').exists() and not (root/'resume-attempt.json').exists(),'COORDINATION_ALREADY_RESERVED'
 assert not (root/'timer-reviewed-continuation.json').exists(),'REVIEWED_CONTINUATION_BUDGET_ONE'
 fd=os.open(h.BACKUP/'job.lock',os.O_RDONLY|os.O_NOFOLLOW)
 fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 h.idle()
 margins={name:h.timer_due(name)-time.time() for name in h.TIMERS}
 assert all(value>1200 for value in margins.values()),'CURRENT_WINDOW_TOO_CLOSE_STOP_NO_MUTATION'
 for name in h.TIMERS:
  current=h.unit(name)
  assert current['ActiveState']=='active' and current['UnitFileState']=='enabled','TIMER_BASELINE_CHANGED'
 assert hashlib.sha256(h.read(h.CODE/'config.json')).hexdigest()==h.OLD_CONFIG,'OLD_CONFIG_CHANGED'
 assert hashlib.sha256(h.read(h.CANONICAL)).hexdigest()==h.OLD_CANONICAL,'OLD_CANONICAL_CHANGED'
 expected_failure={'result':'STOP','CHECK_ID':'PREPARE_AND_PRESERVE','reason':'NEXT_REGULAR_TERM_TOO_CLOSE_STOP','automaticRetry':False}
 expected_closure={'coordination':'NOT_STARTED','rollback':'NOT_NEEDED','timerChanges':'NONE'}
 assert json.loads(h.read(root/'resume-first-failure.json'))==expected_failure,'PREVIOUS_RESUME_FAILURE_CHANGED'
 assert json.loads(h.read(root/'resume-closure.json'))==expected_closure,'PREVIOUS_RESUME_CLOSURE_CHANGED'
 for name in ('resume-first-failure','resume-closure'):
  assert not (root/(name+'-before-timer-review.json')).exists(),'HISTORY_ARCHIVE_ALREADY_EXISTS'
 # Preserve exact earlier STOP/closure; no backup state/counter/pin changes.
 h.record('timer-reviewed-continuation.json',{'automaticRetry':False,'existingPreparationReused':True,'timerMarginsSeconds':margins})
 for name in ('resume-first-failure','resume-closure'):
  (root/(name+'.json')).rename(root/(name+'-before-timer-review.json'))
 os.close(fd);fd=None
 check_id='ONE_EXISTING_HELPER_UNIT_WITH_INDEPENDENT_CLOSE'
 args=['/usr/bin/systemd-run','--quiet','--wait',
  '--unit','passvero-marketing-pin-alignment-20261012-after-timer-review',
  '--property=Type=exec','--property=Restart=no','--property=KillMode=control-group',
  '--property=KillSignal=SIGKILL','--property=RuntimeMaxSec=8min','--property=TimeoutStopSec=180s',
  '--property=StandardOutput=null','--property=StandardError=null',
  '--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' --close',
  '/usr/bin/python3','-I','-B',str(helper),'--resume-prepared']
 result=subprocess.run(args,capture_output=True,timeout=700)
 output={'unitReturnCode':result.returncode,'automaticRetry':False,'previousFailureAndClosure':'ARCHIVED_RETAINED'}
 for name in ('body-pass.json','resume-first-failure.json','resume-closure.json','resume-closure-failure.json'):
  path=root/name
  output[name]=json.loads(h.read(path)) if path.is_file() else None
 output['deployment']='PASS_PENDING_READ_ONLY_VISUAL' if result.returncode==0 and output['body-pass.json'] and output['resume-closure.json'] and output['resume-closure.json'].get('release')=='NEW_ALIGNED' and not output['resume-first-failure.json'] and not output['resume-closure-failure.json'] else 'STOP_RETURN_OUTPUT_NO_RETRY'
 print(json.dumps(output,sort_keys=True,indent=2),flush=True)
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}),flush=True)
 raise SystemExit(1)
finally:
 if fd is not None:os.close(fd)
PASSVERO_MARKETING_RESUME_AFTER_TIMER_REVIEW
