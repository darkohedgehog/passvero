# PENDING_OPERATOR_COMMAND — VPS TERMINAL: exact package/pin preflight, READ ONLY
sudo /usr/bin/python3 -I -B - <<'PASSVERO_MARKETING_PACKAGE_PREFLIGHT'
import hashlib,json,pathlib,re,stat
try:
 p=pathlib.Path('/tmp/passvero-marketing-ui-release-20261021/preflight-v2.py')
 assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'PREFLIGHT_FILE_POSTURE'
 body=p.read_bytes()
 assert hashlib.sha256(body).hexdigest()=='c24643dc7ab1663edcfb520574cddeeac1450030e0b38b21edf2ba01bc543543','PREFLIGHT_HASH_CHANGED'
 exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
except SystemExit:
 raise
except BaseException as e:
 reason=str(e) if re.fullmatch('[A-Z0-9_]{1,100}',str(e)) else type(e).__name__
 print(json.dumps({'result':'STOP','reason':reason,'automaticRetry':False,'mutations':'NONE'}),flush=True)
 raise SystemExit(1)
PASSVERO_MARKETING_PACKAGE_PREFLIGHT
