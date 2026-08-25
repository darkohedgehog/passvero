import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("keeps organization authority provider-neutral and on business Prisma", () => {
  const application = read("src/application/context/resolve-authenticated-user-context.ts");
  const repository = read("src/infrastructure/context/prisma-organization-context-repository.ts");
  const runtime = read("src/infrastructure/context/organization-context-runtime.ts");

  assert.doesNotMatch(application, /better-auth|AuthProvider(?:User|Session|Account|Verification)/);
  assert.match(runtime, /^import "server-only";/);
  assert.match(runtime, /getProductionPrismaClient/);
  assert.match(runtime, /createBetterAuthSessionReader/);
  assert.match(repository, /membership\.findMany/);
  assert.match(repository, /authSessionSelection\.(?:findUnique|deleteMany|upsert)/);
  assert.doesNotMatch(repository, /AuthProvider(?:User|Session|Account|Verification)|getBetterAuthServer/);
  assert.doesNotMatch(`${application}\n${repository}`, /process\.env|DATABASE_URL|AUTH_DATABASE_URL/);
});

test("adds exactly one thin unlocalized protected smoke route", () => {
  const routePath = "app/api/auth/context-smoke/route.ts";
  assert.equal(existsSync(new URL(`../${routePath}`, import.meta.url)), true);
  const route = read(routePath);

  assert.match(route, /export const GET/);
  assert.match(route, /getContextSmokeHandler/);
  assert.doesNotMatch(
    route,
    /email|permission|membership|providerSession|token|dashboard|signUp|signIn/i,
  );
});

test("does not leak provider types or session selectors into AuthenticatedUserContext", () => {
  const context = read("src/application/context/authenticated-user-context.ts");

  assert.doesNotMatch(
    context,
    /BETTER_AUTH|provider|session|cookie|token|AuthProvider/i,
  );
});
