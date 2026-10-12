# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one read-only exact clock/timer diagnosis
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_TIMER_DIAGNOSIS'
import datetime,hashlib,importlib.util,json,os,pathlib,re,stat,time
p=pathlib.Path('/var/lib/passvero-marketing-pin-alignment-20261012/deploy.py')
assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST'
info=p.lstat()
assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077,'HELPER_POSTURE'
assert hashlib.sha256(p.read_bytes()).hexdigest()=='4eb70f1c42602cded01ff9e5e80fcfa3ff5fdfaad611a0452ec2830cd01b2ddd','HELPER_CHANGED'
spec=importlib.util.spec_from_file_location('reviewed_timer_reads',p)
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
output={'diagnostic':'READ_ONLY_EXACT_CLOCK_AND_TIMER_VALUES','timers':{},'mutations':'NONE','automaticRetry':False}
for name in h.TIMERS:
 before=time.time()
 reply=h.run(['/usr/bin/busctl','call','org.freedesktop.systemd1','/org/freedesktop/systemd1',
              'org.freedesktop.systemd1.Manager','GetUnit','s',name])
 assert re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"',reply),'TIMER_OBJECT_GRAMMAR'
 values={}
 for prop in ('NextElapseUSecRealtime','NextElapseUSecMonotonic','LastTriggerUSec','LastTriggerUSecMonotonic'):
  raw=h.run(['/usr/bin/busctl','get-property','org.freedesktop.systemd1',reply[3:-1],
             'org.freedesktop.systemd1.Timer',prop])
  assert re.fullmatch(r't [0-9]{1,20}',raw),'TIMER_TYPED_VALUE_GRAMMAR'
  values[prop]={'typed':raw,'microseconds':int(raw[2:])}
 now=time.time();due=values['NextElapseUSecRealtime']['microseconds']/1000000
 guard_due=h.timer_due(name)
 systemd=h.run(['/usr/bin/systemctl','show',name,
  '--property=Id,ActiveState,SubState,UnitFileState,NextElapseUSecRealtime,NextElapseUSecMonotonic,LastTriggerUSec,TimersCalendar'])
 output['timers'][name]={'readStartedEpoch':before,'readFinishedEpoch':now,
  'observedUTC':datetime.datetime.fromtimestamp(now,datetime.timezone.utc).isoformat(),
  'typedProperties':values,'guardDueEpoch':guard_due,'remainingSeconds':guard_due-now,
  'passesExisting900SecondGuard':guard_due-now>900,
  'dueUTC':datetime.datetime.fromtimestamp(due,datetime.timezone.utc).isoformat() if 0<due<253402300799 else 'ZERO_OR_SENTINEL',
  'systemctlProperties':systemd}
for name in ('passvero-staging-backup.service','passvero-staging-backup-monitor.service',
             'passvero-subscription-reminders.timer','passvero-subscription-reminders.service'):
 output[name]=h.unit(name)
root=h.ROOT
output['coordinationAttemptPresent']=(root/'attempt.json').exists()
output['preparedResumeAttemptPresent']=(root/'resume-attempt.json').exists()
output['backupStateSha256']=hashlib.sha256((h.BACKUP/'state.json').read_bytes()).hexdigest()
output['configSha256']=hashlib.sha256((h.CODE/'config.json').read_bytes()).hexdigest()
output['canonicalSha256']=hashlib.sha256(h.CANONICAL.read_bytes()).hexdigest()
print(json.dumps(output,sort_keys=True,indent=2))
PASSVERO_MARKETING_TIMER_DIAGNOSIS
