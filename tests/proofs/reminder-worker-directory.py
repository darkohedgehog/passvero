"""Installer permission regression under its actual restrictive umask; no privileged operations."""
import importlib.util, os, pathlib, stat, sys, tempfile, types, unittest
from unittest.mock import patch
sys.dont_write_bytecode=True
common=types.ModuleType('common')
for name in ['A','S','R','P','sha','regular','run','identity','sql','scope','pm','monitor','execute','copy_prisma_runtime']:
    setattr(common,name,pathlib.Path if name=='P' else lambda *a,**kw:None)
sys.modules['common']=common
spec=importlib.util.spec_from_file_location('reminder_installer','scripts/subscription-reminders/install.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
class DirectoryTest(unittest.TestCase):
    def test_runtime_can_traverse_worker_directory_under_umask_0077(self):
        with tempfile.TemporaryDirectory(prefix='reminder-directory-') as directory:
            worker=pathlib.Path(directory)/'worker'
            previous=os.umask(0o077)
            try:
                with patch.object(module,'WORKER',worker):module.create_worker_directory()
            finally:os.umask(previous)
            self.assertEqual(stat.S_IMODE(worker.stat().st_mode),0o755)
if __name__=='__main__':unittest.main()
