# PENDING_OPERATOR_COMMAND — VPS TERMINAL: one read-only dependency diagnosis
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_DEPENDENCY_DIAGNOSIS'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-marketing-pin-alignment-20261012/dependency-diagnostic.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'DIAGNOSTIC_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='6b36bf28effeb7ddd03475cf4d2b3f092064d6b14effe3bbd1e64dac2a2fea1e','DIAGNOSTIC_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_MARKETING_DEPENDENCY_DIAGNOSIS
