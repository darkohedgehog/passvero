# VPS TERMINAL — srv1834647 / staging READ ONLY
# PENDING_OPERATOR_COMMAND
sudo /usr/bin/python3 -I -B - <<'PASSVERO_DASHBOARD_BASELINE'
import hashlib,json,os,pathlib,pwd,stat
try:
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647'
    p=pathlib.Path('/tmp/passvero-dashboard-ui-release-20261027/preflight-baseline.py')
    owner=pwd.getpwnam('darko').pw_uid
    assert p.parent.is_dir() and not p.parent.is_symlink()
    assert p.parent.stat().st_uid==owner and stat.S_IMODE(p.parent.stat().st_mode)==0o700
    s=p.lstat()
    assert stat.S_ISREG(s.st_mode) and not p.is_symlink() and s.st_uid==owner and s.st_nlink==1 and not s.st_mode&0o022
    body=p.read_bytes()
    assert hashlib.sha256(body).hexdigest()=='327398d434544e9dd4a26becbb656987d92a923ef9ca689a016e72830f68c5a0'
except Exception:
    print(json.dumps({'result':'STOP','check':'PREFLIGHT_HELPER_IDENTITY','automaticRetry':False,'mutations':'NONE'}))
    raise SystemExit(1)
exec(compile(body,str(p),'exec'),{'__name__':'__main__','__file__':str(p)})
PASSVERO_DASHBOARD_BASELINE
