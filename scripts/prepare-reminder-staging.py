"""Local artifact packaging against the returned operator preflight; does not connect or deploy."""
import ast, hashlib, json, os, pathlib, subprocess, sys, tarfile
P=pathlib.Path
ROOT=P.cwd()
OUT=P(sys.argv[1]).resolve()
assert OUT.parent==P('/private/tmp') and not OUT.exists(),'NEW_TEMP_DIRECTORY_REQUIRED'
PREFLIGHT=P('codex/evidence/subscription-reminders/operator-preflight.json')
pre=json.loads(PREFLIGHT.read_text())
verification=json.loads(P('codex/evidence/subscription-reminders/local-verification.json').read_text())
assert pre['preflight']=='PASS' and pre['writes']=='NONE' and pre['emailSent'] is False
assert pre['database']=={'database':'passvero_acceptance','port':'5433','directory':'/var/lib/postgresql/16/acceptance'}
def digest(path):return hashlib.sha256(P(path).read_bytes()).hexdigest()
build=P('.next/BUILD_ID').read_text().strip()
assert verification['local']['webpackBuild']=={'result':'PASS','buildId':build},'VERIFIED_BUILD_REQUIRED'
# Verify all pre-existing application inputs still match the tested source manifest.
for line in P('codex/evidence/subscription-reminders/SOURCE_SHA256SUMS').read_text().splitlines():
    pin,name=line.split('  ',1)
    if name.startswith(('app/','src/','messages/','prisma/')):assert digest(name)==pin,'APPLICATION_SOURCE_DRIFT'
runtime={'.controlled-onboarding/review-access-requests.mjs':pre['retainedOperatorHash']}
for name,pin in pre['runtimeDependencies'].items():
    path='node_modules/'+name+'/package.json'; assert digest(path)==pin,'RUNTIME_DEPENDENCY_DRIFT'; runtime[path]=pin
# The existing staging metadata predates two build-bundled, dependency-free libraries.
# Accept only that exact historical pair and ensure neither needs an absent runtime package.
for name,key in [('package.json','packageHash'),('package-lock.json','lockHash')]:
    data=subprocess.check_output(['git','show','db9bbd49881586a88141759e75bf7be6e968429e:'+name])
    assert hashlib.sha256(data).hexdigest()==pre[key],'UNRECOGNIZED_RUNTIME_METADATA'
    before=json.loads(data); current=json.loads(P(name).read_text())
    deps=current['dependencies'] if name=='package.json' else current['packages']['']['dependencies']
    for library,version in [('bwip-js','4.11.4'),('csv-parse','7.0.2')]:
        assert deps.pop(library)==version,'BUNDLED_LIBRARY_DRIFT'
        if name=='package-lock.json':
            entry=current['packages'].pop('node_modules/'+library); assert entry['version']==version and not entry.get('dependencies'),'BUNDLED_DEPENDENCY_DRIFT'
    assert current==before,'UNREVIEWED_METADATA_DELTA'
traces=list(P('.next').rglob('*.nft.json')); assert traces,'BUILD_TRACES_REQUIRED'
for trace in traces:
    if 'cache' in trace.parts or 'dev' in trace.parts:continue
    assert not any('/node_modules/'+name+'/' in file for file in json.loads(trace.read_text())['files'] for name in ['bwip-js','csv-parse']),'MISSING_EXTERNAL_RUNTIME_LIBRARY'
OUT.mkdir(mode=0o700)
common=P('codex/evidence/subscription-entitlements/migrate.py').read_text().split('\ndef main(m):',1)[0].replace("R=P('/var/lib/passvero-subscription-entitlements')","R=P('/var/lib/passvero-subscription-reminders')")
(OUT/'common.py').write_text(common)
for name in ['install.py','rollback.py','launch.py','runtime-acl.sql','passvero-subscription-reminders.service','passvero-subscription-reminders.timer']:
    (OUT/name).write_bytes(P('scripts/subscription-reminders',name).read_bytes())
for file in OUT.glob('*.py'):ast.parse(file.read_text())
worker=OUT.parent/(OUT.name+'-worker')
subprocess.run(['node','scripts/prepare-reminder-worker.mjs',str(worker)],check=True,env={'PATH':os.environ['PATH']},capture_output=True)
(OUT/'worker.cjs').write_bytes((worker/'worker.cjs').read_bytes()); (OUT/'worker-source-manifest.json').write_bytes((worker/'manifest.json').read_bytes())
subprocess.run(['node','--check',str(OUT/'worker.cjs')],check=True,capture_output=True)
(OUT/'preflight.json').write_bytes(PREFLIGHT.read_bytes())
entries=sorted(P('prisma/migrations').glob('*/migration.sql')); latest='20260930200000_subscription_reminders'
assert entries[-1].parent.name==latest and len(entries)==31
def history(paths):return {'count':len(paths),'digest':hashlib.md5(','.join(p.parent.name+':'+digest(p) for p in paths).encode()).hexdigest(),'finished':True}
assert history(entries[:-1])==pre['migrations'],'LOCAL_BASELINE_MIGRATION_DRIFT'
paths=[P('prisma/schema.prisma'),P('prisma/migrations/migration_lock.toml'),*entries]
migration={'latest':latest,'files':{str(p.relative_to('prisma')):{'sha256':digest(p),'content':p.read_text()} for p in paths}}
(OUT/'migration-package.json').write_text(json.dumps(migration,indent=2)+'\n')
application={}
for directory in ['.next','messages']:
    for p in P(directory).rglob('*'):
        if p.parts[:2] in [('.next','cache'),('.next','dev')]:continue
        assert not p.is_symlink(),'ARTIFACT_SYMLINK'
        if p.is_file():application[str(p)]=digest(p)
with tarfile.open(OUT/'application.tar.gz','w:gz',format=tarfile.PAX_FORMAT) as tar:
    for name in sorted(application):tar.add(name,arcname=name,recursive=False)
manifest={'previous_build':pre['buildId'],'build_id':build,'runtime_package':pre['packageHash'],'runtime_lock':pre['lockHash'],'runtime_files':runtime,'prior_migrations':pre['migrations'],'after_migrations':history(entries),'application_files':application,'package_files':{p.name:digest(p) for p in sorted(OUT.iterdir()) if p.is_file()},'sendingEnabled':False,'fixturesCreated':False}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
archive=OUT.with_suffix('.tar.gz')
assert not archive.exists(),'ARCHIVE_EXISTS'
with tarfile.open(archive,'w:gz',format=tarfile.PAX_FORMAT) as tar:
    for p in sorted(OUT.iterdir()):tar.add(p,arcname=p.name,recursive=False)
print(json.dumps({'package':str(archive),'packageSha256':digest(archive),'manifestSha256':digest(OUT/'manifest.json'),'applicationFiles':len(application),'newBuild':build,'previousBuild':pre['buildId'],'emailSending':False,'timerEnabled':False},indent=2))
