"""Operator-only one-shot approved enable and two ordinary timer-cycle idle proofs."""
import hashlib, json, os, pathlib, re, subprocess, sys, time

PACKAGE = pathlib.Path('/var/lib/passvero-future-enrollment-20261008/package')
STATE = PACKAGE.parent/'state'
PIN = 'f87ceb46255104c856d3012c4aed3eccff48cff311d45cbce3a27fa9bc16df5d'
ORG = 'ee116a32-05e8-401f-a90f-b54b31b3b7e9'
CAMPAIGN = 'a24b67dd-442c-4f06-b4f3-498554b4ff31'
APPROVAL = 'USER_APPROVED_FUTURE_REMINDER_ENROLLMENT_20261008'
SQL_PATH = pathlib.Path(__file__).with_name('enable-reviewed.sql')
# Loaded only after the new block and retained deployment package are hash-checked.

def digest(path): return hashlib.sha256(path.read_bytes()).hexdigest()

def stable(inventory):
    campaigns=[]
    for row in inventory['campaigns']:
        value={k:v for k,v in row.items() if k not in ('lastStartedAt','lastSuccessAt','lastError','leaseToken','leaseUntil')}
        if value['id']==CAMPAIGN:
            value['enrollmentOrganizationId']=None; value['periodKey']=None
        campaigns.append(value)
    return {'organizations':inventory['organizations'],'campaigns':campaigns,'outbox':inventory['outbox'],'attemptCounts':inventory['attemptCounts']}

def differences(expected, observed, path='scope'):
    changes=[]
    if isinstance(expected,dict) and isinstance(observed,dict):
        for key in sorted(set(expected)|set(observed)):
            changes.extend(differences(expected.get(key),observed.get(key),path+'.'+key))
    elif isinstance(expected,list) and isinstance(observed,list):
        if len(expected)!=len(observed): changes.append({'path':path,'expectedCount':len(expected),'observedCount':len(observed)})
        for index,(before,after) in enumerate(zip(expected,observed)):
            changes.extend(differences(before,after,path+'['+str(index)+']'))
    elif expected!=observed:
        changes.append({'path':path,'expected':expected,'observed':observed})
    return changes[:20]

class ScopeDrift(AssertionError):
    def __init__(self, expected, observed):
        super().__init__('MATERIAL_SCOPE_RECIPIENT_PERIOD_COUNTER_OR_OUTBOX_DRIFT')
        self.differences=differences(expected,observed)

def validate_scope(observed, expected):
    if stable(observed)!=stable(expected): raise ScopeDrift(stable(expected),stable(observed))
    assert all(r['status'] in ('SENT','CANCELLED') for r in observed['outbox']), 'UNEXPECTED_DUE_OR_UNRESOLVED_DELIVERY'

def cycle_complete(unit, prior_start, seen):
    start=int(unit.get('ExecMainStartTimestampMonotonic','0'))
    invocation=unit.get('InvocationID','')
    return start>prior_start and re.fullmatch('[0-9a-f]{32}',invocation or '') is not None and invocation not in seen and unit.get('ActiveState')=='inactive' and unit.get('Result')=='success' and unit.get('ExecMainStatus')=='0'

def main():
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647', 'WRONG_HOST'
    assert len(sys.argv)==3 and re.fullmatch('[0-9a-f]{64}',sys.argv[1]) and re.fullmatch('[0-9a-f]{64}',sys.argv[2]), 'SCRIPT_AND_SQL_PINS_REQUIRED'
    assert digest(pathlib.Path(__file__))==sys.argv[1] and digest(SQL_PATH)==sys.argv[2], 'ENABLE_INPUT_DRIFT'
    # Validate retained trusted files before importing their helpers.
    assert digest(PACKAGE/'manifest.json')==PIN, 'DEPLOYMENT_MANIFEST_DRIFT'
    manifest=json.loads((PACKAGE/'manifest.json').read_text())
    for name,pin in manifest['package_files'].items():
        path=PACKAGE/name; info=path.lstat()
        assert '/' not in name and path.is_file() and not path.is_symlink() and info.st_uid==0 and not info.st_mode&0o022 and digest(path)==pin, 'DEPLOYMENT_PACKAGE_DRIFT'
    sys.path.insert(0,str(PACKAGE))
    import common
    import importlib.util
    spec=importlib.util.spec_from_file_location('enrollment_install',PACKAGE/'enrollment-install.py')
    install=importlib.util.module_from_spec(spec); spec.loader.exec_module(install)
    install.scope()
    assert digest(install.WORKER/'worker.cjs')==manifest['package_files']['worker.cjs'] and digest(install.WORKER/'launch.py')==manifest['package_files']['launch.py'], 'DEPLOYED_WORKER_DRIFT'
    for name,pin in manifest['runtime_files'].items(): assert digest(install.A/name)==pin, 'RUNTIME_DEPENDENCY_DRIFT'
    assert digest(install.A/'package.json')==manifest['runtime_package'] and digest(install.A/'package-lock.json')==manifest['runtime_lock'], 'RUNTIME_METADATA_DRIFT'
    canonical=json.loads(install.CANONICAL.read_text())
    assert canonical.get('future_enrollment_manifest_sha256')==PIN and canonical['build_id']==manifest['build_id'], 'CANONICAL_DEPLOYMENT_DRIFT'
    assert {k:v['sha256'] for k,v in canonical['files'].items() if k.startswith(('.next/','messages/'))}==manifest['application_files'], 'CANONICAL_ARTIFACT_MAP_DRIFT'
    install.verify_artifacts(install.A,manifest['application_files'])
    before=install.inventory(); original=json.loads((PACKAGE/'preflight.json').read_text())
    assert before['runtimeEndpoints']==original['runtimeEndpoints'] and before['inventory']['migrations']==manifest['after_migrations'], 'RUNTIME_OR_MIGRATION_DRIFT'
    baseline=before['inventory']
    # Strip only the new default columns when comparing with the accepted prior inventory.
    normalized=json.loads(json.dumps(baseline))
    for row in normalized['campaigns']:
        assert row.pop('enrollmentOrganizationId') is None and row.pop('periodKey') is None and row.pop('automaticRecipients') is False, 'ALREADY_LINKED_OR_MANAGED_CAMPAIGN'
    expected_snapshot=install.business_snapshot(original['inventory'])
    observed_snapshot=install.business_snapshot(normalized)
    for snapshot in [expected_snapshot,observed_snapshot]:
        for row in snapshot['campaigns']:
            row.pop('leaseToken',None); row.pop('leaseUntil',None)
    if observed_snapshot!=expected_snapshot: raise ScopeDrift(expected_snapshot,observed_snapshot)
    install.disabled_state()
    marker=STATE/'enrollment-enable-attempt.json'
    assert not marker.exists(), 'DO_NOT_REPEAT_ENABLE_ATTEMPT'
    def read(query): return json.loads(common.sql("BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; "+query+'; ROLLBACK;'))
    def unit():
        result=common.run(['systemctl','show',install.SERVICE,'--property=ActiveState,Result,ExecMainStatus,InvocationID,ExecMainStartTimestampMonotonic,ExecMainExitTimestampMonotonic'])
        return dict(line.split('=',1) for line in result.splitlines() if '=' in line)
    def enrollment():
        return read('''SELECT json_build_object('policy',(SELECT row_to_json(p) FROM "ReminderEnrollmentPolicy" p WHERE id=1),
          'enrollments',(SELECT COALESCE(json_agg(e ORDER BY e."organizationId"),'[]') FROM "OrganizationReminderEnrollment" e),
          'audits',(SELECT COALESCE(json_agg(json_build_object('id',id,'action',action,'createdAt',"createdAt") ORDER BY action),'[]') FROM "AuditLog"
            WHERE metadata->>'approvalReference'='USER_APPROVED_FUTURE_REMINDER_ENROLLMENT_20261008'
            AND action IN ('REMINDER_ENROLLMENT_POLICY_ENABLED','REMINDER_ORGANIZATION_ENROLLED','REMINDER_LEGACY_CAMPAIGN_LINKED')))''')
    projection=json.loads(SQL_PATH.with_name('enable-projection.json').read_text())
    excluded=[row['id'] for row in projection['existingExcludedOrganizations']]
    initial_process=before['processes']
    def check_after():
        current=install.inventory()
        assert current['processes']==initial_process, 'APP_PROCESS_CHANGED_DURING_ACCEPTANCE'
        validate_scope(current['inventory'],baseline)
        managed=[c for c in current['inventory']['campaigns'] if c['enrollmentOrganizationId'] is not None]
        assert len(managed)==1 and managed[0]['id']==CAMPAIGN and managed[0]['enrollmentOrganizationId']==ORG and managed[0]['periodKey']=='trial:2026-10-05T15:27:58.877Z' and managed[0]['automaticRecipients'] is False, 'LINKED_CAMPAIGN_DRIFT'
        state=enrollment(); policy=state['policy']; rows=state['enrollments']
        assert policy['enabled'] and policy['enabledAt'] and policy['approvalReference']==APPROVAL and policy['excludedOrganizationIds']==excluded, 'POLICY_BOUNDARY_OR_EXCLUSION_DRIFT'
        assert len(rows)==1 and rows[0]['organizationId']==ORG and rows[0]['activationId'] is None and rows[0]['origin']=='EXISTING_APPROVED' and rows[0]['enabled'] and rows[0]['excludedAt'] is None and rows[0]['approvalReference']==APPROVAL and rows[0]['enrolledAt']==policy['enabledAt'] and rows[0]['lastError'] is None, 'ENROLLMENT_DRIFT_OR_BLOCKED'
        assert sorted(a['action'] for a in state['audits'])==sorted(['REMINDER_ENROLLMENT_POLICY_ENABLED','REMINDER_ORGANIZATION_ENROLLED','REMINDER_LEGACY_CAMPAIGN_LINKED']), 'ENABLE_AUDIT_DRIFT'
        return state
    phase='TIMER_DRAIN'; attempted=False
    try:
        assert common.run(['systemctl','show',install.TIMER,'--property=UnitFileState','--value'])=='enabled' and common.run(['systemctl','show',install.TIMER,'--property=ActiveState','--value'])=='active', 'TIMER_STATE_DRIFT'
        install.drain()
        drained=install.inventory(); validate_scope(drained['inventory'],baseline)
        prior_start=int(unit()['ExecMainStartTimestampMonotonic'])
        marker.write_text(json.dumps({'approvalReference':APPROVAL,'scriptSha256':sys.argv[1],'sqlSha256':sys.argv[2],'deploymentManifest':PIN})); marker.chmod(0o600)
        attempted=True; phase='ENABLE_TRANSACTION'
        # One call only; transaction commit uncertainty is inspected, never retried.
        common.sql(SQL_PATH.read_text())
        state=check_after(); boundary=state['policy']['enabledAt']
        print(json.dumps({'enable':'PASS','enabledAtUtc':boundary+'Z','enrollments':1,'linkedCampaigns':1,'new384TrialCampaigns':0,'dueMessages':0,'audits':state['audits']}),flush=True)
        phase='ORDINARY_TIMER_CYCLES'
        common.run(['systemctl','start',install.TIMER])
        deadline=time.monotonic()+720; seen=[]; cycles=[]; next_check=0; next_progress=0
        while len(cycles)<2:
            assert time.monotonic()<deadline, 'TWO_ORDINARY_CYCLES_TIMEOUT'
            if time.monotonic()>=next_progress:
                print(json.dumps({'acceptance':'WAITING_FOR_ORDINARY_TIMER','completedCycles':len(cycles)}),flush=True)
                next_progress=time.monotonic()+60
            observed=unit()
            assert observed.get('ActiveState')!='failed' and observed.get('Result') not in ('exit-code','timeout','signal','core-dump','watchdog'), 'REGULAR_WORKER_FAILED'
            if time.monotonic()>=next_check:
                state=check_after(); assert state['policy']['enabledAt']==boundary, 'ORIGINAL_BOUNDARY_CHANGED'
                next_check=time.monotonic()+15
            if cycle_complete(observed,prior_start,seen):
                invocation=observed['InvocationID']
                journal=common.run(['journalctl','--no-pager','-o','cat','_SYSTEMD_INVOCATION_ID='+invocation],timeout=15)
                outcomes=[]
                for line in journal.splitlines():
                    try: value=json.loads(line)
                    except ValueError: continue
                    if isinstance(value,dict) and 'worker' in value: outcomes.append(value)
                assert len(outcomes)==1 and outcomes[0].get('worker')=='COMPLETED' and outcomes[0].get('campaignId')==CAMPAIGN, 'ORDINARY_WORKER_RESULT_NOT_PROVEN'
                state=check_after()
                assert state['enrollments'][0]['lastCheckedAt'] is not None, 'RECONCILIATION_NOT_PROVEN'
                seen.append(invocation)
                cycle={'cycle':len(cycles)+1,'invocationId':invocation,'startMonotonic':observed['ExecMainStartTimestampMonotonic'],'exitMonotonic':observed['ExecMainExitTimestampMonotonic'],'worker':'COMPLETED','outboxDelta':0,'smtpAttemptDelta':0,'milankDispatches':0,'lastCheckedAt':state['enrollments'][0]['lastCheckedAt']}
                cycles.append(cycle); print(json.dumps(cycle),flush=True)
            time.sleep(2)
        state=check_after()
        report={'acceptance':'PASS','enabledAtUtc':boundary+'Z','approvalReference':APPROVAL,'enrollments':1,'origin':'EXISTING_APPROVED','linkedCampaign':CAMPAIGN,'totalCampaigns':3,'new384TrialCampaigns':0,'excludedOrganizations':excluded,'recipients':['milanko.zivic@optinet.hr'],'operatorRecipients':[],'cycles':cycles,'audits':state['audits'],'policyEnabled':True,'timerEnabled':common.run(['systemctl','show',install.TIMER,'--property=UnitFileState','--value'])=='enabled','timerActive':common.run(['systemctl','show',install.TIMER,'--property=ActiveState','--value'])=='active','outboxDelta':0,'smtpAttemptDelta':0,'milankLimit':12,'milankDispatches':0,'inboxReceipt':'NOT_CLAIMED','futureControlledActivationLiveProof':'NOT_EXECUTED_LOCAL_POSTGRESQL_PROOF_ONLY'}
        assert report['timerEnabled'] and report['timerActive'], 'TIMER_NOT_LEFT_ENABLED'
        (STATE/'enrollment-enable-acceptance.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2),flush=True)
    except Exception as error:
        # Stop future cycles without killing an in-flight transport or replaying unknown delivery.
        timer_stop='STOPPED'
        try: common.run(['systemctl','stop',install.TIMER])
        except Exception: timer_stop='NOT_PROVEN_OPERATOR_RECONCILIATION_REQUIRED'
        suspension='NOT_NEEDED_BEFORE_ENABLE'
        if attempted:
            try:
                common.sql('''BEGIN; SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='10s';
                  WITH changed AS (UPDATE "ReminderEnrollmentPolicy" SET enabled=false WHERE id=1 AND enabled RETURNING "enabledAt")
                  INSERT INTO "AuditLog" (id,"organizationId",action,"entityType","entityId",metadata,"correlationId","createdAt")
                  SELECT gen_random_uuid(),'ee116a32-05e8-401f-a90f-b54b31b3b7e9'::uuid,'REMINDER_ENROLLMENT_ACCEPTANCE_SUSPENDED','REMINDER_ENROLLMENT_POLICY','1',
                    jsonb_build_object('reason','ACCEPTANCE_SCOPE_OR_WORKER_STOP','originalEnabledAt',"enabledAt"),gen_random_uuid()::text,CURRENT_TIMESTAMP FROM changed; COMMIT;''')
                suspension='POLICY_DISABLED_OR_ALREADY_DISABLED_ORIGINAL_BOUNDARY_RETAINED'
            except Exception: suspension='NOT_PROVEN_OPERATOR_RECONCILIATION_REQUIRED'
        report={'acceptance':'STOP','phase':phase,'reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'enableAttempted':attempted,'timer':timer_stop,'suspension':suspension,'retry':'NO_BLIND_ENABLE_OR_DELIVERY_RETRY','inFlightTransport':'NOT_KILLED','emailsSent':'NOT_ASSUMED_ZERO_ON_FAILURE'}
        report['differences']=getattr(error,'differences',[])
        (STATE/'enrollment-enable-stop.json').write_text(json.dumps(report,indent=2)); print(json.dumps(report,indent=2),flush=True); raise SystemExit(1)

if __name__=='__main__':
    os.umask(0o077)
    try: main()
    except Exception as error:
        print(json.dumps({'acceptance':'STOP','reason':str(error) if isinstance(error,AssertionError) else type(error).__name__,'enable':'NOT_RETRIED','stage':'PRE_ENABLE_GUARD','differences':getattr(error,'differences',[])}),flush=True); sys.exit(1)
