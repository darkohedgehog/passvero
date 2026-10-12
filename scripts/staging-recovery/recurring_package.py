"""Produce complete hash-pinned operator blocks locally; never contact a server."""
import base64
import hashlib
import json
import pathlib
import sys

REPO = pathlib.Path(__file__).resolve().parents[2]
CODE = '/usr/local/libexec/passvero-staging-backup'
ROOT = '/var/lib/passvero-staging-recovery'
OUTPUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path('/private/tmp/passvero-recurring-backup-20261009')
OUTPUT.mkdir(parents=True, exist_ok=True)
preflight = json.loads((REPO / 'codex/evidence/backup-recovery/operator-recurring-preflight-20261009.json').read_text())
provenance = json.loads((REPO / 'codex/evidence/backup-recovery/local-application-artifact-provenance.json').read_text())
helpers = {'prepare': 'prepare.py', 'capture': 'capture.py', 'references': 'reference_preflight.py',
           'offsite': 'offsite.py', 'restore-database': 'restore_database.py', 'verify-database': 'verify_database.py',
           'recurring_catalog': 'recurring_catalog.py'}
sha = lambda body: hashlib.sha256(body).hexdigest()
pins = {name: sha((REPO / 'scripts/staging-recovery' / source).read_bytes()) for name, source in helpers.items()}
# Confirm all reused installed helpers match the returned read-only evidence.
for name, pin in pins.items():
    if name not in ('offsite', 'recurring_catalog'):
        assert preflight['acceptedHelpers'][name + '-' + pin + '.py']['sha256'] == pin
modules = provenance['provenance']['applicationModules']
assert all(sha((REPO / name).read_bytes()) == pin for name, pin in modules.items())
config = {'approved': True, 'testTelegramApproved': False, 'repositoryId': preflight['repositoryId'],
          'canonicalSha256': preflight['canonicalSha256'], 'buildId': preflight['buildId'],
          'migrations': preflight['database']['migrations'], 'tables': preflight['database']['tables'],
          'helpers': pins, 'readerBuildSha256': provenance['provenance']['buildManifestSha256'],
          'readerModules': modules,
          'worker': {'launch.py': preflight['workerLauncher']['sha256'], 'worker.cjs': preflight['workerBundle']['sha256']}}
unitfiles = {
 'passvero-staging-backup.service': f'''[Unit]
Description=Passvero staging-only DB and private Storage backup
OnFailure=passvero-staging-backup-monitor.service
[Service]
Type=oneshot
User=root
UMask=0077
ExecCondition=/usr/bin/python3 -B {CODE}/recurring.py --eligible
ExecStart=/usr/bin/python3 -B {CODE}/recurring.py --scheduled
ExecStopPost=/usr/bin/python3 -B {CODE}/recurring.py --post
TimeoutStartSec=35min
TimeoutStopSec=35s
KillMode=control-group
KillSignal=SIGKILL
Restart=no
StandardOutput=null
StandardError=null
''',
 'passvero-staging-backup.timer': '''[Unit]
Description=Daily Passvero staging backup, no boot catch-up
[Timer]
OnCalendar=*-*-* 04:30:00 UTC
AccuracySec=1s
RandomizedDelaySec=0
Persistent=false
Unit=passvero-staging-backup.service
[Install]
WantedBy=timers.target
''',
 'passvero-staging-backup-monitor.service': f'''[Unit]
Description=Independent staging backup signals, existing protected Telegram destination
[Service]
Type=oneshot
User=root
UMask=0077
ExecStart=/usr/bin/python3 -B {CODE}/recurring.py --monitor
TimeoutStartSec=30s
Restart=no
StandardOutput=null
StandardError=null
''',
 'passvero-staging-backup-monitor.timer': '''[Unit]
Description=Hourly staging-only backup freshness
[Timer]
OnCalendar=*-*-* *:20:00 UTC
AccuracySec=1s
RandomizedDelaySec=0
Persistent=false
Unit=passvero-staging-backup-monitor.service
[Install]
WantedBy=timers.target
'''}
payload = {name: (REPO / 'scripts/staging-recovery' / name).read_bytes()
           for name in ('recurring.py', 'recurring_acceptance.py', 'recurring_catalog.py', 'offsite.py')}
payload['config.json'] = (json.dumps(config, sort_keys=True, indent=2) + '\n').encode()
for name, body in unitfiles.items():
    payload[name] = body.encode()
encoded = {name: {'sha256': sha(body), 'base64': base64.b64encode(body).decode()} for name, body in payload.items()}
installer = '''import base64,datetime,hashlib,importlib.util,json,os,pathlib,stat,subprocess
os.umask(0o077)
assert os.geteuid()==0 and os.uname().nodename=='srv1834647','OPERATOR_HOST'
root=pathlib.Path('/var/lib/passvero-staging-recovery')
code=pathlib.Path('/usr/local/libexec/passvero-staging-backup')
state=root/'recurring'
assert root.is_dir() and root.lstat().st_uid==0 and stat.S_IMODE(root.stat().st_mode)==0o700
assert not code.exists() and not code.is_symlink() and not state.exists(),'EXISTING_INSTALLATION_STOP'
# Preflight every destination/input before writing. No secret value is printed.
for name,item in PAYLOAD.items():
    assert hashlib.sha256(base64.b64decode(item['base64'])).hexdigest()==item['sha256']
    if name.endswith(('.service','.timer')):
        assert not (pathlib.Path('/etc/systemd/system')/name).exists(),'EXISTING_UNIT_STOP'
config=json.loads(base64.b64decode(PAYLOAD['config.json']['base64']))
for name,pin in config['helpers'].items():
    if name not in ('offsite','recurring_catalog'):
        path=root/'operator'/(name+'-'+pin+'.py')
        assert path.is_file() and not path.is_symlink() and path.lstat().st_uid==0 and not path.stat().st_mode&0o077
        assert hashlib.sha256(path.read_bytes()).hexdigest()==pin,'ACCEPTED_HELPER_CHANGED'
code.mkdir(mode=0o700);state.mkdir(mode=0o700)
for name,item in PAYLOAD.items():
    destination=(pathlib.Path('/etc/systemd/system') if name.endswith(('.service','.timer')) else code)/name
    fd=os.open(destination,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644 if name.endswith(('.service','.timer')) else 0o600)
    with os.fdopen(fd,'wb') as handle:handle.write(base64.b64decode(item['base64']));handle.flush();os.fsync(handle.fileno())
now=datetime.datetime.now(datetime.timezone.utc)
first=now.replace(hour=4,minute=30,second=0,microsecond=0)
if first<=now:first+=datetime.timedelta(days=1)
(state/'state.json').write_text(json.dumps({'mode':'ACCEPTANCE','attempts':0,'hold':False,'completed':[],
                                         'firstDueEpoch':int(first.timestamp())},sort_keys=True)+'\\n')
spec=importlib.util.spec_from_file_location('installed_recurring',code/'recurring.py')
adapter=importlib.util.module_from_spec(spec);spec.loader.exec_module(adapter)
policy,helpers=adapter.scope();adapter.runtime(policy,helpers)
# Service validation and enablement only after all runtime/repository pins validate.
repository=helpers['offsite'].Repository(helpers['prepare'])
assert json.loads(repository.run(['cat','config']))['id']==policy['repositoryId']
adapter.select_snapshots(repository.snapshots())
subprocess.run(['/usr/bin/systemd-analyze','verify',*[str(pathlib.Path('/etc/systemd/system')/name) for name in PAYLOAD if name.endswith(('.service','.timer'))]],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
subprocess.run(['/usr/bin/systemctl','daemon-reload'],check=True)
subprocess.run(['/usr/bin/systemctl','enable','--now','passvero-staging-backup.timer','passvero-staging-backup-monitor.timer'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
print(json.dumps({'installation':'PASS_ENABLED_ACCEPTANCE_BUDGET_TWO','firstDueUTC':first.isoformat(),
                  'secondDueUTC':(first+datetime.timedelta(days=1)).isoformat(),'testTelegram':'NOT_SENT_NOT_APPROVED',
                  'waitFor':'TWO_ORDINARY_DAILY_TIMER_INVOCATIONS','manualCapture':False}))
'''
installer = 'PAYLOAD=' + repr(encoded) + '\n' + installer
block = "# PENDING_OPERATOR_COMMAND — VPS TERMINAL A: only after combined approval\nsudo /usr/bin/python3 -B - <<'PASSVERO_STAGING_INSTALL'\n" + installer + 'PASSVERO_STAGING_INSTALL\n'
(OUTPUT / 'VPS-TERMINAL-A-INSTALL-ENABLE.sh').write_text(block)
results = '''# PENDING_OPERATOR_COMMAND — VPS TERMINAL RESULTS: read once after secondDueUTC
sudo /usr/bin/python3 -B - <<'PASSVERO_STAGING_RESULTS'
import json,pathlib,subprocess
root=pathlib.Path('/var/lib/passvero-staging-recovery');state=root/'recurring'
value=json.loads((state/'state.json').read_text())
output={'state':value}
for name in ('monitor-result.json','acceptance-first-failure.json','acceptance.json','retention.json','signal-proof.json'):
    path=state/name
    if path.is_file():output[name]=json.loads(path.read_text())
for row in value.get('completed',[]):
    set_id=row['setId'];assert len(set_id)==16 and set_id.endswith('Z')
    control=root/'control'/set_id
    output[set_id]={'timer':json.loads((control/'timer-invocation.json').read_text()),'closure':json.loads((control/'closure.json').read_text())}
output['units']=subprocess.run(['/usr/bin/systemctl','show','passvero-staging-backup.timer','passvero-staging-backup-monitor.timer','--property=Id,ActiveState,UnitFileState,LastTriggerUSec,NextElapseUSecRealtime'],check=True,capture_output=True,text=True).stdout
print(json.dumps(output,indent=2,sort_keys=True))
PASSVERO_STAGING_RESULTS
'''
(OUTPUT / 'VPS-TERMINAL-RESULTS.sh').write_text(results)
acceptance = f'''# PENDING_OPERATOR_COMMAND — VPS TERMINAL B–D: after returned A proof, same approval
sudo /usr/bin/python3 -B - <<'PASSVERO_STAGING_ACCEPTANCE'
import json,pathlib,subprocess
code=pathlib.Path('{CODE}');state=pathlib.Path('{ROOT}/recurring')
value=json.loads((state/'state.json').read_text())
assert value['attempts']==2 and len(value['completed'])==2 and not value['hold'],'A_REQUIRED'
set_id=value['completed'][-1]['setId']
helper=code/'recurring_acceptance.py'
# Independent post stops/verifies private cluster and restores parent ACLs even on death.
args=['/usr/bin/systemd-run','--quiet','--wait','--unit','passvero-stage-recurring-restore-'+set_id,
'--property=Type=exec','--property=Restart=no','--property=KillMode=control-group','--property=KillSignal=SIGKILL',
'--property=RuntimeMaxSec=15min','--property=TimeoutStopSec=35s',
'--property=StandardOutput=null','--property=StandardError=null',
'--property=ExecStopPost=/usr/bin/python3 -B '+str(helper)+' --close',
'/usr/bin/python3','-B',str(helper),'--restore']
subprocess.run(args,check=True,timeout=950)
for mode in ('--retention','--signals','--finalize'):
    subprocess.run(['/usr/bin/python3','-B',str(helper),mode],check=True,timeout=120)
print(json.dumps({{'acceptance':json.loads((state/'acceptance.json').read_text()),
                  'sets':value['completed'],
                  'restore':json.loads((pathlib.Path('{ROOT}/restore')/set_id/'summary.json').read_text()),
                  'restoreClosure':json.loads((pathlib.Path('{ROOT}/restore')/set_id/'closure.json').read_text()),
                  'retention':json.loads((state/'retention.json').read_text()),
                  'signals':json.loads((state/'signal-proof.json').read_text())}},indent=2,sort_keys=True))
PASSVERO_STAGING_ACCEPTANCE
'''
(OUTPUT / 'VPS-TERMINAL-B-D-ACCEPTANCE.sh').write_text(acceptance)
rollback = f'''# PENDING_OPERATOR_COMMAND — VPS TERMINAL DISABLE/ROLLBACK: pause new staging schedule
sudo /usr/bin/python3 -B - <<'PASSVERO_STAGING_DISABLE'
import importlib.util,json,pathlib,subprocess
code=pathlib.Path('{CODE}');state=pathlib.Path('{ROOT}/recurring')
# Stop only the new timers. Never terminate an active capture or SMTP worker.
subprocess.run(['/usr/bin/systemctl','disable','--now','passvero-staging-backup.timer','passvero-staging-backup-monitor.timer'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
spec=importlib.util.spec_from_file_location('rollback_adapter',code/'recurring.py')
r=importlib.util.module_from_spec(spec);spec.loader.exec_module(r)
value=r.read(state/'state.json');value['hold']=True;r.atomic(state/'state.json',value)
active=subprocess.run(['/usr/bin/systemctl','show','passvero-staging-backup.service','--property=ActiveState','--value'],check=True,capture_output=True,text=True).stdout.strip()
print(json.dumps({{'schedule':'DISABLED','monitor':'DISABLED','jobHold':True,'activeJob':active,
                  'activeJobPolicy':'ALLOW_FINISH_AND_INDEPENDENT_RESUME','setsAndEvidence':'RETAINED',
                  'productionAndReminderEnablementChanged':False,'filesRemoved':0}}))
PASSVERO_STAGING_DISABLE
'''
(OUTPUT / 'VPS-TERMINAL-DISABLE-ROLLBACK.sh').write_text(rollback)
(OUTPUT / 'reviewed-payload.json').write_text(json.dumps({'config': config, 'payloadHashes': {name:item['sha256'] for name,item in encoded.items()}},sort_keys=True,indent=2)+'\n')
print(json.dumps({'operatorBlocks':4,'output':str(OUTPUT),'payloadFiles':len(payload),'telegramTest':False}))
