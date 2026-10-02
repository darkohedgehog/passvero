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

REVIEWED_CONSTRAINTS = {
    ('AccessRequest','AccessRequest_values'):('81301f24f95fb27e37feeb9cd6d7e0e147a267520f05c892e0e160f8125f6088','9ff77e28b8664ccfde1ace0319a1a81dd39f74fd44263b602d263d30401fc804'),
    ('CatalogImportBatch','CatalogImportBatch_bounds'):('e113b45fd925046c451975696169b37e876584fa4936344fb8bdad9e1cb6a221','f6dcc955092bd4f32769dd1d2d3d5b9f54a00a3e0433a4143789c778cdef4491'),
    ('CatalogImportRow','CatalogImportRow_state'):('b42b1fd3ab1f7baf2f62fd4467855c436c8d3da48ff6d4b79d4e859a9843ca0e','90610191e7fbb3ce5a706c72e349bb6811d9af9f2908cde568425fee6af219af'),
    ('ReminderAttempt','reminder_attempt_state'):('2a9cb2a90f812ebc10703440c72d947bde5046278a1294c22e30accd74137edd','e45d54d56558d9c09c71777c70fb9d959a62599902b7e899dbecfac85318bd63'),
    ('ReminderCampaign','reminder_campaign_budget'):('91ddd21f16057e49cc79af46397097dc9505477f96682a8a34bb2e24f9b257f4','2eded7720504308a08c823cff5976e4786de2b4211b777613001336b2583ca44'),
    ('ScanEvent','ck_scan_event_referrer_host_format'):('7add4f175867c9e5d769f45d899dab24b65f7d1003ad88fb72fd91cacde2d7b4','4a220d17be617db99961376ab390b8c902bf3d383954c574011b50bbaed814d6')}

def signature(value):return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()

def verify_catalog(source,current,restore):
    # No generic whitespace/parenthesis/cast normalization. Only six fully reviewed exact pairs.
    import copy
    left=copy.deepcopy(source);right=copy.deepcopy(current)
    left.pop('database');right.pop('database')
    exceptions={'constraints':[],'relations':[]}
    require(len(left['constraints'])==len(right['constraints']),'CONSTRAINT_INVENTORY')
    for a,b in zip(left['constraints'],right['constraints']):
        if a==b:continue
        key=(a['table'],a['name'])
        require(key==(b['table'],b['name']) and key in REVIEWED_CONSTRAINTS
                and {k:v for k,v in a.items() if k!='definition'}=={k:v for k,v in b.items() if k!='definition'}
                and (signature(a['definition']),signature(b['definition']))==REVIEWED_CONSTRAINTS[key],
                'UNREVIEWED_CONSTRAINT_DIFFERENCE')
        exceptions['constraints'].append({'table':key[0],'name':key[1],'sourceSha256':signature(a['definition']),
                                         'restoredSha256':signature(b['definition'])})
        b['definition']=a['definition']
    require(len(left['relations'])==len(right['relations']),'RELATION_INVENTORY')
    for a,b in zip(left['relations'],right['relations']):
        if a==b:continue
        owner='passvero_migrator'
        require({k:v for k,v in a.items() if k!='acl'}=={k:v for k,v in b.items() if k!='acl'}
                and a['owner']==owner and a['kind']=='r' and b['acl'] is None
                and a['acl']=='{passvero_migrator=arwdDxt/passvero_migrator}', 'UNREVIEWED_RELATION_ACL_DIFFERENCE')
        ident=restore.literal(a['name'])
        projection="json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable)"
        aggregate="coalesce(json_agg("+projection+" ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json)"
        acl=restore.sql("SELECT json_build_object('source',(SELECT "+aggregate+" FROM aclexplode("+
            restore.literal(a['acl'])+"::aclitem[])), 'restored',(SELECT "+aggregate+
            " FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) p WHERE n.nspname='public' AND c.relname="+ident+"))")
        require(acl['source']==acl['restored'] and len(acl['source'])==7,'RESTORED_EFFECTIVE_TABLE_ACL')
        exceptions['relations'].append({'name':a['name'],'owner':owner,'sourceAcl':a['acl'],
                                      'restoredAcl':None,'effectiveAcl':acl['restored']})
        b['acl']=a['acl']
    require(left==right,'RESTORED_CATALOG_UNREVIEWED_DIFFERENCE')
    require(len(exceptions['constraints'])==6 and len(exceptions['relations'])==6,'EXPECTED_REVIEWED_DIFFERENCE_COUNT')
    return exceptions

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
    result={'databaseFinalClosure':'PASS','restoreCluster':'STOPPED','parentPermissions':'PRIVATE_0700_RESTORED',
            'staging':'ONLINE_UNPAUSED','reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
            'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    cap.write(CONTROL/'database-final-closure.json',result)
    print(json.dumps(result),flush=True)

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    restore=helper();cap=restore.cap_module();cap.validate_context(SET)
    prepare,_=cap.helpers();prepare.runtime();cap.gates(prepare)
    source=restore.verify_download(cap)
    closure=cap.read(CONTROL/'catalog-diagnostic-closure.json')
    require(closure['catalogDiagnosticClosure']=='PASS' and closure['restoreCluster']=='STOPPED','DIAGNOSTIC_CLOSURE')
    prior=ROOT/'operator'/'diagnose-catalog-07dce4ea1391b55a600931b91aca0a15a7e5046d7740b310b4fd65afe5f0fa24.py'
    cap.private(prior)
    require(hashlib.sha256(prior.read_bytes()).hexdigest()=='07dce4ea1391b55a600931b91aca0a15a7e5046d7740b310b4fd65afe5f0fa24','ACCEPTED_DIAGNOSTIC_HELPER_CHANGED')
    evidence=cap.read(CONTROL/'catalog-diagnostic-differences.json')['result']
    require(evidence['diagnostic']=='READ_ONLY_RESTORED_CATALOG_COMPLETE' and evidence['differenceCount']==12
            and evidence['restoreRepeated'] is False,'ACCEPTED_DIAGNOSTIC_EVIDENCE')
    require(not (CONTROL/'database-restore-summary.json').exists(),'DATABASE_ALREADY_ACCEPTED')
    require(not (CONTROL/'database-final-attempt.json').exists(),'DATABASE_FINAL_ALREADY_ATTEMPTED')
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
    cap.write(CONTROL/'database-final-attempt.json',{'setId':SET,'purpose':'VERIFY_EXISTING_RESTORED_DATABASE',
              'restoreRepeated':False,'automaticRetry':False})
    for path in parents:
        os.setxattr(path,restore.ACL_NAME,restore.traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(restore.get_acl(path)==restore.traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    PHASE='READ_ONLY_PRIVATE_CLUSTER_START'
    account=prepare.account('postgres')
    restore.run([restore.PG+'pg_ctl','-D',str(restore.DATA),'-l',str(restore.DATA/'database-final.log'),
        '-w','-t','30','start','-o',"-c listen_addresses='' -c port=55434 -c unix_socket_directories="+
        str(restore.SOCKET)+' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'
        +' -c default_transaction_read_only=on'],account=account)
    settings=restore.sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'),'readonly',current_setting('default_transaction_read_only'))")
    require(settings=={'data':str(restore.DATA),'tcp':'','port':'55434','readonly':'on'},'ISOLATED_READ_ONLY_IDENTITY')
    PHASE='COMPARE_CATALOG_WITHOUT_SCHEMA_OR_DATA_WRITES'
    meta=cap.read(source/'database/manifest.json')
    current=restore.sql(cap.CATALOG)
    equivalences=verify_catalog(meta['catalog'],current,restore)
    tables=restore.sql(cap.TABLES)
    counts={name:restore.sql('SELECT count(*) FROM '+cap.identifier(name)) for name in tables}
    require(counts==meta['counts'],'RESTORED_COUNTERS_MISMATCH')
    require(restore.sql(cap.SEQUENCES)==meta['sequences'],'RESTORED_SEQUENCES_MISMATCH')
    _,references=cap.helpers()
    assets=restore.sql(references.QUERY)
    storage=cap.read(source/'storage/manifest.json')
    order=lambda rows:sorted(rows,key=lambda row:(row['bucket'],row['key']))
    require(assets['enabledCampaigns']==0 and order(assets['references'])==order(storage['references']),
            'RESTORED_ASSET_REFERENCES')
    require(references.reconcile(storage['objects'],assets['references'])==storage['reconciliation'],
            'RESTORED_ASSET_RECONCILIATION')
    require(all(current['database'][key]==meta['catalog']['database'][key] for key in ('owner','encoding','collate','ctype')),
            'RESTORED_DATABASE_SETTINGS')
    require(restore.database_acl(current['database']['acl'])==restore.database_acl(meta['catalog']['database']['acl']),
            'RESTORED_DATABASE_ACL')
    require(len(tables)==51 and len(current['migrations'])==31,'ACCEPTED_SCHEMA_SCOPE')
    cap.write(CONTROL/'database-final-catalog.json',current)
    cap.write(CONTROL/'database-final-equivalences.json',equivalences)
    prepare.runtime();cap.gates(prepare)
    result={'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP_VERIFIED','setId':SET,'snapshotId':restore.SNAPSHOT,
        'database':restore.DB,'tables':len(tables),'migrations':len(current['migrations']),
        'catalogOwnersAndAcls':'MATCH_SEMANTIC_WITH_EXACT_REVIEWED_EQUIVALENCES',
        'reviewedConstraintRepresentations':len(equivalences['constraints']),
        'ownerDefaultAclEquivalences':len(equivalences['relations']),
        'databaseAcl':'MATCH','allTableCounters':'MATCH','sequences':'MATCH',
        'databaseAssetReferences':len(assets['references']),'storageObjects':len(storage['objects']),
        'acceptedCleanupTombstones':len(storage['reconciliation']['acceptedCleanupTombstones']),
        'tcpListener':False,'restoreRepeated':False,'schemaWrites':'NONE','businessWrites':'NONE',
        'isolatedApplicationRead':'NOT_YET_RUN','storageProviderRestore':'NOT_PERFORMED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'automaticRetry':False}
    cap.write(CONTROL/'database-restore-summary.json',result)
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
        print(json.dumps({'databaseFinalVerification':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
            'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}),flush=True)
        sys.exit(1)
