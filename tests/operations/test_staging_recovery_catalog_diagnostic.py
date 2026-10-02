"""Catalog difference fixtures only; no PG/systemd/Linux ACL execution."""
import ast
import hashlib
import importlib.util
import pathlib
import unittest

PATH=pathlib.Path(__file__).resolve().parents[2]/'scripts/staging-recovery/diagnose_catalog.py'
spec=importlib.util.spec_from_file_location('catalog_diagnostic',PATH)
D=importlib.util.module_from_spec(spec)
spec.loader.exec_module(D)

class CatalogDiagnosticTests(unittest.TestCase):
    def test_equal_catalog_has_no_differences(self):
        value={'roles':[{'name':'passvero_app','login':True}],'functions':[]}
        self.assertEqual(D.differences(value,value),[])
    def test_nested_owner_change_is_identified(self):
        left={'schemas':[{'owner':'passvero_migrator'}]};right={'schemas':[{'owner':'postgres'}]}
        result=D.summary(left,right)
        self.assertEqual(result[0]['field'],'/schemas/0/owner')
        self.assertEqual(result[0]['source'],'passvero_migrator')
        self.assertEqual(result[0]['restored'],'postgres')
    def test_acl_text_order_remains_a_difference_pending_operator_review(self):
        a={'acl':'{a=r/a,b=r/a}'};b={'acl':'{b=r/a,a=r/a}'}
        self.assertEqual(len(D.summary(a,b)),1)
        self.assertEqual(D.summary(a,b)[0]['field'],'/acl')
    def test_function_body_not_printed(self):
        rows=D.summary({'definition':'private function secret body'}, {'definition':'different secret body'})
        self.assertNotIn('source',rows[0]);self.assertNotIn('restored',rows[0])
        self.assertEqual(len(rows[0]['sourceSha256']),64)
        self.assertNotIn('secret',str(rows))
    def test_column_default_not_printed(self):
        rows=D.summary({'default':'sensitive SQL literal'}, {'default':'other literal'})
        self.assertNotIn('sensitive',str(rows));self.assertEqual(rows[0]['field'],'/default')
    def test_added_removed_entries_and_lengths_are_identified(self):
        rows=D.differences({'roles':['a'],'removed':True},{'roles':['a','b'],'new':False})
        self.assertEqual({path for path,a,b in rows},{'/new','/removed','/roles/length'})
    def test_type_change_is_not_coerced_to_equal(self):
        self.assertEqual(D.differences({'login':True},{'login':1}),[('/login',True,1)])
    def test_diagnostic_never_calls_restore_or_mutating_sql(self):
        tree=ast.parse(PATH.read_text())
        for node in ast.walk(tree):
            if isinstance(node,ast.Call) and isinstance(node.func,ast.Attribute) and node.func.attr=='sql':
                self.assertFalse(any(k.arg=='readonly' and isinstance(k.value,ast.Constant) and k.value.value is False for k in node.keywords))
        self.assertNotIn("'pg_restore'",PATH.read_text())
        self.assertIn('default_transaction_read_only=on',PATH.read_text())

if __name__=='__main__':unittest.main()
