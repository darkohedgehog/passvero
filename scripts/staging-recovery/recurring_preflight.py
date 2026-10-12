"""Read-only operator inventory for recurring staging backup preparation.

Imports only the pinned accepted preparation/capture helpers; never calls main,
capture, worker, restore, retention or alert transport. No files are written.
"""
import ast
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

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
APP = pathlib.Path('/var/www/passvero-acceptance')
CANONICAL = pathlib.Path('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
PREP_PIN = 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
CAP_PIN = 'd4c644cf0100ef94e96277bfe372616d998bac05dad2d9a068cd8938ef10b5fa'
PROPERTIES = ('LoadState', 'ActiveState', 'UnitFileState', 'Result', 'MainPID',
              'TimeoutStartUSec', 'TimeoutStopUSec', 'OnFailure', 'TimersCalendar',
              'NextElapseUSecRealtime', 'LastTriggerUSec', 'Persistent', 'RandomizedDelayUSec')
UNITS = ('passvero-postgres-backup.timer', 'passvero-postgres-backup.service',
         'passvero-backup-freshness.timer', 'passvero-subscription-reminders.timer',
         'passvero-subscription-reminders.service', 'pm2-passvero-staging.service',
         'passvero-staging-backup.timer', 'passvero-staging-backup.service')
PHASE = 'OPERATOR_SCOPE'


class Stop(Exception):
    pass


def require(value, reason):
    if not value:
        raise Stop(reason)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metadata(path, content_hash=True):
    if not path.exists() and not path.is_symlink():
        return {'exists': False}
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022,
            'INPUT_FILE_POSTURE')
    result = {'exists': True, 'bytes': info.st_size, 'uid': info.st_uid,
              'mode': oct(stat.S_IMODE(info.st_mode))}
    if content_hash:
        result['sha256'] = digest(path)
    return result


def load_accepted(name, pin):
    path = ROOT / 'operator' / (name + '-' + pin + '.py')
    require(metadata(path).get('sha256') == pin, 'ACCEPTED_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location('accepted_' + name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def unit_report(text):
    return {key: value for line in text.splitlines() if '=' in line
            for key, value in [line.split('=', 1)] if key in PROPERTIES}


def read_unit(unit):
    require(unit in UNITS, 'UNIT_SCOPE')
    result = subprocess.run(['/usr/bin/systemctl', 'show', unit,
                             '--property=' + ','.join(PROPERTIES)],
                            capture_output=True, timeout=10, env={'PATH': '/usr/bin:/bin', 'LANG': 'C'})
    # An absent proposed unit is useful inventory, not permission to create it.
    report = unit_report(result.stdout.decode())
    require(report and (result.returncode == 0 or report.get('LoadState') == 'not-found'),
            'UNIT_READ_FAILED')
    return report


def repository_identity(config):
    require(config.get('version') in (1, 2)
            and re.fullmatch('[a-f0-9]{64}', config.get('id', '')), 'EXISTING_STAGING_REPOSITORY_REQUIRED')
    return config['id']


def snapshot_summary(rows):
    require(isinstance(rows, list) and rows, 'EXISTING_STAGING_SNAPSHOTS_REQUIRED')
    output = []
    for row in rows:
        paths = row.get('paths', [])
        require(re.fullmatch('[a-f0-9]{64}', row.get('id', ''))
                and row.get('hostname') == 'passvero-staging-recovery'
                and 'passvero-staging-recovery' in row.get('tags', []) and len(paths) == 1
                and re.fullmatch(re.escape(str(ROOT / 'sets')) + r'/[0-9]{8}T[0-9]{6}Z', paths[0]),
                'STAGING_SNAPSHOT_SELECTOR')
        output.append({'snapshotId': row['id'], 'setId': paths[0].rsplit('/', 1)[1],
                       'time': row.get('time'), 'host': 'passvero-staging-recovery'})
    return output


def alert_contract(source):
    # Emit grammar/identifiers, not source lines or arbitrary literals. An existing
    # production state path prevents treating that helper as a staging-safe API.
    result = {'productionStateReferenced': '/var/lib/passvero-backup' in source,
              'existingTokenPathReferenced': '/etc/passvero/backup/telegram-bot-token' in source,
              'existingChatPathReferenced': '/etc/passvero/backup/telegram-chat-id' in source,
              'sendMessageReferenced': 'sendMessage' in source, 'functions': []}
    try:
        tree = ast.parse(source)
        result['language'] = 'python'
        result['functions'] = [node.name for node in tree.body if isinstance(node, ast.FunctionDef)]
        result['cliArgumentNames'] = sorted({arg.value for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
            and node.func.attr == 'add_argument' for arg in node.args
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str)
            and re.fullmatch(r'--?[a-z][a-z-]{0,40}', arg.value)})
    except SyntaxError:
        result['language'] = 'shell_or_other'
    return result


def stop_report(error, phase):
    reason = str(error) if isinstance(error, Stop) and re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
    return {'recurringPreflight': 'STOP', 'phase': phase, 'reason': reason,
            'databaseWrites': 0, 'remoteWrites': 0, 'filesWritten': 0,
            'workerExecuted': False, 'smtpCalls': 0, 'telegramCalls': 0,
            'retry': 'RETURN_FIRST_OUTPUT_NO_AUTOMATIC_RETRY'}


def main():
    global PHASE
    sys.dont_write_bytecode = True
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    prepare = load_accepted('prepare', PREP_PIN)
    cap = load_accepted('capture', CAP_PIN)
    PHASE = 'RUNTIME_DB_AND_WRITERS_READ_ONLY'
    process, env = prepare.runtime()
    db = prepare.sql('''SELECT json_build_object('database',current_database(),
      'port',current_setting('port'),'directory',current_setting('data_directory'),
      'bytes',pg_database_size(current_database()),
      'tables',(SELECT count(*) FROM pg_tables WHERE schemaname='public'),
      'migrations',(SELECT json_build_object('count',count(*),'finished',bool_and(finished_at IS NOT NULL AND rolled_back_at IS NULL),'digest',md5(string_agg(migration_name||':'||checksum,',' ORDER BY migration_name))) FROM _prisma_migrations),
      'pendingDocuments',(SELECT count(*) FROM "Document" WHERE status='PENDING_UPLOAD' OR "malwareScanStatus"='PENDING'),
      'pendingImages',(SELECT count(*) FROM "ProductImageAsset" WHERE state='PENDING'),
      'enabledCampaigns',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled),
      'outbox',(SELECT coalesce(json_object_agg(status,total),'{}') FROM (SELECT CASE WHEN status IN ('PENDING','CLAIMED','SENDING','SENT','CANCELLED','FAILED','DELIVERY_UNKNOWN') THEN status ELSE 'UNEXPECTED' END AS status,count(*) total FROM "SubscriptionReminder" GROUP BY 1) x),
      'clients',(SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND backend_type='client backend' AND pid<>pg_backend_pid()),
      'preparedTransactions',(SELECT count(*) FROM pg_prepared_xacts WHERE database=current_database()))''')
    require(db['database'] == 'passvero_acceptance' and db['port'] == '5433'
            and db['directory'] == '/var/lib/postgresql/16/acceptance', 'DATABASE_SCOPE')
    canonical = json.loads(prepare.protected(CANONICAL))
    build = (APP / '.next/BUILD_ID').read_text().strip()
    require(canonical['build_id'] == build and re.fullmatch('[A-Za-z0-9_-]{1,128}', build), 'BUILD_IDENTITY')
    units = {unit: read_unit(unit) for unit in UNITS}
    PHASE = 'PRIVATE_STORAGE_INVENTORY_READ_ONLY'
    objects = cap.inventory(prepare, env)
    storage = {'objects': len(objects), 'bytes': sum(item['size'] for item in objects),
               'buckets': list(prepare.BUCKETS),
               'inventorySha256': hashlib.sha256(json.dumps(objects, sort_keys=True).encode()).hexdigest()}
    PHASE = 'EXACT_STAGING_B2_PREFIX_READ_ONLY'
    _, _, _, repository = prepare.destination(prepare.protected('/etc/passvero/backup/restic-repository').decode().strip())
    keys = prepare.credentials(prepare.protected('/etc/passvero/backup/restic.env').decode())
    repository_id = repository_identity(json.loads(prepare.restic(repository, keys, ['cat', 'config'])))
    snapshots = snapshot_summary(json.loads(prepare.restic(repository, keys, ['snapshots', '--json'])))
    require(repository_id == '9058358d97bdd3b7e2ef56c53ea132f4b7be74752f213cbfbcc093c5331b9b35',
            'ACCEPTED_STAGING_REPOSITORY_CHANGED')
    PHASE = 'EXISTING_HELPER_POSTURE_READ_ONLY'
    scripts = {}
    for name in ('passvero-postgres-backup', 'passvero-backup-freshness', 'passvero-backup-alert'):
        path = pathlib.Path('/usr/local/sbin') / name
        scripts[name] = metadata(path)
        if scripts[name]['exists'] and name == 'passvero-backup-alert':
            scripts[name]['interface'] = alert_contract(path.read_text())
    protected_inputs = {name: metadata(pathlib.Path('/etc/passvero/backup') / name, False)
                        for name in ('restic-password', 'restic.env', 'telegram-bot-token', 'telegram-chat-id')}
    helpers = {path.name: metadata(path) for path in sorted((ROOT / 'operator').glob('*.py'))}
    process_after, _ = prepare.runtime()
    require(process_after == process, 'RUNTIME_CHANGED_DURING_READ_ONLY_PREFLIGHT')
    result = {'recurringPreflight': 'PASS_READ_ONLY', 'observedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'database': db, 'buildId': build, 'canonicalSha256': digest(CANONICAL),
              'canonicalArtifactCount': len(canonical['files']), 'units': units,
              'stagingProcessesInAppDirectory': cap.source_workers(prepare),
              'storage': storage, 'stagingPrefix': prepare.PREFIX + '/', 'repositoryId': repository_id,
              'snapshots': snapshots, 'diskFreeBytes': shutil.disk_usage(ROOT).free,
              'scripts': scripts, 'protectedInputsMetadataOnly': protected_inputs, 'acceptedHelpers': helpers,
              'workerLauncher': metadata(pathlib.Path('/usr/local/libexec/passvero-subscription-reminders/launch.py')),
              'workerBundle': metadata(pathlib.Path('/usr/local/libexec/passvero-subscription-reminders/worker.cjs')),
              'databaseWrites': 0, 'remoteWrites': 0, 'filesWritten': 0, 'workerExecuted': False,
              'smtpCalls': 0, 'telegramCalls': 0, 'stagingPauseRequested': False,
              'evidenceLevel': 'READ_ONLY_INVENTORY_NOT_CAPTURE_OR_RUNTIME_HEALTH_ACCEPTANCE'}
    print(json.dumps(result, indent=2, sort_keys=True), flush=True)


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        print(json.dumps(stop_report(error, PHASE)), flush=True)
        sys.exit(1)
