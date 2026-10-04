"""Explicit staging UI rollback; retain failed artifacts, all user data and evidence."""
from common import A,R,P,sha,regular,pm,execute
from deploy import STATE,CANONICAL,verify_files,off,health,protected
import json,os,sys

def main(m):
 off();regular(STATE/'state.json');recorded=json.loads((STATE/'state.json').read_text())
 assert recorded['manifest']==sys.argv[1] and recorded['old_build']==m['previous_build'],'STATE_CHANGED'
 assert not (STATE/'rollback-attempt.json').exists(),'DO_NOT_RETRY_ROLLBACK'
 regular(STATE/'previous-runtime-manifest.json');old=(STATE/'previous-runtime-manifest.json').read_bytes()
 current=CANONICAL.read_bytes()
 assert current==old or current==(STATE/'candidate-runtime-manifest.json').read_bytes(),'CANONICAL_CHANGED'
 restore=[]
 for name in ['.next','messages']:
  previous=A/(name+'.before-ux-polish-20261004');active=A/name;failed=A/(name+'.failed-ux-polish-20261004')
  assert not failed.exists() and not failed.is_symlink(),'FAILED_PATH_EXISTS'
  old_files={n[len(name)+1:]:v for n,v in m['previous_files'].items() if n.startswith(name+'/')}
  new_files={n[len(name)+1:]:v for n,v in m['application_files'].items() if n.startswith(name+'/')}
  def verify_sub(directory,files):
   assert directory.is_dir() and not directory.is_symlink(),'ROLLBACK_DIRECTORY'
   for relative,wanted in files.items():
    p=directory/relative;assert p.is_file() and not p.is_symlink() and sha(p)==wanted,'ROLLBACK_ARTIFACT_CHANGED'
  if previous.exists():
   verify_sub(previous,old_files)
   if active.exists():verify_sub(active,new_files)
   restore.append(name)
  else:verify_sub(active,old_files)
 assert restore,'NO_SWAPPED_ARTIFACTS'
 (STATE/'rollback-attempt.json').write_text('{}');pm(['stop','passvero-acceptance'])
 for name in restore:
  active=A/name
  if active.exists():active.rename(A/(name+'.failed-ux-polish-20261004'))
  (A/(name+'.before-ux-polish-20261004')).rename(active)
 candidate=CANONICAL.with_name('manifest.ux-polish-rollback-candidate.json');assert not candidate.exists(),'ROLLBACK_CANDIDATE_EXISTS'
 candidate.write_bytes(old);candidate.chmod(0o600);os.replace(candidate,CANONICAL)
 pm(['restart','passvero-acceptance']);health();off();verify_files(A,m['previous_files'])
 assert protected()==json.loads((STATE/'protected-before.json').read_text()),'PROTECTED_SCANNER_CHANGED'
 pm(['save'])
 report={'rollback':'PASS','buildId':m['previous_build'],'stagingHttps':'200','dataAndFailedArtifacts':'RETAINED','productionAccess':False}
 (STATE/'rollback-result.json').write_text(json.dumps(report));print(json.dumps(report,indent=2))

if __name__=='__main__':execute(main)
