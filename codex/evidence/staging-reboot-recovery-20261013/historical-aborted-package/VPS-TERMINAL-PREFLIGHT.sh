# VPS TERMINAL / PENDING_OPERATOR_COMMAND — READ_ONLY_PREFLIGHT_ONLY
# Prepared only. Do not run during this preparation task. No reboot is unlocked.
sudo /usr/bin/python3 -I -B - <<'PASSVERO_REBOOT_READONLY_PREFLIGHT'
"""Operator-only collection; no mutating entrypoints and no permission to reboot.

Run the embedded VPS block, not this file on a developer machine. All stdout is
allowlisted metadata. stderr, connection strings, process env and file bodies stay
private. A complete collection still requires review of installed identities.
"""
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import stat
import subprocess
import time

P = pathlib.Path
APP = P('/var/www/passvero-acceptance')
CODE = P('/usr/local/libexec/passvero-staging-backup')
BACKUP = P('/var/lib/passvero-staging-recovery/recurring')
SCANNER = P('/usr/local/libexec/passvero-signature-recovery-v3')
CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
BUILD = '_tkSUOn0PCoHjpx8V7FVr'
CANONICAL_PIN = 'e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590'
CONFIG_PIN = 'a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839'
ORG = 'bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0'
PRODUCT = 'c1c24c7c-334b-48bf-ba34-ac5fb930f1c2'
OLD_SCANNER_PIN = '3c1f0e5c4a04a57bc52d7e3ad3043f450cc9476a8b649e125354c75ce00f34d0'
TIMERS = ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer',
          'passvero-subscription-reminders.timer')
KNOWN_UNITS = TIMERS + tuple(x.replace('.timer', '.service') for x in TIMERS) + (
    'pm2-passvero-staging.service', 'passvero-qpdf-broker.socket',
    'passvero-qpdf-acceptance.service', 'clamav-daemon.socket',
    'clamav-daemon.service', 'clamav-freshclam.service',
    'passvero-signature-health.timer', 'passvero-signature-health.service')
DEADLINE = None


def require(value, code):
    if not value:
        raise RuntimeError(code)


def read(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink(), 'REGULAR_FILE_REQUIRED')
    return path.read_bytes()


def sha(body):
    return hashlib.sha256(body).hexdigest()


def metadata(path):
    if not path.exists() and not path.is_symlink():
        return {'exists': False}
    info = path.lstat()
    result = {'exists': True, 'symlink': path.is_symlink(), 'uid': info.st_uid,
              'gid': info.st_gid, 'mode': oct(stat.S_IMODE(info.st_mode))}
    if stat.S_ISREG(info.st_mode):
        result.update(sha256=sha(read(path)), bytes=info.st_size)
    return result


def run(args, timeout=15, **options):
    if DEADLINE is not None:
        require(time.monotonic() < DEADLINE, 'COLLECTION_BUDGET_EXCEEDED')
        timeout = min(timeout, max(0.1, DEADLINE - time.monotonic()))
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout,
                            env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C'}, **options)
    require(result.returncode == 0, 'READ_COMMAND_FAILED')
    return result.stdout


def unit(name):
    require(re.fullmatch(r'[A-Za-z0-9_.@:\\-]+\.(service|socket|timer)', name), 'UNIT_NAME_INVALID')
    body = run(['/usr/bin/systemctl', 'show', name, '--property=' +
                'Id,LoadState,ActiveState,SubState,UnitFileState,MainPID,User,Group,' +
                'FragmentPath,DropInPaths,After,Requires,Wants,Triggers,TriggeredBy'])
    value = dict(line.split('=', 1) for line in body.splitlines() if '=' in line)
    fragments = [value.get('FragmentPath', '')] + value.get('DropInPaths', '').split()
    value['sourceFiles'] = {name: metadata(P(name)) for name in fragments if name}
    return value


def due(name, now):
    body = run(['/usr/bin/busctl', 'get-property', 'org.freedesktop.systemd1',
                '/org/freedesktop/systemd1/unit/' + name.replace('_', '_5f').replace('-', '_2d').replace('.', '_2e'),
                'org.freedesktop.systemd1.Timer', 'NextElapseUSecRealtime'])
    require(re.fullmatch(r't [0-9]+\s*', body), 'TYPED_TIMER_INVALID')
    epoch = int(body.split()[1]) / 1_000_000
    # The backup/monitor are calendar timers; reminder is monotonic, not calendar.
    require(epoch > 0, 'CALENDAR_DUE_MISSING')
    return {'typedMicroseconds': int(body.split()[1]), 'dueUTC':
            datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc).isoformat(),
            'secondsRemaining': round(epoch - now, 3), 'wholeWindowAndReserve': epoch - now >= 2700}


def sql(query):
    account = pwd.getpwnam('postgres')
    return json.loads(run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql',
        '-p', '5433', '-d', 'passvero_acceptance', '-v', 'ON_ERROR_STOP=1', '-c',
        "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; " + query + '; ROLLBACK;'],
        user=account.pw_uid, group=account.pw_gid, extra_groups=[], cwd='/', timeout=10))


def release():
    body = read(CANONICAL)
    require(sha(body) == CANONICAL_PIN, 'CANONICAL_PIN_MISMATCH')
    manifest = json.loads(body)
    require(manifest['build_id'] == BUILD == read(APP / '.next/BUILD_ID').decode().strip(), 'BUILD_MISMATCH')
    for name, item in manifest['files'].items():
        path = APP / name
        require(not P(name).is_absolute() and '..' not in P(name).parts and
                path.resolve().is_relative_to(APP.resolve()), 'ARTIFACT_PATH_SCOPE')
        require(sha(read(path)) == item['sha256'], 'EXECUTABLE_CHANGED')
    config_body = read(CODE / 'config.json')
    require(sha(config_body) == CONFIG_PIN, 'BACKUP_CONFIG_CHANGED')
    config = json.loads(config_body)
    require(config['buildId'] == BUILD and config['canonicalSha256'] == CANONICAL_PIN,
            'BACKUP_RELEASE_NOT_ALIGNED')
    pins = {'recurring.py': '14a2358709bf79fee6fd17321f1e6d55170740e098fb6cf1756fbda4c3713418',
            'recurring_acceptance.py': 'fa000e06f767a0f637a033bd57f11517397ebd715daa85fd67f5db51f28afdc7',
            'recurring_catalog.py': 'b0b84b1a06035c04949777d664ffe73e9362b063357f72ee7205097c1b2513f7'}
    for name, pin in pins.items():
        require(sha(read(CODE / name)) == pin, 'BACKUP_HELPER_CHANGED')
    return {'buildId': BUILD, 'canonicalSha256': CANONICAL_PIN, 'configSha256': CONFIG_PIN,
            'executableFilesVerified': len(manifest['files']), 'helpers': pins}


def runtime():
    config = json.loads(read(CODE / 'config.json'))
    pin = config['helpers']['prepare']
    require(re.fullmatch('[0-9a-f]{64}', pin), 'PREPARE_PIN_INVALID')
    path = P('/var/lib/passvero-staging-recovery/operator') / ('prepare-' + pin + '.py')
    require(sha(read(path)) == pin == 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473',
            'PREPARE_SOURCE_NOT_REVIEWED')
    # Only the already reviewed runtime() path; never prepare.main()/storage/worker.
    spec = importlib.util.spec_from_file_location('reviewed_runtime_metadata', path)
    helper = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(helper)
    process, environment = helper.runtime()
    require(process['name'] == 'passvero-acceptance' and process['cwd'] == str(APP), 'RUNTIME_SCOPE')
    # Do not expose returned credentials/URLs; runtime() validates fixed DB endpoint.
    return {'process': process, 'databaseEndpoint': '127.0.0.1:5433/passvero_acceptance',
            'authEndpoint': '127.0.0.1:5433/passvero_acceptance', 'prepareSha256': pin,
            'storageBucket': 'passvero-staging-documents', 'credentials': 'NOT_EXPOSED'}


def retained_capture_record(state, record, closure, service):
    set_id = record.get('setId', '')
    require(re.fullmatch(r'[0-9]{8}T[0-9]{6}Z', set_id), 'CAPTURE_RECORD_SET_INVALID')
    require(state.get('attempt', {}).get('complete') is True and
            set_id == state['attempt'].get('setId') == state.get('valid', {}).get('setId'),
            'CAPTURE_RECORD_NOT_COMPLETED')
    require(closure.get('stagingResumed') is True and closure.get('timerBaselineRestored') is True
            and closure.get('serviceResult') == 'success', 'CAPTURE_RESUME_NOT_PROVEN')
    require(service.get('ActiveState') == 'inactive' and service.get('SubState') == 'dead',
            'CAPTURE_SERVICE_NOT_IDLE')
    return {'setId': set_id, 'classification': 'RETAINED_COMPLETED_CAPTURE_RECORD',
            'closure': closure, 'serviceState': service['ActiveState']}


def backup():
    body = read(BACKUP / 'state.json')
    state = json.loads(body)
    require(state['mode'] == 'CONTINUOUS' and state['hold'] is False and
            state['attempt']['complete'] and not state.get('failure'), 'BACKUP_STATE_NOT_READY')
    retained = None
    if (BACKUP / 'active.json').exists():
        record = json.loads(read(BACKUP / 'active.json'))
        set_id = record.get('setId', '')
        require(re.fullmatch(r'[0-9]{8}T[0-9]{6}Z', set_id), 'CAPTURE_RECORD_SET_INVALID')
        closure = json.loads(read(BACKUP.parent / 'control' / set_id / 'closure.json'))
        retained = retained_capture_record(state, record, closure, unit('passvero-staging-backup.service'))
    fd = os.open(BACKUP / 'job.lock', os.O_RDONLY | os.O_NOFOLLOW)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    finally:
        os.close(fd)
    now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    capture = state['valid']['captureEpoch']
    require(0 <= now - capture < 25 * 3600 - 2700, 'VALID_SET_FRESHNESS_WINDOW')
    return {'sha256': sha(body), 'mode': state['mode'], 'hold': state['hold'],
            'attempts': state['attempts'], 'validSet': state['valid']['setId'],
            'validCaptureEpoch': capture, 'ageSeconds': round(now - capture, 3),
            'failure': state.get('failure'), 'attemptComplete': state['attempt']['complete'],
            'monitorResult': json.loads(read(BACKUP / 'monitor-result.json')),
            'retainedCaptureRecord': retained}


def jobs():
    matches = []
    for proc in P('/proc').iterdir():
        if not proc.name.isdecimal() or int(proc.name) == os.getpid():
            continue
        try:
            args = (proc / 'cmdline').read_bytes().split(b'\0')
            for category, pattern in (
                ('BACKUP_OR_RESTORE', rb'/passvero-staging-(?:backup|recovery)/'),
                ('SCANNER_RECOVERY', rb'/passvero-signature-recovery-v3/.*recover'),
                ('REMINDER_WORKER', rb'/passvero-subscription-reminders/(?:launch.py|worker.cjs)')):
                if any(re.search(pattern, arg) for arg in args):
                    matches.append({'pid': int(proc.name), 'category': category})
        except (FileNotFoundError, ProcessLookupError):
            pass
    require(not matches, 'ACTIVE_JOB_STOP')
    return {'activeRelevantProcesses': matches, 'commandLines': 'NOT_EXPOSED'}


def fixture():
    return sql('''SELECT json_build_object(
      'product',(SELECT json_build_object('id',id,'organizationId',"organizationId",
        'createdById',"createdById",'draftId',"currentDraftVersionId",'publishedId',"currentPublishedVersionId",
        'classification',"regulatoryClassification",'active',"lifecycleStatus"='ACTIVE',
        'historicalSkuMatches',sku='UI-POLISH-20260923') FROM "Product" WHERE id='%s'),
      'candidateMembers',(SELECT coalesce(json_agg(json_build_object('userId',m."userId",'role',m.role,
        'verified',a."emailVerified",'hasPassword',EXISTS(SELECT 1 FROM "AuthProviderAccount" c
        WHERE c."userId"=a.id AND c."providerId"='credential' AND c.password IS NOT NULL))), '[]'::json)
        FROM "Membership" m LEFT JOIN "AuthIdentity" i ON i."userId"=m."userId" AND i."revokedAt" IS NULL
        AND i.provider='BETTER_AUTH' LEFT JOIN "AuthProviderUser" a ON a.id=i."providerSubject"
        WHERE m."organizationId"='%s' AND m.status='ACTIVE'),
      'versions',(SELECT coalesce(json_agg(json_build_object('id',id,'status',status)), '[]'::json)
        FROM "ProductVersion" WHERE "productId"='%s'),
      'imageReferences',(SELECT coalesce(json_agg(json_build_object('id',im.id,'versionId',im."productVersionId",
        'assetId',im."assetId")), '[]'::json) FROM "ProductImage" im JOIN "ProductVersion" v
        ON v.id=im."productVersionId" WHERE v."productId"='%s'),
      'documentReferences',(SELECT coalesce(json_agg(json_build_object('documentId',pd."documentId",
        'versionId',pd."productVersionId",'public',pd."isPublic",'status',d.status,'scan',d."malwareScanStatus")), '[]'::json)
        FROM "ProductDocument" pd JOIN "ProductVersion" v ON v.id=pd."productVersionId"
        JOIN "Document" d ON d.id=pd."documentId" WHERE v."productId"='%s'))''' %
        (PRODUCT, ORG, PRODUCT, PRODUCT, PRODUCT))


def reminders():
    result = sql('''SELECT json_build_object(
      'reminderStatus',(SELECT coalesce(json_object_agg(status,n), '{}'::json) FROM
        (SELECT status,count(*) n FROM "SubscriptionReminder" GROUP BY status) s),
      'attemptStatus',(SELECT coalesce(json_object_agg(status,n), '{}'::json) FROM
        (SELECT status,count(*) n FROM "ReminderAttempt" GROUP BY status) s),
      'unresolved',(SELECT count(*) FROM "SubscriptionReminder" WHERE status IN ('SENDING','CLAIMED','DELIVERY_UNKNOWN')),
      'activeLeases',(SELECT count(*) FROM "ReminderCampaign" WHERE "leaseUntil">clock_timestamp()),
      'pendingCandidates',(SELECT count(*) FROM "SubscriptionReminder" WHERE status='PENDING'
        AND attempts<3 AND ("nextAttemptAt" IS NULL OR "nextAttemptAt"<=clock_timestamp())),
      'policyEnabled',(SELECT enabled FROM "ReminderEnrollmentPolicy" WHERE id=1))''')
    # Counts remain visible; this is a gate, never an UNKNOWN resend decision.
    result['safeToFinalizePause'] = (result['unresolved'] == 0 and result['activeLeases'] == 0
        and result['attemptStatus'].get('SENDING', 0) == 0
        and result['attemptStatus'].get('DELIVERY_UNKNOWN', 0) == 0)
    return result


def scanner():
    files = {str(path): metadata(path) for path in (
        SCANNER / 'recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py', SCANNER / 'reader.cjs',
        SCANNER / 'producer.cjs', SCANNER / 'pins.json',
        P('/usr/local/libexec/passvero-signature-health.cjs'), P('/etc/passvero-signature-health.json'))}
    historical = SCANNER / 'recover-release-8QNIYVVZWEsQaCL9uLZ5Q.py'
    if historical.exists():
        body = read(historical)
        require(sha(body) == OLD_SCANNER_PIN, 'HISTORICAL_SCANNER_HELPER_CHANGED')
    installed = []
    for path in sorted(SCANNER.glob('*.py')):
        body = read(path)
        # Only exact release literals adjacent to the existing guard, never config bodies.
        pins = re.findall(rb"== '([A-Za-z0-9_-]+)', 'STAGING_RELEASE_CHANGED'", body)
        installed.append({'path': str(path), 'sha256': sha(body),
                          'releasePins': [pin.decode() for pin in pins]})
    histories = []
    for path in sorted(P('/var/lib/passvero-signature-trust/records/recovery').glob('*/state.json')):
        histories.append({'attempt': path.parent.name, 'phase': json.loads(read(path))['phase']})
    consumers = []
    for proc in P('/proc').iterdir():
        if proc.name.isdecimal():
            try:
                fields = dict(line.split(':', 1) for line in (proc / 'status').read_text().splitlines() if ':' in line)
                groups = set(map(int, fields['Groups'].split())) | set(map(int, fields['Gid'].split()))
                if 988 in groups:
                    consumers.append({'pid': int(proc.name), 'uid': int(fields['Uid'].split()[0])})
            except (FileNotFoundError, ProcessLookupError):
                pass
    return {'files': files, 'installedHelpers': installed, 'attemptHistory': histories,
            'socketGroupConsumers': consumers, 'freshReader': 'NOT_INFERRED_FROM_SNAPSHOT_FILE'}


def startup():
    dump = P('/home/passvero-staging/.pm2/dump.pm2')
    rows = json.loads(read(dump))
    apps = [{'name': row.get('name'), 'cwd': row.get('pm_cwd'),
             'executable': row.get('pm_exec_path') if row.get('pm_exec_path') ==
                '/var/www/passvero-acceptance/node_modules/next/dist/bin/next' else 'REQUIRES_PRIVATE_REVIEW',
             'interpreter': row.get('exec_interpreter') if row.get('exec_interpreter') ==
                '/usr/bin/node' else 'REQUIRES_PRIVATE_REVIEW', 'args': row.get('args')
             if row.get('args') == ['start', '--hostname', '127.0.0.1', '--port', '3001'] else 'REQUIRES_PRIVATE_REVIEW'}
            for row in rows]
    require(len(apps) == 1 and apps[0]['name'] == 'passvero-acceptance'
            and apps[0]['cwd'] == str(APP), 'DUMP_SCOPE_CHANGED')
    names = set(KNOWN_UNITS)
    names.update(line.split()[0] for line in run(['/usr/bin/systemctl', 'list-units',
        '--all', '--type=service', '--no-legend', '--plain', '--no-pager']).splitlines()
        if line.split() and re.fullmatch(r'[A-Za-z0-9_.@:\\-]+\.service', line.split()[0]))
    require(len(names) <= 180, 'SERVICE_INVENTORY_BOUND_EXCEEDED')
    units = {name: unit(name) for name in sorted(names)}
    return {'dump': metadata(dump), 'savedApplications': apps, 'units': units,
            'productionScope': 'REVIEW_INVENTORY_SELECT_EXACT_UNITS_AND_HTTP_ORIGIN',
            'pgClusters': run(['/usr/bin/pg_lsclusters', '--no-header']).strip(),
            'consoleAccess': 'USER_CONFIRMED_HOSTINGER_NOT_TESTED_BY_SCRIPT'}


def rollback():
    root = P('/var/lib/passvero-marketing-visual-deploy-20261012')
    return {str(root / name): metadata(root / name) for name in
        ('deploy-reviewed.py', 'old-canonical.json', 'old-config.json', 'previous-.next/BUILD_ID',
         'previous-messages/hr.json', 'rollback-attempt.json')}


def main():
    global DEADLINE
    result = {'preflight': 'STOP', 'mutations': 'NONE', 'automaticRetry': False,
              'executionUnlocked': False, 'rebootScheduled': False, 'sections': {}, 'failures': []}
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'HOST_IDENTITY_REQUIRED')
    DEADLINE = time.monotonic() + 180
    now = datetime.datetime.now(datetime.timezone.utc)
    result.update(host=os.uname().nodename, observedUTC=now.isoformat(),
                  bootId=read(P('/proc/sys/kernel/random/boot_id')).decode().strip())
    for name, action in (('release', release), ('runtime', runtime), ('backup', backup), ('jobs', jobs),
                         ('startup', startup), ('scanner', scanner), ('fixture', fixture),
                         ('reminders', reminders), ('rollback', rollback),
                         ('timers', lambda: {name: due(name, now.timestamp()) for name in TIMERS[:2]}),
                         ('https', lambda: run(['/usr/bin/curl', '--silent', '--max-time', '5',
                             '--output', '/dev/null', '--write-out', '%{http_code} %{ssl_verify_result}',
                             '--header', 'Accept-Language: hr', '--cookie', 'NEXT_LOCALE=hr',
                             'https://staging.passvero.eu/'], timeout=8).strip())):
        try:
            result['sections'][name] = action()
        except Exception as error:
            reason = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
            result['failures'].append({'CHECK_ID': name.upper(), 'reason': reason})
    reminders_result = result['sections'].get('reminders', {})
    if reminders_result.get('safeToFinalizePause') is False:
        result['failures'].append({'CHECK_ID': 'REMINDERS', 'reason': 'UNRESOLVED_DELIVERY_STOP'})
    for name, value in result['sections'].get('timers', {}).items():
        if not value.get('wholeWindowAndReserve', True):
            result['failures'].append({'CHECK_ID': 'TIMERS', 'reason': 'NEXT_TERM_TOO_CLOSE', 'unit': name})
    if result['sections'].get('https', '200 0') != '200 0':
        result['failures'].append({'CHECK_ID': 'HTTPS', 'reason': 'CANONICAL_ROOT_NOT_READY'})
    result['criticalPending'] = ['REVIEW_INSTALLED_STARTUP_AND_PRODUCTION_TARGETS',
        'CONFIRM_DEDICATED_SYNTHETIC_ACCOUNT_ID_AND_PROVENANCE',
        'REVIEW_SCANNER_HELPER_AND_CONSUMER_SCOPE', 'REVIEW_ROLLBACK_AND_CLOSURE_WRAPPER',
        'FINALIZE_MUTATING_BLOCKS_AND_MANIFEST_BEFORE_REBOOT']
    if not result['failures']:
        result['preflight'] = 'COLLECTED_REVIEW_REQUIRED'
    print(json.dumps(result, sort_keys=True, indent=2))
    return 1 if result['failures'] else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
        print(json.dumps({'preflight': 'STOP', 'CHECK_ID': 'HOST_OR_COLLECTION', 'reason': reason,
                          'mutations': 'NONE', 'executionUnlocked': False, 'automaticRetry': False}))
        raise SystemExit(1)

PASSVERO_REBOOT_READONLY_PREFLIGHT
