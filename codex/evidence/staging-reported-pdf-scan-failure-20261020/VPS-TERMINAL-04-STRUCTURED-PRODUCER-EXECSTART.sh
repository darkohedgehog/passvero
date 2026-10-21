# VPS TERMINAL / PENDING_OPERATOR_COMMAND — one structured ExecStart read only.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_STRUCTURED_EXECSTART'
import datetime,json,os,re,subprocess,time
UNIT='passvero-signature-health.service'
OBJECT='/org/freedesktop/systemd1/unit/passvero_2dsignature_2dhealth_2eservice'
EXPECTED=['/usr/bin/node','/usr/local/libexec/passvero-signature-health.cjs','--config','/etc/passvero-signature-health.json']
out={'diagnostic':'SIGNATURE_PRODUCER_STRUCTURED_EXECSTART_DISPOSITION',
     'unit':UNIT,'expected':{'executable':'/usr/bin/node','argv':EXPECTED,'entryCount':1,
       'basis':'EXISTING_LOCAL_GUARD_EXPECTATION_NOT_PREVIOUSLY_CAPTURED_INSTALLED_ARGV'},
     'automaticRetry':False,'VPS_MUTATIONS':'NO','LOCK_REMOVAL':'NOT_PERFORMED',
     'PRODUCER_MANUAL_RUN':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO',
     'BACKUP_ACCEPTANCE_REPEATED':'NO','NEW_WINDOW_SCHEDULED':'NO'}
class Unavailable(Exception):pass
def need(ok,reason):
    if not ok:raise Unavailable(reason)
def unique(pairs):
    result={}
    for key,value in pairs:
        if key in result:raise ValueError()
        result[key]=value
    return result
def properties(interface,names,types):
    remaining=deadline-time.monotonic()
    need(remaining>0,'READ_BUDGET_EXPIRED')
    command=['/usr/bin/busctl','--system','--no-pager','--json=short','--auto-start=no',
        'get-property','org.freedesktop.systemd1',OBJECT,interface,*names]
    value=subprocess.run(command,capture_output=True,text=True,timeout=min(4,remaining),cwd='/',
        env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
    need(value.returncode==0,'STRUCTURED_PROPERTY_READ_UNAVAILABLE')
    need(len(value.stdout.encode())<=65536,'STRUCTURED_OUTPUT_BOUND_EXCEEDED')
    lines=value.stdout.splitlines();need(len(lines)==len(names),'STRUCTURED_PROPERTY_COUNT_MISMATCH')
    result={}
    for name,kind,line in zip(names,types,lines):
        item=json.loads(line,object_pairs_hook=unique)
        need(isinstance(item,dict)and item.get('type')==kind and 'data'in item,'STRUCTURED_PROPERTY_TYPE_OR_SHAPE_MISMATCH')
        result[name]=item['data']
    return result
def metadata():
    value=properties('org.freedesktop.systemd1.Unit',['Id','FragmentPath','DropInPaths'],['s','s','as'])
    need(value['Id']==UNIT,'UNIT_IDENTITY_MISMATCH')
    need(isinstance(value['FragmentPath'],str)and len(value['FragmentPath'])<=4096,'FRAGMENT_PATH_TYPE_INVALID')
    need(isinstance(value['DropInPaths'],list)and len(value['DropInPaths'])<=16
         and all(isinstance(p,str)and len(p)<=4096 for p in value['DropInPaths']),'DROPIN_PATH_TYPE_INVALID')
    return value
def safe_executable(value):
    # Do not echo URLs, shell expressions, assignments or arbitrary unexpected text.
    if value.startswith(('/usr/','/bin/','/sbin/','/opt/'))and re.fullmatch(r'/[A-Za-z0-9_./+@-]{1,511}',value):return value
    return '<REDACTED_UNREVIEWED_EXECUTABLE>'
def safe_arg(arg,executable,index):
    if arg in EXPECTED:return arg
    if index==0 and arg==executable:return safe_executable(arg)
    if re.fullmatch(r'--[A-Za-z][A-Za-z0-9-]{0,48}',arg)or arg in('-c','-I','-B','-e'):return arg
    return '<REDACTED_UNREVIEWED_ARGUMENT>'
try:
    need(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
    deadline=time.monotonic()+15
    before=metadata()
    items=properties('org.freedesktop.systemd1.Service',['ExecStart'],['a(sasbttttuii)'])['ExecStart']
    need(isinstance(items,list)and len(items)<=8,'EXECSTART_ARRAY_BOUND_OR_TYPE_INVALID')
    entries=[];redacted=False
    for index,item in enumerate(items):
        need(isinstance(item,list)and len(item)==10,'EXECSTART_ENTRY_SHAPE_INVALID')
        executable,argv,ignore_failure=item[:3]
        need(isinstance(executable,str)and len(executable)<=4096 and isinstance(argv,list)and len(argv)<=64
             and all(isinstance(a,str)and len(a)<=8192 for a in argv)and type(ignore_failure)is bool,'EXECSTART_ENTRY_TYPES_INVALID')
        path=safe_executable(executable)
        shown=[safe_arg(a,executable,n)for n,a in enumerate(argv)]
        hidden=[n for n,(a,b)in enumerate(zip(argv,shown))if a!=b]
        redacted=redacted or bool(hidden)or path!=executable
        entries.append({'index':index,'executable':path,'argv':shown,'ignoreFailure':ignore_failure,
                        'redactedArgumentIndexes':hidden,'executableRedacted':path!=executable})
    after=metadata()
    need(before==after,'UNIT_METADATA_CHANGED_DURING_READ_NO_RETRY')
    exact=(len(items)==1 and items[0][0]==EXPECTED[0]and items[0][1]==EXPECTED and items[0][2]is False)
    out.update(status='STRUCTURED_EXECSTART_READ_COMPLETE_RETURN_OUTPUT_AND_STOP',
        observedUTC=datetime.datetime.now(datetime.timezone.utc).isoformat(),loadedUnit=before,
        observed={'entryCount':len(items),'entries':entries},redactionApplied=redacted,
        exactComparison='NOT_CONFIRMED_REDACTED_FIELDS'if redacted else'EXACT_MATCH'if exact else'MISMATCH_REQUIRES_REVIEW',
        failingHistoricalFormattedText='NOT_RECORDED_NOT_RECONSTRUCTED')
except BaseException as error:
    out.update(status='DATA_UNAVAILABLE_RETURN_OUTPUT_NO_RETRY',
               limitation=str(error)if isinstance(error,Unavailable)else type(error).__name__)
print(json.dumps(out,indent=2,ensure_ascii=True))
PASSVERO_STRUCTURED_EXECSTART
