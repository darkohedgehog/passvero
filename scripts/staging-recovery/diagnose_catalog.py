"""Read-only SQL diagnosis of an already restored private cluster; never re-restore."""
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import signal
import stat
import sys

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
SET='20261001T212354Z'
PIN='5fb296f96c37fb3ebfb681f534e6df01cf392c9fb8b993c322f696d20794fd0f'
TARGET=ROOT/'restore'/SET
CONTROL=ROOT/'control'/SET
PHASE='CATALOG_DIAGNOSTIC_PREFLIGHT'

def require(value,reason):
    if not value:raise RuntimeError(reason)

def helper():
    path=ROOT/'operator'/('restore-database-'+PIN+'.py')
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077
            and hashlib.sha256(path.read_bytes()).hexdigest()==PIN,'RESTORE_HELPER_IDENTITY')
    spec=importlib.util.spec_from_file_location('accepted_restore',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def differences(left,right,path='',found=None):
    if found is None:found=[]
    if type(left) is not type(right):found.append((path,left,right))
    elif isinstance(left,dict):
        for key in sorted(set(left)|set(right)):
            location=path+'/'+key
            if key not in left or key not in right:found.append((location,left.get(key),right.get(key)))
            else:differences(left[key],right[key],location,found)
    elif isinstance(left,list):
        if len(left)!=len(right):found.append((path+'/length',len(left),len(right)))
        for i,(a,b) in enumerate(zip(left,right)):differences(a,b,path+'/'+str(i),found)
    elif left!=right:found.append((path,left,right))
    return found

def summary(left,right):
    safe={'owner','acl','role','name','kind','rls','forceRls','superuser','inherit','createRole','createDb',
          'login','bypassRls','schema','type','label','length','finishedAt','rolledBackAt'}
    rows=[]
    for path,a,b in differences(left,right):
        row={'field':path,'sourceSha256':hashlib.sha256(json.dumps(a,sort_keys=True).encode()).hexdigest(),
             'restoredSha256':hashlib.sha256(json.dumps(b,sort_keys=True).encode()).hexdigest()}
        if path.rsplit('/',1)[-1] in safe and all(v is None or type(v) in (str,int,bool) for v in (a,b)):
            row.update(source=a,restored=b)
        rows.append(row)
    return rows

def close():
    os.umask(0o077)
    restore=helper();cap=restore.cap_module()
    saved=cap.read(CONTROL/'restore-parent-acl-stdlib.json')
    restore.restore_parents(saved['parents'],saved['postgresUid'])
    for path in (ROOT,ROOT/'restore',TARGET):cap.private(path,True)
    active=[]
    for process in pathlib.Path('/proc').iterdir():
        if process.name.isdigit():
            try:
                args=(process/'cmdline').read_bytes().split(b'\0')
                if args and args[0]==(restore.PG+'postgres').encode() and str(restore.DATA).encode() in args:
                    active.append(process.name)
            except (FileNotFoundError,ProcessLookupError,PermissionError):pass
    require(not active,'RESTORE_CLUSTER_STILL_RUNNING')
    prepare,_=cap.helpers();prepare.runtime();cap.gates(prepare)
    result={'catalogDiagnosticClosure':'PASS','restoreCluster':'STOPPED','parentPermissions':'PRIVATE_0700_RESTORED',
            'staging':'ONLINE_UNPAUSED','reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
            'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    cap.write(CONTROL/'catalog-diagnostic-closure.json',result)
    print(json.dumps(result),flush=True)

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    restore=helper();cap=restore.cap_module();cap.validate_context(SET)
    prepare,_=cap.helpers();prepare.runtime();cap.gates(prepare)
    source=restore.verify_download(cap)
    closure=cap.read(CONTROL/'restore-closure-private.json')
    require(closure['restoreClosure']=='PASS' and closure['restoreCluster']=='STOPPED','PREVIOUS_CLOSURE')
    properties=restore.run(['/usr/bin/systemctl','show','passvero-stage-restore-20261001T212354Z-private.service',
        '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode()
    values=dict(line.split('=',1) for line in properties.splitlines() if '=' in line)
    require(values=={'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                     'InvocationID':'66133792f28045ce89f45b6ed23fdae9'},'FAILED_RESTORE_UNIT_CHANGED')
    require(not (CONTROL/'database-restore-summary.json').exists(),'DATABASE_ALREADY_ACCEPTED')
    require(not (CONTROL/'catalog-diagnostic-attempt.json').exists(),'CATALOG_DIAGNOSTIC_ALREADY_ATTEMPTED')
    require(not (restore.DATA/'postmaster.pid').exists(),'RESTORE_CLUSTER_NOT_STOPPED')
    postgres=pwd.getpwnam('postgres')
    for path in (restore.DATA,restore.SOCKET):
        info=path.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid==postgres.pw_uid
                and stat.S_IMODE(info.st_mode)==0o700,'PRIVATE_CLUSTER_POSTURE')
    require((restore.DATA/'PG_VERSION').read_text().strip()=='16','PRIVATE_CLUSTER_VERSION')
    saved=cap.read(CONTROL/'restore-parent-acl-stdlib.json')
    parents=[ROOT,ROOT/'restore',TARGET]
    require(restore.acl_baseline(parents)==saved['parents'] and saved['postgresUid']==postgres.pw_uid,
            'RESTORE_PARENT_IDENTITY_CHANGED')
    cap.write(CONTROL/'catalog-diagnostic-attempt.json',{'setId':SET,'purpose':'READ_ONLY_CATALOG_DIFFERENCES',
              'restoreRepeated':False,'automaticRetry':False})
    for path in parents:
        os.setxattr(path,restore.ACL_NAME,restore.traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(restore.get_acl(path)==restore.traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    PHASE='READ_ONLY_PRIVATE_CLUSTER_START'
    account=prepare.account('postgres')
    restore.run([restore.PG+'pg_ctl','-D',str(restore.DATA),'-l',str(restore.DATA/'catalog-diagnostic.log'),
        '-w','-t','30','start','-o',"-c listen_addresses='' -c port=55434 -c unix_socket_directories="+
        str(restore.SOCKET)+' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'
        +' -c default_transaction_read_only=on'],account=account)
    settings=restore.sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'),'readonly',current_setting('default_transaction_read_only'))")
    require(settings=={'data':str(restore.DATA),'tcp':'','port':'55434','readonly':'on'},'ISOLATED_READ_ONLY_IDENTITY')
    PHASE='COMPARE_CATALOG_WITHOUT_SCHEMA_OR_DATA_WRITES'
    meta=cap.read(source/'database/manifest.json')
    current=restore.sql(cap.CATALOG)
    cap.write(CONTROL/'catalog-diagnostic-current.json',current)
    left={k:v for k,v in meta['catalog'].items() if k!='database'}
    right={k:v for k,v in current.items() if k!='database'}
    sections={}
    for key in sorted(set(left)|set(right)):
        a,b=left.get(key),right.get(key)
        unordered=isinstance(a,list) and isinstance(b,list) and sorted(json.dumps(x,sort_keys=True) for x in a)==sorted(json.dumps(x,sort_keys=True) for x in b)
        sections[key]={'strictEqual':a==b,'unorderedEntriesEqual':unordered}
    diffs=summary(left,right)
    result={'diagnostic':'READ_ONLY_RESTORED_CATALOG_COMPLETE','setId':SET,'catalogMatch':left==right,
            'sections':sections,'differenceCount':len(diffs),'differences':diffs[:50],
            'differencesTruncated':len(diffs)>50,'fullDifferenceEvidenceRetained':True,
            'restoreRepeated':False,'schemaWrites':'NONE','businessWrites':'NONE','tcpListener':False,
            'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}
    cap.write(CONTROL/'catalog-diagnostic-differences.json',{'result':result,'allDifferences':diffs})
    print(json.dumps(result),flush=True)
    PHASE='STOP_PRIVATE_DIAGNOSTIC_CLUSTER'
    restore.run([restore.PG+'pg_ctl','-D',str(restore.DATA),'-m','fast','-w','-t','20','stop'],account=account)

if __name__=='__main__':
    try:
        if sys.argv[1:]==['--close']:close()
        else:
            signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(RuntimeError('OPERATOR_INTERRUPTED')))
            main()
    except BaseException as error:
        reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
        print(json.dumps({'catalogDiagnostic':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
            'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}),flush=True)
        sys.exit(1)
