"""One bounded read-only diagnosis of local build versus staging dependency inputs."""
import hashlib
import json
import os
import pathlib
import re
import stat

P = pathlib.Path
APP = P('/var/www/passvero-acceptance')
INPUT = P('/tmp/passvero-marketing-pin-alignment-20261012')
CHECK_ID = 'READ_ONLY_DEPENDENCY_DIAGNOSIS'


def digest(body):
    return hashlib.sha256(body).hexdigest()


def read(path):
    info = path.lstat()
    assert stat.S_ISREG(info.st_mode) and not path.is_symlink(), 'INPUT_FILE_POSTURE'
    assert info.st_size < 16 * 1024 * 1024, 'INPUT_SIZE_LIMIT'
    return path.read_bytes()


def main():
    assert os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'WRONG_OPERATOR_HOST'
    expected_bytes = read(INPUT / 'dependency-expected.json')
    assert digest(expected_bytes) == 'ca2b29022dd9cedb1ea84e9ee915e686b7eea567dc0ac584515aad4d5df59fe9', 'EXPECTED_PROJECTION_CHANGED'
    expected = json.loads(expected_bytes)
    package_bytes = read(APP / 'package.json')
    lock_bytes = read(APP / 'package-lock.json')
    package = json.loads(package_bytes)
    lock = json.loads(lock_bytes)
    fields = {key: digest(json.dumps(value, sort_keys=True).encode()) for key, value in package.items()}
    changed_fields = sorted(key for key in set(fields) | set(expected['packageFields'])
                            if fields.get(key) != expected['packageFields'].get(key))
    actual_dependencies = package.get('dependencies', {})
    declared_diff_names = sorted(name for name in set(actual_dependencies) | set(expected['declaredDependencies'])
                                if actual_dependencies.get(name) != expected['declaredDependencies'].get(name))
    metadata = []
    for name, wanted in expected['runtimePackageMetadata'].items():
        assert re.fullmatch(r'(?:@[a-z0-9_-]+/)?[a-z0-9_.-]+', name), 'DEPENDENCY_NAME_SCOPE'
        path = APP / 'node_modules' / name / 'package.json'
        if not path.exists():
            metadata.append({'name': name, 'present': False, 'matchesReviewedLocalBuild': False})
            continue
        body = read(path)
        version = json.loads(body).get('version', '')
        assert re.fullmatch(r'[0-9A-Za-z.+_-]{1,80}', version), 'VERSION_GRAMMAR'
        metadata.append({'name': name, 'present': True, 'version': version, 'sha256': digest(body),
                         'matchesReviewedLocalBuild': version == wanted['version'] and digest(body) == wanted['sha256']})
    projection = {name: {key: value[key] for key in ('version', 'integrity', 'dependencies',
                    'optionalDependencies', 'peerDependencies', 'engines', 'os', 'cpu') if key in value}
                  for name, value in lock['packages'].items() if not value.get('dev')}
    lock_differences = []
    for name in sorted(set(projection) | set(expected['runtimeLockProjection'])):
        left = expected['runtimeLockProjection'].get(name)
        right = projection.get(name)
        if left == right:
            continue
        assert len(name) < 300 and (name == '' or re.fullmatch(r'node_modules/(?:[A-Za-z0-9_.@/-]+)', name)), 'LOCK_PATH_GRAMMAR'
        lock_differences.append({'path': name, 'localProjectionSha256': digest(json.dumps(left, sort_keys=True).encode()),
                                 'stagingProjectionSha256': digest(json.dumps(right, sort_keys=True).encode()),
                                 'changedKeys': sorted(key for key in set(left or {}) | set(right or {})
                                                       if (left or {}).get(key) != (right or {}).get(key))})
    assert len(lock_differences) <= 100, 'LOCK_DIFFERENCES_EXCEED_BOUNDED_REVIEW'
    config_path = P('/usr/local/libexec/passvero-staging-backup/config.json')
    config_bytes = read(config_path)
    config = json.loads(config_bytes)
    canonical_bytes = read(P('/var/lib/passvero-onboarding-deploy-2cb9d6e/application/manifest.json'))
    print(json.dumps({'diagnostic': 'READ_ONLY_DEPENDENCY_INPUT_COMPARISON',
        'packageSha256': digest(package_bytes), 'lockSha256': digest(lock_bytes),
        'packageMatchesBuildInput': digest(package_bytes) == expected['packageSha256'],
        'lockMatchesBuildInput': digest(lock_bytes) == expected['lockSha256'],
        'packageMatchesAcceptedStagingBaseline': digest(package_bytes) == expected['acceptedRuntimePackageSha256'],
        'lockMatchesAcceptedStagingBaseline': digest(lock_bytes) == expected['acceptedRuntimeLockSha256'],
        'changedPackageFields': changed_fields, 'changedDeclaredRuntimeDependencies': declared_diff_names,
        'installedRuntimePackageMetadata': metadata, 'runtimeLockProjectionDifferences': lock_differences,
        'configSha256': digest(config_bytes), 'canonicalSha256': digest(canonical_bytes),
        'buildId': read(APP / '.next/BUILD_ID').decode().strip(),
        'backupReleasePinsMatch': config['canonicalSha256'] == digest(canonical_bytes)
            and config['buildId'] == read(APP / '.next/BUILD_ID').decode().strip(),
        'mutations': 'NONE', 'deployRetry': False, 'captureRestoreWorkerSmtpTelegramCalls': 0}, sort_keys=True, indent=2))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if re.fullmatch('[A-Z0-9_]{1,160}', str(error)) else type(error).__name__
        print(json.dumps({'result': 'STOP', 'CHECK_ID': CHECK_ID, 'reason': reason, 'automaticRetry': False}))
        raise SystemExit(1)
