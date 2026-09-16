import os
import pathlib
import subprocess

root = pathlib.Path('/run/passvero-qpdf')
assert os.geteuid() == 0 and root.is_dir() and not root.is_symlink()
input_path = root / 'input'
input_path.mkdir(mode=0o711)
input_path.chmod(0o711)  # Explicitly survive the service UMask=0077.
# Existing helper retains the accepted exact unit path and child resource limits.
subprocess.run(['/usr/bin/python3', '-I', '/usr/local/libexec/passvero-qpdf-cgroup-setup.py'], check=True)

# The helper originally ran in a service delegated to passvero-qpdf. In the
# root broker service, UMask=0077 instead creates root-only child directories.
# Delegate only migration, never directory writes or resource-controller files.
import pwd
cgroup = pathlib.Path('/sys/fs/cgroup/system.slice/passvero-qpdf-acceptance.service')
account = pwd.getpwnam('passvero-qpdf')
for name in ('adapter', 'parser'):
    child = cgroup / name
    assert child.is_dir() and not child.is_symlink() and child.stat().st_uid == 0
    assert not (child / 'cgroup.procs').read_text().strip()
    child.chmod(0o711)
# cgroup v2 checks destination AND common-ancestor cgroup.procs write access.
assert not (cgroup / 'cgroup.procs').read_text().strip()
os.chown(cgroup / 'cgroup.procs', account.pw_uid, account.pw_gid)
(cgroup / 'cgroup.procs').chmod(0o644)
