# VPS TERMINAL / PENDING_OPERATOR_COMMAND — preflight
# Only after the documented predecessor PASS; failure goes to independent closure.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_REBOOT_PHASE'
import json,re
try:
    import hashlib,importlib.util,json,os,pathlib,stat
    P=pathlib.Path
    assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
    root=P('/var/lib/passvero-reboot-recovery-20261014')
    st=root.lstat();assert stat.S_ISDIR(st.st_mode) and not root.is_symlink() and st.st_uid==0 and stat.S_IMODE(st.st_mode)==0o700,'ROOT_POSTURE'
    expected_manifest='9d165f83cecc87aa5a3cee557d36fc2c95f043f13bd32d345b5a4cef06eda622'
    manifest=root/'package.json'
    assert not manifest.is_symlink() and hashlib.sha256(manifest.read_bytes()).hexdigest()==expected_manifest,'PACKAGE_MANIFEST_CHANGED'
    for name,pin in json.loads(manifest.read_text())['files'].items():
     path=root/name;info=path.lstat()
     assert stat.S_ISREG(info.st_mode) and not path.is_symlink() and info.st_uid==0 and not info.st_mode&0o077,'SOURCE_POSTURE'
     assert hashlib.sha256(path.read_bytes()).hexdigest()==pin,'REVIEWED_SOURCE_CHANGED'
    spec=importlib.util.spec_from_file_location('one_reviewed_reboot',root/'reboot-reviewed.py')
    h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
    raise SystemExit(h.main('preflight'))
except SystemExit:
    raise
except BaseException as error:
    reason=str(error) if re.fullmatch("[A-Z0-9_]{1,160}",str(error)) else type(error).__name__
    print(json.dumps({"result":"STOP","CHECK_ID":'LOAD_02_PREFLIGHT',"reason":reason,"automaticRetry":False}))
    raise SystemExit(1)
PASSVERO_REBOOT_PHASE
