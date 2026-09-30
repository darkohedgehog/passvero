"""Explicit operator rollback of reminder application artifacts; retain all data and evidence."""
from common import A, R, P, sha, regular, run, sql, scope, pm, monitor, execute
import json, os, subprocess, sys


def unit_loaded(name):
    result=subprocess.run(['systemctl','show',name,'--property=LoadState','--value'],capture_output=True,text=True,timeout=10)
    if result.stdout.strip()=='not-found':
        assert not P('/etc/systemd/system',name).exists(),'UNIT_STATE_DRIFT'
        return False
    assert result.returncode==0 and result.stdout.strip()=='loaded','UNIT_STATE_UNEXPECTED'
    return True


def verify_directory(directory, name, files):
    assert directory.is_dir() and not directory.is_symlink(),'ROLLBACK_ARTIFACT_SCOPE'
    selected={n[len(name)+1:]:v for n,v in files.items() if n.startswith(name+'/')}
    assert selected,'ROLLBACK_MANIFEST_EMPTY'
    for relative,value in selected.items():
        path=directory/relative
        assert not P(relative).is_absolute() and '..' not in P(relative).parts,'ROLLBACK_MANIFEST_PATH'
        assert path.is_file() and not path.is_symlink() and sha(path)==(value['sha256'] if isinstance(value,dict) else value),'ROLLBACK_ARTIFACT_DRIFT'


def main(m):
    scope()
    state=R/'application'; recorded=json.loads((state/'state.json').read_text())
    assert recorded['manifest']==sys.argv[1] and recorded['old_build']==m['previous_build'],'STATE_DRIFT'
    assert not (state/'rollback-attempt.json').exists(),'DO_NOT_RETRY'
    canonical=P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
    regular(canonical); regular(state/'previous-runtime-manifest.json')
    prior=json.loads((state/'previous-runtime-manifest.json').read_text())
    current=json.loads(canonical.read_text())
    expected=dict(prior); expected['build_id']=m['build_id']; expected['reminders_manifest_sha256']=sys.argv[1]
    expected['files']={n:v for n,v in prior['files'].items() if not n.startswith(('.next/','messages/'))}
    # The original manifest can remain current if installation stopped during the swap.
    if current!=prior:
        assert current.keys()==expected.keys(),'CURRENT_DEPLOYMENT_DRIFT'
        assert {k:v for k,v in current.items() if k!='files'}=={k:v for k,v in expected.items() if k!='files'},'CURRENT_DEPLOYMENT_DRIFT'
        assert {n:v for n,v in current['files'].items() if not n.startswith(('.next/','messages/'))}==expected['files'],'CURRENT_DEPLOYMENT_DRIFT'
        assert {n:v['sha256'] for n,v in current['files'].items() if n.startswith(('.next/','messages/'))}==m['application_files'],'CURRENT_DEPLOYMENT_DRIFT'
    restore=[]
    for name in ['.next','messages']:
        active=A/name; old=A/(name+'.before-reminders'); failed=A/(name+'.failed-reminders')
        assert not failed.exists() and not failed.is_symlink(),'ROLLBACK_ARTIFACT_SCOPE'
        if old.exists():
            verify_directory(old,name,prior['files'])
            if active.exists():verify_directory(active,name,m['application_files'])
            else:assert not active.is_symlink(),'ROLLBACK_ARTIFACT_SCOPE'
            restore.append(name)
        else:
            assert not old.is_symlink(),'ROLLBACK_ARTIFACT_SCOPE'
            verify_directory(active,name,prior['files'])
    assert restore,'NO_APPLICATION_SWAP_TO_ROLL_BACK'
    timer='passvero-subscription-reminders.timer'; service='passvero-subscription-reminders.service'
    if unit_loaded(timer):run(['systemctl','disable','--now',timer])
    if unit_loaded(service):
        assert run(['systemctl','show',service,'--property=ActiveState','--value']) in ('inactive','failed'),'WAIT_FOR_ACTIVE_WORKER_THEN_REVIEW'
    assert sql('SELECT count(*) FROM "SubscriptionReminder" WHERE status IN (\'SENDING\',\'CLAIMED\')')=='0','RESOLVE_IN_FLIGHT_BEFORE_ROLLBACK'
    assert sql('SELECT count(*) FROM "ReminderCampaign" WHERE enabled')=='0','DISABLE_APPROVED_CAMPAIGNS_BEFORE_ROLLBACK'
    monitor(); (state/'rollback-attempt.json').write_text('{}'); pm(['stop','passvero-acceptance'])
    for name in restore:
        if (A/name).exists():(A/name).rename(A/(name+'.failed-reminders'))
        (A/(name+'.before-reminders')).rename(A/name)
    assert (A/'.next/BUILD_ID').read_text().strip()==m['previous_build'],'OLD_BUILD_MISSING'
    candidate=canonical.with_name('manifest.reminders-rollback.json'); candidate.write_bytes((state/'previous-runtime-manifest.json').read_bytes()); candidate.chmod(0o600); os.replace(candidate,canonical)
    pm(['restart','passvero-acceptance']); assert monitor()['status']=='online'; pm(['save'])
    print('APPLICATION_ROLLBACK=PASS; TIMER_ENABLED=NO; DATABASE_AND_HISTORY_RETAINED; LIVE_ROLLBACK_WAS_EXPLICIT')


if __name__=='__main__': execute(main)
