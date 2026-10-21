"""One finite local proof: saved07 OS interpreters plus synthetic relevant launch lineage.
Loads only the two pure classification functions via AST. No operational harness,
/proc, network, terminal, subprocess, privilege or service calls.
"""
import ast
import json
from pathlib import Path

base = Path(__file__).resolve().parent
source = ast.parse((base / 'precise-owner-lock-release.py').read_text())
constants = {n.targets[0].id: n.value for n in source.body if isinstance(n, ast.Assign)
             and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name)}
scope = {'PRODUCER': Path('/usr/local/libexec/passvero-signature-health.cjs'),
         'CONFIG': Path('/etc/passvero-signature-health.json'),
         'SERVICE': ast.literal_eval(constants['SERVICE']),
         'REFERENCE_TOKENS': ast.literal_eval(constants['REFERENCE_TOKENS'])}
functions = [n for n in source.body if isinstance(n, ast.FunctionDef)
             and n.name in ('launch_reasons', 'classify_rows')]
assert len(functions) == 2
exec(compile(ast.Module(body=functions, type_ignores=[]), '<pure-classification-only>', 'exec'), scope)
recorded = json.loads((base / 'operator-07-current-process-identities.json').read_text())
rows = {}
for item in recorded['matches']:
    rows[item['pid']] = {'pid': item['pid'], 'ppid': item['ppid'], 'exe': item['executable'],
                        'args': [arg['argument'] for arg in item['safeArguments']],
                        'cgroup': '\n'.join(cg['path'] for cg in item['cgroups']),
                        'nodeExecutable': '/usr/bin/node'}
assert not scope['classify_rows'](rows, {})
# One composite fixture adds producer, descendant, unrelated interpreter and unknown reference.
rows.update({
    900100: {'pid': 900100, 'ppid': 1, 'exe': '/usr/bin/node', 'nodeExecutable': '/usr/bin/node',
             'args': ['/usr/bin/node', str(scope['PRODUCER']), '--config', str(scope['CONFIG'])], 'cgroup': ''},
    900101: {'pid': 900101, 'ppid': 900100, 'exe': '/usr/bin/helper', 'nodeExecutable': '/usr/bin/node',
             'args': ['/usr/bin/helper'], 'cgroup': ''},
    900102: {'pid': 900102, 'ppid': 1, 'exe': '/usr/bin/python3.12', 'nodeExecutable': '/usr/bin/node',
             'args': ['/usr/bin/python3', '<REDACTED>'], 'cgroup': '/system.slice/other.service'},
    900103: {'pid': 900103, 'ppid': 1, 'exe': '/usr/bin/node', 'nodeExecutable': '/usr/bin/node',
             'args': ['/usr/bin/node', '-e', "require('/usr/local/libexec/passvero-signature-health.cjs')"], 'cgroup': ''},
})
blocked = scope['classify_rows'](rows, {})
assert set(blocked) == {900100, 900101, 900103}
assert 'EXACT_PRODUCER_EXEC_ARGV' in blocked[900100]
assert blocked[900101] == ['DESCENDANT_OF_RELEVANT_LAUNCH']
assert 'EXACT_PRODUCER_EXEC_ARGV' not in blocked[900103]
assert scope['classify_rows'](rows, {900100: 'EXACT_COORDINATED_FIXTURE'}).get(900100) is None
print(json.dumps({'proof': 'ONE_LOCAL_CLASSIFICATION_FIXTURE', 'result': 'PASS',
                  'saved07GenericRootFalsePositiveRemoved': True,
                  'producerReferenceAndLineageFailClosed': True,
                  'perServiceAllowlist': False, 'liveSystemdProcSemantics': 'NOT_PROVEN',
                  'operationalHarnessExecuted': False, 'networkVpsAuthScannerCalls': 0}))
