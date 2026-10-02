"""Final isolated application reads from accepted DB and real B2-downloaded private bytes."""
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
