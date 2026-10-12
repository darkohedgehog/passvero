# PENDING_OPERATOR_COMMAND — VPS TERMINAL: reconciled exact-runtime read-only preflight
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_PIN_PREFLIGHT_V2'
import hashlib,pathlib,stat
p=pathlib.Path('/tmp/passvero-marketing-pin-alignment-20261012/preflight-v2.py')
assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'PREFLIGHT_FILE_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='f176a0d74ed133498986d8e9055a19320e77bca1078dbc773ad7b28b195f7892','PREFLIGHT_HASH_CHANGED'
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
PASSVERO_MARKETING_PIN_PREFLIGHT_V2
