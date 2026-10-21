# VPS TERMINAL / PENDING_OPERATOR_COMMAND — LOCAL CANDIDATE ONLY — not executed; additive continuation of stopped03.
# Prerequisite: this operator controls the window; no concurrent root/admin/manual producer actions.
# If that prerequisite cannot be guaranteed, DO NOT execute. No automatic retry.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CONDITIONAL_LOCK_RELEASE'
import base64,hashlib,json,os,pathlib,stat,subprocess,zlib
P=pathlib.Path
prior=P('/var/lib/passvero-signature-lock-release-20261020-01')
root=prior/'env-launch-continuation'
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('WRONG_OPERATOR_HOST')
    os.umask(0o077)
    if root.exists()or root.is_symlink():raise RuntimeError('OPERATION_DIRECTORY_ALREADY_EXISTS_NO_RETRY')
    for parent in root.parents:
        st=parent.lstat()
        if not stat.S_ISDIR(st.st_mode)or st.st_uid!=0 or st.st_mode&0o022:raise RuntimeError('PRIVATE_PARENT_REQUIRED')
    def preserved(path, limit=32768):
        for parent in path.parents:
            st=parent.lstat()
            if not stat.S_ISDIR(st.st_mode)or st.st_uid!=0 or st.st_mode&0o022:raise RuntimeError('PRIVATE_HISTORY_PARENT_REQUIRED')
        fd=os.open(path,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
        try:
            before=os.fstat(fd)
            if not stat.S_ISREG(before.st_mode)or before.st_uid!=0 or before.st_nlink!=1 or before.st_mode&0o022 or not 0<before.st_size<=limit:raise RuntimeError('PRIVATE_HISTORY_FILE_REQUIRED')
            body=os.read(fd,limit+1)
            if len(body)!=before.st_size:raise RuntimeError('HISTORY_READ_BOUND')
            for current in(os.fstat(fd),path.lstat()):
                if(current.st_dev,current.st_ino,current.st_size,current.st_mtime_ns,current.st_ctime_ns)!=(before.st_dev,before.st_ino,before.st_size,before.st_mtime_ns,before.st_ctime_ns):raise RuntimeError('HISTORY_CHANGED')
            return body
        finally:os.close(fd)
    history={name:preserved(prior/name)for name in('conditional-lock-release.py','stop.json','closure.json')}
    if hashlib.sha256(history['conditional-lock-release.py']).hexdigest()!='92c739870e077d7e6998e583176bf188103dca3c6a5646c5437100e51b177322':raise RuntimeError('HISTORICAL_HELPER_IDENTITY_MISMATCH')
    stopped=json.loads(history['stop.json']);closed=json.loads(history['closure.json'])
    if not(stopped.get('status')=='STOP'and stopped.get('CHECK_ID')=='LOCK_RELEASE_BODY'and stopped.get('reason')=='PRODUCER_ENTRYPOINT_DRIFT'and stopped.get('LOCK_REMOVAL')=='NOT_PERFORMED'):raise RuntimeError('PRIOR_STOP_IDENTITY_MISMATCH')
    if not(closed.get('closure')=='NO_TIMER_CHANGE_STARTED'and closed.get('timerRestored')is True and closed.get('partial')is False and closed.get('pending')==[]):raise RuntimeError('PRIOR_CLOSURE_NOT_CONFIRMED')
    for name in('baseline.json','pause-intent.json','removal-intent.json','removed.json','resume-intent.json'):
        if(prior/name).exists()or(prior/name).is_symlink():raise RuntimeError('PRIOR_OPERATION_STATE_NOT_REVIEWED')
    packed=(
        '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'
    )
    body=zlib.decompress(base64.b64decode(packed))
    if hashlib.sha256(body).hexdigest()!='c6d2d1b153920872aba24e17a47fa26ec601e41cf717a7dad957f2dd57af3a13':raise RuntimeError('REVIEWED_MAINTENANCE_SOURCE_CHANGED')
    root.mkdir(mode=0o700)
    fd=os.open(root/'prior-history.json',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
    with os.fdopen(fd,'w')as f:json.dump({'priorClosedDirectory':str(prior),'preservedSha256':{k:hashlib.sha256(v).hexdigest()for k,v in history.items()}},f);f.flush();os.fsync(f.fileno())
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
    name='passvero-signature-lock-release-20261020-01-env-continuation'
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
