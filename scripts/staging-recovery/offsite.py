"""One approved captured set to isolated B2 prefix, then real private byte restore."""
import datetime
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import shutil
import stat
import subprocess
import sys
import xml.etree.ElementTree as ET

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET_ID = '20261001T212354Z'
CAPTURE_PIN = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
HOST = 'passvero-staging-recovery'
GIB = 1024 ** 3
PHASE = 'VERIFY_CAPTURED_SET'
REMOTE_WRITES = False
CONTROL = None


class Stop(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Stop(reason)


def capture_helper():
    path = ROOT / 'operator' / ('capture-' + CAPTURE_PIN + '.py')
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077,
            'CAPTURE_HELPER_POSTURE')
    require(hashlib.sha256(path.read_bytes()).hexdigest() == CAPTURE_PIN, 'CAPTURE_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location('accepted_capture_offsite', path)
    cap = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(cap)
    return cap


def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def verify_set(work, cap):
    cap.private(work, True)
    manifest = cap.read(work / 'recovery-set.json')
    require(manifest['schema'] == 1 and manifest['setId'] == SET_ID, 'RECOVERY_SET_IDENTITY')
    entries = manifest['files']
    require(isinstance(entries, dict) and 1 <= len(entries) <= 10000, 'SET_FILE_COUNT')
    found = {}
    for path in work.rglob('*'):
        info = path.lstat()
        require(stat.S_ISREG(info.st_mode) or stat.S_ISDIR(info.st_mode), 'SET_SPECIAL_FILE')
        cap.private(path, stat.S_ISDIR(info.st_mode))
        if stat.S_ISREG(info.st_mode):
            found[str(path.relative_to(work))] = path
    require(set(found) == set(entries) | {'recovery-set.json'}, 'SET_FILE_INVENTORY')
    for name, expected in entries.items():
        parts = pathlib.PurePosixPath(name)
        require(not parts.is_absolute() and str(parts) == name
                and all(part not in ('.', '..') for part in parts.parts)
                and '\\' not in name and '\0' not in name, 'SET_FILE_PATH')
        require(type(expected['bytes']) is int and expected['bytes'] >= 0
                and re.fullmatch('[a-f0-9]{64}', expected['sha256']), 'SET_FILE_METADATA')
        require(found[name].stat().st_size == expected['bytes']
                and digest(found[name]) == expected['sha256'], 'SET_FILE_CHECKSUM')
    payload = sum(path.stat().st_size for path in found.values())
    require(payload <= GIB and manifest['payloadBytes'] == sum(x['bytes'] for x in entries.values()),
            'SET_PAYLOAD_LIMIT')
    return manifest, payload, digest(work / 'recovery-set.json')


class Repository:
    def __init__(self, prepare):
        locator = prepare.protected('/etc/passvero/backup/restic-repository').decode().strip()
        prepare.protected('/etc/passvero/backup/restic-password')
        self.keys = prepare.credentials(prepare.protected('/etc/passvero/backup/restic.env').decode())
        self.host, self.region, self.bucket, self.repo = prepare.destination(locator)
        self.prepare = prepare

    def empty_prefix(self):
        request = self.prepare.s3_list_request(self.host, self.region, self.bucket,
                                              self.keys, datetime.datetime.now(datetime.timezone.utc))
        with self.prepare.response(request) as response:
            body = response.read(4 * 1024 ** 2 + 1)
        require(len(body) <= 4 * 1024 ** 2, 'B2_LIST_SIZE')
        listing = ET.fromstring(body)
        require(listing.tag.endswith('ListBucketResult')
                and listing.findtext('{*}Prefix') == self.prepare.PREFIX + '/', 'B2_PREFIX_IDENTITY')
        truncated = listing.findtext('{*}IsTruncated')
        require(truncated in ('true', 'false'), 'B2_LIST_SHAPE')
        return truncated == 'false' and not listing.findall('{*}Contents')

    def run(self, args, writing=False):
        global REMOTE_WRITES
        require(args and args[0] in ('init', 'cat', 'snapshots', 'backup', 'dump', 'ls', 'restore'),
                'RESTIC_OPERATION_SCOPE')
        require(writing == (args[0] in ('init', 'backup')), 'RESTIC_WRITE_SCOPE')
        if writing:
            REMOTE_WRITES = True
        result = subprocess.run(['/usr/local/bin/restic', '--no-cache',
            *([] if writing else ['--no-lock']), '--repo', self.repo, '--password-file',
            '/etc/passvero/backup/restic-password', *args], capture_output=True,
            timeout=900 if args[0] in ('backup', 'restore') else 60,
            env={'PATH': '/usr/bin:/bin', 'LANG': 'C', **self.keys})
        if result.returncode != 0:
            denied = any(x in result.stderr.lower() for x in
                         (b'accessdenied', b'access denied', b'invalidaccesskeyid', b'signaturedoesnotmatch'))
            raise Stop('RESTIC_' + args[0].upper() + '_EXIT_' + str(result.returncode)
                       + ('_ACCESS_OR_SIGNATURE_DENIED' if denied else ''))
        require(len(result.stdout) <= 32 * 1024 ** 2, 'RESTIC_RESPONSE_SIZE')
        return result.stdout

    def snapshots(self):
        rows = json.loads(self.run(['snapshots', '--json']))
        rows = [] if rows is None else rows
        require(isinstance(rows, list), 'SNAPSHOT_LIST_SHAPE')
        for row in rows:
            require(re.fullmatch('[a-f0-9]{64}', row.get('id', '')) and row.get('hostname') == HOST
                    and HOST in row.get('tags', []) and row.get('paths')
                    and all(isinstance(path, str) and re.fullmatch(
                        re.escape(str(ROOT / 'sets')) + r'/[0-9]{8}T[0-9]{6}Z', path)
                        for path in row['paths']), 'STAGING_REPOSITORY_IDENTITY')
        return rows


def validate_tree(body, snapshot_id, work, manifest):
    expected = {str(work / name): item['bytes'] for name, item in manifest['files'].items()}
    expected[str(work / 'recovery-set.json')] = (work / 'recovery-set.json').stat().st_size
    directories = {str(parent) for name in expected for parent in pathlib.PurePosixPath(name).parents}
    found = {}
    header = 0
    for line in body.splitlines():
        row = json.loads(line)
        kind = row.get('message_type', row.get('struct_type'))
        if kind == 'snapshot':
            require(row.get('id') == snapshot_id, 'SNAPSHOT_TREE_IDENTITY')
            header += 1
        else:
            require(kind == 'node', 'SNAPSHOT_TREE_SHAPE')
            if row.get('type') == 'file':
                name = row.get('path')
                require(name in expected and name not in found and row.get('size') == expected[name],
                        'SNAPSHOT_TREE_FILES')
                found[name] = row['size']
            else:
                require(row.get('type') == 'dir' and row.get('path') in directories,
                        'SNAPSHOT_TREE_SPECIAL_OR_OUTSIDE_SCOPE')
    require(header == 1 and found == expected, 'SNAPSHOT_TREE_INCOMPLETE')


def main(cap=None, repository=None):
    global PHASE, CONTROL
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    cap = cap or capture_helper()
    work, control = cap.validate_context(SET_ID)
    CONTROL = control
    prepare, references = cap.helpers()
    saved = cap.read(control / 'summary.json')
    closure = cap.read(control / 'closure.json')
    require(saved['capture'] == 'PASS' and saved['setId'] == SET_ID
            and closure['stagingResumed'] is True and closure['serviceResult'] == 'success'
            and 0 < closure['pauseSeconds'] <= 120, 'CAPTURE_CLOSURE_NOT_ACCEPTED')
    claim = cap.read(ROOT / cap.ADDITIONAL_CLAIM)
    require(claim['setId'] == SET_ID and claim['priorSetId'] == cap.FAILED_SET
            and claim['priorClaimSha256'] == digest(ROOT / cap.FIRST_CLAIM), 'RETAINED_CLAIM_CHANGED')
    attempt = control / 'offsite-attempt.json'
    require(not attempt.exists() and not attempt.is_symlink(), 'OFFSITE_ALREADY_ATTEMPTED')
    restore_root = ROOT / 'restore'
    if restore_root.exists() or restore_root.is_symlink():
        cap.private(restore_root, True)
    target = restore_root / SET_ID
    require(not target.exists() and not target.is_symlink(), 'RESTORE_TARGET_ALREADY_EXISTS')
    manifest, payload, manifest_sha = verify_set(work, cap)
    require(payload == saved['payloadBytes'] == 964172, 'ACCEPTED_CAPTURE_PAYLOAD_CHANGED')
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FREE_SPACE_LIMIT')
    prepare.runtime()
    cap.gates(prepare)
    require(digest(pathlib.Path('/usr/local/sbin/passvero-postgres-backup')) == prepare.PIN,
            'PRODUCTION_BACKUP_SOURCE_CHANGED')
    binary = pathlib.Path('/usr/local/bin/restic')
    info = binary.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022
            and os.access(binary, os.X_OK), 'EXISTING_RESTIC_POSTURE')
    help_result = subprocess.run([str(binary), 'restore', '--help'], capture_output=True, timeout=10,
                                 env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
    require(help_result.returncode == 0 and b'--verify' in help_result.stdout,
            'EXISTING_RESTIC_RESTORE_VERIFY_UNAVAILABLE')
    repository = repository or Repository(prepare)
    PHASE = 'VERIFY_EXACT_STAGING_B2_PREFIX'
    empty = repository.empty_prefix()
    if not empty:
        config = json.loads(repository.run(['cat', 'config']))
        before = repository.snapshots()
        require(before, 'NONEMPTY_PREFIX_WITHOUT_IDENTIFIED_SNAPSHOTS')
        prepared = cap.read(ROOT / 'preparation' / cap.SEED / 'prepared.json')['repository']
        if prepared.get('exists'):
            require(config.get('id') == prepared['id'], 'PREPARED_REPOSITORY_CHANGED')
    else:
        before = []
        config = None
    if config is not None:
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')),
                'REPOSITORY_FORMAT')
    require(not any(str(work) in row['paths'] for row in before), 'SET_ALREADY_IN_B2_MANUAL_REVIEW')
    cap.write(attempt, {'setId': SET_ID, 'manifestSha256': manifest_sha, 'automaticRetry': False})
    if empty:
        PHASE = 'INIT_APPROVED_STAGING_REPOSITORY_ONLY'
        repository.run(['init'], writing=True)
        config = json.loads(repository.run(['cat', 'config']))
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')),
                'INITIALIZED_REPOSITORY_FORMAT')
    cap.write(control / 'offsite-repository.json', {'prefix': prepare.PREFIX + '/',
              'repositoryId': config['id'], 'manifestSha256': manifest_sha, 'setId': SET_ID})
    PHASE = 'BACKUP_EXACT_CAPTURED_SET'
    print(json.dumps({'offsite': 'UPLOADING_CAPTURED_SET', 'setId': SET_ID,
                      'stagingPauseRequested': False, 'payloadBytes': payload}), flush=True)
    repository.run(['backup', '--json', '--force', '--host', HOST, '--tag', HOST,
                    '--tag', 'set:' + SET_ID, str(work)], writing=True)
    after = repository.snapshots()
    require({row['id'] for row in before} <= {row['id'] for row in after}, 'EXISTING_SNAPSHOTS_CHANGED')
    added = [row for row in after if row['id'] not in {old['id'] for old in before}]
    require(len(added) == 1 and added[0]['paths'] == [str(work)]
            and 'set:' + SET_ID in added[0].get('tags', []), 'NEW_SNAPSHOT_IDENTITY')
    snapshot_id = added[0]['id']
    cap.write(control / 'offsite-snapshot.json', {'setId': SET_ID, 'snapshotId': snapshot_id,
              'repositoryId': config['id'], 'manifestSha256': manifest_sha})
    require(verify_set(work, cap) == (manifest, payload, manifest_sha), 'CAPTURE_CHANGED_DURING_UPLOAD')
    require(hashlib.sha256(repository.run(['dump', snapshot_id,
            str(work / 'recovery-set.json')])).hexdigest() == manifest_sha, 'B2_MANIFEST_CHECKSUM')
    validate_tree(repository.run(['ls', '--json', snapshot_id]), snapshot_id, work, manifest)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'PRE_DOWNLOAD_FREE_SPACE_LIMIT')
    if not restore_root.exists():
        restore_root.mkdir(mode=0o700)
    target.mkdir(mode=0o700, exist_ok=False)
    download = target / 'download'
    download.mkdir(mode=0o700)
    PHASE = 'RESTORE_EXACT_B2_SNAPSHOT_TO_NEW_PRIVATE_FILESYSTEM'
    repository.run(['restore', snapshot_id, '--target', str(download), '--verify'])
    restored = download / work.relative_to('/')
    require(verify_set(restored, cap) == (manifest, payload, manifest_sha), 'DOWNLOADED_SET_MISMATCH')
    storage = cap.read(restored / 'storage' / 'manifest.json')
    reconciliation = references.reconcile(storage['objects'], storage['references'])
    require(reconciliation == storage['reconciliation'], 'RESTORED_ASSET_RECONCILIATION')
    for item in storage['objects']:
        path = restored / 'storage' / 'objects' / item['bucket'] / item['file']
        require(path.stat().st_size == item['size'] and digest(path) == item['sha256'],
                'RESTORED_ASSET_CHECKSUM')
    prepare.runtime()
    cap.gates(prepare)
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FINAL_FREE_SPACE_LIMIT')
    result = {'offsite': 'PASS_REAL_B2_SNAPSHOT_DOWNLOADED_AND_BYTES_VERIFIED', 'setId': SET_ID,
        'snapshotId': snapshot_id, 'repositoryId': config['id'], 'b2Prefix': prepare.PREFIX + '/',
        'payloadBytes': payload, 'manifestSha256': manifest_sha, 'allSetFilesChecksummed': True,
        'storageObjects': len(storage['objects']), 'storageBytes': sum(x['size'] for x in storage['objects']),
        'databaseAssetReferences': len(storage['references']),
        'acceptedCleanupTombstones': len(reconciliation['acceptedCleanupTombstones']),
        'staging': 'ONLINE_UNPAUSED', 'reminderTimer': 'DISABLED_INACTIVE', 'campaignsEnabled': 0,
        'databaseRestore': 'NOT_YET_RUN', 'isolatedApplicationRead': 'NOT_YET_RUN',
        'restoreCluster': 'NOT_CREATED', 'storageProviderRestore': 'NOT_PERFORMED',
        'smtpCalls': 0, 'telegramCalls': 0, 'automaticRetry': False, 'artifactsRetained': True}
    cap.write(control / 'offsite-summary.json', result)
    cap.write(target / 'download-proof.json', result)
    print(json.dumps(result))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        message = str(error)
        reason = message if re.fullmatch(r'[A-Z0-9_]{1,160}', message) else type(error).__name__
        result = {'offsite': 'STOP', 'phase': PHASE, 'reason': reason,
                  'remoteWritesMayHaveOccurred': REMOTE_WRITES, 'stagingPauseRequested': False,
                  'restoreCluster': 'NOT_CREATED', 'artifactsRetained': True,
                  'retry': 'MANUAL_REVIEW_REQUIRED', 'smtpCalls': 0, 'telegramCalls': 0}
        if CONTROL is not None:
            try:
                stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
                with open(CONTROL / ('offsite-stop-' + stamp + '.json'), 'x') as handle:
                    json.dump(result, handle)
                    handle.write('\n')
            except Exception:
                pass
        print(json.dumps(result))
        sys.exit(1)
