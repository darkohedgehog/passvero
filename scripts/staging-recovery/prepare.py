"""Operator-only preparation. No pause, repo init/upload, restore or business writes."""
import datetime
import hashlib
import hmac
import json
import os
import pathlib
import pwd
import re
import resource
import shlex
import shutil
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

GIB = 1024 ** 3
ROOT = pathlib.Path('/var/lib/passvero-staging-recovery')
APP = pathlib.Path('/var/www/passvero-acceptance')
BUCKETS = ('passvero-staging-documents', 'passvero-staging-images')
PREFIX = 'passvero-staging-recovery-v1'
PIN = '5b6360633efb636f0aa9784b4e1a9d73aabe39a9c69f824cc99b9189407d7e75'
PHASE = 'BOOTSTRAP'


class Stop(Exception):
    pass


def require(condition, reason):
    if not condition:
        raise Stop(reason)


def protected(path):
    p = pathlib.Path(path)
    st = p.lstat()
    require(p.is_file() and not p.is_symlink() and st.st_uid == 0
            and not st.st_mode & 0o077, 'PROTECTED_INPUT_POSTURE')
    return p.read_bytes()


def store(path, value):
    with open(path, 'x', encoding='utf8') as handle:
        json.dump(value, handle, sort_keys=True, indent=2)
        handle.write('\n')
        handle.flush()
        os.fsync(handle.fileno())


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, timeout=30, **kwargs)
    require(result.returncode == 0, 'COMMAND_FAILED')
    return result.stdout


def account(name):
    a = pwd.getpwnam(name)
    return dict(user=a.pw_uid, group=a.pw_gid,
                extra_groups=os.getgrouplist(name, a.pw_gid), cwd='/')


def sql(query):
    return json.loads(run(['/usr/bin/psql', '-XqAt', '-h', '/var/run/postgresql',
                          '-p', '5433', '-d', 'passvero_acceptance',
                          '-v', 'ON_ERROR_STOP=1', '-c',
                          "BEGIN READ ONLY; SET LOCAL statement_timeout='8s'; "
                          + query + '; ROLLBACK;'],
                          **account('postgres'), env={'PATH': '/usr/bin:/bin', 'LANG': 'C'}))


def runtime():
    probe = "const a=require('/usr/lib/node_modules/pm2/modules/pm2-axon'),r=require('/usr/lib/node_modules/pm2/modules/pm2-axon-rpc'),s=a.socket('req'),c=new r.Client(s);setTimeout(()=>process.exit(2),5000);s.once('connect',()=>c.call('getMonitorData',{},(e,v)=>{if(e)process.exit(1);console.log(JSON.stringify(v.map(p=>({name:p.name,pid:p.pid,status:p.pm2_env.status,cwd:p.pm2_env.pm_cwd,pmId:p.pm2_env.pm_id}))));s.close();process.exit(0)}));s.connect('/home/passvero-staging/.pm2/rpc.sock');"
    rows = json.loads(run(['/usr/bin/node', '-e', probe], **account('passvero-staging'),
                          env={'PATH': '/usr/bin:/bin'}))
    require(len(rows) == 1 and rows[0]['name'] == 'passvero-acceptance'
            and rows[0]['status'] == 'online' and rows[0]['cwd'] == str(APP), 'APP_SCOPE')
    proc = pathlib.Path('/proc') / str(rows[0]['pid'])
    require(proc.stat().st_uid == pwd.getpwnam('passvero-staging').pw_uid
            and (proc / 'cwd').resolve() == APP, 'APP_PID_SCOPE')
    raw = dict(x.split(b'=', 1) for x in (proc / 'environ').read_bytes().split(b'\0') if b'=' in x)
    keys = ('PASSVERO_RUNTIME_ENV', 'BETTER_AUTH_URL', 'DATABASE_URL', 'AUTH_DATABASE_URL',
            'DOCUMENT_STORAGE_SUPABASE_URL', 'DOCUMENT_STORAGE_SUPABASE_KEY', 'DOCUMENT_STORAGE_BUCKET')
    env = {k: raw[k.encode()].decode() for k in keys}
    require(env['PASSVERO_RUNTIME_ENV'] == 'staging'
            and env['BETTER_AUTH_URL'] == 'https://staging.passvero.eu'
            and env['DOCUMENT_STORAGE_BUCKET'] == BUCKETS[0], 'RUNTIME_SCOPE')
    for key in ('DATABASE_URL', 'AUTH_DATABASE_URL'):
        uri = urllib.parse.urlsplit(env[key])
        require(uri.hostname in ('127.0.0.1', 'localhost') and uri.port == 5433
                and uri.path == '/passvero_acceptance', 'DATABASE_ENDPOINT_SCOPE')
    return rows[0], env


def destination(locator):
    require(locator.startswith('s3:'), 'DESTINATION_NOT_B2_S3')
    text = locator[3:]
    uri = urllib.parse.urlsplit(text if '://' in text else 'https://' + text)
    match = re.fullmatch(r's3\.([a-z0-9-]+)\.backblazeb2\.com', uri.hostname or '')
    require(uri.scheme == 'https' and match and not uri.username and not uri.password
            and not uri.query and not uri.fragment and uri.port in (None, 443), 'AMBIGUOUS_DESTINATION')
    parts = uri.path.strip('/').split('/')
    require(parts and re.fullmatch(r'[A-Za-z0-9-]{6,63}', parts[0]), 'BUCKET_IDENTITY')
    original = '/'.join(parts[1:])
    require(not original or (original != PREFIX and not original.startswith(PREFIX + '/')
                            and not PREFIX.startswith(original + '/')), 'NAMESPACE_OVERLAP')
    return uri.netloc, match[1], parts[0], 's3:https://' + uri.netloc + '/' + parts[0] + '/' + PREFIX


def credentials(text):
    values = {}
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith('#'):
            continue
        tokens = shlex.split(line, comments=True)
        if tokens and tokens[0] == 'export':
            tokens = tokens[1:]
        require(len(tokens) == 1 and '=' in tokens[0], 'CREDENTIAL_FILE_GRAMMAR')
        key, value = tokens[0].split('=', 1)
        if key in ('AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_DEFAULT_REGION', 'AWS_REGION'):
            require(value and not any(c in value for c in ('\n', '\r', '`', '$')), 'CREDENTIAL_FILE_GRAMMAR')
            values[key] = value
    require(values.get('AWS_ACCESS_KEY_ID') and values.get('AWS_SECRET_ACCESS_KEY'), 'EXISTING_S3_KEYS_MISSING')
    return values


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


HTTP = urllib.request.build_opener(NoRedirect())


def response(request):
    try:
        return HTTP.open(request, timeout=20)
    except urllib.error.HTTPError as error:
        suffix = ''
        try:
            code = ET.fromstring(error.read(8192)).findtext('{*}Code')
            if code in ('AccessDenied', 'SignatureDoesNotMatch', 'InvalidAccessKeyId',
                        'RequestTimeTooSkewed', 'ExpiredToken', 'AuthorizationHeaderMalformed'):
                suffix = '_' + code
        except Exception:
            pass
        raise Stop('REMOTE_HTTP_' + str(error.code) + suffix) from None


def s3_list_request(host, region, bucket, keys, now):
    stamp = now.strftime('%Y%m%dT%H%M%SZ')
    day = stamp[:8]
    path = '/' + bucket
    query = urllib.parse.urlencode(sorted({'list-type': '2', 'max-keys': '1000', 'prefix': PREFIX + '/'}.items()),
                                   quote_via=urllib.parse.quote, safe='-_.~')
    empty = hashlib.sha256(b'').hexdigest()
    names = 'host;x-amz-content-sha256;x-amz-date'
    headers = 'host:' + host + '\nx-amz-content-sha256:' + empty + '\nx-amz-date:' + stamp + '\n'
    canonical = 'GET\n' + path + '\n' + query + '\n' + headers + '\n' + names + '\n' + empty
    scope = day + '/' + region + '/s3/aws4_request'
    signing = 'AWS4-HMAC-SHA256\n' + stamp + '\n' + scope + '\n' + hashlib.sha256(canonical.encode()).hexdigest()
    key = ('AWS4' + keys['AWS_SECRET_ACCESS_KEY']).encode()
    for value in (day, region, 's3', 'aws4_request'):
        key = hmac.new(key, value.encode(), hashlib.sha256).digest()
    signature = hmac.new(key, signing.encode(), hashlib.sha256).hexdigest()
    authorization = 'AWS4-HMAC-SHA256 Credential=' + keys['AWS_ACCESS_KEY_ID'] + '/' + scope
    authorization += ', SignedHeaders=' + names + ', Signature=' + signature
    return urllib.request.Request('https://' + host + path + '?' + query, headers={
        'Authorization': authorization, 'x-amz-content-sha256': empty, 'x-amz-date': stamp, 'Host': host})


def restic(repo, keys, args):
    return run(['/usr/local/bin/restic', '--no-cache', '--no-lock', '--repo', repo, '--password-file',
                '/etc/passvero/backup/restic-password', *args],
               env={'PATH': '/usr/bin:/bin', **keys})


def storage_request(env, path, body=None):
    url = env['DOCUMENT_STORAGE_SUPABASE_URL']
    require(re.fullmatch(r'https://[a-z0-9]{20}\.supabase\.co', url), 'STORAGE_ORIGIN')
    key = env['DOCUMENT_STORAGE_SUPABASE_KEY']
    headers = {'apikey': key, 'cache-control': 'no-store'}
    if key.count('.') == 2:
        headers['authorization'] = 'Bearer ' + key
    else:
        require(re.fullmatch(r'sb_secret_[A-Za-z0-9_-]+', key), 'STORAGE_KEY_SHAPE')
    if body is not None:
        headers['content-type'] = 'application/json'
    return response(urllib.request.Request(url + '/storage/v1/' + path,
                    data=None if body is None else json.dumps(body).encode(), headers=headers))


def inventory(list_page):
    found = []
    queue = ['']
    seen = set()
    while queue:
        prefix = queue.pop()
        require(prefix not in seen and len(seen) < 10000, 'STORAGE_FOLDER_INVENTORY')
        seen.add(prefix)
        offset = 0
        while True:
            page = list_page(prefix, offset)
            require(isinstance(page, list) and len(page) <= 100, 'STORAGE_LIST_SHAPE')
            for item in page:
                name = item['name']
                require(isinstance(name, str) and name and name not in ('.', '..')
                        and '/' not in name and '\\' not in name and '\0' not in name, 'STORAGE_NAME')
                key = prefix + name
                if item.get('id') is None and item.get('metadata') is None:
                    queue.append(key + '/')
                else:
                    size = item['metadata']['size']
                    require(item.get('id') and isinstance(size, int) and not isinstance(size, bool)
                            and 0 <= size <= GIB, 'STORAGE_OBJECT_METADATA')
                    found.append({'key': key, 'id': item['id'], 'size': size,
                                  'updatedAt': item['updated_at'], 'createdAt': item.get('created_at'),
                                  'etag': item['metadata'].get('eTag'),
                                  'mimeType': item['metadata'].get('mimetype')})
                    require(len(found) <= 10000 and sum(x['size'] for x in found) <= GIB, 'STORAGE_SIZE_LIMIT')
            if len(page) < 100:
                break
            offset += len(page)
    require(len({x['key'] for x in found}) == len(found), 'STORAGE_DUPLICATE_KEY')
    return sorted(found, key=lambda x: x['key'])


def main():
    global PHASE
    os.umask(0o077)
    require(os.geteuid() == 0 and os.uname().nodename == 'srv1834647', 'OPERATOR_HOST')
    require(hashlib.sha256(pathlib.Path('/usr/local/sbin/passvero-postgres-backup').read_bytes()).hexdigest() == PIN, 'PRODUCTION_SOURCE_CHANGED')
    require(ROOT.is_dir() and not ROOT.is_symlink() and ROOT.stat().st_uid == 0
            and not ROOT.stat().st_mode & 0o077, 'PRIVATE_WORKROOT')
    identity = json.loads(protected(ROOT / 'operator.identity.json'))
    require(identity == {'schema': 1, 'scope': PREFIX}, 'WORKROOT_IDENTITY')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    work = ROOT / 'preparation' / stamp
    work.mkdir(parents=True, mode=0o700, exist_ok=False)
    PHASE = 'RUNTIME_AND_DATABASE'
    process, env = runtime()
    db = sql("SELECT json_build_object('port',current_setting('port'),'directory',current_setting('data_directory'),'name',current_database(),'bytes',pg_database_size(current_database()),'migrations',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),'enabledCampaigns',(SELECT count(*) FROM \"ReminderCampaign\" WHERE enabled))")
    require(db['port'] == '5433' and db['directory'] == '/var/lib/postgresql/16/acceptance'
            and db['name'] == 'passvero_acceptance' and db['migrations'] == 31
            and db['enabledCampaigns'] == 0, 'DATABASE_SCOPE')
    timer = run(['/usr/bin/systemctl', 'show', 'passvero-subscription-reminders.timer',
                 '--property=ActiveState,UnitFileState']).decode()
    require('ActiveState=inactive' in timer and 'UnitFileState=disabled' in timer, 'REMINDER_SCOPE')
    service = run(['/usr/bin/systemctl', 'show', 'passvero-postgres-backup.service', '--property=ActiveState']).decode()
    require('ActiveState=inactive' in service, 'PRODUCTION_INVOCATION_ACTIVE')
    require(shutil.disk_usage(ROOT).free >= 4 * GIB, 'FREE_SPACE_LIMIT')
    PHASE = 'B2_EXACT_PREFIX_READ_ONLY'
    locator = protected('/etc/passvero/backup/restic-repository').decode().strip()
    protected('/etc/passvero/backup/restic-password')
    keys = credentials(protected('/etc/passvero/backup/restic.env').decode())
    host, region, bucket, repo = destination(locator)
    with response(s3_list_request(host, region, bucket, keys, datetime.datetime.now(datetime.timezone.utc))) as result:
        xml = result.read(4 * 1024 ** 2 + 1)
        require(len(xml) <= 4 * 1024 ** 2, 'B2_RESPONSE_LIMIT')
    listing = ET.fromstring(xml)
    require(listing.tag.endswith('ListBucketResult') and listing.findtext('{*}Prefix') == PREFIX + '/', 'B2_LIST_IDENTITY')
    require(listing.findtext('{*}IsTruncated') in ('true', 'false'), 'B2_LIST_SHAPE')
    empty = listing.findtext('{*}IsTruncated') == 'false' and not listing.findall('{*}Contents')
    repository = {'exists': not empty, 'snapshotCount': 0}
    if not empty:
        config = json.loads(restic(repo, keys, ['cat', 'config']))
        snapshots = json.loads(restic(repo, keys, ['snapshots', '--json']))
        require(config.get('version') in (1, 2) and re.fullmatch('[a-f0-9]{64}', config.get('id', '')), 'EXISTING_REPOSITORY_FORMAT')
        require(snapshots and all(re.fullmatch('[a-f0-9]{64}', x.get('id', ''))
                and x.get('hostname') == 'passvero-staging-recovery'
                and 'passvero-staging-recovery' in x.get('tags', [])
                and x.get('paths') and all(p.startswith(str(ROOT / 'sets') + '/') for p in x['paths'])
                for x in snapshots), 'EXISTING_REPOSITORY_IDENTITY')
        repository.update(id=config['id'], snapshotCount=len(snapshots), candidates=[x['id'] for x in snapshots])
    production = json.loads(restic(locator, keys, ['snapshots', '--json']))
    require(production and all(x.get('hostname') == 'passvero-production'
            and 'passvero-postgresql' in x.get('tags', [])
            and re.fullmatch('[a-f0-9]{64}', x.get('id', '')) for x in production), 'PRODUCTION_REPOSITORY_IDENTITY')
    production_ids = sorted(x['id'] for x in production)
    PHASE = 'PRIVATE_STORAGE_PREPARATION'
    objects = []
    for bucket in BUCKETS:
        with storage_request(env, 'bucket/' + bucket) as result:
            info = json.loads(result.read(16385))
        require(info.get('id') == bucket and info.get('public') is False, 'PRIVATE_BUCKET_REQUIRED')
        def page(prefix, offset):
            with storage_request(env, 'object/list/' + bucket, {'prefix': prefix, 'limit': 100,
                                 'offset': offset, 'sortBy': {'column': 'name', 'order': 'asc'}}) as result:
                data = result.read(2 * 1024 ** 2 + 1)
                require(len(data) <= 2 * 1024 ** 2, 'STORAGE_PAGE_LIMIT')
                return json.loads(data)
        objects.extend(dict(x, bucket=bucket) for x in inventory(page))
    total = sum(x['size'] for x in objects)
    require(total <= GIB and db['bytes'] + total < GIB, 'PREPARATION_SIZE_LIMIT')
    output = work / 'objects'
    output.mkdir(mode=0o700)
    for item in objects:
        name = hashlib.sha256((item['bucket'] + '\0' + item['key']).encode()).hexdigest()
        digest = hashlib.sha256()
        size = 0
        with storage_request(env, 'object/authenticated/' + item['bucket'] + '/' + urllib.parse.quote(item['key'], safe='/')) as result, open(output / name, 'xb') as handle:
            while True:
                chunk = result.read(1024 * 1024)
                if not chunk:
                    break
                size += len(chunk)
                require(size <= item['size'], 'OBJECT_SIZE_CHANGED')
                handle.write(chunk)
                digest.update(chunk)
        require(size == item['size'], 'OBJECT_SIZE_CHANGED')
        item.update(file=name, sha256=digest.hexdigest())
    PHASE = 'DUMP_SIZE_MEASUREMENT'
    with open(work / 'measurement.dump', 'xb') as handle:
        result = subprocess.run(['/usr/bin/pg_dump', '-h', '/var/run/postgresql', '-p', '5433',
                                 '-U', 'postgres', '-d', 'passvero_acceptance', '-Fc', '--no-password'],
                                **account('postgres'), env={'PATH': '/usr/bin:/bin', 'LANG': 'C'},
                                stdout=handle, stderr=subprocess.PIPE, timeout=60,
                                preexec_fn=lambda: resource.setrlimit(resource.RLIMIT_FSIZE, (GIB - total, GIB - total)))
    require(result.returncode == 0, 'DUMP_MEASUREMENT_FAILED')
    dump_bytes = (work / 'measurement.dump').stat().st_size
    require(dump_bytes + total < GIB and shutil.disk_usage(ROOT).free >= 4 * GIB, 'SIZE_OR_SPACE_LIMIT')
    process_after, _ = runtime()
    require(process_after == process, 'RUNTIME_CHANGED_DURING_PREPARATION')
    state = {'schema': 1, 'setId': stamp, 'scope': PREFIX, 'database': db, 'process': process,
             'objects': objects, 'storageBytes': total, 'measurementDumpBytes': dump_bytes,
             'repository': repository, 'productionSnapshotIdsBefore': production_ids,
             'sourcePackageSha256': hashlib.sha256((APP / 'package.json').read_bytes()).hexdigest(),
             'sourceLockSha256': hashlib.sha256((APP / 'package-lock.json').read_bytes()).hexdigest(),
             'buildId': (APP / '.next/BUILD_ID').read_text().strip(), 'captureCompleted': False}
    store(work / 'prepared.json', state)
    print(json.dumps({'preparation': 'PASS', 'setId': stamp, 'staging': 'ONLINE_UNPAUSED',
                      'b2Prefix': PREFIX + '/', 'repositoryExists': repository['exists'],
                      'existingStagingSnapshots': repository['snapshotCount'], 'storageObjects': len(objects),
                      'storageBytes': total, 'measurementDumpBytes': dump_bytes,
                      'freeBytes': shutil.disk_usage(ROOT).free, 'consistentCapture': 'NOT_YET_RUN',
                      'writerClosureProof': 'REQUIRED_DURING_CAPTURE', 'remoteWrites': 0,
                      'smtpCalls': 0, 'telegramCalls': 0, 'retry': 'NO_AUTOMATIC_RETRY'}))


if __name__ == '__main__':
    try:
        main()
    except BaseException as error:
        reason = str(error) if isinstance(error, Stop) else type(error).__name__
        print(json.dumps({'preparation': 'STOP', 'phase': PHASE, 'reason': reason,
                          'stagingPauseRequested': False, 'remoteWrites': 0, 'smtpCalls': 0,
                          'telegramCalls': 0, 'retry': 'MANUAL_REVIEW_REQUIRED', 'artifactsRetained': True}))
        sys.exit(1)
