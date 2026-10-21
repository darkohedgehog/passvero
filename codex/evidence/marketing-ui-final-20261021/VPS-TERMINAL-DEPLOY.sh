# PENDING_OPERATOR_COMMAND — VPS TERMINAL, approved staging deployment
# Execute after the ordinary 18:20 CEST monitor run; fresh guard requires >20min.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_UI_APPROVED_DEPLOY'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-marketing-ui-release-20261021/launch-reviewed.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'LAUNCH_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='16acb66ff4616a4cb4beb8e69eed20827c1936a899aa89e9a01f69ea3aac490b','LAUNCH_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_MARKETING_UI_APPROVED_DEPLOY
