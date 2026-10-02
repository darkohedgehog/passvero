"""Pre-pause DB/byte reconciliation; no app pause, provider writes or cleanup."""
import hashlib
import importlib.util
import json
import os
import pathlib
import sys

ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
SET_ID = '20261001T190516Z'
PREP_PIN = 'd519bf0f039996f3ac9838182ba28218f31055e42e5ba675d572336f67c5e473'
FIRST_RUN = '80365265-5090-4d8e-88c5-327897caed67'
SECOND_RUN = '150b0aaa-f3f4-4ed5-894e-7d66083c3a2e'
SECOND_DOCUMENT = 'fb953a8d-5f0b-4677-8330-fd3004533013'
SECOND_SHA = '98c913ee16f40bf9aeb51d3ec924d015a711cb8482b689fbb1987f6c6d9ff4b2'


def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def reconcile(objects, rows):
    indexed = {(x['bucket'], x['key']): x for x in objects}
    require(len(indexed) == len(objects), 'DUPLICATE_PREPARED_OBJECT')
    require(len({(x['bucket'], x['key']) for x in rows}) == len(rows), 'DUPLICATE_DB_REFERENCE')
    matched = set()
    tombstones = []
    first = 0
    second = 0
    for row in rows:
        require(row['provider'] == 'supabase' and row['bucket'] in
                ('passvero-staging-documents', 'passvero-staging-images'), 'REFERENCE_SCOPE')
        key = (row['bucket'], row['key'])
        if key in indexed:
            item = indexed[key]
            require(int(row['bytes']) == item['size'] and row['sha256'] == item['sha256'],
                    'DB_PREPARED_BYTES_MISMATCH')
            matched.add(key)
            continue
        require(row['kind'] == 'document' and row['state'] == 'ARCHIVED'
                and row['archived'] is True and row['same_actor'] is True
                and row['links'] == 0 and row['audits'] > 0
                and row['scan_state'] in ('UNSCANNED', 'CLEAN', 'INFECTED', 'ERROR'),
                'MISSING_RETAINED_ASSET')
        marker = row['acceptance_marker']
        if marker == 'acceptance:' + FIRST_RUN:
            first += 1
            require(first <= 3, 'ACCEPTED_CLEANUP_COUNT_CONFLICT')
        elif marker == 'acceptance:' + SECOND_RUN:
            require(row['id'] == SECOND_DOCUMENT and int(row['bytes']) == 750
                    and row['sha256'] == SECOND_SHA and row['scan_state'] == 'CLEAN'
                    and row['policy'] == 2, 'ACCEPTED_CLEANUP_IDENTITY_CONFLICT')
            second += 1
            require(second == 1, 'ACCEPTED_CLEANUP_COUNT_CONFLICT')
        else:
            raise RuntimeError('MISSING_UNEXPLAINED_ARCHIVED_ASSET')
        tombstones.append({'id': row['id'], 'reason': 'PRIOR_ACCEPTED_EXACT_CLEANUP',
                           'runId': marker.split(':', 1)[1], 'bytesNotRetained': int(row['bytes'])})
    return {'matchedReferences': len(matched), 'acceptedCleanupTombstones': tombstones,
            'unreferencedStoredObjects': len(indexed.keys() - matched)}


QUERY = '''SELECT json_build_object('references',(
 SELECT coalesce(json_agg(r ORDER BY kind,id),'[]'::json) FROM (
  SELECT 'document'::text AS kind,d.id::text AS id,d."storageProvider" AS provider,
   d."storageBucket" AS bucket,d."storageKey" AS key,d."sizeBytes"::text AS bytes,
   d."checksumSha256" AS sha256,d.status::text AS state,d."displayName" AS acceptance_marker,
   (d."archivedAt" IS NOT NULL) AS archived,
   (d."createdById"=d."archivedById" AND d."archivedById"=d."updatedById") AS same_actor,
   d."malwareScanStatus"::text AS scan_state,d."malwarePolicyVersion" AS policy,
   (SELECT count(*) FROM "ProductDocument" pd WHERE pd."documentId"=d.id) AS links,
   (SELECT count(*) FROM "AuditLog" a WHERE a."entityType"='DOCUMENT'
       AND a."entityId"=d.id::text AND a."organizationId"=d."organizationId") AS audits
  FROM "Document" d
  UNION ALL
  SELECT 'image',i.id::text,i."storageProvider",i."storageBucket",i."storageKey",
   i."sizeBytes"::text,i."checksumSha256",i.state,NULL,false,false,NULL,NULL,
   (SELECT count(*) FROM "ProductImage" pi WHERE pi."assetId"=i.id),0::bigint
  FROM "ProductImageAsset" i
 ) r), 'enabledCampaigns',(SELECT count(*) FROM "ReminderCampaign" WHERE enabled))'''


def main():
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    helper = ROOT / 'operator' / ('prepare-' + PREP_PIN + '.py')
    info = helper.lstat()
    require(helper.is_file() and not helper.is_symlink() and info.st_uid == 0
            and not info.st_mode & 0o077 and hashlib.sha256(helper.read_bytes()).hexdigest() == PREP_PIN,
            'PREPARATION_HELPER_IDENTITY')
    spec = importlib.util.spec_from_file_location('approved_prepare', helper)
    prepare = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(prepare)
    work = ROOT / 'preparation' / SET_ID
    state = json.loads(prepare.protected(work / 'prepared.json'))
    require(state['setId'] == SET_ID and state['scope'] == 'passvero-staging-recovery-v1'
            and state['captureCompleted'] is False, 'PREPARATION_IDENTITY')
    for item in state['objects']:
        name = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        require(item['file'] == name, 'LOCAL_OBJECT_PATH')
        data = prepare.protected(work / 'objects' / name)
        require(len(data) == item['size'] and hashlib.sha256(data).hexdigest() == item['sha256'],
                'LOCAL_OBJECT_BYTES_CHANGED')
    result = prepare.sql(QUERY)
    require(result['enabledCampaigns'] == 0, 'REMINDER_CAMPAIGN_SCOPE')
    reconciliation = reconcile(state['objects'], result['references'])
    prepare.store(work / 'reference-preflight.json', {
        'setId': SET_ID, 'references': result['references'], 'reconciliation': reconciliation,
        'evidenceLevel': 'PRE_PAUSE_READ_ONLY; RECHECK_IN_CONSISTENT_CAPTURE_REQUIRED'})
    print(json.dumps({'referencePreflight': 'PASS', 'setId': SET_ID,
        'databaseAssetReferences': len(result['references']),
        'matchedStoredReferences': reconciliation['matchedReferences'],
        'acceptedCleanupTombstones': len(reconciliation['acceptedCleanupTombstones']),
        'tombstoneBytesNotPresent': sum(x['bytesNotRetained'] for x in reconciliation['acceptedCleanupTombstones']),
        'unreferencedStoredObjects': reconciliation['unreferencedStoredObjects'],
        'consistentCapture': 'NOT_YET_RUN', 'stagingPauseRequested': False,
        'remoteWrites': 0, 'smtpCalls': 0, 'telegramCalls': 0}))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        print(json.dumps({'referencePreflight': 'STOP',
            'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__,
            'stagingPauseRequested': False, 'remoteWrites': 0, 'smtpCalls': 0,
            'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED', 'artifactsRetained': True}))
        sys.exit(1)
