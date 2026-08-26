import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const approved = [
  "app/api/auth/activate/route.ts",
  "app/api/auth/context-smoke/route.ts",
  "app/api/auth/organization-selection/route.ts",
  "app/api/auth/password/change/route.ts",
  "app/api/auth/password-reset/consume/route.ts",
  "app/api/auth/password-reset/request/route.ts",
  "app/api/auth/sign-in/route.ts",
  "app/api/auth/sign-out/route.ts",
  "app/api/auth/verification/consume/route.ts",
  "app/api/auth/verification/request/route.ts",
].sort();

test("exposes only the approved explicit auth and context routes", () => {
  assert.deepEqual(authRoutes(), approved);
  assert.equal(approved.some((entry) => entry.includes("[...")), false);
  assert.equal(approved.some((entry) => /sign-up|signup|oauth|magic|passkey|mfa/i.test(entry)), false);
  for (const entry of approved) assert.equal(existsSync(path.join(root, entry)), true);
});

test("keeps routes as thin Passvero-owned handlers without catch-all capabilities", () => {
  const stage13c6Routes = approved.filter(
    (entry) => !/context-smoke|organization-selection/.test(entry),
  );
  const source = stage13c6Routes.map((entry) => readFileSync(path.join(root, entry), "utf8")).join("\n");
  assert.doesNotMatch(source, /signUpEmail|AuthProvider(?:User|Session|Account|Verification)/);
  assert.doesNotMatch(source, /Organization|Membership|AuthSessionSelection|dashboard/i);
  assert.doesNotMatch(source, /\[\.\.\.|betterAuthHandler|toNextJsHandler/);
  assert.doesNotMatch(source, /x-forwarded-for|x-forwarded-host|forwarded|host\b/i);

  const runtime = readFileSync(path.join(root, "src/infrastructure/auth/explicit-auth-http-runtime.ts"), "utf8");
  assert.match(runtime, /^import "server-only";/);
  assert.match(runtime, /createRuntimeTurnstileVerifier/);
  assert.doesNotMatch(runtime, /Turnstile verification is unavailable/);
  assert.doesNotMatch(runtime, /fetch\s*\(|challenges\.cloudflare\.com|TURNSTILE_SECRET_KEY|NEXT_PUBLIC_TURNSTILE_SITE_KEY/);
  assert.doesNotMatch(runtime, /organization\.|membership\.|authSessionSelection\./i);
});

function authRoutes() {
  const base = path.join(root, "app/api/auth");
  if (!existsSync(base)) return [];
  return walk(base)
    .filter((entry) => entry.endsWith("/route.ts"))
    .map((entry) => path.relative(root, entry))
    .sort();
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}
