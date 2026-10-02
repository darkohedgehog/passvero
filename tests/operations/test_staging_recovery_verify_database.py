"""Exact reviewed catalog equivalence fixtures; no PostgreSQL or operational calls."""
import copy
import importlib.util
import json
import pathlib
import types
import unittest

ROOT=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('final_database',ROOT/'scripts/staging-recovery/verify_database.py')
V=importlib.util.module_from_spec(spec);spec.loader.exec_module(V)

class FinalDatabaseTests(unittest.TestCase):
    def fixture(self,acl_fault=False):
        rows=json.loads((ROOT/'codex/evidence/backup-recovery/operator-saved-constraint-definitions.json').read_text())['differences']
        left={'database':{},'constraints':[{'table':r['table'],'name':r['constraint'],'definition':r['sourceDefinition']} for r in rows],
              'relations':[{'name':'fixture_'+str(i),'kind':'r','owner':'passvero_migrator','acl':'{passvero_migrator=arwdDxt/passvero_migrator}','rls':False,'forceRls':False} for i in range(6)],
              'roles':[{'name':'passvero_migrator','login':True}],'functions':[]}
        right=copy.deepcopy(left)
        for i,r in enumerate(rows):right['constraints'][i]['definition']=r['restoredDefinition']
        for row in right['relations']:row['acl']=None
        acl=[{'grantor':'passvero_migrator','grantee':'passvero_migrator','privilege':p,'option':False}
             for p in ('INSERT','SELECT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER')]
        calls=[]
        def sql(query):
            calls.append(query)
            altered=copy.deepcopy(acl)
            if acl_fault:altered[0]['grantee']='PUBLIC'
            return {'source':acl,'restored':altered}
        def literal(value):return "'"+value.replace("'","''")+"'"
        return left,right,types.SimpleNamespace(sql=sql,literal=literal),calls
    def test_exact_reviewed_constraint_pairs_and_effective_acls_pass(self):
        a,b,r,calls=self.fixture();before=copy.deepcopy((a,b));result=V.verify_catalog(a,b,r)
        self.assertEqual(len(result['constraints']),6);self.assertEqual(len(result['relations']),6)
        self.assertEqual(len(calls),6);self.assertEqual((a,b),before)
        self.assertTrue(all('acldefault' in q and 'aclexplode' in q for q in calls))
    def test_all_full_constraint_definitions_match_pinned_signatures(self):
        rows=json.loads((ROOT/'codex/evidence/backup-recovery/operator-saved-constraint-definitions.json').read_text())['differences']
        for row in rows:
            self.assertEqual((V.signature(row['sourceDefinition']),V.signature(row['restoredDefinition'])),
                             V.REVIEWED_CONSTRAINTS[(row['table'],row['constraint'])])
    def test_changed_constraint_limit_is_rejected(self):
        a,b,r,_=self.fixture();b['constraints'][1]['definition']=b['constraints'][1]['definition'].replace('10000','10001')
        with self.assertRaisesRegex(RuntimeError,'UNREVIEWED_CONSTRAINT_DIFFERENCE'):V.verify_catalog(a,b,r)
    def test_new_constraint_or_missing_constraint_is_rejected(self):
        a,b,r,_=self.fixture();b['constraints'].pop()
        with self.assertRaisesRegex(RuntimeError,'CONSTRAINT_INVENTORY'):V.verify_catalog(a,b,r)
    def test_changed_constraint_name_is_rejected(self):
        a,b,r,_=self.fixture();b['constraints'][0]['name']='unknown'
        with self.assertRaises(RuntimeError):V.verify_catalog(a,b,r)
    def test_changed_owner_is_rejected(self):
        a,b,r,_=self.fixture();b['relations'][0]['owner']='postgres'
        with self.assertRaisesRegex(RuntimeError,'UNREVIEWED_RELATION_ACL_DIFFERENCE'):V.verify_catalog(a,b,r)
    def test_non_default_acl_is_rejected(self):
        a,b,r,_=self.fixture();b['relations'][0]['acl']='{PUBLIC=r/passvero_migrator}'
        with self.assertRaises(RuntimeError):V.verify_catalog(a,b,r)
    def test_effective_public_grant_is_rejected(self):
        a,b,r,_=self.fixture(acl_fault=True)
        with self.assertRaisesRegex(RuntimeError,'RESTORED_EFFECTIVE_TABLE_ACL'):V.verify_catalog(a,b,r)
    def test_changed_rls_is_rejected(self):
        a,b,r,_=self.fixture();b['relations'][0]['rls']=True
        with self.assertRaises(RuntimeError):V.verify_catalog(a,b,r)
    def test_changed_function_or_role_still_fails_strict_comparison(self):
        a,b,r,_=self.fixture();b['functions']=[{'name':'unreviewed'}]
        with self.assertRaisesRegex(RuntimeError,'RESTORED_CATALOG_UNREVIEWED_DIFFERENCE'):V.verify_catalog(a,b,r)
    def test_same_text_does_not_allow_reviewed_difference_count_to_be_bypassed(self):
        a,b,r,_=self.fixture();b['constraints']=copy.deepcopy(a['constraints'])
        with self.assertRaisesRegex(RuntimeError,'EXPECTED_REVIEWED_DIFFERENCE_COUNT'):V.verify_catalog(a,b,r)

if __name__=='__main__':unittest.main()
