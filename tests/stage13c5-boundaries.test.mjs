import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relativePath) => readFileSync(path.join(root, relativePath), "utf8");

const stageSources = [
  "src/application/auth/auth-abuse-types.ts",
  "src/application/auth/auth-abuse-policy.ts",
  "src/application/auth/auth-abuse-service.ts",
  "src/application/auth/turnstile.ts",
  "src/infrastructure/auth/auth-abuse-identifiers.ts",
  "src/infrastructure/auth/auth-abuse-key.ts",
  "src/infrastructure/auth/prisma-auth-abuse-repository.ts",
  "src/infrastructure/auth/turnstile-verifier.ts",
  "src/infrastructure/auth/auth-abuse-runtime.ts",
];

test("keeps Stage 13C.5 behind a lazy server-only business Prisma composition", () => {
  const runtime = read("src/infrastructure/auth/auth-abuse-runtime.ts");
  assert.match(runtime, /^import "server-only";/);
  assert.match(runtime, /getProductionPrismaClient/);
  assert.doesNotMatch(runtime, /better-auth-server|AUTH_DATABASE_URL|DATABASE_URL|process\.env/);
  assert.doesNotMatch(runtime, /createBusinessAuthAbuseService\([^)]*\)[\s\S]*^const /m);
});

test("contains no header trust, real Turnstile network, Redis, env, or provider-table access", () => {
  const source = stageSources.map(read).join("\n");
  assert.doesNotMatch(source, /x-forwarded-for|cf-connecting-ip|forwarded/i);
  assert.doesNotMatch(source, /fetch\s*\(|challenges\.cloudflare\.com/i);
  assert.doesNotMatch(source, /redis|ioredis/i);
  assert.doesNotMatch(source, /process\.env|TURNSTILE_SECRET_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(source, /authProvider(?:User|Session|Account|Verification)\./);
});

test("keeps Stage 13C.5 free of HTTP handlers, server actions, and UI concerns", () => {
  for (const sourcePath of stageSources) {
    assert.doesNotMatch(read(sourcePath), /^["']use server["'];/m);
    assert.doesNotMatch(read(sourcePath), /NextRequest|NextResponse|export const (?:GET|POST)|TurnstileWidget/);
  }
});

test("keeps package, Prisma schema, migrations, and local env outside Stage 13C.5 sources", () => {
  assert.equal(stageSources.some((entry) => entry === "package.json"), false);
  assert.equal(stageSources.some((entry) => entry.startsWith("prisma/")), false);
  assert.equal(stageSources.some((entry) => /\.env/.test(entry)), false);
});
