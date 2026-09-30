"""One real timer-triggered idle cycle. Campaigns stay disabled; no DB writes."""
import datetime, hashlib, json, os, pathlib, re, stat, subprocess, sys, time
sys.dont_write_bytecode=True
P=pathlib.Path
TIMER='passvero-subscription-reminders.timer'
SERVICE='passvero-subscription-reminders.service'
PACKAGE=P('/var/lib/passvero-subscription-reminders-acceptance-package-v3')
PIN='94de46dc9668485c75c3b47058093acf77c436213ae47ea59fd454648b6da2fb'
CAMPAIGNS=['09877c41-11ef-5e38-b0a2-4089cc40511c','c0db6597-b030-58d5-bfe3-31019b05c427']
common=None
phase='PREFLIGHT'

def command(args,timeout=20):
    result=subprocess.run(args,capture_output=True,text=True,timeout=timeout,env={'PATH':'/usr/bin:/bin','LANG':'C'})
    assert result.returncode==0,'COMMAND_FAILED_'+phase
    return result.stdout.strip()

def properties(unit):
    names='LoadState,ActiveState,UnitFileState,LastTriggerUSecMonotonic' if unit==TIMER else 'ActiveState,Result,ExecMainStatus,ExecMainStartTimestampMonotonic,InvocationID'
    raw=command(['systemctl','show',unit,'--all','--property='+names])
    assert all('=' in line for line in raw.splitlines()),'PROPERTY_FORMAT_INVALID'
    return dict(line.split('=',1) for line in raw.splitlines())

def monotonic_value(values,key,label):
    value=values.get(key,'')
    assert re.fullmatch(r'[0-9]+',value),label+'_MONOTONIC_INVALID'
    return int(value)

def timer_marker(values):
    # systemctl formats nonzero *USec* values as timespans. Compare opaque markers;
    # independently require a newer numeric service start and invocation journal proof.
    value=values.get('LastTriggerUSecMonotonic','')
    assert value and value!='infinity','TIMER_TRIGGER_MISSING'
    return value

def inventory():
    return json.loads(common.sql('''BEGIN READ ONLY; SELECT json_build_object(
      'campaigns',(SELECT COALESCE(json_agg(c ORDER BY c.id),'[]') FROM "ReminderCampaign" c),
      'outbox',(SELECT COALESCE(json_agg(r ORDER BY r.id),'[]') FROM "SubscriptionReminder" r),
      'attempts',(SELECT COALESCE(json_agg(a ORDER BY a.id),'[]') FROM "ReminderAttempt" a)); ROLLBACK;'''))

def assert_closed_inventory(value):
    assert sorted(c['id'] for c in value['campaigns'])==CAMPAIGNS,'CAMPAIGN_SCOPE'
    assert all(c['enabled'] is False and c['dispatches']==c['maxDispatches']==2 and c.get('leaseToken') is None and c.get('leaseUntil') is None for c in value['campaigns']),'CAMPAIGNS_MUST_REMAIN_CLOSED_AND_EXHAUSTED'
    rows=value['outbox']
    assert len(rows)==6 and sum(r['status']=='SENT' and r['attempts']==1 for r in rows)==4 and sum(r['status']=='CANCELLED' and r['attempts']==0 for r in rows)==2,'OUTBOX_STATE'
    assert len(value['attempts'])==4 and all(a['status']=='ACCEPTED' for a in value['attempts']),'ATTEMPT_STATE'

def journal_evidence(since):
    raw=command(['journalctl','--quiet','--no-pager','-o','json','-u',SERVICE,'--since',since],timeout=20)
    evidence=[]
    for line in raw.splitlines():
        entry=json.loads(line)
        try:message=json.loads(entry.get('MESSAGE',''))
        except (TypeError,ValueError):continue
        if message=={'worker':'IDLE','sending':'NO_APPROVED_CAMPAIGN'}:
            invocation=entry.get('_SYSTEMD_INVOCATION_ID','')
            assert re.fullmatch(r'[0-9a-f]{32}',invocation),'JOURNAL_INVOCATION_REQUIRED'
            evidence.append({'invocationId':invocation,**message})
    return evidence

def observe(state):
    global phase
    before=inventory();assert_closed_inventory(before)
    timer_before=properties(TIMER);service_before=properties(SERVICE)
    assert timer_before.get('LoadState')=='loaded' and timer_before.get('ActiveState')=='inactive' and timer_before.get('UnitFileState')=='disabled','TIMER_INITIAL_STATE'
    assert service_before.get('ActiveState')=='inactive','SERVICE_INITIAL_STATE'
    trigger_before=timer_marker(timer_before)
    start_before=monotonic_value(service_before,'ExecMainStartTimestampMonotonic','SERVICE')
    since=datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')
    (state/'before.json').write_text(json.dumps({'timer':timer_before,'service':service_before,'databaseSha256':hashlib.sha256(json.dumps(before,sort_keys=True).encode()).hexdigest()},indent=2))
    result=None
    try:
        phase='ENABLE_TIMER'
        command(['systemctl','enable','--now',TIMER])
        print('SCHEDULER_ONLY=WAITING; CAMPAIGNS_ENABLED=0; EXISTING_DISPATCHES=4',flush=True)
        phase='OBSERVE_TIMER'
        deadline=time.monotonic()+390
        while time.monotonic()<deadline:
            time.sleep(3)
            timer=properties(TIMER);service=properties(SERVICE)
            trigger=timer_marker(timer)
            started=monotonic_value(service,'ExecMainStartTimestampMonotonic','SERVICE')
            if trigger!=trigger_before and trigger!='0' and started>start_before and service.get('ActiveState') in ('inactive','failed'):
                assert service.get('Result')=='success' and service.get('ExecMainStatus')=='0','SCHEDULED_SERVICE_FAILED'
                phase='VERIFY_JOURNAL'
                journal=journal_evidence(since)
                assert len(journal)==1,'ONE_IDLE_INVOCATION_REQUIRED'
                result={'scheduler':'PASS_TIMER_TRIGGERED_IDLE_CYCLE','triggerBefore':trigger_before,'triggerAfter':trigger,'service':service,'workerEvidence':journal}
                break
        assert result,'SCHEDULED_CYCLE_NOT_OBSERVED'
    finally:
        # Only timer state is mutated. Campaigns are never enabled by this proof.
        previous_phase=phase
        phase='CLOSE_TIMER'
        errors=[]
        try:command(['systemctl','disable','--now',TIMER])
        except Exception:errors.append('TIMER_DISABLE_FAILED')
        try:
            timer=properties(TIMER)
            assert timer.get('ActiveState')=='inactive' and timer.get('UnitFileState')=='disabled'
        except Exception:errors.append('TIMER_CLOSE_NOT_CONFIRMED')
        closure={'timerDisabledInactive':not errors,'campaignsEnabledByProof':False,'errors':errors}
        (state/'closure.json').write_text(json.dumps(closure,indent=2))
        print(json.dumps({'schedulerScopeClosed':closure}),flush=True)
        assert not errors,'TIMER_CLOSURE_REQUIRES_REVIEW'
        phase=previous_phase
    phase='VERIFY_UNCHANGED_DATABASE'
    after=inventory();assert_closed_inventory(after)
    assert after==before,'DATABASE_CHANGED_DURING_IDLE_CYCLE'
    result.update(databaseUnchanged=True,existingSmtpDispatches=4,additionalSmtpDispatches=0,campaignsEnabled=0,closure=closure)
    (state/'report.json').write_text(json.dumps(result,indent=2))
    return result

def main():
    global common
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    os.umask(0o077)
    for p in [PACKAGE,*PACKAGE.parents]:
        info=p.lstat();assert stat.S_ISDIR(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_DIRECTORY'
    def safe(p):
        info=p.lstat();assert stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o022,'PACKAGE_FILE'
        return p.read_bytes()
    raw=safe(PACKAGE/'manifest.json');assert hashlib.sha256(raw).hexdigest()==PIN,'MANIFEST_PIN'
    manifest=json.loads(raw)
    assert hashlib.sha256(safe(PACKAGE/'common.py')).hexdigest()==manifest['package_files']['common.py'],'COMMON_PIN'
    sys.path.insert(0,str(PACKAGE));sys.argv=[sys.argv[0],PIN]
    import common as verified_common
    common=verified_common;common.verify();common.scope()
    deployment=P('/var/lib/passvero-subscription-reminders-package-v2/manifest.json')
    assert hashlib.sha256(safe(deployment)).hexdigest()==manifest['deploymentManifest'],'DEPLOYMENT_PIN'
    deployed=json.loads(safe(deployment))
    for name in [TIMER,SERVICE]:assert hashlib.sha256(safe(P('/etc/systemd/system')/name)).hexdigest()==deployed['package_files'][name],'UNIT_DRIFT'
    for name in ['worker.cjs','launch.py']:assert hashlib.sha256(safe(P('/usr/local/libexec/passvero-subscription-reminders')/name)).hexdigest()==deployed['package_files'][name],'WORKER_DRIFT'
    assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime(2026,10,1,8,45,tzinfo=datetime.timezone.utc),'ORIGINAL_APPROVAL_WINDOW_CLOSED'
    prior=common.R/'acceptance-v3'
    assert json.loads(safe(prior/'attempt.json'))['manifest']==PIN,'PRIOR_ATTEMPT_PIN'
    saved=json.loads(safe(prior/'before-scheduled.json'))
    assert sum(c['dispatches'] for c in saved['campaigns'])==4 and len(saved['attempts'])==4,'PRIOR_DELIVERY_PROOF_REQUIRED'
    state=common.R/'scheduler-proof-v1'
    assert not state.exists() and not state.is_symlink(),'DO_NOT_RERUN'
    state.mkdir(mode=0o700)
    (state/'attempt.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(P(__file__).read_bytes()).hexdigest(),'campaignsStayDisabled':True,'priorManifest':PIN}))
    print(json.dumps(observe(state),indent=2),flush=True)

if __name__=='__main__':
    try:main()
    except Exception as error:
        print(json.dumps({'scheduler':'STOP','phase':phase,'reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED','doNotRerun':True}))
        sys.exit(1)
