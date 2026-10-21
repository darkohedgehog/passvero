# LOCAL MAC TERMINAL / PENDING_OPERATOR_COMMAND — after one authorized browser download.
# This reads a local file only; it does not authenticate, download or send anything.
python3 -I -B - <<'PASSVERO_ONE_AUTHORIZED_DOWNLOAD_HASH'
import hashlib,json,pathlib
path=pathlib.Path('/Users/darkozivic/Desktop/Programiranje/passvero/.superpowers/brainstorm/staging-reboot-fixtures-20261019/AUTH-DOWNLOAD-continuation-20261020-auth-flow-01.pdf')
expected='fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec'
if not path.is_file() or path.is_symlink():
    print(json.dumps({'result':'STOP_DOWNLOAD_FILE_MISSING_OR_SYMLINK','authCalls':0}))
else:
    body=path.read_bytes();actual=hashlib.sha256(body).hexdigest()
    print(json.dumps({'result':'PASS_IDENTICAL_PDF_BYTES' if actual==expected and len(body)==671 else 'STOP_DOWNLOAD_MISMATCH','sha256':actual,'bytes':len(body),'authCalls':0}))
PASSVERO_ONE_AUTHORIZED_DOWNLOAD_HASH
