# PENDING_OPERATOR_COMMAND — VPS TERMINAL: restored-design exact read-only release/pin preflight
sudo /usr/bin/python3 -I -B - <<'PASSVERO_VISUAL_RELEASE_PREFLIGHT'
import hashlib,json,pathlib,re,stat
check_id='REVIEWED_PREFLIGHT_HELPER'
try:
 p=pathlib.Path('/tmp/passvero-marketing-visual-deploy-20261012/preflight.py')
 assert stat.S_ISREG(p.lstat().st_mode) and not p.is_symlink(),'PREFLIGHT_FILE_POSTURE'
 body=p.read_bytes()
 assert hashlib.sha256(body).hexdigest()=='e74a2a3b8c1387015bfa7e8a05ad19394242095905a8dde1000ae2ddbf10bfed','PREFLIGHT_HASH_CHANGED'
 exec(compile(body,str(p),'exec'),{'__name__':'__main__'})
except SystemExit:
 raise
except BaseException as error:
 reason=str(error) if re.fullmatch('[A-Z0-9_]{1,160}',str(error)) else type(error).__name__
 print(json.dumps({'result':'STOP','CHECK_ID':check_id,'reason':reason,'automaticRetry':False}),flush=True)
 raise SystemExit(1)
PASSVERO_VISUAL_RELEASE_PREFLIGHT
