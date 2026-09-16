"""Operator-run installation only; no service start and no document operations."""
import hashlib
import json
import os
import pathlib
import pwd
import shutil
import subprocess
import time

P = pathlib.Path
HERE = P(__file__).resolve().parent
RECORD = P('/var/lib/passvero-qpdf-staging-20260914/execution-boundary-975dc04')
TARGETS = {
    'qpdf-broker.py': '/usr/local/libexec/passvero-qpdf-broker.py',
    'qpdf-broker-setup.py': '/usr/local/libexec/passvero-qpdf-broker-setup.py',
    'passvero-qpdf-acceptance.service': '/etc/systemd/system/passvero-qpdf-acceptance.service',
    'passvero-qpdf-broker.socket': '/etc/systemd/system/passvero-qpdf-broker.socket',
    'smoke-client.cjs': '/opt/passvero-scan-boundary/smoke-client.cjs',
    'runner-library.cjs': '/opt/passvero-scan-boundary/runner-library.cjs',
    'session-check.cjs': '/opt/passvero-scan-boundary/session-check.cjs',
    'session-handoff.py': '/opt/passvero-scan-boundary/session-handoff.py',
    'read-session.py': '/opt/passvero-scan-boundary/read-session.py',
}

def run(args):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=20).stdout


def main():
    assert os.geteuid() == 0 and run(['hostname']).strip() == 'srv1834647'
    assert not RECORD.exists(), 'DO_NOT_RERUN'
    assert not P('/opt/passvero-scan-boundary').exists()
    for target in TARGETS.values():
        assert not P(target).exists() and not P(target).is_symlink(), 'EXISTING_TARGET'
    assert not P('/run/passvero-qpdf').exists()
    assert run(['systemctl', 'show', 'passvero-qpdf-acceptance.service', '-p', 'LoadState', '--value']).strip() == 'not-found'
    assert run(['systemctl', 'show', 'passvero-qpdf-broker.socket', '-p', 'LoadState', '--value']).strip() == 'not-found'
    account = pwd.getpwnam('passvero-qpdf'); stage = pwd.getpwnam('passvero-staging')
    assert account.pw_uid != stage.pw_uid and account.pw_uid != 0 and stage.pw_uid != 0
    executable = P('/usr/bin/qpdf')
    assert executable.is_file() and not executable.is_symlink()
    assert executable.stat().st_uid == 0 and executable.stat().st_mode & 0o022 == 0
    assert run(['dpkg-query', '-W', '-f=${Version}', 'qpdf']) == '11.9.0-1.1ubuntu0.1'
    profile = P('/etc/apparmor.d/passvero-qpdf')
    assert hashlib.sha256(profile.read_bytes()).hexdigest() == '4293ff64d77930135c1cc5ac1585af5d1c87c22b3ebea39a1fca9cade1225a5e'
    assert 'passvero-qpdf (enforce)' in P('/sys/kernel/security/apparmor/profiles').read_text().splitlines()
    old = json.loads(P('/var/lib/passvero-qpdf-staging-20260914/final-report.json').read_text())
    for target in ['/usr/local/libexec/passvero-qpdf-launch', '/usr/local/libexec/passvero-qpdf-cgroup-setup.py']:
        assert hashlib.sha256(P(target).read_bytes()).hexdigest() == old['persistent_files_sha256'][target]
    manifest = json.loads((HERE / 'artifacts.json').read_text())
    for name, expected in manifest.items():
        assert P(name).name == name
        assert hashlib.sha256((HERE / name).read_bytes()).hexdigest() == expected
    protected = {}
    for unit in ['clamav-daemon.service', 'clamav-freshclam.service', 'nginx.service', 'postgresql@16-main.service', 'postgresql@16-acceptance.service']:
        protected[unit] = run(['systemctl', 'show', unit, '-p', 'ActiveState', '-p', 'MainPID', '-p', 'ExecMainStartTimestampMonotonic'])
    for unit in ['clamav-daemon.service', 'clamav-freshclam.service']:
        assert 'ActiveState=active' in protected[unit]
    evidence_path = P('/var/lib/passvero-signature-health/health.json')
    evidence_stat = evidence_path.lstat()
    assert not evidence_path.is_symlink() and evidence_stat.st_uid == 0 and evidence_stat.st_size < 65536
    evidence = json.loads(evidence_path.read_text())
    now = time.time() * 1000
    assert evidence['schemaVersion'] == 2 and evidence['status'] == 'HEALTHY'
    assert evidence['observedAt'] <= now < evidence['expiresAt'] <= evidence['observedAt'] + 60000
    for host in ['staging.passvero.eu']:
        assert run(['curl', '--max-time', '10', '-sS', '-o', '/dev/null', '-w', '%{http_code} %{ssl_verify_result}', 'https://' + host]) == '200 0'
    RECORD.mkdir(mode=0o700)
    (RECORD / 'artifacts.json').write_text(json.dumps(manifest))
    shutil.copy2(HERE / 'rollback.py', RECORD / 'rollback.py')
    (RECORD / 'targets.json').write_text(json.dumps(TARGETS))
    P('/opt/passvero-scan-boundary').mkdir(mode=0o755)
    P('/opt/passvero-scan-boundary').chmod(0o755)
    installed = []
    try:
        for name, target in TARGETS.items():
            path = P(target)
            path.parent.mkdir(parents=True, exist_ok=True)
            with path.open('xb') as stream:
                stream.write((HERE / name).read_bytes())
                os.fchmod(stream.fileno(), 0o644)
                os.fchown(stream.fileno(), 0, 0)
            installed.append(target)
        run(['systemd-analyze', 'verify', TARGETS['passvero-qpdf-acceptance.service'], TARGETS['passvero-qpdf-broker.socket']])
        run(['systemctl', 'daemon-reload'])
        for unit, before in protected.items():
            assert run(['systemctl', 'show', unit, '-p', 'ActiveState', '-p', 'MainPID', '-p', 'ExecMainStartTimestampMonotonic']) == before
        (RECORD / 'installation.json').write_text(json.dumps({'protected': protected, 'installed': installed}))
        print(json.dumps({'installation': 'PASS', 'timer_and_scanners': 'UNCHANGED', 'qpdf_socket': 'NOT_STARTED', 'smoke': 'NOT_RUN', 'profile': 'UNCHANGED', 'rollback': str(RECORD / 'rollback.py')}))
    except Exception:
        subprocess.run(['/usr/bin/python3', '-B', str(RECORD / 'rollback.py')], check=True)
        raise


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('INSTALLATION=STOP; ERROR_TYPE=' + type(error).__name__)
        raise SystemExit(1)
