# PENDING_OPERATOR_COMMAND — VPS TERMINAL: finalize verified old rollback, restore timer baseline once
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CLOSE_RESTORED_CANONICAL_RELEASE'
import datetime,fcntl,hashlib,importlib.util,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
root=P('/var/lib/passvero-marketing-pin-alignment-20261012')
helper=root/'deploy-resume-prepared.py';fd=None
check_id='EXACT_OLD_RELEASE_AND_FAILURE_HISTORY'
def normalized(e):
 s=str(e);return s if re.fullmatch('[A-Z0-9_]{1,160}',s) else type(e).__name__
try:
 assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
 os.umask(0o077)
 info=helper.lstat()
 assert stat.S_ISREG(info.st_mode) and not helper.is_symlink() and info.st_uid==0 and not info.st_mode&0o077,'HELPER_POSTURE'
 assert hashlib.sha256(helper.read_bytes()).hexdigest()=='497c298b074574120c863c4d1b904dd9dc311f8f22a999e1f58d5c8fada5fb76','HELPER_CHANGED'
 spec=importlib.util.spec_from_file_location('verified_old_closure_definitions',helper)
 h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
 assert not (root/'canonical-closure-attempt.json').exists(),'ONE_CANONICAL_CLOSURE_ONLY'
 assert not (root/'resume-closure.json').exists(),'UNEXPECTED_EXISTING_CLOSURE'
 for name,check in (('resume-first-failure.json','VERIFY_NEW_ALIGNED_RELEASE'),('resume-closure-failure.json','PAIRED_ROLLBACK')):
  assert json.loads(h.read(root/name))=={'result':'STOP','CHECK_ID':check,'reason':'STAGING_HTTPS_OR_RUNTIME_NOT_READY','automaticRetry':False},'FAILURE_HISTORY_CHANGED'
 attempt=json.loads(h.read(root/'attempt.json'))
 assert (root/'resume-attempt.json').is_file(),'RESUME_RESERVATION_MISSING'
 fd=os.open(h.BACKUP/'job.lock',os.O_RDONLY|os.O_NOFOLLOW);fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB)
 h.idle()
 assert h.sha(h.read(h.BACKUP/'state.json'))==attempt['backupStateSha256']=='83a853dd397c13c2290a94a6defdc51d42638259c76091d6485a840f75ef44d1','BACKUP_STATE_CHANGED'
 assert h.sha(h.read(h.CODE/'config.json'))==h.OLD_CONFIG,'OLD_CONFIG_CHANGED'
 manifest=h.verify_manifest(h.read(h.CANONICAL),h.OLD_CANONICAL,h.OLD_BUILD)
 assert len(manifest['files'])==842,'OLD_MANIFEST_COUNT_CHANGED'
 assert not (root/'previous-.next').exists() and not (root/'previous-messages').exists(),'ROLLBACK_NOT_ALREADY_APPLIED'
 assert (root/'failed-new-.next').is_dir() and (root/'failed-new-messages').is_dir(),'NEW_ARTIFACT_RETENTION_CHANGED'
 prepare,_=h.helpers(json.loads(h.read(root/'old-config.json')))
 runtime,_=prepare.runtime()
 check_id='CANONICAL_HTTPS_200_TLS_NOT_REDIRECT_BYPASS'
 response=subprocess.run(['/usr/bin/curl','--silent','--max-time','5','--header','Accept-Language: hr','--cookie','NEXT_LOCALE=hr','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/'],capture_output=True,timeout=7)
 assert response.returncode==0 and response.stdout.decode().strip()=='200 0','CANONICAL_STAGING_HTTPS_NOT_READY'
 check_id='RESTORE_ONLY_REVIEWED_TIMER_BASELINE'
 now=datetime.datetime.now(datetime.timezone.utc)
 schedules={h.TIMERS[0]:('OnCalendar=*-*-* 04:30:00 UTC',now.replace(hour=4,minute=30,second=0,microsecond=0),datetime.timedelta(days=1)),h.TIMERS[1]:('OnCalendar=*-*-* *:20:00 UTC',now.replace(minute=20,second=0,microsecond=0),datetime.timedelta(hours=1))}
 for name,(calendar,due,period) in schedules.items():
  current=h.unit(name);baseline=attempt['timers'][name]
  assert current['ActiveState']=='inactive' and current['UnitFileState']==baseline['UnitFileState']=='enabled' and baseline['ActiveState']=='active','TIMER_BASELINE_CHANGED'
  raw=h.run(['/usr/bin/systemctl','show',name,'--property=TimersCalendar'])
  assert calendar in raw,'TIMER_CALENDAR_CHANGED'
  if due<=now:due+=period
  assert (due-now).total_seconds()>900,'NEXT_REGULAR_TERM_TOO_CLOSE_NO_MUTATION'
  reply=h.run(['/usr/bin/busctl','call','org.freedesktop.systemd1','/org/freedesktop/systemd1','org.freedesktop.systemd1.Manager','GetUnit','s',name])
  assert re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"',reply),'TIMER_DBUS_OBJECT'
  last=h.run(['/usr/bin/busctl','get-property','org.freedesktop.systemd1',reply[3:-1],'org.freedesktop.systemd1.Timer','LastTriggerUSec'])
  assert re.fullmatch(r't [0-9]{1,20}',last),'TIMER_LAST_TYPED_REQUIRED'
  assert (due-period).timestamp()<=int(last[2:])/1000000<=now.timestamp(),'MISSED_TERM_REQUIRES_SEPARATE_REVIEW'
 for key,value in attempt['writerTimer'].items():assert h.unit('passvero-subscription-reminders.timer')[key]==value,'WRITER_BASELINE_CHANGED'
 h.record('canonical-closure-attempt.json',{'automaticRetry':False,'action':'RESTORE_TIMERS_ONLY_ALREADY_RESTORED_OLD_RELEASE','canonicalHealth':'200_0','applicationActions':0})
 h.restore_timers(attempt['timers'])
 h.verify_manifest(h.read(h.CANONICAL),h.OLD_CANONICAL,h.OLD_BUILD)
 assert h.sha(h.read(h.CODE/'config.json'))==h.OLD_CONFIG and h.sha(h.read(h.BACKUP/'state.json'))==attempt['backupStateSha256'],'PIN_OR_STATE_CHANGED'
 for key,value in attempt['writerTimer'].items():assert h.unit('passvero-subscription-reminders.timer')[key]==value,'WRITER_BASELINE_CHANGED'
 result={'closure':'PASS_OLD_ROLLED_BACK_ALIGNED_BASELINE_RESTORED','release':h.OLD_BUILD,'canonicalSha256':h.OLD_CANONICAL,'configSha256':h.OLD_CONFIG,'oldManifestFilesVerified':842,'httpsTls':'200_0_CANONICAL_ROOT','runtime':runtime,'backupStateUnchanged':True,'writerTimerUnchanged':True,'backupAndMonitor':{name:h.unit(name) for name in h.TIMERS},'nextTypedDueUTC':{name:datetime.datetime.fromtimestamp(h.timer_due(name),datetime.timezone.utc).isoformat() for name in h.TIMERS},'previousFailureHistory':'RETAINED_UNCHANGED','applicationActions':0,'captureRestoreWorkerSmtpTelegramCalls':0,'newMarketingDeployment':'NOT_ACCEPTED_ROLLED_BACK','automaticRetry':False,'artifactsRetained':True}
 h.record('canonical-closure.json',result)
 print(json.dumps(result,sort_keys=True,indent=2),flush=True)
except BaseException as error:
 result={'result':'STOP','CHECK_ID':check_id,'reason':normalized(error),'automaticRetry':False}
 if 'h' in globals():
  if not (root/'canonical-closure-first-failure.json').exists():h.record('canonical-closure-first-failure.json',result)
  result['currentTimers']={name:h.unit(name) for name in h.TIMERS}
 print(json.dumps(result,sort_keys=True,indent=2),flush=True)
 raise SystemExit(1)
finally:
 if fd is not None:os.close(fd)
PASSVERO_CLOSE_RESTORED_CANONICAL_RELEASE
