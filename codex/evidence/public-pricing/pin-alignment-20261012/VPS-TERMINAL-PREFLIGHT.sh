# PENDING_OPERATOR_COMMAND — VPS TERMINAL: read-only marketing/backup-pin preflight
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_PIN_PREFLIGHT'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-marketing-pin-alignment-20261012/preflight.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'PREFLIGHT_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='57f9fcf0f293bcebc7e79d42ed2cabf5aef38f79f5153070b0aead7c4e460606','PREFLIGHT_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_MARKETING_PIN_PREFLIGHT
