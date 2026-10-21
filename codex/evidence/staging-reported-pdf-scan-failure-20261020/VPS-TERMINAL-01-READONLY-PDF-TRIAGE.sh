# VPS TERMINAL / PENDING_OPERATOR_COMMAND — one read-only diagnostic; no retry.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_PDF_TRIAGE'
import datetime,hashlib,json,os,pathlib,pwd,stat,subprocess,time
P=pathlib.Path
result={'diagnostic':'STAGING_REPORTED_PDF_SCAN_FAILURE_TRIAGE',
        'productId':'10813121-1ffa-4c94-91d4-82b2a9ee6757','userReportedDate':'2026-10-20',
        'manualEditorAccess':'USER_REPORTED_NOT_SERVER_SESSION_PROOF',
        'automaticRetry':False,'mutations':'NONE','newScanCalls':0,'storageReads':0,
        'authCalls':0,'messagesSent':0,'serviceChanges':False}
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def command(args,timeout,**options):
    require(time.monotonic()<deadline,'DIAGNOSTIC_BUDGET_EXPIRED')
    completed=subprocess.run(args,capture_output=True,text=True,cwd='/',
        env={'PATH':'/usr/sbin:/usr/bin:/sbin:/bin','LANG':'C'},
        timeout=min(timeout,max(0.1,deadline-time.monotonic())),**options)
    require(len(completed.stdout.encode())<=65536,'OUTPUT_CAP_EXCEEDED')
    return completed
try:
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_OPERATOR_HOST')
    deadline=time.monotonic()+40
    result['observedUTC']=utc()
    postgres=pwd.getpwnam('postgres')
    query='''BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='2s'; SET LOCAL TIME ZONE 'UTC';
WITH target AS (
 SELECT p.id,p."organizationId",p."currentDraftVersionId",p."currentPublishedVersionId",o."displayName" AS orgname
 FROM "Product" p JOIN "Organization" o ON o.id=p."organizationId"
 WHERE p.id='10813121-1ffa-4c94-91d4-82b2a9ee6757'::uuid
), candidates AS (
 SELECT pd.id AS association_id,pv.id AS version_id,pv.status AS version_status,pv."organizationId" AS version_org,
        pd.category,pd.locale,pd."isPublic",d.*,
        (pd."displayLabel"='Izjava o sukladnosti' OR d."displayName"='Izjava o sukladnosti') IS TRUE AS label_match,
        (pv.id=t."currentDraftVersionId") IS TRUE AS current_draft,
        (pv.id=t."currentPublishedVersionId") IS TRUE AS current_published,
        t."organizationId" AS product_org
 FROM target t JOIN "ProductVersion" pv ON pv."productId"=t.id
 JOIN "ProductDocument" pd ON pd."productVersionId"=pv.id JOIN "Document" d ON d.id=pd."documentId"
 WHERE pd.category='DECLARATION' OR pd."displayLabel"='Izjava o sukladnosti' OR d."displayName"='Izjava o sukladnosti'
 ORDER BY (pv.id=t."currentDraftVersionId") DESC NULLS LAST,
          (pv.id=t."currentPublishedVersionId") DESC NULLS LAST,d."updatedAt" DESC,pd.id LIMIT 9
)
SELECT json_build_object(
 'database',current_database(),'dbObservedAt',clock_timestamp(),
 'product',(SELECT json_build_object('id',id,'organizationId',"organizationId",'organizationDisplayName',orgname,
   'currentDraftVersionId',"currentDraftVersionId",'currentPublishedVersionId',"currentPublishedVersionId") FROM target),
 'candidateAssociations',coalesce((SELECT json_agg(json_build_object(
   'associationId',c.association_id,'versionId',c.version_id,'versionStatus',c.version_status,
   'currentDraft',c.current_draft,'currentPublished',c.current_published,
   'organizationConsistent',c."organizationId"=c.product_org AND c.version_org=c.product_org,
   'documentId',c.id,'category',c.category,'locale',c.locale,'isPublic',c."isPublic",'labelMatchesReport',c.label_match,
   'documentStatus',c.status,'uploadedAt',c."uploadedAt",'updatedAt',c."updatedAt",'failedAt',c."failedAt",
   'uploadFailureCode',c."failureCode",'sizeBytes',c."sizeBytes",'checksumSha256',c."checksumSha256",
   'scan',json_build_object('status',c."malwareScanStatus",'attemptId',c."malwareScanAttemptId",
     'startedAt',c."malwareScanStartedAt",'scannedAt',c."malwareScannedAt",'sha256',c."malwareScanSha256",
     'policyVersion',c."malwarePolicyVersion",'failureCode',c."malwareFailureCode",
     'scanner',c."malwareScanner",'engineVersion',c."malwareEngineVersion",'signatureVersion',c."malwareSignatureVersion"),
   'recentTerminalAudit',coalesce((SELECT json_agg(a.safe ORDER BY a.at DESC,a.id DESC) FROM (
     SELECT al.id,al."occurredAt" AS at,json_build_object('id',al.id,'action',al.action,'occurredAt',al."occurredAt",
       'attemptId',al.metadata->>'attemptId','policyVersion',al.metadata->>'policyVersion',
       'failureCode',al.metadata->>'failureCode',
       'recordedTerminalPath',CASE WHEN al.summary='Document scan attempt lease expired.' THEN 'LEASE_EXPIRY_RECOVERY'
         WHEN al.summary='Document scan completed.' THEN 'SCAN_FINALIZE' ELSE 'NOT_RECORDED' END,
       'matchesCurrentAttempt',(al.metadata->>'attemptId'=c."malwareScanAttemptId"::text) IS TRUE) AS safe
     FROM "AuditLog" al WHERE al."organizationId"=c.product_org AND al."entityType"='DOCUMENT' AND al."entityId"=c.id::text
       AND al.action IN ('DOCUMENT_MALWARE_SCAN_ERROR','DOCUMENT_MALWARE_SCAN_CLEAN','DOCUMENT_MALWARE_SCAN_INFECTED')
     ORDER BY al."occurredAt" DESC,al.id DESC LIMIT 6
   ) a),'[]'::json)
 )) FROM candidates c),'[]'::json));
ROLLBACK;'''
    read=command(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p','5433','-d','passvero_acceptance',
        '-v','ON_ERROR_STOP=1','-c',query],10,user=postgres.pw_uid,group=postgres.pw_gid,extra_groups=[])
    require(read.returncode==0,'SCOPED_READONLY_SQL_FAILED_NO_RAW_STDERR')
    evidence=json.loads(read.stdout)
    require(evidence.get('database')=='passvero_acceptance','WRONG_DATABASE')
    product=evidence.get('product')
    require(product is not None,'REPORTED_PRODUCT_NOT_FOUND')
    require(product.get('organizationDisplayName')=='SYNTHETIC — Subscription commercial acceptance','REPORTED_ORGANIZATION_NAME_MISMATCH')
    candidates=evidence['candidateAssociations']
    require(len(candidates)<=8,'TOO_MANY_CANDIDATES_NO_AUTOMATIC_SELECTION')
    require(all(c['organizationConsistent']for c in candidates),'CROSS_ORGANIZATION_LINK_STOP')
    result['savedAttemptEvidence']={'classification':'SAVED_DB_STATE_AND_TERMINAL_AUDIT_NOT_CURRENT_HEALTH',**evidence}
    result['candidateSelection']='NO_MATCH_RECORDED'if not candidates else 'REVIEW_VERSION_DOCUMENT_AND_ATTEMPT_IDS_NO_IMPLICIT_SELECTION'
    # Property reads only: do not connect to qpdf/clamd sockets or start any unit.
    units=['clamav-daemon.service','clamav-daemon.socket','clamav-freshclam.service',
           'passvero-qpdf-broker.socket','passvero-qpdf-acceptance.service',
           'passvero-signature-health.timer','passvero-signature-health.service']
    health={'classification':'CURRENT_OBSERVATION_ONLY_NOT_HISTORICAL_CAUSE','observedUTC':utc()}
    try:
        states=command(['/usr/bin/systemctl','show',*units,'--property=Id,LoadState,ActiveState,SubState,Result,ExecMainStatus,ActiveEnterTimestamp,InactiveEnterTimestamp'],8)
        safe=[]
        for section in states.stdout.strip().split('\n\n'):
            row=dict(line.split('=',1)for line in section.splitlines()if '='in line)
            if row.get('Id')in units:safe.append(row)
        health['units']={'returnCode':states.returncode,'properties':safe}
    except Exception as error:health['units']={'result':'UNAVAILABLE','exceptionClass':type(error).__name__}
    # Same pinned read-only reader used by the existing scanner package; no producer/recovery imported.
    try:
        path=P('/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs')
        for parent in path.parents:
            info=parent.lstat()
            require(stat.S_ISDIR(info.st_mode)and info.st_uid==0 and not info.st_mode&0o022,'READER_PARENT_POSTURE')
        info=path.lstat()
        require(stat.S_ISREG(info.st_mode)and info.st_uid==0 and info.st_nlink==1 and not info.st_mode&0o022 and info.st_size<=2097152,'READER_FILE_POSTURE')
        require(hashlib.sha256(path.read_bytes()).hexdigest()=='877c9bed25e195479d28dcad7e5ff506798a09b6b2edfe93c92691e228f97e62','READER_EXACT_PIN_CHANGED')
        account=pwd.getpwnam('passvero-staging');require(account.pw_uid==1001,'STAGING_UID_CHANGED')
        probe=command(['/usr/bin/node',str(path)],10,user=account.pw_uid,group=account.pw_gid,
            extra_groups=os.getgrouplist(account.pw_name,account.pw_gid))
        value=json.loads(probe.stdout);require(isinstance(value,dict)and type(value.get('accepted'))is bool,'READER_RESPONSE_INVALID')
        health['reader']={'returnCode':probe.returncode,**{k:value[k]for k in('accepted','sequence','observedAt','expiresAt')if k in value}}
    except Exception as error:
        message=str(error)
        health['reader']={'result':'UNAVAILABLE','reason':message if message in('READER_PARENT_POSTURE','READER_FILE_POSTURE','READER_EXACT_PIN_CHANGED','STAGING_UID_CHANGED','READER_RESPONSE_INVALID','DIAGNOSTIC_BUDGET_EXPIRED')else type(error).__name__}
    result['currentHealth']=health
    result['historicalLimitations']=['Document stores current/latest attempt only; recent audit is capped at six terminal events per document.',
      'ERROR normally has scannedAt/provenance null; terminal audit time is separate evidence.',
      'TIMEOUT alone does not identify PDF validator versus malware scanner; recordedTerminalPath may distinguish saved lease-expiry recovery.',
      'accepted=false does not identify missing/expired/private/invalid health evidence.',
      'No historical reader or qpdf/clamd state is inferred from current unit properties.']
    result['result']='READ_ONLY_DIAGNOSTIC_COMPLETE_RETURN_OUTPUT_AND_STOP'
except BaseException as error:
    message=str(error)
    allowed={'WRONG_OPERATOR_HOST','DIAGNOSTIC_BUDGET_EXPIRED','OUTPUT_CAP_EXCEEDED','SCOPED_READONLY_SQL_FAILED_NO_RAW_STDERR',
             'WRONG_DATABASE','REPORTED_PRODUCT_NOT_FOUND','REPORTED_ORGANIZATION_NAME_MISMATCH',
             'TOO_MANY_CANDIDATES_NO_AUTOMATIC_SELECTION','CROSS_ORGANIZATION_LINK_STOP'}
    result.update(result='STOP',reason=message if message in allowed else type(error).__name__)
print(json.dumps(result,indent=2,ensure_ascii=True))
PASSVERO_PDF_TRIAGE
