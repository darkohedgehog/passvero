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
INPUT = P('/tmp/passvero-marketing-ui-release-20261021')
OLD_BUILD = '_tkSUOn0PCoHjpx8V7FVr'
OLD_CANONICAL = 'e30e2afa0dc470b149f94f4437d032603a7cf7cfeb66fdc1a6b39b11fe52f590'
OLD_CONFIG = 'a79c6c856d5bb75fe17be7f47ec2e700250a6b9f3d916eed9dc08f76b328c839'
NEW_BUILD = 'RVDJVB4UmvCtP7UnxGKi2'
ARTIFACT = 'd8d63fb009d6c0db28ac02826e65be7dd7ff0c1c1f1008ff918c9a5d6247fe1f'
ARCHIVE = '866a4ddcf930c23202dd1e041af1ce60130b42315d970d6eb6c7a29e1e33dc0c'
CHECK_ID = 'HOST'
PUBLIC_ASSET_FILES = ('public/marketing/flags/LICENSE', 'public/marketing/flags/de.svg', 'public/marketing/flags/gb.svg', 'public/marketing/flags/hr.svg', 'public/marketing/flags/pl.svg', 'public/marketing/flags/rs.svg', 'public/marketing/flags/si.svg', 'public/marketing/passvero-logo.png')
OLD_LOGO = 'aa8ada632a5cc358731896f68d336e82cb27f318e367363c757c7c3fb713184d'


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
    require(artifact['buildId'] == NEW_BUILD and len(artifact['files']) == 847, 'NEW_RELEASE_CHANGED')
    # Exact accepted staging dependency baseline, distinct from local build inputs.
    require(digest(regular(APP / 'package.json')) ==
            'df4c1ac1b1d409c5db06c9614fc2a2cf8c5fe4fb4c6daa13f1ed3b88088ddd6e', 'STAGING_PACKAGE_CHANGED')
    require(digest(regular(APP / 'package-lock.json')) ==
            'f82a6356bd1201994d00d2032eabc7da5334de234bf36998b00c277e61f29b3c', 'STAGING_LOCK_CHANGED')
    runtime_metadata_pins = {'@better-auth/prisma-adapter': '14b03c83194fd21515d570dbba6ade8a4bb804627d0af3ed80197008aeffc2f8', '@prisma/adapter-pg': '4a6bb303e1d86f2b8c6ad1f57adac7c924b9ac0f8e1f7b086abe4268ea7e3474', '@prisma/client': 'a64669ec1b457f2651b3de564db6b9604e89460cb349641afffa73b0bbf3939a', 'better-auth': 'd4da1b89925564605ca6540a4f5030aab18de043322ca0b51f08b9ec52b1e092', 'next': 'c4ef8a1c8da320a162485f96d35df7745da90e6becc36882d6e81be9df66eec1', 'next-intl': '84f51dcebe80025dc9475fc260dc0e311a33a7af2e1a0a57e7617ca42f06cc69', 'nodemailer': '4ea1ee33f7582183473fe5c89215231534c90b3489da575347993505132dbb95', 'pg': 'e42dd36cba6e9dd8dbb6f773a2f7be8a8c3c273e18b155e42e75961a4cb8bc28', 'prisma': 'd98a88695435d693b66c27d9e8e1b083fc5e544890ce2bdfe755b9f90846e35b', 'qrcode': 'cbe26d7282c802f4ab9c1f790c5d8450d2b5c82e8bb5f67e3a5c2641ea347d1d', 'react': 'e60b92f6031f023907bbfab8f96e63e44307776ec1488f310ba61d41b8cda8cc', 'react-dom': 'b8448092689c7e6191595a98526ced808288f35138d97fbce5801a94922e3c36', 'server-only': 'e4b0cc01e2e0349c51c694fa97d8a642eb8322521ca1444b20bd1842594b4339', 'sharp': '27b5a6c6e1e1f27c527b09a963c932979403837d0f5f013ab5bdfb4a0ef2269a', 'zod': 'd6159aa80f102c2060b90ab0d968588c7fe6a8694df34152cd1f98a391ff8843'}
    for name, pin in runtime_metadata_pins.items():
        require(digest(regular(APP / 'node_modules' / name / 'package.json')) == pin,
                'INSTALLED_RUNTIME_DEPENDENCY_CHANGED')
    with tarfile.open(INPUT / 'application.tar.gz') as archive:
        members = archive.getmembers()
        require(len(members) == 847 and {item.name for item in members} == set(artifact['files']), 'ARCHIVE_INVENTORY')
        for item in members:
            require(item.isfile() and (item.name.startswith(('.next/', 'messages/')) or item.name in PUBLIC_ASSET_FILES)
                    and not P(item.name).is_absolute() and '..' not in P(item.name).parts, 'ARCHIVE_PATH_SCOPE')
            body = archive.extractfile(item).read()
            expected = artifact['files'][item.name]
            require(digest(body) == expected['sha256'] and len(body) == expected['bytes'], 'ARCHIVE_MEMBER_CHANGED')
        # Only the two evidenced absent packages are bundled; never waive external inputs.
        for item in members:
            if item.name.endswith('.nft.json'):
                traces = json.loads(archive.extractfile(item).read())['files']
                require(not any('bwip-js' in name or 'csv-parse' in name for name in traces),
                        'BUNDLED_DEPENDENCY_EXTERNAL_TRACE')
            if item.name.endswith('.js'):
                text = archive.extractfile(item).read().decode(errors='strict')
                require(not re.search(r'(?:require|import)\([\"\'](?:bwip-js|csv-parse)(?:/[^\"\']*)?[\"\']\)', text),
                        'BUNDLED_DEPENDENCY_EXTERNAL_IMPORT')
        require(b'bwipjs' in archive.extractfile('.next/server/chunks/6074.js').read(),
                'REVIEWED_BUNDLED_BARCODE_CODE_MISSING')
        require(b'CSV_QUOTE_NOT_CLOSED' in archive.extractfile('.next/server/app/api/products/import/route.js').read(),
                'REVIEWED_BUNDLED_CSV_CODE_MISSING')
        for locale in ('hr', 'sr', 'en', 'de', 'sl', 'pl'):
            name = 'messages/' + locale + '.json'
            require(json.loads(archive.extractfile(name).read())['Legal'] == json.loads(regular(APP / name))['Legal'],
                    'DEPLOYED_LEGAL_NAMESPACE_DIFFERS_STOP_REVIEW')
    require(digest(regular(APP / 'public/marketing/passvero-logo.png')) == OLD_LOGO, 'CURRENT_LOGO_CHANGED')
    require(not (APP / 'public/marketing/flags').exists() and not (APP / 'public/marketing/flags').is_symlink(), 'FLAG_TARGET_ALREADY_PRESENT')
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
    for name in ('public/marketing/hero-passport-restored.png', 'public/marketing/dashboard-preview-restored.png'):
        require(name in prior['files'] and name not in artifact['files']
                and updated['files'].get(name) == prior['files'][name], 'RETAINED_ILLUSTRATION_MANIFEST_CHANGED')
        require(digest(regular(APP / name)) == prior['files'][name]['sha256'], 'RETAINED_ILLUSTRATION_BYTES_CHANGED')
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
        'retainedCanonicalFiles': len(updated['files']) - 847, 'newArtifacts': 847,
        'currentRuntime': process, 'backupStateSha256': digest(state_bytes),
        'mode': state['mode'], 'hold': state['hold'], 'attempts': state['attempts'], 'units': units,
        'oldLogoSha256': OLD_LOGO, 'flagDirectory': 'ABSENT_CONFIRMED', 'legalNamespaces': 'UNCHANGED_FROM_DEPLOYED', 'mutations': 'NONE',
        'captureRestoreWorkerSmtpTelegramCalls': 0}, sort_keys=True, indent=2))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        print(json.dumps({'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}))
        raise SystemExit(1)
