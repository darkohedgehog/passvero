# PREPARED_ROLLBACK_ONLY — VPS TERMINAL: do not run with the deploy block
sudo /usr/bin/python3 -I -B - <<'PASSVERO_DASHBOARD_UI_PAIRED_ROLLBACK'
import hashlib,pathlib,stat
p=pathlib.Path('/var/lib/passvero-dashboard-ui-deploy-20261027/deploy-reviewed.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink() and p.lstat().st_uid==0 and not p.stat().st_mode & 0o077,'REVIEWED_HELPER_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='97a139c9892e831b251ada16eb80c13a94ff2078df3030e8ab8b7b38fffd1c87','REVIEWED_HELPER_CHANGED'
import importlib.util,json,re
spec=importlib.util.spec_from_file_location('dashboard_ui_rollback',p)
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
try:
 h.require(__import__('os').geteuid()==0 and __import__('os').uname().nodename=='srv1834647','OPERATOR_HOST')
 h.close(True)
 print(json.dumps(json.loads(h.read(h.ROOT/'rollback-closure.json')),sort_keys=True,indent=2))
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 result={'result':'STOP','CHECK_ID':h.CHECK_ID,'reason':reason,'automaticRetry':False}
 if not (h.ROOT/'rollback-closure-failure.json').exists():h.record('rollback-closure-failure.json',result)
 print(json.dumps(result),flush=True)
 raise SystemExit(1)
PASSVERO_DASHBOARD_UI_PAIRED_ROLLBACK
