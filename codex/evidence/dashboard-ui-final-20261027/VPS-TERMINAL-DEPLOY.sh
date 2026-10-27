# PENDING_OPERATOR_COMMAND — VPS TERMINAL, approved staging deployment
# Fresh idle/window guard requires >20min to backup/monitor terms.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_DASHBOARD_UI_APPROVED_DEPLOY'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-dashboard-ui-release-20261027/launch-reviewed.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'LAUNCH_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='3f9abf9f7f54f51f9b5358aeb6fcc088f3dca44579d2aedc023c07097291ac95','LAUNCH_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_DASHBOARD_UI_APPROVED_DEPLOY
