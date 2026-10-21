# VPS TERMINAL / PENDING_OPERATOR_COMMAND — one private read-only launch comparison.
# No raw argv, values, service/config contents, secret hashes, or program execution.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_PRIVATE_ENV_CONTRACT'
import datetime,hashlib,json,os,pathlib,re,stat,subprocess,time
P=pathlib.Path
UNIT='passvero-signature-health.service'
OBJECT='/org/freedesktop/systemd1/unit/passvero_2dsignature_2dhealth_2eservice'
FRAGMENT=P('/etc/systemd/system/passvero-signature-health.service')
CONFIG=P('/etc/passvero-signature-health.json')
PRODUCER=P('/usr/local/libexec/passvero-signature-health.cjs')
PRODUCER_PIN='725d3494983cfce68bdcacd30f9078606aa6c87c4b9d12a5674ea3770da7464b'
SUFFIX=['/usr/bin/node',str(PRODUCER),'--config',str(CONFIG)]
out={'diagnostic':'SIGNATURE_PRODUCER_PRIVATE_ENV_LAUNCH_CONTRACT','unit':UNIT,
     'automaticRetry':False,'rawValuesExposed':False,'individualValueHashesPublished':False,
     'VPS_MUTATIONS':'NO','LOCK_REMOVAL':'NOT_PERFORMED','PRODUCER_MANUAL_RUN':'NO',
     'SCAN_CALLS':0,'REBOOT_REPEATED':'NO','BACKUP_ACCEPTANCE_REPEATED':'NO','NEW_WINDOW_SCHEDULED':'NO'}
class Limited(Exception):pass
def need(ok,code):
    if not ok:raise Limited(code)
def unique(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise ValueError()
        result[key]=value
    return result
def props(interface,names,kinds):
    remaining=deadline-time.monotonic();need(remaining>0,'READ_BUDGET_EXPIRED')
    value=subprocess.run(['/usr/bin/busctl','--system','--no-pager','--json=short','--auto-start=no',
        'get-property','org.freedesktop.systemd1',OBJECT,interface,*names],capture_output=True,text=True,
        timeout=min(4,remaining),cwd='/',env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
    need(value.returncode==0,'STRUCTURED_READ_UNAVAILABLE')
    need(len(value.stdout.encode())<=65536,'STRUCTURED_OUTPUT_BOUND')
    lines=value.stdout.splitlines();need(len(lines)==len(names),'STRUCTURED_COUNT_MISMATCH')
    result={}
    for name,kind,line in zip(names,kinds,lines):
        item=json.loads(line,object_pairs_hook=unique)
        need(isinstance(item,dict)and item.get('type')==kind and 'data'in item,'STRUCTURED_SHAPE_UNSUPPORTED')
        result[name]=item['data']
    return result
def metadata():
    return props('org.freedesktop.systemd1.Unit',['Id','FragmentPath','DropInPaths','NeedDaemonReload'],['s','s','as','b'])
def private(path,cap):
    for parent in path.parents:
        s=parent.lstat()
        need(stat.S_ISDIR(s.st_mode)and s.st_uid==0 and not s.st_mode&0o022,'UNPROTECTED_INPUT_PARENT')
    fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
    try:
        before=os.fstat(fd)
        need(stat.S_ISREG(before.st_mode)and before.st_uid==0 and before.st_nlink==1
             and not before.st_mode&0o022 and 0<before.st_size<=cap,'UNPROTECTED_OR_UNBOUNDED_INPUT')
        parts=[];size=0
        while size<=cap:
            block=os.read(fd,min(65536,cap+1-size))
            if not block:break
            parts.append(block);size+=len(block)
        need(size==before.st_size and size<=cap,'INPUT_READ_BOUND')
        for current in(os.fstat(fd),path.lstat()):
            need((current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns)==
                 (before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns),'INPUT_CHANGED')
        return b''.join(parts),before
    finally:os.close(fd)
def safe_name(name):
    return name if re.fullmatch('[A-Z_][A-Z0-9_]{0,63}',name)else'<REDACTED_UNREVIEWED_NAME>'
def simple_execstart(body):
    # Deliberately do not emulate systemd quoting, escapes, variable/specifier expansion.
    # Such inputs remain UNVERIFIED, rather than being interpreted as shell grammar.
    section=None;commands=[]
    for line in body.decode('utf-8').splitlines():
        text=line.strip()
        if not text or text.startswith(('#',';')):continue
        if text.startswith('[')and text.endswith(']'):section=text;continue
        if section=='[Service]'and '='in line:
            key,value=line.split('=',1)
            if key.strip()=='ExecStart':commands.append(value.strip())
    if len(commands)!=1:return None
    command=commands[0]
    if any(c in command for c in ('\\','"',"'",'$','%')):return None
    if any(ord(c)<32 and c!='\t' for c in command):return None
    return command.split()
try:
    need(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
    deadline=time.monotonic()+20
    before=metadata()
    need(before['Id']==UNIT and before['FragmentPath']==str(FRAGMENT),'UNEXPECTED_LOADED_FRAGMENT')
    need(before['DropInPaths']==[]and before['NeedDaemonReload']is False,'DROPIN_OR_PENDING_RELOAD_REQUIRES_REVIEW')
    entries=props('org.freedesktop.systemd1.Service',['ExecStart'],['a(sasbttttuii)'])['ExecStart']
    need(isinstance(entries,list)and len(entries)==1,'EXECSTART_COUNT_MISMATCH')
    row=entries[0];need(isinstance(row,list)and len(row)==10,'EXECSTART_ENTRY_INVALID')
    executable,args,ignore=row[:3]
    need(executable=='/usr/bin/env'and type(ignore)is bool and ignore is False,'ENV_EXECUTABLE_OR_FAILURE_POLICY_MISMATCH')
    need(isinstance(args,list)and len(args)==8 and all(isinstance(a,str)and len(a)<=8192 for a in args),
         'ENV_ARGV_COUNT_OR_TYPE_MISMATCH')
    need(args[0]=='/usr/bin/env'and args[4:]==SUFFIX,'ENV_COMMAND_CHAIN_MISMATCH')
    unit_body,identity=private(FRAGMENT,32768)
    declared=simple_execstart(unit_body)
    same_declared=declared==args if declared is not None else None
    def declared_field(index):
        if declared is None:return 'UNVERIFIED'
        return 'MATCH'if index<len(declared)and declared[index]==args[index]else'MISMATCH'
    producer_body,_=private(PRODUCER,2097152)
    producer_match=hashlib.sha256(producer_body).hexdigest()==PRODUCER_PIN
    config_body,_=private(CONFIG,16384);config=json.loads(config_body,object_pairs_hook=unique)
    zone=config.get('timeZone')if isinstance(config,dict)else None
    # Only comparison results, never the environment values themselves.
    # These nonsecret literals come from the already reviewed recovery run() environment;
    # they are operational-intent evidence, not a claimed original service baseline.
    reviewed={'LANG':'C','LC_ALL':'C','TZ':'Europe/Zagreb','PATH':'/usr/sbin:/usr/bin:/sbin:/bin'}
    structure=[];names=[];options=[];supported=True
    for index in range(1,4):
        arg=args[index]
        if '='in arg and not arg.startswith('-'):
            name,value=arg.split('=',1);shown=safe_name(name)
            if shown!=name or name in names:supported=False
            names.append(name)
            item={'argvIndex':index,'kind':'ENV_ASSIGNMENT','name':shown,'value':'NOT_EXPOSED',
              'protectedUnitValueComparison':declared_field(index),
              'comparisonSource':str(FRAGMENT)+'::ExecStart (root-owned protected installed declaration)',
              'reviewedRecoveryRunIntent':'MATCH'if name in reviewed and value==reviewed[name]else'MISMATCH'if name in reviewed else'UNVERIFIED'}
            if name=='TZ':item['producerConfigTimeZoneComparison']='MATCH'if zone in('UTC','Europe/Zagreb')and value==zone else'MISMATCH'if zone in('UTC','Europe/Zagreb')else'UNVERIFIED'
            structure.append(item)
        elif arg in('-i','--ignore-environment')and not names:
            options.append(arg)
            structure.append({'argvIndex':index,'kind':'ENV_OPTION','option':arg,
              'protectedUnitComparison':declared_field(index)})
        else:
            supported=False
            structure.append({'argvIndex':index,'kind':'UNVERIFIED_ENV_CONTROL_OR_ARGUMENT',
              'argument':'NOT_EXPOSED','comparison':'UNVERIFIED'})
    after=metadata();final_body,_=private(FRAGMENT,32768)
    need(before==after and unit_body==final_body,'UNIT_IDENTITY_OR_CONTENT_CHANGED_DURING_READ')
    out.update(status='PRIVATE_ENV_CONTRACT_READ_COMPLETE_RETURN_OUTPUT_AND_STOP',
       observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),
       launch={'executable':executable,'entryCount':1,'argvCount':8,'argv0':'/usr/bin/env',
               'envPrefix':structure,'commandChain':SUFFIX,'ignoreFailure':False},
       protectedInstalledSource={'path':str(FRAGMENT),'uid':identity.st_uid,'gid':identity.st_gid,
               'mode':oct(stat.S_IMODE(identity.st_mode)),'wholeUnitSha256':hashlib.sha256(unit_body).hexdigest(),
               'scope':'WHOLE_PROTECTED_UNIT_IDENTITY_NOT_A_HASH_OF_AN_INDIVIDUAL_SECRET',
               'loadedArgvVsDeclaredExecStart':'MATCH'if same_declared is True else'MISMATCH'if same_declared is False else'UNVERIFIED_UNSUPPORTED_UNIT_GRAMMAR'},
       originalInstallerHistory='UNVERIFIED_NOT_PRESENT_IN_REVIEWED_LOCAL_SOURCE',
       producerArtifact={'path':str(PRODUCER),'reviewedBundlePinComparison':'MATCH'if producer_match else'MISMATCH'},
       envPrefixStructure='MATCH_SUPPORTED_STRUCTURE'if supported else'UNVERIFIED',
       closureOrLockAction='NONE_READONLY_ONLY')
    documented=all(item.get('reviewedRecoveryRunIntent')=='MATCH'for item in structure if item['kind']=='ENV_ASSIGNMENT')
    timezone=all(item.get('producerConfigTimeZoneComparison','MATCH')=='MATCH'for item in structure)
    out['disposition']='CURRENT_PROTECTED_CONTRACT_MATCH_REQUIRES_LOCAL_REVIEW'if supported and same_declared is True and producer_match and documented and timezone else'MISMATCH_OR_UNVERIFIED_STOP_BEFORE_LOCK_CONTINUATION'
except BaseException as error:
    out.update(status='READ_UNAVAILABLE_OR_SCOPE_MISMATCH_RETURN_OUTPUT_NO_RETRY',
               limitation=str(error)if isinstance(error,Limited)else type(error).__name__)
print(json.dumps(out,indent=2,ensure_ascii=True))
PASSVERO_PRIVATE_ENV_CONTRACT
