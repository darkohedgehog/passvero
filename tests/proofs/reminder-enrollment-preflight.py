"""Pure endpoint guard proof: synthetic URLs only, no server, sudo or credentials."""
import importlib.util
import pathlib
import unittest

module_path = pathlib.Path('scripts/subscription-reminders/enrollment-preflight.py')
spec = importlib.util.spec_from_file_location('reminder_enrollment_preflight', module_path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class EndpointGuardProof(unittest.TestCase):
    def endpoints(self, host='127.0.0.1', port=5433, database='passvero_acceptance'):
        return {key: f'postgresql://{role}:synthetic-secret@{host}:{port}/{database}'.encode()
                for key, role in [(b'DATABASE_URL', 'passvero_app'), (b'AUTH_DATABASE_URL', 'passvero_auth')]}

    def test_staging_endpoint_matches_existing_resolver(self):
        observed = module.runtime_database_endpoints(self.endpoints())
        self.assertTrue(all(item['valid'] for item in observed.values()))
        self.assertEqual(observed['DATABASE_URL']['host'], '127.0.0.1')

    def test_production_and_hostname_alias_stay_rejected(self):
        for args in [('127.0.0.1', 5432, 'passvero'), ('localhost', 5433, 'passvero_acceptance')]:
            self.assertFalse(all(item['valid'] for item in module.runtime_database_endpoints(self.endpoints(*args)).values()))

    def test_diagnostics_never_contain_password_or_raw_url(self):
        for values in [self.endpoints(), {b'DATABASE_URL': b'not-a-url-synthetic-secret'}, {}]:
            text = str(module.runtime_database_endpoints(values))
            self.assertNotIn('synthetic-secret', text)
            self.assertNotIn('postgresql://', text)

if __name__ == '__main__':
    unittest.main()
