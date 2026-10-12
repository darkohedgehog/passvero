# VPS TERMINAL — paired rollback only if explicitly needed after returned deployment proof
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_PAIRED_ROLLBACK'
import hashlib,pathlib,stat
p=pathlib.Path('/var/lib/passvero-marketing-pin-alignment-20261012/deploy-canonical-reviewed.py')
assert stat.S_ISREG(p.lstat().st_mode) and p.lstat().st_uid==0 and not p.lstat().st_mode&0o077,'ROLLBACK_HELPER_POSTURE'
body=p.read_bytes()
assert hashlib.sha256(body).hexdigest()=='2074b486e1c54aeb8a5938751d1d688c690f99cd6704f78b255713ef8be3731a','ROLLBACK_HELPER_CHANGED'
import sys
sys.argv=[str(p),'--rollback']
exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
print(pathlib.Path('/var/lib/passvero-marketing-pin-alignment-20261012/canonical-deploy-closure.json').read_text())
PASSVERO_MARKETING_PAIRED_ROLLBACK
