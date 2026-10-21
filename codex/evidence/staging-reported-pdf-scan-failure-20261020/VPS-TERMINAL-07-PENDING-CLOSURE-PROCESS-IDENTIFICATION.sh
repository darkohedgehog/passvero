# VPS TERMINAL / PENDING_OPERATOR_COMMAND — ONE READ-ONLY observation; no retry.
# No closure, timer/service mutation, producer execution, process kill or lock operation.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_PENDING_CLOSURE_PROCESS_READ'
import datetime,hashlib,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
ROOT=P('/var/lib/passvero-signature-lock-release-20261020-01/env-launch-continuation')
SERVICE='passvero-signature-health.service';TIMER='passvero-signature-health.timer'
PIN='c6d2d1b153920872aba24e17a47fa26ec601e41cf717a7dad957f2dd57af3a13'
TOKENS=('passvero-signature-health','passvero-signature-recovery','passvero-signature-trust',
 'produce-document-signature-health','recover-document-signature-health',
 'recover-release-reviewed.py','recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py')
CGTOKENS=(SERVICE,'passvero-auth-flow-scanner-','passvero-reboot-scanner-')
SAFE_ARGS={'-I','-B','--config','body','close','final','-',
 '/usr/bin/node','/usr/bin/python3','/usr/bin/env',
 '/usr/local/libexec/passvero-signature-health.cjs','/etc/passvero-signature-health.json',
 '/usr/local/libexec/passvero-qpdf-broker.py','/usr/local/libexec/passvero-qpdf-broker-setup.py',
 '/usr/local/libexec/passvero-signature-recovery-v3/recover-document-signature-health.py',
 str(ROOT/'conditional-lock-release.py')}
end=time.monotonic()+25
out={'diagnostic':'SIGNATURE_PRODUCER_PENDING_CLOSURE_PROCESS_IDENTIFICATION',
 'observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'automaticRetry':False,
 'PROCESS_KILL':'NO','LOCK_REMOVAL':'NOT_PERFORMED','SERVICE_TIMER_MUTATIONS':'NO',
 'PRODUCER_MANUAL_RUN':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO',
 'BACKUP_ACCEPTANCE_REPEATED':'NO','TIMER_RESTORE':'PARTIAL_PENDING',
 'historicalBlockingProcess':'NOT_RECORDED_NOT_RECONSTRUCTED',
 'matches':[],'exitedDuringRead':[],'limitations':[]}
class Limited(Exception):pass
def need(ok,code):
 if not ok:raise Limited(code)
def private(path,cap=32768):
 for parent in path.parents:
  s=parent.lstat();need(stat.S_ISDIR(s.st_mode)and s.st_uid==0 and not s.st_mode&0o022,'UNPROTECTED_RECORD_PARENT')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  a=os.fstat(fd);need(stat.S_ISREG(a.st_mode)and a.st_uid==0 and a.st_nlink==1 and not a.st_mode&0o022 and 0<a.st_size<=cap,'UNPROTECTED_RECORD')
  b=os.read(fd,cap+1);need(len(b)==a.st_size,'RECORD_READ_BOUND')
  for c in(os.fstat(fd),path.lstat()):
   need((a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(c.st_dev,c.st_ino,c.st_size,c.st_mtime_ns,c.st_ctime_ns),'RECORD_CHANGED')
  return b
 finally:os.close(fd)
def run(args):
 need(time.monotonic()<end,'OBSERVATION_TIME_BOUND')
 r=subprocess.run(args,capture_output=True,text=True,timeout=min(5,end-time.monotonic()),cwd='/',env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
 need(r.returncode==0 and len(r.stdout.encode())<=65536,'READ_COMMAND_UNAVAILABLE_OR_BOUND')
 return r.stdout
def unit(name):
 properties='Id,LoadState,ActiveState,SubState,UnitFileState,MainPID,ControlPID,TriggeredBy,Triggers'
 rows=dict(line.split('=',1)for line in run(['/usr/bin/systemctl','show',name,'--property='+properties]).splitlines()if '='in line)
 need(rows.get('Id')==name and rows.get('LoadState')=='loaded','UNIT_IDENTITY_UNAVAILABLE')
 # These properties contain identities/states, not ExecStart or environment.
 need(all(re.fullmatch(r'[A-Za-z0-9_.@:\\/ -]{0,1024}',v)for v in rows.values()),'UNREVIEWED_UNIT_PROPERTY_FORMAT')
 obj='/org/freedesktop/systemd1/unit/'+name.replace('-','_2d').replace('.','_2e')
 j=json.loads(run(['/usr/bin/busctl','--system','--json=short','get-property','org.freedesktop.systemd1',obj,'org.freedesktop.systemd1.Unit','Job']))
 need(j.get('type')=='(uo)'and isinstance(j.get('data'),list)and len(j['data'])==2,'JOB_PROPERTY_UNAVAILABLE')
 jid,path=j['data'];need(type(jid)is int and jid>=0 and isinstance(path,str)and re.fullmatch(r'/org/freedesktop/systemd1/job/[0-9]+|/',path),'JOB_IDENTITY_INVALID')
 return {**rows,'pendingSystemdJob':{'id':jid,'objectPath':path}}
def procstat(path):
 raw=path.read_text();fields=raw[raw.rfind(')')+2:].split()
 return int(fields[1]),fields[19]
def safe_executable(value):
 return value if re.fullmatch(r'/(?:usr/(?:local/)?(?:s?bin|libexec)|bin|sbin)/[A-Za-z0-9_.+-]+',value)else'<REDACTED_EXECUTABLE_PATH>'
def safe_cgroups(text):
 rows=[]
 for line in text.splitlines():
  parts=line.split(':',2);need(len(parts)==3,'CGROUP_FORMAT_UNAVAILABLE')
  components=parts[2].split('/')
  shown=[c if re.fullmatch(r'[A-Za-z0-9_.@-]{1,160}\.(?:service|scope|slice)',c)else'<REDACTED_COMPONENT>'for c in components if c]
  rows.append({'path':'/'+ '/'.join(shown),'units':[c for c in shown if c.endswith(('.service','.scope'))]})
 return rows
try:
 need(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
 need(hashlib.sha256(private(ROOT/'conditional-lock-release.py')).hexdigest()==PIN,'EXECUTED_HELPER_PIN_MISMATCH')
 baseline=json.loads(private(ROOT/'baseline.json'));closure=json.loads(private(ROOT/'closure.json'))
 controller=json.loads(private(ROOT/'controller.json'))
 need(baseline.get('timer')=={'enabled':'enabled','active':'active'},'SAVED_BASELINE_MISMATCH')
 need(closure.get('partial')is True and closure.get('timerRestored')is False and closure.get('pending')==['PRODUCER_RECOVERY_OR_UNREVIEWED_ROOT_INTERPRETER_ACTIVE'],'PENDING_CLOSURE_MISMATCH')
 out['savedBaseline']={'at':baseline.get('at'),'timer':baseline['timer']}
 out['savedClosure']={k:closure.get(k)for k in('at','closure','timerRestored','partial','pending')}
 saved={n:private(ROOT/n)for n in('baseline.json','closure.json','controller.json')}
 out['unitsBefore']={n:unit(n)for n in(SERVICE,TIMER)}
 selfpid=os.getpid();ancestors=set();pid=os.getppid()
 while pid>1:
  need(len(ancestors)<64,'ANCESTRY_BOUND');ancestors.add(pid);pid,_=procstat(P('/proc',str(pid),'stat'))
 _,selfticks=procstat(P('/proc/self/stat'))
 out['diagnosticIdentity']={'pid':selfpid,'startTicks':selfticks,'euid':os.geteuid(),
  'executable':safe_executable(os.readlink('/proc/self/exe')),'invocation':'sudo /usr/bin/python3 -I -B - with heredoc',
  'selfNotSilentlyExcluded':True,'originalGuardSelfAncestorExclusionExplainedPerMatch':True}
 entries=[p for p in P('/proc').iterdir()if p.name.isdigit()];need(len(entries)<=4096,'PROCESS_COUNT_BOUND')
 noexe=0
 for entry in sorted(entries,key=lambda p:int(p.name)):
  need(time.monotonic()<end,'OBSERVATION_TIME_BOUND');pid=int(entry.name)
  try:
   ppid,ticks=procstat(entry/'stat')
   status=dict(line.split(':',1)for line in(entry/'status').read_text().splitlines()if ':'in line)
   uids=list(map(int,status['Uid'].split()))
   try:exe=os.readlink(entry/'exe')
   except FileNotFoundError:
    if not entry.exists():raise
    noexe+=1;continue # Original guard also skips missing exe; no role inferred.
   with(entry/'cmdline').open('rb')as f:raw=f.read(65537)
   need(len(raw)<=65536,'PROCESS_ARG_BOUND')
   args=raw.decode('utf-8','replace').split('\0');cg=(entry/'cgroup').read_text()
   known_arg=[t for t in TOKENS if any(t in a for a in args)]
   known_cg=[t for t in CGTOKENS if t in cg]
   interpreter=bool(0 in uids and re.fullmatch(r'(?:node|nodejs|python[0-9.]*)',P(exe).name))
   tail=[a for a in args[1:]if a]
   unrelated=tail in([['-I',name]for name in('/usr/local/libexec/passvero-qpdf-broker.py','/usr/local/libexec/passvero-qpdf-broker-setup.py')]+[['-I','-B',name]for name in('/usr/local/libexec/passvero-qpdf-broker.py','/usr/local/libexec/passvero-qpdf-broker-setup.py')])
   ppid2,ticks2=procstat(entry/'stat')
   need(ticks2==ticks and os.readlink(entry/'exe')==exe and ppid2==ppid,'PROCESS_IDENTITY_UNSTABLE')
   known=bool(known_arg or known_cg)
   if not(known or(interpreter and not unrelated)):continue
   selfmatch=pid==selfpid and ticks==selfticks
   ctrlmatch=(pid==controller.get('pid')and ticks==controller.get('startTicks')and exe==controller.get('executable')and uids==controller.get('uids'))
   exclusion='SELF'if selfmatch else'ANCESTOR'if pid in ancestors else'SAVED_CONTROLLER_EXACT_IDENTITY'if ctrlmatch else None
   safe=[{'index':i,'argument':a if a in SAFE_ARGS else'<REDACTED>',
          'knownGuardTokens':[t for t in TOKENS if t in a]}for i,a in enumerate(args)if a]
   need(len(safe)<=128 and len(out['matches'])<64,'MATCH_OR_ARGUMENT_COUNT_BOUND')
   out['matches'].append({'pid':pid,'ppid':ppid,'uids':uids,'startTicks':ticks,
    'processIdentity':'PID_PLUS_START_TICKS_IN_CURRENT_BOOT','executable':safe_executable(exe),
    'cgroups':safe_cgroups(cg),'classification':'KNOWN_PRODUCER_OR_RECOVERY'if known else'UNREVIEWED_ROOT_INTERPRETER',
    'matchingCriteria':{'knownArgumentTokens':known_arg,'knownCgroupTokens':known_cg,'rootInterpreter':interpreter,'qpdfException':unrelated},
    'diagnosticSelfExactIdentity':selfmatch,'originalGuardExclusion':exclusion,
    'wouldBlockOriginalGuardAtThisObservation':exclusion is None,'safeArguments':safe,
    'lockUse':'NOT_INFERRED_FROM_INTERPRETER_OR_TOKEN_MATCH'})
  except(FileNotFoundError,ProcessLookupError):
   need(len(out['exitedDuringRead'])<64,'EXIT_RECORD_BOUND')
   out['exitedDuringRead'].append({'pid':pid,'status':'PROCESS_EXITED_DURING_READ','role':'NOT_INFERRED'})
  except PermissionError:raise Limited('PROCESS_INSPECTION_INCOMPLETE')from None
 out['processesWithoutReadableExeSkippedLikeOriginalGuard']=noexe
 out['bootId']=P('/proc/sys/kernel/random/boot_id').read_text().strip()
 out['clockTicksPerSecond']=os.sysconf('SC_CLK_TCK')
 out['unitsAfter']={n:unit(n)for n in(SERVICE,TIMER)}
 need(all(private(ROOT/n)==body for n,body in saved.items()),'SAVED_BASELINE_OR_CLOSURE_CHANGED')
 out['currentBlockingMatchCount']=sum(p['wouldBlockOriginalGuardAtThisObservation']for p in out['matches'])
 out['status']='ONE_READONLY_OBSERVATION_COMPLETE_RETURN_OUTPUT_AND_STOP'
 out['completeness']='BOUNDED_PROC_ENUMERATION_NOT_AN_ATOMIC_PROCESS_SNAPSHOT'
except BaseException as error:
 out.update(status='READONLY_OBSERVATION_INCOMPLETE_STOP_NO_RETRY',limitation=str(error)if isinstance(error,Limited)else type(error).__name__)
print(json.dumps(out,indent=2))
PASSVERO_PENDING_CLOSURE_PROCESS_READ
