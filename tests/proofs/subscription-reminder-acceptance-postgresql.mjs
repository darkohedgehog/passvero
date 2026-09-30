// Dedicated fixture proof in a new disposable cluster. All email uses an in-memory test double.
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const directory = mkdtempSync('/private/tmp/passvero-reminder-acceptance-harness-');
const source = readFileSync('tests/proofs/subscription-entitlements-postgresql.mjs', 'utf8')
  .replace('passvero-entitlements-proof-', 'passvero-reminder-acceptance-proof-')
  .replace("'tests/integration/subscription-entitlements-postgresql.test.ts','tests/integration/subscription-plan-changes-postgresql.test.ts'", "'tests/integration/subscription-reminder-acceptance-postgresql.test.ts'")
  .replace("import {Pool} from 'pg';", `import pgModule from ${JSON.stringify(path.resolve('node_modules/pg/lib/index.js'))}; const {Pool}=pgModule;`);
const runner = path.join(directory, 'proof.mjs');
writeFileSync(runner, source);
const result = spawnSync(process.execPath, [runner], { stdio: 'inherit', env: { PATH: process.env.PATH, TMPDIR: process.env.TMPDIR }, timeout: 300000 });
process.exitCode = result.status ?? 1;
