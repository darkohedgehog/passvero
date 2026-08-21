import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { runWithTransaction } from "@better-auth/core/context";
import { APIError } from "better-auth/api";
import { createProofAuth, type ProofAuth } from "../src/auth.js";
import {
  EMPTY_DEFERRED_COOKIE,
  deltaRowCounts,
  H1_NATIVE_TRANSACTION_RUNTIME_VERDICT,
  H1_NATIVE_TRANSACTION_SCENARIOS,
  type H1NativeTransactionEvidence,
  type H1ScenarioContract,
  type H1ScenarioEvidence,
  type H1WriteObservation,
  type RowCounts,
} from "../src/evidence.js";
import { buildConnectionString, readRunIdentity, writeHypothesisAssertionResult } from "../src/run-root.js";

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

interface DirectResponseObservation {
  readonly status: number;
  readonly responseHeaderCount: number;
  readonly setCookieHeaderCount: number;
  readonly cookie: H1ScenarioEvidence["cookie"];
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

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function requireRecord(value: unknown, stopCode: string): UnknownRecord {
  if (!isRecord(value)) throw new Error(stopCode);
  return value;
}

function hasMethod(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function isProofSqlClient(value: unknown): value is ProofSqlClient {
  return isRecord(value) && hasMethod(value, "$queryRaw");
}

function isCountAndCleanupDelegate(value: unknown): value is CountAndCleanupDelegate {
  return isRecord(value) && hasMethod(value, "count") && hasMethod(value, "deleteMany");
}

function isProofPrismaClient(value: unknown): value is ProofPrismaClient {
  if (!isRecord(value)) return false;
  for (const name of [
    "authProviderUser",
    "authProviderAccount",
    "authProviderSession",
    "authProviderVerification",
    "user",
    "authIdentity",
    "accountActivation",
    "authCredentialToken",
    "authAbuseBucket",
  ]) {
    if (!isCountAndCleanupDelegate(Reflect.get(value, name))) return false;
  }
  return hasMethod(value, "$queryRaw") && hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
}

function createGeneratedPrismaClient(module: unknown, adapter: PrismaPg): ProofPrismaClient {
  const exported = requireRecord(module, "STOP_H1_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(exported, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H1_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isProofPrismaClient(client)) throw new Error("STOP_H1_GENERATED_CLIENT_INVALID");
  return client;
}

function isDelegateAction(value: PropertyKey): value is DelegateAction {
  return value === "create"
    || value === "update"
    || value === "updateMany"
    || value === "delete"
    || value === "deleteMany"
    || value === "upsert";
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
      const value: unknown = Reflect.get(target, property, receiver);
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
          const method: unknown = Reflect.get(delegateTarget, actionProperty, delegateReceiver);
          if (!isDelegateAction(actionProperty) || typeof method !== "function") {
            return method;
          }
          const action = actionProperty;
          return async (...args: readonly unknown[]) => {
            if (!isProofSqlClient(proxy)) throw new Error("STOP_H1_INSTRUMENTED_CLIENT_INVALID");
            state.observations.push({
              model,
              action,
              phase: "BEFORE",
              transactionIdHash: await currentTransactionIdHash(proxy),
            });
            if (model === "AuthProviderAccount" && action === "create") {
              state.failureInjected = true;
              throw APIError.from("UNPROCESSABLE_ENTITY", {
                code: "H1_AUTH_PROVIDER_ACCOUNT_CREATE_INJECTED",
                message: "H1 provider account create failure injected",
              });
            }
            const result: unknown = await Reflect.apply(method, delegateTarget, args);
            state.observations.push({
              model,
              action,
              phase: "AFTER",
              transactionIdHash: await currentTransactionIdHash(proxy),
            });
            if (model === "AuthProviderUser" && action === "create") {
              const id = Reflect.get(requireRecord(result, "STOP_H1_PROVIDER_USER_RESULT_INVALID"), "id");
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

function readSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie: unknown = Reflect.get(headers, "getSetCookie");
  if (typeof getSetCookie === "function") {
    const values: unknown = Reflect.apply(getSetCookie, headers, []);
    if (Array.isArray(values) && values.every((value) => typeof value === "string")) return [...values];
    throw new Error("STOP_H1_RESPONSE_HEADERS_INVALID");
  }
  const value = headers.get(["set", "cookie"].join("-"));
  return value === null ? [] : [value];
}

function parseObservedCookie(raw: string | undefined): H1ScenarioEvidence["cookie"] {
  if (raw === undefined) {
    return {
      present: false,
      nameHash: null,
      secure: false,
      httpOnly: false,
      sameSite: null,
      hostOnly: true,
      maxAgeSeconds: null,
    };
  }
  const segments = raw.split(";").map((segment) => segment.trim());
  const pair = segments.shift() ?? "";
  const separator = pair.indexOf("=");
  const name = separator >= 0 ? pair.slice(0, separator) : pair;
  const attributes = new Map(
    segments.map((segment) => {
      const index = segment.indexOf("=");
      return index < 0
        ? [segment.toLowerCase(), ""]
        : [segment.slice(0, index).toLowerCase(), segment.slice(index + 1)];
    }),
  );
  const maxAge = attributes.get("max-age");
  return {
    present: true,
    nameHash: createHash("sha256").update(name).digest("hex"),
    secure: attributes.has("secure"),
    httpOnly: attributes.has("httponly"),
    sameSite: attributes.get("samesite")?.toLowerCase() === "lax" ? "lax" : null,
    hostOnly: !attributes.has("domain"),
    maxAgeSeconds: maxAge !== undefined && /^\d+$/.test(maxAge) ? Number(maxAge) : null,
  };
}

function observeDirectApiResponse(response: Response): DirectResponseObservation {
  const rawHeaders = readSetCookieHeaders(response.headers);
  const setCookieHeaderCount = rawHeaders.length;
  let responseHeaderCount = 0;
  response.headers.forEach(() => {
    responseHeaderCount += 1;
  });
  try {
    return {
      status: response.status,
      responseHeaderCount,
      setCookieHeaderCount,
      cookie: parseObservedCookie(rawHeaders[0]),
    };
  } finally {
    rawHeaders.splice(0, rawHeaders.length);
  }
}

function requireNoSessionResponse(observation: DirectResponseObservation): void {
  if (observation.status < 400) {
    throw new Error("STOP_H1_DIRECT_RESPONSE_INVALID");
  }
  if (observation.setCookieHeaderCount !== 0 || observation.cookie.present) {
    throw new Error("STOP_H1_SESSION_RESPONSE_OBSERVED");
  }
}

function requireDirectResponseObservation(value: DirectResponseObservation | undefined): DirectResponseObservation {
  if (value === undefined) throw new Error("STOP_H1_DIRECT_RESPONSE_MISSING");
  return value;
}

async function invokeSignUp(auth: ProofAuth, fixtureId: string): Promise<DirectResponseObservation> {
  const response = await auth.api.signUpEmail({
    body: {
      name: `proof-${fixtureId}`,
      email: `proof-${fixtureId}@invalid.example`,
      password: `H1-${fixtureId}-Aa1!`,
    },
    asResponse: true,
  });
  return observeDirectApiResponse(response);
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
    const attempt = async (): Promise<DirectResponseObservation> => {
      if (contract.explicitOuterTransaction) {
        let observation: DirectResponseObservation | undefined;
        await assert.rejects(
          () => instrumentedRoot.$transaction(async (tx) => {
            const auth = createProofAuth({ prisma: tx, adapterTransaction: false, disableSignUp: false });
            const adapter = (await auth.$context).adapter;
            observation = await runWithTransaction(adapter, () => invokeSignUp(auth, fixtureId));
            requireNoSessionResponse(observation);
            throw new Error("INJECTED_H1_OUTER_ROLLBACK_AFTER_RESPONSE");
          }),
          /INJECTED_H1_OUTER_ROLLBACK_AFTER_RESPONSE/,
        );
        return requireDirectResponseObservation(observation);
      }

      const auth = createProofAuth({
        prisma: instrumentedRoot,
        adapterTransaction: contract.adapterTransaction,
        disableSignUp: false,
      });
      if (contract.nestedRunWithTransaction) {
        const adapter = (await auth.$context).adapter;
        let observation: DirectResponseObservation | undefined;
        await assert.rejects(
          () => runWithTransaction(adapter, async () => {
            observation = await invokeSignUp(auth, fixtureId);
            requireNoSessionResponse(observation);
            throw new Error("INJECTED_H1_OUTER_ROLLBACK_AFTER_RESPONSE");
          }),
          /INJECTED_H1_OUTER_ROLLBACK_AFTER_RESPONSE/,
        );
        return requireDirectResponseObservation(observation);
      }
      return invokeSignUp(auth, fixtureId);
    };

    const responseObservation = await attempt();
    requireNoSessionResponse(responseObservation);
    assert.equal(responseObservation.status, 422, "H1 injected account failure must produce an error response");
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
      responseStatus: responseObservation.status,
      responseHeaderCount: responseObservation.responseHeaderCount,
      setCookieHeaderCount: responseObservation.setCookieHeaderCount,
      cookie: responseObservation.cookie,
      fixtureCleaned: true,
      successfulProviderWriteOrigin: "BETTER_AUTH_API",
      assertions: [
        "provider account failure followed provider user creation",
        "observed direct error response contained no session row or response cookie header",
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
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createGeneratedPrismaClient(generated, adapter);
  try {
    const scenarios: H1ScenarioEvidence[] = [];
    for (const contract of H1_NATIVE_TRANSACTION_SCENARIOS) {
      scenarios.push(await runScenario(prisma, contract));
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

test("H1 direct response observation rejects any response cookie without retaining its value", () => {
  const clean = observeDirectApiResponse(new Response(null, {
    status: 422,
    headers: { "x-proof-observation": "present" },
  }));
  assert.deepEqual(clean, {
    status: 422,
    responseHeaderCount: 1,
    setCookieHeaderCount: 0,
    cookie: EMPTY_DEFERRED_COOKIE,
  });
  assert.doesNotThrow(() => requireNoSessionResponse(clean));

  const cookieHeaderName = ["set", "cookie"].join("-");
  const rawCookieValue = ["__Host-proof=opaque", "Path=/", "HttpOnly", "Secure", "SameSite=Lax"].join("; ");
  const unsafe = observeDirectApiResponse(new Response(null, {
    status: 422,
    headers: { [cookieHeaderName]: rawCookieValue },
  }));
  assert.equal(unsafe.setCookieHeaderCount, 1);
  assert.equal(unsafe.cookie.present, true);
  assert.match(unsafe.cookie.nameHash ?? "", /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(unsafe), /opaque/);
  assert.throws(() => requireNoSessionResponse(unsafe), /STOP_H1_SESSION_RESPONSE_OBSERVED/);
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
  const before = evidence.scenarios[0]?.before;
  const after = evidence.scenarios.at(-1)?.after;
  if (!before || !after) throw new Error("STOP_H1_ASSERTION_RESULT_INCOMPLETE");
  await writeHypothesisAssertionResult({
    id: "H1_NATIVE_TRANSACTION",
    status: "PASS",
    transactionIds: evidence.scenarios.flatMap(({ transactionIds }) => transactionIds),
    before,
    after,
    deltas: deltaRowCounts(before, after),
    cookie: EMPTY_DEFERRED_COOKIE,
    assertions: ["H1_NATIVE_AND_NESTED_ASSERTIONS_COMPLETE"],
    failureCode: null,
  });
});
