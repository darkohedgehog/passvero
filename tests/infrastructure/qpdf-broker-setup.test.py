"""Local setup regression; fake cgroup files do not prove kernel migration."""
import pathlib
import runpy
import tempfile
import types
import unittest
from unittest.mock import patch

SCRIPT = pathlib.Path(__file__).parents[2] / 'scripts/document-scan-boundary/qpdf-broker-setup.py'
REAL_PATH = pathlib.Path

class Setup(unittest.TestCase):
    def exercise(self, occupied=False):
        with tempfile.TemporaryDirectory() as tmp:
            base = REAL_PATH(tmp)
            runtime = base / 'runtime'; runtime.mkdir()
            cgroup = base / 'cgroup'; cgroup.mkdir()
            (cgroup / 'cgroup.procs').write_text('')
            for name in ('adapter', 'parser'):
                child = cgroup / name; child.mkdir(mode=0o700)
                (child / 'cgroup.procs').write_text('123\n' if occupied else '')
                for field, value in [('memory.max', '268435456'), ('memory.swap.max', '0')]:
                    (child / field).write_text(value)
            original = {p: (p.read_bytes(), p.stat().st_mode) for p in cgroup.glob('*/memory.*')}
            def mapped(value):
                return runtime if value == '/run/passvero-qpdf' else cgroup
            original_stat = REAL_PATH.stat
            def root_stat(p, *args, **kwargs):
                s = original_stat(p, *args, **kwargs)
                return types.SimpleNamespace(st_uid=0, st_mode=s.st_mode)
            with patch('pathlib.Path', side_effect=mapped), patch.object(REAL_PATH, 'stat', root_stat), \
                 patch('os.geteuid', return_value=0), patch('os.chown') as chown, \
                 patch('pwd.getpwnam', return_value=types.SimpleNamespace(pw_uid=999,pw_gid=987)), \
                 patch('subprocess.run') as helper:
                if occupied:
                    with self.assertRaises(AssertionError):runpy.run_path(str(SCRIPT))
                    chown.assert_not_called()
                else:
                    runpy.run_path(str(SCRIPT))
                    chown.assert_called_once_with(cgroup/'cgroup.procs',999,987)
                helper.assert_called_once()
            if not occupied:
                for name in ('adapter','parser'):
                    self.assertEqual((cgroup/name).stat().st_mode & 0o777,0o711)
                self.assertEqual((cgroup/'cgroup.procs').stat().st_mode & 0o777,0o644)
            for p, expected in original.items():
                self.assertEqual((p.read_bytes(),p.stat().st_mode),expected)
    def test_umask_created_directories_and_minimal_delegation(self):self.exercise()
    def test_live_child_rejects_delegation_changes(self):self.exercise(occupied=True)

if __name__=='__main__':unittest.main()
