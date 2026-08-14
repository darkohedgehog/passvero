export const PRODUCTION_POOL_POLICY = Object.freeze({
  max: 5,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
});

export interface DisconnectablePrismaClient {
  $disconnect(): Promise<void>;
}

export interface ProductionPrismaRuntimeFactories<Pool, Adapter, Client> {
  createPool(config: {
    readonly connectionString: string;
    readonly max: number;
    readonly idleTimeoutMillis: number;
    readonly connectionTimeoutMillis: number;
  }): Pool;
  createAdapter(pool: Pool, options: { readonly disposeExternalPool: true }): Adapter;
  createClient(adapter: Adapter): Client;
}

export interface ProductionPrismaRuntime<Pool, Adapter, Client> {
  readonly pool: Pool;
  readonly adapter: Adapter;
  readonly client: Client;
}

export function createProductionPrismaRuntime<Pool, Adapter, Client>(
  connectionString: string,
  factories: ProductionPrismaRuntimeFactories<Pool, Adapter, Client>,
): ProductionPrismaRuntime<Pool, Adapter, Client> {
  const pool = factories.createPool({ connectionString, ...PRODUCTION_POOL_POLICY });
  const adapter = factories.createAdapter(pool, { disposeExternalPool: true });
  const client = factories.createClient(adapter);
  return { pool, adapter, client };
}

export interface ProductionPrismaRuntimeLifecycle<Pool, Adapter, Client> {
  getRuntime(): ProductionPrismaRuntime<Pool, Adapter, Client>;
  disconnect(): Promise<void>;
}

export function createProductionPrismaRuntimeLifecycle<
  Pool,
  Adapter,
  Client extends DisconnectablePrismaClient,
>(
  createRuntime: () => ProductionPrismaRuntime<Pool, Adapter, Client>,
): ProductionPrismaRuntimeLifecycle<Pool, Adapter, Client> {
  let runtime: ProductionPrismaRuntime<Pool, Adapter, Client> | undefined;
  let disconnecting: Promise<void> | undefined;
  let disconnectFailed = false;

  return {
    getRuntime() {
      if (disconnecting !== undefined) {
        throw new Error("Production Prisma disconnect is in progress.");
      }
      if (disconnectFailed) {
        throw new Error("Production Prisma disconnect previously failed.");
      }
      runtime ??= createRuntime();
      return runtime;
    },
    disconnect() {
      if (disconnecting !== undefined) return disconnecting;
      if (runtime === undefined) return Promise.resolve();

      const current = runtime;
      disconnecting = current.client.$disconnect()
        .then(() => {
          if (runtime === current) runtime = undefined;
          disconnectFailed = false;
        })
        .catch((error: unknown) => {
          disconnectFailed = true;
          throw error;
        })
        .finally(() => { disconnecting = undefined; });
      return disconnecting;
    },
  };
}
