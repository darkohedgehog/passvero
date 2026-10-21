# VPS TERMINAL / PENDING_OPERATOR_COMMAND — ONE READ-ONLY observation, no retry.
# No producer, Freshclam, reader, recovery, service/timer mutation or scan invocation.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_UPDATER_CONTINUITY_READ'
import datetime,fcntl,hashlib,json,math,os,pathlib,re,stat,subprocess,time,zoneinfo
P=pathlib.Path
ROOT=P('/var/lib/passvero-signature-trust');RECORDS=ROOT/'records/recovery'
CONFIG=P('/etc/passvero-signature-health.json')
HELPER=P('/var/lib/passvero-auth-flow-continuation-20261020-01/recover-release-reviewed.py')
HELPER_PIN='0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44'
CONFIG_PIN='28df856a3a8516f8c33d35bc652b5358dd0dcdd49d185be01a64eb1264a22593'
BUILD='_tkSUOn0PCoHjpx8V7FVr';ATTEMPT='recovery-20261021-continuity-01'
CANONICAL=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
CANONICAL_PIN='e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590'
SAVED_INVOCATION='6ddfa4ae552d49c98b11afe13cadd5e1'
SERVICE='passvero-signature-health.service'
DEADLINE=time.monotonic()+40
out={'diagnostic':'SIGNATURE_UPDATER_CONTINUITY_AND_EXISTING_RECOVERY_DISPOSITION',
 'observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'automaticRetry':False,
 'RECOVERY_EXECUTED':'NO','LOCK_REMOVAL_REPEATED':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO',
 'BACKUP_ACCEPTANCE_REPEATED':'NO','AUTOMATIC_STARTUP':'PASS','FULL_SERVICE_RECOVERY':'NOT_PROVEN',
 'SERVICE_TIMER_MUTATIONS':'NO','PRODUCER_EXECUTED_BY_DIAGNOSTIC':'NO','readerCalls':0,
 'sections':{},'limitations':[],'executionUnlocked':False,
 'traceContract':{'parserSourceSha256':'99c86c753d03c2776ae501fbac49b6a267acc88ffc40882607650a68438f7328',
 'acceptedSourceBase':'1fc84aa8ccc3118f8158029e8edf99275c8f7f6e','scope':'READONLY_CONTINUITY_TRACE_NOT_PRODUCER_OR_FULL_HEALTH_ACCEPTANCE'}}
class Limited(Exception):pass
def need(ok,code):
 if not ok:raise Limited(code)
def sha(body):return hashlib.sha256(body).hexdigest()
def read_private(path,cap=32768,owners=(0,),parents=(0,),prefix=False):
 for parent in path.parents:
  s=parent.lstat();need(stat.S_ISDIR(s.st_mode)and s.st_uid in parents and not s.st_mode&0o022,'UNPROTECTED_PARENT')
 fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  a=os.fstat(fd);need(stat.S_ISREG(a.st_mode)and a.st_uid in owners and a.st_nlink==1 and not a.st_mode&0o022 and 0<a.st_size<=cap,'UNPROTECTED_OR_UNBOUNDED_FILE')
  size=min(512,a.st_size)if prefix else a.st_size
  chunks=[];total=0
  while total<size:
   b=os.read(fd,min(65536,size-total))
   if not b:break
   chunks.append(b);total+=len(b)
  need(total==size,'PRIVATE_READ_BOUND')
  for b in(os.fstat(fd),path.lstat()):
   need((a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns,a.st_ctime_ns)==(b.st_dev,b.st_ino,b.st_size,b.st_mtime_ns,b.st_ctime_ns),'INPUT_CHANGED_DURING_READ')
  return b''.join(chunks),a
 finally:os.close(fd)
def metadata(s):return {'device':s.st_dev,'inode':s.st_ino,'bytes':s.st_size,'uid':s.st_uid,'gid':s.st_gid,'mode':oct(stat.S_IMODE(s.st_mode)),'mtimeNs':s.st_mtime_ns,'ctimeNs':s.st_ctime_ns}
def command(args,required=True):
 need(time.monotonic()<DEADLINE,'READONLY_BUDGET_EXPIRED')
 result=subprocess.run(args,capture_output=True,timeout=min(5,DEADLINE-time.monotonic()),cwd='/',env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
 need(len(result.stdout)<=131072,'READONLY_OUTPUT_BOUND')
 need(not required or result.returncode==0,'READONLY_COMMAND_UNAVAILABLE')
 return result
def unit(name):
 text=command(['/usr/bin/systemctl','show',name,'--property=Id,LoadState,ActiveState,SubState,UnitFileState,MainPID,ControlPID,InvocationID,NeedDaemonReload,DropInPaths']).stdout.decode()
 rows=dict(line.split('=',1)for line in text.splitlines()if '='in line)
 need(rows.get('Id')==name,'UNIT_IDENTITY_UNAVAILABLE')
 drops=rows.pop('DropInPaths',None)
 rows['dropInDisposition']='NONE'if drops==''else'PRESENT_OR_UNVERIFIED_NOT_EXPOSED'
 need(all(re.fullmatch('[A-Za-z0-9_.@:-]{0,160}',v)for v in rows.values()),'UNREVIEWED_UNIT_FIELD')
 return rows
def normalized_report(invocation=None):
 args=['/usr/bin/journalctl','-u',SERVICE,'--no-pager','--quiet','--reverse','-n','16','-o','json',
 '--output-fields=__REALTIME_TIMESTAMP,_SYSTEMD_INVOCATION_ID,_SYSTEMD_UNIT,_TRANSPORT,MESSAGE']
 if invocation:args.append('_SYSTEMD_INVOCATION_ID='+invocation)
 rows=command(args).stdout.decode().splitlines()
 for line in rows:
  try:
   row=json.loads(line);v=json.loads(row.get('MESSAGE',''))
   if row.get('_SYSTEMD_UNIT')!=SERVICE or row.get('_TRANSPORT')!='stdout':continue
   if not isinstance(v,dict)or set(v)!={'result','phase','reason','durationMs'}:continue
   if v['result']not in('PUBLISHED','UNTRUSTED','BUSY','OPERATIONAL_FAILURE'):continue
   if not isinstance(v['phase'],str)or not re.fullmatch('[A-Z_]{1,48}',v['phase']):continue
   if v['reason']is not None and(not isinstance(v['reason'],str)or not re.fullmatch('[A-Z_]{1,64}',v['reason'])):continue
   if type(v['durationMs'])not in(int,float)or not math.isfinite(v['durationMs'])or v['durationMs']<0:continue
   identity=row.get('_SYSTEMD_INVOCATION_ID','')
   if not re.fullmatch('[0-9a-f]{32}',identity)or(invocation and identity!=invocation):continue
   return {'timestampUs':row['__REALTIME_TIMESTAMP'],'invocationId':identity,**v}
  except(ValueError,TypeError,KeyError):continue
 return {'status':'NOT_RECORDED','scope':'ONE_BOUNDED_EXISTING_JOURNAL_READ'}
def clamtime(text,zone):
 match=re.fullmatch(r'(Sun|Mon|Tue|Wed|Thu|Fri|Sat) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ([ \d]\d) (\d\d):(\d\d):(\d\d) (\d{4})',text)
 need(match is not None,'EVIDENCE_INVALID_TIMESTAMP')
 month=('Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec').index(match[2])+1
 naive=datetime.datetime(int(match[7]),month,int(match[3]),int(match[4]),int(match[5]),int(match[6]))
 need(('Mon','Tue','Wed','Thu','Fri','Sat','Sun')[naive.weekday()]==match[1],'EVIDENCE_INVALID_TIMESTAMP')
 base=naive.replace(tzinfo=datetime.timezone.utc)
 if zone=='UTC':return int(base.timestamp()*1000)
 need(zone=='Europe/Zagreb'and naive.year>=2000,'EVIDENCE_INVALID_TIMEZONE')
 candidates=[base-datetime.timedelta(hours=n)for n in(1,2)]
 valid=[d for d in candidates if d.astimezone(zoneinfo.ZoneInfo('Europe/Zagreb')).replace(tzinfo=None)==naive]
 need(len(valid)==1,'EVIDENCE_INVALID_TIMEZONE_GAP_OR_FOLD')
 return int(valid[0].timestamp()*1000)
def trace_continuity(text,zone):
 # Read-only trace of the accepted parser's gates. Never edits logs or produces health.
 need(text.endswith('\n'),'EVIDENCE_INVALID_TRAILING_NEWLINE')
 lines=text[:-1].split('\n');need(len(lines)<=10000,'EVIDENCE_INVALID_LINE_BOUND')
 boundaries=[];validation={};initialized=False;announcement=None;index=0;previous=-1;completed=-1
 order=('daily','main','bytecode');now=int(time.time()*1000)
 for number,line in enumerate(lines,1):
  row=re.fullmatch(r'(.{24}) -> (.*)',line);need(row is not None,'EVIDENCE_INVALID_LINE_FORMAT')
  at=clamtime(row[1],zone);message=row[2]
  need(previous<=at<=now,'EVIDENCE_INVALID_TIME_ORDER');previous=at
  context={'lineNumber':number,'timestampMs':at,'validationHistory':dict(validation),'expectedComponent':order[index]}
  if message=='--------------------------------------':
   boundaries.append({'lineNumber':number,'timestampMs':at})
   if initialized:return {'reason':'EVIDENCE_CONTINUITY_REQUIRED','subcase':'REPEATED_INITIALIZATION_BOUNDARY',**context,'initializationBoundariesThroughFailure':boundaries}
   initialized=True;continue
  if not initialized:return {'reason':'EVIDENCE_CONTINUITY_REQUIRED','subcase':'RECORD_BEFORE_RETAINED_INITIALIZATION',**context,'initializationBoundariesThroughFailure':boundaries}
  available=re.fullmatch(r'(daily|main|bytecode) database available for (?:download \(remote version: (\d+)\)|update \(local version: (\d+), remote version: (\d+)\))',message)
  if available:
   version=int(available[2]or available[4])
   need(available[1]==order[index]and announcement is None and 0<version<=9007199254740991 and
    (available[3]is None or(validation.get(available[1])==int(available[3])and version>int(available[3]))),'EVIDENCE_INVALID_ANNOUNCEMENT')
   announcement=(available[1],version);continue
  data=re.fullmatch(r'(main|daily|bytecode)\.(cvd|cld) (updated|database is up-to-date) \(version: (\d+), sigs: (\d+), f-level: (\d+), builder: [A-Za-z0-9_.-]+\)',message)
  need(data is not None and data[1]==order[index],'EVIDENCE_INVALID_COMPONENT_RECORD')
  version=int(data[4]);need(0<version<=9007199254740991,'EVIDENCE_INVALID_VERSION')
  if data[3]=='updated':
   need(announcement==(data[1],version),'EVIDENCE_INVALID_UPDATE_WITHOUT_MATCHING_ANNOUNCEMENT');validation[data[1]]=version
  elif announcement is not None or validation.get(data[1])!=version:
   return {'reason':'EVIDENCE_CONTINUITY_REQUIRED','subcase':'UPTODATE_WITH_PENDING_ANNOUNCEMENT'if announcement is not None else'UPTODATE_WITHOUT_MATCHING_VALIDATED_VERSION',
    **context,'component':data[1],'extension':data[2],'reportedVersion':version,'initializationBoundariesThroughFailure':boundaries}
  announcement=None;index+=1
  if index==3:completed=at;index=0
 return {'subcase':'NO_CONTINUITY_EXCEPTION_IN_CURRENT_PREFIX','initializationBoundaries':boundaries,
  'validationHistory':validation,'completedAtMs':completed,'partialCycle':index!=0 or announcement is not None,
  'scope':'CONTINUITY_TRACE_ONLY_NOT_FULL_DISK_AUTHENTICITY_OR_HEALTH_ACCEPTANCE'}
def guarded_section(name,fn):
 try:out['sections'][name]=fn()
 except BaseException as error:
  out['sections'][name]={'status':'NOT_DETERMINED','limitation':str(error)if isinstance(error,Limited)else type(error).__name__}
try:
 need(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
 config_body,_=read_private(CONFIG);config=json.loads(config_body)
 out['sections']['configIdentity']={'sha256':sha(config_body),'accepted09PinMatch':sha(config_body)==CONFIG_PIN,'timeZone':config.get('timeZone')if config.get('timeZone')in('UTC','Europe/Zagreb')else'UNVERIFIED'}
 need(sha(config_body)==CONFIG_PIN,'CONFIG_DRIFT_FROM_ACCEPTED09')
 def compatibility():
  helper_body,_=read_private(HELPER,65536);need(sha(helper_body)==HELPER_PIN,'REVIEWED_INSTALLED_HELPER_PIN_CHANGED')
  package=P('/usr/local/libexec/passvero-signature-recovery-v3')
  pins_body,_=read_private(package/'pins.json')
  need(sha(pins_body)=='24f0c02990df2c255269923c44a2a470bde1c5f1dd69b3d8f30a056b5c77c44d','PROTECTED_RECOVERY_PINS_IDENTITY_CHANGED')
  artifacts={}
  for path,pin in((P('/usr/local/libexec/passvero-signature-health.cjs'),'725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b'),(package/'producer.cjs','725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b'),(package/'reader.cjs','877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62')):
   body,_=read_private(path,2097152);need(sha(body)==pin,'RELEVANT_PRODUCER_READER_PIN_CHANGED');artifacts[str(path)]='MATCH'
  for path,pin in((P('/etc/systemd/system/passvero-signature-health.service'),'5becee91793921e6bae866b3c2f9523e4dfa2208b9709c2413191f38b7c31afe'),(P('/etc/systemd/system/passvero-signature-health.timer'),'5db45222db3785a90940b52f8480e2eeb1b912083c111aca18e70ff0075902f4')):
   body,_=read_private(path);need(sha(body)==pin,'PRODUCER_SERVICE_OR_TIMER_IDENTITY_CHANGED');artifacts[str(path)]='MATCH'
  out['sections']['recoveryArtifactIdentities']={'pinsJson':'MATCH','producerReaderAndUnits':artifacts,'helper':'MATCH'}
  ns={'__name__':'private_readonly_existing_recovery'}
  exec(compile(helper_body,'<pinned-existing-recovery-readonly>','exec'),ns)
  # guard() only: hard-deny all mutating commands even if this read-only review is miscalled.
  def readonly_existing_run(args,timeout=40,success=True,uid=None):
   need(uid is None and len(args)>=3 and args[0]=='/usr/bin/systemctl'and args[1]in('show','is-active'),'NON_READONLY_EXISTING_GUARD_CALL_DENIED')
   return command(args,required=success)
  ns['run']=readonly_existing_run
  host=ns['LinuxHost'](ATTEMPT)
  try:host.guard();status='PASS_UNCHANGED_EXISTING_GUARDS'
  except BaseException as error:status=str(error)if isinstance(error,ns['Stop'])else type(error).__name__
  need(read_private(HELPER,65536)[0]==helper_body,'HELPER_CHANGED_DURING_GUARD')
  return {'status':status,'helperPath':str(HELPER),'helperSha256':HELPER_PIN,'expectedBuild':BUILD,
          'futureAttemptId':ATTEMPT,'futureAttemptAlreadyExists':(RECORDS/ATTEMPT).exists(),
          'futurePaths':{'archive':str(host.archive),'db':str(host.db),'updaterLog':str(host.up_log),'daemonLog':str(host.da_log)},'recoveryExecuted':False}
 guarded_section('existingRecoveryGuard',compatibility)
 def release_identity():
  build,_=read_private(P('/var/www/passvero-acceptance/.next/BUILD_ID'),256,(0,1000,1001),(0,1000,1001))
  canonical,_=read_private(CANONICAL,1048576)
  need(build.decode().strip()==BUILD and sha(canonical)==CANONICAL_PIN,'EXACT_DEPLOYED_RELEASE_DRIFT')
  return {'build':BUILD,'canonicalSha256':sha(canonical),'result':'MATCH_EXACT_RELEASE_IDENTITIES','artifactScope':'REUSE_ACCEPTED_EXECUTABLE_MANIFEST_NO_FULL_ARTIFACT_CHECKSUM_SERIES'}
 guarded_section('releaseIdentity',release_identity)
 def updater_trace():
  path=P(config['updaterLog']);need(path.parent==ROOT/'updater','UNREVIEWED_UPDATER_LOG_PATH')
  body,identity=read_private(path,1048576,(0,108),(0,108))
  text=body.decode('utf-8')
  try:result=trace_continuity(text,config['timeZone'])
  except Limited as error:result={'subcase':'NOT_DETERMINED','limitation':str(error),'scope':'CURRENT_PREFIX_FAILS_BEFORE_CONTINUITY_DECISION'}
  boundaries=[];warnings=[]
  for number,line in enumerate(text.splitlines(),1):
   if line.endswith(' -> --------------------------------------'):boundaries.append(number)
   if re.search(r'WARNING|ERROR|failed|cool.?down|retry.after|HTTP[^0-9]*(?:403|429)',line,re.I):warnings.append(number)
  markers={'initializationBoundaryCount':len(boundaries),'firstBoundaryLines':boundaries[:4],
   'warningErrorCooldownLikeLineCount':len(warnings),'firstWarningLineNumbers':warnings[:4],
   'rotationOrRestartCause':'NOT_INFERRED_FROM_BOUNDARY_ALONE','cooldownCurrentlyActive':'NOT_DETERMINED_FROM_BINARY_OR_OLD_LOG_MARKERS'}
  return {'path':str(path),'identity':metadata(identity),'wholeLogSha256':sha(body),'trace':result,'markerSummary':markers,
          'historicalInvocationInputHash':'NOT_RECORDED','attribution':'CURRENT_RETAINED_BYTES_NOT_PROOF_OF_EXACT_HISTORICAL_INPUT'}
 guarded_section('updaterContinuity',updater_trace)
 guarded_section('saved09Report',lambda:normalized_report(SAVED_INVOCATION))
 guarded_section('latestExistingReport',lambda:normalized_report())
 def database_and_cooldown():
  path=P(config['databaseDirectory']);need(path==ROOT/'db'or path.parent==ROOT/'db','UNREVIEWED_ACTIVE_DATABASE_PATH')
  s=path.lstat();need(stat.S_ISDIR(s.st_mode)and s.st_uid in(0,108)and not s.st_mode&0o022,'UNPROTECTED_DATABASE_DIRECTORY')
  entries=list(path.iterdir());need(len(entries)<=64,'DATABASE_ENTRY_BOUND');artifacts=[]
  for name in('main','daily','bytecode'):
   found=[p for p in entries if p.name in(name+'.cvd',name+'.cld')];need(len(found)==1,'DATABASE_SET_UNCERTAIN')
   body,s=read_private(found[0],536870912,(0,108),(0,108),prefix=True)
   header=body.decode('ascii',errors='replace').split(':')
   version=int(header[2])if len(header)>=9 and header[0]=='ClamAV-VDB'and re.fullmatch('[0-9]{1,16}',header[2])else None
   artifacts.append({'component':name,'extension':found[0].suffix,'versionHeader':version,'identity':metadata(s),'authenticity':'NOT_INFERRED_FROM_HEADER_NO_SIGNATURE_PAYLOAD_READ'})
  cooldown=path/'freshclam.dat'
  if cooldown.exists():
   s=cooldown.lstat();cool={'present':True,'identity':metadata(s),'protectedOwner108RegularFile':stat.S_ISREG(s.st_mode)and s.st_uid==108 and s.st_nlink==1 and not s.st_mode&0o022,
     'cooldownState':'BINARY_NOT_INTERPRETED_MUST_BE_PRESERVED_NO_RESET'}
  else:cool={'present':False,'cooldownState':'NOT_RECORDED_NO_STATE_CREATED'}
  return {'activeDirectory':str(path),'artifacts':artifacts,'freshclamDat':cool,'oldDatabaseDeletion':'NOT_PERFORMED'}
 guarded_section('databaseAndCooldown',database_and_cooldown)
 def recovery_records():
  for parent in(RECORDS,*RECORDS.parents):
   info=parent.lstat();need(stat.S_ISDIR(info.st_mode)and info.st_uid==0 and not info.st_mode&0o022,'UNPROTECTED_RECOVERY_RECORD_PARENT')
  entries=list(RECORDS.iterdir());need(len(entries)<=96,'RECOVERY_RECORD_BOUND');states=[]
  for p in entries:
   if p.is_dir()and(p/'state.json').exists():
    body,_=read_private(p/'state.json');value=json.loads(body)
    states.append({'id':p.name if re.fullmatch('[a-z0-9-]{1,64}',p.name)else'<REDACTED_ID>',
     'phase':value.get('phase')if value.get('phase')in('COMPLETE','ROLLED_BACK','quiesce','backup','candidate','updater','daemon','scheduled')else'UNREVIEWED'})
  lock=RECORDS/'operator.lock';fd=os.open(lock,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
  try:
   s=os.fstat(fd);need(stat.S_ISREG(s.st_mode)and s.st_uid==0 and s.st_nlink==1 and stat.S_IMODE(s.st_mode)==0o600,'UNPROTECTED_EXISTING_RECOVERY_LOCK')
   try:fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB);availability='EXCLUSIVE_AVAILABLE_DURING_PROBE_NOT_RESERVED'
   except BlockingIOError:availability='BUSY'
  finally:os.close(fd)
  health_lock=P('/var/lib/passvero-signature-health/health.json.lock')
  return {'records':states,'unresolved':any(s['phase']not in('COMPLETE','ROLLED_BACK')for s in states),
   'existingRecoveryFlock':availability,'producerMkdirLockPresentAtObservation':health_lock.exists()or health_lock.is_symlink(),
   'producerLockUseOrAbandonment':'NOT_INFERRED_NO_REMOVAL'}
 guarded_section('recoveryRecordsAndLocks',recovery_records)
 def units_and_consumers():
  names=(SERVICE,'passvero-signature-health.timer','clamav-freshclam.service','clamav-daemon.service','clamav-daemon.socket','pm2-passvero-staging.service')
  units={name:unit(name)for name in names};consumers=[]
  scanner_pids={int(units[n].get('MainPID','0')):(n,exe)for n,exe in(('clamav-freshclam.service','/usr/bin/freshclam'),('clamav-daemon.service','/usr/sbin/clamd'))if units[n].get('MainPID','0')!='0'}
  processes=[p for p in P('/proc').iterdir()if p.name.isdigit()]
  need(len(processes)<=4096,'CONSUMER_PROCESS_BOUND')
  for p in processes:
   try:
    first=(p/'stat').read_text();ticks=first[first.rfind(')')+2:].split()[19]
    fields=dict(line.split(':',1)for line in(p/'status').read_text().splitlines()if ':'in line)
    uids=list(map(int,fields['Uid'].split()));groups=set(map(int,fields['Groups'].split()))|set(map(int,fields['Gid'].split()))
    if 988 not in groups and 108 not in uids:continue
    need(len(consumers)<64,'CONSUMER_COUNT_BOUND')
    exe=os.readlink(p/'exe');cg=(p/'cgroup').read_text()
    confinement=None
    if int(p.name)in scanner_pids:
     scanner_unit,expected_exe=scanner_pids[int(p.name)]
     profile=(p/'attr/current').read_text().strip()
     confinement={'unit':scanner_unit,'executableMatch':exe==expected_exe,'uids108Match':uids==[108]*4,
      'enforcedProfileMatch':profile==expected_exe+' (enforce)','reviewedCgroupMatch':cg.strip()=='0::/passveroclamav.slice/'+scanner_unit}
    second=(p/'stat').read_text();need(second[second.rfind(')')+2:].split()[19]==ticks and os.readlink(p/'exe')==exe,'CONSUMER_IDENTITY_CHANGED')
    consumers.append({'pid':int(p.name),'startTicks':ticks,'uids':uids,'socketGroup988':988 in groups,'scannerConfinement':confinement,
     'executable':exe if re.fullmatch(r'/(?:usr/(?:local/)?(?:s?bin|libexec)|bin|sbin)/[A-Za-z0-9_.+-]+',exe)else'<REDACTED_EXECUTABLE>',
     'systemdUnits':sorted(set(re.findall(r'(?:^|/)([A-Za-z0-9_.@-]{1,160}\.(?:service|scope))(?:/|$)',cg,re.MULTILINE)))[:4]})
   except(FileNotFoundError,ProcessLookupError):continue
  return {'units':units,'potentialConsumersByExistingPermissionScope':consumers,
   'scope':'GROUP_PERMISSION_AND_SCANNER_UID_NOT_EXHAUSTIVE_ROOT_ACCESS_OR_PROOF_OF_CONNECTED_SOCKET_CLIENTS'}
 guarded_section('unitsAndPotentialConsumers',units_and_consumers)
 need(read_private(CONFIG)[0]==config_body,'CONFIG_CHANGED_DURING_OBSERVATION')
 out['status']='ONE_READONLY_OBSERVATION_COMPLETE_RETURN_OUTPUT_AND_STOP'
except BaseException as error:
 out.update(status='READONLY_OBSERVATION_INCOMPLETE_STOP_NO_RETRY',limitation=str(error)if isinstance(error,Limited)else type(error).__name__)
print(json.dumps(out,indent=2))
PASSVERO_UPDATER_CONTINUITY_READ
