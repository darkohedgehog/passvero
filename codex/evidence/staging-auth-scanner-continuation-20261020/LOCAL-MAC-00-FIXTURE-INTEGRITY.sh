# LOCAL MAC TERMINAL / PENDING_OPERATOR_COMMAND — not for the VPS.
# Read only the two approved source fixtures; no upload or server transfer.
python3 -I -B - <<'PASSVERO_CONTINUATION_LOCAL_FIXTURES'
import hashlib,json,pathlib
root=pathlib.Path('/Users/darkozivic/Desktop/Programiranje/passvero/.superpowers/brainstorm/staging-reboot-fixtures-20261019')
expected={'SYNTHETIC-STAGING-REBOOT-20261013.pdf':'fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec','SYNTHETIC-STAGING-REBOOT-20261014.png':'1ed5c1e5d6eff56de570af9a250598b0b7cd6547a1ce8c1634982918ed6a334d'}
result={'continuationId':'continuation-20261020-auth-flow-01','fixtures':{},'mutations':'NONE'}
for name,pin in expected.items():
    path=root/name
    if not path.is_file() or path.is_symlink():
        result['fixtures'][name]={'result':'STOP_MISSING_OR_SYMLINK'}
    else:
        actual=hashlib.sha256(path.read_bytes()).hexdigest()
        result['fixtures'][name]={'result':'PASS' if actual==pin else 'STOP_HASH_MISMATCH','sha256':actual,'path':str(path)}
result['result']='FIXTURES_MATCH' if all(v['result']=='PASS' for v in result['fixtures'].values()) else 'STOP'
print(json.dumps(result,indent=2))
PASSVERO_CONTINUATION_LOCAL_FIXTURES
