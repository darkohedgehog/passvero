"""Read-only staging release/pin planning. No capture/restore/worker/transport."""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import stat
import subprocess
import tarfile

P = pathlib.Path
APP = P('/var/www/passvero-acceptance')
CODE = P('/usr/local/libexec/passvero-staging-backup')
ROOT = P('/var/lib/passvero-staging-recovery')
CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
INPUT = P('/tmp/passvero-marketing-pin-alignment-20261012')
OLD_BUILD = 'mMVPOjFPkw5L42RIqziS4'
OLD_CANONICAL = 'f7039de22d508baac9d70cda13eed9a98b550af93f8b0f92fadbea9fa8106c40'
OLD_CONFIG = '399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'
NEW_BUILD = '853RYrj-r5cyoSGuJudap'
ARTIFACT = '8222518bd18a446278df3e375a2fdfe1af92c598cddecc46d072c6b745e13817'
ARCHIVE = '8c3e74a998966976aa92777a37fb1b040b2d02dea1ac49c4a1f148744e062a1e'
CHECK_ID = 'HOST'


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def digest(body):
    return hashlib.sha256(body).hexdigest()


def regular(path):
    require(stat.S_ISREG(path.lstat().st_mode) and not path.is_symlink(), 'REGULAR_FILE_REQUIRED')
    return path.read_bytes()


def command(args):
    result = subprocess.run(args, capture_output=True, timeout=15)
    require(result.returncode == 0, 'READ_COMMAND_FAILED')
    return result.stdout.decode()


def unit(name):
    body = command(['/usr/bin/systemctl', 'show', name,
        '--property=Id,LoadState,ActiveState,SubState,UnitFileState,NextElapseUSecRealtime'])
    return dict(line.split('=', 1) for line in body.splitlines() if '=' in line)


def main():
    global CHECK_ID
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_OPERATOR_HOST')
    CHECK_ID = 'REVIEWED_PACKAGE'
    artifact_bytes = regular(INPUT / 'artifact-manifest.json')
    require(digest(artifact_bytes) == ARTIFACT, 'ARTIFACT_MANIFEST_CHANGED')
    artifact = json.loads(artifact_bytes)
    require(digest(regular(INPUT / 'application.tar.gz')) == ARCHIVE, 'ARCHIVE_CHANGED')
    require(artifact['buildId'] == NEW_BUILD and len(artifact['files']) == 754, 'NEW_RELEASE_CHANGED')
    for name, key in [('package.json', 'packageJsonSha256'), ('package-lock.json', 'lockSha256')]:
        require(digest(regular(APP / name)) == artifact[key], 'RUNTIME_DEPENDENCY_IDENTITY_CHANGED')
    with tarfile.open(INPUT / 'application.tar.gz') as archive:
        members = archive.getmembers()
        require(len(members) == 754 and {item.name for item in members} == set(artifact['files']), 'ARCHIVE_INVENTORY')
        for item in members:
            require(item.isfile() and item.name.startswith(('.next/', 'messages/'))
                    and not P(item.name).is_absolute() and '..' not in P(item.name).parts, 'ARCHIVE_PATH_SCOPE')
            body = archive.extractfile(item).read()
            expected = artifact['files'][item.name]
            require(digest(body) == expected['sha256'] and len(body) == expected['bytes'], 'ARCHIVE_MEMBER_CHANGED')
        for locale in ('hr', 'sr', 'en', 'de', 'sl', 'pl'):
            name = 'messages/' + locale + '.json'
            require(json.loads(archive.extractfile(name).read())['Legal'] == json.loads(regular(APP / name))['Legal'],
                    'DEPLOYED_LEGAL_NAMESPACE_DIFFERS_STOP_REVIEW')
    CHECK_ID = 'CURRENT_RELEASE_AND_BACKUP_PINS'
    old_bytes = regular(CANONICAL)
    require(digest(old_bytes) == OLD_CANONICAL, 'CURRENT_CANONICAL_CHANGED')
    prior = json.loads(old_bytes)
    require(prior['build_id'] == OLD_BUILD == regular(APP / '.next/BUILD_ID').decode().strip(), 'CURRENT_BUILD_CHANGED')
    for name, item in prior['files'].items():
        path = APP / name
        require(not P(name).is_absolute() and '..' not in P(name).parts
                and path.resolve().is_relative_to(APP.resolve()), 'CURRENT_ARTIFACT_PATH_SCOPE')
        require(digest(regular(path)) == item['sha256'], 'CURRENT_EXECUTABLE_ARTIFACT_CHANGED')
    config_bytes = regular(CODE / 'config.json')
    require(digest(config_bytes) == OLD_CONFIG, 'BACKUP_CONFIG_CHANGED')
    config = json.loads(config_bytes)
    require(config['buildId'] == OLD_BUILD and config['canonicalSha256'] == OLD_CANONICAL, 'CURRENT_RELEASE_PIN_MISMATCH')
    pins = {'recurring.py': '14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
            'recurring_acceptance.py': 'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
            'recurring_catalog.py': 'b0b84b1a06035c04949777d664ffe73e9362b063357f72ee7205097c1b2513f7'}
    for name, pin in pins.items():
        require(digest(regular(CODE / name)) == pin, 'BACKUP_HELPER_CHANGED')
    CHECK_ID = 'AUTOMATION_AND_RECOVERY_IDLE'
    state_bytes = regular(ROOT / 'recurring/state.json')
    state = json.loads(state_bytes)
    require(state['mode'] == 'CONTINUOUS' and state['hold'] is False and state['attempt']['complete'], 'BACKUP_NOT_CONTINUOUS_READY')
    units = {name: unit(name) for name in ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer',
             'passvero-staging-backup.service', 'passvero-subscription-reminders.timer', 'passvero-subscription-reminders.service')}
    for name in ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer'):
        require(units[name]['ActiveState'] == 'active' and units[name]['UnitFileState'] == 'enabled', 'BACKUP_TIMER_BASELINE_CHANGED')
    require(units['passvero-staging-backup.service']['ActiveState'] in ('inactive', 'failed'), 'BACKUP_ACTIVE_STOP')
    active = command(['/usr/bin/systemctl', 'list-units', '--all', '--plain', '--no-legend',
                      'passvero-stage*restore*.service', 'passvero-stage*capture*.service', 'passvero-stage*resume*.service'])
    require(not any(len(line.split()) >= 4 and line.split()[2] in ('active', 'activating', 'deactivating')
                    for line in active.splitlines()), 'RECOVERY_UNIT_ACTIVE_STOP')
    for entry in P('/proc').iterdir():
        if not entry.name.isdecimal() or int(entry.name) == os.getpid():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().split(b'\0')
        except (FileNotFoundError, ProcessLookupError):
            continue
        require(not any(arg.startswith(str(ROOT / 'restore').encode()) or arg.startswith(str(CODE).encode())
                        or re.search(rb'/(?:capture|restore-database|verify-application)-[^/]+\.py$', arg)
                        for arg in args), 'RECOVERY_PROCESS_ACTIVE_STOP')
    fd = os.open(ROOT / 'recurring/job.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    finally:
        os.close(fd)
    CHECK_ID = 'STAGING_RUNTIME_READ_ONLY'
    helper_pin = config['helpers']['prepare']
    helper = ROOT / 'operator' / ('prepare-' + helper_pin + '.py')
    require(digest(regular(helper)) == helper_pin, 'PREPARE_HELPER_CHANGED')
    spec = importlib.util.spec_from_file_location('accepted_prepare_read_only', helper)
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    process, _ = prepare.runtime()  # PM2/proc identity only; no SQL or transport.
    CHECK_ID = 'EXACT_CANDIDATE_PINS'
    updated = dict(prior)
    updated['build_id'] = NEW_BUILD
    updated['marketing_artifact_manifest_sha256'] = ARTIFACT
    updated['files'] = {name: item for name, item in prior['files'].items() if not name.startswith(('.next/', 'messages/'))}
    updated['files'].update(artifact['files'])
    candidate_bytes = (json.dumps(updated, sort_keys=True, indent=2) + '\n').encode()
    new_config = dict(config)
    new_config['buildId'] = NEW_BUILD
    new_config['canonicalSha256'] = digest(candidate_bytes)
    new_config_bytes = (json.dumps(new_config, sort_keys=True, indent=2) + '\n').encode()
    require({key for key in config if config[key] != new_config[key]} == {'buildId', 'canonicalSha256'}, 'CONFIG_DELTA_SCOPE')
    require(regular(ROOT / 'recurring/state.json') == state_bytes, 'BACKUP_STATE_CHANGED_DURING_READ')
    print(json.dumps({'preflight': 'PASS_READ_ONLY_EXACT_PACKAGE_AND_RELEASE',
        'observedUTC': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'oldBuild': OLD_BUILD, 'newBuild': NEW_BUILD, 'oldCanonicalSha256': OLD_CANONICAL,
        'newCanonicalSha256': digest(candidate_bytes), 'oldConfigSha256': OLD_CONFIG,
        'newConfigSha256': digest(new_config_bytes), 'configKeysChanged': ['buildId', 'canonicalSha256'],
        'retainedCanonicalFiles': len(updated['files']) - 754, 'newArtifacts': 754,
        'currentRuntime': process, 'backupStateSha256': digest(state_bytes),
        'mode': state['mode'], 'hold': state['hold'], 'attempts': state['attempts'], 'units': units,
        'legalNamespaces': 'UNCHANGED_FROM_DEPLOYED', 'mutations': 'NONE',
        'captureRestoreWorkerSmtpTelegramCalls': 0}, sort_keys=True, indent=2))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        print(json.dumps({'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}))
        raise SystemExit(1)
