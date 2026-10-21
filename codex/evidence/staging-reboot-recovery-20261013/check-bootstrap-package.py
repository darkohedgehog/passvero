"""Pure local validation of bootstrap package guards; no helper execution or VPS calls."""
import ast
import base64
import hashlib
import json
from pathlib import Path
import re
import zlib

ROOT = Path(__file__).resolve().parent

def require(condition, reason):
    if not condition:
        raise RuntimeError(reason)


def guard_rejects(guard, namespace):
    try:
        exec(guard, namespace)
    except RuntimeError as error:
        assert str(error) == 'PACKAGE_MEMBER_CHANGED'
    else:
        raise AssertionError('Changed package was accepted')


for path in sorted(ROOT.glob('VPS-TERMINAL-0[01]-*.sh')):
    shell = path.read_text()
    marker = re.search(r"<<'([^']+)'\n", shell)
    code = shell[marker.end():].split('\n' + marker[1], 1)[0]
    tree = ast.parse(code)
    literals = {}
    guard_node = None
    for node in ast.walk(tree):
        if isinstance(node, ast.Assign) and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            if name in ('packed', 'pins', 'package_bytes'):
                assert name not in literals
                literals[name] = ast.literal_eval(node.value)
        if isinstance(node, ast.For) and 'PACKAGE_MEMBER_CHANGED' in ast.get_source_segment(code, node):
            assert guard_node is None
            guard_node = node
    payloads = {name: base64.b64decode(body) for name, body in
                json.loads(zlib.decompress(base64.b64decode(literals['packed']))).items()}
    manifest = json.loads((ROOT / 'installed-package-manifest.json').read_text())
    assert set(payloads) == set(literals['pins']) == set(manifest['files'])
    assert literals['pins'] == manifest['files']
    for name, body in payloads.items():
        assert body == (ROOT / name).read_bytes()
    if 'package_bytes' in literals:
        assert literals['package_bytes'] == (ROOT / 'installed-package-manifest.json').read_bytes()
    guard = compile(ast.fix_missing_locations(ast.Module(body=[guard_node], type_ignores=[])), str(path), 'exec')
    namespace = {'require': require, 'hashlib': hashlib, 'payloads': payloads, 'pins': literals['pins']}
    exec(guard, namespace)
    changed_payload = dict(payloads)
    changed_payload['reboot-reviewed.py'] += b'\n# unreviewed change\n'
    guard_rejects(guard, {**namespace, 'payloads': changed_payload})
    stale_pins = dict(literals['pins'])
    stale_pins['reboot-reviewed.py'] = '1c00c41ec6c641cd3900464052be70f5cdddd99f8e73dd7ec3e5062e8ec8ea91'
    guard_rejects(guard, {**namespace, 'pins': stale_pins})
    print(path.name + ': PASS_EXACT_PAYLOAD_MANIFEST_AND_TWO_NEGATIVE_GUARDS')
