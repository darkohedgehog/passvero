"""One explicitly approved continuation of the existing 20261012 private restore.

No download, initdb, pg_restore, capture, counter reset or release pin changes.
Original helpers/config remain pinned and unchanged. Overrides are process-local.
"""
import hashlib
import importlib.util
import json
import os
import pathlib
import re
import socket
import stat
import subprocess
import sys

SET_ID = '20261012T043000Z'
SNAPSHOT = 'b28b2c9ebdb22eb01ffa6b8fabd2704637cc29b55916c08a6828db7019627368'
MANIFEST = '2c74bc8b0d55710472a9f554eaf73ac00e3f951c9f479c659d38f29b2e3516f1'
ACCEPTANCE_PIN = 'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7'
ADAPTER_PIN = '14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418'
CONFIG_PIN = '399a693588167747cd565fdf179ecfc2dc5a6c6d756a7498bdf73f93fe959d62'
EXACT_PAIRS = {
    ('AccessRequestAdminNotification', 'AccessRequestAdminNotification_state'): (
        'c9e085a6e449958b82e992f0ca3fee7e7d2b3c5dd93ce613dcf17d92d428c68d',
        'd980c409e72377b44907f2ea6454d1904fa5e9d7cf258d8c66f3838d0645feb4'),
    ('OrganizationReminderEnrollment', 'OrganizationReminderEnrollment_origin_check'): (
        '6f1db9d5d6358287f27c84d4fdc3546277d6d7901e140439c56bcd170303f230',
        '871d9e64c1fa9a5a10aff25433c9f761e44206f9c52d7c16a98f85556d0399c2'),
    ('ReminderCampaign', 'reminder_campaign_budget'): (
        'a1a55c449dde67006d8292963958807f34a84c21e2163bf1e0f61285ae18a453',
        'b4fa3f629815b8f7cb273dca1281a4e88efb793bd93b63f4486151287b5d9fb5'),
}
CHECK_ID = 'LOAD_PINNED_HELPERS'
ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
CODE = pathlib.Path('/usr/local/libexec/passvero-staging-backup')


def reviewed_pairs(historical):
    result = dict(historical)
    result.update(EXACT_PAIRS)
    return result


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def private(path, uid=0, directory=False):
    info = path.lstat()
    require((stat.S_ISDIR(info.st_mode) if directory else stat.S_ISREG(info.st_mode))
            and info.st_uid == uid and not info.st_mode & 0o077, 'PRIVATE_PATH_IDENTITY')
    return info


def pinned(path, digest):
    private(path)
    require(hashlib.sha256(path.read_bytes()).hexdigest() == digest, 'HELPER_PIN_CHANGED')


def load():
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'VPS_IDENTITY')
    pinned(CODE / 'recurring.py', ADAPTER_PIN)
    pinned(CODE / 'config.json', CONFIG_PIN)
    path = CODE / 'recurring_acceptance.py'
    pinned(path, ACCEPTANCE_PIN)
    spec = importlib.util.spec_from_file_location('accepted_recurring_acceptance', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def no_private_process(restore):
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry / 'cmdline').read_bytes().split(b'\0')
                require(str(restore.DATA).encode() not in args, 'PRIVATE_CLUSTER_ALREADY_RUNNING')
            except (FileNotFoundError, ProcessLookupError):
                pass


def identity(restore):
    return restore.sql("SELECT json_build_object('data',current_setting('data_directory'),"
                       "'tcp',current_setting('listen_addresses'),'port',current_setting('port'))",
                       database='postgres')


def unit_guard(a, helper):
    name = 'passvero-stage-recurring-resume-' + SET_ID + '.service'
    reply = a.r.command(['/usr/bin/busctl', 'call', 'org.freedesktop.systemd1',
        '/org/freedesktop/systemd1', 'org.freedesktop.systemd1.Manager', 'GetUnit', 's', name]).decode().strip()
    require(re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"', reply), 'PRIVATE_UNIT_IDENTITY')
    values = dict(line.split('=', 1) for line in a.r.command(['/usr/bin/systemctl', 'show', name,
        '--property=Type,KillMode,KillSignal,Restart,ExecStopPost']).decode().splitlines() if '=' in line)
    cap = helper['capture']
    require(values['Type'] == 'exec' and values['Restart'] == 'no'
            and values['KillMode'] == 'control-group' and values['KillSignal'] == '9'
            and cap.duration_property(reply[3:-1], 'RuntimeMaxUSec') == 900000000
            and cap.duration_property(reply[3:-1], 'TimeoutStopUSec') == 35000000
            and 'argv[]=/usr/bin/python3 -I -B ' + str(pathlib.Path(__file__).resolve()) + ' --close'
                in values['ExecStopPost'], 'INDEPENDENT_RESUME_CLOSURE_REQUIRED')


def resume(a, config, helpers):
    global CHECK_ID
    r = a.r
    CHECK_ID = 'EXISTING_SET_AND_ATTEMPT'
    row = a.selected(config, helpers)
    require(row['setId'] == SET_ID and row['snapshotId'] == SNAPSHOT
            and row['manifestSha256'] == MANIFEST and row['payloadBytes'] == 1417314, 'EXISTING_SET_CHANGED')
    restore = a.restore_context(row, helpers)
    target = restore.TARGET
    private(target, directory=True)
    require(r.read(r.STATE / 'restore-attempt.json') == {'setId': SET_ID, 'automaticRetry': False}, 'ORIGINAL_ATTEMPT_CHANGED')
    require(not (r.STATE / 'resume-attempt.json').exists() and not (target / 'summary.json').exists(), 'RESUME_BUDGET_ONE')
    require(r.read(r.STATE / 'acceptance-first-failure.json') == {
        'result': 'STOP', 'phase': 'VERIFY_NEW_SCHEMA_WITH_ACCEPTED_EXACT_EQUIVALENCES',
        'reason': 'UNREVIEWED_CONSTRAINT_DIFFERENCE', 'automaticRetry': False}, 'ORIGINAL_FAILURE_CHANGED')
    closure = r.read(target / 'closure.json')
    require(closure == {'cluster': 'STOPPED', 'parentPermissions': 'PRIVATE_0700',
                       'liveStagingPaused': False, 'artifactsRetained': True}, 'ORIGINAL_CLOSURE_CHANGED')
    unit_guard(a, helpers)
    cap, offsite, prepare = helpers['capture'], helpers['offsite'], helpers['prepare']
    CHECK_ID = 'EXISTING_LOCAL_DOWNLOAD_IDENTITY'
    source = target / 'download' / (r.ROOT / 'sets' / SET_ID).relative_to('/')
    offsite.SET_ID = SET_ID
    _, payload, digest = offsite.verify_set(source, cap)
    require(digest == MANIFEST and payload == row['payloadBytes'], 'LOCAL_DOWNLOADED_SET_CHANGED')
    require(r.read(target / 'download-proof.json') == {'setId': SET_ID, 'snapshotId': SNAPSHOT,
        'allDownloadedBytes': 'MATCH_MANIFEST', 'payloadBytes': payload, 'manifestSha256': digest}, 'DOWNLOAD_PROOF_CHANGED')
    meta = r.read(source / 'database/manifest.json')
    require(r.read(target / 'catalog-source.json') == meta['catalog'], 'SAVED_SOURCE_CATALOG_CHANGED')
    CHECK_ID = 'EXISTING_CLUSTER_FILES_AND_PARENTS'
    postgres = __import__('pwd').getpwnam('postgres')
    for path in (restore.DATA, restore.SOCKET):
        private(path, uid=postgres.pw_uid, directory=True)
    require((restore.DATA / 'PG_VERSION').read_text().strip() == '16', 'PRIVATE_PG_VERSION')
    # Existing server authentication configuration must be exactly the first restore's files.
    expected = {'pg_ident.conf': 'recovery_operator root postgres\nrecovery_operator postgres postgres\n',
                'pg_hba.conf': 'local all postgres peer map=recovery_operator\nlocal all all reject\n'}
    for name, content in expected.items():
        private(restore.DATA / name, uid=postgres.pw_uid)
        require((restore.DATA / name).read_text() == content, 'PRIVATE_AUTH_CONFIGURATION_CHANGED')
    saved = r.read(target / 'parent-acl.json')
    require(saved['postgresUid'] == postgres.pw_uid, 'POSTGRES_UID_CHANGED')
    restore.restore_parents(saved['parents'], postgres.pw_uid)
    no_private_process(restore)
    with socket.socket() as probe:
        require(probe.connect_ex(('127.0.0.1', 55434)) != 0, 'PRIVATE_PORT_IN_USE')
    CHECK_ID = 'RESERVE_ONE_CONTINUATION'
    r.atomic(r.STATE / 'resume-attempt.json', {'setId': SET_ID, 'snapshotId': SNAPSHOT,
                                             'automaticRetry': False, 'originalRestoreReused': True})
    for item in saved['parents']:
        path = pathlib.Path(item['path'])
        os.setxattr(path, restore.ACL_NAME, restore.traversal_acl(postgres.pw_uid), follow_symlinks=False)
        require(restore.get_acl(path) == restore.traversal_acl(postgres.pw_uid), 'PRIVATE_TRAVERSAL_ACL')
    CHECK_ID = 'START_EXISTING_PRIVATE_CLUSTER'
    restore.run([restore.PG + 'pg_ctl', '-D', str(restore.DATA), '-l', str(restore.DATA / 'resume.log'),
        '-w', '-t', '30', 'start', '-o', "-c listen_addresses='' -c port=55434 -c unix_socket_directories=" +
        str(restore.SOCKET) + ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'],
        account=prepare.account('postgres'), timeout=45)
    CHECK_ID = 'RUNNING_CLUSTER_IDENTITY'
    require(identity(restore) == {'data': str(restore.DATA), 'tcp': '', 'port': '55434'}, 'PRIVATE_CLUSTER_IDENTITY')
    require(restore.sql("SELECT to_json(current_setting('default_transaction_read_only'))") == 'on', 'PRIVATE_DB_NOT_READ_ONLY')
    CHECK_ID = 'SAVED_RESTORED_CATALOG_IDENTITY'
    current = restore.sql(cap.CATALOG)
    require(current == r.read(target / 'catalog-restored.json'), 'EXISTING_CLUSTER_CATALOG_CHANGED')
    finish(a, config, helpers, row, restore, source, meta, current)


def finish(a, config, helpers, row, restore, source, meta, current):
    global CHECK_ID
    r = a.r
    cap, offsite = helpers['capture'], helpers['offsite']
    target = restore.TARGET
    database = meta['catalog']['database']
    CHECK_ID = 'EXACT_CATALOG_AND_EFFECTIVE_ACL'
    catalog = helpers['recurring_catalog']
    catalog.REVIEWED_CONSTRAINTS = reviewed_pairs(helpers['verify-database'].REVIEWED_CONSTRAINTS)
    equivalents = catalog.verify_catalog(meta['catalog'], current, restore)
    CHECK_ID = 'DATABASE_SETTINGS_ACL'
    r.require(all(current['database'][key] == database[key] for key in ('owner', 'encoding', 'collate', 'ctype'))
              and restore.database_acl(current['database']['acl']) == restore.database_acl(database['acl']), 'DATABASE_SETTINGS_ACL')
    CHECK_ID = 'NEW_SCHEMA_SCOPE'
    tables = restore.sql(cap.TABLES)
    r.require(len(tables) == config['tables'] and len(current['migrations']) == config['migrations']['count'], 'NEW_SCHEMA_SCOPE')
    CHECK_ID = 'ALL_TABLE_COUNTS'
    r.require({name: restore.sql('SELECT count(*) FROM ' + cap.identifier(name)) for name in tables} == meta['counts'], 'ALL_TABLE_COUNTS')
    CHECK_ID = 'ALL_SEQUENCES'
    r.require(restore.sql(cap.SEQUENCES) == meta['sequences'], 'ALL_SEQUENCES')
    CHECK_ID = 'NEW_ASSET_REFERENCE_CONSISTENCY'
    storage = r.read(source / 'storage/manifest.json'); references = helpers['references']
    assets = restore.sql(references.QUERY)
    order = lambda rows: sorted(rows, key=lambda item: (item['bucket'], item['key']))
    r.require(order(assets['references']) == order(storage['references'])
              and assets['enabledCampaigns'] == storage['enabledCampaigns']
              and references.reconcile(storage['objects'], assets['references']) == storage['reconciliation'], 'NEW_ASSET_REFERENCE_CONSISTENCY')
    r.atomic(target / 'catalog-equivalences.json', equivalents)
    CHECK_ID = 'REUSE_ACCEPTED_APPLICATION_READER'
    build_path = r.ROOT / 'operator/application-read-build.json'
    cap.private(build_path)
    r.require(offsite.digest(build_path) == config['readerBuildSha256'], 'READER_BUILD_PIN')
    build = r.read(build_path)
    r.require(build['applicationModules'] == config['readerModules'], 'READER_MODULE_PROVENANCE')
    bundle = r.ROOT / 'operator' / ('application-read-' + build['bundleSha256'] + '.cjs')
    cap.private(bundle); r.require(offsite.digest(bundle) == build['bundleSha256'], 'READER_BUNDLE_PIN')
    reader_config = target / 'application-read.json'
    r.atomic(reader_config, {'source': str(source), 'socket': str(restore.SOCKET),
                            'database': restore.DB, 'objects': storage['objects']})
    result = subprocess.run(['/usr/bin/node', str(bundle), str(reader_config)], capture_output=True,
            timeout=90, env={'PATH': '/usr/bin:/bin', 'LANG': 'C', 'NODE_PATH': str(r.APP / 'node_modules')})
    r.require(result.returncode == 0 and len(result.stdout) < 65536, 'NEW_SET_APPLICATION_READ')
    application = json.loads(result.stdout)
    r.require(application['applicationRead'] == 'PASS_PRIVATE_RECOVERY_PORTS'
              and application['product'] == 'PASS_APPLICATION_CATALOG_EXPORT'
              and application['pdf'] == 'PASS_APPLICATION_BOUNDED_BYTES_AND_METADATA'
              and application['image'] == 'PASS_APPLICATION_DOWNLOAD_AND_RECHECK'
              and application['schemaWrites'] == application['businessWrites'] == 'NONE'
              and application['smtpCalls'] == 0, 'APPLICATION_READ_RESULT')
    CHECK_ID = 'READER_CHANGED_CATALOG'
    r.require(restore.sql(cap.CATALOG) == current, 'READER_CHANGED_CATALOG')
    r.atomic(target / 'summary.json', {'restore': 'PASS_LATEST_NEW_B2_DB_AND_FILES', **row,
             'tables': len(tables), 'migrations': len(current['migrations']), 'application': application,
             'schemaAndBusinessWrites': 'PRIVATE_RESTORE_ONLY', 'smtpCalls': 0, 'liveStagingPaused': False,
             'storageProviderRestore': 'NOT_PERFORMED', 'fullWebAuthScannerRecovery': 'NOT_TESTED',
             'continuation': 'ONE_EXISTING_CLUSTER_NO_RESTORE_REPLAY'})


def close(a, config, helpers):
    global CHECK_ID
    CHECK_ID = 'INDEPENDENT_CLUSTER_AND_PARENT_CLOSURE'
    row = a.r.read(a.r.STATE / 'state.json')['completed'][-1]
    require(row['setId'] == SET_ID, 'CLOSURE_SET_CHANGED')
    restore = a.restore_context(row, helpers)
    # ExecStopPost runs only after systemd killed the entire private unit cgroup.
    no_private_process(restore)
    saved = a.r.read(restore.TARGET / 'parent-acl.json')
    restore.restore_parents(saved['parents'], saved['postgresUid'])
    helpers['prepare'].runtime()
    a.r.resume_timer(a.r.ROOT / 'control' / SET_ID)
    a.r.atomic(restore.TARGET / 'resume-closure.json', {
        'cluster': 'STOPPED', 'parentPermissions': 'PRIVATE_0700',
        'stagingRuntime': 'PASS_EXPECTED_STAGING', 'writerTimerBaseline': 'RESTORED',
        'liveStagingPaused': False, 'artifactsRetained': True})


def failure(error):
    reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
    return {'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}


def main():
    a = load()
    mode = sys.argv[1]
    require(mode in ('--resume', '--close'), 'MODE_REQUIRED')
    config, helpers = a.r.scope(closing=mode == '--close')
    if mode == '--close':
        close(a, config, helpers)
        return
    fd = a.r.lock(a.r.STATE / 'job.lock')
    try:
        resume(a, config, helpers)
    finally:
        os.close(fd)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        result = failure(error)
        if os.geteuid() == 0 and (ROOT / 'recurring').is_dir():
            private(ROOT / 'recurring', directory=True)
            # Original failure is retained; body and independent closure failures are separate.
            name = 'resume-close-failure.json' if '--close' in sys.argv else 'resume-first-failure.json'
            path = ROOT / 'recurring' / name
            if not path.exists():
                fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
                with os.fdopen(fd, 'w') as handle:
                    json.dump(result, handle, sort_keys=True)
                    handle.write('\n'); handle.flush(); os.fsync(handle.fileno())
        print(json.dumps(result), flush=True)
        sys.exit(1)
