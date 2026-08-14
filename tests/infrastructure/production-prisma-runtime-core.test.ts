import assert from "node:assert/strict";
import test from "node:test";

import {
  createProductionPrismaRuntime,
  createProductionPrismaRuntimeLifecycle,
} from "../../src/infrastructure/persistence/prisma/production-prisma-runtime-core";

interface FakePool { readonly kind: "pool" }
interface FakeAdapter { readonly kind: "adapter" }
interface FakeClient {
  readonly kind: "client";
  disconnectCalls: number;
  $disconnect(): Promise<void>;
}

function createHarness() {
  const pool: FakePool = { kind: "pool" };
  const adapter: FakeAdapter = { kind: "adapter" };
  const client: FakeClient = {
    kind: "client",
    disconnectCalls: 0,
    async $disconnect() { this.disconnectCalls += 1; },
  };
  const calls: unknown[] = [];
  const factories = {
    createPool(config: unknown) { calls.push(["pool", config]); return pool; },
    createAdapter(value: FakePool, options: unknown) {
      calls.push(["adapter", value, options]);
      return adapter;
    },
    createClient(value: FakeAdapter) {
      calls.push(["client", value]);
      return client;
    },
  };
  return { pool, adapter, client, calls, factories };
}

test("constructs exactly one tuple with the approved pool and adapter options", () => {
  const harness = createHarness();
  const runtime = createProductionPrismaRuntime(
    "postgresql://passvero_app:redacted@localhost/passvero",
    harness.factories,
  );

  assert.deepEqual(runtime, {
    pool: harness.pool,
    adapter: harness.adapter,
    client: harness.client,
  });
  assert.deepEqual(harness.calls, [
    ["pool", {
      connectionString: "postgresql://passvero_app:redacted@localhost/passvero",
      max: 5,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 5_000,
    }],
    ["adapter", harness.pool, { disposeExternalPool: true }],
    ["client", harness.adapter],
  ]);
});

test("reuses one runtime and permits a fresh runtime only after disconnect", async () => {
  const first = createHarness();
  const second = createHarness();
  let creations = 0;
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => {
    creations += 1;
    return creations === 1
      ? { pool: first.pool, adapter: first.adapter, client: first.client }
      : { pool: second.pool, adapter: second.adapter, client: second.client };
  });

  assert.equal(lifecycle.getRuntime().client, first.client);
  assert.equal(lifecycle.getRuntime().client, first.client);
  assert.equal(creations, 1);
  await lifecycle.disconnect();
  assert.equal(first.client.disconnectCalls, 1);
  assert.equal(lifecycle.getRuntime().client, second.client);
  assert.equal(creations, 2);
});

test("coalesces concurrent disconnects and blocks access while disconnecting", async () => {
  let release: (() => void) | undefined;
  const client = {
    $disconnect: () => new Promise<void>((resolve) => { release = resolve; }),
  };
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => ({
    pool: {}, adapter: {}, client,
  }));
  lifecycle.getRuntime();

  const first = lifecycle.disconnect();
  const second = lifecycle.disconnect();
  assert.equal(first, second);
  assert.throws(() => lifecycle.getRuntime(), /disconnect is in progress/i);
  assert.ok(release !== undefined);
  release();
  await first;
});

test("does not cache failed initialization or return a runtime after failed disconnect", async () => {
  let attempts = 0;
  const lifecycle = createProductionPrismaRuntimeLifecycle(() => {
    attempts += 1;
    if (attempts === 1) throw new Error("construction failed");
    return {
      pool: {},
      adapter: {},
      client: { $disconnect: async () => { throw new Error("disconnect failed"); } },
    };
  });

  assert.throws(() => lifecycle.getRuntime(), /construction failed/);
  lifecycle.getRuntime();
  assert.equal(attempts, 2);
  await assert.rejects(lifecycle.disconnect(), /disconnect failed/);
  assert.throws(() => lifecycle.getRuntime(), /disconnect previously failed/i);
});
