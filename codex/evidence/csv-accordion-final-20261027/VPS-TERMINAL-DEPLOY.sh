# PENDING_OPERATOR_COMMAND — VPS TERMINAL, approved staging deployment
# Fresh idle/window guard requires >20min to backup/monitor terms.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CSV_BORDER_APPROVED_DEPLOY'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-csv-border-ui-release-20261027/launch-reviewed.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'LAUNCH_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='22be6288a160edbf691649c1cec0cff6e05badaeae5c5a4e763a518dd9e59b50','LAUNCH_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_CSV_BORDER_APPROVED_DEPLOY
