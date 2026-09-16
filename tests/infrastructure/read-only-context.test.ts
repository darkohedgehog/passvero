import assert from "node:assert/strict";
import test from "node:test";
import { readOnlyContextRepository } from "../../src/infrastructure/context/read-only-context-repository";
import { createAuthenticatedUserContextResolver } from "../../src/application/context/resolve-authenticated-user-context";

test("read-only wrapper delegates reads and refuses every selection mutation", async () => {
  let writes = 0;
  const repository = readOnlyContextRepository({ async listMembershipsForUser() { return []; }, async findSelection() { return null; }, async deleteSelection() { writes++; }, async upsertSelection() { writes++; } });
  assert.deepEqual(await repository.listMembershipsForUser("user"), []);
  const selector = { provider: "BETTER_AUTH" as const, providerSessionId: "session" };
  await assert.rejects(repository.deleteSelection(selector), /SELECTION_REQUIRED/);
  await assert.rejects(repository.upsertSelection({ ...selector, selectedOrganizationId: "org" }), /SELECTION_REQUIRED/);
  assert.equal(writes, 0);
});
test("existing resolver denies absent identity without repository access", async () => {
  const resolver = createAuthenticatedUserContextResolver({
    async resolveCurrentUser() { return { status: "UNAUTHENTICATED", reason: "NO_PROVIDER_SESSION" }; },
    repository: readOnlyContextRepository({ async listMembershipsForUser() { assert.fail(); }, async findSelection() { assert.fail(); }, async deleteSelection() { assert.fail(); }, async upsertSelection() { assert.fail(); } }),
    correlationId: () => "correlation",
  });
  assert.equal((await resolver(null)).status, "DENIED");
});
test("read-only startup option reaches node-postgres connection parameters without connecting", async () => {
  const { execFileSync } = await import("node:child_process");
  const output = execFileSync(process.execPath, ["-e", `
    const assert=require('node:assert/strict');
    const path=require('node:path');
    const Parameters=require(path.join(path.dirname(require.resolve('pg')), 'connection-parameters.js'));
    const value=new Parameters({connectionString:'postgresql://test:test@127.0.0.1:5433/passvero_acceptance'});
    assert.equal(value.options,'-c default_transaction_read_only=on');
    console.log('READ_ONLY_STARTUP=PASS');
  `], { env: { PATH: process.env.PATH, NODE_ENV: "test", PGOPTIONS: "-c default_transaction_read_only=on" }, encoding: "utf8" });
  assert.match(output, /READ_ONLY_STARTUP=PASS/);
});
test("actual staging resolver rejects absent/invalid session without any network connection", async () => {
  const { execFileSync } = await import("node:child_process");
  const output = execFileSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "--input-type=module", "-e", `
    import assert from 'node:assert/strict'; import net from 'node:net';
    import {syncBuiltinESMExports} from 'node:module';
    let connections=0;net.Socket.prototype.connect=function(){connections++;throw new Error('NETWORK_FORBIDDEN')};syncBuiltinESMExports();
    const m=await import('./src/infrastructure/documents/staging-scan-runner.ts');
    const resolve=m.resolveStagingRunnerContext??m.default.resolveStagingRunnerContext;
    await assert.rejects(resolve(''),/FORBIDDEN/);
    await assert.rejects(resolve('__Secure-better-auth.session_token=invalid'),/FORBIDDEN/);
    assert.equal(connections,0);console.log('INVALID_SESSION=DENIED_NO_CONNECTION');
  `], { cwd: process.cwd(), env: { PATH: process.env.PATH, NODE_ENV: "test", PASSVERO_RUNTIME_ENV: "staging", BETTER_AUTH_URL: "https://staging.passvero.eu", BETTER_AUTH_SECRET: "local-test-only-secret".repeat(3), DATABASE_URL: "postgresql://passvero_app:local-test-only@127.0.0.1:5433/passvero_acceptance", AUTH_DATABASE_URL: "postgresql://passvero_auth:local-test-only@127.0.0.1:5433/passvero_acceptance" }, encoding: "utf8", timeout: 15000 });
  assert.match(output, /INVALID_SESSION=DENIED_NO_CONNECTION/);
});
