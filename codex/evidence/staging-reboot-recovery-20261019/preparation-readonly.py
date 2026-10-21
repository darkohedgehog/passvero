"""New attempt orchestration of existing scoped readers; no service or state writes."""
OLD_ROOT = '/var/lib/passvero-reboot-recovery-20261014'
OLD_MANIFEST_SHA256 = '9d165f83cecc87aa5a3cee557d36fc2c95f043f13bd32d345b5a4cef06eda622'
OLD_HELPER_SHA256 = 'e345ff23ad8ec01b80fb35aea12ba4aa6f5cc39b691f7cc42ff270f6a1543ad1'


def prior_identity(h):
    root = h.P(OLD_ROOT)
    info = root.lstat()
    h.require(h.stat.S_ISDIR(info.st_mode) and not root.is_symlink() and info.st_uid == 0
              and h.stat.S_IMODE(info.st_mode) == 0o700, 'PRIOR_ROOT_POSTURE')
    manifest = h.read(root / 'package.json')
    helper = h.read(root / 'reboot-reviewed.py')
    h.require(h.sha(manifest) == OLD_MANIFEST_SHA256 and h.sha(helper) == OLD_HELPER_SHA256,
              'PRIOR_INSTALLED_IDENTITY_CHANGED')
    for name, pin in h.json.loads(manifest)['files'].items():
        h.require(name in ('reboot-reviewed.py', 'preflight.py', 'recover-release-reviewed.py',
                          'remaining-backup-and-actor-readonly.py'), 'PRIOR_PACKAGE_SCOPE')
        path = root / name; info = path.lstat()
        h.require(info.st_uid == 0 and not info.st_mode & 0o077 and h.sha(h.read(path)) == pin,
                  'PRIOR_INSTALLED_MEMBER_CHANGED')
    closure = h.json.loads(h.read(root / 'abort-writer-resume-pass.json'))
    h.require(closure['closure'] == 'PASS_ABORTED_BEFORE_REBOOT_BASELINE_RESTORED'
              and closure['rebootRequested'] is False, 'PRIOR_ATTEMPT_NOT_CLOSED')
    h.require(not (root / 'reboot-intent.json').exists(), 'PRIOR_REBOOT_INTENT_PRESENT')
    return {'root': str(root), 'helperSha256': h.sha(helper), 'manifestSha256': h.sha(manifest),
            'closure': closure['closure'], 'history': 'READ_ONLY_RETAINED'}


def collect(h):
    prior = prior_identity(h)
    h.require(not h.ROOT.exists() and not h.ROOT.is_symlink(), 'NEW_ATTEMPT_ROOT_ALREADY_EXISTS')
    base, scoped, deploy = h.components()
    h.drain_writer()  # Natural bounded drain only; never start/kill a worker.
    preparation = h.prepare_info()  # Existing exact release, production and rollback guards.
    runtime = base.runtime(); backup = base.backup()
    due = h.due(deploy, 0)
    h.require(due[h.TIMERS[0]] >= h.END + 900, 'CAPTURE_CONFLICT_WITH_APPROVED_WINDOW')
    monitor_due = due[h.TIMERS[1]]
    h.require(monitor_due <= h.START - 300 or monitor_due >= h.END + 900,
              'MONITOR_CONFLICT_WITH_APPROVED_WINDOW')
    production_job = h.production_job_window(deploy)
    actor = scoped.actor(); rights = scoped.validate_actor(actor)
    h.require(actor['product']['draftId'] == 'a2e0ebe2-8305-4975-84f2-83b16d505536'
              and actor['product']['publishedId'] is None, 'APPROVED_EXISTING_DRAFT_DRIFT')
    for path, pin in (
        ('/home/passvero-staging/.pm2/dump.pm2', 'a2812d4ca989d0de812465dff345d3983c48587be0cc58e0b6ede0721038e277'),
        ('/etc/systemd/system/pm2-passvero-staging.service', '3468e23a282b5422279afa54567f185d7e17491ff08d7ec2147d24dcba745a34')):
        h.require(h.sha(h.read(h.P(path))) == pin, 'STARTUP_BASELINE_DRIFT')
    h.scanner_module().LinuxHost(h.ATTEMPT).guard()
    records = h.P('/var/lib/passvero-signature-trust/records/recovery')
    with h.locked(records / 'operator.lock'):
        for path in records.glob('*/state.json'):
            h.require(h.json.loads(h.read(path)).get('phase') in ('COMPLETE', 'ROLLED_BACK'),
                      'UNRESOLVED_SCANNER_ATTEMPT')
    h.require(not (records / h.ATTEMPT).exists(), 'SCANNER_ATTEMPT_ALREADY_EXISTS')
    timers = {name: h.unit(name) for name in h.TIMERS}
    h.require(all(value['ActiveState'] == 'active' and value['UnitFileState'] == 'enabled'
                  for value in timers.values()), 'AUTOMATION_BASELINE_CHANGED')
    h.idle(base, deploy)  # Closing read rechecks jobs, sending and the corrected baseline guard.
    return {'preparation': 'PASS_NEW_ATTEMPT_READ_ONLY_REVIEW_BEFORE_INSTALL',
            'attemptId': h.ATTEMPT, 'observedEpoch': h.time.time(), 'priorInstalled': prior,
            'release': preparation['release'], 'newHelperSha256': h.sha(h.BOOTSTRAP_SOURCE),
            'scannerSha256': h.SCANNER_PIN, 'runtime': runtime, 'backup': backup,
            'actor': actor, 'actorRights': rights, 'production': preparation['production'],
            'rollback': preparation['rollback'], 'productionJobWindow': production_job,
            'timers': timers, 'due': due, 'writer': base.reminders(),
            'startupBaseline': 'MATCH_ACCEPTED_DUMP_AND_UNIT',
            'executionUnlocked': False, 'finalWindowGate': '02_AFTER_REGULAR_17_20_MONITOR',
            'runtimeMutations': 'NONE', 'rebootScheduled': False, 'automaticRetry': False}
