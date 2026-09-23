#!/usr/bin/env python3
"""Read-only guard for the recorded second attempt. No services or files changed."""
import datetime
import hashlib
import json
import os
import pathlib
import re
import subprocess
from zoneinfo import ZoneInfo

P = pathlib.Path


def require(value, code):
    if not value:
        raise RuntimeError(code)


def command(args):
    return subprocess.run(args, capture_output=True, text=True, check=True, timeout=20).stdout


def main():
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'HOST_REQUIRED')
    archive = P('/var/lib/passvero-signature-trust/records/recovery/recovery-20260923-02')
    require(json.loads((archive / 'state.json').read_text())['phase'] == 'scheduled', 'PHASE_CHANGED')
    require(not P('/var/lib/passvero-signature-health/health.json').exists(), 'SNAPSHOT_PRESENT')
    require(not P('/var/lib/passvero-signature-health/health.json.lock').exists(), 'PRODUCER_LOCK_PRESENT')
    for unit in ('clamav-freshclam.service', 'clamav-daemon.service', 'clamav-daemon.socket', 'passvero-signature-health.timer'):
        state = command(['systemctl', 'show', unit, '--property=ActiveState', '--value']).strip()
        require(state in ('inactive', 'failed'), 'SERVICE_STATE_CHANGED')
    daemon_result = command(['systemctl', 'show', 'clamav-daemon.service', '--property=Result', '--value']).strip()
    require(daemon_result == 'success', 'DAEMON_FAILED_INDEPENDENTLY')
    entries = json.loads((archive / 'backup.json').read_text())
    for entry in entries:
        h = hashlib.sha256()
        with (archive / entry['backup']).open('rb') as stream:
            for block in iter(lambda: stream.read(1048576), b''):
                h.update(block)
        require(h.hexdigest() == entry['sha256'], 'BACKUP_CHANGED')
    rows = command(['journalctl', '_SYSTEMD_INVOCATION_ID=32cf4dffdfc94ba780891c98383e358b',
                    '-n', '30', '-o', 'json', '--no-pager'])
    failures = []
    for line in rows.splitlines():
        record = json.loads(line)
        try:
            message = json.loads(record.get('MESSAGE', ''))
        except (ValueError, TypeError):
            continue
        if isinstance(message, dict) and message.get('reason') == 'DAEMON_UNAVAILABLE' and message.get('phase') == 'VERSION':
            failures.append(int(record['__REALTIME_TIMESTAMP']) / 1000000)
    require(len(failures) == 1, 'FAILURE_RECORD_REQUIRED')
    path = P('/var/lib/passvero-signature-trust/daemon/recovery-recovery-20260923-02.log')
    require(path.stat().st_size <= 1048576, 'LOG_BOUND')
    text = path.read_text()
    require(not re.search(r'ERROR|WARNING|failed|failure', text, re.I), 'DAEMON_LOG_REQUIRES_REVIEW')
    require('Reading databases from ' in text, 'LOAD_START_REQUIRED')
    loaded = []
    for line in text.splitlines():
        if re.search(r' -> Loaded [0-9]+ signatures\.$', line):
            loaded.append(datetime.datetime.strptime(line[:24], '%a %b %d %H:%M:%S %Y').replace(tzinfo=ZoneInfo('Europe/Zagreb')).timestamp())
    require(not any(at <= failures[0] for at in loaded), 'LOAD_ALREADY_COMPLETED_REQUIRES_REVIEW')
    print(json.dumps({'verification': 'PASS', 'failure': 'VERSION_BEFORE_DATABASE_LOAD_COMPLETE',
                      'backup_hashes_match': True, 'snapshot_present': False,
                      'mutation_performed': False}))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'verification': 'STOP', 'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__,
                          'mutation_performed': False}))
        raise SystemExit(1)
