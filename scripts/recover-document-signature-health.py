#!/usr/bin/env python3
"""Explicit staging recovery. Run with python3 -I -B; never from the application.

Only the existing producer writes health. An interrupted attempt requires an
explicit rollback; the journal is evidence, not permission to skip validation.
"""
import argparse
import contextlib
import fcntl
import hashlib
import json
import os
import pathlib
import re
import shutil
import socket
import stat
import subprocess
import time

P = pathlib.Path
ROOT = P('/var/lib/passvero-signature-trust')
RECORDS = ROOT / 'records/recovery'
CONFIG = P('/etc/passvero-signature-health.json')
FRESH = P('/etc/clamav/freshclam.conf')
DAEMON = P('/etc/clamav/clamd.conf')
PRODUCER = P('/usr/local/libexec/passvero-signature-health.cjs')
PACKAGE = P('/usr/local/libexec/passvero-signature-recovery-v3')
HEALTH = P('/var/lib/passvero-signature-health/health.json')
TIMER = 'passvero-signature-health.timer'
SERVICE = 'passvero-signature-health.service'
UPDATER = 'clamav-freshclam.service'
CLAMD = 'clamav-daemon.service'
SOCKET = 'clamav-daemon.socket'
PHASES = ('quiesce', 'backup', 'candidate', 'updater', 'daemon', 'scheduled')


class Stop(Exception):
    pass


def require(condition, code):
    if not condition:
        raise Stop(code)


def sync_directory(path):
    fd = os.open(path, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def atomic(path, data, mode=0o600, uid=0, gid=0):
    temporary = path.with_name(path.name + '.new-' + os.urandom(8).hex())
    fd = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, mode)
    try:
        with os.fdopen(fd, 'wb') as stream:
            stream.write(data)
            stream.flush()
            if os.geteuid() == 0:
                os.fchown(stream.fileno(), uid, gid)
            os.fchmod(stream.fileno(), mode)  # os.open mode is filtered by umask.
            os.fsync(stream.fileno())
        os.replace(temporary, path)
        sync_directory(path.parent)
    finally:
        if temporary.exists():
            temporary.unlink()


def write_state(path, value):
    atomic(path, json.dumps(value, sort_keys=True).encode() + b'\n')


def read_state(path):
    return json.loads(path.read_text()) if path.exists() else None


@contextlib.contextmanager
def exclusive(path):
    fd = os.open(path, os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        st = os.fstat(fd)
        require(stat.S_ISREG(st.st_mode) and st.st_uid == os.geteuid()
                and st.st_nlink == 1 and stat.S_IMODE(st.st_mode) == 0o600, 'LOCK_UNTRUSTED')
        try:
            fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise Stop('RECOVERY_BUSY') from None
        yield
    finally:
        os.close(fd)  # Persistent inode; never delete another process's lock.


def replace_directive(text, key, value):
    pattern = re.compile(r'^' + re.escape(key) + r'[ \t]+[^\r\n]*$', re.M)
    require(len(pattern.findall(text)) == 1, 'CONFIGURATION_INVALID')
    return pattern.sub(key + ' ' + value, text)


def execute(path, host, rollback=False):
    state = read_state(path)
    if rollback:
        require(state is not None, 'ATTEMPT_NOT_FOUND')
        if state['phase'] == 'ROLLED_BACK':
            return 'ALREADY_ROLLED_BACK'
        host.contain()
        host.restore()
        write_state(path, {'phase': 'ROLLED_BACK'})
        return 'ROLLED_BACK_FAIL_CLOSED'
    if state:
        if state['phase'] == 'COMPLETE':
            require(host.accepted(), 'RECOVERY_REQUIRED')
            return 'ALREADY_RECOVERED'
        if state['phase'] == 'ROLLED_BACK':
            raise Stop('NEW_ATTEMPT_ID_REQUIRED')
        host.contain()
        raise Stop('INTERRUPTED_REQUIRES_ROLLBACK')
    # Journal intent before the first mutation. No speculative resume after crash.
    try:
        for phase in PHASES:
            write_state(path, {'phase': phase})
            getattr(host, phase)()
        require(host.accepted(), 'READER_REJECTED')
        write_state(path, {'phase': 'COMPLETE'})
        return 'RECOVERED'
    except BaseException:
        host.contain()
        raise


def digest(path):
    with path.open('rb') as stream:
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
        return h.hexdigest()


def private(path, owners=(0,), directory=False):
    st = path.lstat()
    require((stat.S_ISDIR(st.st_mode) if directory else stat.S_ISREG(st.st_mode))
            and st.st_uid in owners and not st.st_mode & 0o022
            and (directory or st.st_nlink == 1), 'PRIVATE_INPUT_REQUIRED')
    return st


def run(args, timeout=40, success=True, uid=None):
    # Do not inherit PM2 IPC, credentials or process-specific Node settings.
    options = {}
    if uid is not None:
        options = {'user': uid, 'group': uid, 'extra_groups': [988]}
    result = subprocess.run(args, capture_output=True, timeout=timeout,
                            env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin',
                                 'LANG': 'C', 'LC_ALL': 'C', 'TZ': 'Europe/Zagreb'}, **options)
    require(not success or result.returncode == 0, 'COMMAND_FAILED')
    return result


def system(*args, success=True):
    return run(['/usr/bin/systemctl', *args], success=success)


def active(unit):
    return system('is-active', unit, success=False).stdout.decode().strip()


def main_pid(unit):
    return int(system('show', unit, '--property=MainPID', '--value').stdout.strip())


def await_confined(observe, unit, executable, now=time.monotonic, sleep=time.sleep):
    deadline = now() + 5
    while now() < deadline:
        observed = observe()
        if observed is None or observed['exe'] in (
            '/usr/lib/systemd/systemd-executor', '/lib/systemd/systemd-executor',
            '/usr/lib/systemd/systemd', '/lib/systemd/systemd',
        ):
            # Type=simple start returns before credentials/exec are applied.
            # Never accept this state; only wait for the actual confined binary.
            sleep(0.05)
            continue
        require(observed['exe'] == executable, 'SCANNER_EXECUTABLE_CHANGED')
        require(observed['uids'] == [108] * 4, 'SCANNER_IDENTITY_CHANGED')
        require(observed['profile'] == executable + ' (enforce)', 'CONFINEMENT_CHANGED')
        require(observed['cgroup'] == '0::/passveroclamav.slice/' + unit, 'CONFINEMENT_CHANGED')
        return observed['pid']
    raise Stop('SCANNER_START_TIMEOUT')


def await_ready(probe, now=time.monotonic, sleep=time.sleep):
    # Startup readiness budget, separate from unchanged producer/health deadlines.
    deadline = now() + 120
    while now() < deadline:
        if probe():
            return
        sleep(1)
    raise Stop('DAEMON_READINESS_TIMEOUT')


def version_ready(path):
    with socket.socket(socket.AF_UNIX, socket.SOCK_STREAM) as client:
        deadline = time.monotonic() + 2
        client.settimeout(2)
        try:
            client.connect(path)
            client.sendall(b'zVERSION\0')
            data = b''
            while not data.endswith(b'\0'):
                remaining = deadline - time.monotonic()
                if remaining <= 0:
                    return False
                client.settimeout(remaining)
                block = client.recv(4097 - len(data))
                if not block:
                    break
                data += block
                require(len(data) <= 4096, 'DAEMON_RESPONSE_INVALID')
        except (TimeoutError, socket.timeout, ConnectionRefusedError, FileNotFoundError):
            return False
    require(re.fullmatch(rb'ClamAV 1\.5\.[34]/[0-9]+/[^\x00-\x1f\x7f-\xff]{24}\x00', data) is not None,
            'DAEMON_RESPONSE_INVALID')
    return True


class LinuxHost:
    def __init__(self, attempt):
        self.attempt = attempt
        self.archive = RECORDS / attempt
        self.db = ROOT / 'db' / ('recovery-' + attempt)
        self.up_log = ROOT / 'updater' / ('recovery-' + attempt + '.log')
        self.da_log = ROOT / 'daemon' / ('recovery-' + attempt + '.log')
        self.backups = self.archive / 'backup.json'
        self.config = json.loads(CONFIG.read_text())

    def guard(self):
        require(os.uname().nodename == 'srv1834647' and os.geteuid() == 0, 'HOST_IDENTITY_REQUIRED')
        for path in [ROOT, ROOT / 'records', RECORDS, PACKAGE]:
            private(path, directory=True)
        private(CONFIG)
        require(self.config['scannerUid'] == 108 and self.config['outputGid'] == 1001
                and self.config['outputPath'] == str(HEALTH)
                and self.config['socketPath'] == '/run/clamav/clamd.ctl'
                and self.config['updaterConfig'] == str(FRESH), 'CONFIGURATION_CHANGED')
        for key, base in [('databaseDirectory', ROOT / 'db'), ('updaterLog', ROOT / 'updater'), ('daemonLog', ROOT / 'daemon')]:
            path = P(self.config[key])
            require(path == base or path.parent == base, 'CONFIGURATION_CHANGED')
            private(path, (0, 108), directory=key == 'databaseDirectory')
        require(digest(FRESH) == self.config['updaterConfigSha256'], 'CONFIGURATION_CHANGED')
        for path, log_key, log_path, expected in (
            (FRESH, 'UpdateLogFile', ROOT / 'updater/evidence.log',
             'bd6ea9ef12d71b9b03abcd3cb02f0970eb188248b1c751b95d172fd9f7b2fc8c'),
            (DAEMON, 'LogFile', ROOT / 'daemon/evidence.log',
             '58aa6b2e34bf6bc60a4bcf3431436e7b0f8ba44c51ac48a1377e5bc7ba69a821'),
        ):
            normalized = replace_directive(path.read_text(), 'DatabaseDirectory', str(ROOT / 'db'))
            normalized = replace_directive(normalized, log_key, str(log_path))
            require(hashlib.sha256(normalized.encode()).hexdigest() == expected, 'CONFIGURATION_CHANGED')
        require(digest(PRODUCER) in (
            '82a3ba1105fc025889657f5d49d86261119c876ba9770cfb899bf934e2b67e02',
            digest(PACKAGE / 'producer.cjs'),
        ), 'PRODUCER_ARTIFACT_CHANGED')
        pins = json.loads((PACKAGE / 'pins.json').read_text())
        for name, expected in pins.items():
            path = P(name)
            private(path)
            require(digest(path) == expected, 'PROTECTED_INPUT_CHANGED')
        # The one historical ownership defect is permitted only before correction.
        private(FRESH, (0, 108))
        require(active('pm2-passvero-staging.service') == 'active', 'STAGING_NOT_ACTIVE')
        require(P('/var/www/passvero-acceptance/.next/BUILD_ID').read_text().strip()
                == 'qwLCXFTd9EEGdvqaB9SZS', 'STAGING_RELEASE_CHANGED')
        require(shutil.disk_usage(ROOT).free > 2_000_000_000, 'DISK_SPACE_REQUIRED')
        self.consumers()

    def consumers(self):
        # Inspect identities only. Never read process environment or application data.
        for directory in P('/proc').iterdir():
            if not directory.name.isdigit():
                continue
            try:
                fields = dict(line.split(':', 1) for line in (directory / 'status').read_text().splitlines() if ':' in line)
                uid = int(fields['Uid'].split()[0])
                groups = set(map(int, fields['Groups'].split())) | set(map(int, fields['Gid'].split()))
                require(988 not in groups or uid in (0, 108, 1001), 'UNEXPECTED_SOCKET_CONSUMER')
            except FileNotFoundError:
                continue

    def no_writers(self):
        for directory in P('/proc').iterdir():
            if directory.name.isdigit():
                try:
                    uids = re.search(r'^Uid:\s+(.+)$', (directory / 'status').read_text(), re.M)[1]
                    require(108 not in set(map(int, uids.split())), 'UNEXPECTED_SCANNER_PROCESS')
                except FileNotFoundError:
                    pass

    def stop_producer(self):
        system('disable', '--now', TIMER)
        deadline = time.monotonic() + 20
        while active(SERVICE) in ('active', 'activating', 'deactivating') and time.monotonic() < deadline:
            time.sleep(0.2)
        require(active(SERVICE) in ('inactive', 'failed'), 'PRODUCER_STILL_RUNNING')
        require(not P(str(HEALTH) + '.lock').exists(), 'PRODUCER_LOCK_PRESENT')
        # Quarantine an existing snapshot, never overwrite it with fabricated health.
        if HEALTH.exists():
            private(HEALTH)
            os.rename(HEALTH, self.archive / ('invalidated-' + str(time.time_ns()) + '.json'))
            sync_directory(HEALTH.parent)
            sync_directory(self.archive)

    def contain(self):
        self.stop_producer()
        system('stop', UPDATER, CLAMD, SOCKET)
        require(all(active(u) in ('inactive', 'failed') for u in (UPDATER, CLAMD, SOCKET)), 'CONTAINMENT_FAILED')

    def quiesce(self):
        self.contain()
        self.no_writers()

    def backup(self):
        self.no_writers()
        entries = []
        sources = [CONFIG, FRESH, DAEMON, PRODUCER,
                   P(self.config['updaterLog']), P(self.config['daemonLog'])]
        old_db = P(self.config['databaseDirectory'])
        for path in old_db.iterdir():
            if path.is_dir() and path.name.startswith('recovery-') and old_db == ROOT / 'db':
                private(path, (0, 108), directory=True)
                continue  # Older isolated periods are already retained and are not active DB files.
            private(path, (0, 108))
            sources.append(path)
        for index, source in enumerate(sources):
            st = private(source, (0, 108))
            target = self.archive / ('before-' + str(index))
            with source.open('rb') as incoming, target.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
                outgoing.flush()
                os.fsync(outgoing.fileno())
            os.chmod(target, 0o600)
            require(digest(source) == digest(target), 'BACKUP_CHANGED')
            entries.append({'path': str(source), 'backup': target.name, 'sha256': digest(target),
                            'uid': st.st_uid, 'gid': st.st_gid, 'mode': stat.S_IMODE(st.st_mode)})
        write_state(self.backups, entries)

    def candidate(self):
        self.no_writers()
        self.db.mkdir(mode=0o700)  # Exclusive: an existing candidate is never reused.
        os.chown(self.db, 108, 113)
        # Preserve CDN cooldown state; a new trust period is not a download-limit bypass.
        previous_dat = P(self.config['databaseDirectory']) / 'freshclam.dat'
        if previous_dat.exists():
            private(previous_dat, (108,))
            atomic(self.db / 'freshclam.dat', previous_dat.read_bytes(), uid=108, gid=113)
        require(not self.up_log.exists() and not self.da_log.exists(), 'EVIDENCE_ALREADY_EXISTS')
        fresh = replace_directive(FRESH.read_text(), 'DatabaseDirectory', str(self.db))
        fresh = replace_directive(fresh, 'UpdateLogFile', str(self.up_log))
        daemon = replace_directive(DAEMON.read_text(), 'DatabaseDirectory', str(self.db))
        daemon = replace_directive(daemon, 'LogFile', str(self.da_log))
        atomic(FRESH, fresh.encode(), 0o444)
        atomic(DAEMON, daemon.encode(), 0o644)
        self.config.update(databaseDirectory=str(self.db), updaterLog=str(self.up_log),
                           daemonLog=str(self.da_log), updaterConfigSha256=digest(FRESH))
        atomic(CONFIG, json.dumps(self.config).encode())
        atomic(PRODUCER, (PACKAGE / 'producer.cjs').read_bytes(), 0o644)
        sync_directory(self.db.parent)

    def confined(self, unit, executable):
        def observe():
            require(active(unit) in ('active', 'activating'), 'SCANNER_START_FAILED')
            pid = main_pid(unit)
            if pid == 0:
                return None
            process = P('/proc') / str(pid)
            try:
                fields = dict(line.split(':', 1) for line in (process / 'status').read_text().splitlines() if ':' in line)
                before = os.readlink(process / 'exe')
                result = {'pid': pid, 'exe': before,
                          'uids': list(map(int, fields['Uid'].split())),
                          'profile': (process / 'attr/current').read_text().strip(),
                          'cgroup': (process / 'cgroup').read_text().strip()}
                if os.readlink(process / 'exe') != before or main_pid(unit) != pid:
                    return None
                # Re-read identity after executable capture to avoid mixing pre/post exec.
                after = dict(line.split(':', 1) for line in (process / 'status').read_text().splitlines() if ':' in line)
                if fields['Uid'] != after['Uid']:
                    return None
                return result
            except FileNotFoundError:
                return None
        return await_confined(observe, unit, executable)

    def updater(self):
        system('start', UPDATER)
        pid = self.confined(UPDATER, '/usr/bin/freshclam')
        write_state(self.archive / 'updater.json', {'pid': pid})
        deadline = time.monotonic() + 300
        while time.monotonic() < deadline:
            require(active(UPDATER) == 'active' and main_pid(UPDATER) == pid, 'UPDATER_RESTARTED')
            if self.up_log.exists():
                text = self.up_log.read_text()
                require(not re.search(r'WARNING|ERROR|failed|cool.down', text, re.I), 'UPDATER_REJECTED')
                # Completion trigger only: the existing producer performs all strict parsing.
                if re.search(r'bytecode\.cvd updated \(', text):
                    require(all((self.db / (n + '.cvd')).is_file() for n in ('main', 'daily', 'bytecode')),
                            'FRESH_CVD_SET_REQUIRED')
                    return
            time.sleep(1)
        raise Stop('UPDATER_TIMEOUT')

    def daemon(self):
        require(main_pid(UPDATER) == read_state(self.archive / 'updater.json')['pid'], 'UPDATER_RESTARTED')
        system('start', SOCKET, CLAMD)
        require(active(CLAMD) == 'active', 'DAEMON_NOT_RUNNING')
        pid = self.confined(CLAMD, '/usr/sbin/clamd')
        def ready():
            require(active(CLAMD) == 'active' and main_pid(CLAMD) == pid, 'DAEMON_START_FAILED')
            require(main_pid(UPDATER) == read_state(self.archive / 'updater.json')['pid'], 'UPDATER_RESTARTED')
            if not self.da_log.exists():
                return False
            private(self.da_log, (0, 108))
            require(self.da_log.stat().st_size <= 1048576, 'DAEMON_LOG_REJECTED')
            log = self.da_log.read_text()
            require(not re.search(r'ERROR|WARNING|failed|failure', log, re.I), 'DAEMON_LOG_REJECTED')
            if not re.search(r' -> Loaded [0-9]+ signatures\.\n', log):
                return False
            return version_ready(self.config['socketPath'])
        await_ready(ready)
        write_state(self.archive / 'daemon-ready.json', {'pid': pid, 'loaded_log': True, 'version_response': True})
        self.guard()

    def reader(self):
        result = run(['/usr/bin/node', str(PACKAGE / 'reader.cjs')], success=False, uid=1001, timeout=10)
        try:
            value = json.loads(result.stdout)
        except (ValueError, UnicodeError):
            return None
        return value if result.returncode == 0 and value.get('accepted') is True else None

    def accepted(self):
        self.guard()
        config = json.loads(CONFIG.read_text())
        return (config['databaseDirectory'] == str(self.db) and
                main_pid(UPDATER) == read_state(self.archive / 'updater.json')['pid'] and
                self.reader() is not None)

    def scheduled(self):
        # Never start the oneshot directly. Require three consecutive timer runs.
        system('reset-failed', SERVICE)
        system('enable', '--now', TIMER)
        observations = []
        deadline = time.monotonic() + 100
        while time.monotonic() < deadline:
            require(main_pid(UPDATER) == read_state(self.archive / 'updater.json')['pid'], 'UPDATER_RESTARTED')
            if active(SERVICE) == 'failed':
                raise Stop('PRODUCER_REJECTED')
            value = self.reader()
            if value and (not observations or value['sequence'] != observations[-1]['sequence']):
                if observations:
                    require(value['sequence'] == observations[-1]['sequence'] + 1
                            and value['observedAt'] > observations[-1]['observedAt'], 'PUBLICATION_DISCONTINUITY')
                observations.append(value)
                write_state(self.archive / 'scheduled.json', observations)
                if len(observations) == 3:
                    private(HEALTH)
                    atomic(self.archive / 'accepted-snapshot.json', HEALTH.read_bytes())
                    return
            time.sleep(1)
        raise Stop('SCHEDULED_PUBLICATION_TIMEOUT')

    def restore(self):
        # Restore exact configuration/artifact bytes, not a stale HEALTHY snapshot.
        if self.backups.exists():
            entries = read_state(self.backups)
            for entry in entries:
                require(digest(self.archive / entry['backup']) == entry['sha256'], 'BACKUP_CHANGED')
            for entry in entries:
                if entry['path'] in map(str, (CONFIG, FRESH, DAEMON, PRODUCER)):
                    atomic(P(entry['path']), (self.archive / entry['backup']).read_bytes(),
                           entry['mode'], entry['uid'], entry['gid'])
        system('start', UPDATER, SOCKET, CLAMD)
        # Producer remains disabled; old interrupted history cannot regain trust.


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('command', choices=('recover', 'rollback'))
    parser.add_argument('--id', required=True)
    args = parser.parse_args()
    require(re.fullmatch(r'[a-z0-9][a-z0-9-]{0,47}', args.id), 'ATTEMPT_ID_INVALID')
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'HOST_IDENTITY_REQUIRED')
    os.umask(0o077)
    for path in (ROOT, ROOT / 'records'):
        private(path, directory=True)
    RECORDS.mkdir(mode=0o700, exist_ok=True)
    private(RECORDS, directory=True)
    with exclusive(RECORDS / 'operator.lock'):
        # Do not bypass a failed attempt with a different identifier.
        for path in RECORDS.glob('*/state.json'):
            if path.parent.name != args.id:
                require(read_state(path)['phase'] in ('COMPLETE', 'ROLLED_BACK'), 'UNRESOLVED_PREVIOUS_ATTEMPT')
        host = LinuxHost(args.id)
        host.archive.mkdir(mode=0o700, exist_ok=True)
        private(host.archive, directory=True)
        if args.command == 'recover' and not (host.archive / 'state.json').exists():
            host.guard()
        state = read_state(host.archive / 'state.json')
        if args.command == 'rollback' and state and state['phase'] == 'COMPLETE':
            require(host.config['databaseDirectory'] == str(host.db), 'ATTEMPT_NOT_CURRENT')
        result = execute(host.archive / 'state.json', host, args.command == 'rollback')
        output = {'recovery': result, 'attempt': args.id, 'archive': str(host.archive),
                  'reboot_acceptance': 'NOT_PROVEN', 'dashboard_redeployed': False}
        if result in ('RECOVERED', 'ALREADY_RECOVERED'):
            output.update(staging_reader='ACCEPTED', scheduled_publications=read_state(host.archive / 'scheduled.json'),
                          producer_sha256=digest(PRODUCER), pdf_smoke='NOT_YET_RUN')
        print(json.dumps(output, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        print(json.dumps({'recovery': 'STOP', 'reason': str(error) if isinstance(error, Stop) else type(error).__name__,
                          'instruction': 'Inspect retained journal; use explicit rollback. No automatic retry.'}))
        raise SystemExit(1)
