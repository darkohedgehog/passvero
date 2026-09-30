"""One approved staging demonstration; four shared SMTP slots, then close campaigns/timer."""
from common import A, S, R, P, sha, regular, run, identity, sql, scope, monitor, execute
import datetime, json, os, pwd, stat, subprocess, sys, time

TIMER='passvero-subscription-reminders.timer'
SERVICE='passvero-subscription-reminders.service'
DEPLOY=P('/var/lib/passvero-subscription-reminders-package-v2')
WORKER=P('/usr/local/libexec/passvero-subscription-reminders')

def fixture_identity():
    kw=identity('postgres');kw['env']['NODE_PATH']=str(A/'node_modules')
    kw['extra_groups']=sorted(set(kw['extra_groups']+[pwd.getpwnam('passvero-staging').pw_gid]))
    return kw

def service_state():
    fields=run(['systemctl','show',SERVICE,'--property=ActiveState,Result,ExecMainStatus,ExecMainStartTimestampMonotonic,InvocationID'])
    return dict(line.split('=',1) for line in fields.splitlines())

def timer_trigger():
    # systemctl renders nonzero *USec* properties as timespans, not integers.
    value=run(['systemctl','show',TIMER,'--all','--property=LastTriggerUSecMonotonic','--value'])
    assert value and value!='infinity','TIMER_TRIGGER_MISSING'
    return value

def timer_state():
    enabled=subprocess.run(['systemctl','is-enabled',TIMER],capture_output=True,text=True,timeout=10)
    active=subprocess.run(['systemctl','is-active',TIMER],capture_output=True,text=True,timeout=10)
    return {'enabled':enabled.stdout.strip(),'active':active.stdout.strip()}

def close_sending_scope(campaigns,state):
    errors=[]
    # Independent best-effort closure: a systemd failure must not skip the DB gate.
    try:run(['systemctl','disable','--now',TIMER])
    except Exception:errors.append('TIMER_DISABLE_FAILED')
    try:sql("BEGIN; UPDATE \"ReminderCampaign\" SET enabled=false WHERE id IN ('"+"','".join(campaigns)+"'); COMMIT;")
    except Exception:errors.append('CAMPAIGNS_DISABLE_FAILED')
    try:
        timer=timer_state()
        if timer!={'enabled':'disabled','active':'inactive'}:errors.append('TIMER_CLOSE_NOT_CONFIRMED')
    except Exception:
        timer={'enabled':'NOT_PROVEN','active':'NOT_PROVEN'};errors.append('TIMER_STATE_UNAVAILABLE')
    try:
        enabled=int(sql('SELECT count(*) FROM "ReminderCampaign" WHERE enabled'))
        if enabled!=0:errors.append('CAMPAIGNS_STILL_ENABLED')
    except Exception:
        enabled=None;errors.append('CAMPAIGN_STATE_UNAVAILABLE')
    try:service=service_state()
    except Exception:service={'ActiveState':'NOT_PROVEN'};errors.append('SERVICE_STATE_UNAVAILABLE')
    closure={'timer':timer,'campaignsEnabled':enabled,'serviceState':service,'historyRetained':True,'errors':errors}
    (state/'closure.json').write_text(json.dumps(closure,indent=2))
    return closure

def retained_created_fixture_evidence():
    # Resume only the known v2 stop before enqueue; retain both previous attempt directories.
    prior=R/'acceptance-v2'
    assert set(p.name for p in prior.iterdir())=={'attempt.json','create.json','closure.json'},'PRIOR_ATTEMPT_STATE_DRIFT'
    for name in ['attempt.json','create.json','closure.json']:regular(prior/name)
    attempt=json.loads((prior/'attempt.json').read_text())
    assert attempt['manifest']=='3fbd3c8a65ce296d5d6450ec97f936e73f6095fce1a23de3f2d71adc3f0913f6' and attempt['approvalExpiresAt']=='2026-10-01T09:00:00.000Z','PRIOR_ATTEMPT_PIN'
    closure=json.loads((prior/'closure.json').read_text())
    assert closure['timer']=={'enabled':'disabled','active':'inactive'} and closure['campaignsEnabled']==0 and closure['errors']==[],'PRIOR_SCOPE_NOT_CLOSED'
    assert closure['serviceState']['ActiveState']=='inactive' and closure['serviceState']['ExecMainStartTimestampMonotonic']=='0','PRIOR_WORKER_EXECUTED'
    created=json.loads((prior/'create.json').read_text())
    expected=json.loads((S/'retained-fixtures.json').read_text())
    assert created=={'action':'create','result':expected},'RETAINED_FIXTURE_EVIDENCE_DRIFT'
    counts=json.loads(sql("""BEGIN READ ONLY; SELECT json_build_object(
      'campaigns',(SELECT count(*) FROM "ReminderCampaign"),
      'enabled',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled),
      'dispatches',(SELECT COALESCE(sum(dispatches),0) FROM "ReminderCampaign"),
      'outbox',(SELECT count(*) FROM "SubscriptionReminder"),
      'attempts',(SELECT count(*) FROM "ReminderAttempt")); ROLLBACK;"""))
    assert counts=={'campaigns':2,'enabled':0,'dispatches':0,'outbox':0,'attempts':0},'DELIVERY_STATE_REQUIRES_REVIEW'
    return expected

def main(m):
    scope()
    proposal=json.loads((S/'delivery-proposal.json').read_text())
    assert proposal['status']=='APPROVED_BY_USER' and proposal['maximumSmtpDispatches']==4,'EXPLICIT_APPROVAL_REQUIRED'
    expiry=datetime.datetime.fromisoformat(proposal['expiresAt'].replace('Z','+00:00'))
    assert datetime.datetime.now(datetime.timezone.utc)<expiry-datetime.timedelta(minutes=15),'APPROVAL_WINDOW_TOO_SHORT'
    regular(DEPLOY/'manifest.json'); assert sha(DEPLOY/'manifest.json')==m['deploymentManifest'],'DEPLOYMENT_MANIFEST_DRIFT'
    deployment=json.loads((DEPLOY/'manifest.json').read_text())
    assert json.loads((R/'application/report.json').read_text())=={'deployment':'PASS','manifest':m['deploymentManifest'],'build':deployment['build_id'],'timerEnabled':False,'campaigns':0,'emailSent':False},'DEPLOYMENT_REQUIRED'
    assert (A/'.next/BUILD_ID').read_text().strip()==deployment['build_id'],'BUILD_DRIFT'
    canonical=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json');regular(canonical)
    current=json.loads(canonical.read_text());assert current['build_id']==deployment['build_id'] and current['reminders_manifest_sha256']==m['deploymentManifest'],'CURRENT_DEPLOYMENT_DRIFT'
    for name,h in deployment['application_files'].items():assert sha(A/name)==h,'DEPLOYED_ARTIFACT_DRIFT'
    for name in ['worker.cjs','launch.py']:
        regular(WORKER/name);assert sha(WORKER/name)==deployment['package_files'][name],'WORKER_DRIFT'
    for name in [TIMER,SERVICE]:
        target=P('/etc/systemd/system',name);regular(target);assert sha(target)==deployment['package_files'][name],'UNIT_DRIFT'
    assert monitor()['status']=='online','APP_NOT_ONLINE'
    assert timer_state()=={'enabled':'disabled','active':'inactive'},'TIMER_MUST_BE_DISABLED'
    assert service_state()['ActiveState']=='inactive','WORKER_MUST_BE_INACTIVE'
    assert stat.S_IMODE(WORKER.stat().st_mode)==0o755,'WORKER_DIRECTORY_REPAIR_REQUIRED'
    assert sql('SELECT count(*) FROM "SubscriptionReminder"')=='0','NO_EXISTING_OUTBOX_EXPECTED'
    observed=datetime.datetime.fromisoformat(json.loads(sql('SELECT to_json(clock_timestamp())')))
    assert abs((observed-datetime.datetime.now(datetime.timezone.utc)).total_seconds())<30,'CLOCK_SCOPE'
    retained=retained_created_fixture_evidence()
    state=R/'acceptance-v3'; runtime=R/'acceptance-runtime-v3'
    assert not state.exists() and not runtime.exists(),'DO_NOT_RETRY'
    state.mkdir(mode=0o700);runtime.mkdir(mode=0o755);runtime.chmod(0o755)
    (state/'attempt.json').write_text(json.dumps({'manifest':sys.argv[1],'approvalExpiresAt':proposal['expiresAt'],'continuation':'RETAINED_V2_FIXTURES_AFTER_WORKER_DIRECTORY_REPAIR'}))
    bundle=runtime/'acceptance.cjs';bundle.write_bytes((S/'acceptance.cjs').read_bytes());bundle.chmod(0o644)
    kw=fixture_identity()
    campaigns=[c['id'] for c in proposal['campaigns']]
    assert campaigns==['c0db6597-b030-58d5-bfe3-31019b05c427','09877c41-11ef-5e38-b0a2-4089cc40511c'],'CAMPAIGN_PIN'
    subscription,public=campaigns
    def fixture(action):
        result=subprocess.run(['/usr/bin/node',str(bundle),action],capture_output=True,text=True,timeout=40,**kw)
        assert result.returncode==0,'FIXTURE_'+action.upper()+'_FAILED'
        output=json.loads(result.stdout);assert output['action']==action,'FIXTURE_RESULT'
        (state/(action+'.json')).write_text(json.dumps(output,indent=2))
        return output['result']
    def worker(action,campaign):
        assert campaign in campaigns and datetime.datetime.now(datetime.timezone.utc)<expiry,'APPROVED_WORKER_SCOPE'
        output=json.loads(run(['/usr/bin/python3',str(WORKER/'launch.py'),action,campaign],timeout=195))
        assert output['worker']==('ENQUEUED' if action=='enqueue' else 'COMPLETED') and output['campaignId']==campaign,'WORKER_RESULT'
    def summary(label):
        value=fixture('summary');(state/(label+'.json')).write_text(json.dumps(value,indent=2));return value
    def dispatch_identity(value):
        return {'deliveries':value['deliveries'],'attempts':value['attempts'],'budgets':[[c['id'],c['dispatches']] for c in value['campaigns']]}
    def require_sent(value,total):
        sent=[r for r in value['deliveries'] if r['status']=='SENT']
        assert len(sent)==total and all(r['acceptedAt'] and r['attempts']==1 and r['receiptConfirmedAt'] is None for r in sent),'PROVIDER_ACCEPTANCE_NOT_PROVEN'
        assert len(value['attempts'])==total and all(a['status']=='ACCEPTED' for a in value['attempts']),'ATTEMPT_NOT_ACCEPTED'
        assert sum(c['dispatches'] for c in value['campaigns'])==total,'DISPATCH_COUNT'
        assert len([r for r in value['deliveries'] if r['status']=='CANCELLED' and r['attempts']==0])==2,'RENEWAL_CANCELLATION'
        assert all(r['status'] in ('SENT','CANCELLED') for r in value['deliveries']),'UNRESOLVED_DELIVERY_STOP'
    result=None
    try:
        created=fixture('resume');assert created==retained,'RETAINED_FIXTURES_CHANGED'
        print('EXISTING_SYNTHETIC_FIXTURES=REUSED; SMTP_CALLS=0',flush=True)
        response=run(['curl','--max-time','15','-sS','-o','/dev/null','-w','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/p/'+created['publicCode']])
        assert response=='200 0','PUBLIC_FIXTURE_HTTPS_REQUIRED'
        print('VOLUNTARY_PUBLIC_FIXTURE_HTTPS=PASS',flush=True)
        worker('enqueue',subscription)
        renewed=fixture('renew')
        worker('enqueue',subscription)
        fixture('narrow');print('RENEWAL_STALE_MESSAGE_INVALIDATION=PASS; CANCELLED=2; SMTP_CALLS=0',flush=True)
        worker('run',subscription)
        before=summary('after-trial-send');require_sent(before,2)
        worker('run',subscription)
        after=summary('after-replay');assert dispatch_identity(after)==dispatch_identity(before),'REPLAY_CHANGED_DELIVERY'
        print('TRIAL_PROVIDER_ACCEPTANCE=2; REPLAY_ADDITIONAL_DISPATCHES=0; INBOX_RECEIPT=NOT_PROVEN',flush=True)
        worker('run',public)
        before=summary('before-scheduled');require_sent(before,4)
        print('PUBLIC_PROVIDER_ACCEPTANCE=2; TOTAL_SMTP_DISPATCHES=4; WAITING_FOR_REAL_TIMER_CYCLE',flush=True)
        service_before=service_state();assert service_before['ActiveState']=='inactive','SERVICE_ACTIVE'
        trigger_before=timer_trigger()
        started=datetime.datetime.now(datetime.timezone.utc).isoformat()
        run(['systemctl','enable','--now',TIMER])
        deadline=time.monotonic()+360;scheduled=None
        while time.monotonic()<deadline:
            time.sleep(3)
            current=service_state()
            trigger=timer_trigger()
            if trigger!=trigger_before and trigger!='0' and int(current['ExecMainStartTimestampMonotonic'])>int(service_before['ExecMainStartTimestampMonotonic']) and current['ActiveState'] in ('inactive','failed'):
                assert current['Result']=='success' and current['ExecMainStatus']=='0','SCHEDULED_SERVICE_FAILED'
                scheduled={'timerTriggerMonotonic':trigger,'service':current,'enabledAt':started};break
        assert scheduled,'SCHEDULED_CYCLE_NOT_OBSERVED'
        run(['systemctl','disable','--now',TIMER])
        after=summary('after-scheduled');require_sent(after,4)
        assert dispatch_identity(after)==dispatch_identity(before),'SCHEDULED_EXTRA_DISPATCH'
        assert any(c['lastSuccessAt']!=next(old['lastSuccessAt'] for old in before['campaigns'] if old['id']==c['id']) for c in after['campaigns']),'SCHEDULED_SUCCESS_NOT_RECORDED'
        result={'acceptance':'PASS_PROVIDER_AND_SCHEDULER','fixtures':created,'renewal':renewed,'publicFixtureHttps':'PASS','renewalCancelled':2,'replayAdditionalDispatches':0,'maximumSmtpDispatches':4,'actualSmtpDispatches':4,'providerAccepted':4,'inboxReceipt':'NOT_PROVEN','scheduledCycle':scheduled,'deliveryEvidence':after,'productionChanges':'NONE','automaticDataDeletion':False,'commitCreated':False}
    finally:
        closure=close_sending_scope(campaigns,state)
        print(json.dumps({'sendingScopeClosed':closure}),flush=True)
        assert not closure['errors'],'SENDING_SCOPE_CLOSURE_REQUIRES_OPERATOR_REVIEW'
    result['closure']=closure
    (state/'report.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2),flush=True)

if __name__=='__main__':execute(main)
