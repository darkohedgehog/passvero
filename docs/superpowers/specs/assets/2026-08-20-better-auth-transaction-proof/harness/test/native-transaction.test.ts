import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import {
  EMPTY_DEFERRED_COOKIE,
  H1_NATIVE_TRANSACTION_RUNTIME_VERDICT,
  H1_NATIVE_TRANSACTION_SCENARIOS,
  type H1NativeTransactionEvidence,
  type H1ScenarioContract,
  type H1ScenarioEvidence,
  type H1WriteObservation,
  type RowCounts,
} from "../src/evidence.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type ProviderModel = H1WriteObservation["model"];
type DelegateAction = H1WriteObservation["action"];
type UnknownRecord = Record<PropertyKey, unknown>;

interface CountAndCleanupDelegate {
  count(): Promise<number>;
  deleteMany(input: { readonly where: Readonly<Record<string, unknown>> }): Promise<{ readonly count: number }>;
}

interface ProofSqlClient {
  $queryRaw<T>(query: TemplateStringsArray): Promise<T>;
}

interface ProofTransactionClient extends ProofSqlClient {
  readonly authProviderUser: CountAndCleanupDelegate;
  readonly authProviderAccount: CountAndCleanupDelegate;
  readonly authProviderSession: CountAndCleanupDelegate;
  readonly authProviderVerification: CountAndCleanupDelegate;
  readonly user: CountAndCleanupDelegate;
  readonly authIdentity: CountAndCleanupDelegate;
  readonly accountActivation: CountAndCleanupDelegate;
  readonly authCredentialToken: CountAndCleanupDelegate;
  readonly authAbuseBucket: CountAndCleanupDelegate;
}

interface ProofPrismaClient extends ProofTransactionClient {
  $transaction<T>(action: (tx: ProofTransactionClient) => Promise<T>): Promise<T>;
  $disconnect(): Promise<void>;
}

interface GeneratedClientModule {
  readonly PrismaClient: new (input: { readonly adapter: object }) => ProofPrismaClient;
}

interface ProofAuth {
  readonly api: {
    signUpEmail(input: {
      readonly body: {
        readonly name: string;
        readonly email: string;
        readonly password: string;
      };
    }): Promise<unknown>;
  };
  readonly $context: Promise<{ readonly adapter: object }>;
}

interface H1RuntimeModules {
  readonly PrismaPg: new (input: { readonly connectionString: string }) => object;
  readonly createProofAuth: (input: {
    readonly prisma: object;
    readonly adapterTransaction: boolean;
    readonly disableSignUp: boolean;
  }) => ProofAuth;
  readonly runWithTransaction: <T>(adapter: object, action: () => Promise<T>) => Promise<T>;
}

interface InstrumentationState {
  transactionCalls: number;
  failureInjected: boolean;
  readonly createdProviderUserIds: string[];
  readonly observations: H1WriteObservation[];
}

const PROVIDER_DELEGATES = new Map<PropertyKey, ProviderModel>([
  ["authProviderUser", "AuthProviderUser"],
  ["authProviderAccount", "AuthProviderAccount"],
  ["authProviderSession", "AuthProviderSession"],
  ["authProviderVerification", "AuthProviderVerification"],
]);

const WRITE_ACTIONS = new Set<DelegateAction>([
  "create",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
  "upsert",
]);

function asRecord(value: unknown, stopCode: string): UnknownRecord {
  if (value === null || typeof value !== "object") throw new Error(stopCode);
  return value as UnknownRecord;
}

async function currentTransactionIdHash(client: ProofSqlClient): Promise<string> {
  const rows = await client.$queryRaw<readonly { readonly transactionId: bigint }[]>`
    SELECT txid_current() AS "transactionId"
  `;
  const transactionId = rows[0]?.transactionId.toString();
  if (!transactionId || !/^\d+$/.test(transactionId)) throw new Error("STOP_H1_TRANSACTION_ID_INVALID");
  return createHash("sha256").update(transactionId).digest("hex");
}

function instrumentPrisma<T extends object>(client: T, state: InstrumentationState): T {
  const delegateCache = new Map<PropertyKey, object>();
  let proxy: T;
  proxy = new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver) as unknown;
      if (property === "$transaction" && typeof value === "function") {
        return async (action: unknown) => {
          if (typeof action !== "function") throw new Error("STOP_H1_BATCH_TRANSACTION_FORBIDDEN");
          state.transactionCalls += 1;
          return Reflect.apply(value, target, [async (tx: object) => action(instrumentPrisma(tx, state))]);
        };
      }

      const model = PROVIDER_DELEGATES.get(property);
      if (!model || value === null || typeof value !== "object") return value;
      const cached = delegateCache.get(property);
      if (cached) return cached;
      const delegate = new Proxy(value, {
        get(delegateTarget, actionProperty, delegateReceiver) {
          const method = Reflect.get(delegateTarget, actionProperty, delegateReceiver) as unknown;
          if (typeof actionProperty !== "string" || !WRITE_ACTIONS.has(actionProperty as DelegateAction) || typeof method !== "function") {
            return method;
          }
          const action = actionProperty as DelegateAction;
          return async (...args: readonly unknown[]) => {
            const sqlClient = proxy as unknown as ProofSqlClient;
            state.observations.push({
              model,
              action,
              phase: "BEFORE",
              transactionIdHash: await currentTransactionIdHash(sqlClient),
            });
            if (model === "AuthProviderAccount" && action === "create") {
              state.failureInjected = true;
              throw new Error("INJECTED_H1_AUTH_PROVIDER_ACCOUNT_CREATE");
            }
            const result = await Reflect.apply(method, delegateTarget, args);
            state.observations.push({
              model,
              action,
              phase: "AFTER",
              transactionIdHash: await currentTransactionIdHash(sqlClient),
            });
            if (model === "AuthProviderUser" && action === "create") {
              const id = Reflect.get(asRecord(result, "STOP_H1_PROVIDER_USER_RESULT_INVALID"), "id");
              if (typeof id !== "string" || id.length === 0) throw new Error("STOP_H1_PROVIDER_USER_ID_INVALID");
              state.createdProviderUserIds.push(id);
            }
            return result;
          };
        },
      });
      delegateCache.set(property, delegate);
      return delegate;
    },
  });
  return proxy;
}

async function readCounts(prisma: ProofTransactionClient): Promise<RowCounts> {
  const [
    providerUser,
    providerAccount,
    providerSession,
    providerVerification,
    canonicalUser,
    authIdentity,
    activation,
    credentialToken,
    abuseBucket,
  ] = await Promise.all([
    prisma.authProviderUser.count(),
    prisma.authProviderAccount.count(),
    prisma.authProviderSession.count(),
    prisma.authProviderVerification.count(),
    prisma.user.count(),
    prisma.authIdentity.count(),
    prisma.accountActivation.count(),
    prisma.authCredentialToken.count(),
    prisma.authAbuseBucket.count(),
  ]);
  return {
    providerUser,
    providerAccount,
    providerSession,
    providerVerification,
    canonicalUser,
    authIdentity,
    activation,
    credentialToken,
    abuseBucket,
  };
}

function countDelta(before: RowCounts, after: RowCounts, key: keyof RowCounts): number {
  return after[key] - before[key];
}

async function invokeSignUp(auth: ProofAuth, fixtureId: string): Promise<void> {
  await auth.api.signUpEmail({
    body: {
      name: `proof-${fixtureId}`,
      email: `proof-${fixtureId}@invalid.example`,
      password: `H1-${fixtureId}-Aa1!`,
    },
  });
}

async function cleanFixture(
  prisma: ProofPrismaClient,
  state: InstrumentationState,
  fixtureId: string,
): Promise<void> {
  const ids = [...new Set(state.createdProviderUserIds)];
  if (ids.length > 0) {
    const userScope = { userId: { in: ids } };
    await prisma.authProviderSession.deleteMany({ where: userScope });
    await prisma.authProviderAccount.deleteMany({ where: userScope });
    await prisma.authCredentialToken.deleteMany({ where: { providerUserId: { in: ids } } });
    await prisma.authProviderUser.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.authProviderVerification.deleteMany({
    where: { identifier: `proof-${fixtureId}@invalid.example` },
  });
}

async function runScenario(
  rootPrisma: ProofPrismaClient,
  contract: H1ScenarioContract,
  runtime: H1RuntimeModules,
): Promise<H1ScenarioEvidence> {
  const fixtureId = randomBytes(16).toString("hex");
  const state: InstrumentationState = {
    transactionCalls: 0,
    failureInjected: false,
    createdProviderUserIds: [],
    observations: [],
  };
  const before = await readCounts(rootPrisma);
  const instrumentedRoot = instrumentPrisma(rootPrisma, state);

  try {
    const attempt = async () => {
      if (contract.explicitOuterTransaction) {
        await instrumentedRoot.$transaction(async (tx) => {
          const auth = runtime.createProofAuth({ prisma: tx, adapterTransaction: false, disableSignUp: false });
          const adapter = (await auth.$context).adapter;
          await runtime.runWithTransaction(adapter, () => invokeSignUp(auth, fixtureId));
        });
        return;
      }

      const auth = runtime.createProofAuth({
        prisma: instrumentedRoot,
        adapterTransaction: contract.adapterTransaction,
        disableSignUp: false,
      });
      if (contract.nestedRunWithTransaction) {
        const adapter = (await auth.$context).adapter;
        await runtime.runWithTransaction(adapter, () => invokeSignUp(auth, fixtureId));
        return;
      }
      await invokeSignUp(auth, fixtureId);
    };

    await assert.rejects(attempt, /INJECTED_H1_AUTH_PROVIDER_ACCOUNT_CREATE|FAILED_TO_CREATE_USER/);
    assert.equal(state.failureInjected, true, "account create failure point must execute");
    const after = await readCounts(rootPrisma);
    assert.equal(countDelta(before, after, "providerUser"), contract.expectedProviderUserDelta);
    assert.equal(countDelta(before, after, "providerAccount"), contract.expectedProviderAccountDelta);
    assert.equal(countDelta(before, after, "providerSession"), 0, "H1 must not create a session");
    assert.equal(state.transactionCalls, contract.expectedPrismaTransactionCalls);
    assert.deepEqual(
      state.observations.map(({ model, action, phase }) => ({ model, action, phase })),
      [
        { model: "AuthProviderUser", action: "create", phase: "BEFORE" },
        { model: "AuthProviderUser", action: "create", phase: "AFTER" },
        { model: "AuthProviderAccount", action: "create", phase: "BEFORE" },
      ],
      "failure injection must occur only when provider account creation follows provider user creation",
    );
    const transactionIds = state.observations.map((observation) => observation.transactionIdHash);
    transactionIds.forEach((hash) => assert.match(hash, /^[a-f0-9]{64}$/));
    assert.equal(
      new Set(transactionIds).size === 1,
      contract.expectedSingleTransactionId,
      "transaction identity must match the H1 scenario contract",
    );

    return {
      id: contract.id,
      status: "PASS",
      adapterTransaction: contract.adapterTransaction,
      explicitOuterTransaction: contract.explicitOuterTransaction,
      nestedRunWithTransaction: contract.nestedRunWithTransaction,
      acceptedArchitecture: contract.acceptedArchitecture,
      expectedProviderUserDelta: contract.expectedProviderUserDelta,
      expectedProviderAccountDelta: contract.expectedProviderAccountDelta,
      prismaTransactionCalls: state.transactionCalls,
      transactionIds,
      writes: state.observations,
      before,
      after,
      cookie: EMPTY_DEFERRED_COOKIE,
      fixtureCleaned: true,
      successfulProviderWriteOrigin: "BETTER_AUTH_API",
      assertions: [
        "provider account failure followed provider user creation",
        "no provider session or deferred response header was created",
        contract.acceptedArchitecture
          ? "accepted path rolled provider writes back through one explicit boundary"
          : "split write retained only as rejected isolated negative control",
      ],
      failureCode: null,
    };
  } finally {
    await cleanFixture(rootPrisma, state, fixtureId);
    assert.deepEqual(await readCounts(rootPrisma), before, "H1 fixture cleanup must restore all row counts");
  }
}

export async function runH1NativeTransactionProof(): Promise<H1NativeTransactionEvidence> {
  const generatedPath = "../generated/client/client.js";
  const adapterPath = "@prisma/adapter-pg";
  const authPath = "../src/auth.js";
  const contextPath = "@better-auth/core/context";
  const generated = await import(generatedPath) as unknown as GeneratedClientModule;
  const adapterModule = await import(adapterPath) as unknown as Pick<H1RuntimeModules, "PrismaPg">;
  const authModule = await import(authPath) as unknown as Pick<H1RuntimeModules, "createProofAuth">;
  const contextModule = await import(contextPath) as unknown as Pick<H1RuntimeModules, "runWithTransaction">;
  const runtime: H1RuntimeModules = { ...adapterModule, ...authModule, ...contextModule };
  const prisma = new generated.PrismaClient({
    adapter: new runtime.PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) }),
  });
  try {
    const scenarios: H1ScenarioEvidence[] = [];
    for (const contract of H1_NATIVE_TRANSACTION_SCENARIOS) {
      scenarios.push(await runScenario(prisma, contract, runtime));
    }
    return {
      id: "H1_NATIVE_TRANSACTION",
      runtimeVerdict: "PASS",
      scenarios,
      assertions: [
        "transaction false split is evidence only and remains rejected architecture",
        "all accepted provider writes originate from Better Auth inside one transaction boundary",
      ],
      failureCode: null,
    };
  } finally {
    await prisma.$disconnect();
  }
}

test("H1 manifest keeps the split-write control rejected and runtime unexecuted", () => {
  assert.equal(H1_NATIVE_TRANSACTION_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(H1_NATIVE_TRANSACTION_SCENARIOS, [
    {
      id: "TRANSACTION_FALSE_SPLIT_NEGATIVE_CONTROL",
      adapterTransaction: false,
      explicitOuterTransaction: false,
      nestedRunWithTransaction: false,
      acceptedArchitecture: false,
      expectedProviderUserDelta: 1,
      expectedProviderAccountDelta: 0,
      expectedPrismaTransactionCalls: 0,
      expectedSingleTransactionId: false,
    },
    {
      id: "TRANSACTION_TRUE_ROLLBACK",
      adapterTransaction: true,
      explicitOuterTransaction: false,
      nestedRunWithTransaction: false,
      acceptedArchitecture: true,
      expectedProviderUserDelta: 0,
      expectedProviderAccountDelta: 0,
      expectedPrismaTransactionCalls: 1,
      expectedSingleTransactionId: true,
    },
    {
      id: "TRANSACTION_TRUE_NESTED_REUSE",
      adapterTransaction: true,
      explicitOuterTransaction: false,
      nestedRunWithTransaction: true,
      acceptedArchitecture: true,
      expectedProviderUserDelta: 0,
      expectedProviderAccountDelta: 0,
      expectedPrismaTransactionCalls: 1,
      expectedSingleTransactionId: true,
    },
    {
      id: "TRANSACTION_FALSE_TX_BOUND_REUSE",
      adapterTransaction: false,
      explicitOuterTransaction: true,
      nestedRunWithTransaction: true,
      acceptedArchitecture: true,
      expectedProviderUserDelta: 0,
      expectedProviderAccountDelta: 0,
      expectedPrismaTransactionCalls: 1,
      expectedSingleTransactionId: true,
    },
  ]);
});

test("live H1 proves native and nested transaction behavior once", {
  skip: process.env.PASSVERO_PROOF_H1 !== "1",
}, async () => {
  const evidence = await runH1NativeTransactionProof();
  assert.equal(evidence.runtimeVerdict, "PASS");
  assert.equal(evidence.scenarios.length, H1_NATIVE_TRANSACTION_SCENARIOS.length);
  assert.equal(evidence.scenarios.every((scenario) => scenario.status === "PASS"), true);
  assert.equal(evidence.scenarios[0]?.acceptedArchitecture, false);
  assert.equal(evidence.scenarios.slice(1).every((scenario) => scenario.acceptedArchitecture), true);
  console.log("H1_NATIVE_TRANSACTION=PASS");
});
