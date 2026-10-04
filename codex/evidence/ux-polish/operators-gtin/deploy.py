"""UI-only staging artifact replacement; all database queries are read-only."""
from common import A,R,S,P,sha,regular,run,sql,scope,pm,monitor,execute,identity
import hashlib,json,os,pwd,subprocess,sys,tarfile,time
CANONICAL=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
STATE=R/'deployment'

def safe_dirs():
 for p in [A,*A.parents]:
  assert p.is_dir() and not p.is_symlink(),'APP_DIRECTORY_SCOPE'

def off():
 value=run(['/usr/bin/systemctl','show','passvero-subscription-reminders.timer','-p','ActiveState','-p','UnitFileState'])
 assert 'ActiveState=inactive' in value and 'UnitFileState=disabled' in value,'REMINDER_TIMER_NOT_OFF'
 assert sql('BEGIN READ ONLY; SELECT count(*) FROM "ReminderCampaign" WHERE enabled; ROLLBACK;')=='0','CAMPAIGNS_ENABLED'

def protected():
 files=['/etc/passvero-signature-health.json','/usr/local/libexec/passvero-signature-health.cjs','/usr/local/libexec/passvero-signature-recovery-v3/reader.cjs','/usr/local/libexec/passvero-signature-recovery-v3/recover.py','/usr/local/libexec/passvero-signature-recovery-v3/pins.json','/usr/local/libexec/passvero-signature-recovery-v3/recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py']
 return {'files':{name:sha(P(name)) for name in files},'pids':{name:run(['/usr/bin/systemctl','show',name,'-p','MainPID','--value']) for name in ['clamav-freshclam.service','clamav-daemon.service']},'qpdf':run(['/usr/bin/systemctl','show','passvero-qpdf-broker.socket','-p','ActiveState','-p','SubState']),'signatureTimer':run(['/usr/bin/systemctl','show','passvero-signature-health.timer','-p','ActiveState','-p','UnitFileState'])}

def verify_files(root,files):
 for name,wanted in files.items():
  p=root/name
  assert name.startswith(('.next/','messages/')) and '..' not in P(name).parts and not P(name).is_absolute() and p.resolve().is_relative_to(root.resolve()) and p.is_file() and not p.is_symlink(),'ARTIFACT_SCOPE'
  assert sha(p)==wanted,'ARTIFACT_DRIFT'

def health():
 deadline=time.monotonic()+45
 while time.monotonic()<deadline:
  p=subprocess.run(['/usr/bin/curl','--silent','--max-time','3','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result}','https://staging.passvero.eu/login'],capture_output=True,text=True,timeout=5)
  if p.returncode==0 and p.stdout=='200 0':return
  time.sleep(1)
 raise AssertionError('HTTPS_NOT_READY')

def main(m):
 scope();safe_dirs();off()
 assert not STATE.exists(),'DO_NOT_RETRY_DEPLOYMENT'
 assert sha(P('/var/lib/passvero-ux-polish-20261004-v2/manifest.json'))==m['previous_manifest_sha256'],'PREVIOUS_RELEASE_MANIFEST_CHANGED'
 assert (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'],'BUILD_CHANGED'
 verify_files(A,m['previous_files'])
 regular(CANONICAL);old=CANONICAL.read_bytes();prior=json.loads(old)
 assert prior['build_id']==m['previous_build'],'CANONICAL_BUILD_CHANGED'
 assert all(prior['files'][name]['sha256']==wanted for name,wanted in m['previous_files'].items()),'CANONICAL_ARTIFACT_CHANGED'
 before=monitor();assert before['status']=='online','APP_NOT_ONLINE'
 keep=protected();account=pwd.getpwnam('passvero-staging')
 prepared=A/'.gtin-notice-20261004-prepared'
 assert not prepared.exists(),'PREPARED_ALREADY_EXISTS'
 for name in ['.next','messages']:
  assert (A/name).is_dir() and not (A/name).is_symlink() and not (A/(name+'.before-gtin-notice-20261004')).exists(),'SWAP_PATH_CHANGED'
 prepared.mkdir(mode=0o750);os.chown(prepared,account.pw_uid,account.pw_gid)
 with tarfile.open(S/'application.tar.gz') as tar:
  entries=tar.getmembers()
  assert len(entries)==len(m['application_files']) and {e.name for e in entries}==set(m['application_files']),'ARCHIVE_INVENTORY'
  for e in entries:
   assert e.isfile() and e.name.startswith(('.next/','messages/')) and '..' not in P(e.name).parts and not P(e.name).is_absolute(),'ARCHIVE_SCOPE'
   b=tar.extractfile(e).read();assert hashlib.sha256(b).hexdigest()==m['application_files'][e.name],'ARCHIVE_HASH'
   dest=prepared/e.name;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);dest.chmod(0o640);os.chown(dest,account.pw_uid,account.pw_gid)
   parent=dest.parent
   while parent!=prepared:parent.chmod(0o750);os.chown(parent,account.pw_uid,account.pw_gid);parent=parent.parent
 verify_files(prepared,m['application_files']);assert monitor()==before,'APP_CHANGED_DURING_PREPARATION'
 STATE.mkdir(mode=0o700)
 (STATE/'previous-runtime-manifest.json').write_bytes(old)
 (STATE/'protected-before.json').write_text(json.dumps(keep))
 (STATE/'state.json').write_text(json.dumps({'manifest':sys.argv[1],'old_build':m['previous_build'],'phase':'PREPARED'}))
 pm(['stop','passvero-acceptance'])
 for name in ['.next','messages']:
  (A/name).rename(A/(name+'.before-gtin-notice-20261004'));(prepared/name).rename(A/name)
 updated=dict(prior);updated['build_id']=m['build_id'];updated['gtin_notice_manifest_sha256']=sys.argv[1]
 updated['files']={name:value for name,value in prior['files'].items() if not name.startswith(('.next/','messages/'))}
 updated['files'].update({name:{'sha256':wanted,'bytes':(A/name).stat().st_size} for name,wanted in m['application_files'].items()})
 candidate=CANONICAL.with_name('manifest.gtin-notice-20261004-candidate.json')
 assert not candidate.exists(),'CANONICAL_CANDIDATE_EXISTS'
 data=json.dumps(updated,indent=2).encode();(STATE/'candidate-runtime-manifest.json').write_bytes(data)
 candidate.write_bytes(data);candidate.chmod(0o600);os.replace(candidate,CANONICAL)
 pm(['restart','passvero-acceptance']);health()
 assert monitor()['status']=='online','APP_NOT_ONLINE_AFTER'
 verify_files(A,m['application_files']);assert (A/'.next/BUILD_ID').read_text().strip()==m['build_id'],'NEW_BUILD_CHANGED'
 assert protected()==keep,'PROTECTED_SCANNER_CHANGED'
 off();pm(['save']);prepared.rmdir()
 (STATE/'state.json').write_text(json.dumps({'manifest':sys.argv[1],'old_build':m['previous_build'],'phase':'DEPLOYED'}))
 report={'deployment':'PASS','scope':'STAGING_UI_ONLY','buildId':m['build_id'],'verifiedArtifacts':len(m['application_files']),'stagingHttps':'200','rollback':'PREPARED_NOT_EXECUTED','scannerConfigurationAndPids':'UNCHANGED','qpdf':'UNCHANGED','reminderTimer':'DISABLED_INACTIVE','enabledCampaigns':0,'databaseWrites':0,'uploads':0,'scanCalls':0,'emails':0,'productionAccess':False,'publicGtinNotice':'REMOVED','businessDataChanges':False}
 (STATE/'result.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

if __name__=='__main__':execute(main)
