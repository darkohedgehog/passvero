"""Package locally verified enrollment artifacts against a read-only operator inventory."""
import ast, hashlib, json, os, pathlib, subprocess, sys, tarfile
P=pathlib.Path
assert len(sys.argv)==3, 'USAGE_OUTPUT_DIRECTORY_PRIVATE_PREFLIGHT_JSON'
OUT=P(sys.argv[1]).resolve(); PREFLIGHT=P(sys.argv[2]).resolve()
assert OUT.parent==P('/private/tmp') and not OUT.exists(), 'NEW_TEMP_DIRECTORY_REQUIRED'
pre=json.loads(PREFLIGHT.read_text())
assert pre['preflight']=='PASS' and pre['databaseWrites']==0 and not pre['workerExecuted'] and pre['emailsSent']==0
assert pre['scope']=={'database':'passvero_acceptance','port':'5433','directory':'/var/lib/postgresql/16/acceptance'}
def digest(path): return hashlib.sha256(P(path).read_bytes()).hexdigest()
source=json.loads(P('codex/evidence/reminder-future-enrollment/source-manifest.json').read_text())
build=P('.next/BUILD_ID').read_text().strip()
assert source['local']['build']=={'result':'PASS','engine':'webpack','buildId':build}, 'VERIFIED_BUILD_REQUIRED'
for name,pin in source['sources'].items():
    if name.startswith(('app/','src/','messages/','prisma/','scripts/subscription-reminder-worker')): assert digest(name)==pin, 'TESTED_SOURCE_DRIFT'
worker=P(source['preparedWorker']['path']); assert digest(worker)==source['preparedWorker']['sha256'], 'VERIFIED_WORKER_REQUIRED'
artifacts=json.loads((worker.parent/'application-artifact-manifest.json').read_text())
# This is the tested artifact inventory, not a new build.
application=artifacts['files'] if 'files' in artifacts else artifacts
application={name: value['sha256'] if isinstance(value,dict) else value for name,value in application.items()}
for name,pin in application.items(): assert digest(name)==pin, 'VERIFIED_ARTIFACT_DRIFT'
runtime={}
for name,pin in pre['runtimeDependencies'].items():
    path='node_modules/'+name+'/package.json'; assert digest(path)==pin, 'DEPENDENCY_DRIFT'; runtime[path]=pin
# Retain the reviewed staging metadata and dependency-free build-bundled additions.
for name,key in [('package.json','packageSha256'),('package-lock.json','lockSha256')]:
    data=subprocess.check_output(['git','show','db9bbd49881586a88141759e75bf7be6e968429e:'+name])
    assert hashlib.sha256(data).hexdigest()==pre[key], 'UNRECOGNIZED_RUNTIME_METADATA'
    before=json.loads(data); current=json.loads(P(name).read_text())
    deps=current['dependencies'] if name=='package.json' else current['packages']['']['dependencies']
    for library,version in [('bwip-js','4.11.4'),('csv-parse','7.0.2')]:
        assert deps.pop(library)==version, 'BUNDLED_LIBRARY_DRIFT'
        if name=='package-lock.json':
            entry=current['packages'].pop('node_modules/'+library); assert entry['version']==version and not entry.get('dependencies'), 'BUNDLED_DEPENDENCY_DRIFT'
    assert current==before, 'UNREVIEWED_METADATA_DELTA'
for trace in P('.next').rglob('*.nft.json'):
    if 'cache' in trace.parts or 'dev' in trace.parts: continue
    assert not any('/node_modules/'+name+'/' in file for file in json.loads(trace.read_text())['files'] for name in ['bwip-js','csv-parse']), 'MISSING_RUNTIME_LIBRARY'
entries=sorted(P('prisma/migrations').glob('*/migration.sql'))
assert len(entries)==33 and entries[-1].parent.name=='20261008120000_reminder_future_enrollment', 'MIGRATION_SCOPE'
def history(paths): return {'count':len(paths),'digest':hashlib.md5(','.join(p.parent.name+':'+digest(p) for p in paths).encode()).hexdigest(),'finished':True}
assert history(entries[:-1])==pre['inventory']['migrations'], 'BASE_MIGRATION_HISTORY_DRIFT'
OUT.mkdir(mode=0o700)
common=P('codex/evidence/subscription-entitlements/migrate.py').read_text().split('\ndef main(m):',1)[0].replace("R=P('/var/lib/passvero-subscription-entitlements')", "R=P('/var/lib/passvero-future-enrollment-20261008/state')")
common=common.replace("'automaticRollback':False","'automaticRollback':(R/'rollback-report.json').exists()")
(OUT/'common.py').write_text(common)
for name in ['enrollment-install.py','enrollment-preflight.py','launch.py','runtime-acl.sql']:
    (OUT/name).write_bytes(P('scripts/subscription-reminders',name).read_bytes())
for path in OUT.glob('*.py'): ast.parse(path.read_text())
(OUT/'worker.cjs').write_bytes(worker.read_bytes())
(OUT/'worker-source-manifest.json').write_bytes((worker.parent/'manifest.json').read_bytes())
(OUT/'preflight.json').write_bytes(PREFLIGHT.read_bytes())
paths=[P('prisma/schema.prisma'),P('prisma/migrations/migration_lock.toml'),*entries]
(OUT/'migration-package.json').write_text(json.dumps({'latest':entries[-1].parent.name,'files':{str(p.relative_to('prisma')):{'sha256':digest(p),'content':p.read_text()} for p in paths}},indent=2)+'\n')
with tarfile.open(OUT/'application.tar.gz','w:gz',format=tarfile.PAX_FORMAT) as archive:
    for name in sorted(application):
        assert name.startswith(('.next/','messages/')) and not P(name).is_symlink() and '..' not in P(name).parts
        archive.add(name,arcname=name,recursive=False)
manifest={'previous_build':pre['buildId'],'build_id':build,'runtime_package':pre['packageSha256'],'runtime_lock':pre['lockSha256'],'runtime_files':runtime,'prior_migrations':pre['inventory']['migrations'],'after_migrations':history(entries),'previous_worker':pre['workerSha256'],'previous_launch':pre['launcherSha256'],'previous_canonical':pre['canonicalSha256'],'application_files':application,'package_files':{p.name:digest(p) for p in sorted(OUT.iterdir())},'futureEnrollmentEnabled':False,'newRecipients':0,'fixturesCreated':False}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=OUT.with_suffix('.tar.gz'); assert not archive.exists(), 'ARCHIVE_ALREADY_EXISTS'
with tarfile.open(archive,'w:gz',format=tarfile.PAX_FORMAT) as tar:
    for path in sorted(OUT.iterdir()): tar.add(path,arcname=path.name,recursive=False)
print(json.dumps({'package':str(archive),'packageSha256':digest(archive),'manifestSha256':digest(OUT/'manifest.json'),'applicationFiles':len(application),'newBuild':build,'previousBuild':pre['buildId'],'futureEnrollmentEnabled':False},indent=2))
