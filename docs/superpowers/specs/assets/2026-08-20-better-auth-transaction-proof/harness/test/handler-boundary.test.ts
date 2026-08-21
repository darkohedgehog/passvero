import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { getCurrentAdapter, runWithTransaction } from "@better-auth/core/context";
import { createProofAuth } from "../src/auth.js";
import { deltaRowCounts, EMPTY_DEFERRED_COOKIE, HYPOTHESIS_FAILURE_CODES, type DeferredCookie, type RowCounts } from "../src/evidence.js";
import {
  H3_HANDLER_BOUNDARY_RUNTIME_VERDICT,
  HANDLER_BOUNDARY_REJECTION,
  type BoundaryRootPrisma,
  type TransactionClient,
} from "../src/proof-boundary.js";
import { buildConnectionString, readRunIdentity, writeHypothesisAssertionResult, writeHypothesisResult } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;

interface ProviderCountDelegate {
  count(): Promise<number>;
}

interface H3PrismaClient extends BoundaryRootPrisma {
  readonly authProviderUser: ProviderCountDelegate;
  readonly authProviderAccount: ProviderCountDelegate;
  readonly authProviderSession: ProviderCountDelegate;
  readonly authProviderVerification: ProviderCountDelegate;
  readonly user: ProviderCountDelegate;
  readonly authIdentity: ProviderCountDelegate;
  readonly accountActivation: ProviderCountDelegate;
  readonly authCredentialToken: ProviderCountDelegate;
  readonly authAbuseBucket: ProviderCountDelegate;
  $disconnect(): Promise<void>;
}

function observeCookie(response: Response): DeferredCookie {
  const headerName = `set-${"cookie"}`;
  const raw = response.headers.get(headerName);
  if (raw === null) return EMPTY_DEFERRED_COOKIE;
  const segments = raw.split(";").map((segment) => segment.trim());
  const pair = segments.shift() ?? "";
  const separator = pair.indexOf("=");
  const name = separator >= 0 ? pair.slice(0, separator) : pair;
  const attributes = new Map(segments.map((segment) => {
    const index = segment.indexOf("=");
    return index < 0
      ? [segment.toLowerCase(), ""]
      : [segment.slice(0, index).toLowerCase(), segment.slice(index + 1)];
  }));
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

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function hasMethod(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function isH3PrismaClient(value: unknown): value is H3PrismaClient {
  if (!isRecord(value)) return false;
  for (const name of [
    "authProviderUser", "authProviderAccount", "authProviderSession", "authProviderVerification",
    "user", "authIdentity", "accountActivation", "authCredentialToken", "authAbuseBucket",
  ]) {
    const delegate = Reflect.get(value, name);
    if (!isRecord(delegate) || !hasMethod(delegate, "count")) return false;
  }
  return hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
}

async function readCounts(prisma: H3PrismaClient): Promise<RowCounts> {
  const [providerUser, providerAccount, providerSession, providerVerification, canonicalUser,
    authIdentity, activation, credentialToken, abuseBucket] = await Promise.all([
    prisma.authProviderUser.count(), prisma.authProviderAccount.count(), prisma.authProviderSession.count(),
    prisma.authProviderVerification.count(), prisma.user.count(), prisma.authIdentity.count(),
    prisma.accountActivation.count(), prisma.authCredentialToken.count(), prisma.authAbuseBucket.count(),
  ]);
  return { providerUser, providerAccount, providerSession, providerVerification, canonicalUser,
    authIdentity, activation, credentialToken, abuseBucket };
}

function createGeneratedPrismaClient(module: unknown, adapter: PrismaPg): H3PrismaClient {
  if (!isRecord(module)) throw new Error("STOP_H3_GENERATED_MODULE_INVALID");
  const Constructor = Reflect.get(module, "PrismaClient");
  if (typeof Constructor !== "function") throw new Error("STOP_H3_GENERATED_MODULE_INVALID");
  const client: unknown = Reflect.construct(Constructor, [{ adapter }]);
  if (!isH3PrismaClient(client)) throw new Error("STOP_H3_GENERATED_CLIENT_INVALID");
  return client;
}

test("H3 manifest rejects handler and catch-all use unconditionally while runtime remains unexecuted", () => {
  assert.equal(H3_HANDLER_BOUNDARY_RUNTIME_VERDICT, "NOT_EXECUTED");
  assert.deepEqual(HANDLER_BOUNDARY_REJECTION, {
    accepted: false,
    handlerProhibited: true,
    catchAllRouteProhibited: true,
    sourceMechanism: "base.mjs:17-40 runWithAdapter(handlerCtx.adapter) replaces the active outer adapter",
    outcomeIndependent: true,
  });
});

test("live H3 demonstrates handler adapter replacement and remains rejected", {
  skip: process.env.PASSVERO_PROOF_H3 !== "1",
}, async () => {
  const generatedPath = "../generated/client/client.js";
  const generated: unknown = await import(generatedPath);
  const adapter = new PrismaPg({ connectionString: buildConnectionString(readRunIdentity()) });
  const prisma = createGeneratedPrismaClient(generated, adapter);
  const before = await readCounts(prisma);
  let after = before;
  let handlerResponseStatus = 0;
  let handlerCookie: DeferredCookie = EMPTY_DEFERRED_COOKIE;
  try {
    const handlerSeed = createProofAuth({ prisma, adapterTransaction: false, disableSignUp: false });
    const handlerAuth = betterAuth({ ...handlerSeed.options, disabledPaths: [] });
    await assert.rejects(
      () => prisma.$transaction(async (rawTx: TransactionClient) => {
        const outerAuth = createProofAuth({ prisma: rawTx, adapterTransaction: false, disableSignUp: true });
        const outerAdapter = (await outerAuth.$context).adapter;
        await runWithTransaction(outerAdapter, async () => {
          assert.equal(await getCurrentAdapter(outerAdapter), outerAdapter);
          const response = await handlerAuth.handler(new Request(
            "https://auth-proof.invalid/internal-auth/sign-up/email",
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                name: "handler-proof",
                email: `handler-${Date.now()}@invalid.example`,
                password: "H3-handler-Aa1!",
              }),
            },
          ));
          handlerResponseStatus = response.status;
          handlerCookie = observeCookie(response);
          throw new Error("INJECTED_H3_OUTER_ROLLBACK_AFTER_HANDLER");
        });
      }, { isolationLevel: "Serializable" }),
      /INJECTED_H3_OUTER_ROLLBACK_AFTER_HANDLER/,
    );
    after = await readCounts(prisma);
    const providerEscapedOuterRollback = after.providerUser > before.providerUser
      || after.providerAccount > before.providerAccount;
    assert.ok(handlerResponseStatus >= 200 && handlerResponseStatus < 300);
    assert.equal(HANDLER_BOUNDARY_REJECTION.accepted, false);
    assert.equal(providerEscapedOuterRollback, true, "handler provider state must escape the injected outer rollback");
    assert.equal(HANDLER_BOUNDARY_REJECTION.outcomeIndependent, true);
    await writeHypothesisAssertionResult({
      id: "H3_HANDLER_CONTEXT_REPLACEMENT",
      status: "PASS",
      transactionIds: [],
      before,
      after,
      deltas: deltaRowCounts(before, after),
      cookie: handlerCookie,
      assertions: ["H3_HANDLER_REJECTION_ASSERTIONS_COMPLETE"],
      failureCode: null,
    });
  } catch (cause: unknown) {
    try {
      after = await readCounts(prisma);
      await writeHypothesisResult({
        id: "H3_HANDLER_CONTEXT_REPLACEMENT",
        status: "FAIL",
        transactionIds: [],
        before,
        after,
        deltas: deltaRowCounts(before, after),
        cookie: handlerCookie,
        assertions: [],
        failureCode: HYPOTHESIS_FAILURE_CODES.H3_HANDLER_CONTEXT_REPLACEMENT,
      });
    } catch { /* the original process failure remains authoritative */ }
    throw cause;
  } finally {
    await prisma.$disconnect();
  }
});
