import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const list = (directory) => readdirSync(new URL(`../${directory}`, import.meta.url), {
  recursive: true,
}).map((path) => `${directory}/${path}`).filter((path) => /\.(?:ts|tsx)$/.test(path));

test("keeps application auth lifecycle provider-neutral and credential-secret free", () => {
  const application = list("src/application/auth").map(read).join("\n");

  assert.doesNotMatch(application, /nodemailer|SMTP_|PrismaClient|AuthProvider(?:User|Account|Verification|Session)/);
  assert.doesNotMatch(application, /process\.env|DATABASE_URL|AUTH_DATABASE_URL/);
});

test("keeps Nodemailer and environment access behind lazy server-only boundaries", () => {
  const boundary = read("src/infrastructure/auth/nodemailer-auth-email-sender.ts");
  const runtime = read("src/infrastructure/auth/auth-email-runtime.ts");
  const core = read("src/infrastructure/auth/nodemailer-auth-email-sender-core.ts");

  assert.match(boundary, /^import "server-only";/);
  assert.match(runtime, /^import "server-only";/);
  assert.match(runtime, /async send\(message\)[\s\S]*validateSmtpConfig\(process\.env\)/);
  assert.match(core, /from "nodemailer"/);
  assert.doesNotMatch(core, /process\.env|rejectUnauthorized|tls:/);
});

test("adds no auth, activation, verification, reset, signup, or login HTTP route", () => {
  const routes = readdirSync(new URL("../app", import.meta.url), {
    recursive: true,
  }).map(String);

  assert.equal(routes.some((path) => /(?:auth|login|signup|activate|reset|verify)/i.test(path)), false);
  assert.equal(routes.some((path) => /\[\.\.\./.test(path)), false);
});

test("keeps provider writes inside Better Auth and business writes inside business Prisma", () => {
  const provider = `${read("src/infrastructure/auth/better-auth-server.ts")}\n${read("src/infrastructure/auth/better-auth-lifecycle-adapter.ts")}`;
  const business = read("src/infrastructure/auth/prisma-controlled-activation.ts");

  assert.doesNotMatch(provider, /authIdentity\.|accountActivationIntent\.|authAuditEvent\./);
  assert.doesNotMatch(business, /authProvider(?:User|Account|Verification|Session)\./i);
  assert.match(business, /accountActivationIntent\./);
  assert.match(business, /authIdentity\./);
  assert.match(business, /authAuditEvent\./);
});

test("binds identity only from the Better Auth verified-email callback", () => {
  const server = read("src/infrastructure/auth/better-auth-server.ts");
  const composition = read("src/infrastructure/auth/stage13c4-auth-lifecycle.ts");
  const completion = read("src/application/auth/complete-verified-activation.ts");

  assert.match(server, /onEmailVerified/);
  assert.doesNotMatch(composition, /completeVerifiedActivation\s*:/);
  assert.doesNotMatch(completion, /emailVerified/);
});

test("declares only the approved SMTP dependency additions", () => {
  const packageJson = JSON.parse(read("package.json"));

  assert.equal(packageJson.dependencies.nodemailer, "9.0.5");
  assert.equal(packageJson.devDependencies["@types/nodemailer"], "8.0.1");
});
