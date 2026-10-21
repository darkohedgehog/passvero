# VPS TERMINAL / PENDING_OPERATOR_COMMAND — 03-AUTH-CONTEXT
# PREPARED ONLY. Local two-path proof accepted; execute solely at the reviewed operator gate.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_CONTINUATION'
import json,re,os
os.umask(0o077)
try:
    import hashlib,importlib.util,pathlib,stat
    P=pathlib.Path
    require=lambda ok,reason: None if ok else (_ for _ in ()).throw(RuntimeError(reason))
    require(os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST')
    root=P('/var/lib/passvero-auth-flow-continuation-20261020-01');info=root.lstat()
    require(stat.S_ISDIR(info.st_mode) and not root.is_symlink() and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o700,'ROOT_POSTURE')
    manifest=root/'source-package.json';info=manifest.lstat()
    require(not manifest.is_symlink() and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o600,'MANIFEST_POSTURE')
    require(hashlib.sha256(manifest.read_bytes()).hexdigest()=='3035dfbbf0bcbd126c40fd0a64b4c187988e93aea13c7bbf9cdef22760dc6c15','EXACT_SOURCE_PACKAGE_CHANGED')
    pins=json.loads(manifest.read_text())['files']
    require(set(pins)=={'reboot-reviewed.py', 'recover-release-reviewed.py', 'continuation-reviewed.py', 'preflight.py', 'remaining-backup-and-actor-readonly.py'},'PACKAGE_SCOPE')
    modules={}
    for name,pin in pins.items():
        path=root/name;info=path.lstat()
        require(stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_uid==0 and stat.S_IMODE(info.st_mode)==0o600 and hashlib.sha256(path.read_bytes()).hexdigest()==pin,'SOURCE_CHANGED')
        spec=importlib.util.spec_from_file_location(name.replace('.','_'),path);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);modules[name]=module
    a=modules['continuation-reviewed.py'];a.configure(modules['reboot-reviewed.py'],modules['preflight.py'],modules['remaining-backup-and-actor-readonly.py'],modules['recover-release-reviewed.py'])
    raise SystemExit(a.main('auth'))
except SystemExit:
    raise
except BaseException as error:
    reason=str(error) if re.fullmatch('[A-Za-z0-9_]{1,160}',str(error)) else type(error).__name__
    print(json.dumps({'result':'STOP','CHECK_ID':'03-AUTH-CONTEXT','reason':reason,'automaticRetry':False}))
    raise SystemExit(1)
PASSVERO_CONTINUATION
