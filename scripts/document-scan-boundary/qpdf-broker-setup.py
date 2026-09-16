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
