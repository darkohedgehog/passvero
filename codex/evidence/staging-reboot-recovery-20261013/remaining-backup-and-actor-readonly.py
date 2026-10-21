"""Scoped completion only: backup closure/lock and approved actor metadata. No mutation."""
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

BACKUP = P("/var/lib/passvero-staging-recovery/recurring")

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

def sql(query):
    account = pwd.getpwnam('postgres')
    return json.loads(run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql',
        '-p', '5433', '-d', 'passvero_acceptance', '-v', 'ON_ERROR_STOP=1', '-c',
        "BEGIN READ ONLY; SET LOCAL statement_timeout='5s'; " + query + '; ROLLBACK;'],
        user=account.pw_uid, group=account.pw_gid, extra_groups=[], cwd='/', timeout=10))

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


def actor():
    return sql('''SELECT json_build_object(
      'users',(SELECT coalesce(json_agg(json_build_object('userId',u.id,
        'organizationId',m."organizationId",'membershipId',m.id,
        'membershipRole',m.role,'membershipStatus',m.status,'organizationStatus',o.status,
        'verified',a."emailVerified",'authEmailMatches',lower(a.email)='zivic.darko79@gmail.com',
        'hasPassword',EXISTS(SELECT 1 FROM "AuthProviderAccount" c WHERE c."userId"=a.id
          AND c."providerId"='credential' AND c.password IS NOT NULL))), '[]'::json)
        FROM "User" u LEFT JOIN "Membership" m ON m."userId"=u.id
          AND m."organizationId"='bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0'
        LEFT JOIN "Organization" o ON o.id=m."organizationId"
        LEFT JOIN "AuthIdentity" i ON i."userId"=u.id AND i.provider='BETTER_AUTH' AND i."revokedAt" IS NULL
        LEFT JOIN "AuthProviderUser" a ON a.id=i."providerSubject"
        WHERE lower(u.email)='zivic.darko79@gmail.com'),
      'product',(SELECT json_build_object('id',id,'organizationId',"organizationId",
        'lifecycle',"lifecycleStatus",'draftId',"currentDraftVersionId",'publishedId',"currentPublishedVersionId")
        FROM "Product" WHERE id='c1c24c7c-334b-48bf-ba34-ac5fb930f1c2'))''')


def validate_actor(value):
    users = value.get('users', [])
    require(len(users) == 1, 'ACTOR_IDENTITY_NOT_UNIQUE')
    user = users[0]
    require(user.get('userId') == '40e51001-912c-4bcf-aa45-d866632aac85', 'ACTOR_ID_MISMATCH')
    require(user.get('verified') is True and user.get('authEmailMatches') is True
            and user.get('hasPassword') is True, 'ACTOR_AUTH_NOT_READY')
    require(user.get('organizationId') == 'bdc5aed5-b05a-42e6-895b-9f2f9f8a79a0'
            and user.get('membershipStatus') == 'ACTIVE' and user.get('organizationStatus') == 'ACTIVE',
            'ACTOR_ORGANIZATION_MEMBERSHIP_NOT_ACTIVE')
    require(user.get('membershipRole') in ('OWNER', 'ADMIN'), 'ACTOR_ROLE_CANNOT_PUBLISH')
    product = value.get('product') or {}
    require(product.get('id') == 'c1c24c7c-334b-48bf-ba34-ac5fb930f1c2'
            and product.get('organizationId') == user['organizationId']
            and product.get('lifecycle') == 'ACTIVE', 'APPROVED_PRODUCT_SCOPE_MISMATCH')
    return {'rolePermissions': ['PRODUCT_READ', 'PRODUCT_EDIT', 'PRODUCT_PUBLISH'],
            'authority': 'ACTIVE_ORGANIZATION_MEMBERSHIP_NOT_PLATFORM_GRANT',
            'entitlementQuotaAndActualSession': 'APPLICATION_GATES_STILL_REQUIRED_BEFORE_UPLOAD_PUBLISH'}


def main():
    global DEADLINE
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'HOST_IDENTITY_REQUIRED')
    DEADLINE = time.monotonic() + 90
    result = {'result': 'STOP', 'mutations': 'NONE', 'automaticRetry': False,
              'executionUnlocked': False, 'sections': {}, 'failures': [],
              'window': {'requestedUTC': '2026-10-14T15:00:00Z/15:30:00Z',
                         'scheduledMonitorUTC': '2026-10-14T15:20:00Z',
                         'status': 'CONFLICT_WITH_EXISTING_45_MINUTE_WINDOW_GUARD'}}
    for name, action in (('backup', backup), ('jobs', jobs),
                         ('writer', lambda: {name: unit(name) for name in (
                             'passvero-subscription-reminders.timer', 'passvero-subscription-reminders.service')}),
                         ('actor', actor)):
        try:
            result['sections'][name] = action()
        except Exception as error:
            reason = str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__
            result['failures'].append({'CHECK_ID': name.upper(), 'reason': reason})
    if 'actor' in result['sections']:
        try:
            result['sections']['actorRights'] = validate_actor(result['sections']['actor'])
        except Exception as error:
            result['failures'].append({'CHECK_ID': 'ACTOR_RIGHTS', 'reason': str(error)
                if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__})
    if not result['failures']:
        result['result'] = 'PASS_SCOPED_PREPARATION_ONLY'
    print(json.dumps(result, indent=2, sort_keys=True))
    return 1 if result['failures'] else 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({'result': 'STOP', 'CHECK_ID': 'HOST_OR_COLLECTION',
            'reason': str(error) if re.fullmatch('[A-Z0-9_]{1,120}', str(error)) else type(error).__name__,
            'mutations': 'NONE', 'executionUnlocked': False, 'automaticRetry': False}))
        raise SystemExit(1)
