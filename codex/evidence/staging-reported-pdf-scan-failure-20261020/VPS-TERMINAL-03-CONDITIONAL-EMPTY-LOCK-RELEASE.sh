# VPS TERMINAL / PENDING_OPERATOR_COMMAND — one conditional empty-lock release.
# Prerequisite: this operator controls the window; no concurrent root/admin/manual producer actions.
# If that prerequisite cannot be guaranteed, DO NOT execute. No automatic retry.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CONDITIONAL_LOCK_RELEASE'
import base64,hashlib,json,os,pathlib,stat,subprocess,zlib
P=pathlib.Path
root=P('/var/lib/passvero-signature-lock-release-20261020-01')
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('WRONG_OPERATOR_HOST')
    os.umask(0o077)
    if root.exists()or root.is_symlink():raise RuntimeError('OPERATION_DIRECTORY_ALREADY_EXISTS_NO_RETRY')
    for parent in root.parents:
        st=parent.lstat()
        if not stat.S_ISDIR(st.st_mode)or st.st_uid!=0 or st.st_mode&0o022:raise RuntimeError('PRIVATE_PARENT_REQUIRED')
    packed=(
        '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'
        '1MzlvX8D/OJPXw=='
    )
    body=zlib.decompress(base64.b64decode(packed))
    if hashlib.sha256(body).hexdigest()!='92c739870e077d7e6998e583176bf188103dca3c6a5646c5437100e51b177322':raise RuntimeError('REVIEWED_MAINTENANCE_SOURCE_CHANGED')
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
    name='passvero-signature-lock-release-20261020-01'
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
            'LOCK_REMOVAL':'UNCONFIRMED_REQUIRES_OPERATOR_REVIEW','timerRestore':'NOT_PROVEN',
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
        'PRODUCER_MANUAL_RUN':'NO','SCAN_CALLS':0,'REBOOT_REPEATED':'NO','BACKUP_ACCEPTANCE_REPEATED':'NO'}))
PASSVERO_CONDITIONAL_LOCK_RELEASE
