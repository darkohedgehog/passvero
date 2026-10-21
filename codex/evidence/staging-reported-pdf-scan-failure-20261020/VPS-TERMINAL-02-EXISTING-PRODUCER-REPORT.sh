# VPS TERMINAL / PENDING_OPERATOR_COMMAND — one existing invocation report only.
# Source: produce-document-signature-health.ts stdout JSON; existing runbook unit journal.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_EXISTING_PRODUCER_REPORT'
import datetime,json,math,os,re,subprocess,time
UNIT='passvero-signature-health.service'
out={'diagnostic':'SIGNATURE_HEALTH_EXISTING_PRODUCER_REPORT_READONLY','unit':UNIT,
     'status':'NOT_RECORDED','producerReport':None,'automaticRetry':False,
     'SERVICE_MUTATIONS':'NO','PRODUCER_EXECUTED_BY_DIAGNOSTIC':'NO',
     'SCAN_CALLS':0,'REBOOT_REPEATED':'NO','BACKUP_ACCEPTANCE_REPEATED':'NO'}
class Limited(Exception):pass
def require(ok,code):
    if not ok:raise Limited(code)
def run(args):
    remaining=deadline-time.monotonic()
    require(remaining>0,'READ_BUDGET_EXPIRED')
    value=subprocess.run(args,capture_output=True,text=True,cwd='/',timeout=min(5,remaining),
        env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'})
    require(len(value.stdout.encode())<=65536,'BOUNDED_OUTPUT_EXCEEDED')
    require(value.returncode==0,'READ_COMMAND_UNAVAILABLE')
    return value.stdout
PROPERTIES='Id,LoadState,ActiveState,SubState,Result,ExecMainCode,ExecMainStatus,InvocationID,StandardOutput'
def unit():
    body=run(['/usr/bin/systemctl','show',UNIT,'--no-pager','--property='+PROPERTIES])
    return dict(line.split('=',1)for line in body.splitlines()if '='in line)
def failed(value):
    return (value.get('Id')==UNIT and value.get('LoadState')=='loaded'
        and value.get('ActiveState')=='failed' and value.get('SubState')=='failed'
        and value.get('Result')=='exit-code' and value.get('ExecMainCode')=='1'
        and value.get('ExecMainStatus')=='1')
def unique_object(pairs):
    obj={}
    for key,value in pairs:
        if key in obj:raise ValueError()
        obj[key]=value
    return obj
try:
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
    deadline=time.monotonic()+15
    before=unit()
    require(failed(before),'NO_RELIABLE_CURRENT_FAILED_EXIT_1_INVOCATION')
    invocation=before.get('InvocationID','')
    require(re.fullmatch('[0-9a-f]{32}',invocation)is not None and invocation!='0'*32,'FAILED_INVOCATION_ID_NOT_RECORDED')
    out['invocationId']=invocation
    require(before.get('StandardOutput')in('journal','journal-or-kmsg','journal+console','journal-or-kmsg+console'),
        'NORMALIZED_STDOUT_NOT_AVAILABLE_IN_EXPECTED_JOURNAL_SINK')
    fields='__REALTIME_TIMESTAMP,_SYSTEMD_INVOCATION_ID,_SYSTEMD_UNIT,_TRANSPORT,MESSAGE'
    # Exactly one journal read, scoped by trusted unit+invocation. No generic log dump.
    body=run(['/usr/bin/journalctl','--no-pager','--quiet','--reverse','-n','32','-o','json',
        '--output-fields='+fields,'-u',UNIT,'_SYSTEMD_INVOCATION_ID='+invocation])
    result_codes={'UNTRUSTED','BUSY','OPERATIONAL_FAILURE'}
    phases={'ACQUIRE','SEQUENCE','COLLECT','VERSION','UPDATER','DAEMON','COMPARE','VALIDATE',
            'PUBLISH','INVALIDATE','RELEASE','COMPLETE','CONFIGURATION'}
    reasons={'CANCELLED','CONFIGURATION_CHANGED','CONFIGURATION_INVALID','DAEMON_LOG_INCOMPLETE',
        'DAEMON_UNAVAILABLE','DATABASE_INVALID','DATABASE_SET_UNCERTAIN','INPUT_BOUND','INPUT_CHANGED',
        'LOCK_REQUIRED','OWNER_REQUIRED','PRIVATE_INPUT_REQUIRED','PUBLICATION_INVALID','SEQUENCE_INVALID',
        'SEQUENCE_LOST','EVIDENCE_INVALID','EVIDENCE_CONTINUITY_REQUIRED','DAEMON_UNCERTAIN','DEADLINE_EXCEEDED',
        'CLOCK_MOVED_BACKWARDS','OBSERVATION_CHANGED','HEALTH_IDENTITY_INVALID','UNKNOWN_FAILURE',
        'INPUT_UNAVAILABLE','PUBLICATION_FAILED','INVALIDATION_FAILED','RELEASE_FAILED'}
    selected=None
    for line in body.splitlines():
        try:
            row=json.loads(line,object_pairs_hook=unique_object)
            if not isinstance(row,dict)or row.get('_SYSTEMD_UNIT')!=UNIT or row.get('_SYSTEMD_INVOCATION_ID')!=invocation:continue
            if row.get('_TRANSPORT')!='stdout' or not isinstance(row.get('MESSAGE'),str):continue
            message=row['MESSAGE']
            if len(message)>4096:continue
            report=json.loads(message,object_pairs_hook=unique_object)
            if not isinstance(report,dict)or set(report)!={'result','phase','reason','durationMs'}:continue
            if not isinstance(report['result'],str)or report['result']not in result_codes:continue
            if not isinstance(report['phase'],str)or report['phase']not in phases:continue
            reason=report['reason']
            if reason is not None and (not isinstance(reason,str)or reason not in reasons):continue
            duration=report['durationMs']
            if type(duration)not in(int,float)or not math.isfinite(duration)or duration<0:continue
            stamp=row.get('__REALTIME_TIMESTAMP')
            if not isinstance(stamp,str)or re.fullmatch('[0-9]{1,18}',stamp)is None:continue
            timestamp=(datetime.datetime(1970,1,1,tzinfo=datetime.timezone.utc)+datetime.timedelta(microseconds=int(stamp))).isoformat()
            selected={'timestamp':timestamp,**{key:report[key]for key in('result','phase','reason','durationMs')}}
            break
        except (ValueError,TypeError,KeyError,OverflowError):continue
    # This is a consistency check of the same unit, not another service/health diagnostic.
    after=unit()
    require(failed(after)and all(before.get(k)==after.get(k)for k in('InvocationID','Result','ExecMainCode','ExecMainStatus','StandardOutput')),
        'INVOCATION_CHANGED_OR_FAILURE_NOT_STABLE_NO_RETRY')
    require(selected is not None,'NO_VALID_LINKED_NORMALIZED_REPORT_IN_32_INVOCATION_ENTRIES')
    out.update(status='EXISTING_FAILED_INVOCATION_REPORT_FOUND',producerReport=selected)
except Limited as error:
    out['limitation']=str(error)
except BaseException as error:
    # Exception messages and command stdout/stderr never escape this block.
    out['limitation']='READ_UNAVAILABLE_'+type(error).__name__
print(json.dumps(out,indent=2))
PASSVERO_EXISTING_PRODUCER_REPORT
