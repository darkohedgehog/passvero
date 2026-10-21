# VPS TERMINAL / PENDING_OPERATOR_COMMAND — precise relevant-owner conditional lock release; one authorized execution.
# Prerequisite: this operator controls the window; no concurrent root/admin/manual producer actions.
# If that prerequisite cannot be guaranteed, DO NOT execute. No automatic retry.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CONDITIONAL_LOCK_RELEASE'
import base64,hashlib,json,os,pathlib,stat,subprocess,zlib
P=pathlib.Path
root=P('/var/lib/passvero-signature-lock-release-20261020-01/precise-owner-release')
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('WRONG_OPERATOR_HOST')
    os.umask(0o077)
    if root.exists()or root.is_symlink():raise RuntimeError('OPERATION_DIRECTORY_ALREADY_EXISTS_NO_RETRY')
    for parent in root.parents:
        st=parent.lstat()
        if not stat.S_ISDIR(st.st_mode)or st.st_uid!=0 or st.st_mode&0o022:raise RuntimeError('PRIVATE_PARENT_REQUIRED')
    packed=(
        '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'
    )
    body=zlib.decompress(base64.b64decode(packed))
    if hashlib.sha256(body).hexdigest()!='2cac1aee2fdc2bd12a72fa3a59c8a9c0d38ed239a8da5ce32b0cabcab5338b5b':raise RuntimeError('REVIEWED_MAINTENANCE_SOURCE_CHANGED')
    root.mkdir(mode=0o700)
    helper=root/'conditional-lock-release.py'
    fd=os.open(helper,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'wb')as f:f.write(body);f.flush();os.fsync(f.fileno())
    status=dict(line.split(':',1)for line in P('/proc/self/status').read_text().splitlines()if ':'in line)
    procstat=P('/proc/self/stat').read_text()
    controller={'pid':os.getpid(),'startTicks':procstat[procstat.rfind(')')+2:].split()[19],
                'executable':os.readlink('/proc/self/exe'),'uids':list(map(int,status['Uid'].split()))}
    fd=os.open(root/'controller.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w')as f:json.dump(controller,f);f.flush();os.fsync(f.fileno())
    if helper.read_bytes()!=body:raise RuntimeError('SOURCE_READBACK_CHANGED')
    name='passvero-signature-lock-release-20261021-precise'
    # This transient scope runs only the maintenance body; it never runs the producer.
    args=['/usr/bin/systemd-run','--quiet','--wait','--unit',name,
          '--property=Type=exec','--property=Restart=no','--property=RuntimeMaxSec=65s',
          '--property=TimeoutStopSec=30s','--property=KillMode=control-group',
          '--property=KillSignal=SIGKILL','--property=UMask=0077',
          '--property=StandardOutput=null','--property=StandardError=null',
          '--property=ExecStopPost=/usr/bin/python3 -I -B '+str(helper)+' close',
          '/usr/bin/python3','-I','-B',str(helper),'body']
    done=subprocess.run(args,capture_output=True,text=True,timeout=110,
         env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'},cwd='/')
    if not(root/'closure.json').is_file():
        print(json.dumps({'status':'STOP','reason':'INDEPENDENT_CLOSURE_NOT_RECORDED_NO_RETRY',
            'maintenanceUnitReturnCode':done.returncode,'operationDirectory':str(root),
            'LOCK_REMOVAL':'UNCONFIRMED_REQUIRES_OPERATOR_REVIEW','TIMER_RESTORE':'PARTIAL_PENDING','LOCK_ABANDONMENT':'NOT_CONFIRMED',
            'PRODUCER_MANUAL_RUN':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO','BACKUP_ACCEPTANCE_REPEATED':'NO'}))
    else:
        # One bounded observation of the next normal timer cycle + one existing reader call.
        final=subprocess.run(['/usr/bin/python3','-I','-B',str(helper),'final'],
            capture_output=True,text=True,timeout=80,cwd='/',env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
        try:report=json.loads(final.stdout)
        except ValueError:report={'status':'STOP','reason':'FINAL_SANITIZED_REPORT_NOT_RECORDED_NO_RETRY'}
        report['maintenanceUnitReturnCode']=done.returncode
        report['operationDirectory']=str(root)
        for name in('baseline.json','removed.json'):
            path=root/name
            if path.is_file():report[name]=json.loads(path.read_text())
        print(json.dumps(report,indent=2))
except BaseException as error:
    print(json.dumps({'status':'STOP','reason':str(error)if isinstance(error,RuntimeError)else type(error).__name__,
        'operationDirectory':str(root),'instruction':'NO_RETRY_RETURN_OUTPUT_CLOSURE_MAY_STILL_BE_RUNNING',
        'LOCK_REMOVAL':'UNCONFIRMED_REQUIRES_OPERATOR_REVIEW'if(root/'pause-intent.json').exists()else'NOT_PERFORMED',
        'TIMER_RESTORE':'PARTIAL_PENDING','LOCK_ABANDONMENT':'NOT_CONFIRMED',
        'PRODUCER_MANUAL_RUN':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO','BACKUP_ACCEPTANCE_REPEATED':'NO'}))
PASSVERO_CONDITIONAL_LOCK_RELEASE
