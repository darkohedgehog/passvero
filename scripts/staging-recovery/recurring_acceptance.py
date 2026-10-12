"""One latest-new-set private restore, scoped retention dry-run and signal proof.

All mutation is confined to the private restore target/control/staging state.
Accepted helper mains are never invoked. No Storage upload or live DB write.
"""
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import subprocess
import sys
import time

HERE = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('recurring_adapter', HERE / 'recurring.py')
r = importlib.util.module_from_spec(spec)
spec.loader.exec_module(r)
PHASE = 'ACCEPTANCE_PREFLIGHT'


def selected(config, helpers):
    state = r.read(r.STATE / 'state.json')
    rows = state.get('completed', [])
    r.require(state['mode'] == 'ACCEPTANCE' and not state['hold'] and state['attempts'] == 2
              and len(rows) == 2 and len({x['setId'] for x in rows}) == 2
              and state['attempt']['complete'], 'TWO_SCHEDULED_SETS_REQUIRED')
    for row in rows:
        _, control = r.contexts(row['setId'])
        r.require(r.read(control / 'offsite-summary.json') == row, 'ACCEPTED_OFFSITE_PROOF_CHANGED')
        timer = r.read(control / 'timer-invocation.json')
        r.require(re.fullmatch('[a-f0-9]{32}', timer['invocationId'])
                  and 0 <= timer['startMonotonic'] - timer['triggerMonotonic'] <= 5000000,
                  'SCHEDULED_PROOF_REQUIRED')
    r.runtime(config, helpers)
    return rows[-1]


def restore_context(row, helpers):
    restore = helpers['restore-database']
    target = r.ROOT / 'restore' / row['setId']
    restore.SET = row['setId']; restore.SNAPSHOT = row['snapshotId']
    restore.TARGET = target; restore.DATA = target / 'pgdata'; restore.SOCKET = target / 'socket'
    restore.CONTROL = r.ROOT / 'control' / row['setId']
    # Historical sql() default is the same private DB; paths are module globals.
    return restore


def close(config, helpers):
    state = r.read(r.STATE / 'state.json')
    row = state['completed'][-1]; restore = restore_context(row, helpers)
    target = restore.TARGET
    # systemd has terminated the entire private unit before this independent post.
    # A stale postmaster.pid after SIGKILL is retained, never used to target another PID.
    for entry in pathlib.Path('/proc').iterdir():
        if entry.name.isdigit():
            try:
                args = (entry / 'cmdline').read_bytes().split(b'\0')
                r.require(not (args and args[0] == (restore.PG + 'postgres').encode()
                          and str(restore.DATA).encode() in args), 'PRIVATE_CLUSTER_STILL_RUNNING')
            except (FileNotFoundError, ProcessLookupError):
                pass
    saved = target / 'parent-acl.json'
    if saved.exists():
        value = r.read(saved); restore.restore_parents(value['parents'], value['postgresUid'])
    helpers['prepare'].runtime()
    r.atomic(target / 'closure.json', {'cluster': 'STOPPED', 'parentPermissions': 'PRIVATE_0700',
                                     'liveStagingPaused': False, 'artifactsRetained': True})


def restore_latest(config, helpers):
    global PHASE
    row = selected(config, helpers); restore = restore_context(row, helpers)
    cap, offsite, prepare = helpers['capture'], helpers['offsite'], helpers['prepare']
    target = restore.TARGET
    r.require(not target.exists() and not (r.STATE / 'restore-attempt.json').exists(), 'RESTORE_BUDGET_ONE')
    unit_name = 'passvero-stage-recurring-restore-' + row['setId'] + '.service'
    object_reply = r.command(['/usr/bin/busctl', 'call', 'org.freedesktop.systemd1',
        '/org/freedesktop/systemd1', 'org.freedesktop.systemd1.Manager', 'GetUnit', 's', unit_name]).decode().strip()
    r.require(re.fullmatch(r'o "/org/freedesktop/systemd1/unit/[A-Za-z0-9_]+"', object_reply), 'PRIVATE_UNIT_IDENTITY')
    object_path = object_reply[3:-1]
    properties = r.command(['/usr/bin/systemctl', 'show', unit_name,
        '--property=Type,KillMode,KillSignal,Restart,ExecStopPost']).decode()
    values = dict(line.split('=', 1) for line in properties.splitlines() if '=' in line)
    r.require(values['Type'] == 'exec' and values['KillMode'] == 'control-group' and values['KillSignal'] == '9'
              and values['Restart'] == 'no' and cap.duration_property(object_path, 'RuntimeMaxUSec') == 900000000
              and cap.duration_property(object_path, 'TimeoutStopUSec') == 35000000
              and 'argv[]=/usr/bin/python3 -B ' + str(HERE / 'recurring_acceptance.py') + ' --close' in values['ExecStopPost'],
              'INDEPENDENT_PRIVATE_RESTORE_CLOSURE_REQUIRED')
    # Durable attempt reservation before any download/cluster operation; never refill.
    r.atomic(r.STATE / 'restore-attempt.json', {'setId': row['setId'], 'automaticRetry': False})
    target.mkdir(mode=0o700)
    repository = offsite.Repository(prepare)
    r.require(json.loads(repository.run(['cat', 'config']))['id'] == config['repositoryId'], 'REPOSITORY_CHANGED')
    snapshots = r.select_snapshots(repository.snapshots())
    r.require(sum(x['id'] == row['snapshotId'] and x['paths'] == [str(r.ROOT / 'sets' / row['setId'])]
                  for x in snapshots) == 1, 'LATEST_SNAPSHOT_IDENTITY')
    PHASE = 'DOWNLOAD_LATEST_NEW_B2_SET'
    repository.run(['restore', row['snapshotId'], '--target', str(target / 'download')])
    source = target / 'download' / (r.ROOT / 'sets' / row['setId']).relative_to('/')
    offsite.SET_ID = row['setId']
    manifest, payload, digest = offsite.verify_set(source, cap)
    r.require(digest == row['manifestSha256'] and payload == row['payloadBytes'], 'DOWNLOADED_SET_CHANGED')
    r.atomic(target / 'download-proof.json', {'setId': row['setId'], 'snapshotId': row['snapshotId'],
             'allDownloadedBytes': 'MATCH_MANIFEST', 'payloadBytes': payload, 'manifestSha256': digest})
    meta = r.read(source / 'database/manifest.json')
    parents = [r.ROOT, r.ROOT / 'restore', target]
    postgres = pwd.getpwnam('postgres'); account = prepare.account('postgres')
    baseline = restore.acl_baseline(parents)
    r.atomic(target / 'parent-acl.json', {'parents': baseline, 'postgresUid': postgres.pw_uid})
    for path in parents:
        os.setxattr(path, restore.ACL_NAME, restore.traversal_acl(postgres.pw_uid), follow_symlinks=False)
        r.require(restore.get_acl(path) == restore.traversal_acl(postgres.pw_uid), 'PRIVATE_TRAVERSAL_ACL')
    for path in (restore.DATA, restore.SOCKET):
        path.mkdir(mode=0o700); os.chown(path, postgres.pw_uid, postgres.pw_gid)
    PHASE = 'ISOLATED_PG16_INIT_AND_RESTORE'
    database = meta['catalog']['database']; owner = database['owner']
    restore.run([restore.PG + 'initdb', '-D', str(restore.DATA), '--no-clean', '--encoding=UTF8',
        '--locale-provider=libc', '--lc-collate=' + database['collate'], '--lc-ctype=' + database['ctype'],
        '--auth-local=peer', '--auth-host=reject'], account=account, timeout=90)
    (restore.DATA / 'pg_ident.conf').write_text('recovery_operator root postgres\nrecovery_operator postgres postgres\n')
    (restore.DATA / 'pg_hba.conf').write_text('local all postgres peer map=recovery_operator\nlocal all all reject\n')
    for name in ('pg_ident.conf', 'pg_hba.conf'):
        os.chown(restore.DATA / name, postgres.pw_uid, postgres.pw_gid); (restore.DATA / name).chmod(0o600)
    restore.run([restore.PG + 'pg_ctl', '-D', str(restore.DATA), '-l', str(restore.DATA / 'restore.log'),
        '-w', '-t', '30', 'start', '-o', "-c listen_addresses='' -c port=55434 -c unix_socket_directories=" +
        str(restore.SOCKET) + ' -c unix_socket_permissions=0700 -c autovacuum=off -c max_connections=10'], account=account)
    identity = restore.sql("SELECT json_build_object('data',current_setting('data_directory'),'tcp',current_setting('listen_addresses'),'port',current_setting('port'))", database='postgres')
    r.require(identity == {'data': str(restore.DATA), 'tcp': '', 'port': '55434'}, 'PRIVATE_CLUSTER_IDENTITY')
    restore.sql(restore.role_sql(meta['catalog']['roles']), database='postgres', readonly=False)
    restore.sql('CREATE DATABASE ' + restore.quote(restore.DB) + ' OWNER ' + restore.quote(owner) +
                " TEMPLATE template0 ENCODING 'UTF8' LC_COLLATE " + restore.literal(database['collate']) +
                ' LC_CTYPE ' + restore.literal(database['ctype']), database='postgres', readonly=False)
    with open(source / 'database/passvero_acceptance.dump', 'rb') as dump:
        result = subprocess.run([restore.PG + 'pg_restore', '--exit-on-error', '--single-transaction',
            '-h', str(restore.SOCKET), '-p', '55434', '-U', 'postgres', '-d', restore.DB],
            stdin=dump, capture_output=True, env=restore.ENV, timeout=120)
    r.require(result.returncode == 0, 'PRIVATE_PG_RESTORE_FAILED')
    restore.database_acl(database['acl'], apply=True)
    restore.sql('ALTER DATABASE ' + restore.quote(restore.DB) + ' SET default_transaction_read_only=on', readonly=False)
    PHASE = 'VERIFY_NEW_SCHEMA_WITH_ACCEPTED_EXACT_EQUIVALENCES'
    verifier = helpers['verify-database']; catalog = helpers['recurring_catalog']
    catalog.REVIEWED_CONSTRAINTS = verifier.REVIEWED_CONSTRAINTS
    current = restore.sql(cap.CATALOG)
    # Private schema-only diagnosis survives a strict verifier STOP and independent cleanup.
    r.atomic(target / 'catalog-source.json', meta['catalog'])
    r.atomic(target / 'catalog-restored.json', current)
    equivalents = catalog.verify_catalog(meta['catalog'], current, restore)
    r.require(all(current['database'][key] == database[key] for key in ('owner', 'encoding', 'collate', 'ctype'))
              and restore.database_acl(current['database']['acl']) == restore.database_acl(database['acl']), 'DATABASE_SETTINGS_ACL')
    tables = restore.sql(cap.TABLES)
    r.require(len(tables) == config['tables'] and len(current['migrations']) == config['migrations']['count'], 'NEW_SCHEMA_SCOPE')
    r.require({name: restore.sql('SELECT count(*) FROM ' + cap.identifier(name)) for name in tables} == meta['counts'], 'ALL_TABLE_COUNTS')
    r.require(restore.sql(cap.SEQUENCES) == meta['sequences'], 'ALL_SEQUENCES')
    storage = r.read(source / 'storage/manifest.json'); references = helpers['references']
    assets = restore.sql(references.QUERY)
    order = lambda rows: sorted(rows, key=lambda item: (item['bucket'], item['key']))
    r.require(order(assets['references']) == order(storage['references'])
              and assets['enabledCampaigns'] == storage['enabledCampaigns']
              and references.reconcile(storage['objects'], assets['references']) == storage['reconciliation'], 'NEW_ASSET_REFERENCE_CONSISTENCY')
    r.atomic(target / 'catalog-equivalences.json', equivalents)
    PHASE = 'REUSE_ACCEPTED_APPLICATION_READER'
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
    r.require(restore.sql(cap.CATALOG) == current, 'READER_CHANGED_CATALOG')
    r.atomic(target / 'summary.json', {'restore': 'PASS_LATEST_NEW_B2_DB_AND_FILES', **row,
             'tables': len(tables), 'migrations': len(current['migrations']), 'application': application,
             'schemaAndBusinessWrites': 'PRIVATE_RESTORE_ONLY', 'smtpCalls': 0, 'liveStagingPaused': False,
             'storageProviderRestore': 'NOT_PERFORMED', 'fullWebAuthScannerRecovery': 'NOT_TESTED'})
    print(json.dumps({'restoreBody': 'PASS', 'setId': row['setId']}))


def retention(config, helpers):
    row = selected(config, helpers)
    r.require(not (r.STATE / 'retention-attempt.json').exists(), 'RETENTION_DRY_RUN_BUDGET_ONE')
    repository = helpers['offsite'].Repository(helpers['prepare'])
    r.require(json.loads(repository.run(['cat', 'config']))['id'] == config['repositoryId'], 'REPOSITORY_CHANGED')
    candidates = r.select_snapshots(repository.snapshots())
    r.atomic(r.STATE / 'retention-attempt.json', {'latestSet': row['setId'], 'dryRunOnly': True})
    # Historical wrapper intentionally disallows forget; this single audited path is dry-run only.
    result = subprocess.run(['/usr/local/bin/restic', '--no-cache', '--no-lock', '--repo', repository.repo,
        '--password-file', '/etc/passvero/backup/restic-password', 'forget', '--dry-run', '--json',
        '--host', 'passvero-staging-recovery', '--tag', 'passvero-staging-recovery', '--group-by', 'host',
        '--keep-daily', '14', '--keep-weekly', '8', '--keep-monthly', '6'], capture_output=True, timeout=60,
        env={'PATH': '/usr/bin:/bin', 'LANG': 'C', **repository.keys})
    r.require(result.returncode == 0 and len(result.stdout) < 1024 ** 2, 'RETENTION_DRY_RUN_FAILED')
    groups = json.loads(result.stdout)
    known = {item['id'] for item in candidates}
    decision = []
    for group in groups:
        for key in ('keep', 'remove'):
            rows = r.select_snapshots(group.get(key) or [])
            r.require(all(item['id'] in known for item in rows), 'RETENTION_OUTSIDE_VALIDATED_INVENTORY')
            decision.extend({'snapshotId': item['id'], 'decision': key} for item in rows)
    r.require(len(decision) == len(known) and {x['snapshotId'] for x in decision} == known,
              'RETENTION_COMPLETE_DECISION')
    r.atomic(r.STATE / 'retention.json', {'retention': 'PASS_DRY_RUN_ONLY', 'repositoryId': config['repositoryId'],
             'selector': {'host': 'passvero-staging-recovery', 'tag': 'passvero-staging-recovery', 'groupBy': 'host'},
             'policy': {'daily': 14, 'weekly': 8, 'monthly': 6}, 'productionCandidates': 0,
             'decisions': decision, 'deletedSnapshots': 0})


def signals(config, helpers):
    r.require(not (r.STATE / 'signal-proof.json').exists(), 'SIGNAL_TEST_BUDGET_ONE')
    now = int(time.time())
    cases = {'BACKUP_FAILED': {'failure': {'reason': 'CONTROLLED_FIXTURE'}},
             'SET_INCOMPLETE': {'attempt': {'complete': False}}, 'VALID_SET_MISSING': {},
             'SET_STALE': {'valid': {'captureEpoch': now - 90001}},
             'HEALTHY': {'valid': {'captureEpoch': now - 90000}}}
    r.require(all(r.signal(value, now) == expected for expected, value in cases.items()), 'CONTROLLED_SIGNAL_CLASSIFICATION')
    path = r.STATE / 'controlled-dedup.json'
    r.require(r.reserve_alert(path, 'SET_STALE', 'controlled-fixture', now)
              and not r.reserve_alert(path, 'SET_STALE', 'controlled-fixture', now + 90001)
              and r.read(path)['delivery'] == 'UNKNOWN', 'CONTROLLED_NO_BLIND_RETRY')
    if config['testTelegramApproved']:
        r.monitor(config, helpers, test=True)
    r.atomic(r.STATE / 'signal-proof.json', {'signals': 'PASS_CONTROLLED_NO_LIVE_BACKUP_CORRUPTION',
             'cases': list(cases), 'dedup': 'PASS_UNKNOWN_NOT_RETRIED',
             'telegramTest': 'PROVIDER_ACCEPTED' if config['testTelegramApproved'] else 'NOT_APPROVED_NOT_SENT',
             'inboxReceipt': 'NOT_PROVEN', 'liveBackupStateAltered': False})


def finalize(config, helpers):
    row = selected(config, helpers)
    target = r.ROOT / 'restore' / row['setId']
    r.require(r.read(target / 'summary.json')['restore'] == 'PASS_LATEST_NEW_B2_DB_AND_FILES'
              and r.read(target / 'closure.json')['cluster'] == 'STOPPED'
              and r.read(r.STATE / 'retention.json')['retention'] == 'PASS_DRY_RUN_ONLY'
              and r.read(r.STATE / 'signal-proof.json')['signals'] == 'PASS_CONTROLLED_NO_LIVE_BACKUP_CORRUPTION', 'A_D_REQUIRED')
    state = r.read(r.STATE / 'state.json'); state['mode'] = 'CONTINUOUS'
    r.atomic(r.STATE / 'state.json', state)
    r.atomic(r.STATE / 'acceptance.json', {'A': 'PASS_TWO_REAL_SCHEDULED_NEW_OFFSITE_SETS',
             'B': 'PASS_LATEST_NEW_SET_PRIVATE_RESTORE_AND_READER', 'C': 'PASS_STAGING_RETENTION_DRY_RUN',
             'D': 'PASS_CONTROLLED_SIGNALS', 'continuousDailySchedule': 'APPROVED_PROMOTED',
             'retentionDeletion': 'NOT_APPROVED', 'productionChanged': False})


def main():
    config, helpers = r.scope(closing=sys.argv[1] == '--close')
    mode = sys.argv[1]
    if mode == '--close':
        close(config, helpers); return
    fd = r.lock(r.STATE / 'job.lock')
    try:
        {'--restore': restore_latest, '--retention': retention, '--signals': signals,
         '--finalize': finalize}[mode](config, helpers)
    finally:
        os.close(fd)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        result = {'result': 'STOP', 'phase': PHASE, 'reason': reason, 'automaticRetry': False}
        if os.geteuid() == 0 and r.STATE.is_dir():
            path = r.STATE / 'acceptance-first-failure.json'
            if not path.exists():
                r.atomic(path, result)
        print(json.dumps(result), flush=True); sys.exit(1)
