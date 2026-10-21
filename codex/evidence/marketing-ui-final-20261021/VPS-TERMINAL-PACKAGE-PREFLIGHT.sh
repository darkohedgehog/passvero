# PENDING_OPERATOR_COMMAND — VPS TERMINAL: exact package/pin preflight, READ ONLY
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_PACKAGE_PREFLIGHT'
import hashlib,json,pathlib,re,stat
try:
 p=pathlib.Path('/tmp/passvero-marketing-ui-release-20261021/preflight.py')
 assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'PREFLIGHT_FILE_POSTURE'
 body=p.read_bytes()
 assert hashlib.sha256(body).hexdigest()=='51643fedef4bf28e642219f1074382c7e5b64ec50ab61210b5caacb6fb19385f','PREFLIGHT_HASH_CHANGED'
 exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
except SystemExit:
 raise
except BaseException as e:
 reason=str(e) if re.fullmatch('[A-Z0-9_]{1,100}',str(e)) else type(e).__name__
 print(json.dumps({'result':'STOP','reason':reason,'automaticRetry':False,'mutations':'NONE'}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_PACKAGE_PREFLIGHT
