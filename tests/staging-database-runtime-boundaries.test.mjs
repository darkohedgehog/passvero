import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const runtimePath = './src/infrastructure/config/runtime-database-config.ts';
const script = `
  const assert = require('node:assert/strict');
  const {getRuntimeDatabaseConfig} = require('${runtimePath}');
  for (const role of ['business', 'auth']) {
    assert.throws(() => getRuntimeDatabaseConfig(role), /runtime environment/);
  }
  process.env.PASSVERO_RUNTIME_ENV = 'staging';
  process.env.NODE_ENV = 'production';
  const business = 'postgresql://passvero_app:business-fixture@127.0.0.1:5433/passvero_acceptance';
  const auth = 'postgresql://passvero_auth:auth-fixture@127.0.0.1:5433/passvero_acceptance';
  process.env.DATABASE_URL = business;
  process.env.AUTH_DATABASE_URL = auth;
  assert.equal(getRuntimeDatabaseConfig('business').connectionString, business);
  assert.equal(getRuntimeDatabaseConfig('auth').connectionString, auth);
  for (const field of ['DATABASE_URL','AUTH_DATABASE_URL']) {
    const original = process.env[field];
    for (const value of ['', original.replace('127.0.0.1','db.example'), original.replace(':5433',':5432'),
      original.replace('/passvero_acceptance','/passvero')]) {
      process.env[field] = value;
      for (const role of ['business','auth']) assert.throws(() => getRuntimeDatabaseConfig(role));
    }
    process.env[field] = original;
  }
  process.env.PASSVERO_RUNTIME_ENV = 'production';
  for (const role of ['business','auth']) assert.throws(() => getRuntimeDatabaseConfig(role));
  process.env.DATABASE_URL = business.replace(':5433',':5432').replace('/passvero_acceptance','/passvero');
  process.env.AUTH_DATABASE_URL = '';
  assert.equal(getRuntimeDatabaseConfig('business').connectionString, process.env.DATABASE_URL);
  assert.throws(() => getRuntimeDatabaseConfig('auth'));
`;

test('runtime validates both staging URLs before returning either config, independently of NODE_ENV', () => {
  const result = spawnSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '-e', script], {
    encoding: 'utf8', env: { ...process.env, PASSVERO_RUNTIME_ENV: '', DATABASE_URL: '', AUTH_DATABASE_URL: '', TEST_DATABASE_URL: '' },
  });
  assert.equal(result.status, 0, result.stderr);
});

test('runtime DB environment accessor cannot be imported outside a server component environment', () => {
  const result = spawnSync(process.execPath, ['--import','tsx','-e', `require('${runtimePath}')`], { encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /cannot be imported from a Client Component/);
});

test('both pool compositions obtain their configuration through the shared runtime boundary', () => {
  for (const [file, role] of [
    ['src/infrastructure/auth/better-auth-server.ts','auth'],
    ['src/infrastructure/persistence/prisma/production-prisma-runtime.ts','business'],
  ]) {
    const source = readFileSync(file,'utf8');
    assert.ok(source.includes(`getRuntimeDatabaseConfig("${role}")`));
    assert.doesNotMatch(source, /process\.env\.(?:DATABASE_URL|AUTH_DATABASE_URL)/);
  }
});
