"""One manually driven staging reboot operation; reuses reviewed recovery helpers.
No scheduling, capture, restore, worker or sending entrypoint. All phases explicit.
"""
import contextlib
import datetime
import fcntl
import hashlib
import importlib.util
import json
import os
import pathlib
import pwd
import re
import select
import shlex
import stat
import subprocess
import sys
import time

P = pathlib.Path
ROOT = P('/var/lib/passvero-reboot-recovery-20261019')
APP = P('/var/www/passvero-acceptance')
BACKUP = P('/var/lib/passvero-staging-recovery/recurring')
CODE = P('/usr/local/libexec/passvero-staging-backup')
CANONICAL = P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json')
DEPLOY = P('/var/lib/passvero-marketing-visual-deploy-20261012/deploy-reviewed.py')
BUILD = '_tkSUOn0PCoHjpx8V7FVr'
CANONICAL_PIN = 'e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590'
CONFIG_PIN = 'a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839'
DEPLOY_PIN = 'db04d71b65c6b382b0796bdf3fe32aea07b9fd97c82b13c996b0c26be1af2082'
SCANNER_PIN = '0e3938d06d6bcbfa9eab0249479bab5e54fe5162a3669a3026a39a0d204c4f44'
START = datetime.datetime(2026, 10, 19, 15, 25, tzinfo=datetime.timezone.utc).timestamp()
END = START + 1800
ATTEMPT = 'recovery-20261019-reboot-01'
TIMERS = ('passvero-staging-backup.timer', 'passvero-staging-backup-monitor.timer',
          'passvero-subscription-reminders.timer')
PRODUCTION_UNITS = ('pm2-darko.service', 'postgresql@16-main.service', 'nginx.service')
STAGING_UNITS = ('pm2-passvero-staging.service', 'postgresql@16-acceptance.service',
                 'passvero-qpdf-broker.socket')
CHECK_ID = 'HOST'
BOOTSTRAP_COMPONENTS = None
BOOTSTRAP_SCANNER = None


def require(value, reason):
    if not value:
        raise RuntimeError(reason)


def sha(body):
    return hashlib.sha256(body).hexdigest()


def read(path):
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and not path.is_symlink(), 'REGULAR_INPUT_REQUIRED')
    return path.read_bytes()


def data(name):
    return json.loads(read(ROOT / name))


def record(name, value):
    body = (json.dumps(value, sort_keys=True, indent=2) + '\n').encode()
    path = ROOT / name
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'wb') as handle:
        handle.write(body); handle.flush(); os.fsync(handle.fileno())
    fd = os.open(ROOT, os.O_RDONLY | os.O_DIRECTORY)
    try: os.fsync(fd)
    finally: os.close(fd)


def run(args, timeout=15, **options):
    result = subprocess.run(args, capture_output=True, timeout=timeout,
                            env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C'}, **options)
    require(result.returncode == 0, 'BOUNDED_COMMAND_FAILED')
    return result.stdout.decode().strip()


def unit(name):
    return dict(line.split('=', 1) for line in run(['/usr/bin/systemctl', 'show', name,
        '--property=Id,LoadState,ActiveState,SubState,UnitFileState,User,Group,TriggeredBy,FragmentPath']).splitlines() if '=' in line)


def load(name, path, pin):
    info = path.lstat()
    require(info.st_uid == 0 and not info.st_mode & 0o022 and sha(read(path)) == pin,
            'REVIEWED_HELPER_CHANGED')
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


def components():
    if BOOTSTRAP_COMPONENTS is not None: return BOOTSTRAP_COMPONENTS
    pins = data('package.json')['files']
    base = load('reboot_base_readonly', ROOT / 'preflight.py', pins['preflight.py'])
    scoped = load('reboot_scoped_readonly', ROOT / 'remaining-backup-and-actor-readonly.py', pins['remaining-backup-and-actor-readonly.py'])
    deploy = load('reboot_reviewed_marketing', DEPLOY, DEPLOY_PIN)
    return base, scoped, deploy


@contextlib.contextmanager
def locked(path):
    # Existing inode only; never remove locks or reserve a backup attempt.
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
                and not info.st_mode & 0o077, 'LOCK_POSTURE')
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield
    finally: os.close(fd)


def boot_id():
    return read(P('/proc/sys/kernel/random/boot_id')).decode().strip()


def inside_start_window(now=None):
    now = time.time() if now is None else now
    require(START <= now <= START + 60, 'APPROVED_START_WINDOW_EXPIRED_OR_NOT_OPEN')


def elapsed(limit):
    require(time.time() <= END, 'APPROVED_MAINTENANCE_WINDOW_ELAPSED')
    require(time.time() - data('baseline.json')['t0'] <= limit, 'PHASE_DEADLINE_EXCEEDED')


def delivery(base):
    # Hash operational metadata in SQL; never expose recipients/tokens or whole rows.
    return base.sql('''SELECT json_build_object(
      'attemptHash',(SELECT md5(coalesce(string_agg(json_build_array(id,number,status,"startedAt","finishedAt")::text,'' ORDER BY id),'')) FROM "ReminderAttempt"),
      'reminderHash',(SELECT md5(coalesce(string_agg(json_build_array(id,status,attempts,"nextAttemptAt","leaseUntil","updatedAt")::text,'' ORDER BY id),'')) FROM "SubscriptionReminder"),
      'campaignHash',(SELECT md5(coalesce(string_agg(json_build_array(id,enabled,"maxDispatches",dispatches,"organizationIds","recipientEmails","operatorEmails","messageKinds","expiresAt","periodKey")::text,'' ORDER BY id),'')) FROM "ReminderCampaign"),
      'enrollmentHash',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY "organizationId"),'')) FROM "OrganizationReminderEnrollment" t),
      'policyHash',(SELECT md5(coalesce(string_agg(to_jsonb(t)::text,'' ORDER BY id),'')) FROM "ReminderEnrollmentPolicy" t),
      'accessNoticeHash',(SELECT md5(coalesce(string_agg(json_build_array("requestId",status,attempts,"startedAt","sentAt","updatedAt")::text,'' ORDER BY "requestId"),'')) FROM "AccessRequestAdminNotification")
    )''')


def drain_writer():
    deadline = time.monotonic() + 210
    while unit('passvero-subscription-reminders.service')['ActiveState'] in ('active', 'activating', 'deactivating'):
        require(time.monotonic() < deadline, 'WRITER_DRAIN_TIMEOUT_NO_KILL')
        time.sleep(1)


def writer_guard(paused=False):
    timer_name = 'passvero-subscription-reminders.timer'
    service_name = 'passvero-subscription-reminders.service'
    # Exact bytes establish the reviewed static configuration independently of
    # systemd's runtime TriggeredBy/Triggers relationships after disable --now.
    for name, pin in (
        (timer_name, '585a8e11b9279ab5b3c8b82ba0215eb85e03c43ae887654fc8e3ed8d177335ab'),
        (service_name, '256207cc6675d90956b135c4e4a07938ea0fde5749659a2416a7c35ea9fb56cc')):
        require(sha(read(P('/etc/systemd/system') / name)) == pin, 'WRITER_STATIC_CONFIGURATION_DRIFT')
    states = {}
    for name in (timer_name, service_name):
        value = unit(name)
        properties = {'Triggers', 'DropInPaths'}
        if name == service_name: properties.add('MainPID')
        extra = dict(line.split('=', 1) for line in run(['/usr/bin/systemctl', 'show', name,
            '--property=' + ','.join(sorted(properties))]).splitlines() if '=' in line)
        require(set(extra) == properties and
                all(key in value for key in ('Id', 'LoadState', 'ActiveState', 'SubState',
                    'UnitFileState', 'TriggeredBy', 'FragmentPath')), 'WRITER_STATE_INCOMPLETE')
        require(value['Id'] == name and value['LoadState'] == 'loaded' and
                value['FragmentPath'] == '/etc/systemd/system/' + name and not extra['DropInPaths'],
                'WRITER_CONFIGURATION_NOT_REVIEWED')
        states[name] = {**value, **extra}
    timer, service = states[timer_name], states[service_name]
    require(service['ActiveState'] == 'inactive' and service['SubState'] == 'dead' and
            service['MainPID'] == '0' and service['UnitFileState'] == 'static', 'WRITER_NOT_IDLE_NO_KILL')
    require(not service['Triggers'] and not timer['TriggeredBy'], 'UNREVIEWED_SENDING_TRIGGER')
    allowed_service_triggers = ('', timer_name) if paused else (timer_name,)
    allowed_timer_targets = ('', service_name) if paused else (service_name,)
    require(service['TriggeredBy'] in allowed_service_triggers and
            timer['Triggers'] in allowed_timer_targets, 'UNREVIEWED_SENDING_TRIGGER')
    require((timer['ActiveState'], timer['SubState'], timer['UnitFileState']) ==
            (('inactive', 'dead', 'disabled') if paused else ('active', 'waiting', 'enabled')),
            'WRITER_PAUSE_NOT_CONFIRMED' if paused else 'WRITER_BASELINE_NOT_CONFIRMED')
    return states


def idle(base, deploy, paused=False):
    deploy.idle(); base.jobs()
    require(unit('passvero-reboot-scanner-20261019.service')['ActiveState'] in ('inactive', 'failed'),
            'THIS_OPERATION_SCANNER_ACTIVE')
    require(unit('passvero-postgres-backup.service')['ActiveState'] == 'inactive', 'PRODUCTION_BACKUP_BUSY')
    require(unit('passvero-subscription-reminders.service')['ActiveState'] == 'inactive', 'WRITER_NOT_IDLE_NO_KILL')
    status = base.reminders()
    require(status['safeToFinalizePause'], 'UNRESOLVED_DELIVERY_STOP')
    writer_guard(paused=paused)
    return status


def release(deploy, old=False):
    if old:
        deploy.verify_manifest(read(CANONICAL), deploy.OLD_CANONICAL, deploy.OLD_BUILD)
        require(sha(read(CODE / 'config.json')) == deploy.OLD_CONFIG, 'OLD_BACKUP_PIN_MISMATCH')
    else:
        deploy.verify_manifest(read(CANONICAL), CANONICAL_PIN, BUILD)
        require(sha(read(CODE / 'config.json')) == CONFIG_PIN, 'BACKUP_PIN_MISMATCH')


def due(deploy, minimum):
    result = {name: deploy.timer_due(name) for name in TIMERS[:2]}
    require(all(value - time.time() >= minimum for value in result.values()), 'NEXT_REGULAR_TERM_TOO_CLOSE')
    return result


def production_pm2():
    # Discover the configured PM2 home from the existing unit; no PM2 CLI.
    body = run(['/usr/bin/systemctl', 'show', 'pm2-darko.service', '--property=User,Environment'])
    values = dict(line.split('=', 1) for line in body.splitlines() if '=' in line)
    require(values.get('User') == 'darko', 'PRODUCTION_PM2_UNIT_IDENTITY_CHANGED')
    account = pwd.getpwnam('darko')
    environment = dict(item.split('=', 1) for item in shlex.split(values.get('Environment', '')) if '=' in item)
    home = environment.get('PM2_HOME')
    require(home == str(P(account.pw_dir) / '.pm2'), 'PRODUCTION_PM2_HOME_CHANGED')
    sock = P(home) / 'rpc.sock'
    require(stat.S_ISSOCK(sock.lstat().st_mode) and sock.lstat().st_uid == account.pw_uid, 'PRODUCTION_RPC_POSTURE')
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),4000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e||!Array.isArray(v))process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,cwd:p.pm2_env.pm_cwd,status:p.pm2_env.status}))));s.close();process.exit(0)}));s.connect(" + json.dumps(str(sock)) + ");"
    rows = json.loads(run(['/usr/bin/node', '-e', probe], timeout=6, user=account.pw_uid,
        group=account.pw_gid, extra_groups=os.getgrouplist('darko', account.pw_gid), cwd='/'))
    require(any(row == {'name': 'passvero', 'cwd': '/var/www/passvero', 'status': 'online'} for row in rows),
            'PRODUCTION_APPLICATION_SCOPE_NOT_READY')
    require(all(row.get('status') == 'online' for row in rows), 'PRODUCTION_PM2_BASELINE_NOT_ONLINE')
    return sorted(rows, key=lambda row: (row['name'], row['cwd']))


def nginx_target(text):
    # Parse balanced server blocks; do not match one server_name to another server's proxy.
    tokens = re.findall(r'"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'|\#[^\n]*|[{};]|[^\s{};]+', text)
    tokens = [token for token in tokens if not token.startswith('#')]
    for pos in range(len(tokens) - 1):
        if tokens[pos:pos+2] != ['server', '{']: continue
        depth, end = 1, pos + 2
        while end < len(tokens) and depth:
            depth += (tokens[end] == '{') - (tokens[end] == '}'); end += 1
        require(depth == 0, 'NGINX_BLOCK_INVALID')
        body = tokens[pos+2:end-1]
        def directive(key):
            values = []
            for at, token in enumerate(body):
                if token == key:
                    stop = at+1
                    while stop < len(body) and body[stop] not in (';', '{', '}'): stop += 1
                    values.append(body[at+1:stop])
            return values
        names = [x.strip('"\'') for row in directive('server_name') for x in row]
        listens = directive('listen'); proxies = []
        for at in range(len(body)-2):
            if body[at:at+3] != ['location', '/', '{']: continue
            level, stop = 1, at+3
            while stop < len(body) and level:
                level += (body[stop] == '{') - (body[stop] == '}'); stop += 1
            for cursor in range(at+3, stop-1):
                if body[cursor] == 'proxy_pass':
                    end_proxy = cursor+1
                    while end_proxy < stop-1 and body[end_proxy] != ';': end_proxy += 1
                    proxies.append(body[cursor+1:end_proxy])
        if 'passvero.eu' in names and any(any(re.fullmatch(r'(?:\[::\]:)?443', x) for x in row) for row in listens):
            if any(row in (['http://127.0.0.1:3000'], ['http://localhost:3000']) for row in proxies):
                return {'origin': 'https://passvero.eu/', 'upstream': 'LOOPBACK_3000_IN_SAME_TLS_SERVER_BLOCK'}
    raise RuntimeError('PRODUCTION_HTTP_MAPPING_NOT_REVIEWED_MATCH')


def http(origin, resolve_local=False):
    args = ['/usr/bin/curl', '--silent', '--max-time', '5', '--output', '/dev/null',
        '--write-out', '%{http_code} %{ssl_verify_result}', '--header', 'Accept-Language: hr',
        '--cookie', 'NEXT_LOCALE=hr']
    if resolve_local:
        require(origin == 'https://passvero.eu/', 'LOCAL_TLS_ORIGIN_SCOPE')
        args.extend(['--resolve', 'passvero.eu:443:127.0.0.1'])
    value = run(args + [origin], timeout=7)
    require(re.fullmatch(r'(?:200|30[1278]) 0', value), 'HTTPS_OR_TLS_NOT_READY')
    return value


def production():
    states = {name: unit(name) for name in PRODUCTION_UNITS}
    require(all(value['ActiveState'] == 'active' for value in states.values()), 'PRODUCTION_UNIT_NOT_ACTIVE')
    # nginx -T is configuration inspection only; capture everything privately.
    target = nginx_target(run(['/usr/sbin/nginx', '-T'], timeout=10))
    return {'units': states, 'pm2': production_pm2(), 'target': target,
            'https': http(target['origin']), 'localHttps': http(target['origin'], resolve_local=True)}


def production_job_window(deploy):
    timer = unit('passvero-postgres-backup.timer')
    require(timer['ActiveState'] == 'active' and timer['UnitFileState'] == 'enabled',
            'PRODUCTION_BACKUP_TIMER_BASELINE_UNKNOWN')
    next_due = deploy.timer_due('passvero-postgres-backup.timer')
    require(next_due - time.time() >= 2700, 'PRODUCTION_BACKUP_TERM_CONFLICT')
    return {'timer': timer, 'typedNextDueEpoch': next_due, 'changed': False}


def scanner_module():
    if BOOTSTRAP_SCANNER is not None: return BOOTSTRAP_SCANNER
    return load('reboot_exact_scanner', ROOT / 'recover-release-reviewed.py', SCANNER_PIN)


def readers(limit):
    helper = scanner_module(); host = helper.LinuxHost(ATTEMPT)
    deadline = time.monotonic() + limit; rows = []
    while time.monotonic() < deadline:
        row = host.reader()
        if row and (not rows or row['sequence'] != rows[-1]['sequence']):
            if rows and (row['sequence'] != rows[-1]['sequence'] + 1 or row['observedAt'] <= rows[-1]['observedAt']):
                rows = []
            rows.append(row)
            if len(rows) == 3: return rows
        time.sleep(1)
    return None


def verify_rollback(deploy):
    old_manifest = json.loads(read(deploy.ROOT / 'old-canonical.json'))
    require(sha(read(deploy.ROOT / 'old-canonical.json')) == deploy.OLD_CANONICAL
            and sha(read(deploy.ROOT / 'old-config.json')) == deploy.OLD_CONFIG, 'ROLLBACK_INPUT_CHANGED')
    for name, expected in old_manifest['files'].items():
        require(not P(name).is_absolute() and '..' not in P(name).parts, 'ROLLBACK_PATH_SCOPE')
        prior = (deploy.ROOT / ('previous-' + name)) if name.startswith(('.next/', 'messages/')) else APP / name
        require(sha(read(prior)) == expected['sha256'], 'RETAINED_ROLLBACK_ARTIFACT_CHANGED')
    return {'oldBuild': deploy.OLD_BUILD, 'files': len(old_manifest['files'])}


def prepare_info():
    base, scoped, deploy = components()
    require(datetime.datetime.now(datetime.timezone.utc).date() == datetime.date(2026, 10, 19)
            and time.time() < START, 'APPROVED_PREPARATION_DAY_OR_TIME_MISMATCH')
    release(deploy); idle(base, deploy)
    return {'preparation': 'PASS_READ_ONLY_REVIEW_BEFORE_INSTALL', 'production': production(),
            'rollback': verify_rollback(deploy), 'newScannerSha256': SCANNER_PIN,
            'release': BUILD, 'runtimeMutations': 'NONE', 'rebootScheduled': False}


def preflight():
    base, scoped, deploy = components()
    release(deploy); base.runtime(); info = base.backup(); drain_writer(); idle(base, deploy)
    require(time.time() <= START, 'REVIEW_NOT_COMPLETED_BEFORE_START')
    require(time.time() >= START - 240, 'FINAL_PREFLIGHT_TOO_EARLY_WAIT_REGULAR_MONITOR')
    deadlines = due(deploy, 2700)
    actor = scoped.actor(); rights = scoped.validate_actor(actor)
    require(actor['product']['draftId'] == 'a2e0ebe2-8305-4975-84f2-83b16d505536'
            and actor['product']['publishedId'] is None, 'APPROVED_EXISTING_DRAFT_DRIFT')
    require(sha(read(P('/home/passvero-staging/.pm2/dump.pm2'))) ==
            'a2812d4ca989d0de812465dff345d3983c48587be0cc58e0b6ede0721038e277', 'PM2_DUMP_DRIFT')
    require(sha(read(P('/etc/systemd/system/pm2-passvero-staging.service'))) ==
            '3468e23a282b5422279afa54567f185d7e17491ff08d7ec2147d24dcba745a34', 'STARTUP_UNIT_DRIFT')
    scanner_module().LinuxHost(ATTEMPT).guard()  # Pure guard; no recovery invocation.
    recovery_records = P('/var/lib/passvero-signature-trust/records/recovery')
    with locked(recovery_records / 'operator.lock'):
        for path in recovery_records.glob('*/state.json'):
            require(json.loads(read(path)).get('phase') in ('COMPLETE', 'ROLLED_BACK'),
                    'UNRESOLVED_SCANNER_ATTEMPT')
    require(not (P('/var/lib/passvero-signature-trust/records/recovery') / ATTEMPT).exists(), 'SCANNER_ATTEMPT_ALREADY_EXISTS')
    require(not (ROOT / 'preflight.json').exists() and not (ROOT / 'baseline.json').exists(), 'ONE_SERIES_ONLY')
    prod = production()
    prod_job = production_job_window(deploy)
    baseline = {name: unit(name) for name in TIMERS}
    require(all(v['ActiveState'] == 'active' and v['UnitFileState'] == 'enabled' for v in baseline.values()),
            'AUTOMATION_BASELINE_CHANGED')
    result = {'preflight': 'PASS_REVIEW_BEFORE_Q', 'observedEpoch': time.time(), 'backup': info,
              'actor': actor, 'actorRights': rights, 'timers': baseline, 'due': deadlines,
              'production': prod, 'productionJobWindow': prod_job, 'smtpEntryCalls': 0, 'rebootScheduled': False}
    require(time.time() < START, 'REVIEW_NOT_COMPLETED_BEFORE_START')
    record('preflight.json', result); return result


def quiesce():
    base, scoped, deploy = components(); inside_start_window()
    proof = data('preflight.json'); require(time.time() - proof['observedEpoch'] <= 300, 'PREFLIGHT_EXPIRED')
    require(not (ROOT / 'first-failure.json').exists(), 'UNRESOLVED_OPERATION_FAILURE')
    with locked(BACKUP / 'job.lock'):
        release(deploy); drain_writer(); idle(base, deploy); due_values = due(deploy, 2700)
        production_job_window(deploy)
        require(time.time() < END - 1500, 'INSUFFICIENT_WINDOW_AFTER_NATURAL_DRAIN')
        baseline = {name: unit(name) for name in TIMERS}
        require(baseline == proof['timers'], 'TIMER_BASELINE_DRIFT')
        state = read(BACKUP / 'state.json'); require(sha(state) == proof['backup']['sha256'], 'BACKUP_STATE_DRIFT')
        record('baseline.json', {'t0': time.time(), 'bootId': boot_id(), 'timers': baseline,
            'due': due_values, 'backupSha256': sha(state), 'delivery': delivery(base),
            'production': proof['production'], 'dumpSha256': sha(read(P('/home/passvero-staging/.pm2/dump.pm2')))})
        for name in (TIMERS[2], TIMERS[0], TIMERS[1]):
            run(['/usr/bin/systemctl', 'disable', '--now', name])
        idle(base, deploy, paused=True)
        require(delivery(base) == data('baseline.json')['delivery'], 'DELIVERY_RACE_DURING_PAUSE_STOP')
        require(all(unit(name)['ActiveState'] == 'inactive' and unit(name)['UnitFileState'] == 'disabled'
                    for name in TIMERS), 'PAUSE_NOT_PERSISTENT')
        record('quiesced.json', {'result': 'QUIESCED', 'smtpEntryCalls': 0, 'rebootRequested': False})
    return data('quiesced.json')


def unchanged():
    baseline = data('baseline.json')
    require(sha(read(BACKUP / 'state.json')) == baseline['backupSha256'], 'BACKUP_STATE_OR_HISTORY_CHANGED')
    return baseline


def reboot():
    base, scoped, deploy = components(); elapsed(120); require(time.time() < END, 'WINDOW_EXPIRED')
    require((ROOT / 'quiesced.json').exists(), 'Q_NOT_COMPLETE'); unchanged()
    require(not (ROOT / 'first-failure.json').exists(), 'UNRESOLVED_OPERATION_FAILURE')
    with locked(BACKUP / 'job.lock'):
        release(deploy); idle(base, deploy, paused=True)
        require(all(unit(name)['ActiveState'] == 'inactive' and unit(name)['UnitFileState'] == 'disabled'
                    for name in TIMERS), 'AUTOMATION_NOT_PAUSED')
        record('reboot-intent.json', {'previousBootId': boot_id(), 'requestedEpoch': time.time(),
                                    'automaticRetry': False, 'requests': 1})
        print(json.dumps({'result': 'ONE_MANUAL_REBOOT_REQUEST', 'requests': 1}), flush=True)
        run(['/usr/bin/systemctl', 'reboot'], timeout=10)
    return {'result': 'SSH_DISCONNECT_EXPECTED_NOT_ACCEPTANCE'}


def startup():
    base, scoped, deploy = components(); baseline = unchanged()
    require((ROOT / 'reboot-intent.json').exists() and boot_id() != baseline['bootId'], 'NEW_BOOT_NOT_PROVEN')
    record('startup-attempt.json', {'bootId': boot_id(), 'automaticRetry': False})
    deadline = baseline['t0'] + 300; last = 'STARTUP_NOT_READY'
    while time.time() < deadline:
        try:
            release(deploy); base.runtime()
            require(all(unit(name)['ActiveState'] == 'active' for name in STAGING_UNITS), 'STAGING_UNIT_NOT_ACTIVE')
            require(unit('pm2-passvero-staging.service')['UnitFileState'] == 'enabled', 'PM2_STARTUP_NOT_ENABLED')
            prod = production(); require(prod['pm2'] == baseline['production']['pm2'], 'PRODUCTION_PM2_SCOPE_CHANGED')
            require(prod['https'] == baseline['production']['https'] and
                    prod['localHttps'] == baseline['production']['localHttps'], 'PRODUCTION_HTTP_BASELINE_CHANGED')
            require(http('https://staging.passvero.eu/') == '200 0', 'STAGING_CANONICAL_NOT_READY')
            result = {'startup': 'PASS', 'AUTOMATIC_STARTUP': 'PASS', 'bootId': boot_id(), 'production': prod}
            record('startup-pass.json', result); return result
        except Exception as error:
            last = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
        time.sleep(2)
    record('startup-fail.json', {'AUTOMATIC_STARTUP': 'FAIL', 'reason': last})
    raise RuntimeError(last)


def ask(key, limit=1200):
    # Translate the existing wall-clock phase budget once; retries and partial
    # I/O must never extend the resulting monotonic deadline.
    remaining = min(END, data('baseline.json')['t0'] + limit) - time.time()
    require(remaining > 0, 'OPERATOR_OBSERVATION_TIMEOUT')
    deadline = time.monotonic() + remaining
    fd = os.open('/dev/tty', os.O_RDWR | os.O_NOCTTY | os.O_NONBLOCK)
    try:
        def wait(writing=False):
            while True:
                remaining = deadline - time.monotonic()
                require(remaining > 0, 'OPERATOR_OBSERVATION_TIMEOUT')
                try:
                    ready = select.select([] if writing else [fd], [fd] if writing else [], [], remaining)
                except InterruptedError:
                    continue
                require(ready[1] if writing else ready[0], 'OPERATOR_OBSERVATION_TIMEOUT')
                return

        prompt = (key + ' — type PASS only after actually observed: ').encode('utf-8')
        offset = 0
        while offset < len(prompt):
            wait(writing=True)
            try:
                written = os.write(fd, prompt[offset:])
            except (InterruptedError, BlockingIOError):
                continue
            require(written > 0, 'OPERATOR_TTY_WRITE_FAILED')
            offset += written
        answer = b''
        allowed = (b'PASS\n', b'PASS\r\n')
        while True:
            wait()
            try:
                chunk = os.read(fd, 256)
            except (InterruptedError, BlockingIOError):
                continue
            require(chunk, 'OPERATOR_OBSERVATION_EOF')
            require(time.monotonic() < deadline, 'OPERATOR_OBSERVATION_TIMEOUT')
            answer += chunk
            require(any(value.startswith(answer) for value in allowed), 'OPERATOR_OBSERVATION_NOT_PASS')
            if answer in allowed:
                break
    finally:
        os.close(fd)
    return {'result': 'PASS', 'source': 'OPERATOR_OBSERVATION', 'epoch': time.time()}


def auth_gate():
    base, scoped, deploy = components(); elapsed(600)
    require((ROOT / 'startup-pass.json').exists(), 'STARTUP_NOT_PASS')
    scoped.validate_actor(scoped.actor())
    record('auth-attempt.json', {'automaticRetry': False})
    result = {'newPasswordLogin': ask('New password login, no reset/verification email', limit=600),
              'organizationContext': ask('Exact approved organization, ADMIN membership, product/draft and entitlement/quota UI', limit=600)}
    elapsed(600); record('auth-pass.json', result); return result


def scanner_close():
    helper = scanner_module(); host = helper.LinuxHost(ATTEMPT)
    path = host.archive / 'state.json'
    if path.exists() and json.loads(read(path)).get('phase') == 'COMPLETE' and host.accepted():
        return {'scannerClosure': 'PASS_COMPLETE'}
    host.contain()
    return {'scannerClosure': 'FAIL_CLOSED_ARTIFACTS_RETAINED'}


def scanner():
    base, scoped, deploy = components(); elapsed(900); unchanged(); release(deploy)
    require((ROOT / 'auth-pass.json').exists(), 'AUTH_GATE_NOT_PASS')
    record('scanner-attempt.json', {'recoveryBudget': 1, 'automaticRetry': False})
    observed = readers(45)
    if observed:
        result = {'scanner': 'PASS_NATURAL_SCHEDULED_READER', 'recovery': 'NOT_REQUIRED', 'publications': observed}
    else:
        require(time.time() - data('baseline.json')['t0'] < 340, 'RECOVERY_REMAINING_BUDGET_TOO_SHORT')
        helper = scanner_module(); helper.LinuxHost(ATTEMPT).guard()
        args = ['/usr/bin/systemd-run', '--quiet', '--wait', '--unit', 'passvero-reboot-scanner-20261019',
            '--property=Type=exec', '--property=Restart=no', '--property=KillMode=control-group',
            '--property=KillSignal=SIGKILL', '--property=RuntimeMaxSec=9min', '--property=TimeoutStopSec=20s',
            '--property=UMask=0077', '--property=StandardOutput=append:' + str(ROOT / 'scanner-output.log'),
            '--property=StandardError=null',
            '--property=ExecStopPost=/usr/bin/python3 -I -B ' + str(ROOT / 'reboot-reviewed.py') + ' scanner-close',
            '/usr/bin/python3', '-I', '-B', str(ROOT / 'recover-release-reviewed.py'), 'recover', '--id', ATTEMPT]
        try:
            run(args, timeout=560)
        except Exception:
            phase, reason = 'UNKNOWN', 'SCANNER_UNIT_FAILED'
            journal = helper.LinuxHost(ATTEMPT).archive / 'state.json'
            if journal.exists(): phase = json.loads(read(journal)).get('phase', 'UNKNOWN').upper()
            output = ROOT / 'scanner-output.log'
            if output.exists():
                text = read(output).decode(); decoder = json.JSONDecoder()
                while text.strip():
                    text = text.lstrip()
                    try: value, end = decoder.raw_decode(text)
                    except ValueError: break
                    text = text[end:]
                    if value.get('recovery') == 'STOP' and re.fullmatch('[A-Za-z0-9_]{1,120}', value.get('reason', '')):
                        reason = value['reason']
            record('scanner-failure.json', {'CHECK_ID': 'SCANNER_' + phase, 'reason': reason, 'automaticRetry': False})
            raise RuntimeError(reason)
        finally:
            closure = scanner_close()
            require(closure['scannerClosure'] == 'PASS_COMPLETE', 'SCANNER_RECOVERY_FAILED_CLOSED')
        elapsed(900)
        result = {'scanner': 'PASS_ONE_RECOVERY', 'recovery': 'RECOVERED', 'publications':
                  json.loads(read(helper.LinuxHost(ATTEMPT).archive / 'scheduled.json'))}
    record('scanner-pass.json', result); return result


def flow_proof():
    base, scoped, deploy = components(); elapsed(1200); unchanged()
    require((ROOT / 'auth-pass.json').exists() and (ROOT / 'scanner-pass.json').exists(), 'AUTH_OR_SCANNER_NOT_PASS')
    record('flow-proof-attempt.json', {'automaticRetry': False})
    scoped.validate_actor(scoped.actor())
    rows = base.sql('''SELECT json_build_object(
      'product',(SELECT json_build_object('id',id,'draftId',"currentDraftVersionId",'publishedId',"currentPublishedVersionId",'publicCode',"publicCode") FROM "Product" WHERE id='c1c24c7c-334b-48bf-ba34-ac5fb930f1c2' AND "organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0'),
      'newImageAssets',(SELECT count(*) FROM "ProductImageAsset" WHERE "organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0' AND "createdAt">to_timestamp(%s)),
      'newDocuments',(SELECT count(*) FROM "Document" WHERE "organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0' AND "createdById"='40e51001-912c-4bcf-aa45-d866632aac85' AND "createdAt">to_timestamp(%s)),
      'images',(SELECT coalesce(json_agg(json_build_object('assetId',a.id,'versionId',im."productVersionId",'sha256',a."checksumSha256",'width',a.width,'height',a.height,'state',a.state,'policy',a."policyVersion",'createdEpoch',extract(epoch FROM a."createdAt"))), '[]'::json) FROM "ProductImage" im JOIN "ProductImageAsset" a ON a.id=im."assetId" JOIN "ProductVersion" v ON v.id=im."productVersionId" WHERE v."productId"='c1c24c7c-334b-48bf-ba34-ac5fb930f1c2'),
      'documents',(SELECT coalesce(json_agg(json_build_object('id',d.id,'versionId',pd."productVersionId",'public',pd."isPublic",'status',d.status,'scan',d."malwareScanStatus",'sha256',d."checksumSha256",'scanSha256',d."malwareScanSha256",'scanAttemptId',d."malwareScanAttemptId",'policy',d."malwarePolicyVersion",'createdEpoch',extract(epoch FROM d."createdAt"))), '[]'::json) FROM "ProductDocument" pd JOIN "Document" d ON d.id=pd."documentId" JOIN "ProductVersion" v ON v.id=pd."productVersionId" WHERE v."productId"='c1c24c7c-334b-48bf-ba34-ac5fb930f1c2'),
      'audit',(SELECT coalesce(json_agg(json_build_object('id',id,'action',action,'entityId',"entityId")), '[]'::json) FROM "AuditLog" WHERE "organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0' AND "actorId"='40e51001-912c-4bcf-aa45-d866632aac85' AND "occurredAt">to_timestamp(%s)))''' % ((data('baseline.json')['t0'],)*3))
    product = rows['product']; require(product and product['publishedId'] and product['draftId'] is None, 'PRODUCT_NOT_PUBLISHED')
    require(len(rows['images']) == len(rows['documents']) == 1, 'FIXTURE_IMAGE_PDF_SCOPE_NOT_EXACT')
    require(rows['newImageAssets'] == rows['newDocuments'] == 1, 'EXTRA_UPLOAD_ASSET_OR_DOCUMENT_CREATED')
    image, doc = rows['images'][0], rows['documents'][0]
    require(image['versionId'] == doc['versionId'] == product['publishedId'] and image['createdEpoch'] >= data('baseline.json')['t0']
            and doc['createdEpoch'] >= data('baseline.json')['t0'], 'FIXTURE_VERSION_OR_TIME_MISMATCH')
    require(image['width'] == 512 and image['height'] == 256 and image['state'] == 'READY'
            and image['policy'] == 1, 'IMAGE_NORMALIZATION_NOT_ACCEPTED')
    require(doc['sha256'] == doc['scanSha256'] == 'fb914f8e768c1d5708f3bb3e2cd0c18ffd43095b235e06d8920f4f8445c245ec'
            and doc['scan'] == 'CLEAN' and doc['policy'] == 2 and doc['public'] is True and doc['status'] == 'AVAILABLE', 'PDF_CLEAN_PUBLIC_BINDING_NOT_ACCEPTED')
    require(re.fullmatch(r'[A-Za-z0-9_-]{22}', product['publicCode']), 'PUBLIC_CODE_INVALID')
    require(http('https://staging.passvero.eu/p/' + product['publicCode']) == '200 0', 'PUBLIC_DPP_NOT_READY')
    observations = {key: ask(key) for key in ('Normalized image seen in authenticated product',
        'Authorized CLEAN PDF download SHA256 matched approved fixture', 'Published synthetic public DPP and image/PDF access without session')}
    require(delivery(base) == data('baseline.json')['delivery'], 'STAGING_DELIVERY_HISTORY_CHANGED')
    elapsed(1200); record('flow-pass.json', {'result': 'PASS', 'databaseProof': rows, 'observations': observations})
    return data('flow-pass.json')


def close():
    base, scoped, deploy = components()
    if not (ROOT / 'baseline.json').exists(): return {'closure': 'NOT_STARTED_NO_TIMER_CHANGE'}
    if (ROOT / 'closure.json').exists(): return data('closure.json')
    baseline = data('baseline.json'); restored = []; pending = {}
    state_same = sha(read(BACKUP / 'state.json')) == baseline['backupSha256']
    same_delivery = False
    try: same_delivery = delivery(base) == baseline['delivery']
    except Exception: pass  # DB outage must not prevent independent monitor closure.
    old = (ROOT / 'paired-rollback-pass.json').exists(); release_ok = False
    try: release(deploy, old=old); release_ok = True
    except Exception: pass
    config_ok = sha(read(CODE / 'config.json')) == (deploy.OLD_CONFIG if old else CONFIG_PIN)
    prod = {'result': 'NOT_READY'}
    try: prod = production()
    except Exception as error:
        prod['reason'] = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
    app_ready = False
    try:
        base.runtime(); app_ready = http('https://staging.passvero.eu/') == '200 0'
    except Exception: pass
    reader_ready = False
    try: reader_ready = scanner_module().LinuxHost(ATTEMPT).reader() is not None
    except Exception: pass
    complete_flow = (ROOT / 'flow-pass.json').exists()
    with locked(BACKUP / 'job.lock'):
        deploy.idle()
        require(unit('passvero-reboot-scanner-20261019.service')['ActiveState'] in ('inactive', 'failed'),
                'SCANNER_STILL_ACTIVE_CONTAIN_BEFORE_CLOSE')
        for name in TIMERS:
            safe = config_ok and ((name == TIMERS[1]) or (state_same and release_ok and app_ready
                   and (name == TIMERS[0] or (reader_ready and complete_flow and same_delivery and 'units' in prod))))
            if safe:
                # Disabled timers expose NextElapse=0. Use the saved typed calendar due,
                # then validate the actual due after enable; never trigger a job manually.
                if name in TIMERS[:2]:
                    if baseline['due'][name] - time.time() < 900:
                        pending[name] = 'SAVED_DUE_TOO_CLOSE_OR_ELAPSED_REVIEW_REQUIRED'
                        continue
                require(baseline['timers'][name]['UnitFileState'] == 'enabled', 'UNREVIEWED_TIMER_BASELINE')
                if name == TIMERS[2]: require(base.reminders()['safeToFinalizePause'], 'UNRESOLVED_SENDING_RESUME')
                run(['/usr/bin/systemctl', 'enable', '--now', name]); restored.append(name)
                require(unit(name)['ActiveState'] == 'active' and unit(name)['UnitFileState'] == 'enabled', 'TIMER_RESTORE_FAILED')
                if name in TIMERS[:2]: require(deploy.timer_due(name) == baseline['due'][name], 'NORMAL_DUE_CHANGED')
            else: pending[name] = 'APP_SCANNER_OR_FLOW_GATE_NOT_READY_OPERATOR_DARKO'
    # Do not compare delivery after reminder enable: ordinary approved sending can now resume.
    if not state_same: pending['backupState'] = 'STATE_CHANGED_REVIEW_REQUIRED'
    if not same_delivery: pending['delivery'] = 'NOT_PROVEN_UNCHANGED_SENDING_NOT_RESUMED'
    if 'units' not in prod: pending['production'] = 'STATUS_HTTP_NOT_READY_DARKO_INCIDENT'
    result = {'closure': 'PASS' if not pending else 'PARTIAL_AUTOMATION_RESTORE', 'restored': restored,
        'release': deploy.OLD_BUILD if old else BUILD,
        'pending': pending, 'backupStateUnchanged': state_same, 'verificationDeliveryUnchangedBeforeResume': same_delivery,
        'production': prod, 'operator': 'Darko Zivic', 'artifactsRetained': True,
        'automaticStartup': 'FAIL' if (ROOT / 'startup-fail.json').exists() else 'PASS' if (ROOT / 'startup-pass.json').exists() else 'NOT_PROVEN',
        'timerDue': {name: deploy.timer_due(name) for name in TIMERS[:2] if name in restored}}
    record('closure.json', result); return result


def manual_runtime():
    base, scoped, deploy = components(); unchanged()
    require((ROOT / 'startup-fail.json').exists(), 'NO_STARTUP_FAILURE_FOR_MANUAL_RECOVERY')
    record('manual-runtime-attempt.json', {'AUTOMATIC_STARTUP': 'FAIL', 'automaticRetry': False})
    run(['/usr/bin/systemctl', 'restart', 'pm2-passvero-staging.service'], timeout=35)
    base.runtime(); require(http('https://staging.passvero.eu/') == '200 0', 'MANUAL_RUNTIME_NOT_READY')
    return {'manualRuntime': 'FUNCTIONALLY_RECOVERED', 'AUTOMATIC_STARTUP': 'FAIL'}


def paired_rollback():
    base, scoped, deploy = components(); unchanged()
    require((ROOT / 'first-failure.json').exists(), 'NO_INCIDENT_FOR_ARTIFACT_ROLLBACK')
    require(sha(read(CANONICAL)) == CANONICAL_PIN and sha(read(CODE / 'config.json')) == CONFIG_PIN,
            'UNREVIEWED_RELEASE_METADATA_OR_PIN_CHANGE')
    fault = False
    try: release(deploy)
    except Exception: fault = True
    require(fault, 'NO_EXECUTABLE_ARTIFACT_FAULT_DO_NOT_ROLLBACK_FOR_PROVIDER_FAILURE')
    require(not (ROOT / 'paired-rollback-attempt.json').exists(), 'ONE_ARTIFACT_ROLLBACK_ONLY')
    require(all(unit(name)['ActiveState'] == 'inactive' for name in TIMERS), 'ROLLBACK_AUTOMATION_NOT_PAUSED')
    require(unit('passvero-subscription-reminders.service')['ActiveState'] == 'inactive', 'ROLLBACK_WRITER_NOT_IDLE')
    require(sha(read(deploy.ROOT / 'old-canonical.json')) == deploy.OLD_CANONICAL
            and sha(read(deploy.ROOT / 'old-config.json')) == deploy.OLD_CONFIG, 'ROLLBACK_INPUT_CHANGED')
    with locked(BACKUP / 'job.lock'):
        deploy.idle(); record('paired-rollback-attempt.json', {'automaticRetry': False})
        prepare, cap = deploy.helpers(json.loads(read(deploy.ROOT / 'old-config.json')))
        deploy.paired_rollback(prepare, cap)
        record('paired-rollback-pass.json', {'release': deploy.OLD_BUILD, 'result': 'PASS_PAIRED_RETAINED_ARTIFACTS'})
    return data('paired-rollback-pass.json')


def contain():
    unchanged(); result = {'containment': 'SENDING_AND_BACKUP_REMAIN_PAUSED', 'artifactsRetained': True}
    if unit('passvero-reboot-scanner-20261019.service')['ActiveState'] in ('active', 'activating', 'deactivating'):
        require((ROOT / 'scanner-attempt.json').exists(), 'UNREVIEWED_SCANNER_UNIT')
        run(['/usr/bin/systemctl', 'stop', 'passvero-reboot-scanner-20261019.service'], timeout=35)
    helper = scanner_module(); host = helper.LinuxHost(ATTEMPT)
    if (host.archive / 'state.json').exists():
        host.contain(); result['scanner'] = 'FAIL_CLOSED'
    return result


def main(mode=None):
    global CHECK_ID
    mode = mode or sys.argv[1]
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'HOST_IDENTITY_REQUIRED')
    os.umask(0o077)
    if mode != 'prepare-info':
        info = ROOT.lstat(); require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0
            and stat.S_IMODE(info.st_mode) == 0o700 and not ROOT.is_symlink(), 'OPERATION_ROOT_POSTURE')
    modes = {'prepare-info': prepare_info, 'preflight': preflight, 'quiesce': quiesce, 'reboot': reboot, 'startup': startup,
             'auth-gate': auth_gate, 'scanner': scanner, 'scanner-close': scanner_close,
             'flow-proof': flow_proof, 'close': close, 'contain': contain,
             'manual-runtime': manual_runtime, 'paired-rollback': paired_rollback}
    require(mode in modes, 'MODE_NOT_REVIEWED'); CHECK_ID = mode.upper().replace('-', '_')
    try:
        # ExecStopPost must not wait on the parent's operation lock.
        if mode in ('scanner-close', 'prepare-info'): result = modes[mode]()
        else:
            with locked(ROOT / 'operation.lock'): result = modes[mode]()
        print(json.dumps(result, indent=2, sort_keys=True)); return 0
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
        result = {'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False,
                  'instruction': 'Independent close/containment; no repeat/reboot/worker call'}
        if mode != 'prepare-info' and not (ROOT / 'first-failure.json').exists():
            try: record('first-failure.json', result)
            except FileExistsError: pass  # ExecStopPost may already have retained first failure.
        print(json.dumps(result, sort_keys=True)); return 1


if __name__ == '__main__':
    raise SystemExit(main())
