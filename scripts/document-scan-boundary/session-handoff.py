"""Unprivileged fixed, exclusive credential handoff with 60-second expiry."""
import os
import pathlib
import pwd
import subprocess
import sys
import time

P = pathlib.Path('/tmp/passvero-staging-session-input')
assert os.geteuid() == pwd.getpwnam('darko').pw_uid
if len(sys.argv) == 3 and sys.argv[1] == '--expire':
    inode = int(sys.argv[2])
    time.sleep(60)
    try:
        if P.lstat().st_ino == inode:
            P.unlink()
    except FileNotFoundError:
        pass
elif len(sys.argv) == 1:
    data = sys.stdin.buffer.read(8193)
    assert 0 < len(data) <= 8192 and not any(c in data for c in (b'\0', b'\n', b'\r'))
    fd = os.open(P, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    try:
        info = os.fstat(fd)
        assert os.write(fd, data) == len(data)
        os.fsync(fd)
        subprocess.Popen(['/usr/bin/python3', '-I', __file__, '--expire', str(info.st_ino)],
            stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            close_fds=True, start_new_session=True)
    except BaseException:
        P.unlink()
        raise
    finally:
        os.close(fd)
else:
    raise SystemExit(1)
