import test from "node:test";
import assert from "node:assert/strict";
import { PrismaPg } from "@prisma/adapter-pg";
import { betterAuth } from "better-auth";
import { getCurrentAdapter, runWithTransaction } from "@better-auth/core/context";
import { createProofAuth } from "../src/auth.js";
import {
  H3_HANDLER_BOUNDARY_RUNTIME_VERDICT,
  HANDLER_BOUNDARY_REJECTION,
  type BoundaryRootPrisma,
  type TransactionClient,
} from "../src/proof-boundary.js";
import { buildConnectionString, readRunIdentity } from "../src/run-root.js";

type UnknownRecord = Record<PropertyKey, unknown>;

interface ProviderCountDelegate {
  count(): Promise<number>;
}

interface H3PrismaClient extends BoundaryRootPrisma {
  readonly authProviderUser: ProviderCountDelegate;
  readonly authProviderAccount: ProviderCountDelegate;
  $disconnect(): Promise<void>;
}

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === "object";
}

function hasMethod(value: UnknownRecord, property: PropertyKey): boolean {
  return typeof Reflect.get(value, property) === "function";
}

function isH3PrismaClient(value: unknown): value is H3PrismaClient {
  if (!isRecord(value)) return false;
  const user = Reflect.get(value, "authProviderUser");
  const account = Reflect.get(value, "authProviderAccount");
  return isRecord(user) && hasMethod(user, "count")
    && isRecord(account) && hasMethod(account, "count")
    && hasMethod(value, "$transaction") && hasMethod(value, "$disconnect");
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
  const before = {
    providerUser: await prisma.authProviderUser.count(),
    providerAccount: await prisma.authProviderAccount.count(),
  };
  let handlerResponseStatus = 0;
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
          throw new Error("INJECTED_H3_OUTER_ROLLBACK_AFTER_HANDLER");
        });
      }, { isolationLevel: "Serializable" }),
      /INJECTED_H3_OUTER_ROLLBACK_AFTER_HANDLER/,
    );
    const after = {
      providerUser: await prisma.authProviderUser.count(),
      providerAccount: await prisma.authProviderAccount.count(),
    };
    const providerEscapedOuterRollback = after.providerUser > before.providerUser
      || after.providerAccount > before.providerAccount;
    assert.ok(handlerResponseStatus >= 200 && handlerResponseStatus < 300);
    assert.equal(HANDLER_BOUNDARY_REJECTION.accepted, false);
    assert.equal(providerEscapedOuterRollback, true, "handler provider state must escape the injected outer rollback");
    assert.equal(HANDLER_BOUNDARY_REJECTION.outcomeIndependent, true);
    console.log("H3_HANDLER_CONTEXT_REPLACEMENT=PASS");
  } finally {
    await prisma.$disconnect();
  }
});
