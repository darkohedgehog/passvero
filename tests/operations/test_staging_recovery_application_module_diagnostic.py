"""Source-hash diagnostic fixtures; no operators, network or git execution."""
import contextlib
import io
import json
import types
from unittest.mock import patch
import hashlib
import importlib.util
import pathlib
import tempfile
import unittest

BASE=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('application_diagnostic',BASE/'scripts/staging-recovery/diagnose_application_modules.py')
D=importlib.util.module_from_spec(spec);spec.loader.exec_module(D)

class ModuleDiagnosticTests(unittest.TestCase):
    def fixture(self,change=None):
        with tempfile.TemporaryDirectory() as directory:
            app=pathlib.Path(directory);body=b'export const read = true;\n';names=[f'src/application/module{i}.ts' for i in range(11)]
            build={'applicationModules':{name:hashlib.sha256(body).hexdigest() for name in names}}
            for name in names:
                path=app/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(body)
            target=app/names[0]
            if change=='crlf':target.write_bytes(body.replace(b'\n',b'\r\n'))
            if change=='code':target.write_bytes(b'export const read = false;\n')
            if change=='symlink':target.unlink();target.symlink_to(app/names[1])
            if change=='missing':target.unlink()
            rows=D.inspect_modules(build,app,lambda name:body)
            self.assertEqual(len(rows),11)
            self.assertNotIn('export const',str(rows))
            self.assertEqual(sum(not row['matchesReviewedBundle'] for row in rows),0 if change is None else 1)
            if change in ('crlf','code'):self.assertEqual(rows[0]['lfWithoutBomMatchesReviewed'],change=='crlf')
            if change=='missing':self.assertEqual(rows[0]['state'],'MISSING')
            if change=='symlink':self.assertEqual(rows[0]['state'],'SYMLINK')
    def test_exact_sources(self):self.fixture()
    def test_line_ending_difference_identified_without_ignoring_it(self):self.fixture('crlf')
    def test_changed_code_remains_mismatch(self):self.fixture('code')
    def test_symlink_not_read(self):self.fixture('symlink')
    def test_missing_source_does_not_hide_other_ten_sources(self):self.fixture('missing')
    def test_missing_installed_evidence_still_reports_all_paths(self):
        with tempfile.TemporaryDirectory() as directory:
            root=pathlib.Path(directory)
            with patch.object(D,'ROOT',root),patch.object(D,'APP',root/'app'),patch.object(D.os,'geteuid',return_value=0),\
                patch.object(D.os,'uname',return_value=types.SimpleNamespace(nodename='srv1834647')),\
                patch.object(D.subprocess,'run',side_effect=FileNotFoundError),contextlib.redirect_stdout(io.StringIO()) as out:
                D.main()
            result=json.loads(out.getvalue())
            self.assertEqual(result['missingModules'],11)
            self.assertEqual(result['requiredEvidence']['build']['state'],'MISSING')
            self.assertEqual(result['requiredEvidence']['helper']['state'],'MISSING')
            self.assertEqual(result['requiredEvidence']['closure']['state'],'MISSING')
            self.assertEqual(result['writes'],'NONE')
            self.assertFalse(result['clusterStarted'])
    def test_unsafe_private_evidence_not_read(self):
        with tempfile.TemporaryDirectory() as directory:
            file=pathlib.Path(directory)/'evidence';file.write_text('sensitive');file.chmod(0o644)
            row,body=D.inventory(file,private=True)
            self.assertEqual(row['state'],'UNSAFE_PRIVATE_POSTURE')
            self.assertIsNone(body)

if __name__=='__main__':unittest.main()
