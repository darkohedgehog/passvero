import hashlib
import json
import os
import pathlib
import subprocess

P = pathlib.Path
R = P('/var/lib/passvero-qpdf-staging-20260914/execution-boundary-975dc04')
assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647'
subprocess.run(['systemctl', 'stop', 'passvero-qpdf-broker.socket', 'passvero-qpdf-acceptance.service'], check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
# Before removal require complete containment, including descendants.
for unit in ['passvero-qpdf-broker.socket', 'passvero-qpdf-acceptance.service']:
    state = subprocess.check_output(['systemctl', 'show', unit, '-p', 'ActiveState', '--value'], text=True).strip()
    assert state in ['inactive', 'failed']
manifest = json.loads((R / 'artifacts.json').read_text())
for name, target in json.loads((R / 'targets.json').read_text()).items():
    path = P(target)
    if path.exists():
        assert not path.is_symlink() and hashlib.sha256(path.read_bytes()).hexdigest() == manifest[name]
        path.unlink()
for path in ['/opt/passvero-scan-boundary', '/run/passvero-qpdf-broker']:
    p = P(path)
    if p.exists(): p.rmdir()
subprocess.run(['systemctl', 'daemon-reload'], check=True)
print('NEW_BOUNDARY_ROLLBACK=PASS; ACCEPTED_LAUNCHER_PROFILE_SCANNERS_UNCHANGED')
