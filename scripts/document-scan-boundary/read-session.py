"""Operator-only one-shot. No installation of a privileged command grant.
Reads just the existing staging process's allowlisted environment in memory,
then drops all IDs/groups before running the read-only session resolver.
"""
import os
import json
import pathlib
import pwd
import stat
import subprocess
import time

P = pathlib.Path
source = P('/tmp/passvero-staging-session-input')
try:
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647'
    caller = pwd.getpwnam('darko')
    account = pwd.getpwnam('passvero-staging')
    fd = os.open(source, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    try:
        info = os.fstat(fd)
        assert stat.S_ISREG(info.st_mode) and info.st_uid == caller.pw_uid
        assert stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1
        assert 0 <= time.time() - info.st_mtime < 60 and 0 < info.st_size <= 8192
        cookie = os.read(fd, 8193)
        assert len(cookie) == info.st_size and not any(c in cookie for c in (b'\n', b'\r', b'\0'))
    finally:
        os.close(fd)
        # Only this known private handoff, never an application file.
        source.unlink()
    candidates = []
    for process in P('/proc').iterdir():
        if not process.name.isdigit():
            continue
        try:
            if process.stat().st_uid != account.pw_uid:
                continue
            if (process / 'comm').read_text().strip().startswith('next-server'):
                candidates.append(process)
        except FileNotFoundError:
            continue
    assert len(candidates) == 1, 'STAGING_PROCESS_NOT_UNIQUE'
    allowed = {'DATABASE_URL', 'AUTH_DATABASE_URL', 'BETTER_AUTH_SECRET', 'BETTER_AUTH_URL', 'PASSVERO_RUNTIME_ENV'}
    env = {'PATH': '/usr/bin:/bin', 'LANG': 'C', 'NODE_ENV': 'production'}
    for entry in (candidates[0] / 'environ').read_bytes().split(b'\0'):
        name, separator, value = entry.partition(b'=')
        if separator and name.decode() in allowed:
            env[name.decode()] = value.decode()
    assert env.get('PASSVERO_RUNTIME_ENV') == 'staging'
    assert env.get('BETTER_AUTH_URL') == 'https://staging.passvero.eu'
    result = subprocess.run(
        ['/usr/bin/node', '--conditions=react-server', '/opt/passvero-scan-boundary/session-check.cjs'],
        input=cookie, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
        user=account.pw_uid, group=account.pw_gid,
        extra_groups=os.getgrouplist(account.pw_name, account.pw_gid),
        cwd='/', env=env, timeout=20)
    assert result.returncode == 0
    assert result.stdout == b'REAL_SESSION_RESOLVER_CHECK=PASS; PRODUCT_EDIT=YES; DOCUMENT_MUTATIONS=NO\n'
    P('/var/lib/passvero-qpdf-staging-20260914/execution-boundary-975dc04/session.json').write_text(json.dumps({'result': 'PASS', 'context_exported': False, 'document_mutations': False}))
    print(result.stdout.decode().strip())
except Exception:
    print('REAL_SESSION_RESOLVER_CHECK=FAIL; NO_CONTEXT_EXPORTED')
    raise SystemExit(1)
