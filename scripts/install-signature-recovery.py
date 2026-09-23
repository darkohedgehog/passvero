#!/usr/bin/env python3
"""Install the checksum-reviewed operator package only; no service operations."""
import hashlib
import json
import os
import pathlib
import stat


def main():
    if os.geteuid() != 0 or os.uname().nodename != 'srv1834647':
        raise RuntimeError('HOST_IDENTITY_REQUIRED')
    source = pathlib.Path(__file__).resolve().parent
    target = pathlib.Path('/usr/local/libexec/passvero-signature-recovery-v3')
    names = {'recover.py', 'producer.cjs', 'reader.cjs', 'pins.json', 'source-review.json'}
    checks = json.loads((source / 'install-manifest.json').read_text())
    if set(checks) != names:
        raise RuntimeError('PACKAGE_INVALID')
    payloads = {}
    for name, expected in checks.items():
        path = source / name
        st = path.lstat()
        if not stat.S_ISREG(st.st_mode) or st.st_nlink != 1:
            raise RuntimeError('PACKAGE_INVALID')
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != expected:
            raise RuntimeError('CHECKSUM_MISMATCH')
        payloads[name] = data
    for parent in [target.parent, *target.parent.parents]:
        st = parent.lstat()
        if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
            raise RuntimeError('PRIVATE_PARENT_REQUIRED')
    if target.exists():
        st = target.lstat()
        if not stat.S_ISDIR(st.st_mode) or st.st_uid != 0 or st.st_mode & 0o022:
            raise RuntimeError('INSTALLED_PACKAGE_UNTRUSTED')
        for name, data in payloads.items():
            st = (target / name).lstat()
            if not stat.S_ISREG(st.st_mode) or st.st_uid != 0 or st.st_nlink != 1 or st.st_mode & 0o022:
                raise RuntimeError('INSTALLED_PACKAGE_UNTRUSTED')
            if (target / name).read_bytes() != data:
                raise RuntimeError('INSTALLED_PACKAGE_DIFFERS')
        print(json.dumps({'installation': 'ALREADY_INSTALLED', 'runtime_changed': False}))
        return
    staging = target.with_name(target.name + '.install-' + os.urandom(8).hex())
    staging.mkdir(mode=0o700)
    for name, data in payloads.items():
        with (staging / name).open('xb') as stream:
            stream.write(data)
            stream.flush()
            os.fchmod(stream.fileno(), 0o644)
            os.fsync(stream.fileno())
    os.chmod(staging, 0o755)
    fd = os.open(staging, os.O_RDONLY | os.O_DIRECTORY)
    os.fsync(fd)
    os.close(fd)
    os.rename(staging, target)
    fd = os.open(target.parent, os.O_RDONLY | os.O_DIRECTORY)
    os.fsync(fd)
    os.close(fd)
    print(json.dumps({'installation': 'PASS', 'runtime_changed': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'installation': 'STOP', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__}))
        raise SystemExit(1)
