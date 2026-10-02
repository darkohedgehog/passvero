# Existing backup coverage and staging recovery — bounded continuation

## Final result — approved one-off staging recovery COMPLETE

Recorded2026-10-02 Europe/Zagreb from returned operator output. No operator command
remains pending for this approved series. Capture is an as-of snapshot2026-10-01T21:23:54Z,
not a promise about future writes. Exact operator execution UTC was not in the final
output; the final application unit ran2.424s/success/status0, invocation
ac45bf2cfa6c4026acd3daee314dbad1. Complete evidence chain is retained in
codex/evidence/backup-recovery/approved-recovery-completion.json and
codex/evidence/backup-recovery/operator-application-recovery-pass.json.

| Component | Final evidence |
| --- | --- |
| Existing topology | Production PG16/passvero:5432 and separate passvero_test retained; acceptance PG16/passvero_acceptance:5433. passvero_migrator is an owner/deployment role, not a separate database. Runtime/auth/backup/test roles remain separated. |
| Existing production protection | Existing B2/restic PostgreSQL job, daily02:00UTC schedule/hourly freshness/Telegram, protected credentials and prior accepted production restore retained unchanged. Last inspected successful production set20261001T020750Z; this is accepted inspection evidence, not a fresh Oct2 production-job execution claim. |
| Actual addition | One consistent acceptance DB+all actually stored private staging document/image bytes+minimal non-secret config recovery set in separate restic prefix passvero-staging-recovery-v1/ in the existing B2 bucket. No production repository validator/job changes. |
| Set and offsite | Set20261001T212354Z;payload964172B. Real B2 snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2 downloaded and all file hashes verified. Repository9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35;recovery manifest2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132. |
| Consistency | Capture pause3.034s;51 tables locked;outsideDBclients0;stagingWriters0;Storage inventory+bytes unchanged. Accepted independent timeout resume proof reused. Application resumed before B2 transfer/restore. |
| File scope | Whole passvero-staging-documents/passvero-staging-images:5 stored objects/6145B, including every actually retained historical/archive/original/derived object present at capture. Nine DB references=5 stored+4 accepted cleanup tombstones. Deleted tombstone bytes2959B do not exist and were not restored; filename metadata alone is not a retained original. No automatic deletion. |
| Database recovery | Actual downloaded dump restored to private PG16/passvero_staging_recovery under /var/lib/passvero-staging-recovery/restore/20261001T212354Z/pgdata. All51 counters/31 migrations/owners/effective ACLs/sequences/refs MATCH; exactly6 reviewed constraint representations and6 owner-default ACL equivalences. No TCP; existing DB/test/staging never overwritten. Final DB verification reused during app read; no rerestore. |
| Application read | Actual catalog export, bounded PDF metadata/bytes reader and private image download/recheck services PASS using private restored DB/read-only ports and actual B2-downloaded filesystem bytes. Representative PDF629B/image1168B/checksums MATCH;catalog unchanged. All826 executable deployment artifact hashes matched;11 module input provenance verified against accepted build base. Raw historical src checkout is not executable identity. |
| Configuration | Included allowlisted runtime/PG settings+HBA/scanner requirements/source-build-package-lock identity in four configuration JSON files, linked by recovery-set.json hashes. Raw env/password/key/B2/SMTP/Telegram secrets excluded from config and never printed/committed/rotated. Protected DB dump retains required identity/business records. Full executable binaries and raw whole-system configs are not copied in this set. |
| Final closure | PASS;stagingONLINE_UNPAUSED;restore clusterSTOPPED;private parents0700 restored;reminder timerDISABLED_INACTIVE;campaignsEnabled0;all history/artifacts retained;SMTP/Telegram0 throughout this recovery series. |
| Reminder evidence retained | Four independently confirmed receipts, zero replay additional dispatches, two stale cancellations. No reminder/email acceptance repeated. |

Remaining dependencies are explicit limits of the completed proof: Supabase provider
reupload NOT_PERFORMED; full web service/authenticated session/fresh scanner trust
NOT_TESTED. Private-file application reading is not a full live provider recovery.
Independent protected secret/global role bootstrap inputs and available reviewed
source/build or retained deployment artifact are needed for full application bootstrap;
build identity in the config set is not a binary backup. Existing escrow procedure is
retained; its availability is not re-proven by this read harness. Fresh scanner/ClamAV/
qpdf evidence must be established before live document delivery, without bypassing
security gates. No such activation or new integration was part of this approved series.

Automatic staging backup/RPO/freshness/Telegram schedule NOT_INTRODUCED. Existing
production scheduling/reporting remains unchanged, and the proved staging snapshot
covers the capture instant only. A future recurring staging policy is a separate concrete
decision; no implementation work or operator command is opened automatically.
Local source unchanged main/originmainf778721ed77d87ad8e7de1dd38e0e5a51b688b60;
source operational helpers/tests/docs remain uncommitted, indexEMPTY. Accepted tests
are reused; only final evidence/JSON/manifest/whitespace/secret checks are needed now.
No production, secret, scanner/producer config, email/Telegram, deletion, retention,
forget/prune, commit or push action. All earlier checkpoints below are historical;
PENDING labels and commands in them are retained evidence, not current instructions.

<!-- BEGIN APPLICATION_ARTIFACT_RECOVERY_VPS -->
### Historical VPS TERMINAL — application read accepted PASS; do not rerun

Run once; copy only the shell block. Expected applicationRecoveryArtifactHelper
REVIEWED_INSTALLED/existingBundleReused true/oldEvidenceRetained true. Then
isolatedApplicationRead PASS_APPLICATION_SERVICES_PRIVATE_DB_AND_FILESYSTEM,
deployedArtifactFilesMatched826,applicationModuleProvenance MATCH_ACCEPTED_BUILD_SOURCE_BASE,
product/PDF/image PASS,catalogUnchanged true,TCPfalse,restoreRepeated false,
schema/business writes NONE,SMTP/Telegram0. Finally applicationRecoveryClosure PASS,
clusterSTOPPED,private parents0700,stageONLINE_UNPAUSED,reminder timerOFF,campaigns0.
No staging pause or new approval needed. New artifact control names preserve old history.
Supabase restore NOT_PERFORMED,web/auth-session/fresh-scanner recovery NOT_TESTED.
On STOP return output and do not retry or deploy.

```sh
sudo /usr/bin/python3 -B - <<'PY_APPLICATION_ARTIFACT_RECOVERY'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
SOURCE=r'''"""Final isolated application reads from accepted DB and real B2-downloaded private bytes."""
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
import subprocess

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
SET='20261001T212354Z'
PIN='cfadf143ad7a2e79ba9635a01e7e167a34aa06669be7983396aba56973469624'
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
PROVENANCE_PIN='549271de0275b711bab687ce0a954887054debdfde4ccd55c0fcc20b2991f58d'
DEPLOY_PIN='1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf'
DEPLOY_MANIFEST=pathlib.Path('/var/lib/passvero-subscription-reminders-package-v2/manifest.json')
CANONICAL_MANIFEST=pathlib.Path('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
ARTIFACT_FILES=826
APP=pathlib.Path('/var/www/passvero-acceptance')
TARGET=ROOT/'restore'/SET
CONTROL=ROOT/'control'/SET
PHASE='APPLICATION_RECOVERY_PREFLIGHT'

def require(value,reason):
    if not value:raise RuntimeError(reason)

def helper():
    path=ROOT/'operator'/('verify-database-'+PIN+'.py')
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077
            and hashlib.sha256(path.read_bytes()).hexdigest()==PIN,'RESTORE_HELPER_IDENTITY')
    spec=importlib.util.spec_from_file_location('accepted_restore',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.helper()

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
    result={'applicationRecoveryClosure':'PASS','restoreCluster':'STOPPED','parentPermissions':'PRIVATE_0700_RESTORED',
            'staging':'ONLINE_UNPAUSED','reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
            'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    cap.write(CONTROL/'application-recovery-artifact-closure.json',result)
    print(json.dumps(result),flush=True)

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    restore=helper();cap=restore.cap_module();cap.validate_context(SET)
    prepare,_=cap.helpers();prepare.runtime();cap.gates(prepare)
    source=restore.verify_download(cap)
    closure=cap.read(CONTROL/'database-final-closure.json')
    require(closure['databaseFinalClosure']=='PASS' and closure['restoreCluster']=='STOPPED','FINAL_DATABASE_CLOSURE')
    accepted=cap.read(CONTROL/'database-restore-summary.json')
    require(accepted['databaseRestore']=='PASS_REAL_B2_DOWNLOADED_DUMP_VERIFIED'
            and accepted['snapshotId']==restore.SNAPSHOT and accepted['setId']==SET,'FINAL_DATABASE_PROOF')
    require(not (CONTROL/'application-recovery-artifact-attempt.json').exists(),'APPLICATION_RECOVERY_ALREADY_ATTEMPTED')
    build_path=ROOT/'operator'/'application-read-build.json'
    cap.private(build_path)
    require(hashlib.sha256(build_path.read_bytes()).hexdigest()==BUILD_PIN,'APPLICATION_BUILD_IDENTITY')
    build=cap.read(build_path)
    bundle=ROOT/'operator'/('application-read-'+build['bundleSha256']+'.cjs')
    cap.private(bundle)
    require(hashlib.sha256(bundle.read_bytes()).hexdigest()==build['bundleSha256'],'APPLICATION_BUNDLE_IDENTITY')
    source_config=cap.read(source/'configuration/source.json')
    require(hashlib.sha256((APP/'package.json').read_bytes()).hexdigest()==source_config['packageSha256']
            and hashlib.sha256((APP/'package-lock.json').read_bytes()).hexdigest()==source_config['lockSha256']
            and (APP/'.next/BUILD_ID').read_text().strip()==source_config['buildId'],'CAPTURED_APPLICATION_BUILD_CHANGED')
    # The reviewed deployment swaps .next/messages only; raw src/ is a historical checkout.
    # Validate the executable artifacts against the existing accepted deployment instead.
    provenance_path=ROOT/'operator'/('application-read-provenance-'+PROVENANCE_PIN+'.json')
    cap.private(provenance_path)
    require(hashlib.sha256(provenance_path.read_bytes()).hexdigest()==PROVENANCE_PIN,'APPLICATION_PROVENANCE_IDENTITY')
    provenance=cap.read(provenance_path)
    require(provenance['buildManifestSha256']==BUILD_PIN and provenance['deploymentManifestSha256']==DEPLOY_PIN
            and provenance['applicationModules']==build['applicationModules'],'APPLICATION_BUILD_PROVENANCE')
    cap.private(DEPLOY_MANIFEST)
    require(hashlib.sha256(DEPLOY_MANIFEST.read_bytes()).hexdigest()==DEPLOY_PIN,'ACCEPTED_DEPLOYMENT_MANIFEST_IDENTITY')
    deployed=cap.read(DEPLOY_MANIFEST);canonical=cap.read(CANONICAL_MANIFEST)
    require(deployed['build_id']==source_config['buildId']==provenance['deploymentBuildId']==canonical['build_id']
            and canonical['reminders_manifest_sha256']==DEPLOY_PIN
            and deployed['runtime_package']==source_config['packageSha256']
            and deployed['runtime_lock']==source_config['lockSha256'],'ACCEPTED_EXECUTABLE_BUILD_IDENTITY')
    require(len(deployed['application_files'])==ARTIFACT_FILES==provenance['deployedArtifactFiles'],'APPLICATION_ARTIFACT_COUNT')
    for name,digest in deployed['application_files'].items():
        require(name.startswith(('.next/','messages/')) and not pathlib.PurePosixPath(name).is_absolute()
                and '..' not in pathlib.PurePosixPath(name).parts and re.fullmatch('[0-9a-f]{64}',digest),'APPLICATION_ARTIFACT_PATH')
        path=APP/name
        require(path.resolve().is_relative_to(APP.resolve()),'APPLICATION_ARTIFACT_SCOPE')
        require(stat.S_ISREG(path.lstat().st_mode) and hashlib.sha256(path.read_bytes()).hexdigest()==digest
                and canonical['files'][name]['sha256']==digest,'APPLICATION_EXECUTABLE_ARTIFACT_CHANGED')
    for name,digest in deployed['runtime_files'].items():
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts
                and name.startswith(('node_modules/','.controlled-onboarding/')),'APPLICATION_RUNTIME_PATH')
        path=APP/name
        require(path.resolve().is_relative_to(APP.resolve()) and stat.S_ISREG(path.lstat().st_mode)
                and hashlib.sha256(path.read_bytes()).hexdigest()==digest,'APPLICATION_RUNTIME_DEPENDENCY_CHANGED')
    require(restore.run(['/usr/bin/node','--version']).decode().strip()==source_config['node'],'APPLICATION_NODE_CHANGED')
    node_env={'PATH':'/usr/bin:/bin','LANG':'C','NODE_PATH':str(APP/'node_modules')}
    probe=subprocess.run(['/usr/bin/node','-e',"const z=require('zod');if(typeof z.uuid!=='function')process.exit(1);process.stdout.write('PASS')"],
        capture_output=True,timeout=10,env=node_env)
    require(probe.returncode==0 and probe.stdout==b'PASS','EXISTING_APPLICATION_ZOD_UNAVAILABLE')
    storage=cap.read(source/'storage/manifest.json')
    cap.write(CONTROL/'application-recovery-artifact-config.json',{'source':str(source),'socket':str(restore.SOCKET),
              'database':restore.DB,'objects':storage['objects']})
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
    cap.write(CONTROL/'application-recovery-artifact-attempt.json',{'setId':SET,'purpose':'PRIVATE_APPLICATION_READ_ONLY',
              'restoreRepeated':False,'automaticRetry':False})
    for path in parents:
        os.setxattr(path,restore.ACL_NAME,restore.traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(restore.get_acl(path)==restore.traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    PHASE='READ_ONLY_PRIVATE_CLUSTER_START'
    account=prepare.account('postgres')
    restore.run([restore.PG+'pg_ctl','-D',str(restore.DATA),'-l',str(restore.DATA/'application-recovery.log'),
        '-w','-t','30','start','-o',"-c listen_addresses='' -c port=55434 -c unix_socket_directories="+
        str(restore.SOCKET)+' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'
        +' -c default_transaction_read_only=on'],account=account)
    settings=restore.sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'),'readonly',current_setting('default_transaction_read_only'))")
    require(settings=={'data':str(restore.DATA),'tcp':'','port':'55434','readonly':'on'},'ISOLATED_READ_ONLY_IDENTITY')
    PHASE='ISOLATED_APPLICATION_PRODUCT_PDF_IMAGE_READ'
    result=subprocess.run(['/usr/bin/node',str(bundle),str(CONTROL/'application-recovery-artifact-config.json')],
        capture_output=True,timeout=90,env=node_env)
    require(result.returncode==0 and len(result.stdout)<65536,'APPLICATION_READ_FAILED')
    application=json.loads(result.stdout)
    require(application['applicationRead']=='PASS_PRIVATE_RECOVERY_PORTS'
            and application['schemaWrites']=='NONE' and application['businessWrites']=='NONE'
            and application['smtpCalls']==0
            and application['product']=='PASS_APPLICATION_CATALOG_EXPORT'
            and application['pdf']=='PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA'
            and application['image']=='PASS_APPLICATION_DOWNLOAD_AND_RECHECK','APPLICATION_READ_RESULT')
    # Reuse accepted DB proof; compare unchanged catalogue rather than rerun acceptance checks.
    require(restore.sql(cap.CATALOG)==cap.read(CONTROL/'database-final-catalog.json'),'APPLICATION_READ_CHANGED_CATALOG')
    prepare.runtime();cap.gates(prepare)
    output={'isolatedApplicationRead':'PASS_APPLICATION_SERVICES_PRIVATE_DB_AND_FILESYSTEM',
        'setId':SET,'snapshotId':restore.SNAPSHOT,'application':application,
        'applicationModuleProvenance':'MATCH_ACCEPTED_BUILD_SOURCE_BASE',
        'applicationModulesInReviewedBundle':len(build['applicationModules']),
        'deployedArtifactFilesMatched':len(deployed['application_files']),'deploymentManifestSha256':DEPLOY_PIN,
        'rawCheckoutIsExecutionIdentity':False,'bundleSha256':build['bundleSha256'],
        'catalogUnchanged':True,'databaseProof':'REUSED_ACCEPTED_FINAL_DATABASE_VERIFICATION',
        'tcpListener':False,'restoreRepeated':False,'schemaWrites':'NONE','businessWrites':'NONE',
        'storageProviderRestore':'NOT_PERFORMED','freshScannerTrustRecovery':'NOT_TESTED',
        'authSessionRecovery':'NOT_TESTED','webServiceRecovery':'NOT_TESTED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'artifactsRetained':True}
    cap.write(CONTROL/'application-recovery-artifact-summary.json',output)
    print(json.dumps(output),flush=True)
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
        print(json.dumps({'applicationRecoveryRead':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
            'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}),flush=True)
        sys.exit(1)
'''
SOURCE_PIN='e168795c416c97deb477d22999bf01438bf2e502b76bc3acfb8073e350204abf'
PROVENANCE=r'''{
  "acceptedSourceBase": "1fc84aa8ccc3118f8158029e8edf99275c8f7f6e",
  "applicationModules": {
    "src/application/documents/bytes.ts": "b09a9d1ec2d10e9a330352bc15a99271dd3de894d9fdb1145cba639304ec9710",
    "src/application/documents/contracts.ts": "fdb5f4448424c2175089955da78a304ecc1b4240b164e675880ad790539f26d3",
    "src/application/documents/pdf.ts": "07697db8850f782bce3efe447f5430c2491ca06588097f482c7501f80b009fd8",
    "src/application/errors/application-error.ts": "89bfd62a6ab94681e85cb8b3d57f4b09b002a638430de77ec074497ed493ebc1",
    "src/application/permissions/product-permissions.ts": "e716f110722779dadb9ba5f96713a0cec30c2b3a243e39d19ca5b1790f240c19",
    "src/application/products/export-catalog/contracts.ts": "71b4ab48f017ec1135c1053680736e1d66e0b5ed5eee78ff9f05242a1b760d05",
    "src/application/products/export-catalog/csv.ts": "3419d540dc4eb8e2fa0104c619850a3295d87e43fd4345caa5678c818300f0c6",
    "src/application/products/export-catalog/export-catalog.ts": "da30f95fa7e5630819a633335099b9708b62daa552b3a10b23ed3202b0c2b708",
    "src/application/products/images/contracts.ts": "117ceff40a0e49923cb22b44f6d3e3aa3cd7422b693c893dc0ebc580eebed4c1",
    "src/application/products/images/service.ts": "7fb5fe12143737db88183b842e34d2caa9072d9c6300ee513e34cc831249c48c",
    "src/application/products/product-search.ts": "77548eaa3b650333675cbca5419b4aa282947bd648222c660333ffbffda7ef7d"
  },
  "buildManifestSha256": "b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85",
  "deployedArtifactFiles": 826,
  "deploymentBuildId": "8QNIYVVZWEsQaCL9uLZ5Q",
  "deploymentManifestSha256": "1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf",
  "localProof": "ALL_11_MODULE_INPUTS_MATCH_ACCEPTED_BUILD_BASE; ALL_826_BUILD_ARTIFACT_FILES_MATCH_ACCEPTED_PACKAGE",
  "schema": 1
}
'''
PROVENANCE_PIN='549271de0275b711bab687ce0a954887054debdfde4ccd55c0fcc20b2991f58d'
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    # Reuse the exact previously installed bundle/build and preserve the stopped helper/closure.
    existing={
        ROOT/'operator/application-read-build.json':'b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85',
        ROOT/'operator/application-read-35d4b1d74f7a8ac40efb1f1bc3264fb086fbbdb4f9c8ecf8d9e306544fc3aad9.cjs':'35d4b1d74f7a8ac40efb1f1bc3264fb086fbbdb4f9c8ecf8d9e306544fc3aad9',
        ROOT/'operator/verify-application-c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee.py':'c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee',
        ROOT/'control/20261001T212354Z/application-recovery-closure.json':'93385791f2e6366fb8c292bc57d0bf755dd35f5638af9bbeb51e3145b4d84f4e'}
    for p,pin in existing.items():
        s=p.lstat()
        if not stat.S_ISREG(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077 or hashlib.sha256(p.read_bytes()).hexdigest()!=pin:
            raise RuntimeError('EXISTING_APPLICATION_EVIDENCE_IDENTITY')
    claim=ROOT/'control/20261001T212354Z/application-recovery-attempt.json'
    if claim.exists() or claim.is_symlink():raise RuntimeError('ORIGINAL_APPLICATION_ATTEMPT_EXISTS')
    entries=[(ROOT/'operator'/('verify-application-'+SOURCE_PIN+'.py'),SOURCE,SOURCE_PIN),
        (ROOT/'operator'/('application-read-provenance-'+PROVENANCE_PIN+'.json'),PROVENANCE,PROVENANCE_PIN)]
    for path,source,pin in entries:
        if hashlib.sha256(source.encode()).hexdigest()!=pin:raise RuntimeError('REVIEWED_PAYLOAD_HASH')
        if path.exists() or path.is_symlink():raise RuntimeError('APPLICATION_HELPER_EXISTS_MANUAL_REVIEW')
    compile(SOURCE,'reviewed-application-helper','exec')
    json.loads(PROVENANCE)
    unit='passvero-stage-restore-20261001T212354Z-application-artifact.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.returncode!=0 or check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('APPLICATION_UNIT_EXISTS_MANUAL_REVIEW')
    for path,source,pin in entries:
        with open(path,'xb') as f:f.write(source.encode());f.flush();os.fsync(f.fileno())
    path=entries[0][0]
    print(json.dumps({'applicationRecoveryArtifactHelper':'REVIEWED_INSTALLED','sourceSha256':SOURCE_PIN,
        'provenanceSha256':PROVENANCE_PIN,'existingBundleReused':True,'oldEvidenceRetained':True,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=UMask=0077','--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'applicationRecoveryArtifactInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
        'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_APPLICATION_ARTIFACT_RECOVERY
```
<!-- END APPLICATION_ARTIFACT_RECOVERY_VPS -->

## Historical checkpoint — artifact-bound application read subsequently passed; do not rerun

Returned READ_ONLY_APPLICATION_MODULE_INVENTORY_V2 completed: raw Git checkout
3eec70abc80887eb4c098236c9b54ebc28d9fc58, six missing modules, two different document
modules, three identical modules. All five present sources match that checkout exactly;
LF/BOM conversion does not explain differences. Installed build/helper/closure evidence
is private0600/hash-matched, original application attempt absent. It does NOT prove
that running staging build is3eec70a: reviewed deploy intentionally replaces only.next
and messages, leaving rawsrc and Git checkout untouched. Earlier statement that staging
runs the old Git revision is superseded by this distinction. No app upgrade justified.

Actual root cause: verifier incorrectly used historical rawsrc as execution identity.
Reviewed installer scripts/subscription-reminders/install.py establishes accepted
reminders deployment build8QNIYVVZWEsQaCL9uLZ5Q/manifest1d7f456d13ce8cf1bb7173bc3c731be4fd7e61d6a5fbb70fb8aca99eba04f1cf.
Local evidence verifies all11 unchanged recovery bundle inputs against accepted original
build base1fc84aa8ccc3118f8158029e8edf99275c8f7f6e and all826 local build artefact bytes
against the accepted deployment package. No new application bundle or production code.

Corrected helper validates that same pinned existing deployment manifest, captured
package/lock/build identity, canonical manifest's reminder provenance, all826 live
.next/messages file hashes and existing runtime dependency hashes. Hash mismatches
still STOP; no general bypass/normalization. Readonly artifact hashing does not redeploy
or repeat email/Telegram acceptance. Raw checkout is explicitly not execution identity.
Reuse installed hash-pinned bundle/build. New private provenance file549271de0275b711bab687ce0a954887054debdfde4ccd55c0fcc20b2991f58d,
helper e168795c416c97deb477d22999bf01438bf2e502b76bc3acfb8073e350204abf,
unit application-artifact, and separate application-recovery-artifact attempt/config/
summary/closure names preserve original helper/closure/claims. Same already restored
PG16/socket-only/read-only cluster; no new database, rerestore, staging pause or transfer.
Same300s/25s/control-group/UMask0077/ExecStopPost/ACL cleanup boundaries. On STOP retain
reason and evidence; no automatic retry. Ten affected full operator-flow tests and four
complete installer fixtures PASS, including stale/missing raw checkout with matching
executable artefacts, changed executable/runtime/provenance/canonical manifest, existing
claim/unit and retained prior bytes. Exact2 payloads/Python/shell packaging PASS; unchanged
10 actual application-reader tests reused. Operator application proof remains pending.

Captured set20261001T212354Z/snapshot2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2:
B2 download/all-file hashes and final51-table/31-migration/ACL/count/sequence/ref DB
proof retained. Latest closure: clusterSTOPPED,parents0700,stageONLINE_UNPAUSED,
reminder timerOFF/campaigns0. Four confirmed receipts/replay0/two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
one-off recovery only, automatic staging backup schedule not introduced. Private app
service proof only; Supabase reupload NOT_PERFORMED and full web/auth/fresh scanner
recovery NOT_TESTED remain explicit dependencies. No deletion, commit or push.
PENDING_OPERATOR_COMMAND_APPLICATION_ARTIFACT_RECOVERY.

<!-- BEGIN APPLICATION_MODULE_INVENTORY_V2_VPS -->
### Historical VPS TERMINAL — inventory V2 accepted; do not rerun

Copy only the shell block. Expected READ_ONLY_APPLICATION_MODULE_INVENTORY_V2,
11 module rows and requiredEvidence build/helper/closure path metadata. Missing paths
are labeled MISSING; actual hash differences remain differences. applicationAttempt
is inventoried without creating it. writes NONE,clusterStarted false,acceptanceRepeated
false. No source/evidence contents or secrets printed; no acceptance retry.

```sh
sudo /usr/bin/python3 -B - <<'PY_APPLICATION_MODULE_INVENTORY_V2'
"""Read-only hashes for an application preflight STOP; no cluster or acceptance retry."""
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
APP=pathlib.Path('/var/www/passvero-acceptance')
SET='20261001T212354Z'
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
HELPER_PIN='c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee'
# Exact reviewed bundle input identities; diagnostics do not depend on installed metadata.
MODULES={'src/application/documents/bytes.ts': 'b09a9d1ec2d10e9a330352bc15a99271dd3de894d9fdb1145cba639304ec9710', 'src/application/documents/contracts.ts': 'fdb5f4448424c2175089955da78a304ecc1b4240b164e675880ad790539f26d3', 'src/application/documents/pdf.ts': '07697db8850f782bce3efe447f5430c2491ca06588097f482c7501f80b009fd8', 'src/application/errors/application-error.ts': '89bfd62a6ab94681e85cb8b3d57f4b09b002a638430de77ec074497ed493ebc1', 'src/application/permissions/product-permissions.ts': 'e716f110722779dadb9ba5f96713a0cec30c2b3a243e39d19ca5b1790f240c19', 'src/application/products/export-catalog/contracts.ts': '71b4ab48f017ec1135c1053680736e1d66e0b5ed5eee78ff9f05242a1b760d05', 'src/application/products/export-catalog/csv.ts': '3419d540dc4eb8e2fa0104c619850a3295d87e43fd4345caa5678c818300f0c6', 'src/application/products/export-catalog/export-catalog.ts': 'da30f95fa7e5630819a633335099b9708b62daa552b3a10b23ed3202b0c2b708', 'src/application/products/images/contracts.ts': '117ceff40a0e49923cb22b44f6d3e3aa3cd7422b693c893dc0ebc580eebed4c1', 'src/application/products/images/service.ts': '7fb5fe12143737db88183b842e34d2caa9072d9c6300ee513e34cc831249c48c', 'src/application/products/product-search.ts': '77548eaa3b650333675cbca5419b4aa282947bd648222c660333ffbffda7ef7d'}

def require(value,reason):
    if not value:raise RuntimeError(reason)

def inventory(path,expected=None,private=False):
    row={'path':str(path),'expectedSha256':expected}
    try:
        info=path.lstat()
        row.update(exists=True,uid=info.st_uid,mode=oct(stat.S_IMODE(info.st_mode)))
        if not stat.S_ISREG(info.st_mode):
            row['state']='SYMLINK' if stat.S_ISLNK(info.st_mode) else 'NOT_REGULAR'
            return row,None
        if info.st_size>131072:row['state']='OVERSIZE';return row,None
        if private and (info.st_uid!=0 or info.st_mode&0o077):
            row['state']='UNSAFE_PRIVATE_POSTURE';return row,None
        body=path.read_bytes()
        row.update(state='READABLE',bytes=len(body),actualSha256=digest(body))
        if expected is not None:row['matchesExpected']=digest(body)==expected
        return row,body
    except FileNotFoundError:row.update(exists=False,state='MISSING')
    except PermissionError:row['state']='UNREADABLE'
    except OSError as error:row.update(state='READ_ERROR',errno=error.errno)
    return row,None

def digest(value):return hashlib.sha256(value).hexdigest()

def inspect_modules(build,app,git_blob):
    modules=build['applicationModules']
    require(len(modules)==11,'MODULE_MANIFEST_COUNT')
    result=[]
    for name,expected in modules.items():
        require(re.fullmatch(r'src/application/[A-Za-z0-9_./-]+\.ts',name)
                and '..' not in pathlib.PurePosixPath(name).parts and re.fullmatch('[0-9a-f]{64}',expected),'MODULE_MANIFEST_PATH')
        path=app/name
        require(path.resolve().is_relative_to(app.resolve()),'APPLICATION_SOURCE_SCOPE')
        row,body=inventory(path,expected)
        row['path']=name
        row['matchesReviewedBundle']=body is not None and digest(body)==expected
        head=git_blob(name)
        row['gitHeadSourceSha256']=digest(head) if head is not None else None
        row['matchesGitHeadSource']=head==body if head is not None and body is not None else None
        if body is not None and not row['matchesReviewedBundle']:
            try:
                text=body.decode('utf-8-sig')
                row['lfWithoutBomSha256']=digest(text.replace('\r\n','\n').encode())
                row['lfWithoutBomMatchesReviewed']=row['lfWithoutBomSha256']==expected
            except UnicodeDecodeError:row['encoding']='NOT_UTF8'
        result.append(row)
    return result

def main():
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    control=ROOT/'control'/SET
    required=[('build',ROOT/'operator/application-read-build.json',BUILD_PIN),
        ('helper',ROOT/'operator'/('verify-application-'+HELPER_PIN+'.py'),HELPER_PIN),
        ('closure',control/'application-recovery-closure.json',None)]
    evidence={label:inventory(path,pin,True)[0] for label,path,pin in required}
    attempt=inventory(control/'application-recovery-attempt.json',private=True)[0]
    def git(*args):
        try:
            result=subprocess.run(['/usr/bin/git','-c','safe.directory='+str(APP),'-C',str(APP),*args],
                capture_output=True,timeout=5,env={'PATH':'/usr/bin:/bin','LANG':'C','GIT_OPTIONAL_LOCKS':'0'})
        except (OSError,subprocess.TimeoutExpired):return None
        require(len(result.stdout)<=131072,'GIT_OUTPUT_BOUND')
        return result.stdout if result.returncode==0 else None
    head=git('rev-parse','HEAD')
    head_text=head.decode().strip() if head is not None else None
    if head_text is not None and not re.fullmatch('[0-9a-f]{40}',head_text):head_text=None
    modules=inspect_modules({'applicationModules':MODULES},APP,lambda name:git('show','HEAD:'+name))
    print(json.dumps({'diagnostic':'READ_ONLY_APPLICATION_MODULE_INVENTORY_V2','setId':SET,'applicationGitHead':head_text,
        'modules':modules,'missingModules':sum(row['state']=='MISSING' for row in modules),
        'mismatchedModules':sum(not row['matchesReviewedBundle'] for row in modules),
        'requiredEvidence':evidence,'applicationAttempt':attempt,'clusterStarted':False,'acceptanceRepeated':False,
        'writes':'NONE','stagingPauseRequested':False,'b2Calls':0,'smtpCalls':0,'telegramCalls':0}))

if __name__=='__main__':
    try:main()
    except Exception as error:
        reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        print(json.dumps({'diagnostic':'STOP','reason':reason,'writes':'NONE','clusterStarted':False,
            'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
        raise SystemExit(1)
PY_APPLICATION_MODULE_INVENTORY_V2
```
<!-- END APPLICATION_MODULE_INVENTORY_V2_VPS -->

## Historical checkpoint — inventory V2 subsequently completed; do not rerun

Returned diagnostic STOP/FileNotFoundError/writes NONE/clusterStarted false. The
first diagnostic incorrectly required every installed evidence/source path to exist
and did not identify the missing path. No conclusion about which path is absent is
yet supported. Its failed source/command remains retained as historical evidence.
This does not invalidate the accepted B2/DB restore proof or repair the original
APPLICATION_MODULE_CHANGED preflight; application proof remains NOT_YET_RUN.

Correct only the read-only diagnostic: embed the exact11 reviewed expected module
identities, independently inventory installed build/helper/closure and all11 sources.
Missing, unreadable, unsafe-private, nonregular, symlink and oversize paths are labeled
with their precise reviewed path; no source text/secret is printed. Missing installed
metadata no longer prevents source inventory; missing sources no longer hide remaining
rows. Existing Git HEAD/source hashes are optional readonly metadata. Hash mismatch
is reported, never accepted/bypassed. Closure metadata inventory is not current runtime
health proof. No source deployment, SQL/cluster start, ACL/file writes, pause, B2/Storage,
SMTP/Telegram calls, acceptance retry or automatic cleanup. Seven focused tests PASS,
including full main flow with missing build/helper/closure/source files and absent Git;
Python/shell syntax and exact-source block checks PASS. Prior acceptance reused.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_INVENTORY_V2.

<!-- BEGIN APPLICATION_MODULE_DIAGNOSTIC_VPS -->
### Historical VPS TERMINAL — diagnostic FileNotFoundError; do not rerun

Copy only the shell block. Expected READ_ONLY_APPLICATION_MODULE_IDENTITIES,11 hash
rows,mismatchedModules>=1,applicationAttemptExists false,writes NONE,clusterStarted
false. Git identity is optional metadata if checkout/git is unavailable. Saved closure
is reported as saved evidence, not a fresh runtime health check. No source values printed.
On STOP retain output; no automatic rerun or application acceptance restart.

```sh
sudo /usr/bin/python3 -B - <<'PY_APPLICATION_MODULE_IDENTITIES'
"""Read-only hashes for an application preflight STOP; no cluster or acceptance retry."""
import hashlib
import json
import os
import pathlib
import re
import stat
import subprocess

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
APP=pathlib.Path('/var/www/passvero-acceptance')
SET='20261001T212354Z'
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
HELPER_PIN='c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee'

def require(value,reason):
    if not value:raise RuntimeError(reason)

def private_bytes(path):
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077,'PRIVATE_EVIDENCE_POSTURE')
    return path.read_bytes()

def digest(value):return hashlib.sha256(value).hexdigest()

def inspect_modules(build,app,git_blob):
    modules=build['applicationModules']
    require(len(modules)==11,'MODULE_MANIFEST_COUNT')
    result=[]
    for name,expected in modules.items():
        require(re.fullmatch(r'src/application/[A-Za-z0-9_./-]+\.ts',name)
                and '..' not in pathlib.PurePosixPath(name).parts and re.fullmatch('[0-9a-f]{64}',expected),'MODULE_MANIFEST_PATH')
        path=app/name
        require(path.resolve().is_relative_to(app.resolve()),'APPLICATION_SOURCE_SCOPE')
        info=path.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_size<=131072,'MODULE_FILE_POSTURE')
        body=path.read_bytes()
        actual=digest(body)
        head=git_blob(name)
        row={'path':name,'expectedSha256':expected,'actualSha256':actual,'bytes':len(body),
             'matchesReviewedBundle':actual==expected,'gitHeadSourceSha256':digest(head) if head is not None else None,
             'matchesGitHeadSource':head==body if head is not None else None}
        if actual!=expected:
            text=body.decode('utf-8-sig')
            row['lfWithoutBomSha256']=digest(text.replace('\r\n','\n').encode())
            row['lfWithoutBomMatchesReviewed']=row['lfWithoutBomSha256']==expected
        result.append(row)
    return result

def main():
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    build_raw=private_bytes(ROOT/'operator/application-read-build.json')
    require(digest(build_raw)==BUILD_PIN,'BUILD_IDENTITY')
    require(digest(private_bytes(ROOT/'operator'/('verify-application-'+HELPER_PIN+'.py')))==HELPER_PIN,'HELPER_IDENTITY')
    control=ROOT/'control'/SET
    closure=json.loads(private_bytes(control/'application-recovery-closure.json'))
    require(closure['applicationRecoveryClosure']=='PASS' and closure['restoreCluster']=='STOPPED'
            and closure['staging']=='ONLINE_UNPAUSED' and closure['campaignsEnabled']==0
            and closure['reminderTimer']=='DISABLED_INACTIVE','SAVED_CLOSURE')
    attempt=control/'application-recovery-attempt.json'
    require(not attempt.exists() and not attempt.is_symlink(),'APPLICATION_ATTEMPT_ALREADY_EXISTS')
    def git(*args):
        try:
            result=subprocess.run(['/usr/bin/git','-c','safe.directory='+str(APP),'-C',str(APP),*args],
                capture_output=True,timeout=5,env={'PATH':'/usr/bin:/bin','LANG':'C','GIT_OPTIONAL_LOCKS':'0'})
        except FileNotFoundError:return None
        require(len(result.stdout)<=131072,'GIT_OUTPUT_BOUND')
        return result.stdout if result.returncode==0 else None
    head=git('rev-parse','HEAD')
    head_text=head.decode().strip() if head is not None else None
    require(head_text is None or re.fullmatch('[0-9a-f]{40}',head_text),'APPLICATION_GIT_HEAD')
    modules=inspect_modules(json.loads(build_raw),APP,lambda name:git('show','HEAD:'+name))
    print(json.dumps({'diagnostic':'READ_ONLY_APPLICATION_MODULE_IDENTITIES','setId':SET,'applicationGitHead':head_text,
        'modules':modules,'mismatchedModules':sum(not row['matchesReviewedBundle'] for row in modules),
        'applicationAttemptExists':False,'savedClosure':closure,'clusterStarted':False,'acceptanceRepeated':False,
        'writes':'NONE','stagingPauseRequested':False,'b2Calls':0,'smtpCalls':0,'telegramCalls':0}))

if __name__=='__main__':
    try:main()
    except Exception as error:
        reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
        print(json.dumps({'diagnostic':'STOP','reason':reason,'writes':'NONE','clusterStarted':False,
            'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
        raise SystemExit(1)
PY_APPLICATION_MODULE_IDENTITIES
```
<!-- END APPLICATION_MODULE_DIAGNOSTIC_VPS -->

## Historical checkpoint — module diagnostic subsequently hit missing file; do not rerun

Operator unitfaf168178f56437bba9e8a473eb920bc returned APPLICATION_RECOVERY_PREFLIGHT /
APPLICATION_MODULE_CHANGED in0.583s. At least one of the11 live application source
hashes differs from the reviewed bundle; first mismatched path was not printed by
the original fail-fast guard. Package/lock/build identity and downloaded-set checks
preceded this guard successfully. Source control flow stops before application attempt
claim, ancestor ACL grant, cluster start or application read. Do not infer why code
bytes differ, bypass source checks, redeploy staging or re-run the acceptance unit.
Closure PASS: cluster STOPPED, parent0700, staging ONLINE_UNPAUSED, reminder timer
DISABLED_INACTIVE/campaigns0, SMTP/Telegram0. Actual B2 download/file checksum and
final DB recovery PASS remain accepted. Application proof remains NOT_YET_RUN.
Raw evidence: codex/evidence/backup-recovery/operator-application-preflight-module-changed.json.

Minimal next read-only diagnostic: verify installed helper/build pins and saved closure,
confirm application attempt absent; print all11 expected/current hashes, optional VPS
Git HEAD/source hashes and LF/no-BOM comparisons for mismatches. No source contents,
credentials, SQL, cluster start, permissions/file writes, B2/Storage calls, staging
pause or acceptance retry. Four synthetic hash/CRLF/code-change/symlink fixtures and
Python/shell syntax PASS. Local11 module hashes equal current HEAD; VPS identity
must be established from operator output before choosing a source correction.
All accepted capture/B2/DB/reminder/timeout/Telegram checks reused unchanged; no
production/backup schedule/freshness/credential change, email, deletion, commit or push.
PENDING_OPERATOR_COMMAND_READ_ONLY_APPLICATION_MODULE_IDENTITIES.

<!-- BEGIN APPLICATION_RECOVERY_VPS -->
### Historical VPS TERMINAL — application preflight STOP; do not rerun

Run once. Copy only the shell block. Expected isolatedApplicationRead
PASS_APPLICATION_SERVICES_PRIVATE_DB_AND_FILESYSTEM; application product/PDF/image
PASS; catalogUnchanged true; TCPfalse; restoreRepeated false; schema/business writes
NONE; SMTP/Telegram0. Then applicationRecoveryClosure PASS; cluster STOPPED; private
parents0700; staging ONLINE_UNPAUSED; reminder timer DISABLED_INACTIVE; campaigns0.
Supabase provider restore NOT_PERFORMED; web/auth-session/fresh-scanner recovery NOT_TESTED.
On STOP retain output and do not rerun. No staging pause or additional approval needed.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_APPLICATION_RECOVERY'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
SOURCE=r'''"""Final isolated application reads from accepted DB and real B2-downloaded private bytes."""
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
import subprocess

ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
SET='20261001T212354Z'
PIN='cfadf143ad7a2e79ba9635a01e7e167a34aa06669be7983396aba56973469624'
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
APP=pathlib.Path('/var/www/passvero-acceptance')
TARGET=ROOT/'restore'/SET
CONTROL=ROOT/'control'/SET
PHASE='APPLICATION_RECOVERY_PREFLIGHT'

def require(value,reason):
    if not value:raise RuntimeError(reason)

def helper():
    path=ROOT/'operator'/('verify-database-'+PIN+'.py')
    info=path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and not info.st_mode&0o077
            and hashlib.sha256(path.read_bytes()).hexdigest()==PIN,'RESTORE_HELPER_IDENTITY')
    spec=importlib.util.spec_from_file_location('accepted_restore',path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.helper()

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
    result={'applicationRecoveryClosure':'PASS','restoreCluster':'STOPPED','parentPermissions':'PRIVATE_0700_RESTORED',
            'staging':'ONLINE_UNPAUSED','reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
            'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    cap.write(CONTROL/'application-recovery-closure.json',result)
    print(json.dumps(result),flush=True)

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    restore=helper();cap=restore.cap_module();cap.validate_context(SET)
    prepare,_=cap.helpers();prepare.runtime();cap.gates(prepare)
    source=restore.verify_download(cap)
    closure=cap.read(CONTROL/'database-final-closure.json')
    require(closure['databaseFinalClosure']=='PASS' and closure['restoreCluster']=='STOPPED','FINAL_DATABASE_CLOSURE')
    accepted=cap.read(CONTROL/'database-restore-summary.json')
    require(accepted['databaseRestore']=='PASS_REAL_B2_DOWNLOADED_DUMP_VERIFIED'
            and accepted['snapshotId']==restore.SNAPSHOT and accepted['setId']==SET,'FINAL_DATABASE_PROOF')
    require(not (CONTROL/'application-recovery-attempt.json').exists(),'APPLICATION_RECOVERY_ALREADY_ATTEMPTED')
    build_path=ROOT/'operator'/'application-read-build.json'
    cap.private(build_path)
    require(hashlib.sha256(build_path.read_bytes()).hexdigest()==BUILD_PIN,'APPLICATION_BUILD_IDENTITY')
    build=cap.read(build_path)
    bundle=ROOT/'operator'/('application-read-'+build['bundleSha256']+'.cjs')
    cap.private(bundle)
    require(hashlib.sha256(bundle.read_bytes()).hexdigest()==build['bundleSha256'],'APPLICATION_BUNDLE_IDENTITY')
    source_config=cap.read(source/'configuration/source.json')
    require(hashlib.sha256((APP/'package.json').read_bytes()).hexdigest()==source_config['packageSha256']
            and hashlib.sha256((APP/'package-lock.json').read_bytes()).hexdigest()==source_config['lockSha256']
            and (APP/'.next/BUILD_ID').read_text().strip()==source_config['buildId'],'CAPTURED_APPLICATION_BUILD_CHANGED')
    for name,digest in build['applicationModules'].items():
        require(re.fullmatch(r'src/application/[A-Za-z0-9_./-]+\.ts',name) and '..' not in pathlib.PurePosixPath(name).parts,
                'APPLICATION_MODULE_PATH')
        require(hashlib.sha256((APP/name).read_bytes()).hexdigest()==digest,'APPLICATION_MODULE_CHANGED')
    require(restore.run(['/usr/bin/node','--version']).decode().strip()==source_config['node'],'APPLICATION_NODE_CHANGED')
    node_env={'PATH':'/usr/bin:/bin','LANG':'C','NODE_PATH':str(APP/'node_modules')}
    probe=subprocess.run(['/usr/bin/node','-e',"const z=require('zod');if(typeof z.uuid!=='function')process.exit(1);process.stdout.write('PASS')"],
        capture_output=True,timeout=10,env=node_env)
    require(probe.returncode==0 and probe.stdout==b'PASS','EXISTING_APPLICATION_ZOD_UNAVAILABLE')
    storage=cap.read(source/'storage/manifest.json')
    cap.write(CONTROL/'application-recovery-config.json',{'source':str(source),'socket':str(restore.SOCKET),
              'database':restore.DB,'objects':storage['objects']})
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
    cap.write(CONTROL/'application-recovery-attempt.json',{'setId':SET,'purpose':'PRIVATE_APPLICATION_READ_ONLY',
              'restoreRepeated':False,'automaticRetry':False})
    for path in parents:
        os.setxattr(path,restore.ACL_NAME,restore.traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(restore.get_acl(path)==restore.traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    PHASE='READ_ONLY_PRIVATE_CLUSTER_START'
    account=prepare.account('postgres')
    restore.run([restore.PG+'pg_ctl','-D',str(restore.DATA),'-l',str(restore.DATA/'application-recovery.log'),
        '-w','-t','30','start','-o',"-c listen_addresses='' -c port=55434 -c unix_socket_directories="+
        str(restore.SOCKET)+' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'
        +' -c default_transaction_read_only=on'],account=account)
    settings=restore.sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'),'readonly',current_setting('default_transaction_read_only'))")
    require(settings=={'data':str(restore.DATA),'tcp':'','port':'55434','readonly':'on'},'ISOLATED_READ_ONLY_IDENTITY')
    PHASE='ISOLATED_APPLICATION_PRODUCT_PDF_IMAGE_READ'
    result=subprocess.run(['/usr/bin/node',str(bundle),str(CONTROL/'application-recovery-config.json')],
        capture_output=True,timeout=90,env=node_env)
    require(result.returncode==0 and len(result.stdout)<65536,'APPLICATION_READ_FAILED')
    application=json.loads(result.stdout)
    require(application['applicationRead']=='PASS_PRIVATE_RECOVERY_PORTS'
            and application['schemaWrites']=='NONE' and application['businessWrites']=='NONE'
            and application['smtpCalls']==0
            and application['product']=='PASS_APPLICATION_CATALOG_EXPORT'
            and application['pdf']=='PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA'
            and application['image']=='PASS_APPLICATION_DOWNLOAD_AND_RECHECK','APPLICATION_READ_RESULT')
    # Reuse accepted DB proof; compare unchanged catalogue rather than rerun acceptance checks.
    require(restore.sql(cap.CATALOG)==cap.read(CONTROL/'database-final-catalog.json'),'APPLICATION_READ_CHANGED_CATALOG')
    prepare.runtime();cap.gates(prepare)
    output={'isolatedApplicationRead':'PASS_APPLICATION_SERVICES_PRIVATE_DB_AND_FILESYSTEM',
        'setId':SET,'snapshotId':restore.SNAPSHOT,'application':application,
        'applicationModulesMatched':len(build['applicationModules']),'bundleSha256':build['bundleSha256'],
        'catalogUnchanged':True,'databaseProof':'REUSED_ACCEPTED_FINAL_DATABASE_VERIFICATION',
        'tcpListener':False,'restoreRepeated':False,'schemaWrites':'NONE','businessWrites':'NONE',
        'storageProviderRestore':'NOT_PERFORMED','freshScannerTrustRecovery':'NOT_TESTED',
        'authSessionRecovery':'NOT_TESTED','webServiceRecovery':'NOT_TESTED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'artifactsRetained':True}
    cap.write(CONTROL/'application-recovery-summary.json',output)
    print(json.dumps(output),flush=True)
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
        print(json.dumps({'applicationRecoveryRead':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
            'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}),flush=True)
        sys.exit(1)
'''
SOURCE_PIN='c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee'
BUNDLE=r'''"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// scripts/staging-recovery/application_read.ts
var application_read_exports = {};
__export(application_read_exports, {
  runRecoveryRead: () => runRecoveryRead
});
module.exports = __toCommonJS(application_read_exports);
var import_node_crypto3 = require("node:crypto");
var import_node_child_process = require("node:child_process");
var import_node_fs = require("node:fs");
var import_node_path = __toESM(require("node:path"));

// src/application/permissions/product-permissions.ts
var PRODUCT_CREATE = "PRODUCT_CREATE";
var PRODUCT_EDIT = "PRODUCT_EDIT";
var PRODUCT_READ = "PRODUCT_READ";
var PRODUCT_PUBLISH = "PRODUCT_PUBLISH";
var QRCODE_ACTIVATE = "QRCODE_ACTIVATE";
var rolePermissions = {
  VIEWER: [PRODUCT_READ],
  EDITOR: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT],
  ADMIN: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT, PRODUCT_PUBLISH, QRCODE_ACTIVATE],
  OWNER: [PRODUCT_READ, PRODUCT_CREATE, PRODUCT_EDIT, PRODUCT_PUBLISH, QRCODE_ACTIVATE]
};
function hasProductPermission(context, permission) {
  return context.permissions.includes(permission);
}
function permissionsForMembershipRole(role) {
  return rolePermissions[role];
}

// src/application/products/product-search.ts
var import_zod = require("zod");
var MAX_PRODUCT_SEARCH_LENGTH = 200;
var productSearchSchema = import_zod.z.string().max(MAX_PRODUCT_SEARCH_LENGTH).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)).transform((value) => value.trim());

// src/application/products/export-catalog/contracts.ts
var CatalogExportError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
};
var MAX_EXPORT_ROWS = 1e4;
var MAX_EXPORT_BYTES = 20 * 1024 * 1024;
var EXPORT_TIMEOUT_MS = 15e3;

// src/application/products/export-catalog/csv.ts
var import_node_buffer = require("node:buffer");
var CATALOG_CSV_COLUMNS = [
  "product_id",
  "internal_name",
  "sku",
  "lifecycle_status",
  "version_number",
  "version_status",
  "source_locale",
  "gtin",
  "cn_code",
  "cn_nomenclature_year",
  "manufacturer_name",
  "manufacturer_country_code",
  "product_updated_at",
  "version_updated_at"
];
function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[\p{Cc}\p{Cf}]|^[\s\p{Cc}\p{Cf}]*[=+@\-＝＋－＠]/u.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function createCatalogCsv() {
  const chunks = [import_node_buffer.Buffer.from("\uFEFF" + CATALOG_CSV_COLUMNS.join(",") + "\r\n", "utf8")];
  let bytes = chunks[0].length;
  let rows = 0;
  return {
    append(values) {
      if (++rows > MAX_EXPORT_ROWS) throw new CatalogExportError("LIMIT");
      if (values.length !== CATALOG_CSV_COLUMNS.length) throw new CatalogExportError("FAILED");
      if (values.reduce((sum, value) => sum + import_node_buffer.Buffer.byteLength(String(value ?? "")), 0) > MAX_EXPORT_BYTES - bytes) throw new CatalogExportError("LIMIT");
      const chunk = import_node_buffer.Buffer.from(values.map(csvCell).join(",") + "\r\n", "utf8");
      if (bytes + chunk.length > MAX_EXPORT_BYTES) throw new CatalogExportError("LIMIT");
      bytes += chunk.length;
      chunks.push(chunk);
    },
    finish() {
      return new Uint8Array(import_node_buffer.Buffer.concat(chunks, bytes));
    }
  };
}

// src/application/products/export-catalog/export-catalog.ts
function createExportCatalog(persistence) {
  return async (query, context) => {
    if (!context || context.membershipStatus !== "ACTIVE" || !hasProductPermission(context, PRODUCT_READ)) throw new CatalogExportError("FORBIDDEN");
    const parsed = productSearchSchema.safeParse(query ?? "");
    if (!parsed.success) throw new CatalogExportError("INVALID_SEARCH");
    const deadline = performance.now() + EXPORT_TIMEOUT_MS;
    const csv = createCatalogCsv();
    try {
      await persistence.readSnapshot(context.organizationId, parsed.data, (rows) => {
        for (const row of rows) {
          if (performance.now() > deadline) throw new CatalogExportError("LIMIT");
          const version = row.currentDraftVersion ?? row.currentPublishedVersion;
          if (row.organizationId !== context.organizationId || version && (version.organizationId !== context.organizationId || version.productId !== row.id || version.manufacturer && version.manufacturer.organizationId !== context.organizationId)) throw new CatalogExportError("FAILED");
          const gtins = version?.identifiers.filter((i) => i.type === "GTIN") ?? [];
          const cns = version?.identifiers.filter((i) => i.type === "CN") ?? [];
          if (gtins.length > 1 || cns.length > 1) throw new CatalogExportError("FAILED");
          csv.append([
            row.id,
            row.internalName,
            row.sku,
            row.lifecycleStatus,
            version?.versionNumber,
            version?.status,
            version?.sourceLocale,
            gtins[0]?.value,
            cns[0]?.value,
            cns[0]?.nomenclatureYear,
            version?.manufacturer?.name,
            version?.manufacturer?.countryCode,
            row.updatedAt.toISOString(),
            version?.updatedAt.toISOString()
          ]);
        }
      });
      if (performance.now() > deadline) throw new CatalogExportError("LIMIT");
      return csv.finish();
    } catch (error) {
      if (error instanceof CatalogExportError) throw error;
      throw new CatalogExportError("FAILED");
    }
  };
}

// src/application/products/images/service.ts
var import_node_crypto = require("node:crypto");
var import_zod3 = require("zod");

// src/application/errors/application-error.ts
var ApplicationError = class extends Error {
  constructor(category, code, message, retryable, correlationId) {
    super(message);
    this.category = category;
    this.code = code;
    this.retryable = retryable;
    this.correlationId = correlationId;
    this.name = "ApplicationError";
  }
};

// src/application/products/images/contracts.ts
var import_zod2 = require("zod");
var MAX_IMAGE_BYTES = 8 * 1024 * 1024;
var imageEvidenceSchema = import_zod2.z.object({
  expectedDraftVersionId: import_zod2.z.uuid(),
  expectedProductUpdatedAt: import_zod2.z.iso.datetime(),
  expectedDraftUpdatedAt: import_zod2.z.iso.datetime()
});
var imageCommandSchema = import_zod2.z.discriminatedUnion("operation", [
  imageEvidenceSchema.extend({ operation: import_zod2.z.literal("SET"), altText: import_zod2.z.string().trim().max(300) }).strict(),
  imageEvidenceSchema.extend({ operation: import_zod2.z.literal("REMOVE") }).strict()
]);
function imageError(category, code) {
  return new ApplicationError(category, code, "The image request could not be completed.", false);
}

// src/application/products/images/service.ts
function createImageServices(deps) {
  function context(value, edit) {
    if (!value || value.membershipStatus !== "ACTIVE" || !hasProductPermission(value, edit ? "PRODUCT_EDIT" : "PRODUCT_READ")) throw imageError("FORBIDDEN", "FORBIDDEN");
  }
  function uuid2(id) {
    if (!import_zod3.z.uuid().safeParse(id).success) throw imageError("VALIDATION", "VALIDATION_ERROR");
  }
  async function safe(work) {
    try {
      return await work();
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
    }
  }
  return {
    get: (id, ctx) => safe(async () => {
      context(ctx, false);
      uuid2(id);
      return deps.persistence.get(id, ctx);
    }),
    authorize: (id, input, ctx) => safe(async () => {
      context(ctx, true);
      uuid2(id);
      const command = imageCommandSchema.safeParse(input);
      if (!command.success) throw imageError("VALIDATION", "VALIDATION_ERROR");
      await deps.persistence.check(id, command.data, ctx);
    }),
    mutate: (id, input, bytes, ctx) => safe(async () => {
      context(ctx, true);
      uuid2(id);
      const parsed = imageCommandSchema.safeParse(input);
      if (!parsed.success) throw imageError("VALIDATION", "VALIDATION_ERROR");
      const command = parsed.data;
      await deps.persistence.check(id, command, ctx);
      if (command.operation === "REMOVE") {
        await deps.persistence.finalize(id, command, ctx);
        return { status: "UPDATED" };
      }
      if (!bytes) throw imageError("VALIDATION", "INVALID_IMAGE");
      const { bytes: normalizedBytes, ...metadata2 } = await deps.normalize(bytes);
      const assetId = (0, import_node_crypto.randomUUID)();
      const asset = { ...metadata2, id: assetId, organizationId: ctx.organizationId, ...deps.storage.identity(assetId, metadata2.mimeType) };
      await deps.persistence.reserve(id, command, ctx, asset);
      try {
        await deps.storage.put(asset, normalizedBytes);
        const stored = await deps.storage.read(asset);
        if (stored.length !== asset.sizeBytes || (0, import_node_crypto.createHash)("sha256").update(stored).digest("hex") !== asset.checksumSha256) throw imageError("INTERNAL", "UPLOAD_FAILED");
        await deps.persistence.finalize(id, command, ctx, assetId);
      } catch (error) {
        try {
          if (await deps.persistence.abandon(assetId, ctx.organizationId)) await deps.storage.remove(asset);
        } catch {
        }
        throw error;
      }
      return { status: "UPDATED" };
    }),
    download: (target, imageId) => safe(async () => {
      uuid2(imageId);
      const load = async () => {
        if ("publicCode" in target) {
          if (!/^[A-Za-z0-9_-]{16,64}$/.test(target.publicCode)) throw imageError("NOT_FOUND", "NOT_FOUND");
          return deps.persistence.publicAsset(target.publicCode, imageId);
        }
        context(target.context, false);
        uuid2(target.productId);
        return deps.persistence.privateAsset(target.productId, imageId, target.context);
      };
      const asset = await load();
      const bytes = await deps.storage.read(asset);
      if (bytes.length !== asset.sizeBytes || (0, import_node_crypto.createHash)("sha256").update(bytes).digest("hex") !== asset.checksumSha256) throw imageError("INTERNAL", "OPERATIONAL_FAILURE");
      const current = await load();
      if (current.id !== asset.id || current.checksumSha256 !== asset.checksumSha256) throw imageError("NOT_FOUND", "NOT_FOUND");
      return { bytes, mimeType: asset.mimeType, sizeBytes: asset.sizeBytes };
    })
  };
}

// src/application/documents/contracts.ts
var DocumentError = class extends Error {
  constructor(code) {
    super(code);
    this.code = code;
    this.name = "DocumentError";
  }
};

// src/application/documents/pdf.ts
var import_node_crypto2 = require("node:crypto");
var import_zod4 = require("zod");
var MAX_DOCUMENT_PDF_SIZE = 10 * 1024 * 1024;
var controls = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
var metadata = import_zod4.z.object({ filename: import_zod4.z.string().min(1).max(4096), mimeType: import_zod4.z.literal("application/pdf"), displayName: import_zod4.z.string().max(200).optional() }).strict();
function validatePdf(input) {
  const parsed = metadata.safeParse({ filename: input.filename, mimeType: input.mimeType, displayName: input.displayName });
  if (!parsed.success || controls.test(parsed.data.filename) || parsed.data.displayName && controls.test(parsed.data.displayName)) throw new DocumentError("VALIDATION_ERROR");
  const originalFilename = parsed.data.filename.replaceAll("\\", "/").split("/").at(-1).normalize("NFC").trim();
  if (!originalFilename || Array.from(originalFilename).length > 200 || !/\.pdf$/i.test(originalFilename)) throw new DocumentError("VALIDATION_ERROR");
  if (!(input.bytes instanceof Uint8Array) || input.bytes.byteLength === 0 || input.bytes.byteLength > MAX_DOCUMENT_PDF_SIZE || ![37, 80, 68, 70, 45].every((byte, index) => input.bytes[index] === byte)) throw new DocumentError("VALIDATION_ERROR");
  return { originalFilename, displayName: parsed.data.displayName?.normalize("NFC").trim() || null, sizeBytes: input.bytes.byteLength, checksumSha256: sha256(input.bytes) };
}
function sha256(bytes) {
  return (0, import_node_crypto2.createHash)("sha256").update(bytes).digest("hex");
}

// src/application/documents/bytes.ts
async function readDocumentBytes(stream, signal, limit = MAX_DOCUMENT_PDF_SIZE) {
  if (!stream) throw new DocumentError("VALIDATION_ERROR");
  const reader = stream.getReader();
  const chunks = [];
  let length = 0;
  const abort = () => {
    void reader.cancel().catch(() => void 0);
  };
  signal?.addEventListener("abort", abort, { once: true });
  try {
    if (signal?.aborted) {
      await reader.cancel();
      throw new DocumentError("OPERATIONAL_FAILURE");
    }
    while (true) {
      const chunk = await reader.read();
      if (signal?.aborted) throw new DocumentError("OPERATIONAL_FAILURE");
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new DocumentError("VALIDATION_ERROR");
      }
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return bytes;
  } finally {
    signal?.removeEventListener("abort", abort);
    reader.releaseLock();
  }
}

// scripts/staging-recovery/application_read.ts
function requireRecovery(value, code) {
  if (!value) throw new Error(code);
}
function uuid(value) {
  requireRecovery(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), "RECOVERY_UUID");
  return `'${value}'::uuid`;
}
var deny = () => {
  throw new Error("RECOVERY_WRITE_OR_PUBLIC_PATH_FORBIDDEN");
};
async function runRecoveryRead(config, ports) {
  requireRecovery(config.database === "passvero_staging_recovery", "RECOVERY_DATABASE_SCOPE");
  const candidate = ports.query(`/* recovery:candidate */ SELECT json_build_object('product',row_to_json(p),'membership',row_to_json(m),'imageId',i.id)
    FROM "Product" p JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId"
    JOIN "ProductImage" i ON i."productVersionId"=v.id JOIN "ProductImageAsset" a ON a.id=i."assetId" AND a."organizationId"=p."organizationId"
    JOIN "Membership" m ON m."organizationId"=p."organizationId" AND m.status='ACTIVE'
    WHERE p."lifecycleStatus"='ACTIVE' AND v.id IN (p."currentDraftVersionId",p."currentPublishedVersionId")
    AND a.state='READY' AND a."policyVersion"=1 ORDER BY p.id,i.id,m.id LIMIT 1`);
  requireRecovery(candidate, "NO_RESTORED_PRODUCT_IMAGE_MEMBERSHIP");
  const productId = uuid(candidate.product.id);
  const organizationId = uuid(candidate.product.organizationId);
  const membershipId = uuid(candidate.membership.id);
  const userId = uuid(candidate.membership.userId);
  requireRecovery(candidate.membership.organizationId === candidate.product.organizationId && candidate.membership.status === "ACTIVE" && ["VIEWER", "EDITOR", "ADMIN", "OWNER"].includes(candidate.membership.role), "RECOVERY_MEMBERSHIP");
  const context = {
    userId: candidate.membership.userId,
    organizationId: candidate.product.organizationId,
    membershipId: candidate.membership.id,
    membershipRole: candidate.membership.role,
    membershipStatus: "ACTIVE",
    permissions: permissionsForMembershipRole(candidate.membership.role),
    correlationId: "isolated-recovery-read"
  };
  const actor = () => {
    const count = ports.query(`/* recovery:actor */ SELECT count(*) FROM "Membership" WHERE id=${membershipId}
      AND "userId"=${userId} AND "organizationId"=${organizationId} AND status='ACTIVE' AND role='${candidate.membership.role}'`);
    requireRecovery(count === 1, "RECOVERY_ACTOR_CHANGED");
  };
  const bytesFor = (identity) => {
    requireRecovery(identity.storageProvider === "supabase", "RECOVERY_STORAGE_PROVIDER");
    const matches = config.objects.filter((o) => o.bucket === identity.storageBucket && o.key === identity.storageKey);
    requireRecovery(matches.length === 1, "RECOVERY_OBJECT_NOT_STORED");
    const object = matches[0];
    requireRecovery(["passvero-staging-documents", "passvero-staging-images"].includes(object.bucket) && object.file === (0, import_node_crypto3.createHash)("sha256").update(object.bucket + "\0" + object.key).digest("hex") && object.size === Number(identity.sizeBytes) && object.sha256 === identity.checksumSha256, "RECOVERY_OBJECT_IDENTITY");
    const file = import_node_path.default.join(config.source, "storage", "objects", object.bucket, object.file);
    const bytes = ports.readFile(file);
    requireRecovery(bytes.byteLength === object.size && sha256(bytes) === object.sha256, "RECOVERY_OBJECT_CHECKSUM");
    return bytes;
  };
  const exportProduct = createExportCatalog({ async readSnapshot(org, search, consume) {
    requireRecovery(org === context.organizationId && search === "", "RECOVERY_PRODUCT_SCOPE");
    actor();
    const row = ports.query(`/* recovery:product */ SELECT row_to_json(p) FROM "Product" p WHERE id=${productId} AND "organizationId"=${organizationId}`);
    requireRecovery(row, "RECOVERY_PRODUCT_MISSING");
    const loadVersion = (id) => {
      if (!id) return null;
      const versionId = uuid(id);
      const v = ports.query(`/* recovery:version */ SELECT row_to_json(v) FROM "ProductVersion" v WHERE id=${versionId} AND "productId"=${productId} AND "organizationId"=${organizationId}`);
      requireRecovery(v, "RECOVERY_VERSION_MISSING");
      const identifiers = ports.query(`/* recovery:identifiers */ SELECT coalesce(json_agg(json_build_object('type',type,'value',value,'nomenclatureYear',"nomenclatureYear") ORDER BY type,value),'[]'::json) FROM "ProductIdentifier" WHERE "productVersionId"=${versionId}`);
      const manufacturer = ports.query(`/* recovery:manufacturer */ SELECT json_build_object('organizationId',"organizationId",'name',name,'countryCode',"countryCode") FROM "ProductVersionManufacturer" WHERE "productVersionId"=${versionId}`);
      return { ...v, updatedAt: new Date(v.updatedAt), identifiers, manufacturer };
    };
    const record = {
      ...row,
      updatedAt: new Date(row.updatedAt),
      currentDraftVersion: loadVersion(row.currentDraftVersionId),
      currentPublishedVersion: loadVersion(row.currentPublishedVersionId)
    };
    await consume([record]);
  } });
  const csv = await exportProduct("", context);
  requireRecovery(csv.byteLength > 0 && new TextDecoder().decode(csv).includes(candidate.product.id), "RECOVERY_PRODUCT_READ");
  const imageServices = createImageServices({
    normalize: deny,
    persistence: {
      get: deny,
      check: deny,
      reserve: deny,
      finalize: deny,
      abandon: deny,
      publicAsset: deny,
      async privateAsset(id, imageId, ctx) {
        requireRecovery(id === candidate.product.id && ctx.organizationId === context.organizationId, "RECOVERY_IMAGE_SCOPE");
        actor();
        const image2 = ports.query(`/* recovery:image */ SELECT row_to_json(a) FROM "Product" p
          JOIN "ProductVersion" v ON v."productId"=p.id AND v."organizationId"=p."organizationId"
          JOIN "ProductImage" i ON i."productVersionId"=v.id JOIN "ProductImageAsset" a ON a.id=i."assetId" AND a."organizationId"=p."organizationId"
          WHERE p.id=${productId} AND p."organizationId"=${organizationId} AND i.id=${uuid(imageId)}
          AND v.id IN (p."currentDraftVersionId",p."currentPublishedVersionId")`);
        requireRecovery(image2 && image2.state === "READY" && image2.policyVersion === 1 && ["image/jpeg", "image/png"].includes(image2.mimeType) && Number(image2.sizeBytes) > 0 && Number(image2.sizeBytes) <= 8 * 1024 * 1024, "RECOVERY_IMAGE_STATE");
        return { ...image2, sizeBytes: Number(image2.sizeBytes) };
      }
    },
    storage: { identity: deny, put: deny, remove: deny, async read(asset) {
      return bytesFor(asset);
    } }
  });
  const image = await imageServices.download({ productId: candidate.product.id, context }, candidate.imageId);
  const document = ports.query(`/* recovery:document */ SELECT row_to_json(d) FROM "Document" d
    WHERE d.status='AVAILABLE' AND d."mimeType"='application/pdf' AND EXISTS
      (SELECT 1 FROM "ProductDocument" l JOIN "ProductVersion" v ON v.id=l."productVersionId" AND v."organizationId"=d."organizationId" WHERE l."documentId"=d.id)
    ORDER BY d.id LIMIT 1`);
  requireRecovery(document, "NO_RESTORED_LINKED_PDF");
  const original = bytesFor(document);
  const stream = new ReadableStream({ start(controller) {
    controller.enqueue(original);
    controller.close();
  } });
  const pdfBytes = await readDocumentBytes(stream);
  const pdf = validatePdf({ filename: document.originalFilename, mimeType: document.mimeType, bytes: pdfBytes });
  requireRecovery(pdf.sizeBytes === Number(document.sizeBytes) && pdf.checksumSha256 === document.checksumSha256, "RECOVERY_PDF_READ");
  return {
    applicationRead: "PASS_PRIVATE_RECOVERY_PORTS",
    product: "PASS_APPLICATION_CATALOG_EXPORT",
    pdf: "PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA",
    image: "PASS_APPLICATION_DOWNLOAD_AND_RECHECK",
    productCsvSha256: sha256(csv),
    pdfBytes: pdf.sizeBytes,
    pdfSha256: pdf.checksumSha256,
    imageBytes: image.sizeBytes,
    imageSha256: sha256(image.bytes),
    schemaWrites: "NONE",
    businessWrites: "NONE",
    smtpCalls: 0,
    storageProviderRestore: "NOT_PERFORMED",
    authSessionRecovery: "NOT_TESTED",
    freshScannerTrustRecovery: "NOT_TESTED",
    webServiceRecovery: "NOT_TESTED"
  };
}
if (require.main === module) {
  (async () => {
    const config = JSON.parse((0, import_node_fs.readFileSync)(process.argv[2], "utf8"));
    requireRecovery(config.database === "passvero_staging_recovery" && /^\/var\/lib\/passvero-staging-recovery\/restore\/[0-9]{8}T[0-9]{6}Z\/socket$/.test(config.socket), "RECOVERY_SOCKET_SCOPE");
    const query = (sql) => {
      const out = (0, import_node_child_process.execFileSync)(
        "/usr/lib/postgresql/16/bin/psql",
        [
          "-XqAt",
          "-h",
          config.socket,
          "-p",
          "55434",
          "-U",
          "postgres",
          "-d",
          config.database,
          "-v",
          "ON_ERROR_STOP=1",
          "-c",
          "BEGIN READ ONLY; SET LOCAL statement_timeout='10s'; " + sql
        ],
        { encoding: "utf8", timeout: 15e3, maxBuffer: 1024 * 1024, env: { PATH: "/usr/bin:/bin", LANG: "C", PGAPPNAME: "passvero_recovery_app_read" }, stdio: ["ignore", "pipe", "pipe"] }
      );
      return out.trim() ? JSON.parse(out) : null;
    };
    console.log(JSON.stringify(await runRecoveryRead(config, { query, readFile: (file) => new Uint8Array((0, import_node_fs.readFileSync)(file)) })));
  })().catch(() => {
    console.log(JSON.stringify({ applicationRead: "STOP", reason: "PRIVATE_APPLICATION_READ_FAILED" }));
    process.exitCode = 1;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  runRecoveryRead
});
'''
BUNDLE_PIN='35d4b1d74f7a8ac40efb1f1bc3264fb086fbbdb4f9c8ecf8d9e306544fc3aad9'
BUILD=r'''{
  "applicationModules": {
    "src/application/documents/bytes.ts": "b09a9d1ec2d10e9a330352bc15a99271dd3de894d9fdb1145cba639304ec9710",
    "src/application/documents/contracts.ts": "fdb5f4448424c2175089955da78a304ecc1b4240b164e675880ad790539f26d3",
    "src/application/documents/pdf.ts": "07697db8850f782bce3efe447f5430c2491ca06588097f482c7501f80b009fd8",
    "src/application/errors/application-error.ts": "89bfd62a6ab94681e85cb8b3d57f4b09b002a638430de77ec074497ed493ebc1",
    "src/application/permissions/product-permissions.ts": "e716f110722779dadb9ba5f96713a0cec30c2b3a243e39d19ca5b1790f240c19",
    "src/application/products/export-catalog/contracts.ts": "71b4ab48f017ec1135c1053680736e1d66e0b5ed5eee78ff9f05242a1b760d05",
    "src/application/products/export-catalog/csv.ts": "3419d540dc4eb8e2fa0104c619850a3295d87e43fd4345caa5678c818300f0c6",
    "src/application/products/export-catalog/export-catalog.ts": "da30f95fa7e5630819a633335099b9708b62daa552b3a10b23ed3202b0c2b708",
    "src/application/products/images/contracts.ts": "117ceff40a0e49923cb22b44f6d3e3aa3cd7422b693c893dc0ebc580eebed4c1",
    "src/application/products/images/service.ts": "7fb5fe12143737db88183b842e34d2caa9072d9c6300ee513e34cc831249c48c",
    "src/application/products/product-search.ts": "77548eaa3b650333675cbca5419b4aa282947bd648222c660333ffbffda7ef7d"
  },
  "bundleSha256": "35d4b1d74f7a8ac40efb1f1bc3264fb086fbbdb4f9c8ecf8d9e306544fc3aad9",
  "harnessSourceSha256": "a7874529bd2c33cf69fd015921d6f6b89016e50c1aaae08dd26c5963b2774b78",
  "schema": 1,
  "zodVersion": "4.6.2"
}
'''
BUILD_PIN='b11c50998d87f134c3611c4e5337604990315b83b18d43eafe91403635351e85'
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    entries=[(ROOT/'operator'/('verify-application-'+SOURCE_PIN+'.py'),SOURCE,SOURCE_PIN),
        (ROOT/'operator'/('application-read-'+BUNDLE_PIN+'.cjs'),BUNDLE,BUNDLE_PIN),
        (ROOT/'operator'/'application-read-build.json',BUILD,BUILD_PIN)]
    for path,source,pin in entries:
        if hashlib.sha256(source.encode()).hexdigest()!=pin:raise RuntimeError('REVIEWED_PAYLOAD_HASH')
        if path.exists() or path.is_symlink():raise RuntimeError('APPLICATION_HELPER_EXISTS_MANUAL_REVIEW')
    compile(SOURCE,'reviewed-application-helper','exec')
    if json.loads(BUILD)['bundleSha256']!=BUNDLE_PIN:raise RuntimeError('BUILD_BUNDLE_IDENTITY')
    unit='passvero-stage-restore-20261001T212354Z-application-recovery.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.returncode!=0 or check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('APPLICATION_UNIT_EXISTS_MANUAL_REVIEW')
    for path,source,pin in entries:
        with open(path,'xb') as f:f.write(source.encode());f.flush();os.fsync(f.fileno())
    path=entries[0][0]
    print(json.dumps({'applicationRecoveryHelper':'REVIEWED_INSTALLED','sourceSha256':SOURCE_PIN,
        'bundleSha256':BUNDLE_PIN,'buildSha256':BUILD_PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=UMask=0077','--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'applicationRecoveryInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
        'artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_APPLICATION_RECOVERY
```
<!-- END APPLICATION_RECOVERY_VPS -->

## Historical checkpoint — application preflight subsequently stopped; DB proof retained

Returned operator evidence recorded 2026-10-02; set20261001T212354Z, actual B2 snapshot
2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2.
Final database unit invocation3ddfbb1dcdcb40e58f23b009e72102d6 completed success/status0
in2.571s. All51 tables/counters,31 migrations, sequences, database ACL and catalogue
owners/ACLs MATCH. Exactly six reviewed constraint representations and six owner
ACL/default equivalences accepted by their bounded comparator. Nine asset references,
five restored stored objects and four accepted cleanup tombstones verified.
No rerestore/schema/business writes. Closure PASS: cluster STOPPED, private parents0700,
staging ONLINE_UNPAUSED, reminder timer DISABLED_INACTIVE, campaignsEnabled0.
Raw sanitized output: codex/evidence/backup-recovery/operator-final-database-verification-pass.json.

Only remaining operator step: isolated application services read from this already
verified private database and actual B2-downloaded filesystem bytes. Reviewed helper
c3b794a89ccfe7a7b95da3ae7580cfa3c7606ec94d693be4930a5824f5f73aee starts the same
socket-only PG16 cluster with default_transaction_read_only=on; it does not restore
again or pause staging. Hash-pinned bundle uses11 deployed application modules
(checked against unchanged captured package/lock/build identity) and existing zod.
Actual catalog export and private image download/recheck services, plus bounded PDF
bytes/metadata reader, run with readonly SQL/private filesystem ports. No credentials
or live application environment passed. All mutation/public transport ports denied.
Exclusive attempt/summary/closure retain history. Unit UMask0077,RuntimeMaxSec300,
TimeoutStopSec25,control-group kill and independent ExecStopPost preserve the accepted
private ancestor ACL/0700 closure. No automatic retry on STOP.

Local evidence:10 application reader tests and6 synthetic complete operator tests
PASS; focused strict TypeScript/Python/Node/shell checks and exact three-payload/hash
packaging PASS. Prior capture, real B2 download/checksum, final database, timeout,
reminder delivery/replay/stale cancellation and Telegram acceptance reused unchanged.
This proves private application service reading only: Supabase restore NOT_PERFORMED;
full web service, authenticated session and fresh scanner trust NOT_TESTED. Independent
secret/role credential escrow and provider/scanner activation remain recovery dependencies.
Four confirmed reminder receipts, replay0 additional sends and two stale cancellations
retained. Production backup/freshness/Telegram/scanner/producer/credentials unchanged;
no email, new staging schedule, deletion, commit or push. This is a one-off recovery set.
PENDING_OPERATOR_COMMAND_APPLICATION_RECOVERY_READ.

## Historical checkpoint — final DB verification subsequently passed; do not rerun

Review update2026-10-02 Europe/Zagreb. Returned six full definition pairs match all
12 previously returned SHA signatures. Differences are solely associative grouping
of existing AND operands and uniform varchar-array→text[] casting versus individual
varchar-element→text casts; predicates, limits, literals, column references, regexes
and OR groups are identical. No schema change warranted. New comparator accepts
only these exact six (table,constraint,sourceSHA,restoredSHA) pairs; no generic text/
parenthesis/cast normalizer. Other constraint fields and all other catalogue sections
remain strict. For exactly six owner-only relation ACL→NULL pairs, require identical
owner/kind/RLS/name, ownerpassvero_migrator/tablekindr, exact old ACL; then SELECT
aclexplode of saved ACL versus coalesce(actualACL,acldefault('r',actualOwner)). Compare
grantor/grantee/privilege/grant-option lists; no GRANT/REVOKE or permission repairs.
Unexpected differences remain STOP. This corrects the verifier's overly strict text
comparison, not restored schema/data. The reviewed full definitions are retained.

Next is already approved final verification of the existing B2-restored database:
51 table counters,31 migration metadata/checksums, sequences, owners/ACL,9 exact
asset references/5 stored objects/4 accepted cleanup tombstones. Same private PG16
cluster, no re-restore/new target, TCP disabled, SQL default read-only, business/schema
writes NONE. Distinct database-final unit/claim/closure; UMask0077,300s/25s/control-group/
ExecStopPost protections, named postgres execute-only ancestor ACL and0700 cleanup
retained. Actual PG acceptance and isolated application product/PDF/image reads
remain pending operator output. No repeated B2/capture/reminder/Telegram acceptance.

11 affected comparator tests PASS: exact pairs/effective ACL pass, changed limits,
owners,grants,RLS,role/function/constraint identity/count fail; inputs unchanged.
Full installer exact source/hash/UMask/closure/Python/shell syntax PASS. Prior tests
and accepted runtime/capture/B2/private byte checks reused. No Codex privileged action,
production/schedule/freshness/scanner/producer/credential change, email, business or
snapshot deletion, commit or push. No automatic staging schedule introduced.
PENDING_OPERATOR_COMMAND_FINAL_DATABASE_VERIFICATION. Application read is next.

<!-- BEGIN FINAL_DATABASE_VERIFICATION_VPS -->
### VPS TERMINAL — PENDING_OPERATOR_COMMAND_FINAL_DATABASE_VERIFICATION

Run once. Expected databaseRestore PASS_REAL_B2_DOWNLOADED_DUMP_VERIFIED;tables51;migrations31;6exact constraint representations/6effective owner-default ACL equivalences;counts/sequences/database ACL MATCH;references9;objects5;tombstones4;restoreRepeated false;TCPfalse. Then databaseFinalClosure PASS;cluster STOPPED;parent0700;staging ONLINE_UNPAUSED;timers/campaigns OFF. Application read NOT_YET_RUN. On STOP retain output, never rerun.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_DATABASE_RESTORE'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='cfadf143ad7a2e79ba9635a01e7e167a34aa06669be7983396aba56973469624'
SOURCE=r'''"""Read-only SQL diagnosis of an already restored private cluster; never re-restore."""
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
'''
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    body=SOURCE.encode()
    if hashlib.sha256(body).hexdigest()!=PIN:raise RuntimeError('REVIEWED_SOURCE_HASH')
    compile(body,'reviewed-restore','exec')
    path=ROOT/'operator'/('verify-database-'+PIN+'.py')
    if path.exists() or path.is_symlink():raise RuntimeError('RESTORE_HELPER_EXISTS_MANUAL_REVIEW')
    unit='passvero-stage-restore-20261001T212354Z-database-final.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('RESTORE_UNIT_EXISTS_MANUAL_REVIEW')
    with open(path,'xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    print(json.dumps({'databaseVerificationHelper':'REVIEWED_INSTALLED','sourceSha256':PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=UMask=0077','--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'databaseVerificationInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_DATABASE_RESTORE
```
<!-- END FINAL_DATABASE_VERIFICATION_VPS -->


## Current checkpoint — catalog diagnosis PASS; six constraint definitions pending review

Returned READ_ONLY_RESTORED_CATALOG_COMPLETE is successful diagnostic, not DB acceptance:
12 differences only: six constraint-definition hashes and six relation ACLs. All
columns,defaultACLs,enums,functions,indexes,migrations,roles,schemas,pending counters,
non-public schemas and large objects match strictly. Six ACL pairs are owner-only
{passvero_migrator=arwdDxt/passvero_migrator} versus null/default. PostgreSQL16
privilege docs describe null as default privileges; semantic validation must still
check each relation owner/kind and actual expanded ACL, not ignore ACLs globally.
No permission/schema correction justified by these ACL representations alone.

Diagnostic closure PASS: private cluster stopped, parent0700, stage online,timerOFF,
campaigns0,SMTP/Telegram0. No restore repeated or business/schema writes. Constraint
hashes alone do not prove logical equivalence or actual difference. Next minimal
operator block reads the already saved source and restored catalogues, verifies B2
manifest/source-catalog SHA and saved constraint-difference hashes, and prints only
six metadata definition pairs. No cluster start, SQL, chmod, provider call, file write,
new database or rerestore. Await concrete definitions before comparator correction.
Python/shell syntax PASS; existing8 diagnostic and28 restore tests reused unchanged.
Capture/B2/reminder/timeout/production/freshness/Telegram proof remains retained;
full DB/application recovery still pending. No commit/push or automatic schedule.
PENDING_OPERATOR_COMMAND_SAVED_CONSTRAINT_DEFINITIONS.

### Historical saved-definition read — returned and reviewed

Expected READ_ONLY_SAVED_CONSTRAINT_DEFINITIONS;six source/restored definition pairs;clusterStarted false;restoreRepeated false;writes NONE. No presumed equivalence.

```sh
sudo /usr/bin/python3 -B - <<'PY_SAVED_CONSTRAINT_DIFFS'
import hashlib,importlib.util,json,os,pathlib,re,stat,sys
R=pathlib.Path('/var/lib/passvero-staging-recovery')
S='20261001T212354Z'
P='d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    h=R/'operator'/('capture-'+P+'.py');v=h.lstat()
    if not stat.S_ISREG(v.st_mode) or v.st_uid!=0 or v.st_mode&0o077 or hashlib.sha256(h.read_bytes()).hexdigest()!=P:raise RuntimeError('HELPER_IDENTITY')
    spec=importlib.util.spec_from_file_location('read_catalog_evidence',h);cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
    C=R/'control'/S
    source=R/'restore'/S/'download'/(R/'sets'/S).relative_to('/')
    manifest_path=source/'recovery-set.json';cap.private(manifest_path)
    if hashlib.sha256(manifest_path.read_bytes()).hexdigest()!='2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132':raise RuntimeError('B2_MANIFEST_CHANGED')
    manifest=cap.read(manifest_path);dbpath=source/'database/manifest.json';cap.private(dbpath)
    if hashlib.sha256(dbpath.read_bytes()).hexdigest()!=manifest['files']['database/manifest.json']['sha256']:raise RuntimeError('SOURCE_CATALOG_CHANGED')
    left=cap.read(dbpath)['catalog'];right=cap.read(C/'catalog-diagnostic-current.json')
    evidence=cap.read(C/'catalog-diagnostic-differences.json')
    closure=cap.read(C/'catalog-diagnostic-closure.json')
    if closure['catalogDiagnosticClosure']!='PASS' or closure['restoreCluster']!='STOPPED':raise RuntimeError('DIAGNOSTIC_NOT_CLOSED')
    rows=[]
    for item in evidence['allDifferences']:
        match=re.fullmatch(r'/constraints/([0-9]+)/definition',item['field'])
        if not match:continue
        index=int(match.group(1));a=left['constraints'][index];b=right['constraints'][index]
        if (a['table'],a['name'])!=(b['table'],b['name']):raise RuntimeError('CONSTRAINT_IDENTITY_DIFFERS')
        for value,key in ((a['definition'],'sourceSha256'),(b['definition'],'restoredSha256')):
            if hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()!=item[key]:raise RuntimeError('SAVED_DIFFERENCE_CHANGED')
        rows.append({'table':a['table'],'constraint':a['name'],'sourceDefinition':a['definition'],'restoredDefinition':b['definition']})
    if len(rows)!=6:raise RuntimeError('CONSTRAINT_DIFF_COUNT_CHANGED')
    print(json.dumps({'diagnostic':'READ_ONLY_SAVED_CONSTRAINT_DEFINITIONS','setId':S,'differences':rows,
        'clusterStarted':False,'restoreRepeated':False,'writes':'NONE','smtpCalls':0,'telegramCalls':0}))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'diagnostic':'STOP','reason':reason,'writes':'NONE','clusterStarted':False,'restoreRepeated':False}))
    sys.exit(1)
PY_SAVED_CONSTRAINT_DIFFS
```


## Current checkpoint — dump restored; strict catalog mismatch STOP; closure PASS

Returned helper5fb296f9... proves closure permission repair PASS/contents unchanged.
Unit invocation66133792f28045ce89f45b6ed23fdae9 stopped VERIFY_RESTORED_DATABASE /
RESTORED_CATALOG_MISMATCH after3.233s. Source control flow reaches this check only
after successful single-transaction pg_restore and database-ACL application. This
is restored data, not an accepted DB recovery proof. Returned closure PASS: isolated
cluster STOPPED, ancestors0700, staging online, reminder timer OFF/campaigns0,
SMTP/Telegram0. No restore rerun or new destination is proposed.

Next bounded diagnosis imports the installed hash-pinned helper, rechecks downloaded
B2 manifest/bytes and original private failed unit/closure, matches PG16 existing
pgdata/socket ownership and saved parent ACL inode identities, then temporarily
starts only this same cluster without TCP and default_transaction_read_only=on.
It SELECTs the captured catalogue, saves the full current catalogue privately and
prints differing sections/field paths; owner/ACL metadata is shown, SQL definitions
and defaults only hashed. Text/row-order-only equality is a diagnostic hint, not a
waived ACL check. No table/role/ACL/schema mutation or pg_restore; private runtime,
logs, attempt/evidence and temporary ancestor ACL are written as operational proof.
Separate catalog-diagnostic unit/claim/closure;UMask0077,300s/25s,KillMode control-group
and ExecStopPost enforce private-cluster stop and ancestor0700 restoration. Never
reset previous attempts; on error retain evidence and STOP/manual review. PG/application
acceptance remains NOT_PROVEN until remaining comparisons and reads pass.

8 new affected synthetic diagnostic tests plus complete installer source/hash/guard
and Python/shell syntax PASS; old28 restore tests and accepted capture/B2/reminder/
timeout proofs reused. PENDING_OPERATOR_COMMAND_CATALOG_DIAGNOSTIC; no privileged
operation executed by Codex. Existing B2/production/freshness/Telegram/scanner/producer/
keys unchanged; no automatic staging schedule, email, snapshot/business deletion,
commit or push. Private filesystem proof is not Supabase/full application recovery.

<!-- BEGIN RESTORED_CATALOG_DIAGNOSTIC_VPS -->
### Historical catalogue diagnostic — completed; do not rerun

Run once. Expected READ_ONLY_RESTORED_CATALOG_COMPLETE with actual section/field differences (no assumed cause),restoreRepeated false,schema/business writes NONE,TCPfalse;then catalogDiagnosticClosure PASS/cluster STOPPED/ancestors0700/staging online/timers campaignsOFF. Any STOP:retain output, no retry.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_DATABASE_RESTORE'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='07dce4ea1391b55a600931b91aca0a15a7e5046d7740b310b4fd65afe5f0fa24'
SOURCE=r'''"""Read-only SQL diagnosis of an already restored private cluster; never re-restore."""
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
'''
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    body=SOURCE.encode()
    if hashlib.sha256(body).hexdigest()!=PIN:raise RuntimeError('REVIEWED_SOURCE_HASH')
    compile(body,'reviewed-restore','exec')
    path=ROOT/'operator'/('diagnose-catalog-'+PIN+'.py')
    if path.exists() or path.is_symlink():raise RuntimeError('RESTORE_HELPER_EXISTS_MANUAL_REVIEW')
    unit='passvero-stage-restore-20261001T212354Z-catalog-diagnostic.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('RESTORE_UNIT_EXISTS_MANUAL_REVIEW')
    with open(path,'xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    print(json.dumps({'catalogDiagnosticHelper':'REVIEWED_INSTALLED','sourceSha256':PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=UMask=0077','--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'catalogDiagnosticInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_DATABASE_RESTORE
```
<!-- END RESTORED_CATALOG_DIAGNOSTIC_VPS -->


## Current checkpoint — PRIVATE_PATH cause confirmed; private-closure repair ready

Returned READ_ONLY_RESTORE_PRIVATE_PATH checked33 paths: the only failures are
originalClosure and stdlibClosure, regular root-owned0644. No restore attempt,
pgdata, socket directory or ACL baseline exists; writes/providers0. Actual defect
confirmed: prior ExecStopPost lacked a process umask and unit UMask. This was not
a DB, Storage, offsite or ACL-xattr failure; none of those new restore operations ran.

Minimum repair: explicitly os.umask077 in close(), unit UMask0077, and a guarded
one-time0644→0600 repair of exactly the two non-secret retained closure JSONs.
Both full JSON values must match accepted closure exactly, ownerroot/regular/single
link/mode0644/size<8192 via O_NOFOLLOW-held descriptors. Previous stdlib unit result,
invocation d3b214d0c90944acb5be57f7656da545 and helper hash must match; no attempt/
pgdata/socket/ACL baseline may exist. Record both before hashes privately before
fchmod; verify bytes/inode/device/owner unchanged. No validator weakening, generic
chmod, secret reading, package install, old helper or unit reset. Original closure
bytes are preserved. Any unexpected condition STOP/manual review; never auto retry.

Reviewed new helper5fb296f96c37fb3ebfb681f534e6df01cf392c9fb8b993c322f696d20794fd0f;
new unit passvero-stage-restore-20261001T212354Z-private.service;300s/25s/control-group
limits and separate ExecStopPost retained. New restore-closure-private.json, old
closures retained. Named postgres execute-only ACL and inode-bound cleanup unchanged.
28 affected synthetic tests PASS, including start-close-with-umask022→0600 regression,
content/mode/unit/claim rejection and bytes-preserved two-file repair. Complete
installer exact-source/hash, UMask property, shell/Python syntax PASS. Live repair/
PG/application reads NOT_YET_RUN; PENDING_OPERATOR_COMMAND_PRIVATE_DATABASE_RESTORE.

Reuse accepted actual B2 snapshot2c317b57.../5objects/all964172 bytes, capture3.034s,
independent timeout proof and reminders4 receipts/replay0/cancelled2. Staging remains
online per latest accepted closure; timer/campaigns OFF. No new capture, B2 upload,
email, Telegram, production job/freshness/schedule/credential/scanner/producer change,
automatic staging schedule, deletion, commit or push. Private filesystem proof still
does not imply Supabase or full service recovery. Application read follows DB proof.

<!-- BEGIN PRIVATE_CLOSURE_DATABASE_RESTORE_VPS -->
### Historical private restore block — catalog mismatch STOP; do not rerun

Run once. Expected closurePermissionRepair PASS_TWO_FILES_0644_TO_0600/contentsUnchanged true; then databaseRestore PASS_REAL_B2_DOWNLOADED_DUMP;tables51;migrations31;catalog/ACL/counts/sequences MATCH;TCPfalse; then restoreClosure PASS/cluster STOPPED/parents0700/staging ONLINE_UNPAUSED/timerOFF/campaigns0. On STOP retain output, do not rerun.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_DATABASE_RESTORE'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='5fb296f96c37fb3ebfb681f534e6df01cf392c9fb8b993c322f696d20794fd0f'
SOURCE=r'''"""Restore only the verified B2 download into a new private socket-only PG16 cluster."""
import datetime
import contextlib
import errno
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import stat
import struct
import subprocess
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET = '20261001T212354Z'
SNAPSHOT = '2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2'
REPOSITORY = '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35'
MANIFEST = '2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132'
CAPTURE = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PG = '/usr/lib/postgresql/16/bin/'
DB = 'passvero_staging_recovery'
TARGET = ROOT / 'restore' / SET
DATA = TARGET / 'pgdata'
SOCKET = TARGET / 'socket'
CONTROL = ROOT / 'control' / SET
PHASE = 'RESTORE_PREFLIGHT'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'PGAPPNAME': 'passvero_isolated_recovery'}

class Stop(Exception):
    pass

def require(value, reason):
    if not value:
        raise Stop(reason)

def quote(value):
    require(isinstance(value, str) and '\0' not in value, 'SQL_IDENTIFIER')
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    require(isinstance(value, str) and '\0' not in value and '\\' not in value, 'SQL_LITERAL')
    return "'" + value.replace("'", "''") + "'"

def run(args, data=None, account=None, timeout=30):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout,
                            env=ENV, **(account or {}))
    require(result.returncode == 0, 'COMMAND_' + pathlib.Path(args[0]).name.upper().replace('-', '_') + '_FAILED')
    require(len(result.stdout) <= 32 * 1024 ** 2, 'COMMAND_RESPONSE_SIZE')
    return result.stdout

def cap_module():
    path = ROOT / 'operator' / ('capture-' + CAPTURE + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077
            and hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE, 'CAPTURE_IDENTITY')
    spec = importlib.util.spec_from_file_location('restore_capture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def sql(text, database=DB, readonly=True):
    prefix = "BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; " if readonly else ''
    output = run([PG+'psql', '-XqAt', '-h', str(SOCKET), '-p', '55434', '-U', 'postgres',
                  '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', prefix+text])
    return json.loads(output) if readonly else output

def verify_download(cap):
    proof = cap.read(TARGET / 'download-proof.json')
    require(proof['offsite'] == 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED'
            and proof['snapshotId'] == SNAPSHOT and proof['repositoryId'] == REPOSITORY
            and proof['manifestSha256'] == MANIFEST and proof['setId'] == SET,
            'OFFSITE_PROOF_IDENTITY')
    source = TARGET / 'download' / (ROOT / 'sets' / SET).relative_to('/')
    require(hashlib.sha256((source/'recovery-set.json').read_bytes()).hexdigest() == MANIFEST,
            'DOWNLOADED_MANIFEST_CHANGED')
    manifest = cap.read(source/'recovery-set.json')
    expected = manifest['files']
    found = set()
    for path in source.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'DOWNLOAD_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if path.is_file():found.add(str(path.relative_to(source)))
    require(found == set(expected) | {'recovery-set.json'}, 'DOWNLOAD_INVENTORY')
    for name, item in expected.items():
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,
                'DOWNLOAD_PATH')
        path = source/name
        require(path.stat().st_size == item['bytes']
                and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], 'DOWNLOAD_CHECKSUM')
    require(sum((source/name).stat().st_size for name in found) == 964172, 'PAYLOAD_CHANGED')
    return source

def role_sql(rows):
    statements = []
    for row in rows:
        name = row['name']
        require(re.fullmatch('passvero_[a-z0-9_]+', name) and not row['superuser'], 'SOURCE_ROLE_SCOPE')
        # No role password is restored. Local peer rules reject these roles; only postgres connects.
        flags = ['NOSUPERUSER', 'INHERIT' if row['inherit'] else 'NOINHERIT',
                 'CREATEROLE' if row['createRole'] else 'NOCREATEROLE',
                 'CREATEDB' if row['createDb'] else 'NOCREATEDB',
                 'LOGIN' if row['login'] else 'NOLOGIN',
                 'BYPASSRLS' if row['bypassRls'] else 'NOBYPASSRLS']
        statements.append('CREATE ROLE '+quote(name)+' '+' '.join(flags)+';')
    return '\n'.join(statements)

def database_acl(value, apply=False):
    if value is None:return None
    rows = sql("SELECT coalesce(json_agg(json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable) ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json) FROM aclexplode("+literal(value)+"::aclitem[])")
    if apply:
        owner = sql("SELECT to_json(pg_get_userbyid(datdba)) FROM pg_database WHERE datname=current_database()")
        sql('REVOKE ALL ON DATABASE '+quote(DB)+' FROM PUBLIC, '+quote(owner),readonly=False)
        for row in rows:
            require(row['privilege'] in ('CONNECT','CREATE','TEMPORARY'), 'DATABASE_PRIVILEGE')
            for key in ('grantor','grantee'):
                require(row[key] in ('postgres','PUBLIC') or re.fullmatch('passvero_[a-z0-9_]+',row[key]), 'DATABASE_ACL_ROLE')
            target = 'PUBLIC' if row['grantee']=='PUBLIC' else quote(row['grantee'])
            sql('SET ROLE '+quote(row['grantor'])+'; GRANT '+row['privilege']+' ON DATABASE '+quote(DB)+' TO '+target+
                (' WITH GRANT OPTION' if row['option'] else '')+'; RESET ROLE;',readonly=False)
    return sorted(rows,key=lambda r:(r['grantor'],r['grantee'],r['privilege'],r['option']))

ACL_NAME = 'system.posix_acl_access'

def get_acl(path):
    try:return os.getxattr(path, ACL_NAME, follow_symlinks=False)
    except OSError as error:
        if error.errno == errno.ENODATA:return None
        raise

def traversal_acl(uid):
    require(type(uid) is int and 0 < uid < 0xffffffff, 'POSTGRES_UID')
    return struct.pack('<I',2)+b''.join(struct.pack('<HHI',tag,perm,identity) for tag,perm,identity in
        ((1,7,0xffffffff),(2,1,uid),(4,0,0xffffffff),(16,1,0xffffffff),(32,0,0xffffffff)))

def acl_baseline(parents):
    rows=[]
    for path in parents:
        info=path.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700,
                'PRIVATE_PARENT_IDENTITY')
        require(get_acl(path) is None,'EXISTING_PARENT_ACL_REQUIRES_REVIEW')
        rows.append({'path':str(path),'device':info.st_dev,'inode':info.st_ino,'uid':info.st_uid,
                     'gid':info.st_gid,'mode':0o700})
    return rows

def restore_parents(rows, uid):
    require([row['path'] for row in rows] == [str(ROOT),str(ROOT/'restore'),str(TARGET)], 'ACL_RESTORE_SCOPE')
    errors=[]
    for row in rows:
        try:
            path=pathlib.Path(row['path']);info=path.lstat()
            require(stat.S_ISDIR(info.st_mode) and (info.st_dev,info.st_ino,info.st_uid,info.st_gid) ==
                    (row['device'],row['inode'],row['uid'],row['gid']) and row['mode']==0o700,
                    'ACL_PARENT_CHANGED')
            current=get_acl(path)
            require(current in (None,traversal_acl(uid)),'ACL_PARENT_UNEXPECTED')
            if current is not None:os.removexattr(path,ACL_NAME,follow_symlinks=False)
            os.chmod(path,0o700,follow_symlinks=False)
            require(get_acl(path) is None and stat.S_IMODE(path.lstat().st_mode)==0o700,'ACL_CLOSE_VERIFY')
        except Exception:errors.append(row['path'])
    require(not errors,'ACL_PARENT_CLOSURE_FAILED')

def prior_preflight_stop(cap):
    previous=ROOT/'operator'/'restore-database-15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034.py'
    cap.private(previous)
    require(hashlib.sha256(previous.read_bytes()).hexdigest() == '15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034','PRIOR_HELPER_CHANGED')
    closure=cap.read(CONTROL/'restore-closure.json')
    require(closure['restoreClosure']=='PASS' and closure['restoreCluster']=='STOPPED'
            and closure['parentPermissions']=='PRIVATE_0700_RESTORED','PRIOR_CLOSURE')
    properties=run(['/usr/bin/systemctl','show','passvero-stage-restore-20261001T212354Z.service',
                    '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode()
    values=dict(line.split('=',1) for line in properties.splitlines() if '=' in line)
    require(values == {'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                       'InvocationID':'e2d37c7e744149efb0afbe3ea63f76c8'},'PRIOR_UNIT_CHANGED')
    require(not (CONTROL/'restore-attempt.json').exists() and not (CONTROL/'restore-parent-acl.txt').exists(),
            'PRIOR_RESTORE_MUTATION_FOUND')

def repair_closure_permissions(cap):
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists()
            and not (CONTROL/'restore-parent-acl-stdlib.json').exists(), 'PREVIOUS_RESTORE_MUTATION_FOUND')
    unit='passvero-stage-restore-20261001T212354Z-acl-stdlib.service'
    values=dict(line.split('=',1) for line in run(['/usr/bin/systemctl','show',unit,
        '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode().splitlines() if '=' in line)
    require(values=={'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                     'InvocationID':'d3b214d0c90944acb5be57f7656da545'},'STDLIB_PRIOR_UNIT_CHANGED')
    previous=ROOT/'operator'/'restore-database-9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7.py'
    cap.private(previous)
    require(hashlib.sha256(previous.read_bytes()).hexdigest()=='9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7','STDLIB_PRIOR_HELPER_CHANGED')
    expected={'restoreClosure':'PASS','setId':SET,'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED','staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE','campaignsEnabled':0,
              'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
    with contextlib.ExitStack() as stack:
        files=[]
        for name in ('restore-closure.json','restore-closure-stdlib.json'):
            fd=os.open(CONTROL/name,os.O_RDONLY|os.O_NOFOLLOW)
            stack.callback(os.close,fd)
            info=os.fstat(fd)
            require(stat.S_ISREG(info.st_mode) and info.st_uid==0 and info.st_nlink==1
                    and stat.S_IMODE(info.st_mode)==0o644 and info.st_size<8192,'CLOSURE_REPAIR_POSTURE')
            body=os.read(fd,8192)
            require(json.loads(body)==expected,'CLOSURE_REPAIR_CONTENT')
            files.append((name,fd,body,info))
        cap.write(CONTROL/'closure-permission-repair.json',{'setId':SET,'scope':'TWO_NONSECRET_CLOSURE_FILES_ONLY',
            'files':[{'name':name,'beforeMode':'0644','afterMode':'0600','sha256':hashlib.sha256(body).hexdigest()}
                     for name,fd,body,info in files]})
        for name,fd,body,info in files:
            os.fchmod(fd,0o600)
            os.lseek(fd,0,os.SEEK_SET)
            after=os.fstat(fd)
            require(os.read(fd,8192)==body and stat.S_IMODE(after.st_mode)==0o600
                    and (after.st_ino,after.st_dev,after.st_uid)==(info.st_ino,info.st_dev,info.st_uid),
                    'CLOSURE_REPAIR_VERIFY')
    print(json.dumps({'closurePermissionRepair':'PASS_TWO_FILES_0644_TO_0600',
                      'contentsUnchanged':True,'stagingPauseRequested':False}),flush=True)

def close():
    """ExecStopPost runs after systemd has terminated every process in this private unit."""
    os.umask(0o077)
    cap = cap_module()
    saved = CONTROL/'restore-parent-acl-stdlib.json'
    if saved.exists():
        state=cap.read(saved)
        restore_parents(state['parents'],state['postgresUid'])
    for path in (ROOT, ROOT/'restore', TARGET):cap.private(path, True)
    active = []
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry/'cmdline').read_bytes().split(b'\0')
                if str(DATA).encode() in args and args and args[0] == (PG+'postgres').encode():
                    active.append(entry.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):pass
    require(not active, 'RESTORE_CLUSTER_STILL_RUNNING')
    prepare, _ = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    result = {'restoreClosure':'PASS', 'setId':SET, 'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED', 'staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE', 'campaignsEnabled':0,
              'artifactsRetained':True, 'smtpCalls':0, 'telegramCalls':0}
    cap.write(CONTROL/'restore-closure-private.json', result)
    print(json.dumps(result))

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap_module()
    cap.validate_context(SET)
    for path in (ROOT/'restore', TARGET):cap.private(path, True)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    repair_closure_permissions(cap)
    prior_preflight_stop(cap)
    source = verify_download(cap)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4*1024**3, 'FREE_SPACE_LIMIT')
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists(), 'RESTORE_ALREADY_ATTEMPTED')
    for executable in ('initdb','pg_ctl','pg_restore','psql'):
        require(' 16.' in run([PG+executable,'--version']).decode(), 'PG16_BINARY')
    parents = [ROOT, ROOT/'restore', TARGET]
    acl = acl_baseline(parents)
    meta = cap.read(source/'database/manifest.json')
    owner = meta['catalog']['database']['owner']
    require(owner in {row['name'] for row in meta['catalog']['roles']}, 'DATABASE_OWNER_NOT_CAPTURED')
    require(meta['catalog']['database']['encoding'] == 'UTF8', 'DATABASE_ENCODING')
    role_commands = role_sql(meta['catalog']['roles'])
    cap.write(CONTROL/'restore-attempt.json', {'setId':SET,'snapshotId':SNAPSHOT,'automaticRetry':False})
    postgres = pwd.getpwnam('postgres')
    account = prepare.account('postgres')
    cap.write(CONTROL/'restore-parent-acl-stdlib.json', {'parents':acl,'postgresUid':postgres.pw_uid})
    # Same execute-only named-user ACL as setfacl; direct Linux xattr, no package dependency.
    for path in parents:
        os.setxattr(path,ACL_NAME,traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(get_acl(path)==traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    for path in (DATA,SOCKET):
        path.mkdir(mode=0o700)
        os.chown(path,postgres.pw_uid,postgres.pw_gid)
    PHASE = 'INITIALIZE_NEW_PRIVATE_PG16'
    run([PG+'initdb','-D',str(DATA),'--no-clean','--encoding=UTF8','--locale-provider=libc',
         '--lc-collate='+meta['catalog']['database']['collate'],
         '--lc-ctype='+meta['catalog']['database']['ctype'],'--auth-local=peer','--auth-host=reject'],
        account=account,timeout=90)
    # Only local root/postgres can authenticate as postgres. No trust/passwords or TCP listener.
    (DATA/'pg_ident.conf').write_text('recovery_operator root postgres\nrecovery_operator postgres postgres\n')
    (DATA/'pg_hba.conf').write_text('local all postgres peer map=recovery_operator\nlocal all all reject\n')
    for name in ('pg_ident.conf','pg_hba.conf'):
        os.chown(DATA/name,postgres.pw_uid,postgres.pw_gid)
        (DATA/name).chmod(0o600)
    run([PG+'pg_ctl','-D',str(DATA),'-l',str(DATA/'restore.log'),'-w','-t','30','start','-o',
         "-c listen_addresses='' -c port=55434 -c unix_socket_directories="+str(SOCKET)+
         ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'],account=account)
    PHASE = 'RESTORE_DATABASE_OWNERS_AND_ACLS'
    settings = sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'))",database='postgres')
    require(settings == {'data':str(DATA),'tcp':'','port':'55434'}, 'ISOLATED_CLUSTER_IDENTITY')
    sql(role_commands,database='postgres',readonly=False)
    sql('CREATE DATABASE '+quote(DB)+' OWNER '+quote(owner)+" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE "+
        literal(meta['catalog']['database']['collate'])+' LC_CTYPE '+literal(meta['catalog']['database']['ctype']),database='postgres',readonly=False)
    # Stream the root-private downloaded dump; preserve ownership/ACLs. Never --clean/--create/no-owner/no-acl.
    with open(source/'database/passvero_acceptance.dump','rb') as dump:
        result = subprocess.run([PG+'pg_restore','--exit-on-error','--single-transaction','-h',str(SOCKET),
            '-p','55434','-U','postgres','-d',DB],stdin=dump,capture_output=True,env=ENV,timeout=120)
    require(result.returncode == 0, 'PG_RESTORE_FAILED')
    database_acl(meta['catalog']['database']['acl'],apply=True)
    PHASE = 'VERIFY_RESTORED_DATABASE'
    current = sql(cap.CATALOG)
    # CREATE DATABASE is intentionally renamed. Database-level ACL has a separate explicit check below.
    require({k:v for k,v in current.items() if k != 'database'} ==
            {k:v for k,v in meta['catalog'].items() if k != 'database'}, 'RESTORED_CATALOG_MISMATCH')
    tables = sql(cap.TABLES)
    counts = {name:sql('SELECT count(*) FROM '+cap.identifier(name)) for name in tables}
    require(counts == meta['counts'], 'RESTORED_COUNTERS_MISMATCH')
    require(sql(cap.SEQUENCES) == meta['sequences'], 'RESTORED_SEQUENCES_MISMATCH')
    assets = sql(references.QUERY)
    storage = cap.read(source/'storage/manifest.json')
    require(assets['enabledCampaigns'] == 0 and assets['references'] == storage['references'], 'RESTORED_ASSET_REFERENCES')
    require(references.reconcile(storage['objects'],assets['references']) == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    require(current['database']['owner'] == owner and all(current['database'][k] == meta['catalog']['database'][k]
            for k in ('encoding','collate','ctype')), 'RESTORED_DATABASE_SETTINGS')
    require(database_acl(current['database']['acl']) == database_acl(meta['catalog']['database']['acl']),
            'RESTORED_DATABASE_ACL_MISMATCH')
    result = {'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP', 'setId':SET,'snapshotId':SNAPSHOT,
        'database':DB,'tables':len(tables),'migrations':len(current['migrations']),
        'catalogOwnersAndAcls':'MATCH','databaseAcl':'MATCH_SEMANTIC_PRIVILEGES','allTableCounters':'MATCH',
        'sequences':'MATCH','databaseAssetReferences':len(assets['references']),
        'storageObjects':len(storage['objects']),'acceptedCleanupTombstones':4,
        'tcpListener':False,'isolatedApplicationRead':'NOT_YET_RUN','storageProviderRestore':'NOT_PERFORMED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'automaticRetry':False}
    prepare.runtime()
    cap.gates(prepare)
    cap.write(CONTROL/'database-restore-summary.json',result)
    print(json.dumps(result),flush=True)
    PHASE = 'STOP_PRIVATE_RESTORE_CLUSTER'
    run([PG+'pg_ctl','-D',str(DATA),'-m','fast','-w','-t','20','stop'],account=account)

if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--close']:close()
        else:
            signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(Stop('OPERATOR_INTERRUPTED')))
            main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
        result = {'databaseRestore':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
                  'stagingPauseRequested':False,'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
        print(json.dumps(result),flush=True)
        sys.exit(1)
'''
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    body=SOURCE.encode()
    if hashlib.sha256(body).hexdigest()!=PIN:raise RuntimeError('REVIEWED_SOURCE_HASH')
    compile(body,'reviewed-restore','exec')
    path=ROOT/'operator'/('restore-database-'+PIN+'.py')
    if path.exists() or path.is_symlink():raise RuntimeError('RESTORE_HELPER_EXISTS_MANUAL_REVIEW')
    unit='passvero-stage-restore-20261001T212354Z-private.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('RESTORE_UNIT_EXISTS_MANUAL_REVIEW')
    with open(path,'xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    print(json.dumps({'restoreHelper':'REVIEWED_INSTALLED','sourceSha256':PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=UMask=0077','--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'restoreInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_DATABASE_RESTORE
```
<!-- END PRIVATE_CLOSURE_DATABASE_RESTORE_VPS -->


## Current checkpoint — PRIVATE_PATH preflight STOP; closure PASS; read-only diagnosis pending

Returned stdlib helper9e092b11... unit invocation d3b214d0c90944acb5be57f7656da545
stopped RESTORE_PREFLIGHT/PRIVATE_PATH after353ms. Closure PASS: cluster stopped,
parents0700, stage online, timer OFF/campaigns0, SMTP/Telegram0. Accepted B2 retrieval
and capture remain unchanged; no automatic restore retry. Source review identifies
an unconfirmed hypothesis: separate ExecStopPost process does not set os.umask077,
and the unit does not specify UMask0077, so prior closure JSON may be0644 and rejected
by cap.read/private. Do not change rights or loosen validators on that hypothesis.
A bounded read-only lstat inventory is the next operator command; no contents of
secrets, no SQL/Storage/B2/network provider calls, no pause or restore. It identifies
exact private-path failures and existence of attempt/pgdata/ACL baseline. Await
actual output before a repair/continuation. Prior22 synthetic tests reused; diagnostic
Python/shell syntax PASS. No source/helper edits, commit, push or deletion this turn.

### Historical read-only diagnostic — returned cause confirmed

Expected diagnostic READ_ONLY_RESTORE_PRIVATE_PATH; measured path modes and failure labels;writes NONE;restoreExecuted false. No predetermined cause is claimed.

```sh
sudo /usr/bin/python3 -B - <<'PY_RESTORE_PATH_DIAGNOSTIC'
import json,os,pathlib,stat
R=pathlib.Path('/var/lib/passvero-staging-recovery')
S='20261001T212354Z'
T=R/'restore'/S
C=R/'control'/S
assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
checks=[]
def check(label,path,directory=False):
    try:
        v=path.lstat()
        kind='directory' if stat.S_ISDIR(v.st_mode) else 'regular' if stat.S_ISREG(v.st_mode) else 'symlink' if stat.S_ISLNK(v.st_mode) else 'special'
        good=v.st_uid==0 and not v.st_mode&0o077 and kind==('directory' if directory else 'regular')
        checks.append({'label':label,'exists':True,'uid':v.st_uid,'mode':oct(stat.S_IMODE(v.st_mode)),'kind':kind,'privatePathPass':bool(good)})
    except FileNotFoundError:checks.append({'label':label,'exists':False,'privatePathPass':False})
for label,path,directory in [
    ('root',R,True),('operatorIdentity',R/'operator.identity.json',False),
    ('capturedSet',R/'sets'/S,True),('control',C,True),
    ('restoreRoot',R/'restore',True),('restoreTarget',T,True),
    ('originalRestoreHelper',R/'operator/restore-database-15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034.py',False),
    ('stdlibRestoreHelper',R/'operator/restore-database-9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7.py',False),
    ('originalClosure',C/'restore-closure.json',False),
    ('stdlibClosure',C/'restore-closure-stdlib.json',False),
    ('downloadProof',T/'download-proof.json',False)]:check(label,path,directory)
source=T/'download'/(R/'sets'/S).relative_to('/')
check('downloadedSet',source,True)
if source.is_dir() and not source.is_symlink():
    for i,path in enumerate(source.rglob('*')):
        if i>=10000:raise RuntimeError('INVENTORY_LIMIT')
        check('downloadedSet/'+str(path.relative_to(source)),path,path.is_dir() and not path.is_symlink())
print(json.dumps({'diagnostic':'READ_ONLY_RESTORE_PRIVATE_PATH','setId':S,'privatePathFailures':[row for row in checks if not row['privatePathPass']],
 'closurePosture':[row for row in checks if row['label'] in ('originalClosure','stdlibClosure')],
 'checkedPaths':len(checks),'restoreAttemptExists':(C/'restore-attempt.json').exists(),
 'pgdataExists':(T/'pgdata').exists(),'socketDirectoryExists':(T/'socket').exists(),
 'aclBaselineExists':(C/'restore-parent-acl-stdlib.json').exists(),
 'writes':'NONE','restoreExecuted':False,'stagingPauseRequested':False,'b2Calls':0,'smtpCalls':0,'telegramCalls':0}))
PY_RESTORE_PATH_DIAGNOSTIC
```


## Current checkpoint — PG preflight STOP; closure PASS; reviewed ACL continuation

Returned database restore STOP: RESTORE_PREFLIGHT / ACL_TOOL_UNAVAILABLE.
Original helper15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034 remains installed and retained.
Unit passvero-stage-restore-20261001T212354Z.service / invocation
e2d37c7e744149efb0afbe3ea63f76c8 exited1 after539ms. Returned closure PASS:
cluster STOPPED;parent0700;staging ONLINE_UNPAUSED;timer disabled/inactive;campaigns0;
SMTP/Telegram0. Source ordering places missing-tool STOP before attempt/ACL/pgdata
writes. The continuation checks original source hash, unit result/invocation, retained
closure and absence of attempt/pgdata/old ACL backup before proceeding; no reset.

The only source repair replaces getfacl/setfacl with Python os.getxattr/setxattr/
removexattr for Linux system.posix_acl_access, according to kernel UAPI v2 tags and
little-endian encoding. No package installation, new dependency, chmod broadening,
production configuration or credential permission change. Existing extended parent
ACL remains STOP. Named postgres entry grants execute only, group/other0; original
three parents' inode/device/uid/gid/mode are saved privately. ExecStopPost verifies
identity and expected ACL before removal/restoring0700; it attempts all three even
if one fails and reports a closure error rather than claiming success. Existing
preflight closure retained, new restore-closure-stdlib.json written exclusively.
Reviewed continuation source9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7;
new transient unit suffix -acl-stdlib;300s runtime/25s stop/KillMode control-group
unchanged. Any actual attempt failure remains STOP, no automatic retry.

22 affected synthetic tests PASS; complete installer source/hash fixture and shell/
Python syntax PASS. Linux ACL operations are mocked locally; live Linux/PG restore
remains NOT_YET_RUN. Already accepted B2 snapshot2c317b57.../bytes964172/5objects,
capture3.034s/resume, independent timeout and reminder4 receipts/replay0/cancelled2
are reused. No B2 transfer, capture pause, email or Telegram acceptance repeated.
Existing production jobs/freshness/schedules/keys/scanner/producer unchanged. No
automatic staging schedule, commit, push or deletion. Isolated application read
remains pending after DB proof; private filesystem proof is not Supabase recovery.

<!-- BEGIN PRIVATE_DATABASE_RESTORE_STDLIB_VPS -->
### Historical stdlib restore block — PRIVATE_PATH STOP; do not rerun

Copy entire block once. Expected databaseRestore PASS_REAL_B2_DOWNLOADED_DUMP;tables51;migrations31;catalog/ACL/counts/sequences MATCH;TCPfalse. Then restoreClosure PASS;cluster STOPPED;parents0700;staging ONLINE_UNPAUSED;timers/campaigns OFF. Missing/changed previous evidence, extended ACL or any error means STOP/manual review.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_DATABASE_RESTORE'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='9e092b115fe1d60e3497e39a714935b02fc9063b1fd241e2609c96199d7fd2d7'
SOURCE=r'''"""Restore only the verified B2 download into a new private socket-only PG16 cluster."""
import datetime
import errno
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import stat
import struct
import subprocess
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET = '20261001T212354Z'
SNAPSHOT = '2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2'
REPOSITORY = '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35'
MANIFEST = '2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132'
CAPTURE = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PG = '/usr/lib/postgresql/16/bin/'
DB = 'passvero_staging_recovery'
TARGET = ROOT / 'restore' / SET
DATA = TARGET / 'pgdata'
SOCKET = TARGET / 'socket'
CONTROL = ROOT / 'control' / SET
PHASE = 'RESTORE_PREFLIGHT'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'PGAPPNAME': 'passvero_isolated_recovery'}

class Stop(Exception):
    pass

def require(value, reason):
    if not value:
        raise Stop(reason)

def quote(value):
    require(isinstance(value, str) and '\0' not in value, 'SQL_IDENTIFIER')
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    require(isinstance(value, str) and '\0' not in value and '\\' not in value, 'SQL_LITERAL')
    return "'" + value.replace("'", "''") + "'"

def run(args, data=None, account=None, timeout=30):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout,
                            env=ENV, **(account or {}))
    require(result.returncode == 0, 'COMMAND_' + pathlib.Path(args[0]).name.upper().replace('-', '_') + '_FAILED')
    require(len(result.stdout) <= 32 * 1024 ** 2, 'COMMAND_RESPONSE_SIZE')
    return result.stdout

def cap_module():
    path = ROOT / 'operator' / ('capture-' + CAPTURE + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077
            and hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE, 'CAPTURE_IDENTITY')
    spec = importlib.util.spec_from_file_location('restore_capture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def sql(text, database=DB, readonly=True):
    prefix = "BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; " if readonly else ''
    output = run([PG+'psql', '-XqAt', '-h', str(SOCKET), '-p', '55434', '-U', 'postgres',
                  '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', prefix+text])
    return json.loads(output) if readonly else output

def verify_download(cap):
    proof = cap.read(TARGET / 'download-proof.json')
    require(proof['offsite'] == 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED'
            and proof['snapshotId'] == SNAPSHOT and proof['repositoryId'] == REPOSITORY
            and proof['manifestSha256'] == MANIFEST and proof['setId'] == SET,
            'OFFSITE_PROOF_IDENTITY')
    source = TARGET / 'download' / (ROOT / 'sets' / SET).relative_to('/')
    require(hashlib.sha256((source/'recovery-set.json').read_bytes()).hexdigest() == MANIFEST,
            'DOWNLOADED_MANIFEST_CHANGED')
    manifest = cap.read(source/'recovery-set.json')
    expected = manifest['files']
    found = set()
    for path in source.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'DOWNLOAD_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if path.is_file():found.add(str(path.relative_to(source)))
    require(found == set(expected) | {'recovery-set.json'}, 'DOWNLOAD_INVENTORY')
    for name, item in expected.items():
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,
                'DOWNLOAD_PATH')
        path = source/name
        require(path.stat().st_size == item['bytes']
                and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], 'DOWNLOAD_CHECKSUM')
    require(sum((source/name).stat().st_size for name in found) == 964172, 'PAYLOAD_CHANGED')
    return source

def role_sql(rows):
    statements = []
    for row in rows:
        name = row['name']
        require(re.fullmatch('passvero_[a-z0-9_]+', name) and not row['superuser'], 'SOURCE_ROLE_SCOPE')
        # No role password is restored. Local peer rules reject these roles; only postgres connects.
        flags = ['NOSUPERUSER', 'INHERIT' if row['inherit'] else 'NOINHERIT',
                 'CREATEROLE' if row['createRole'] else 'NOCREATEROLE',
                 'CREATEDB' if row['createDb'] else 'NOCREATEDB',
                 'LOGIN' if row['login'] else 'NOLOGIN',
                 'BYPASSRLS' if row['bypassRls'] else 'NOBYPASSRLS']
        statements.append('CREATE ROLE '+quote(name)+' '+' '.join(flags)+';')
    return '\n'.join(statements)

def database_acl(value, apply=False):
    if value is None:return None
    rows = sql("SELECT coalesce(json_agg(json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable) ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json) FROM aclexplode("+literal(value)+"::aclitem[])")
    if apply:
        owner = sql("SELECT to_json(pg_get_userbyid(datdba)) FROM pg_database WHERE datname=current_database()")
        sql('REVOKE ALL ON DATABASE '+quote(DB)+' FROM PUBLIC, '+quote(owner),readonly=False)
        for row in rows:
            require(row['privilege'] in ('CONNECT','CREATE','TEMPORARY'), 'DATABASE_PRIVILEGE')
            for key in ('grantor','grantee'):
                require(row[key] in ('postgres','PUBLIC') or re.fullmatch('passvero_[a-z0-9_]+',row[key]), 'DATABASE_ACL_ROLE')
            target = 'PUBLIC' if row['grantee']=='PUBLIC' else quote(row['grantee'])
            sql('SET ROLE '+quote(row['grantor'])+'; GRANT '+row['privilege']+' ON DATABASE '+quote(DB)+' TO '+target+
                (' WITH GRANT OPTION' if row['option'] else '')+'; RESET ROLE;',readonly=False)
    return sorted(rows,key=lambda r:(r['grantor'],r['grantee'],r['privilege'],r['option']))

ACL_NAME = 'system.posix_acl_access'

def get_acl(path):
    try:return os.getxattr(path, ACL_NAME, follow_symlinks=False)
    except OSError as error:
        if error.errno == errno.ENODATA:return None
        raise

def traversal_acl(uid):
    require(type(uid) is int and 0 < uid < 0xffffffff, 'POSTGRES_UID')
    return struct.pack('<I',2)+b''.join(struct.pack('<HHI',tag,perm,identity) for tag,perm,identity in
        ((1,7,0xffffffff),(2,1,uid),(4,0,0xffffffff),(16,1,0xffffffff),(32,0,0xffffffff)))

def acl_baseline(parents):
    rows=[]
    for path in parents:
        info=path.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700,
                'PRIVATE_PARENT_IDENTITY')
        require(get_acl(path) is None,'EXISTING_PARENT_ACL_REQUIRES_REVIEW')
        rows.append({'path':str(path),'device':info.st_dev,'inode':info.st_ino,'uid':info.st_uid,
                     'gid':info.st_gid,'mode':0o700})
    return rows

def restore_parents(rows, uid):
    require([row['path'] for row in rows] == [str(ROOT),str(ROOT/'restore'),str(TARGET)], 'ACL_RESTORE_SCOPE')
    errors=[]
    for row in rows:
        try:
            path=pathlib.Path(row['path']);info=path.lstat()
            require(stat.S_ISDIR(info.st_mode) and (info.st_dev,info.st_ino,info.st_uid,info.st_gid) ==
                    (row['device'],row['inode'],row['uid'],row['gid']) and row['mode']==0o700,
                    'ACL_PARENT_CHANGED')
            current=get_acl(path)
            require(current in (None,traversal_acl(uid)),'ACL_PARENT_UNEXPECTED')
            if current is not None:os.removexattr(path,ACL_NAME,follow_symlinks=False)
            os.chmod(path,0o700,follow_symlinks=False)
            require(get_acl(path) is None and stat.S_IMODE(path.lstat().st_mode)==0o700,'ACL_CLOSE_VERIFY')
        except Exception:errors.append(row['path'])
    require(not errors,'ACL_PARENT_CLOSURE_FAILED')

def prior_preflight_stop(cap):
    previous=ROOT/'operator'/'restore-database-15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034.py'
    cap.private(previous)
    require(hashlib.sha256(previous.read_bytes()).hexdigest() == '15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034','PRIOR_HELPER_CHANGED')
    closure=cap.read(CONTROL/'restore-closure.json')
    require(closure['restoreClosure']=='PASS' and closure['restoreCluster']=='STOPPED'
            and closure['parentPermissions']=='PRIVATE_0700_RESTORED','PRIOR_CLOSURE')
    properties=run(['/usr/bin/systemctl','show','passvero-stage-restore-20261001T212354Z.service',
                    '--property=Result,ExecMainStatus,ActiveState,InvocationID']).decode()
    values=dict(line.split('=',1) for line in properties.splitlines() if '=' in line)
    require(values == {'Result':'exit-code','ExecMainStatus':'1','ActiveState':'failed',
                       'InvocationID':'e2d37c7e744149efb0afbe3ea63f76c8'},'PRIOR_UNIT_CHANGED')
    require(not (CONTROL/'restore-attempt.json').exists() and not (CONTROL/'restore-parent-acl.txt').exists(),
            'PRIOR_RESTORE_MUTATION_FOUND')

def close():
    """ExecStopPost runs after systemd has terminated every process in this private unit."""
    cap = cap_module()
    saved = CONTROL/'restore-parent-acl-stdlib.json'
    if saved.exists():
        state=cap.read(saved)
        restore_parents(state['parents'],state['postgresUid'])
    for path in (ROOT, ROOT/'restore', TARGET):cap.private(path, True)
    active = []
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry/'cmdline').read_bytes().split(b'\0')
                if str(DATA).encode() in args and args and args[0] == (PG+'postgres').encode():
                    active.append(entry.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):pass
    require(not active, 'RESTORE_CLUSTER_STILL_RUNNING')
    prepare, _ = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    result = {'restoreClosure':'PASS', 'setId':SET, 'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED', 'staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE', 'campaignsEnabled':0,
              'artifactsRetained':True, 'smtpCalls':0, 'telegramCalls':0}
    cap.write(CONTROL/'restore-closure-stdlib.json', result)
    print(json.dumps(result))

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap_module()
    cap.validate_context(SET)
    for path in (ROOT/'restore', TARGET):cap.private(path, True)
    prior_preflight_stop(cap)
    source = verify_download(cap)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4*1024**3, 'FREE_SPACE_LIMIT')
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists(), 'RESTORE_ALREADY_ATTEMPTED')
    for executable in ('initdb','pg_ctl','pg_restore','psql'):
        require(' 16.' in run([PG+executable,'--version']).decode(), 'PG16_BINARY')
    parents = [ROOT, ROOT/'restore', TARGET]
    acl = acl_baseline(parents)
    meta = cap.read(source/'database/manifest.json')
    owner = meta['catalog']['database']['owner']
    require(owner in {row['name'] for row in meta['catalog']['roles']}, 'DATABASE_OWNER_NOT_CAPTURED')
    require(meta['catalog']['database']['encoding'] == 'UTF8', 'DATABASE_ENCODING')
    role_commands = role_sql(meta['catalog']['roles'])
    cap.write(CONTROL/'restore-attempt.json', {'setId':SET,'snapshotId':SNAPSHOT,'automaticRetry':False})
    postgres = pwd.getpwnam('postgres')
    account = prepare.account('postgres')
    cap.write(CONTROL/'restore-parent-acl-stdlib.json', {'parents':acl,'postgresUid':postgres.pw_uid})
    # Same execute-only named-user ACL as setfacl; direct Linux xattr, no package dependency.
    for path in parents:
        os.setxattr(path,ACL_NAME,traversal_acl(postgres.pw_uid),follow_symlinks=False)
        require(get_acl(path)==traversal_acl(postgres.pw_uid),'ACL_APPLY_VERIFY')
    for path in (DATA,SOCKET):
        path.mkdir(mode=0o700)
        os.chown(path,postgres.pw_uid,postgres.pw_gid)
    PHASE = 'INITIALIZE_NEW_PRIVATE_PG16'
    run([PG+'initdb','-D',str(DATA),'--no-clean','--encoding=UTF8','--locale-provider=libc',
         '--lc-collate='+meta['catalog']['database']['collate'],
         '--lc-ctype='+meta['catalog']['database']['ctype'],'--auth-local=peer','--auth-host=reject'],
        account=account,timeout=90)
    # Only local root/postgres can authenticate as postgres. No trust/passwords or TCP listener.
    (DATA/'pg_ident.conf').write_text('recovery_operator root postgres\nrecovery_operator postgres postgres\n')
    (DATA/'pg_hba.conf').write_text('local all postgres peer map=recovery_operator\nlocal all all reject\n')
    for name in ('pg_ident.conf','pg_hba.conf'):
        os.chown(DATA/name,postgres.pw_uid,postgres.pw_gid)
        (DATA/name).chmod(0o600)
    run([PG+'pg_ctl','-D',str(DATA),'-l',str(DATA/'restore.log'),'-w','-t','30','start','-o',
         "-c listen_addresses='' -c port=55434 -c unix_socket_directories="+str(SOCKET)+
         ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'],account=account)
    PHASE = 'RESTORE_DATABASE_OWNERS_AND_ACLS'
    settings = sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'))",database='postgres')
    require(settings == {'data':str(DATA),'tcp':'','port':'55434'}, 'ISOLATED_CLUSTER_IDENTITY')
    sql(role_commands,database='postgres',readonly=False)
    sql('CREATE DATABASE '+quote(DB)+' OWNER '+quote(owner)+" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE "+
        literal(meta['catalog']['database']['collate'])+' LC_CTYPE '+literal(meta['catalog']['database']['ctype']),database='postgres',readonly=False)
    # Stream the root-private downloaded dump; preserve ownership/ACLs. Never --clean/--create/no-owner/no-acl.
    with open(source/'database/passvero_acceptance.dump','rb') as dump:
        result = subprocess.run([PG+'pg_restore','--exit-on-error','--single-transaction','-h',str(SOCKET),
            '-p','55434','-U','postgres','-d',DB],stdin=dump,capture_output=True,env=ENV,timeout=120)
    require(result.returncode == 0, 'PG_RESTORE_FAILED')
    database_acl(meta['catalog']['database']['acl'],apply=True)
    PHASE = 'VERIFY_RESTORED_DATABASE'
    current = sql(cap.CATALOG)
    # CREATE DATABASE is intentionally renamed. Database-level ACL has a separate explicit check below.
    require({k:v for k,v in current.items() if k != 'database'} ==
            {k:v for k,v in meta['catalog'].items() if k != 'database'}, 'RESTORED_CATALOG_MISMATCH')
    tables = sql(cap.TABLES)
    counts = {name:sql('SELECT count(*) FROM '+cap.identifier(name)) for name in tables}
    require(counts == meta['counts'], 'RESTORED_COUNTERS_MISMATCH')
    require(sql(cap.SEQUENCES) == meta['sequences'], 'RESTORED_SEQUENCES_MISMATCH')
    assets = sql(references.QUERY)
    storage = cap.read(source/'storage/manifest.json')
    require(assets['enabledCampaigns'] == 0 and assets['references'] == storage['references'], 'RESTORED_ASSET_REFERENCES')
    require(references.reconcile(storage['objects'],assets['references']) == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    require(current['database']['owner'] == owner and all(current['database'][k] == meta['catalog']['database'][k]
            for k in ('encoding','collate','ctype')), 'RESTORED_DATABASE_SETTINGS')
    require(database_acl(current['database']['acl']) == database_acl(meta['catalog']['database']['acl']),
            'RESTORED_DATABASE_ACL_MISMATCH')
    result = {'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP', 'setId':SET,'snapshotId':SNAPSHOT,
        'database':DB,'tables':len(tables),'migrations':len(current['migrations']),
        'catalogOwnersAndAcls':'MATCH','databaseAcl':'MATCH_SEMANTIC_PRIVILEGES','allTableCounters':'MATCH',
        'sequences':'MATCH','databaseAssetReferences':len(assets['references']),
        'storageObjects':len(storage['objects']),'acceptedCleanupTombstones':4,
        'tcpListener':False,'isolatedApplicationRead':'NOT_YET_RUN','storageProviderRestore':'NOT_PERFORMED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'automaticRetry':False}
    prepare.runtime()
    cap.gates(prepare)
    cap.write(CONTROL/'database-restore-summary.json',result)
    print(json.dumps(result),flush=True)
    PHASE = 'STOP_PRIVATE_RESTORE_CLUSTER'
    run([PG+'pg_ctl','-D',str(DATA),'-m','fast','-w','-t','20','stop'],account=account)

if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--close']:close()
        else:
            signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(Stop('OPERATOR_INTERRUPTED')))
            main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
        result = {'databaseRestore':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
                  'stagingPauseRequested':False,'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
        print(json.dumps(result),flush=True)
        sys.exit(1)
'''
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    body=SOURCE.encode()
    if hashlib.sha256(body).hexdigest()!=PIN:raise RuntimeError('REVIEWED_SOURCE_HASH')
    compile(body,'reviewed-restore','exec')
    path=ROOT/'operator'/('restore-database-'+PIN+'.py')
    if path.exists() or path.is_symlink():raise RuntimeError('RESTORE_HELPER_EXISTS_MANUAL_REVIEW')
    unit='passvero-stage-restore-20261001T212354Z-acl-stdlib.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('RESTORE_UNIT_EXISTS_MANUAL_REVIEW')
    with open(path,'xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    print(json.dumps({'restoreHelper':'REVIEWED_INSTALLED','sourceSha256':PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'restoreInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_DATABASE_RESTORE
```
<!-- END PRIVATE_DATABASE_RESTORE_STDLIB_VPS -->


## Current checkpoint — real B2 retrieval and byte restore PASS; PG restore pending

Operator output for set `20261001T212354Z` confirms snapshot
`2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2`,
repository `9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35`,
manifest `2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132`.
Exact separate prefix passvero-staging-recovery-v1/;964172 bytes;all set files
checksummed;5 stored objects6145 bytes;9 references and4 accepted absent tombstones.
This is actual B2 retrieval into private filesystem, not a Supabase restore.
Staging ONLINE_UNPAUSED, reminders disabled/inactive, campaigns0, SMTP/Telegram0.
No additional capture or B2 upload is needed or authorized as an automatic replay.
Capture3.034s closure, four confirmed reminder receipts/replay0/two cancelled and
unchanged accepted production backup/freshness/Telegram evidence remain retained.

Next approved phase is the exact downloaded dump into new private PG16 pgdata,
DB passvero_staging_recovery, socket-only55434. A root-owned hash-pinned operator
helper executes in its own bounded transient systemd unit; maximum300 seconds,
stop25 seconds, KillMode control-group plus ExecStopPost restore/closure. Only the
new isolated cluster is terminated on interruption/error/timeout. Existing target,
attempt or unit means STOP, never overwrite/retry. Parent ROOT/restore/set remain
root0700 except temporary named execute-only postgres ACL; original basic ACLs
are saved privately and restored by ExecStopPost. Existing extended ACL or missing
existing ACL tools means STOP before the attempt; no package installation or rights
changes to credentials, storage or production. Backups remain root0600. No trust
HBA, role passwords or TCP listener; root/postgres peer authentication on private
socket only. Roles' captured attributes, ownership and relevant schema/table/function/
enum/default/database ACLs are compared; passwords and uncaptured role memberships
remain independent protected recovery dependencies, not whole-cluster claims.

15 affected local synthetic tests, full installer source/hash fixture and shell/Python
syntax PASS. Old accepted guard/source/offsite proofs are reused, not repeated.
PG/application restore is NOT_YET_RUN until operator output. This database phase
stops the private cluster and retains it for the subsequent already-approved isolated
application read. It does not launch a web server, timer, business worker or scanner.
No automatic staging backup schedule, production change, commit, push or deletion.

<!-- BEGIN PRIVATE_DATABASE_RESTORE_VPS -->
### Historical VPS block — stopped in ACL preflight; do not rerun

Copy the entire block once. Expected databaseRestore PASS_REAL_B2_DOWNLOADED_DUMP;tables51;migrations31;catalog/owners/ACL/count/sequence/reference MATCH;TCPfalse;application read NOT_YET_RUN. Then restoreClosure PASS;cluster STOPPED;parent0700;staging ONLINE_UNPAUSED;timers/campaigns OFF. On STOP retain output; never replay.

```sh
sudo /usr/bin/python3 -B - <<'PY_PRIVATE_DATABASE_RESTORE'
import hashlib,json,os,pathlib,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='15fedf7fe4feecc12c79778a551ebba8f8c56793eabf04bb7d8e33a0be753034'
SOURCE=r'''"""Restore only the verified B2 download into a new private socket-only PG16 cluster."""
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import shutil
import signal
import stat
import subprocess
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET = '20261001T212354Z'
SNAPSHOT = '2c317b57154c0ded8436b56ee9d970a8f7601dc63f89e310829a9172a8aa7ca2'
REPOSITORY = '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35'
MANIFEST = '2c5ccd0b89064cc0b431444337ab7700c1638914cfd23f1b9366d22ac13d3132'
CAPTURE = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PG = '/usr/lib/postgresql/16/bin/'
DB = 'passvero_staging_recovery'
TARGET = ROOT / 'restore' / SET
DATA = TARGET / 'pgdata'
SOCKET = TARGET / 'socket'
CONTROL = ROOT / 'control' / SET
PHASE = 'RESTORE_PREFLIGHT'
ENV = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'PGAPPNAME': 'passvero_isolated_recovery'}

class Stop(Exception):
    pass

def require(value, reason):
    if not value:
        raise Stop(reason)

def quote(value):
    require(isinstance(value, str) and '\0' not in value, 'SQL_IDENTIFIER')
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    require(isinstance(value, str) and '\0' not in value and '\\' not in value, 'SQL_LITERAL')
    return "'" + value.replace("'", "''") + "'"

def run(args, data=None, account=None, timeout=30):
    result = subprocess.run(args, input=data, capture_output=True, timeout=timeout,
                            env=ENV, **(account or {}))
    require(result.returncode == 0, 'COMMAND_' + pathlib.Path(args[0]).name.upper().replace('-', '_') + '_FAILED')
    require(len(result.stdout) <= 32 * 1024 ** 2, 'COMMAND_RESPONSE_SIZE')
    return result.stdout

def cap_module():
    path = ROOT / 'operator' / ('capture-' + CAPTURE + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077
            and hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE, 'CAPTURE_IDENTITY')
    spec = importlib.util.spec_from_file_location('restore_capture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def sql(text, database=DB, readonly=True):
    prefix = "BEGIN READ ONLY; SET LOCAL statement_timeout='15s'; " if readonly else ''
    output = run([PG+'psql', '-XqAt', '-h', str(SOCKET), '-p', '55434', '-U', 'postgres',
                  '-d', database, '-v', 'ON_ERROR_STOP=1', '-c', prefix+text])
    return json.loads(output) if readonly else output

def verify_download(cap):
    proof = cap.read(TARGET / 'download-proof.json')
    require(proof['offsite'] == 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED'
            and proof['snapshotId'] == SNAPSHOT and proof['repositoryId'] == REPOSITORY
            and proof['manifestSha256'] == MANIFEST and proof['setId'] == SET,
            'OFFSITE_PROOF_IDENTITY')
    source = TARGET / 'download' / (ROOT / 'sets' / SET).relative_to('/')
    require(hashlib.sha256((source/'recovery-set.json').read_bytes()).hexdigest() == MANIFEST,
            'DOWNLOADED_MANIFEST_CHANGED')
    manifest = cap.read(source/'recovery-set.json')
    expected = manifest['files']
    found = set()
    for path in source.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'DOWNLOAD_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if path.is_file():found.add(str(path.relative_to(source)))
    require(found == set(expected) | {'recovery-set.json'}, 'DOWNLOAD_INVENTORY')
    for name, item in expected.items():
        require(not pathlib.PurePosixPath(name).is_absolute() and '..' not in pathlib.PurePosixPath(name).parts,
                'DOWNLOAD_PATH')
        path = source/name
        require(path.stat().st_size == item['bytes']
                and hashlib.sha256(path.read_bytes()).hexdigest() == item['sha256'], 'DOWNLOAD_CHECKSUM')
    require(sum((source/name).stat().st_size for name in found) == 964172, 'PAYLOAD_CHANGED')
    return source

def role_sql(rows):
    statements = []
    for row in rows:
        name = row['name']
        require(re.fullmatch('passvero_[a-z0-9_]+', name) and not row['superuser'], 'SOURCE_ROLE_SCOPE')
        # No role password is restored. Local peer rules reject these roles; only postgres connects.
        flags = ['NOSUPERUSER', 'INHERIT' if row['inherit'] else 'NOINHERIT',
                 'CREATEROLE' if row['createRole'] else 'NOCREATEROLE',
                 'CREATEDB' if row['createDb'] else 'NOCREATEDB',
                 'LOGIN' if row['login'] else 'NOLOGIN',
                 'BYPASSRLS' if row['bypassRls'] else 'NOBYPASSRLS']
        statements.append('CREATE ROLE '+quote(name)+' '+' '.join(flags)+';')
    return '\n'.join(statements)

def database_acl(value, apply=False):
    if value is None:return None
    rows = sql("SELECT coalesce(json_agg(json_build_object('grantor',pg_get_userbyid(grantor),'grantee',CASE WHEN grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(grantee) END,'privilege',privilege_type,'option',is_grantable) ORDER BY grantor,grantee,privilege_type,is_grantable),'[]'::json) FROM aclexplode("+literal(value)+"::aclitem[])")
    if apply:
        owner = sql("SELECT to_json(pg_get_userbyid(datdba)) FROM pg_database WHERE datname=current_database()")
        sql('REVOKE ALL ON DATABASE '+quote(DB)+' FROM PUBLIC, '+quote(owner),readonly=False)
        for row in rows:
            require(row['privilege'] in ('CONNECT','CREATE','TEMPORARY'), 'DATABASE_PRIVILEGE')
            for key in ('grantor','grantee'):
                require(row[key] in ('postgres','PUBLIC') or re.fullmatch('passvero_[a-z0-9_]+',row[key]), 'DATABASE_ACL_ROLE')
            target = 'PUBLIC' if row['grantee']=='PUBLIC' else quote(row['grantee'])
            sql('SET ROLE '+quote(row['grantor'])+'; GRANT '+row['privilege']+' ON DATABASE '+quote(DB)+' TO '+target+
                (' WITH GRANT OPTION' if row['option'] else '')+'; RESET ROLE;',readonly=False)
    return sorted(rows,key=lambda r:(r['grantor'],r['grantee'],r['privilege'],r['option']))

def close():
    """ExecStopPost runs after systemd has terminated every process in this private unit."""
    saved = CONTROL/'restore-parent-acl.txt'
    if saved.exists():
        info = saved.lstat()
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077,
                'ACL_EVIDENCE_POSTURE')
        body = saved.read_text()
        paths = re.findall(r'^# file: (.+)$', body, re.M)
        require(paths == [str(ROOT), str(ROOT/'restore'), str(TARGET)], 'ACL_RESTORE_SCOPE')
        run(['/usr/bin/setfacl', '--restore='+str(saved)])
    cap = cap_module()
    for path in (ROOT, ROOT/'restore', TARGET):cap.private(path, True)
    active = []
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry/'cmdline').read_bytes().split(b'\0')
                if str(DATA).encode() in args and args and args[0] == (PG+'postgres').encode():
                    active.append(entry.name)
            except (FileNotFoundError, ProcessLookupError, PermissionError):pass
    require(not active, 'RESTORE_CLUSTER_STILL_RUNNING')
    prepare, _ = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    result = {'restoreClosure':'PASS', 'setId':SET, 'restoreCluster':'STOPPED',
              'parentPermissions':'PRIVATE_0700_RESTORED', 'staging':'ONLINE_UNPAUSED',
              'reminderTimer':'DISABLED_INACTIVE', 'campaignsEnabled':0,
              'artifactsRetained':True, 'smtpCalls':0, 'telegramCalls':0}
    cap.write(CONTROL/'restore-closure.json', result)
    print(json.dumps(result))

def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap_module()
    cap.validate_context(SET)
    for path in (ROOT/'restore', TARGET):cap.private(path, True)
    source = verify_download(cap)
    prepare, references = cap.helpers()
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4*1024**3, 'FREE_SPACE_LIMIT')
    require(not DATA.exists() and not DATA.is_symlink() and not SOCKET.exists()
            and not (CONTROL/'restore-attempt.json').exists(), 'RESTORE_ALREADY_ATTEMPTED')
    for executable in ('initdb','pg_ctl','pg_restore','psql'):
        require(' 16.' in run([PG+executable,'--version']).decode(), 'PG16_BINARY')
    for executable in ('/usr/bin/getfacl','/usr/bin/setfacl'):
        require(pathlib.Path(executable).is_file() and os.access(executable,os.X_OK), 'ACL_TOOL_UNAVAILABLE')
    parents = [ROOT, ROOT/'restore', TARGET]
    acl = run(['/usr/bin/getfacl','--absolute-names',*[str(p) for p in parents]])
    require(not re.search(rb'^(user|group):[^:]+:|^mask:', acl, re.M), 'EXISTING_PARENT_ACL_REQUIRES_REVIEW')
    meta = cap.read(source/'database/manifest.json')
    owner = meta['catalog']['database']['owner']
    require(owner in {row['name'] for row in meta['catalog']['roles']}, 'DATABASE_OWNER_NOT_CAPTURED')
    require(meta['catalog']['database']['encoding'] == 'UTF8', 'DATABASE_ENCODING')
    role_commands = role_sql(meta['catalog']['roles'])
    cap.write(CONTROL/'restore-attempt.json', {'setId':SET,'snapshotId':SNAPSHOT,'automaticRetry':False})
    with open(CONTROL/'restore-parent-acl.txt','xb') as handle:handle.write(acl)
    postgres = pwd.getpwnam('postgres')
    account = prepare.account('postgres')
    # Execute-only ACLs on three ancestors; root-owned backups remain 0600. Restored by ExecStopPost.
    for path in parents:run(['/usr/bin/setfacl','-m','u:postgres:--x',str(path)])
    for path in (DATA,SOCKET):
        path.mkdir(mode=0o700)
        os.chown(path,postgres.pw_uid,postgres.pw_gid)
    PHASE = 'INITIALIZE_NEW_PRIVATE_PG16'
    run([PG+'initdb','-D',str(DATA),'--no-clean','--encoding=UTF8','--locale-provider=libc',
         '--lc-collate='+meta['catalog']['database']['collate'],
         '--lc-ctype='+meta['catalog']['database']['ctype'],'--auth-local=peer','--auth-host=reject'],
        account=account,timeout=90)
    # Only local root/postgres can authenticate as postgres. No trust/passwords or TCP listener.
    (DATA/'pg_ident.conf').write_text('recovery_operator root postgres\nrecovery_operator postgres postgres\n')
    (DATA/'pg_hba.conf').write_text('local all postgres peer map=recovery_operator\nlocal all all reject\n')
    for name in ('pg_ident.conf','pg_hba.conf'):
        os.chown(DATA/name,postgres.pw_uid,postgres.pw_gid)
        (DATA/name).chmod(0o600)
    run([PG+'pg_ctl','-D',str(DATA),'-l',str(DATA/'restore.log'),'-w','-t','30','start','-o',
         "-c listen_addresses='' -c port=55434 -c unix_socket_directories="+str(SOCKET)+
         ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'],account=account)
    PHASE = 'RESTORE_DATABASE_OWNERS_AND_ACLS'
    settings = sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'))",database='postgres')
    require(settings == {'data':str(DATA),'tcp':'','port':'55434'}, 'ISOLATED_CLUSTER_IDENTITY')
    sql(role_commands,database='postgres',readonly=False)
    sql('CREATE DATABASE '+quote(DB)+' OWNER '+quote(owner)+" TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE "+
        literal(meta['catalog']['database']['collate'])+' LC_CTYPE '+literal(meta['catalog']['database']['ctype']),database='postgres',readonly=False)
    # Stream the root-private downloaded dump; preserve ownership/ACLs. Never --clean/--create/no-owner/no-acl.
    with open(source/'database/passvero_acceptance.dump','rb') as dump:
        result = subprocess.run([PG+'pg_restore','--exit-on-error','--single-transaction','-h',str(SOCKET),
            '-p','55434','-U','postgres','-d',DB],stdin=dump,capture_output=True,env=ENV,timeout=120)
    require(result.returncode == 0, 'PG_RESTORE_FAILED')
    database_acl(meta['catalog']['database']['acl'],apply=True)
    PHASE = 'VERIFY_RESTORED_DATABASE'
    current = sql(cap.CATALOG)
    # CREATE DATABASE is intentionally renamed. Database-level ACL has a separate explicit check below.
    require({k:v for k,v in current.items() if k != 'database'} ==
            {k:v for k,v in meta['catalog'].items() if k != 'database'}, 'RESTORED_CATALOG_MISMATCH')
    tables = sql(cap.TABLES)
    counts = {name:sql('SELECT count(*) FROM '+cap.identifier(name)) for name in tables}
    require(counts == meta['counts'], 'RESTORED_COUNTERS_MISMATCH')
    require(sql(cap.SEQUENCES) == meta['sequences'], 'RESTORED_SEQUENCES_MISMATCH')
    assets = sql(references.QUERY)
    storage = cap.read(source/'storage/manifest.json')
    require(assets['enabledCampaigns'] == 0 and assets['references'] == storage['references'], 'RESTORED_ASSET_REFERENCES')
    require(references.reconcile(storage['objects'],assets['references']) == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    require(current['database']['owner'] == owner and all(current['database'][k] == meta['catalog']['database'][k]
            for k in ('encoding','collate','ctype')), 'RESTORED_DATABASE_SETTINGS')
    require(database_acl(current['database']['acl']) == database_acl(meta['catalog']['database']['acl']),
            'RESTORED_DATABASE_ACL_MISMATCH')
    result = {'databaseRestore':'PASS_REAL_B2_DOWNLOADED_DUMP', 'setId':SET,'snapshotId':SNAPSHOT,
        'database':DB,'tables':len(tables),'migrations':len(current['migrations']),
        'catalogOwnersAndAcls':'MATCH','databaseAcl':'MATCH_SEMANTIC_PRIVILEGES','allTableCounters':'MATCH',
        'sequences':'MATCH','databaseAssetReferences':len(assets['references']),
        'storageObjects':len(storage['objects']),'acceptedCleanupTombstones':4,
        'tcpListener':False,'isolatedApplicationRead':'NOT_YET_RUN','storageProviderRestore':'NOT_PERFORMED',
        'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0,'automaticRetry':False}
    prepare.runtime()
    cap.gates(prepare)
    cap.write(CONTROL/'database-restore-summary.json',result)
    print(json.dumps(result),flush=True)
    PHASE = 'STOP_PRIVATE_RESTORE_CLUSTER'
    run([PG+'pg_ctl','-D',str(DATA),'-m','fast','-w','-t','20','stop'],account=account)

if __name__ == '__main__':
    try:
        if sys.argv[1:] == ['--close']:close()
        else:
            signal.signal(signal.SIGTERM,lambda *_: (_ for _ in ()).throw(Stop('OPERATOR_INTERRUPTED')))
            main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
        result = {'databaseRestore':'STOP','phase':PHASE,'reason':reason,'retry':'MANUAL_REVIEW_REQUIRED',
                  'stagingPauseRequested':False,'artifactsRetained':True,'smtpCalls':0,'telegramCalls':0}
        print(json.dumps(result),flush=True)
        sys.exit(1)
'''
try:
    if os.geteuid()!=0 or os.uname().nodename!='srv1834647':raise RuntimeError('OPERATOR_HOST')
    os.umask(0o077)
    for p in (ROOT,ROOT/'operator'):
        s=p.lstat()
        if not stat.S_ISDIR(s.st_mode) or s.st_uid!=0 or s.st_mode&0o077:raise RuntimeError('OPERATOR_DIRECTORY_POSTURE')
    body=SOURCE.encode()
    if hashlib.sha256(body).hexdigest()!=PIN:raise RuntimeError('REVIEWED_SOURCE_HASH')
    compile(body,'reviewed-restore','exec')
    path=ROOT/'operator'/('restore-database-'+PIN+'.py')
    if path.exists() or path.is_symlink():raise RuntimeError('RESTORE_HELPER_EXISTS_MANUAL_REVIEW')
    unit='passvero-stage-restore-20261001T212354Z.service'
    check=subprocess.run(['/usr/bin/systemctl','show',unit,'--property=LoadState','--value'],capture_output=True,timeout=5)
    if check.stdout.strip() not in (b'not-found',b''):raise RuntimeError('RESTORE_UNIT_EXISTS_MANUAL_REVIEW')
    with open(path,'xb') as f:f.write(body);f.flush();os.fsync(f.fileno())
    print(json.dumps({'restoreHelper':'REVIEWED_INSTALLED','sourceSha256':PIN,'stagingPauseRequested':False}),flush=True)
    command=['/usr/bin/systemd-run','--unit='+unit,'--wait','--pipe',
        '--property=Type=exec','--property=RuntimeMaxSec=300','--property=TimeoutStopSec=25',
        '--property=KillMode=control-group','--property=SendSIGKILL=yes',
        '--property=ExecStopPost=/usr/bin/python3 -B '+str(path)+' --close',
        '/usr/bin/python3','-B',str(path)]
    sys.exit(subprocess.call(command))
except Exception as error:
    reason=str(error) if isinstance(error,RuntimeError) else type(error).__name__
    print(json.dumps({'restoreInstaller':'STOP','reason':reason,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True,'stagingPauseRequested':False,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_PRIVATE_DATABASE_RESTORE
```
<!-- END PRIVATE_DATABASE_RESTORE_VPS -->


## Current checkpoint — consistent capture PASS; B2 transfer pending

Returned operator evidence for `20261001T212354Z` proves capture PASS and staging
ONLINE_RESUMED after 3.034 seconds. Reviewed helper d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa was installed; original failed claim/set retained.
51 tables locked; outside clients0 and staging writers0; Storage metadata/bytes
unchanged. Set964172 bytes;5 stored objects;9 references;4 accepted absent tombstones.
Accepted independent timeout proof reused. Additional pause consumed; no new pause
or capture retry is authorized by this continuation. Reminder timer disabled/inactive,
campaigns0; accepted four receipts/replay0/two cancelled remain unchanged.

Next is the already approved exact-prefix B2 upload and real private filesystem
restore. New offsite helper has12 synthetic contract tests PASS; old42 source tests
are reused. The complete operator block is below. It verifies existing credentials
and prefix without printing secrets; never runs the production backup job or retention.
Exclusive attempt/restore paths prevent replay/overwrite; failures retain artifacts.
Database restore and isolated application reads remain NOT_YET_RUN, as does B2 until
operator output. Filesystem bytes alone prove neither Supabase nor full service recovery.
No automatic staging schedule introduced; production/freshness/Telegram unchanged.
No privileged command run by Codex, no commit or push.

<!-- BEGIN APPROVED_B2_OFFSITE_VPS -->
### VPS TERMINAL — PENDING_OPERATOR_COMMAND_B2_OFFSITE

Run once. Expected sanitized final result: offsite PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED; measured snapshot/repository IDs; set20261001T212354Z; payload964172; objects5; bytes6145; references9; tombstones4; staging ONLINE_UNPAUSED; timers/campaigns OFF; PG/application restore NOT_YET_RUN. STOP means manual review, never replay.

```sh
sudo /usr/bin/python3 -B - <<'PY_STAGING_B2_OFFSITE'
"""One approved captured set to isolated B2 prefix, then real private byte restore."""
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET_ID = '20261001T212354Z'
CAPTURE_PIN = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
HOST = 'passvero-staging-recovery'
GIB = 1024 ** 3
PHASE = 'VERIFY_CAPTURED_SET'
REMOTE_WRITES = False
CONTROL = None


class Stop(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Stop(reason)


def capture_helper():
    path = ROOT / 'operator' / ('capture-' + CAPTURE_PIN + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077,
            'CAPTURE_HELPER_POSTURE')
    require(hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE_PIN, 'CAPTURE_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location('accepted_capture_offsite', path)
    cap = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cap)
    return cap


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def verify_set(work, cap):
    cap.private(work, True)
    manifest = cap.read(work / 'recovery-set.json')
    require(manifest['schema'] == 1 and manifest['setId'] == SET_ID, 'RECOVERY_SET_IDENTITY')
    entries = manifest['files']
    require(isinstance(entries, dict) and 1 <= len(entries) <= 10000, 'SET_FILE_COUNT')
    found = {}
    for path in work.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'SET_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if stat.S_ISREG(info.st_mode):
            found[str(path.relative_to(work))] = path
    require(set(found) == set(entries) | {'recovery-set.json'}, 'SET_FILE_INVENTORY')
    for name, expected in entries.items():
        parts = pathlib.PurePosixPath(name)
        require(not parts.is_absolute() and str(parts) == name
                and all(part not in ('.', '..') for part in parts.parts)
                and '\\' not in name and '\0' not in name, 'SET_FILE_PATH')
        require(type(expected['bytes']) is int and expected['bytes'] >= 0
                and re.fullmatch('[a-f0-9]{64}', expected['sha256']), 'SET_FILE_METADATA')
        require(found[name].stat().st_size == expected['bytes']
                and digest(found[name]) == expected['sha256'], 'SET_FILE_CHECKSUM')
    payload = sum(path.stat().st_size for path in found.values())
    require(payload <= GIB and manifest['payloadBytes'] == sum(x['bytes'] for x in entries.values()),
            'SET_PAYLOAD_LIMIT')
    return manifest, payload, digest(work / 'recovery-set.json')


class Repository:
    def __init__(self, prepare):
        locator = prepare.protected('/etc/passvero/backup/restic-repository').decode().strip()
        prepare.protected('/etc/passvero/backup/restic-password')
        self.keys = prepare.credentials(prepare.protected('/etc/passvero/backup/restic.env').decode())
        self.host, self.region, self.bucket, self.repo = prepare.destination(locator)
        self.prepare = prepare

    def empty_prefix(self):
        request = self.prepare.s3_list_request(self.host, self.region, self.bucket,
                                              self.keys, datetime.datetime.now(datetime.timezone.utc))
        with self.prepare.response(request) as response:
            body = response.read(4 * 1024 ** 2 + 1)
        require(len(body) <= 4 * 1024 ** 2, 'B2_LIST_SIZE')
        listing = ET.fromstring(body)
        require(listing.tag.endswith('ListBucketResult')
                and listing.findtext('{*}Prefix') == self.prepare.PREFIX + '/', 'B2_PREFIX_IDENTITY')
        truncated = listing.findtext('{*}IsTruncated')
        require(truncated in ('true', 'false'), 'B2_LIST_SHAPE')
        return truncated == 'false' and not listing.findall('{*}Contents')

    def run(self, args, writing=False):
        global REMOTE_WRITES
        require(args and args[0] in ('init', 'cat', 'snapshots', 'backup', 'dump', 'ls', 'restore'),
                'RESTIC_OPERATION_SCOPE')
        require(writing == (args[0] in ('init', 'backup')), 'RESTIC_WRITE_SCOPE')
        if writing:
            REMOTE_WRITES = True
        result = subprocess.run(['/usr/local/bin/restic', '--no-cache',
            *([] if writing else ['--no-lock']), '--repo', self.repo, '--password-file',
            '/etc/passvero/backup/restic-password', *args], capture_output=True,
            timeout=900 if args[0] in ('backup', 'restore') else 60,
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C', **self.keys})
        if result.returncode != 0:
            denied = any(x in result.stderr.lower() for x in
                         (b'accessdenied', b'access denied', b'invalidaccesskeyid', b'signaturedoesnotmatch'))
            raise Stop('RESTIC_' + args[0].upper() + '_EXIT_' + str(result.returncode)
                       + ('_ACCESS_OR_SIGNATURE_DENIED' if denied else ''))
        require(len(result.stdout) <= 32 * 1024 ** 2, 'RESTIC_RESPONSE_SIZE')
        return result.stdout

    def snapshots(self):
        rows = json.loads(self.run(['snapshots', '--json']))
        rows = [] if rows is None else rows
        require(isinstance(rows, list), 'SNAPSHOT_LIST_SHAPE')
        for row in rows:
            require(re.fullmatch('[a-f0-9]{64}', row.get('id', '')) and row.get('hostname') == HOST
                    and HOST in row.get('tags', []) and row.get('paths')
                    and all(isinstance(path, str) and re.fullmatch(
                        re.escape(str(ROOT / 'sets')) + r'/[0-9]{8}T[0-9]{6}Z', path)
                        for path in row['paths']), 'STAGING_REPOSITORY_IDENTITY')
        return rows


def validate_tree(body, snapshot_id, work, manifest):
    expected = {str(work / name): item['bytes'] for name, item in manifest['files'].items()}
    expected[str(work / 'recovery-set.json')] = (work / 'recovery-set.json').stat().st_size
    directories = {str(parent) for name in expected for parent in pathlib.PurePosixPath(name).parents}
    found = {}
    header = 0
    for line in body.splitlines():
        row = json.loads(line)
        kind = row.get('message_type', row.get('struct_type'))
        if kind == 'snapshot':
            require(row.get('id') == snapshot_id, 'SNAPSHOT_TREE_IDENTITY')
            header += 1
        else:
            require(kind == 'node', 'SNAPSHOT_TREE_SHAPE')
            if row.get('type') == 'file':
                name = row.get('path')
                require(name in expected and name not in found and row.get('size') == expected[name],
                        'SNAPSHOT_TREE_FILES')
                found[name] = row['size']
            else:
                require(row.get('type') == 'dir' and row.get('path') in directories,
                        'SNAPSHOT_TREE_SPECIAL_OR_OUTSIDE_SCOPE')
    require(header == 1 and found == expected, 'SNAPSHOT_TREE_INCOMPLETE')


def main(cap=None, repository=None):
    global PHASE, CONTROL
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap or capture_helper()
    work, control = cap.validate_context(SET_ID)
    CONTROL = control
    prepare, references = cap.helpers()
    saved = cap.read(control / 'summary.json')
    closure = cap.read(control / 'closure.json')
    require(saved['capture'] == 'PASS' and saved['setId'] == SET_ID
            and closure['stagingResumed'] is True and closure['serviceResult'] == 'success'
            and 0 < closure['pauseSeconds'] <= 120, 'CAPTURE_CLOSURE_NOT_ACCEPTED')
    claim = cap.read(ROOT / cap.ADDITIONAL_CLAIM)
    require(claim['setId'] == SET_ID and claim['priorSetId'] == cap.FAILED_SET
            and claim['priorClaimSha256'] == digest(ROOT / cap.FIRST_CLAIM), 'RETAINED_CLAIM_CHANGED')
    attempt = control / 'offsite-attempt.json'
    require(not attempt.exists() and not attempt.is_symlink(), 'OFFSITE_ALREADY_ATTEMPTED')
    restore_root = ROOT / 'restore'
    if restore_root.exists() or restore_root.is_symlink():
        cap.private(restore_root, True)
    target = restore_root / SET_ID
    require(not target.exists() and not target.is_symlink(), 'RESTORE_TARGET_ALREADY_EXISTS')
    manifest, payload, manifest_sha = verify_set(work, cap)
    require(payload == saved['payloadBytes'] == 964172, 'ACCEPTED_CAPTURE_PAYLOAD_CHANGED')
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FREE_SPACE_LIMIT')
    prepare.runtime()
    cap.gates(prepare)
    require(digest(pathlib.Path('/usr/local/sbin/passvero-postgres-backup')) == prepare.PIN,
            'PRODUCTION_BACKUP_SOURCE_CHANGED')
    binary = pathlib.Path('/usr/local/bin/restic')
    info = binary.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022
            and os.access(binary, os.X_OK), 'EXISTING_RESTIC_POSTURE')
    help_result = subprocess.run([str(binary), 'restore', '--help'], capture_output=True, timeout=10,
                                 env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
    require(help_result.returncode == 0 and b'--verify' in help_result.stdout,
            'EXISTING_RESTIC_RESTORE_VERIFY_UNAVAILABLE')
    repository = repository or Repository(prepare)
    PHASE = 'VERIFY_EXACT_STAGING_B2_PREFIX'
    empty = repository.empty_prefix()
    if not empty:
        config = json.loads(repository.run(['cat', 'config']))
        before = repository.snapshots()
        require(before, 'NONEMPTY_PREFIX_WITHOUT_IDENTIFIED_SNAPSHOTS')
        prepared = cap.read(ROOT / 'preparation' / cap.SEED / 'prepared.json')['repository']
        if prepared.get('exists'):
            require(config.get('id') == prepared['id'], 'PREPARED_REPOSITORY_CHANGED')
    else:
        before = []
        config = None
    if config is not None:
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')),
                'REPOSITORY_FORMAT')
    require(not any(str(work) in row['paths'] for row in before), 'SET_ALREADY_IN_B2_MANUAL_REVIEW')
    cap.write(attempt, {'setId': SET_ID, 'manifestSha256': manifest_sha, 'automaticRetry': False})
    if empty:
        PHASE = 'INIT_APPROVED_STAGING_REPOSITORY_ONLY'
        repository.run(['init'], writing=True)
        config = json.loads(repository.run(['cat', 'config']))
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')),
                'INITIALIZED_REPOSITORY_FORMAT')
    cap.write(control / 'offsite-repository.json', {'prefix': prepare.PREFIX + '/',
              'repositoryId': config['id'], 'manifestSha256': manifest_sha, 'setId': SET_ID})
    PHASE = 'BACKUP_EXACT_CAPTURED_SET'
    print(json.dumps({'offsite': 'UPLOADING_CAPTURED_SET', 'setId': SET_ID,
                      'stagingPauseRequested': False, 'payloadBytes': payload}), flush=True)
    repository.run(['backup', '--json', '--force', '--host', HOST, '--tag', HOST,
                    '--tag', 'set:' + SET_ID, str(work)], writing=True)
    after = repository.snapshots()
    require({row['id'] for row in before} <= {row['id'] for row in after}, 'EXISTING_SNAPSHOTS_CHANGED')
    added = [row for row in after if row['id'] not in {old['id'] for old in before}]
    require(len(added) == 1 and added[0]['paths'] == [str(work)]
            and 'set:' + SET_ID in added[0].get('tags', []), 'NEW_SNAPSHOT_IDENTITY')
    snapshot_id = added[0]['id']
    cap.write(control / 'offsite-snapshot.json', {'setId': SET_ID, 'snapshotId': snapshot_id,
              'repositoryId': config['id'], 'manifestSha256': manifest_sha})
    require(verify_set(work, cap) == (manifest, payload, manifest_sha), 'CAPTURE_CHANGED_DURING_UPLOAD')
    require(hashlib.sha256(repository.run(['dump', snapshot_id,
            str(work / 'recovery-set.json')])).hexdigest() == manifest_sha, 'B2_MANIFEST_CHECKSUM')
    validate_tree(repository.run(['ls', '--json', snapshot_id]), snapshot_id, work, manifest)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'PRE_DOWNLOAD_FREE_SPACE_LIMIT')
    if not restore_root.exists():
        restore_root.mkdir(mode=0o700)
    target.mkdir(mode=0o700, exist_ok=False)
    download = target / 'download'
    download.mkdir(mode=0o700)
    PHASE = 'RESTORE_EXACT_B2_SNAPSHOT_TO_NEW_PRIVATE_FILESYSTEM'
    repository.run(['restore', snapshot_id, '--target', str(download), '--verify'])
    restored = download / work.relative_to('/')
    require(verify_set(restored, cap) == (manifest, payload, manifest_sha), 'DOWNLOADED_SET_MISMATCH')
    storage = cap.read(restored / 'storage' / 'manifest.json')
    reconciliation = references.reconcile(storage['objects'], storage['references'])
    require(reconciliation == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    for item in storage['objects']:
        path = restored / 'storage' / 'objects' / item['bucket'] / item['file']
        require(path.stat().st_size == item['size'] and digest(path) == item['sha256'],
                'RESTORED_ASSET_CHECKSUM')
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FINAL_FREE_SPACE_LIMIT')
    result = {'offsite': 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED', 'setId': SET_ID,
        'snapshotId': snapshot_id, 'repositoryId': config['id'], 'b2Prefix': prepare.PREFIX + '/',
        'payloadBytes': payload, 'manifestSha256': manifest_sha, 'allSetFilesChecksummed': True,
        'storageObjects': len(storage['objects']), 'storageBytes': sum(x['size'] for x in storage['objects']),
        'databaseAssetReferences': len(storage['references']),
        'acceptedCleanupTombstones': len(reconciliation['acceptedCleanupTombstones']),
        'staging': 'ONLINE_UNPAUSED', 'reminderTimer': 'DISABLED_INACTIVE', 'campaignsEnabled': 0,
        'databaseRestore': 'NOT_YET_RUN', 'isolatedApplicationRead': 'NOT_YET_RUN',
        'restoreCluster': 'NOT_CREATED', 'storageProviderRestore': 'NOT_PERFORMED',
        'smtpCalls': 0, 'telegramCalls': 0, 'automaticRetry': False, 'artifactsRetained': True}
    cap.write(control / 'offsite-summary.json', result)
    cap.write(target / 'download-proof.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        message = str(error)
        reason = message if re.fullmatch(r'[A-Z0-9_]{1,160}', message) else type(error).__name__
        result = {'offsite': 'STOP', 'phase': PHASE, 'reason': reason,
                  'remoteWritesMayHaveOccurred': REMOTE_WRITES, 'stagingPauseRequested': False,
                  'restoreCluster': 'NOT_CREATED', 'artifactsRetained': True,
                  'retry': 'MANUAL_REVIEW_REQUIRED', 'smtpCalls': 0, 'telegramCalls': 0}
        if CONTROL is not None:
            try:
                stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                with open(CONTROL / ('offsite-stop-' + stamp + '.json'), 'x') as handle:
                    json.dump(result, handle)
                    handle.write('\n')
            except Exception:
                pass
        print(json.dumps(result))
        sys.exit(1)
PY_STAGING_B2_OFFSITE
```
<!-- END APPROVED_B2_OFFSITE_VPS -->


Task: EXISTING_BACKUP_COVERAGE_AND_STAGING_RECOVERY_COMPLETION.
Current checkpoint: PRIVATE_PATH_CONFIRMED; PENDING_OPERATOR_COMMAND_PRIVATE_DATABASE_RESTORE. Earlier inventory/approval blocks below are retained history, not instructions to rerun.
This uses the installed system. The user approved only the separate staging B2 prefix,
operator capture and new private restore target specified below; new credentials,
jobs/schedules, production changes and Telegram messages remain outside scope.
The older PostgreSQL DR runbook remains the historical accepted recovery reference.

## Historical successful capture continuation — do not rerun

Returned read-only VPS state confirms originalClaimRetained=true,
additionalAttemptClaimExists=false, correctedHelperExists=false, stagingOnline=true,
reminder timer disabled/inactive, service inactive and enabledCampaigns0. Writes/
Storage/B2/SMTP/Telegram0; PRE_CAPTURE_INSTALLER_STOP_CONFIRMED. Thus the explicitly
approved additional pause was not consumed by the failed transport. Manual review
is complete for this installer failure. Do not request another pause approval or
repeat accepted timeout/SQL/Storage acceptance. Capture itself remains unexecuted.

The corrected handoff reconstructs the exact approved source from the existing
hash-pinned failed helper using a small byte delta. It verifies all existing helper
identities and original/extra claims, then compressed patch SHA256, patch boundaries,
final approved source SHA256 and Python syntax before exclusive private installation.
ASCII/Unicode whitespace in transport is removed only from Base64 encoding; strict
Base64 and both patch/source hashes remain mandatory. A changed character/patch/source
cannot reach installation or capture. Error output now identifies the installer phase.
No capture helper/source change: d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa unchanged.
Original helper/claim/set retained. Seven full local installer fixtures PASS, covering
exact reconstruction, whitespace corruption, invalid/changed payload, altered old
helper, consumed extra claim and an existing helper conflict. Source42-test acceptance
is reused; only the affected packaging tests were run. Complete shell/Python syntax
PASS. Short lines,7,351-byte full block instead of20,264-byte full-source transport.

Executing the block once installs the exact approved helper and invokes only
--launch-additional-after-20261001T203612Z. It freshly checks source/runtime, Storage
metadata, current online dump size, free>=4GiB, final payload<=1GiB and actual applied
unit deadlines before stopping PM2.85s capture+25s independent resume; actual pause
must be<=120s. New exclusive claim/set; no old reset or automatic retry. Accepted
systemd timeout proof is reused. Production/freshness/Telegram, scanner/producer,
credentials and reminder gates remain unchanged. No B2 transfer or restore occurs
in this capture block; those approved steps follow a successful set and confirmed
resume with separate complete operator handoffs, without new approval.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_APPROVED_CAPTURE_DELTA

<!-- BEGIN APPROVED_CAPTURE_DELTA_VPS -->
```sh
sudo /usr/bin/python3 -B - <<'PY_APPROVED_CAPTURE_DELTA'
import base64,gzip,hashlib,json,os,pathlib,stat,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
OLD='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
PIN='d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PATCH_PIN='601ac146cda0b9d4920eb298fd707d9c30e09968d5ea7f19e707a4570e5d695f'
ENCODED=(
    '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'
)
PHASE='VERIFY_EXISTING_IDENTITIES'
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
def private(path,directory=False):
    info=path.lstat()
    require(info.st_uid==0 and not info.st_mode&0o077 and
        (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)),
        'PRIVATE_PATH_POSTURE')
try:
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    private(ROOT,True);private(ROOT/'operator',True)
    private(ROOT/'operator.identity.json')
    require(json.loads((ROOT/'operator.identity.json').read_text())==
        {'schema':1,'scope':'passvero-staging-recovery-v1'},'ROOT_IDENTITY')
    first=ROOT/'one-pause-approved-20261001.json';private(first)
    require(json.loads(first.read_text())=={'setId':'20261001T203612Z',
        'unit':'passvero-stage-capture-20261001T203612Z.service'},'FAILED_CLAIM_IDENTITY')
    extra=ROOT/'additional-pause-after-20261001T203612Z.json'
    require(not extra.exists() and not extra.is_symlink(),'ADDITIONAL_PAUSE_ALREADY_CLAIMED')
    for name,pin in [
        ('prepare','d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'),
        ('references','2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376'),
        ('capture',OLD)]:
        path=ROOT/'operator'/(name+'-'+pin+'.py');private(path)
        require(hashlib.sha256(path.read_bytes()).hexdigest()==pin,'RETAINED_HELPER_IDENTITY')
    source=(ROOT/'operator'/('capture-'+OLD+'.py')).read_bytes()
    PHASE='DECODE_REVIEWED_PATCH'
    encoded=''.join(ENCODED.split())
    require(len(encoded)<=8192,'PATCH_TRANSPORT_SIZE')
    package=base64.b64decode(encoded,validate=True)
    require(hashlib.sha256(package).hexdigest()==PATCH_PIN,'PATCH_TRANSPORT_HASH')
    edits=json.loads(gzip.decompress(package))
    prior_end=0
    for start,end,value in edits:
        require(type(start) is int and type(end) is int and isinstance(value,str)
            and prior_end<=start<=end<=len(source),'PATCH_BOUNDARIES')
        prior_end=end
    for start,end,value in reversed(edits):
        source=source[:start]+value.encode('utf8')+source[end:]
    PHASE='VERIFY_APPROVED_SOURCE'
    require(hashlib.sha256(source).hexdigest()==PIN,'APPROVED_SOURCE_HASH')
    compile(source,'approved-additional-capture','exec')
    PHASE='INSTALL_VERIFIED_HELPER'
    target=ROOT/'operator'/('capture-'+PIN+'.py')
    if target.exists() or target.is_symlink():
        private(target);require(target.read_bytes()==source,'EXISTING_HELPER_CONFLICT')
    else:
        with open(target,'xb') as handle:
            handle.write(source);handle.flush();os.fsync(handle.fileno())
        private(target)
    print(json.dumps({'captureHelper':'REVIEWED_ADDITIONAL_CONTINUATION_INSTALLED',
        'sourceSha256':PIN,'failedClaimRetained':True,'stagingPauseRequested':False,
        'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}),flush=True)
    PHASE='LAUNCH_APPROVED_CAPTURE'
    os.execv('/usr/bin/python3',['/usr/bin/python3','-B',str(target),
        '--launch-additional-after-20261001T203612Z'])
except BaseException as error:
    print(json.dumps({'captureInstaller':'STOP','phase':PHASE,
        'reason':str(error) if isinstance(error,RuntimeError) else type(error).__name__,
        'stagingPauseRequested':False,'retry':'MANUAL_REVIEW_REQUIRED',
        'artifactsRetained':True,'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_APPROVED_CAPTURE_DELTA
```
<!-- END APPROVED_CAPTURE_DELTA_VPS -->

Expected sanitized output: REVIEWED_ADDITIONAL_CONTINUATION_INSTALLED with approved
source SHA, then capture=PASS/new measured setId, staging=ONLINE_RESUMED, measured
pauseSeconds<=120, independentTimeoutResumeGuard=REUSED_ACCEPTED_20261001T203612Z,
lockedTables51, outsideDbClients0, stagingWritersDuringCapture0, timer disabled/inactive,
campaigns0, SMTP/Telegram/remoteWrites0; b2Transfer/restore=NOT_YET_RUN. Any STOP means
preserve artifacts and stop for manual review; no replay or deadline extension.
Return actual output. No privileged operational command is executed by Codex.

## Accepted additional-installer state review — historical block, do not rerun

Returned installer output: STOP/reason=Error; stagingPauseRequested=false, remote
writes/SMTP/Telegram0; artifacts retained; MANUAL_REVIEW_REQUIRED. No helper-installed
success line was returned. The assistant's pasted response contained internal spaces
inside Base64 string literals. Local strict base64 decoding reproduces binascii.Error
(the sanitized exception class prints Error). The intact reviewed runbook payload
still decodes to the approved d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa source.
This was an assistant handoff defect; no helper/source behavior change is proposed.
Do not ask the operator to fix or replay the damaged encoded block.

In the installer, decoding precedes target creation and os.execv; a decoding Error
therefore occurs before corrected helper installation, extra claim creation, new
systemd unit or staging pause. That is source-control-flow evidence; current VPS
artifact/runtime state is verified only by the narrow read-only block below. If
an extra claim exists, STOP for manual review; never reset it or resume capture.
The one additional pause approval is retained, but no new operational attempt is
launched by this handoff. No accepted timeout/SQL/Storage/B2 checks are repeated.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_INSTALLER_STOP_READ_ONLY

The block checks protected helper identities, original/extra claims, current staging
PM2 identity and disabled reminder gates. It does not install, pause, start/stop a
unit, send, export/dump, access Storage/B2 or modify any file. Four local full-probe
fixtures and shell/Python syntax PASS. Local fixtures are not current VPS evidence.

<!-- BEGIN INSTALLER_STOP_READ_ONLY -->
```sh
sudo /usr/bin/python3 -B - <<'PY_INSTALLER_STOP_STATE'
import hashlib,importlib.util,json,os,pathlib,stat,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
OLD='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
PIN='d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
def private(path,directory=False):
    info=path.lstat()
    require(info.st_uid==0 and not info.st_mode&0o077 and
        (stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)),
        'PRIVATE_PATH_POSTURE')
try:
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    private(ROOT,True);private(ROOT/'operator',True)
    path=ROOT/'operator'/('capture-'+OLD+'.py');private(path)
    require(hashlib.sha256(path.read_bytes()).hexdigest()==OLD,'FAILED_HELPER_IDENTITY')
    spec=importlib.util.spec_from_file_location('retained_capture_readonly',path)
    cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
    require(cap.read(ROOT/'operator.identity.json')==
        {'schema':1,'scope':'passvero-staging-recovery-v1'},'ROOT_IDENTITY')
    first=cap.read(ROOT/'one-pause-approved-20261001.json')
    require(first=={'setId':'20261001T203612Z',
        'unit':'passvero-stage-capture-20261001T203612Z.service'},'ORIGINAL_CLAIM_CHANGED')
    extra=ROOT/'additional-pause-after-20261001T203612Z.json'
    extra_present=extra.exists() or extra.is_symlink()
    target=ROOT/'operator'/('capture-'+PIN+'.py')
    target_present=target.exists() or target.is_symlink()
    target_matches=False
    if target_present:
        private(target)
        target_matches=hashlib.sha256(target.read_bytes()).hexdigest()==PIN
        require(target_matches,'CORRECTED_HELPER_CONFLICT')
    prepare,_=cap.helpers()
    process,_=prepare.runtime()
    require(process['status']=='online','STAGING_NOT_ONLINE')
    cap.gates(prepare)
    print(json.dumps({'diagnostic':'READ_ONLY_ADDITIONAL_INSTALLER_STOP_STATE',
        'originalClaimRetained':True,'additionalAttemptClaimExists':extra_present,
        'correctedHelperExists':target_present,'correctedHelperHashMatches':target_matches,
        'stagingOnline':True,'reminderTimer':'DISABLED_INACTIVE',
        'reminderService':'INACTIVE','campaignsEnabled':0,
        'captureExecutedByDiagnostic':False,'stagingPauseRequested':False,
        'writes':'NONE','storageCalls':0,'b2Calls':0,'smtpCalls':0,'telegramCalls':0,
        'assessment':'STOP_MANUAL_REVIEW' if extra_present else 'PRE_CAPTURE_INSTALLER_STOP_CONFIRMED'}))
except BaseException as error:
    print(json.dumps({'diagnostic':'STOP','reason':str(error) if isinstance(error,RuntimeError)
        else type(error).__name__,'writes':'NONE','stagingPauseRequested':False,
        'captureExecutedByDiagnostic':False,'b2Calls':0,'smtpCalls':0,'telegramCalls':0,
        'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_INSTALLER_STOP_STATE
```
<!-- END INSTALLER_STOP_READ_ONLY -->

Expected sanitized diagnostic: READ_ONLY_ADDITIONAL_INSTALLER_STOP_STATE,
originalClaimRetained=true, additionalAttemptClaimExists=false,
correctedHelperExists=false, correctedHelperHashMatches=false (file absent),
stagingOnline=true, timer disabled/inactive, reminder service inactive, campaigns0,
writes=NONE, no capture/pause/provider calls. If a corrected helper already exists,
its actual hash must match the approved pin; its existence is measured, not assumed.
Return actual output. Any extra claim/conflict/offline state stays STOP/manual review;
no automatic retry or pause deadline extension.

## Historical additional capture handoff — installer stopped; do not rerun

The returned read-only diagnostic for failed set `20261001T203612Z` confirms the
exact failure at LOCK_AND_EXPORT_SNAPSHOT/SQL_RESULT_SHAPE. Saved ExecStopPost
closure proves staging resumed after **2.743 seconds**; the returned current check
confirms PM2 online and port3001 reachable. Independent timeout receipt is accepted:
serviceResult=timeout, exitCode=killed, exitStatus=KILL. The synthetic two-record
query has two physical lines and one valid JSON value. No business rows were read.
No dump or database/storage/recovery manifests exist for the failed set. Original
claim and all artifacts remain. Timer disabled/inactive, service inactive, campaigns0;
remote writes/SMTP/Telegram0. No consistent set, B2 transfer or current restore PASS.

### Concrete additional-pause plan — explicitly approved

User explicitly approved **one additional staging pause, at most120 seconds**, using
source SHA256 d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa.
This handoff is PENDING_OPERATOR_COMMAND_ADDITIONAL_CAPTURE; no operator execution
has been reported yet. Original failure artifacts and accepted guard remain retained.
The initial one-pause authorization was consumed by the closed failure; the user
explicitly prohibited automatic retries. Unchanged approved B2/restore scope does
not need reapproval. The additional-pause approval is now recorded; execute only the complete current
VPS block below once and return its sanitized output. Any STOP requires manual review.

1. Install the corrected hash-pinned capture helper exclusively under the existing
   private operator directory; preserve failed helper0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865.
   Use only explicit mode `--launch-additional-after-20261001T203612Z`.
2. Require the original claim to identify this exact failed set/unit, saved closed
   failure, accepted guard receipt and absence of capture artifacts. Require that
   failed unit is closed. Reject any conflict before a new pause. Ordinary `--launch`
   still stops on the retained original claim. Reuse the accepted timeout test;
   do not run a second timeout acceptance. The new capture unit must still verify
   its own actually applied deadline/kill/ExecStopPost properties before stopping PM2.
3. Before pausing, recheck installed preparation/reference pins, unchanged production
   backup source, source runtime/build identity, disabled reminder gates, whole-bucket
   metadata, settled workflows,51-table topology, source/config scope and free space.
   Copy the accepted five private object payloads and non-secret config into exclusive
   `/var/lib/passvero-staging-recovery/sets/<new-UTC-set-id>/` directories; no old set
   is overwritten. Recheck object bytes against the remote buckets during capture.
   Measure a **fresh DB dump while staging is online** into the new private control
   directory (60s timeout; size cap; no recovery claim). Require at least4GiB free,
   total final set at most1GiB; reserve128MiB for metadata/dump headroom. A precheck
   failure means STOP before a new pause, retaining preparation evidence.
4. Exclusively create `/var/lib/passvero-staging-recovery/additional-pause-after-20261001T203612Z.json`
   bound to the new set/unit and the SHA256 of the retained original claim. Never
   reset/delete the old claim. The new claim blocks all further attempts, including
   failed/interrupted ones; no automatic retry or deadline extension.
5. Stop only the existing staging PM2 process through the already reviewed daemon RPC.
   Keep the unchanged85s systemd capture deadline plus independent25s ExecStopPost
   resume. Verify no staging cwd workers, no external DB clients or prepared
   transactions,51 SHARE locks and unchanged table/sequence/storage state. Export
   one snapshot for dump, counters, migrations/ACL and DB–asset reconciliation.
   Capture all stored historical/current bytes in both private staging buckets,
   including originals/derivatives actually present. The four accepted cleanup
   tombstones stay absent; do not create or claim their missing bytes.
6. Resume staging on success/error/timeout/interruption; verify PM2 online and port3001,
   actual pause at most120s. Retain both failed and new sets/control evidence. No new
   restore cluster exists at this capture step. No automatic cleanup, email, job,
   production configuration, scanner/producer mutation or credential changes.
7. Only after a successful finalized set and confirmed resume, continue the already
   approved transfer to the exact existing B2 bucket prefix `passvero-staging-recovery-v1/`
   using unchanged protected credentials/password. Recheck destination identity/rights;
   ambiguity/conflict/denial means STOP, no privilege expansion. Download the real
   selected snapshot into a new exclusive private restore set, PG16 Unix socket only,
   `/var/lib/passvero-staging-recovery/restore/<new-UTC-set-id>/pgdata`, database
   `passvero_staging_recovery`. Check migrations, ownership/ACL, manifest counters,
   checksums/sizes/references and isolated product/PDF/image application reads.
   Stop that new isolated cluster afterward and on failure; retain evidence. No TCP
   listener, Supabase reupload, existing target overwrite, forget/prune or snapshot
   deletion. B2 transfer/restore get separate complete operator blocks after capture
   output; unchanged operations are already approved, not newly permission-gated.

One-off recovery proof still does not introduce an automatic staging backup schedule.
Existing production backup/freshness/Telegram schedule and previously accepted restore
proof remain unchanged. Existing reminders receipts4/replay0/stale cancellations2
remain accepted and are not repeated.

Planned source SHA256 `d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa`, not deployed. Local checks cover the exact retained
failure, changed/open failure rejection, old claim preservation, own additional claim
replay rejection, accepted guard reuse, pre-pause current measurement and original
capture transaction/guard/resume preservation. The installer below is approved for one operator execution; no privileged
operational command is executed by Codex.

### Historical VPS capture block — STOP, do not rerun

<!-- BEGIN ADDITIONAL_CAPTURE_VPS -->
```sh
sudo /usr/bin/python3 -B - <<'PY_ADDITIONAL_CAPTURE'
import base64,gzip,hashlib,json,os,pathlib,stat,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='d4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
ENCODED=(
    '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'
)
PREP='d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
REF='2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376'
OLD='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
def private(path,directory=False):
    st=path.lstat()
    require(st.st_uid==0 and not st.st_mode&0o077 and
        (stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode)),
        'PRIVATE_PATH_POSTURE')
try:
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    private(ROOT,True);private(ROOT/'operator',True)
    private(ROOT/'operator.identity.json')
    require(json.loads((ROOT/'operator.identity.json').read_text())==
        {'schema':1,'scope':'passvero-staging-recovery-v1'},'ROOT_IDENTITY')
    first=ROOT/'one-pause-approved-20261001.json';private(first)
    require(json.loads(first.read_text())=={'setId':'20261001T203612Z',
        'unit':'passvero-stage-capture-20261001T203612Z.service'},'FAILED_CLAIM_IDENTITY')
    extra=ROOT/'additional-pause-after-20261001T203612Z.json'
    require(not extra.exists() and not extra.is_symlink(),'ADDITIONAL_PAUSE_ALREADY_CLAIMED')
    for name,helper_pin in [('prepare',PREP),('references',REF),('capture',OLD)]:
        path=ROOT/'operator'/(name+'-'+helper_pin+'.py');private(path)
        require(hashlib.sha256(path.read_bytes()).hexdigest()==helper_pin,
            'RETAINED_HELPER_IDENTITY')
    source=gzip.decompress(base64.b64decode(ENCODED,validate=True))
    require(hashlib.sha256(source).hexdigest()==PIN,'REVIEWED_SOURCE_HASH')
    compile(source,'additional-capture','exec')
    target=ROOT/'operator'/('capture-'+PIN+'.py')
    if target.exists() or target.is_symlink():
        private(target);require(target.read_bytes()==source,'EXISTING_HELPER_CONFLICT')
    else:
        with open(target,'xb') as handle:
            handle.write(source);handle.flush();os.fsync(handle.fileno())
        private(target)
    print(json.dumps({'captureHelper':'REVIEWED_ADDITIONAL_CONTINUATION_INSTALLED',
        'sourceSha256':PIN,'failedClaimRetained':True,'stagingPauseRequested':False,
        'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}),flush=True)
    os.execv('/usr/bin/python3',['/usr/bin/python3','-B',str(target),
        '--launch-additional-after-20261001T203612Z'])
except BaseException as error:
    print(json.dumps({'captureInstaller':'STOP','reason':str(error) if isinstance(error,RuntimeError)
        else type(error).__name__,'stagingPauseRequested':False,'retry':'MANUAL_REVIEW_REQUIRED',
        'artifactsRetained':True,'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_ADDITIONAL_CAPTURE
```
<!-- END ADDITIONAL_CAPTURE_VPS -->

Expected sanitized output after explicit approval and operator execution: first
REVIEWED_ADDITIONAL_CONTINUATION_INSTALLED; then capture=PASS with a measured new setId,
staging=ONLINE_RESUMED and pauseSeconds<=120; independentTimeoutResumeGuard=
REUSED_ACCEPTED_20261001T203612Z, lockedTables51, outsideDbClients0,
stagingWritersDuringCapture0, reminderTimer=DISABLED_INACTIVE, campaignsEnabled0,
b2Transfer/restore=NOT_YET_RUN and remoteWrites/SMTP/Telegram0. Values are measured,
not predetermined. Any STOP means manual review, preserve artifacts and do not rerun.
If final resume is not proven, STOP and return the closure/unit output for a narrowly
scoped emergency resume of the new exact unit/set. Do not paste the old emergency
block: it selects the original claim. Never restart production or delete claims.

## Accepted read-only capture-failure review — historical block, do not rerun

The returned output installed reviewed helper0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865,
then STOP/CAPTURE_FAILED_STAGING_RESUMED_SQL_RESULT_SHAPE. This reports resume,
not complete recovery proof. The one-pause claim is retained; no capture rerun,
claim deletion/reset, new pause, B2 transfer or restore is authorized by this handoff.
The old installer/clipboard/emergency-resume blocks below are historical, not commands
to execute now. Do not rebuild/deploy a new capture launcher automatically.

Source review found the one-physical-line result assumption. PG16 json_agg(record)
adds formatting line feeds; the reference SQL aggregates composite records. Local
regression reproduced SQL_RESULT_SHAPE before correction. Only Snapshot.q now parses
the whole sentinel-framed JSON value; strict json.loads rejects multiple SQL values;
total retained JSON bytes remain bounded to32MiB. Corrected source SHA256
`73f8bbb79e493fe82ab61036dd2d5b7340b666ee37683c4dd6d68a3070a8c493`, undeployed.36 tests PASS; all other capture/guard/claim logic is identical
to the historical installed version (AST comparison excludes only Snapshot.q).
The independent timeout/resume guard is not reaccepted/repeated here.

### VPS TERMINAL — read-only retained evidence and synthetic SQL formatter proof

The complete block reads only the exact failed helper/claim/control files. It reports
the saved guard, saved closure/pause duration, current staging runtime/socket, closed
capture unit, reminder gates and retained dump/manifest presence. One small READ ONLY
SELECT on acceptance5433 aggregates two synthetic rows and reports line-count/whole
JSON parsing only. No business rows are read by the synthetic formatter probe. It
never invokes capture/stop/restart, writes a file or calls Storage/B2/SMTP/Telegram.
Syntax and3 complete local fixtures PASS (successful formatter/closure, wrong hash,
active unit); no live/privileged command executed by Codex. If the unit is still active
or helper differs, STOP before the synthetic SQL query. Return only sanitized JSON.

```sh
sudo /usr/bin/python3 -B - <<'PY_CAPTURE_STOP_REVIEW'
import hashlib,importlib.util,json,os,pathlib,socket,stat,subprocess,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PIN='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
def require(ok,reason):
    if not ok:raise RuntimeError(reason)
try:
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    helper=ROOT/'operator'/('capture-'+PIN+'.py')
    s=helper.lstat()
    require(stat.S_ISREG(s.st_mode) and s.st_uid==0 and not s.st_mode&0o077,'PRIVATE_HELPER')
    require(hashlib.sha256(helper.read_bytes()).hexdigest()==PIN,'FAILED_HELPER_HASH')
    spec=importlib.util.spec_from_file_location('failed_capture_readonly',helper)
    cap=importlib.util.module_from_spec(spec);spec.loader.exec_module(cap)
    cap.private(ROOT,True)
    require(cap.read(ROOT/'operator.identity.json')=={'schema':1,'scope':'passvero-staging-recovery-v1'},'ROOT_IDENTITY')
    claim=cap.read(ROOT/'one-pause-approved-20261001.json');sid=claim['setId']
    work,control=cap.validate_context(sid)
    require(claim['unit']=='passvero-stage-capture-'+sid+'.service','CLAIM_UNIT_IDENTITY')
    selected=cap.read(control/'selected.json')
    require(selected['unit']==claim['unit'] and selected['setId']==sid,'SELECTED_UNIT_IDENTITY')
    failure=cap.read(control/'failure-capture.json')
    require(failure.get('reason')=='SQL_RESULT_SHAPE','OTHER_CAPTURE_FAILURE')
    closure=cap.read(control/'closure.json')
    guard=cap.read(control/'guard-proof.json')
    result=subprocess.run(['/usr/bin/systemctl','show',claim['unit'],
        '--property=LoadState,ActiveState,SubState,Result,ExecMainStatus,InvocationID'],
        capture_output=True,text=True,timeout=5,check=True)
    unit=dict(x.split('=',1) for x in result.stdout.splitlines() if '=' in x)
    require(unit.get('ActiveState') in ('inactive','failed'),'CAPTURE_UNIT_NOT_CLOSED')
    prepare,_=cap.helpers()
    process,_=prepare.runtime()
    with socket.create_connection(('127.0.0.1',3001),timeout=1):pass
    cap.gates(prepare)
    query="BEGIN READ ONLY;SET LOCAL statement_timeout='2s';SELECT json_build_object('references',(SELECT json_agg(r) FROM (VALUES (1),(2)) AS r(id)),'enabledCampaigns',0);ROLLBACK;"
    probe=subprocess.run([cap.PG+'psql','-XqAt','-h','/var/run/postgresql','-p','5433',
        '-U','postgres','-d','passvero_acceptance','-v','ON_ERROR_STOP=1','-c',query],
        stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,timeout=5,**prepare.account('postgres'),
        env={'PATH':'/usr/bin:/bin','LANG':'C','PGAPPNAME':'passvero_capture_readonly_diagnostic'})
    require(probe.returncode==0,'SYNTHETIC_READ_ONLY_SQL_PROBE_FAILED')
    rows=[x for x in probe.stdout.splitlines() if x]
    parsed=json.loads(probe.stdout)
    require(parsed=={'references':[{'id':1},{'id':2}],'enabledCampaigns':0},'SYNTHETIC_SQL_VALUE')
    names={'dump':'database/passvero_acceptance.dump','databaseManifest':'database/manifest.json',
        'storageManifest':'storage/manifest.json','recoverySetManifest':'recovery-set.json'}
    files={}
    for name,relative in names.items():
        path=work/relative;present=path.exists() or path.is_symlink()
        if present:cap.private(path)
        files[name]={'exists':present,'bytes':path.stat().st_size if present else 0}
    print(json.dumps({'diagnostic':'READ_ONLY_CAPTURE_FAILURE_COMPLETE','setId':sid,
        'failedPhase':failure.get('phase'),'failureReason':'SQL_RESULT_SHAPE','unit':unit,
        'savedClosure':{k:closure.get(k) for k in ('stagingPauseRequested','stagingResumed',
            'pauseSeconds','pm2Online','port3001Reachable','serviceResult')},
        'savedGuardProof':guard,'stagingOnlineNow':process['status']=='online',
        'port3001ReachableNow':True,'reminderTimer':'DISABLED_INACTIVE','reminderService':'INACTIVE',
        'campaignsEnabled':0,'retainedFiles':files,
        'syntheticSqlProbe':{'physicalNonemptyLines':len(rows),'oldParserWouldReject':len(rows)!=1,
            'wholeJsonValueParserPass':True,'businessRowsRead':0},
        'claimRetained':True,'captureRerun':False,'newPauseRequested':False,
        'writes':'NONE','remoteWrites':0,'smtpCalls':0,'telegramCalls':0}))
except BaseException as error:
    print(json.dumps({'diagnostic':'STOP','reason':str(error) if isinstance(error,RuntimeError)
        else type(error).__name__,'writes':'NONE','captureRerun':False,'newPauseRequested':False,
        'remoteWrites':0,'smtpCalls':0,'telegramCalls':0,'retry':'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_CAPTURE_STOP_REVIEW
```

Expected sanitized result: READ_ONLY_CAPTURE_FAILURE_COMPLETE, actual setId and
saved failure phase/closure/pauseSeconds, stagingOnlineNow=true, port3001 reachable,
reminder timer disabled/inactive/service inactive/campaigns0; synthetic formatter
physicalNonemptyLines>1, oldParserWouldReject=true, wholeJsonValueParserPass=true.
All write/pause/rerun/provider/send fields are zero/false; claim stays retained.
This result must be observed, not prefilled. A diagnostic STOP requires review.

If the retained failure confirms a performed pause, completion requires one separately
approved additional bounded pause. Do not treat the original one-pause approval or
routine source-fix authority as permission for another interruption. Specify the new
capture scope/claim explicitly after returned diagnostic, preserve the failed set,
reuse accepted preparation/reference/guard evidence when unchanged, then obtain that
concrete approval before running a corrected capture. No production or schedule work.

## Historical continuation — capture attempted and stopped; do not rerun

The returned reference preflight PASS for preparation20261001T190516Z confirms9 DB
references,5 matching stored objects,4 exact previously accepted cleanup tombstones
(2959 absent bytes), and0 unreferenced stored objects. No pause/provider write occurred.
The next operation consumes at most the single approved staging pause. Do not repeat
preparation/reference acceptance or deleted-object cleanup. No automatic retry.

Reviewed source: `scripts/staging-recovery/capture.py`, SHA256 `0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865`;
reference helper SHA256 `2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376`;
existing preparation SHA256 `d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473`.
The installer verifies private root identity, existing preparation/helper hashes, and
installs only new exclusive root0600 versioned operator files. No environment,
credential, rights, app source, scanner/producer or production job changes.

Before pause: verify free≥4GiB, measured set≤1GiB, unchanged build/inventory and
prepared byte checksums,51 source tables, no pending document/image workflow,
reminder timer disabled/inactive and0 enabled campaigns. Capture only targets
acceptance5433, never production5432. PM2 control connects to the existing staging
daemon RPC socket, validates the one staging app/id/cwd and stops/restarts that id
without changing its environment or spawning a daemon in the transient unit.

A separate transient guard proof intentionally times out after1s and verifies
ExecStopPost ran with timeout/killed/KILL; it never pauses the app. Unsupported
systemd behavior means STOP before the pause. No timer/recurring job is installed.
The capture unit has Type=exec, Restart=no, KillMode=control-group,
KillSignal=SIGKILL, RuntimeMaxSec=85s and TimeoutStopSec=25s. Its independent
ExecStopPost resumes the same staging app on success, failure or capture kill,
including terminal/launcher interruption. The85+25=110s service bound leaves margin
under the approved120s pause. The actual pause duration and app PID/runtime/socket
readiness are verified; failed resume is STOP and remains evidence, never PASS.
The exclusive one-pause claim prohibits another capture automatically.

During pause: no remaining staging-user processes with app cwd; SHARE NOWAIT locks
all51 public tables before any repeatable-read SELECT; no other acceptance DB client
or prepared transaction; one exported snapshot for dump/counts/migrations/catalog,
ACLs and DB–asset references; sequences stable. Both whole private bucket metadata
inventories remain identical, and every prepared object's current remote bytes match
size/SHA256. This is writer closure of the observed staging application/DB scope plus
before/after Storage metadata and byte evidence, not a provider-wide Storage lock.
No Supabase policies/permissions change. Unexplained concurrent clients or mutations
mean STOP. Previously accepted cleanup rows stay in DB; absent bytes aren't invented.

Dump work is bounded inside the capture unit. It releases the exporter on ordinary
failure; the hard timeout kills only unit client processes. Resume occurs before dump
TOC/hash and linked DB/Storage/nonsecret configuration manifests are finalized.
The core/configuration/protected control evidence is retained under:
`/var/lib/passvero-staging-recovery/sets/<new-UTC-set-id>/` and
`/var/lib/passvero-staging-recovery/control/<new-UTC-set-id>/`.
This is a new current capture id;20261001T190516Z remains the unpaused preparation id.
The manifest includes build/launcher/PM2 action hashes, PG settings/HBA methods and
option names, runtime origins/buckets/roles, scanner paths/signature configuration;
no connection credentials/passwords/secret values. Secrets require independent
protected escrow; old scanner health evidence never becomes fresh restored trust.

### LOCAL MAC TERMINAL — exact clipboard handoff

Copy only the Python command below. It reads the complete reviewed VPS block from
this runbook, verifies its exact hash, copies it and checks the clipboard. It does not
run sudo/SSH or perform server operations. Then paste the clipboard once at the VPS
prompt. Do not paste headings, expected JSON or Markdown fences into either terminal.

```sh
python3 - <<'PY_COPY_APPROVED_CAPTURE'
import hashlib,pathlib,subprocess
path=pathlib.Path('/Users/darkozivic/Desktop/Programiranje/passvero/docs/superpowers/runbooks/existing-backup-coverage-staging-recovery.md')
text=path.read_text()
part=text.split('\n<!-- BEGIN APPROVED_CAPTURE_VPS -->\n',1)[1].split('\n<!-- END APPROVED_CAPTURE_VPS -->',1)[0]
block=part.split('```sh\n',1)[1].rsplit('```',1)[0]
assert hashlib.sha256(block.encode()).hexdigest()=='baf52acf8be2769fc6756de0d059109f0b179db930dacdaf9c8518a67c0f6a05','REVIEWED_BLOCK_CHANGED'
subprocess.run(['/usr/bin/pbcopy'],input=block.encode(),check=True)
assert subprocess.run(['/usr/bin/pbpaste'],capture_output=True,check=True).stdout==block.encode(),'CLIPBOARD_MISMATCH'
print('CAPTURE_ONLY_CLIPBOARD=READY; VPS_COMMAND=PENDING_OPERATOR_COMMAND')
PY_COPY_APPROVED_CAPTURE
```

### VPS TERMINAL — complete reviewed command, run once

<!-- BEGIN APPROVED_CAPTURE_VPS -->
```sh
sudo /usr/bin/python3 -B - <<'PY_APPROVED_CAPTURE'
import base64,gzip,hashlib,json,os,pathlib,stat,sys
ROOT=pathlib.Path('/var/lib/passvero-staging-recovery')
PREP_PIN='d519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
CAP_PIN='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
PAYLOADS=[
    ['references', '2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376',
        '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'
    ],
    ['capture', '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'
    ]
]

def require(ok,reason):
    if not ok:raise RuntimeError(reason)

def private(path,directory=False):
    st=path.lstat()
    require(st.st_uid==0 and not st.st_mode & 0o077 and
        (stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode)),'PRIVATE_PATH_POSTURE')

try:
    os.umask(0o077)
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    private(ROOT,True);private(ROOT/'operator',True)
    private(ROOT/'operator.identity.json')
    require(json.loads((ROOT/'operator.identity.json').read_text())==
        {'schema':1,'scope':'passvero-staging-recovery-v1'},'ROOT_IDENTITY')
    require(not (ROOT/'one-pause-approved-20261001.json').exists(),'ONE_PAUSE_ALREADY_CLAIMED')
    prior=ROOT/'operator'/('prepare-'+PREP_PIN+'.py');private(prior)
    require(hashlib.sha256(prior.read_bytes()).hexdigest()==PREP_PIN,'PREPARATION_HELPER_IDENTITY')
    for name,pin,encoded in PAYLOADS:
        source=gzip.decompress(base64.b64decode(encoded,validate=True))
        require(hashlib.sha256(source).hexdigest()==pin,'REVIEWED_SOURCE_HASH')
        compile(source,name,'exec')
        target=ROOT/'operator'/(name+'-'+pin+'.py')
        if target.exists() or target.is_symlink():
            private(target)
            require(target.read_bytes()==source,'EXISTING_HELPER_CONFLICT')
        else:
            with open(target,'xb') as handle:
                handle.write(source);handle.flush();os.fsync(handle.fileno())
            private(target)
    print(json.dumps({'captureHelper':'REVIEWED_INSTALLED','sourceSha256':CAP_PIN,
        'stagingPauseRequested':False,'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}),flush=True)
    target=ROOT/'operator'/('capture-'+CAP_PIN+'.py')
    os.execv('/usr/bin/python3',['/usr/bin/python3','-B',str(target),'--launch'])
except BaseException as error:
    print(json.dumps({'captureInstaller':'STOP','reason':str(error) if isinstance(error,RuntimeError)
        else type(error).__name__,'stagingPauseRequested':False,'retry':'MANUAL_REVIEW_REQUIRED',
        'artifactsRetained':True,'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}))
    sys.exit(1)
PY_APPROVED_CAPTURE
```
<!-- END APPROVED_CAPTURE_VPS -->

Expected sanitized success (new set ID, pause and payload are measured):

```json
{"captureHelper":"REVIEWED_INSTALLED","sourceSha256":"0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865","stagingPauseRequested":false,"remoteWrites":0,"smtpCalls":0,"telegramCalls":0}
{"capture":"PASS","setId":"<new-UTC-set-id>","staging":"ONLINE_RESUMED","pauseSeconds":"<=120 measured","independentTimeoutResumeGuard":"PASS_LIVE_NO_PAUSE_PROOF","lockedTables":51,"outsideDbClients":0,"stagingWritersDuringCapture":0,"storageMetadataAndBytesUnchanged":true,"databaseAssetReferences":9,"storageObjects":5,"acceptedCleanupTombstones":4,"payloadBytes":"<=1073741824 measured","b2Transfer":"NOT_YET_RUN","restore":"NOT_YET_RUN","reminderTimer":"DISABLED_INACTIVE","campaignsEnabled":0,"remoteWrites":0,"smtpCalls":0,"telegramCalls":0,"automaticRetry":false}
```

Return only sanitized PASS/STOP JSON. If STOP, do not rerun capture, broaden rights or
extend pause. The systemd post-stop callback runs independently of the terminal.
A STOP without staging closure must be reviewed as a resume failure. No remote
repository/snapshot/restore cluster is created by this block. B2 transfer and real
isolated restore follow only after this operator output. Production daily backup,
hourly freshness, Telegram and reminders sending gates remain unchanged; one-off
capture is not a staging backup schedule.

### VPS TERMINAL — manual emergency resume only, never rerun capture

Use only if capture stopped and its independent post-stop did not prove resume.
This waits for no running capture: active/activating/deactivating state is STOP.
It verifies the exact claimed unit/helper/private identity. If a closure already
exists it prints that closure and performs no app action; otherwise it invokes only
--resume on the claimed id, using the existing PM2 daemon, and prints the closure.
No data deletion, new cluster or capture retry. Return the sanitized result for review.

```sh
sudo /usr/bin/python3 -B - <<'PY_MANUAL_CAPTURE_RESUME'
import hashlib,json,os,pathlib,re,stat,subprocess,sys
root=pathlib.Path('/var/lib/passvero-staging-recovery')
pin='0278b8c57cd609bbedcb42ab2d39c614ff2b8e7cc979b1a5e0eec25b5e279865'
def read(path):
    st=path.lstat()
    assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and not st.st_mode&0o077
    return json.loads(path.read_text())
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
    assert read(root/'operator.identity.json')=={'schema':1,'scope':'passvero-staging-recovery-v1'}
    claim=read(root/'one-pause-approved-20261001.json');sid=claim['setId']
    assert re.fullmatch(r'[0-9]{8}T[0-9]{6}Z',sid)
    assert claim['unit']=='passvero-stage-capture-'+sid+'.service'
    state=subprocess.run(['/usr/bin/systemctl','show',claim['unit'],'--property=ActiveState','--value'],capture_output=True,timeout=5,check=True).stdout.decode().strip()
    assert state in ('inactive','failed'),'CAPTURE_UNIT_STILL_RUNNING_OR_UNKNOWN'
    closure=root/'control'/sid/'closure.json'
    if not closure.exists():
        helper=root/'operator'/('capture-'+pin+'.py');st=helper.lstat()
        assert stat.S_ISREG(st.st_mode) and st.st_uid==0 and not st.st_mode&0o077
        assert hashlib.sha256(helper.read_bytes()).hexdigest()==pin
        result=subprocess.run(['/usr/bin/python3','-B',str(helper),'--resume',sid],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=27)
        assert result.returncode==0,'MANUAL_RESUME_FAILED'
    print(json.dumps({'manualResume':read(closure),'captureRerun':False,'remoteWrites':0,'smtpCalls':0,'telegramCalls':0}))
except BaseException as error:
    print(json.dumps({'manualResume':'STOP','reason':type(error).__name__,'retry':'MANUAL_REVIEW_REQUIRED','artifactsRetained':True}))
    sys.exit(1)
PY_MANUAL_CAPTURE_RESUME
```

## Historical command — reference preflight now PASS (do not rerun)

Preparation20261001T190516Z is PASS,5 objects6145B, measured dump584515B,
free88657485824B, app unpaused, prefix readable/empty, no remote writes/email/Telegram.
Do not repeat preparation, diagnostics or accepted cleanup. The earlier DB inventory
also includes4 ARCHIVED PDF rows; verify whether they are the accepted exact cleanup
3+1 tombstones before consuming the only pause. Missing ordinary history is blocking.

This source hashes every prepared object, reads current references on acceptance5433
in READ ONLY, then reconciles sizes/SHA and accepted cleanup identity/link/audit/state.
It never deletes data, ignores unknown missing archives, calls Storage/B2, pauses the
app or runs a business job. Only a new protected reference-preflight.json is written.
No current consistent capture/application restore claim. Reference source SHA256
`2c45d84089e9960681b3318fa4ed2d5c3021eb2453aad70737ef6d69404ae376`;19 local tests PASS, syntax PASS; live reference result pending.

Copy only this block's contents; return the sanitized JSON, not the private manifest.

```sh
sudo python3 - <<'PY_RECOVERY_REFERENCES'
"""Pre-pause DB/byte reconciliation; no app pause, provider writes or cleanup."""
import hashlib
import importlib.util
import json
import os
import pathlib
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET_ID = '20261001T190516Z'
PREP_PIN = 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
FIRST_RUN = '80365265-5090-4d8e-88c5-327897caed67'
SECOND_RUN = '150b0aaa-f3f4-4ed5-894e-7d66083c3a2e'
SECOND_DOCUMENT = 'fb953a8d-5f0b-4677-8330-fd3004533013'
SECOND_SHA = '98c913ee16f40bf9aeb51d3ec924d015a711cb8482b689fbb1987f6c6d9ff4b2'


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def reconcile(objects, rows):
    indexed = {(x['bucket'], x['key']): x for x in objects}
    require(len(indexed) == len(objects), 'DUPLICATE_PREPARED_OBJECT')
    require(len({(x['bucket'], x['key']) for x in rows}) == len(rows), 'DUPLICATE_DB_REFERENCE')
    matched = set()
    tombstones = []
    first = 0
    second = 0
    for row in rows:
        require(row['provider'] == 'supabase' and row['bucket'] in
                ('passvero-staging-documents', 'passvero-staging-images'), 'REFERENCE_SCOPE')
        key = (row['bucket'], row['key'])
        if key in indexed:
            item = indexed[key]
            require(int(row['bytes']) == item['size'] and row['sha256'] == item['sha256'],
                    'DB_PREPARED_BYTES_MISMATCH')
            matched.add(key)
            continue
        require(row['kind'] == 'document' and row['state'] == 'ARCHIVED'
                and row['archived'] is True and row['same_actor'] is True
                and row['links'] == 0 and row['audits'] > 0
                and row['scan_state'] in ('UNSCANNED', 'CLEAN', 'INFECTED', 'ERROR'),
                'MISSING_RETAINED_ASSET')
        marker = row['acceptance_marker']
        if marker == 'acceptance:' + FIRST_RUN:
            first += 1
            require(first <= 3, 'ACCEPTED_CLEANUP_COUNT_CONFLICT')
        elif marker == 'acceptance:' + SECOND_RUN:
            require(row['id'] == SECOND_DOCUMENT and int(row['bytes']) == 750
                    and row['sha256'] == SECOND_SHA and row['scan_state'] == 'CLEAN'
                    and row['policy'] == 2, 'ACCEPTED_CLEANUP_IDENTITY_CONFLICT')
            second += 1
            require(second == 1, 'ACCEPTED_CLEANUP_COUNT_CONFLICT')
        else:
            raise RuntimeError('MISSING_UNEXPLAINED_ARCHIVED_ASSET')
        tombstones.append({'id': row['id'], 'reason': 'PRIOR_ACCEPTED_EXACT_CLEANUP',
                           'runId': marker.split(':', 1)[1], 'bytesNotRetained': int(row['bytes'])})
    return {'matchedReferences': len(matched), 'acceptedCleanupTombstones': tombstones,
            'unreferencedStoredObjects': len(indexed.keys() - matched)}


QUERY = '''SELECT json_build_object('references',(
 SELECT coalesce(json_agg(r ORDER BY kind,id),'[]'::json) FROM (
  SELECT 'document'::text AS kind,d.id::text AS id,d."storageProvider" AS provider,
   d."storageBucket" AS bucket,d."storageKey" AS key,d."sizeBytes"::text AS bytes,
   d."checksumSha256" AS sha256,d.status::text AS state,d."displayName" AS acceptance_marker,
   (d."archivedAt" IS NOT NULL) AS archived,
   (d."createdById"=d."archivedById" AND d."archivedById"=d."updatedById") AS same_actor,
   d."malwareScanStatus"::text AS scan_state,d."malwarePolicyVersion" AS policy,
   (SELECT count(*) FROM "ProductDocument" pd WHERE pd."documentId"=d.id) AS links,
   (SELECT count(*) FROM "AuditLog" a WHERE a."entityType"='DOCUMENT'
       AND a."entityId"=d.id::text AND a."organizationId"=d."organizationId") AS audits
  FROM "Document" d
  UNION ALL
  SELECT 'image',i.id::text,i."storageProvider",i."storageBucket",i."storageKey",
   i."sizeBytes"::text,i."checksumSha256",i.state,NULL,false,false,NULL,NULL,
   (SELECT count(*) FROM "ProductImage" pi WHERE pi."assetId"=i.id),0::bigint
  FROM "ProductImageAsset" i
 ) r), 'enabledCampaigns',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled))'''


def main():
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    helper = ROOT / 'operator' / ('prepare-' + PREP_PIN + '.py')
    info = helper.lstat()
    require(helper.is_file() and not helper.is_symlink() and info.st_uid == 0
            and not info.st_mode & 0o077 and hashlib.sha256(helper.read_bytes()).hexdigest() == PREP_PIN,
            'PREPARATION_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location('approved_prepare', helper)
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    work = ROOT / 'preparation' / SET_ID
    state = json.loads(prepare.protected(work / 'prepared.json'))
    require(state['setId'] == SET_ID and state['scope'] == 'passvero-staging-recovery-v1'
            and state['captureCompleted'] is False, 'PREPARATION_IDENTITY')
    for item in state['objects']:
        name = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        require(item['file'] == name, 'LOCAL_OBJECT_PATH')
        data = prepare.protected(work / 'objects' / name)
        require(len(data) == item['size'] and hashlib.sha256(data).hexdigest() == item['sha256'],
                'LOCAL_OBJECT_BYTES_CHANGED')
    result = prepare.sql(QUERY)
    require(result['enabledCampaigns'] == 0, 'REMINDER_CAMPAIGN_SCOPE')
    reconciliation = reconcile(state['objects'], result['references'])
    prepare.store(work / 'reference-preflight.json', {
        'setId': SET_ID, 'references': result['references'], 'reconciliation': reconciliation,
        'evidenceLevel': 'PRE_PAUSE_READ_ONLY; RECHECK_IN_CONSISTENT_CAPTURE_REQUIRED'})
    print(json.dumps({'referencePreflight': 'PASS', 'setId': SET_ID,
        'databaseAssetReferences': len(result['references']),
        'matchedStoredReferences': reconciliation['matchedReferences'],
        'acceptedCleanupTombstones': len(reconciliation['acceptedCleanupTombstones']),
        'tombstoneBytesNotPresent': sum(x['bytesNotRetained'] for x in reconciliation['acceptedCleanupTombstones']),
        'unreferencedStoredObjects': reconciliation['unreferencedStoredObjects'],
        'consistentCapture': 'NOT_YET_RUN', 'stagingPauseRequested': False,
        'remoteWrites': 0, 'smtpCalls': 0, 'telegramCalls': 0}))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        print(json.dumps({'referencePreflight': 'STOP',
            'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__,
            'stagingPauseRequested': False, 'remoteWrites': 0, 'smtpCalls': 0,
            'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED', 'artifactsRetained': True}))
        sys.exit(1)
PY_RECOVERY_REFERENCES
```

If current references match accepted history, expect referencePreflightPASS,
matchedStoredReferences5, acceptedCleanupTombstones4, tombstoneBytesNotPresent2959,
unreferencedStoredObjects0, consistentCaptureNOT_YET_RUN and no pause/remote writes/
email/Telegram. Those expected counters are a hypothesis, not manufactured proof.
Any mismatch is STOP/manual review. Later capture must recheck references under its
writer-closure locks and independently guarantee app resume within120 seconds.

## Historical repair/preparation handoff — received PASS, DO NOT RERUN

## VPS TERMINAL — PENDING_OPERATOR_COMMAND_REPAIR_EXISTING_RESTIC_AND_PREPARATION

Returned dependency evidence confirms `/usr/bin/restic` absent and the existing
`/usr/local/bin/restic` root0755 executable; all three existing private config inputs
root0600 and production source pin unchanged. Manual review identified the exact cause.
Correct only the operator helper's client path; retain every old artifact. No new
client, rights change, config/secret edit, production validator change or email retry.
Source11/11 tests PASS, before-fix regression reproduced, old→new pinned one-path
transformation and complete local handoff fixture PASS. This is not live acceptance.

Run this short block once, copying only its contents. It checks private root identity,
old hash and new exact payload hash; creates a new versioned helper without overwriting
the old one, then invokes corrected preparation. No pause/init/B2 upload/restore occurs.
The original long installer and prior diagnostic blocks below are historical; do not
copy/run them. Return the emitted sanitized repair + preparation JSON only.

```sh
sudo python3 - <<'PY_REPAIR_EXISTING_RESTIC'
import hashlib, json, os, pathlib, stat, sys

OLD = 'f344ef9d17e58ff7c77c9cf9b07be36dddc77a71a95ce021bc61920347236122'
NEW = 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')

def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)

def private(path, directory=False):
    info = path.lstat()
    require(info.st_uid == 0 and not info.st_mode & 0o077 and (
        stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)
    ), 'PRIVATE_PATH_POSTURE')

try:
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    private(ROOT, True)
    marker = ROOT / 'operator.identity.json'
    private(marker)
    require(json.loads(marker.read_text()) == {
        'schema': 1, 'scope': 'passvero-staging-recovery-v1'
    }, 'WORKROOT_IDENTITY')
    helpers = ROOT / 'operator'
    private(helpers, True)
    client = pathlib.Path('/usr/local/bin/restic')
    info = client.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0
        and not info.st_mode & 0o022 and os.access(client, os.X_OK), 'EXISTING_CLIENT_POSTURE')
    old = helpers / ('prepare-' + OLD + '.py')
    private(old)
    payload = old.read_bytes()
    require(hashlib.sha256(payload).hexdigest() == OLD, 'OLD_HELPER_HASH')
    require(payload.count(b"'/usr/bin/restic'") == 1, 'EXACT_PATCH_SCOPE')
    payload = payload.replace(b"'/usr/bin/restic'", b"'/usr/local/bin/restic'")
    require(hashlib.sha256(payload).hexdigest() == NEW, 'NEW_HELPER_HASH')
    compile(payload, '<reviewed-restic-path-fix>', 'exec')
    target = helpers / ('prepare-' + NEW + '.py')
    if target.exists() or target.is_symlink():
        private(target)
        require(target.read_bytes() == payload, 'EXISTING_HELPER_CONFLICT')
    else:
        with open(target, 'xb') as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    print(json.dumps({'repair': 'EXISTING_RESTIC_PATH_ONLY_PASS',
        'oldArtifactsRetained': True, 'stagingPauseRequested': False,
        'remoteWrites': 0, 'smtpCalls': 0, 'telegramCalls': 0}), flush=True)
    os.execv('/usr/bin/python3', ['/usr/bin/python3', '-B', str(target)])
except BaseException as error:
    reason = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    print(json.dumps({'repair': 'STOP', 'reason': reason,
        'stagingPauseRequested': False, 'remoteWrites': 0,
        'smtpCalls': 0, 'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_REPAIR_EXISTING_RESTIC
```

Expected first `repair=EXISTING_RESTIC_PATH_ONLY_PASS`, then `preparation=PASS` with
new measured setId/counts/sizes, `staging=ONLINE_UNPAUSED` and `remoteWrites=0`.
Preparation may instead STOP for a newly observed incompatibility/access/size issue;
return that reason for review, do not repeat or widen permissions. No current recovery
PASS or automated staging schedule is inferred. Await output before consistent capture.

## Historical dependency diagnosis — received and resolved, DO NOT RERUN

## VPS TERMINAL — PENDING_OPERATOR_COMMAND_PREPARATION_DEPENDENCIES

Preparation returned STOP/FileNotFoundError in B2_EXACT_PREFIX_READ_ONLY; no pause
was requested, remote writes/email/Telegram0, partial artifacts retained. Do not rerun
preparation, install a client, recreate credentials, widen rights or alter production.
Check only the three protected input paths and the existing installed restic path.
This block reads file metadata and the already reviewed production script hash; it
reads no secret values and invokes no restic, B2, DB, Storage, service or PM2 commands.
Syntax and four local metadata fixtures PASS; live result remains pending.

Copy only the shell block contents. Do not copy Markdown fences, headings, expected
JSON or other runbook text into the shell. Return only the emitted sanitized JSON.

```sh
sudo python3 - <<'PY_PREPARATION_DEPENDENCIES'
import hashlib, json, os, pathlib, shutil, stat

def metadata(path):
    p = pathlib.Path(path)
    try:
        info = p.lstat()
    except FileNotFoundError:
        return {'exists': False}
    result = {'exists': True, 'symlink': stat.S_ISLNK(info.st_mode),
              'regular': stat.S_ISREG(info.st_mode), 'uid': info.st_uid,
              'mode': oct(stat.S_IMODE(info.st_mode))}
    if result['symlink']:
        target = p.resolve(strict=True)
        result['resolvedPath'] = str(target)
        info = target.stat()
        result['targetUid'] = info.st_uid
        result['targetMode'] = oct(stat.S_IMODE(info.st_mode))
        result['targetRegular'] = stat.S_ISREG(info.st_mode)
    result['executable'] = os.access(p, os.X_OK)
    return result

def main():
    if os.geteuid() != 0 or os.uname().nodename != 'srv1834647':
        raise RuntimeError('OPERATOR_HOST')
    paths = ('/etc/passvero/backup/restic-repository',
             '/etc/passvero/backup/restic-password', '/etc/passvero/backup/restic.env')
    binary = shutil.which('restic', path='/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin')
    source = pathlib.Path('/usr/local/sbin/passvero-postgres-backup')
    print(json.dumps({'diagnostic': 'READ_ONLY_PREPARATION_DEPENDENCIES',
        'requiredFiles': {p: metadata(p) for p in paths},
        'hardcodedRestic': {'path': '/usr/bin/restic', **metadata('/usr/bin/restic')},
        'existingRestic': None if binary is None else {'path': binary, **metadata(binary)},
        'productionSourcePinMatches': hashlib.sha256(source.read_bytes()).hexdigest()
            == '5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75',
        'secretValuesRead': False, 'writes': 'NONE', 'resticCalls': 0, 'b2Calls': 0,
        'stagingPauseRequested': False, 'smtpCalls': 0, 'telegramCalls': 0}))

if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        print(json.dumps({'diagnostic': 'STOP', 'reason': type(error).__name__,
            'writes': 'NONE', 'resticCalls': 0, 'b2Calls': 0,
            'stagingPauseRequested': False, 'smtpCalls': 0, 'telegramCalls': 0}))
PY_PREPARATION_DEPENDENCIES
```

Expected `diagnostic=READ_ONLY_PREPARATION_DEPENDENCIES`, presence/posture flags,
resolved existing restic path (or null), pinned source-match boolean, writesNONE,
resticCalls0, b2Calls0, no pause/email/Telegram. These are measured flags, not a
predetermined success. This is a dependency diagnosis only, not a preparation retry.
Wait for operator output before correcting the verified local client dependency.

## Previous preparation handoff — DO NOT RERUN after STOP

## Latest returned output — preparation still pending

The attached 2026-10-01T18:25:29Z JSON is the former inventory format
`diagnostic=READ_ONLY_COMPLETE`, not a `preparation=PASS/STOP` response. Preserve its
successful 20:00 CEST freshness invocation and unchanged script hash, but do not proceed
to capture based on it. Do not rerun historical inventory blocks. Use only the pinned
preparation block immediately below, then return its sanitized JSON. No second
approval is requested; this remains the existing approved operational series.

## VPS TERMINAL — PENDING_OPERATOR_COMMAND_PREPARATION

The user approved the concrete operational plan and limits on 2026-10-01.
Run this block **once** in the existing `darko@srv1834647` terminal. It installs only
a pinned, private operator helper and performs the preparatory phase with the staging
app online. It does not pause/restart the app, initialize/upload a repository, restore,
activate jobs, send email/Telegram, edit credentials or execute the production backup.
Root access is operator-supplied; Codex does not execute sudo.

The complete reviewed helper is embedded below; its SHA256 is `f344ef9d17e58ff7c77c9cf9b07be36dddc77a71a95ce021bc61920347236122`.
Local source: `scripts/staging-recovery/prepare.py`; ten local tests pass, including
full mocked preparation and denied B2 prefix access. These are not live recovery proof.

Checks include the pinned existing production implementation, exact acceptance DB,
reminder gates, private bucket identity, exact approved B2 sibling prefix and existing
repository identity. B2 reads explicitly use no cache/no lock. An inaccessible prefix,
repository conflict or unknown destination stops before source byte downloads/dump.
No permission widening or production validator changes are attempted.

Entire bucket inventory is recursively paginated, including historical folders;
all listed object bytes are downloaded into protected preparation files and hashed.
A separate `measurement.dump` measures size while the application stays online.
These preparation files **are not a consistent recovery set**. A source change during
preparation is checked again during the later approved consistent capture. Before any
pause, storage plus measured dump must be below 1 GiB, physical source-size precheck
must pass, and free space must remain at least 4 GiB. Space/size failure is STOP.

The protected location is `/var/lib/passvero-staging-recovery/preparation/<UTC-set-id>/`.
Partial files remain after any STOP. Do not paste private manifests, object names,
dump contents or credentials into chat. Return only the emitted sanitized JSON.
If a compatible existing staging repository has snapshots, the returned count is
reviewed before a new capture; preparation does not claim those snapshots are current.

```sh
sudo python3 - <<'PY_APPROVED_PREPARATION'
import hashlib, json, os, pathlib, stat, sys
SOURCE = r'''"""Operator-only preparation. No pause, repo init/upload, restore or business writes."""
import datetime
import hashlib
import hmac
import json
import os
import pathlib
import pwd
import re
import resource
import shlex
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

GIB = 1024 ** 3
ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
APP = pathlib.Path('/var/www/passvero-acceptance')
BUCKETS = ('passvero-staging-documents', 'passvero-staging-images')
PREFIX = 'passvero-staging-recovery-v1'
PIN = '5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75'
PHASE = 'BOOTSTRAP'


class Stop(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Stop(reason)


def protected(path):
    p = pathlib.Path(path)
    st = p.lstat()
    require(p.is_file() and not p.is_symlink() and st.st_uid == 0
            and not st.st_mode & 0o077, 'PROTECTED_INPUT_POSTURE')
    return p.read_bytes()


def store(path, value):
    with open(path, 'x', encoding='utf8') as handle:
        json.dump(value, handle, sort_keys=True, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=30, **kwargs)
    require(result.returncode == 0, 'COMMAND_FAILED')
    return result.stdout


def account(name):
    a = pwd.getpwnam(name)
    return dict(user=a.pw_uid, group=a.pw_gid,
                extra_groups=os.getgrouplist(name, a.pw_gid), cwd='/')


def sql(query):
    return json.loads(run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql',
                          '-p', '5433', '-d', 'passvero_acceptance',
                          '-v', 'ON_ERROR_STOP=1', '-c',
                          "BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; "
                          + query + '; ROLLBACK;'],
                          **account('postgres'), env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}))


def runtime():
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd,pmId:p.pm2_env.pm_id}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    rows = json.loads(run(['/usr/bin/node', '-e', probe], **account('passvero-staging'),
                          env={'PATH': '/usr/bin:/bin'}))
    require(len(rows) == 1 and rows[0]['name'] == 'passvero-acceptance'
            and rows[0]['status'] == 'online' and rows[0]['cwd'] == str(APP), 'APP_SCOPE')
    proc = pathlib.Path('/proc') / str(rows[0]['pid'])
    require(proc.stat().st_uid == pwd.getpwnam('passvero-staging').pw_uid
            and (proc / 'cwd').resolve() == APP, 'APP_PID_SCOPE')
    raw = dict(x.split(b'=', 1) for x in (proc / 'environ').read_bytes().split(b'\0') if b'=' in x)
    keys = ('PASSVERO_RUNTIME_ENV', 'BETTER_AUTH_URL', 'DATABASE_URL', 'AUTH_DATABASE_URL',
            'DOCUMENT_STORAGE_SUPABASE_URL', 'DOCUMENT_STORAGE_SUPABASE_KEY', 'DOCUMENT_STORAGE_BUCKET')
    env = {k: raw[k.encode()].decode() for k in keys}
    require(env['PASSVERO_RUNTIME_ENV'] == 'staging'
            and env['BETTER_AUTH_URL'] == 'https://staging.passvero.eu'
            and env['DOCUMENT_STORAGE_BUCKET'] == BUCKETS[0], 'RUNTIME_SCOPE')
    for key in ('DATABASE_URL', 'AUTH_DATABASE_URL'):
        uri = urllib.parse.urlsplit(env[key])
        require(uri.hostname in ('127.0.0.1', 'localhost') and uri.port == 5433
                and uri.path == '/passvero_acceptance', 'DATABASE_ENDPOINT_SCOPE')
    return rows[0], env


def destination(locator):
    require(locator.startswith('s3:'), 'DESTINATION_NOT_B2_S3')
    text = locator[3:]
    uri = urllib.parse.urlsplit(text if '://' in text else 'https://' + text)
    match = re.fullmatch(r's3\.([a-z0-9-]+)\.backblazeb2\.com', uri.hostname or '')
    require(uri.scheme == 'https' and match and not uri.username and not uri.password
            and not uri.query and not uri.fragment and uri.port in (None, 443), 'AMBIGUOUS_DESTINATION')
    parts = uri.path.strip('/').split('/')
    require(parts and re.fullmatch(r'[A-Za-z0-9-]{6,63}', parts[0]), 'BUCKET_IDENTITY')
    original = '/'.join(parts[1:])
    require(not original or (original != PREFIX and not original.startswith(PREFIX + '/')
                            and not PREFIX.startswith(original + '/')), 'NAMESPACE_OVERLAP')
    return uri.netloc, match[1], parts[0], 's3:https://' + uri.netloc + '/' + parts[0] + '/' + PREFIX


def credentials(text):
    values = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        tokens = shlex.split(line, comments=True)
        if tokens and tokens[0] == 'export':
            tokens = tokens[1:]
        require(len(tokens) == 1 and '=' in tokens[0], 'CREDENTIAL_FILE_GRAMMAR')
        key, value = tokens[0].split('=', 1)
        if key in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'AWS_REGION'):
            require(value and not any(c in value for c in ('\n', '\r', '`', '$')), 'CREDENTIAL_FILE_GRAMMAR')
            values[key] = value
    require(values.get('AWS_ACCESS_KEY_ID') and values.get('AWS_SECRET_ACCESS_KEY'), 'EXISTING_S3_KEYS_MISSING')
    return values


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


HTTP = urllib.request.build_opener(NoRedirect())


def response(request):
    try:
        return HTTP.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        suffix = ''
        try:
            code = ET.fromstring(error.read(8192)).findtext('{*}Code')
            if code in ('AccessDenied', 'SignatureDoesNotMatch', 'InvalidAccessKeyId',
                        'RequestTimeTooSkewed', 'ExpiredToken', 'AuthorizationHeaderMalformed'):
                suffix = '_' + code
        except Exception:
            pass
        raise Stop('REMOTE_HTTP_' + str(error.code) + suffix) from None


def s3_list_request(host, region, bucket, keys, now):
    stamp = now.strftime('%Y%m%dT%H%M%SZ')
    day = stamp[:8]
    path = '/' + bucket
    query = urllib.parse.urlencode(sorted({'list-type': '2', 'max-keys': '1000', 'prefix': PREFIX + '/'}.items()),
                                   quote_via=urllib.parse.quote, safe='-_.~')
    empty = hashlib.sha256(b'').hexdigest()
    names = 'host;x-amz-content-sha256;x-amz-date'
    headers = 'host:' + host + '\nx-amz-content-sha256:' + empty + '\nx-amz-date:' + stamp + '\n'
    canonical = 'GET\n' + path + '\n' + query + '\n' + headers + '\n' + names + '\n' + empty
    scope = day + '/' + region + '/s3/aws4_request'
    signing = 'AWS4-HMAC-SHA256\n' + stamp + '\n' + scope + '\n' + hashlib.sha256(canonical.encode()).hexdigest()
    key = ('AWS4' + keys['AWS_SECRET_ACCESS_KEY']).encode()
    for value in (day, region, 's3', 'aws4_request'):
        key = hmac.new(key, value.encode(), hashlib.sha256).digest()
    signature = hmac.new(key, signing.encode(), hashlib.sha256).hexdigest()
    authorization = 'AWS4-HMAC-SHA256 Credential=' + keys['AWS_ACCESS_KEY_ID'] + '/' + scope
    authorization += ', SignedHeaders=' + names + ', Signature=' + signature
    return urllib.request.Request('https://' + host + path + '?' + query, headers={
        'Authorization': authorization, 'x-amz-content-sha256': empty, 'x-amz-date': stamp, 'Host': host})


def restic(repo, keys, args):
    return run(['/usr/bin/restic', '--no-cache', '--no-lock', '--repo', repo, '--password-file',
                '/etc/passvero/backup/restic-password', *args],
               env={'PATH': '/usr/bin:/bin', **keys})


def storage_request(env, path, body=None):
    url = env['DOCUMENT_STORAGE_SUPABASE_URL']
    require(re.fullmatch(r'https://[a-z0-9]{20}\.supabase\.co', url), 'STORAGE_ORIGIN')
    key = env['DOCUMENT_STORAGE_SUPABASE_KEY']
    headers = {'apikey': key, 'cache-control': 'no-store'}
    if key.count('.') == 2:
        headers['authorization'] = 'Bearer ' + key
    else:
        require(re.fullmatch(r'sb_secret_[A-Za-z0-9_-]+', key), 'STORAGE_KEY_SHAPE')
    if body is not None:
        headers['content-type'] = 'application/json'
    return response(urllib.request.Request(url + '/storage/v1/' + path,
                    data=None if body is None else json.dumps(body).encode(), headers=headers))


def inventory(list_page):
    found = []
    queue = ['']
    seen = set()
    while queue:
        prefix = queue.pop()
        require(prefix not in seen and len(seen) < 10000, 'STORAGE_FOLDER_INVENTORY')
        seen.add(prefix)
        offset = 0
        while True:
            page = list_page(prefix, offset)
            require(isinstance(page, list) and len(page) <= 100, 'STORAGE_LIST_SHAPE')
            for item in page:
                name = item['name']
                require(isinstance(name, str) and name and name not in ('.', '..')
                        and '/' not in name and '\\' not in name and '\0' not in name, 'STORAGE_NAME')
                key = prefix + name
                if item.get('id') is None and item.get('metadata') is None:
                    queue.append(key + '/')
                else:
                    size = item['metadata']['size']
                    require(item.get('id') and isinstance(size, int) and not isinstance(size, bool)
                            and 0 <= size <= GIB, 'STORAGE_OBJECT_METADATA')
                    found.append({'key': key, 'id': item['id'], 'size': size,
                                  'updatedAt': item['updated_at'], 'createdAt': item.get('created_at'),
                                  'etag': item['metadata'].get('eTag'),
                                  'mimeType': item['metadata'].get('mimetype')})
                    require(len(found) <= 10000 and sum(x['size'] for x in found) <= GIB, 'STORAGE_SIZE_LIMIT')
            if len(page) < 100:
                break
            offset += len(page)
    require(len({x['key'] for x in found}) == len(found), 'STORAGE_DUPLICATE_KEY')
    return sorted(found, key=lambda x: x['key'])


def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    require(hashlib.sha256(pathlib.Path('/usr/local/sbin/passvero-postgres-backup').read_bytes()).hexdigest() == PIN, 'PRODUCTION_SOURCE_CHANGED')
    require(ROOT.is_dir() and not ROOT.is_symlink() and ROOT.stat().st_uid == 0
            and not ROOT.stat().st_mode & 0o077, 'PRIVATE_WORKROOT')
    identity = json.loads(protected(ROOT / 'operator.identity.json'))
    require(identity == {'schema': 1, 'scope': PREFIX}, 'WORKROOT_IDENTITY')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    work = ROOT / 'preparation' / stamp
    work.mkdir(parents=True, mode=0o700, exist_ok=False)
    PHASE = 'RUNTIME_AND_DATABASE'
    process, env = runtime()
    db = sql("SELECT json_build_object('port',current_setting('port'),'directory',current_setting('data_directory'),'name',current_database(),'bytes',pg_database_size(current_database()),'migrations',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),'enabledCampaigns',(SELECT count(*) FROM \"ReminderCampaign\" WHERE enabled))")
    require(db['port'] == '5433' and db['directory'] == '/var/lib/postgresql/16/acceptance'
            and db['name'] == 'passvero_acceptance' and db['migrations'] == 31
            and db['enabledCampaigns'] == 0, 'DATABASE_SCOPE')
    timer = run(['/usr/bin/systemctl', 'show', 'passvero-subscription-reminders.timer',
                 '--property=ActiveState,UnitFileState']).decode()
    require('ActiveState=inactive' in timer and 'UnitFileState=disabled' in timer, 'REMINDER_SCOPE')
    service = run(['/usr/bin/systemctl', 'show', 'passvero-postgres-backup.service', '--property=ActiveState']).decode()
    require('ActiveState=inactive' in service, 'PRODUCTION_INVOCATION_ACTIVE')
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FREE_SPACE_LIMIT')
    PHASE = 'B2_EXACT_PREFIX_READ_ONLY'
    locator = protected('/etc/passvero/backup/restic-repository').decode().strip()
    protected('/etc/passvero/backup/restic-password')
    keys = credentials(protected('/etc/passvero/backup/restic.env').decode())
    host, region, bucket, repo = destination(locator)
    with response(s3_list_request(host, region, bucket, keys, datetime.datetime.now(datetime.timezone.utc))) as result:
        xml = result.read(4 * 1024 ** 2 + 1)
        require(len(xml) <= 4 * 1024 ** 2, 'B2_RESPONSE_LIMIT')
    listing = ET.fromstring(xml)
    require(listing.tag.endswith('ListBucketResult') and listing.findtext('{*}Prefix') == PREFIX + '/', 'B2_LIST_IDENTITY')
    require(listing.findtext('{*}IsTruncated') in ('true', 'false'), 'B2_LIST_SHAPE')
    empty = listing.findtext('{*}IsTruncated') == 'false' and not listing.findall('{*}Contents')
    repository = {'exists': not empty, 'snapshotCount': 0}
    if not empty:
        config = json.loads(restic(repo, keys, ['cat', 'config']))
        snapshots = json.loads(restic(repo, keys, ['snapshots', '--json']))
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')), 'EXISTING_REPOSITORY_FORMAT')
        require(snapshots and all(re.fullmatch('[a-f0-9]{64}', x.get('id', ''))
                and x.get('hostname') == 'passvero-staging-recovery'
                and 'passvero-staging-recovery' in x.get('tags', [])
                and x.get('paths') and all(p.startswith(str(ROOT / 'sets') + '/') for p in x['paths'])
                for x in snapshots), 'EXISTING_REPOSITORY_IDENTITY')
        repository.update(id=config['id'], snapshotCount=len(snapshots), candidates=[x['id'] for x in snapshots])
    production = json.loads(restic(locator, keys, ['snapshots', '--json']))
    require(production and all(x.get('hostname') == 'passvero-production'
            and 'passvero-postgresql' in x.get('tags', [])
            and re.fullmatch('[a-f0-9]{64}', x.get('id', '')) for x in production), 'PRODUCTION_REPOSITORY_IDENTITY')
    production_ids = sorted(x['id'] for x in production)
    PHASE = 'PRIVATE_STORAGE_PREPARATION'
    objects = []
    for bucket in BUCKETS:
        with storage_request(env, 'bucket/' + bucket) as result:
            info = json.loads(result.read(16385))
        require(info.get('id') == bucket and info.get('public') is False, 'PRIVATE_BUCKET_REQUIRED')
        def page(prefix, offset):
            with storage_request(env, 'object/list/' + bucket, {'prefix': prefix, 'limit': 100,
                                 'offset': offset, 'sortBy': {'column': 'name', 'order': 'asc'}}) as result:
                data = result.read(2 * 1024 ** 2 + 1)
                require(len(data) <= 2 * 1024 ** 2, 'STORAGE_PAGE_LIMIT')
                return json.loads(data)
        objects.extend(dict(x, bucket=bucket) for x in inventory(page))
    total = sum(x['size'] for x in objects)
    require(total <= GIB and db['bytes'] + total < GIB, 'PREPARATION_SIZE_LIMIT')
    output = work / 'objects'
    output.mkdir(mode=0o700)
    for item in objects:
        name = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        digest = hashlib.sha256()
        size = 0
        with storage_request(env, 'object/authenticated/' + item['bucket'] + '/' + urllib.parse.quote(item['key'], safe='/')) as result, open(output / name, 'xb') as handle:
            while True:
                chunk = result.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= item['size'], 'OBJECT_SIZE_CHANGED')
                handle.write(chunk)
                digest.update(chunk)
        require(size == item['size'], 'OBJECT_SIZE_CHANGED')
        item.update(file=name, sha256=digest.hexdigest())
    PHASE = 'DUMP_SIZE_MEASUREMENT'
    with open(work / 'measurement.dump', 'xb') as handle:
        result = subprocess.run(['/usr/bin/pg_dump', '-h', '/var/run/postgresql', '-p', '5433',
                                 '-U', 'postgres', '-d', 'passvero_acceptance', '-Fc', '--no-password'],
                                **account('postgres'), env={'PATH': '/usr/bin:/bin', 'LANG': 'C'},
                                stdout=handle, stderr=subprocess.PIPE, timeout=60,
                                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (GIB - total, GIB - total)))
    require(result.returncode == 0, 'DUMP_MEASUREMENT_FAILED')
    dump_bytes = (work / 'measurement.dump').stat().st_size
    require(dump_bytes + total < GIB and shutil.disk_usage(ROOT).free >= 4 * GIB, 'SIZE_OR_SPACE_LIMIT')
    process_after, _ = runtime()
    require(process_after == process, 'RUNTIME_CHANGED_DURING_PREPARATION')
    state = {'schema': 1, 'setId': stamp, 'scope': PREFIX, 'database': db, 'process': process,
             'objects': objects, 'storageBytes': total, 'measurementDumpBytes': dump_bytes,
             'repository': repository, 'productionSnapshotIdsBefore': production_ids,
             'sourcePackageSha256': hashlib.sha256((APP / 'package.json').read_bytes()).hexdigest(),
             'sourceLockSha256': hashlib.sha256((APP / 'package-lock.json').read_bytes()).hexdigest(),
             'buildId': (APP / '.next/BUILD_ID').read_text().strip(), 'captureCompleted': False}
    store(work / 'prepared.json', state)
    print(json.dumps({'preparation': 'PASS', 'setId': stamp, 'staging': 'ONLINE_UNPAUSED',
                      'b2Prefix': PREFIX + '/', 'repositoryExists': repository['exists'],
                      'existingStagingSnapshots': repository['snapshotCount'], 'storageObjects': len(objects),
                      'storageBytes': total, 'measurementDumpBytes': dump_bytes,
                      'freeBytes': shutil.disk_usage(ROOT).free, 'consistentCapture': 'NOT_YET_RUN',
                      'writerClosureProof': 'REQUIRED_DURING_CAPTURE', 'remoteWrites': 0,
                      'smtpCalls': 0, 'telegramCalls': 0, 'retry': 'NO_AUTOMATIC_RETRY'}))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if isinstance(error, Stop) else type(error).__name__
        print(json.dumps({'preparation': 'STOP', 'phase': PHASE, 'reason': reason,
                          'stagingPauseRequested': False, 'remoteWrites': 0, 'smtpCalls': 0,
                          'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED', 'artifactsRetained': True}))
        sys.exit(1)
'''
EXPECTED = 'f344ef9d17e58ff7c77c9cf9b07be36dddc77a71a95ce021bc61920347236122'

try:
    os.umask(0o077)
    if os.geteuid() != 0 or os.uname().nodename != 'srv1834647':
        raise RuntimeError('OPERATOR_HOST')
    payload = SOURCE.encode()
    if hashlib.sha256(payload).hexdigest() != EXPECTED:
        raise RuntimeError('HELPER_HASH')
    compile(SOURCE, '<reviewed-preparation>', 'exec')
    workroot = pathlib.Path('/var/lib/passvero-staging-recovery')
    identity = {'schema': 1, 'scope': 'passvero-staging-recovery-v1'}
    def private(path, directory=False):
        info = path.lstat()
        if info.st_uid != 0 or info.st_mode & 0o077 or not (
                stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode)):
            raise RuntimeError('PRIVATE_PATH_POSTURE')
    if not workroot.exists() and not workroot.is_symlink():
        workroot.mkdir(mode=0o700)
        with open(workroot / 'operator.identity.json', 'x') as handle:
            json.dump(identity, handle)
            handle.flush()
            os.fsync(handle.fileno())
    private(workroot, True)
    marker = workroot / 'operator.identity.json'
    private(marker)
    if json.loads(marker.read_text()) != identity:
        raise RuntimeError('WORKROOT_IDENTITY')
    helpers = workroot / 'operator'
    if not helpers.exists() and not helpers.is_symlink():
        helpers.mkdir(mode=0o700)
    private(helpers, True)
    helper = helpers / ('prepare-' + EXPECTED + '.py')
    if helper.exists() or helper.is_symlink():
        private(helper)
        if helper.read_bytes() != payload:
            raise RuntimeError('EXISTING_HELPER_CONFLICT')
    else:
        with open(helper, 'xb') as handle:
            handle.write(payload)
            handle.flush()
            os.fsync(handle.fileno())
    os.execv('/usr/bin/python3', ['/usr/bin/python3', '-B', str(helper)])
except BaseException as error:
    reason = str(error) if isinstance(error, RuntimeError) else type(error).__name__
    print(json.dumps({'preparation': 'STOP', 'phase': 'INSTALL_REVIEWED_HELPER',
        'reason': reason, 'stagingPauseRequested': False, 'remoteWrites': 0,
        'smtpCalls': 0, 'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED'}))
    sys.exit(1)
PY_APPROVED_PREPARATION
```

Expected sanitized success (numbers and set ID are measured, not predetermined):

```json
{"preparation":"PASS","setId":"<UTC-set-id>","staging":"ONLINE_UNPAUSED","b2Prefix":"passvero-staging-recovery-v1/","repositoryExists":false,"existingStagingSnapshots":0,"storageObjects":0,"storageBytes":0,"measurementDumpBytes":0,"freeBytes":0,"consistentCapture":"NOT_YET_RUN","writerClosureProof":"REQUIRED_DURING_CAPTURE","remoteWrites":0,"smtpCalls":0,"telegramCalls":0,"retry":"NO_AUTOMATIC_RETRY"}
```

Zero numeric values above are placeholders, not an empty-set assertion. On denied
B2 access, expect `preparation=STOP`, `phase=B2_EXACT_PREFIX_READ_ONLY`, a sanitized
HTTP reason, `stagingPauseRequested=false`, zero remote writes/email/Telegram, and
`retry=MANUAL_REVIEW_REQUIRED`. Do not rerun or change credentials/rights on STOP.

**Wait for the operator output.** The next block remains within the existing approval:
one bounded, independently guarded capture pause, app recovery before B2 transfer,
then exact-snapshot retrieval and the new isolated PG16 restore. No automatic staging
backup schedule has been introduced. Current staging/cluster closure is not inferred
from a local mock or the former inventory.

## Historical read-only review and operator outputs

## VPS TERMINAL — read-only existing-system inventory

Copy the entire block. It does not execute backup/freshness scripts, restic, Storage
requests, jobs or Telegram. It prints catalog/count summaries and metadata only.
Missing or failed queries stop with a sanitized error; retain output for manual review.
It intentionally does not claim that a static keyword match proves include/exclude scope.

```bash
sudo python3 - <<'PY_BACKUP_COVERAGE'
"""Bounded existing-backup inventory. No services/jobs/restic/Storage calls or writes."""
import datetime, hashlib, json, os, pathlib, pwd, re, subprocess, sys, urllib.parse
P = pathlib.Path

def run(args, **kw):
    r = subprocess.run(args, capture_output=True, text=True, timeout=20, **kw)
    if r.returncode: raise RuntimeError('READ_ONLY_COMMAND_FAILED')
    return r.stdout.strip()

def metadata(path, digest=False):
    p = P(path)
    if not p.exists(): return {'path':str(p),'exists':False}
    s = p.lstat()
    out = {'path':str(p),'exists':True,'symlink':p.is_symlink(),'mode':oct(s.st_mode & 0o777),'uid':s.st_uid,'gid':s.st_gid,'bytes':s.st_size,'mtimeUtc':datetime.datetime.fromtimestamp(s.st_mtime,datetime.timezone.utc).isoformat()}
    if digest and p.is_file() and not p.is_symlink(): out['sha256']=hashlib.sha256(p.read_bytes()).hexdigest()
    return out

def script_facts(path):
    out=metadata(path,True); p=P(path)
    if not p.is_file() or p.is_symlink(): return out
    body=p.read_text(); facts={}; operations=[]
    for n,line in enumerate(body.splitlines(),1):
        m=re.fullmatch(r'\s*(?:readonly\s+)?([a-zA-Z_][a-zA-Z0-9_]*)=[\"\']?([a-zA-Z0-9_./:-]+)[\"\']?\s*',line)
        if m and (m[1].lower() in {'database_host','database_port','database_name','backup_role','snapshot_host','freshness_threshold','max_age_seconds'} or m[1].lower().endswith(('_dir','_directory'))):
            if not re.search(r'password|token|secret|repository|credential|key',m[1],re.I): facts[m[1]]=m[2]
        if re.search(r'\b(restic|pg_dump|pg_restore|supabase|telegram|curl|tar)\b',line) and not line.lstrip().startswith('#'):
            operations.append({'line':n,'operations':sorted(set(re.findall(r'\b(restic|pg_dump|pg_restore|supabase|telegram|curl|tar|backup|restore|forget|prune)\b',line))), 'variables':sorted(set(re.findall(r'\$\{?([A-Za-z_][A-Za-z0-9_]*)',line))), 'flags':sorted(set(re.findall(r'(?<!\w)--[a-z][a-z-]+',line)))})
    out.update(constants=facts,operationStructure=operations,scopeNeedsSemanticReview=True,scopeLiteralPresence={v:v in body for v in ('passvero_acceptance','5433','passvero-staging-documents','passvero-staging-images','DOCUMENT_STORAGE','/etc/passvero','last-valid-offsite','93600','sendMessage')})
    return out

def main():
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST_OR_IDENTITY'
    pg=pwd.getpwnam('postgres')
    def sql(port,db,q):
        return json.loads(run(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p',str(port),'-d',db,'-v','ON_ERROR_STOP=1','-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; "+q+'; ROLLBACK;'],user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'}))
    clusters=json.loads(run(['pg_lsclusters','--json'])); topology=[]
    for c in clusters:
        item={k:c.get(k) for k in ('version','cluster','port','status','owner','datadir')}
        if str(c.get('status','')).startswith('online'):
            port=c['port']
            dbs=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT datname name,pg_get_userbyid(datdba) owner,pg_database_size(oid) bytes,datallowconn allowsConnection FROM pg_database WHERE NOT datistemplate) x")
            roles=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT rolname name,rolcanlogin login,rolsuper superuser,rolcreatedb createDb,rolcreaterole createRole,rolreplication replication,rolbypassrls bypassRls FROM pg_roles WHERE rolname LIKE 'passvero%') x")
            item.update(databases=dbs,roles=roles)
            for db in dbs:
                if not db['name'].startswith('passvero') or not db['allowsConnection']: continue
                db['connectMatrix']=sql(port,'postgres',"SELECT coalesce(json_agg(x),'[]') FROM (SELECT rolname role,has_database_privilege(rolname,"+"'"+db['name'].replace("'","''")+"'"+",'CONNECT') connect FROM pg_roles WHERE rolname LIKE 'passvero%') x")
                db['catalog']=sql(port,db['name'],"SELECT json_build_object('database',current_database(),'port',current_setting('port'),'dataDirectory',current_setting('data_directory'),'listenAddresses',current_setting('listen_addresses'),'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),'migratorOwners',(SELECT coalesce(json_agg(x),'[]') FROM (SELECT tableowner owner,count(*) tables FROM pg_tables WHERE schemaname='public' GROUP BY tableowner) x))")
                tables=sql(port,db['name'],"SELECT coalesce(json_agg(tablename),'[]') FROM pg_tables WHERE schemaname='public'")
                if '_prisma_migrations' in tables: db['migrations']=sql(port,db['name'],"SELECT json_build_object('total',count(*),'successful',count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),'latest',max(migration_name),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name))) FROM _prisma_migrations")
                if db['name']=='passvero_acceptance':
                    db['counts']={t:sql(port,db['name'],'SELECT to_json(count(*)) FROM "'+t+'"') for t in ('Organization','Product','ProductVersion','Document','ProductDocument','ProductImageAsset','ProductImage','ReminderCampaign','SubscriptionReminder','ReminderAttempt') if t in tables}
                    db['assets']={}
                    for t in ('Document','ProductImageAsset'):
                        if t in tables: db['assets'][t]=sql(port,db['name'],'SELECT coalesce(json_agg(x),\'[]\') FROM (SELECT "storageProvider" provider,"storageBucket" bucket,count(*) objects,coalesce(sum("sizeBytes"),0)::text bytes,count(*) FILTER(WHERE "checksumSha256" ~ \'^[a-f0-9]{64}$\') validDigests FROM "'+t+'" GROUP BY 1,2) x')
                    if 'ReminderCampaign' in tables: db['enabledReminderCampaigns']=sql(port,db['name'],'SELECT to_json(count(*)) FROM "ReminderCampaign" WHERE enabled')
        topology.append(item)
    units=run(['systemctl','list-unit-files','--no-pager','--no-legend','passvero-*']).splitlines()
    jobs={}
    for line in units:
        unit=line.split()[0]
        if re.search(r'backup|freshness|restic|storage',unit):
            properties='Id,LoadState,ActiveState,UnitFileState,Result,ExecMainStatus,ExecMainStartTimestamp,ExecMainExitTimestamp,LastTriggerUSec,NextElapseUSecRealtime,TimersCalendar,RandomizedDelayUSec,Persistent,FragmentPath'
            jobs[unit]=run(['systemctl','show',unit,'--property='+properties])
    reminder=run(['systemctl','show','passvero-subscription-reminders.timer','--property=LoadState,UnitFileState,ActiveState'])
    script_paths={'/usr/local/sbin/passvero-postgres-backup','/usr/local/sbin/passvero-backup-freshness'}
    unit_files={}
    for unit in jobs:
        fragment=next((line.split('=',1)[1] for line in jobs[unit].splitlines() if line.startswith('FragmentPath=')),None)
        if fragment and P(fragment).is_file():
            body=P(fragment).read_text(); unit_files[unit]=metadata(fragment,True)
            script_paths.update(re.findall(r'^ExecStart=(/usr/local/(?:sbin|bin)/[A-Za-z0-9_.-]+)',body,re.M))
    scripts=[script_facts(p) for p in sorted(script_paths)]
    cfg=P('/etc/passvero/backup'); config=[metadata(p) for p in sorted(cfg.glob('*')) if p.is_file()]
    repo=cfg/'restic-repository'; destination={'protectedLocatorFile':str(repo),'backend':'UNKNOWN'}
    if repo.is_file() and not repo.is_symlink(): destination['backend']='B2' if repo.read_text().strip().startswith('b2:') else 'OTHER_OR_DYNAMIC'
    pgpass=cfg/'pgpass'; targets=[]
    if pgpass.is_file() and not pgpass.is_symlink():
        for line in pgpass.read_text().splitlines():
            if not line or line.startswith('#'): continue
            fields=line.split(':')
            if len(fields)==5 and all(re.fullmatch(r'[A-Za-z0-9_.*/-]+',v) for v in fields[:4]): targets.append({'host':fields[0],'port':fields[1],'database':fields[2],'role':fields[3]})
            else: targets.append({'parse':'UNRESOLVED_NO_CONTENT_PRINTED'})
    state=P('/var/lib/passvero-backup/state/last-valid-offsite.epoch'); marker=metadata(state)
    if state.is_file() and not state.is_symlink():
        value=state.read_text().strip()
        if value.isdigit(): marker.update(epoch=int(value),ageSeconds=int(datetime.datetime.now(datetime.timezone.utc).timestamp())-int(value))
    ev=P('/var/lib/passvero-backup/evidence'); offsite=sorted(ev.glob('*.offsite'),key=lambda p:p.stat().st_mtime,reverse=True)[:2]
    evidence=[]
    for p in offsite:
        item=metadata(p,True); text=p.read_text()
        item['snapshotIds']=sorted(set(re.findall(r'(?i)(?:snapshot(?:_id)?)[\s\"=:]+([a-f0-9]{64})',text)))
        item['backupSetTimestamps']=sorted(set(re.findall(r'\b[0-9]{8}T[0-9]{6}Z\b',text)))
        evidence.append(item)
    restore=[metadata(p,True) for p in sorted(ev.glob('*restore*'))[-8:] if p.is_file()]
    backupRoot=P('/var/lib/passvero-backup')
    retainedPaths=[metadata(p) for p in sorted(backupRoot.glob('*'))[:30]]
    space={str(p):{'availableBytes':os.statvfs(p).f_bavail*os.statvfs(p).f_frsize} for p in (P('/var/lib'),P('/tmp'))}
    print(json.dumps({'diagnostic':'READ_ONLY_COMPLETE','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'topology':topology,'backupJobs':jobs,'unitFiles':unit_files,'installedScripts':scripts,'destination':destination,'protectedConfigMetadata':config,'backupConnectionTargets':targets,'freshnessMarker':marker,'backupRootInventory':retainedPaths,'recentOffsiteEvidence':evidence,'retainedRestoreEvidence':restore,'reminderTimer':reminder,'space':space,'limitations':['No restic execution or offsite listing yet','Static command structure is not a complete semantic include/exclude proof','No Storage API calls or byte copies','No secret values, raw scripts, logs or business rows emitted'],'writes':'NONE','smtpCalls':0,'telegramCalls':0},indent=2))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'diagnostic':'STOP','reason':type(e).__name__,'writes':'NONE','smtpCalls':0,'telegramCalls':0}))
        sys.exit(1)
PY_BACKUP_COVERAGE
```

Expected sanitized result: `diagnostic=READ_ONLY_COMPLETE`, observed UTC time, cluster/
database/role topology, migration and staging asset counters, job state/schedule,
installed script hashes and safe constants/command structure, protected configuration
metadata, backup connection target, canonical marker age and retained evidence paths.
`writes=NONE; smtpCalls=0; telegramCalls=0`. No secret values, repository URL, object keys,
filenames, credentials, raw process environments, business rows or script bodies.

Do not infer current offsite availability from a local marker alone. An actual selected
snapshot listing/retrieval and the needed restore proof follow only after the inventory
identifies the current job and exact safe target. No forget/prune/unlock or snapshot deletion.

## Next checkpoint

Use returned inventory to settle only remaining include/exclude ambiguities. Deliver one
concrete plan for the actually missing coverage and proof, identifying exact sources,
protected existing destination, existing job, safe existing/new isolated target, bytes/free
space/transfer, consistency window and explicit rollback/cleanup boundaries. Wait for that
operational approval. Reuse unchanged PostgreSQL restore and Telegram evidence.

## Returned V1 result and correction

V1 output retained in codex/evidence/backup-recovery/operator-inventory-20261001.json.
Timers, target constants, latest offsite evidence and marker were read successfully.
The topology adapter expected absent pg_lsclusters keys and skipped SQL; those catalog
checks are not proven. Do not rerun V1 or the successful backup/Telegram/restore acceptance.
V2 directly verifies the two known PostgreSQL socket ports and data directories, reads
only missing catalogs and the existing scope/retention helper structure, and tests a
candidate isolated restore port/path for presence without creating it. All string/byte
and arbitrary numeric literals in the displayed helper code are redacted except a narrow
command/scope/key/count allowlist. The code is displayed for review, never executed.
The backup source hash is pinned to V1. Do not execute the existing production job;
its source includes forget, which is outside this task's authorization.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_V2

```bash
sudo python3 - <<'PY_BACKUP_SCOPE_V2'
"""Finish only skipped catalogs and current backup scope; no script/job execution."""
import ast, datetime, hashlib, json, os, pathlib, pwd, re, subprocess, sys
P=pathlib.Path
PHASE='BOOTSTRAP'
SAFE={'restic','backup','forget','prune','restore','snapshots','ls','dump','check','locks','host','tags','paths','path','passvero-production','passvero-postgresql','passvero','passvero_backup','passvero_acceptance','.dump','.manifest','.dump.sha256','.dump.toc','passvero-','hostname','id','time','summary','snapshot_id','host,tags','host,paths','host,tags,paths','0','1','2','6','8','10','14','24','26','60','3600','86400','93600'}
class HideLiterals(ast.NodeTransformer):
    def visit_Constant(self,node):
        if isinstance(node.value,str):
            allowed=node.value in SAFE or re.fullmatch(r'--[a-z][a-z-]*',node.value)
        else:
            allowed=node.value is None or isinstance(node.value,bool) or (isinstance(node.value,int) and node.value in {0,1,2,6,8,10,14,24,26,60,3600,86400,93600})
        return node if allowed else ast.copy_location(ast.Constant('<redacted literal>'),node)

def python_contract(body):
    lines=body.splitlines(); blocks=[]
    for i,line in enumerate(lines):
        m=re.search(r'<<\s*[\"\']?([A-Z][A-Z0-9_]*)[\"\']?',line)
        if not m: continue
        end=next((j for j in range(i+1,len(lines)) if lines[j].strip()==m[1]),None)
        if end is None: continue
        code='\n'.join(lines[i+1:end])
        try: tree=ast.parse(code)
        except SyntaxError: continue
        literals={n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)}
        if not literals.intersection({'restic','backup','forget','--keep-daily','--group-by'}): continue
        sanitized=ast.unparse(HideLiterals().visit(tree))
        blocks.append({'startLine':i+2,'endLine':end,'sanitizedPython':sanitized})
    return blocks

def run(args,**kw):
    r=subprocess.run(args,capture_output=True,text=True,timeout=20,**kw)
    if r.returncode: raise RuntimeError('READ_ONLY_COMMAND_FAILED')
    return r.stdout.strip()

def main():
    global PHASE
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    pg=pwd.getpwnam('postgres')
    def sql(port,db,q):
        return json.loads(run(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p',str(port),'-d',db,'-v','ON_ERROR_STOP=1','-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; "+q+'; ROLLBACK;'],user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'}))
    topology=[]
    for port,cluster in ((5432,'main'),(5433,'acceptance')):
        PHASE='CLUSTER_CATALOG_'+str(port)
        identity=sql(port,'postgres',"SELECT json_build_object('port',current_setting('port'),'directory',current_setting('data_directory'),'listen',current_setting('listen_addresses'))")
        assert identity['port']==str(port) and identity['directory']=='/var/lib/postgresql/16/'+cluster,'CLUSTER_IDENTITY_MISMATCH'
        dbs=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT datname name,pg_get_userbyid(datdba) owner,pg_database_size(oid) bytes,datallowconn allowsConnection FROM pg_database WHERE NOT datistemplate) x")
        roles=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT rolname name,rolcanlogin login,rolsuper superuser,rolcreatedb createDb,rolcreaterole createRole,rolbypassrls bypassRls FROM pg_roles WHERE rolname LIKE 'passvero%') x")
        for db in dbs:
            if db['name'] not in {'passvero','passvero_test','passvero_acceptance'} or not db['allowsConnection']: continue
            PHASE='DATABASE_CATALOG_'+str(port)+'_'+db['name']
            lit="'"+db['name'].replace("'","''")+"'"
            db['connect']=sql(port,'postgres',"SELECT coalesce(json_agg(x),'[]') FROM (SELECT rolname name,has_database_privilege(rolname,"+lit+",'CONNECT') permitted FROM pg_roles WHERE rolname LIKE 'passvero%') x")
            tables=sql(port,db['name'],"SELECT coalesce(json_agg(x),'[]') FROM (SELECT tablename name,tableowner owner FROM pg_tables WHERE schemaname='public' ORDER BY tablename) x")
            db['tableOwners']=tables; names={t['name'] for t in tables}
            if '_prisma_migrations' in names:
                db['migrations']=sql(port,db['name'],"SELECT json_build_object('total',count(*),'successful',count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),'latest',max(migration_name),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name))) FROM _prisma_migrations")
            if db['name']=='passvero_acceptance':
                db['counts']={t:sql(port,db['name'],'SELECT to_json(count(*)) FROM "'+t+'"') for t in sorted(names)}
                db['assets']={}
                for t,state in (('Document','status'),('ProductImageAsset','state')):
                    if t in names:
                        db['assets'][t]=sql(port,db['name'],'SELECT coalesce(json_agg(x),\'[]\') FROM (SELECT "storageProvider" provider,"storageBucket" bucket,"'+state+'"::text state,count(*) objects,coalesce(sum("sizeBytes"),0)::text bytes,count(*) FILTER(WHERE "checksumSha256" ~ \'^[a-f0-9]{64}$\') validDigests FROM "'+t+'" GROUP BY 1,2,3) x')
                if 'ReminderCampaign' in names: db['enabledCampaigns']=sql(port,db['name'],'SELECT to_json(count(*)) FROM "ReminderCampaign" WHERE enabled')
        topology.append({'cluster':cluster,'identity':identity,'databases':dbs,'roles':roles})
    PHASE='INSTALLED_BACKUP_CONTRACT'
    backup=P('/usr/local/sbin/passvero-postgres-backup'); body=backup.read_text()
    assert hashlib.sha256(backup.read_bytes()).hexdigest()=='5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75','BACKUP_SOURCE_CHANGED'
    repo=P('/etc/passvero/backup/restic-repository').read_text().strip()
    backend='B2_NATIVE' if repo.startswith('b2:') else 'B2_S3' if repo.startswith('s3:') and re.search(r'(^|[./])backblazeb2\.com([/:]|$)',repo) else 'OTHER_OR_UNRESOLVED'
    backup_scripts=sorted(str(p) for directory in ('/usr/local/sbin','/usr/local/bin') for p in P(directory).glob('passvero*') if re.search(r'backup|restic|storage',p.name) and p.is_file())
    cron=[]
    candidates=list(P('/etc/cron.d').glob('*'))+[P('/etc/crontab'),P('/var/spool/cron/crontabs/root')]
    for p in candidates:
        if not p.is_file() or p.is_symlink(): continue
        for n,line in enumerate(p.read_text().splitlines(),1):
            if not line.lstrip().startswith('#') and 'passvero' in line and re.search(r'backup|restic|storage',line):
                cron.append({'file':str(p),'line':n,'scriptPaths':re.findall(r'/usr/local/(?:sbin|bin)/passvero[A-Za-z0-9_.-]*',line)})
    freshness=P('/usr/local/sbin/passvero-backup-freshness').read_text()
    numericFreshness=[]
    for line in freshness.splitlines():
        m=re.fullmatch(r'\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9]+)\s*',line)
        if m and re.search(r'age|fresh|threshold',m[1],re.I): numericFreshness.append({'name':m[1],'seconds':int(m[2])})
    print(json.dumps({'diagnostic':'READ_ONLY_COMPLETION_V2','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'topology':topology,'existingDestinationBackend':backend,'protectedDestinationLocator':'/etc/passvero/backup/restic-repository','backupPythonContract':python_contract(body),'otherPassveroBackupScripts':backup_scripts,'passveroBackupCronReferences':cron,'freshnessNumericConstants':numericFreshness,'reminderTimer':run(['systemctl','show','passvero-subscription-reminders.timer','--property=ActiveState,UnitFileState']),'restorePort55434Listeners':run(['ss','-H','-ltn','sport = :55434']),'candidateRecoveryDirectoryPresent':P('/var/lib/passvero-staging-recovery').exists() or P('/var/lib/passvero-staging-recovery').is_symlink(),'writes':'NONE','resticCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0},indent=2))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'diagnostic':'STOP','reason':type(e).__name__,'phase':PHASE,'writes':'NONE','smtpCalls':0,'telegramCalls':0}))
        sys.exit(1)
PY_BACKUP_SCOPE_V2
```

Expected sanitized output: READ_ONLY_COMPLETION_V2 with verified cluster identities,
database/role/connect/migration summaries, staging table counters and grouped asset
counts/bytes, redacted restic/retention contract, existing backup script/cron names,
backend classification and candidate target availability. writes=NONE; resticCalls=0;
storageCalls=0; smtpCalls=0; telegramCalls=0. Campaigns must remain disabled.
No snapshot listing/retrieval, business values, object keys or secret values are output.
If STOP is returned, keep the partial checkpoint for manual review; do not retry blindly.

## V2 STOP and minimal V3 correction

Operator returned STOP/KeyError/CLUSTER_CATALOG_5432; writes/smtp/Telegram remained zero.
The unquoted SQL alias allowsConnection becomes allowsconnection in PostgreSQL JSON.
V2 then looked up the absent mixed-case key before updating its phase. This is a probe
bug, not a database or backup fault. Original STOP output is retained in
codex/evidence/backup-recovery/operator-inventory-v2-stop.json. Do not rerun V1 or V2.

V3's functional change is the quoted alias AS "allowsConnection". No relaxed cluster
checks or silent fallback. Local full-flow mock reproduces V2's exact KeyError after
three read-only calls and completes V3's 23 SQL calls for both clusters, three known
databases, migrations/assets and later scope checks. Text/byte/numeric secret filtering
passes; only psql SELECT transactions, systemctl show and ss reads are allowed. This is
local mocked evidence, not current live catalog or restore proof. No local database was
created to test the probe. Existing backup/timer/Telegram/restore acceptance is reused.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_V3

```bash
sudo python3 - <<'PY_BACKUP_SCOPE_V3'
"""Finish only skipped catalogs and current backup scope; no script/job execution."""
import ast, datetime, hashlib, json, os, pathlib, pwd, re, subprocess, sys
P=pathlib.Path
PHASE='BOOTSTRAP'
SAFE={'restic','backup','forget','prune','restore','snapshots','ls','dump','check','locks','host','tags','paths','path','passvero-production','passvero-postgresql','passvero','passvero_backup','passvero_acceptance','.dump','.manifest','.dump.sha256','.dump.toc','passvero-','hostname','id','time','summary','snapshot_id','host,tags','host,paths','host,tags,paths','0','1','2','6','8','10','14','24','26','60','3600','86400','93600'}
class HideLiterals(ast.NodeTransformer):
    def visit_Constant(self,node):
        if isinstance(node.value,str):
            allowed=node.value in SAFE or re.fullmatch(r'--[a-z][a-z-]*',node.value)
        else:
            allowed=node.value is None or isinstance(node.value,bool) or (isinstance(node.value,int) and node.value in {0,1,2,6,8,10,14,24,26,60,3600,86400,93600})
        return node if allowed else ast.copy_location(ast.Constant('<redacted literal>'),node)

def python_contract(body):
    lines=body.splitlines(); blocks=[]
    for i,line in enumerate(lines):
        m=re.search(r'<<\s*[\"\']?([A-Z][A-Z0-9_]*)[\"\']?',line)
        if not m: continue
        end=next((j for j in range(i+1,len(lines)) if lines[j].strip()==m[1]),None)
        if end is None: continue
        code='\n'.join(lines[i+1:end])
        try: tree=ast.parse(code)
        except SyntaxError: continue
        literals={n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)}
        if not literals.intersection({'restic','backup','forget','--keep-daily','--group-by'}): continue
        sanitized=ast.unparse(HideLiterals().visit(tree))
        blocks.append({'startLine':i+2,'endLine':end,'sanitizedPython':sanitized})
    return blocks

def run(args,**kw):
    r=subprocess.run(args,capture_output=True,text=True,timeout=20,**kw)
    if r.returncode: raise RuntimeError('READ_ONLY_COMMAND_FAILED')
    return r.stdout.strip()

def main():
    global PHASE
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','WRONG_HOST'
    pg=pwd.getpwnam('postgres')
    def sql(port,db,q):
        return json.loads(run(['/usr/bin/psql','-XqAt','-h','/var/run/postgresql','-p',str(port),'-d',db,'-v','ON_ERROR_STOP=1','-c',"BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; "+q+'; ROLLBACK;'],user=pg.pw_uid,group=pg.pw_gid,extra_groups=[],cwd='/',env={'PATH':'/usr/bin:/bin','LANG':'C'}))
    topology=[]
    for port,cluster in ((5432,'main'),(5433,'acceptance')):
        PHASE='CLUSTER_CATALOG_'+str(port)
        identity=sql(port,'postgres',"SELECT json_build_object('port',current_setting('port'),'directory',current_setting('data_directory'),'listen',current_setting('listen_addresses'))")
        assert identity['port']==str(port) and identity['directory']=='/var/lib/postgresql/16/'+cluster,'CLUSTER_IDENTITY_MISMATCH'
        dbs=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT datname name,pg_get_userbyid(datdba) owner,pg_database_size(oid) bytes,datallowconn AS \"allowsConnection\" FROM pg_database WHERE NOT datistemplate) x")
        roles=sql(port,'postgres',"SELECT coalesce(json_agg(x ORDER BY name),'[]') FROM (SELECT rolname name,rolcanlogin login,rolsuper superuser,rolcreatedb createDb,rolcreaterole createRole,rolbypassrls bypassRls FROM pg_roles WHERE rolname LIKE 'passvero%') x")
        for db in dbs:
            if db['name'] not in {'passvero','passvero_test','passvero_acceptance'} or not db['allowsConnection']: continue
            PHASE='DATABASE_CATALOG_'+str(port)+'_'+db['name']
            lit="'"+db['name'].replace("'","''")+"'"
            db['connect']=sql(port,'postgres',"SELECT coalesce(json_agg(x),'[]') FROM (SELECT rolname name,has_database_privilege(rolname,"+lit+",'CONNECT') permitted FROM pg_roles WHERE rolname LIKE 'passvero%') x")
            tables=sql(port,db['name'],"SELECT coalesce(json_agg(x),'[]') FROM (SELECT tablename name,tableowner owner FROM pg_tables WHERE schemaname='public' ORDER BY tablename) x")
            db['tableOwners']=tables; names={t['name'] for t in tables}
            if '_prisma_migrations' in names:
                db['migrations']=sql(port,db['name'],"SELECT json_build_object('total',count(*),'successful',count(*) FILTER(WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),'latest',max(migration_name),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name))) FROM _prisma_migrations")
            if db['name']=='passvero_acceptance':
                db['counts']={t:sql(port,db['name'],'SELECT to_json(count(*)) FROM "'+t+'"') for t in sorted(names)}
                db['assets']={}
                for t,state in (('Document','status'),('ProductImageAsset','state')):
                    if t in names:
                        db['assets'][t]=sql(port,db['name'],'SELECT coalesce(json_agg(x),\'[]\') FROM (SELECT "storageProvider" provider,"storageBucket" bucket,"'+state+'"::text state,count(*) objects,coalesce(sum("sizeBytes"),0)::text bytes,count(*) FILTER(WHERE "checksumSha256" ~ \'^[a-f0-9]{64}$\') validDigests FROM "'+t+'" GROUP BY 1,2,3) x')
                if 'ReminderCampaign' in names: db['enabledCampaigns']=sql(port,db['name'],'SELECT to_json(count(*)) FROM "ReminderCampaign" WHERE enabled')
        topology.append({'cluster':cluster,'identity':identity,'databases':dbs,'roles':roles})
    PHASE='INSTALLED_BACKUP_CONTRACT'
    backup=P('/usr/local/sbin/passvero-postgres-backup'); body=backup.read_text()
    assert hashlib.sha256(backup.read_bytes()).hexdigest()=='5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75','BACKUP_SOURCE_CHANGED'
    repo=P('/etc/passvero/backup/restic-repository').read_text().strip()
    backend='B2_NATIVE' if repo.startswith('b2:') else 'B2_S3' if repo.startswith('s3:') and re.search(r'(^|[./])backblazeb2\.com([/:]|$)',repo) else 'OTHER_OR_UNRESOLVED'
    backup_scripts=sorted(str(p) for directory in ('/usr/local/sbin','/usr/local/bin') for p in P(directory).glob('passvero*') if re.search(r'backup|restic|storage',p.name) and p.is_file())
    cron=[]
    candidates=list(P('/etc/cron.d').glob('*'))+[P('/etc/crontab'),P('/var/spool/cron/crontabs/root')]
    for p in candidates:
        if not p.is_file() or p.is_symlink(): continue
        for n,line in enumerate(p.read_text().splitlines(),1):
            if not line.lstrip().startswith('#') and 'passvero' in line and re.search(r'backup|restic|storage',line):
                cron.append({'file':str(p),'line':n,'scriptPaths':re.findall(r'/usr/local/(?:sbin|bin)/passvero[A-Za-z0-9_.-]*',line)})
    freshness=P('/usr/local/sbin/passvero-backup-freshness').read_text()
    numericFreshness=[]
    for line in freshness.splitlines():
        m=re.fullmatch(r'\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*([0-9]+)\s*',line)
        if m and re.search(r'age|fresh|threshold',m[1],re.I): numericFreshness.append({'name':m[1],'seconds':int(m[2])})
    print(json.dumps({'diagnostic':'READ_ONLY_COMPLETION_V3','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'topology':topology,'existingDestinationBackend':backend,'protectedDestinationLocator':'/etc/passvero/backup/restic-repository','backupPythonContract':python_contract(body),'otherPassveroBackupScripts':backup_scripts,'passveroBackupCronReferences':cron,'freshnessNumericConstants':numericFreshness,'reminderTimer':run(['systemctl','show','passvero-subscription-reminders.timer','--property=ActiveState,UnitFileState']),'restorePort55434Listeners':run(['ss','-H','-ltn','sport = :55434']),'candidateRecoveryDirectoryPresent':P('/var/lib/passvero-staging-recovery').exists() or P('/var/lib/passvero-staging-recovery').is_symlink(),'writes':'NONE','resticCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0},indent=2))

if __name__=='__main__':
    try: main()
    except Exception as e:
        print(json.dumps({'diagnostic':'STOP','reason':type(e).__name__,'phase':PHASE,'writes':'NONE','smtpCalls':0,'telegramCalls':0}))
        sys.exit(1)
PY_BACKUP_SCOPE_V3
```

Expected result: READ_ONLY_COMPLETION_V3, verified database/catalog summaries and
redacted installed scope contract; writes=NONE and restic/storage/smtp/Telegram calls0.
Return the output. This is read-only completion of the existing inventory, not approval
or execution of operational changes. The concrete plan follows the actual results.

## V3 result retained — only source compatibility remains

V3 topology/counters/B2 classification succeeded at 2026-10-01T15:49:59Z. Do not
repeat V1/V2/V3 or accepted email/backup/Telegram checks. Its empty Python contract
is an extractor limitation, not proof that production retention/preflight isolates
staging snapshots. The following block reads one unchanged installed source file,
parses it without executing it, and redacts unknown literal values. It does not
query SQL, call restic/Storage, change files/services or send anything. A full Python
module and lowercase heredoc cases and byte-literal redaction were locally tested.
If the source is a shell wrapper, returned Python blocks alone do not prove its shell
control flow safe; retain that limitation and do not infer repository compatibility.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_CONTRACT_ONLY

```sh
sudo python3 - <<'PY_BACKUP_CONTRACT'
"""Read and redact installed source only; never execute it or invoke subprocesses."""
import ast, datetime, hashlib, json, os, pathlib, re
SAFE = {'restic','backup','forget','prune','restore','snapshots','ls','dump','check','locks','host','hostname','tags','paths','path','passvero-production','passvero-postgresql','passvero','passvero_backup','passvero_acceptance','host,tags','host,paths','host,tags,paths','id','time','files','snapshot_id','summary','--keep-daily','--keep-weekly','--keep-monthly','--group-by','--host','--tag','--path','--json','--prune','/var/lib/passvero-backup','/var/lib/passvero-backup/backups','/var/lib/passvero-backup/staging'}
class Redact(ast.NodeTransformer):
    def visit_Constant(self, node):
        v=node.value
        safe=(isinstance(v,str) and (v in SAFE or bool(re.fullmatch(r'--[a-z][a-z-]*',v)))) or v is None or isinstance(v,bool) or (isinstance(v,int) and v in {0,1,2,6,8,10,14,24,26,60,3600,86400,93600})
        return node if safe else ast.copy_location(ast.Constant('<redacted literal>'),node)
def contract(body):
    try:
        tree=ast.parse(body)
        return {'form':'PYTHON_MODULE','sanitizedSource':ast.unparse(Redact().visit(tree))}
    except SyntaxError:
        lines=body.splitlines(); blocks=[]
        for i,line in enumerate(lines):
            m=re.search(r'<<-?\s*([\"\']?)([A-Za-z_][A-Za-z0-9_]*)\1(?:\s|$)',line)
            if not m: continue
            end=next((j for j in range(i+1,len(lines)) if lines[j].strip()==m[2]),None)
            if end is None: continue
            try: tree=ast.parse('\n'.join(lines[i+1:end]))
            except SyntaxError: continue
            blocks.append({'startLine':i+2,'endLine':end,'sanitizedSource':ast.unparse(Redact().visit(tree))})
        return {'form':'SHELL_WITH_PYTHON_BLOCKS','blocks':blocks,'shellControlFlowReviewed':False}
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
    p=pathlib.Path('/usr/local/sbin/passvero-postgres-backup')
    raw=p.read_bytes(); digest=hashlib.sha256(raw).hexdigest()
    assert digest=='5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75'
    c=contract(raw.decode())
    assert c.get('sanitizedSource') or c.get('blocks')
    print(json.dumps({'diagnostic':'READ_ONLY_BACKUP_CONTRACT','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':digest,'contract':c,'writes':'NONE','resticCalls':0,'sqlCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0},indent=2))
except Exception as e:
    print(json.dumps({'diagnostic':'STOP','reason':type(e).__name__,'writes':'NONE','resticCalls':0,'sqlCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0}))
    raise SystemExit(1)
PY_BACKUP_CONTRACT
```

Expected sanitized result: diagnostic READ_ONLY_BACKUP_CONTRACT, pinned source hash,
redacted source and explicit form; writes NONE and restic/sql/storage/smtp/Telegram
calls0. Otherwise STOP with exception class only. Return that output. No production
backup script execution or secret values. After reviewing it, finalize the single
operational proposal in the report and wait for approval before mutation commands.

## Python contract received — inspect only shell selectors

The18:04 CEST result is retained and reviewed. Its shellControlFlowReviewed=false
is respected: production-only validator input does not establish whether snapshots
were selected with production host/tag filters. No repository write or new repository
is justified by this missing layer. Do not rerun the earlier probes.

The block below reads the same pinned installed shell source and outputs only static
argv shapes, flags, variable names and recognized operation names. Unknown literals
are redacted. Backslash continuations are joined; non-Python heredoc helper/data lines
are labelled, and already-reviewed Python bodies are skipped. Generated helpers are
not executed. Any unresolved dynamic scope remains a compatibility gate.

### VPS TERMINAL — PENDING_OPERATOR_COMMAND_SHELL_SELECTORS_ONLY

```sh
sudo python3 - <<'PY_SHELL_SELECTORS'
"""Inspect shell argument structure only; no subprocesses or source execution."""
import ast, datetime, hashlib, json, os, pathlib, re, shlex
SAFE={'restic','snapshots','forget','backup','restore','check','locks','ls','dump','host,tags','host,paths','host,tags,paths','host','paths','tags','passvero-production','passvero-postgresql','passvero','0','1','2','6','8','10','14','24','26','60','93600'}
def inspect(body):
    rows=[]; pending=''; first=0; lines=body.splitlines(); skip=set(); heredoc=set()
    for i,line in enumerate(lines):
        m=re.search(r'<<-?\s*([\"\']?)([A-Za-z_][A-Za-z0-9_]*)\1(?:\s|$)',line)
        if not m: continue
        end=next((j for j in range(i+1,len(lines)) if lines[j].strip()==m[2]),None)
        if end is None: continue
        try: ast.parse('\n'.join(lines[i+1:end]))
        except SyntaxError: heredoc.update(range(i+2,end+1))
        else: skip.update(range(i+2,end+1))
    for number,line in enumerate(lines,1):
        if number in skip: continue
        if not pending: first=number
        stripped=line.rstrip()
        pending+=stripped[:-1]+' ' if stripped.endswith('\\') else stripped
        if stripped.endswith('\\'): continue
        statement=pending; pending=''
        if statement.lstrip().startswith('#'): continue
        if not re.search(r'\brestic\b|--(?:host|tag|path|group-by|keep-[a-z-]+)\b|\b(?:snapshot_host|snapshot_tag|retention_[a-z_]+|restic_[a-z_]+)\s*=',statement): continue
        try: tokens=shlex.split(statement,comments=True)
        except ValueError: tokens=[]
        safe=[]
        for token in tokens:
            if token in SAFE or re.fullmatch(r'--[a-z][a-z-]*',token): safe.append(token)
            elif re.fullmatch(r'--[a-z][a-z-]*=.*',token):
                flag,value=token.split('=',1)
                safe.append(flag+'='+(value if value in SAFE else '<redacted>'))
            else: safe.append('<redacted>')
        rows.append({'context':'HEREDOC_HELPER_OR_DATA' if first in heredoc else 'SHELL','startLine':first,'endLine':number,'argvShape':safe,'variables':sorted(set(re.findall(r'\$\{?([A-Za-z_][A-Za-z0-9_]*)',statement))),'flags':re.findall(r'(?<![A-Za-z0-9_])--[a-z][a-z-]*',statement),'recognizedOperations':sorted(set(re.findall(r'\b(?:restic|snapshots|forget|backup|restore|check|locks)\b',statement)))})
    if pending: raise ValueError('UNFINISHED_CONTINUATION')
    return rows
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
    p=pathlib.Path('/usr/local/sbin/passvero-postgres-backup')
    raw=p.read_bytes(); digest=hashlib.sha256(raw).hexdigest()
    assert digest=='5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75'
    rows=inspect(raw.decode()); assert rows
    print(json.dumps({'diagnostic':'READ_ONLY_SHELL_SELECTORS','observedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceSha256':digest,'statements':rows,'limitations':['Unknown literal values are redacted; this is static argument structure, not source execution'],'writes':'NONE','resticCalls':0,'sqlCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0},indent=2))
except Exception as e:
    print(json.dumps({'diagnostic':'STOP','reason':type(e).__name__,'writes':'NONE','resticCalls':0,'sqlCalls':0,'storageCalls':0,'smtpCalls':0,'telegramCalls':0}))
    raise SystemExit(1)
PY_SHELL_SELECTORS
```

Expected sanitized result: READ_ONLY_SHELL_SELECTORS with statements and pinned
source hash; writes NONE; restic/sql/storage/smtp/Telegram calls0. Return this output.
No backup script/service, forget/prune, snapshot creation/deletion or secrets exposure.
This closes only the missing argument layer before finalizing the single operational
proposal and requesting approval; it does not itself prove offsite bytes or restore.

## Read-only completion received — operational approval checkpoint

Shell selectors received at2026-10-01T17:03:32Z. No earlier probe is pending and no
inventory/acceptance is repeated. Unfiltered snapshots lists plus production-only
validators reject safe sharing of the production restic repository. Production
retention is host/tag-filtered; this does not fix the validator contract. Source
hash is unchanged; every returned write/call counter is zero.

The final single proposal is in the linked report: same B2 bucket/endpoint/credentials,
separate `passvero-staging-recovery-v1/` restic prefix after collision/permission checks,
acceptance DB plus full private PDF/image bytes and non-secret configuration manifest,
one-off backup and real B2 retrieval, new private isolated PG16/filesystem/app-read
proof. No production script/job/marker/schedule/Telegram change. An existing suitable
staging repository/set at the proposed destination is reused. Denied scope or unrelated
existing data means STOP; no new key or access-policy change is inferred.

**PENDING_USER_APPROVAL.** Do not run init, backup, restore, PM2 stop/start or target
creation before approval. Complete context-labelled operator blocks and sanitized
expected results will follow approval of the exact proposal. No mutation block is
pending now. Existing reminders acceptance remains closed and unchanged.
