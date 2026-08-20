import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HARNESS_ROOT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness",
);

const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma.config.ts",
  "src/run-root.ts",
  "src/auth.ts",
  "src/proof-boundary.ts",
  "src/evidence.ts",
  "test/harness-contract.test.ts",
];

const EXPECTED_DEPENDENCIES = {
  "@better-auth/core": "1.7.1",
  "@better-auth/prisma-adapter": "1.7.1",
  "@prisma/adapter-pg": "7.8.0",
  "@prisma/client": "7.8.0",
  "better-auth": "1.7.1",
  "pg": "8.16.3",
};

const EXPECTED_DEV_DEPENDENCIES = {
  prisma: "7.8.0",
  tsx: "4.20.6",
  typescript: "5.9.2",
};

const EXPECTED_DISABLED_PATHS = [
  "/account-info", "/callback/:id", "/change-email", "/change-password",
  "/delete-user", "/delete-user/callback", "/error", "/get-access-token",
  "/get-session", "/link-social", "/list-accounts", "/list-sessions", "/ok",
  "/refresh-token", "/request-password-reset", "/reset-password",
  "/reset-password/:token", "/revoke-other-sessions", "/revoke-session",
  "/revoke-sessions", "/send-verification-email", "/sign-in/email",
  "/sign-in/social", "/sign-out", "/sign-up/email", "/unlink-account",
  "/update-session", "/update-user", "/verify-email", "/verify-password",
];

const GENERATED_PROVIDER_SCHEMA = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma",
);

const FORBIDDEN = [
  /postgresql:\/\//i,
  /postgres:\/\//i,
  /DATABASE_URL=/,
  /TEST_DATABASE_URL=/,
  /Set-Cookie:/i,
  /token=/i,
  /password=/i,
  /\/Users\//,
];

async function readHarness(relativePath) {
  return readFile(path.join(HARNESS_ROOT, relativePath), "utf8");
}

function modelBlock(source, name) {
  const match = source.match(new RegExp(`model ${name} \\{[\\s\\S]*?^\\}`, "m"));
  assert.ok(match, `missing model ${name}`);
  return match[0];
}

test("the deterministic proof harness has the complete pinned artifact map", async () => {
  const sources = new Map();
  for (const relativePath of REQUIRED_FILES) {
    sources.set(relativePath, await readHarness(relativePath));
  }

  const manifest = JSON.parse(sources.get("package.json"));
  assert.equal(manifest.private, true);
  assert.equal(manifest.type, "module");
  assert.deepEqual(manifest.dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(manifest.devDependencies, EXPECTED_DEV_DEPENDENCIES);

  const lockfile = JSON.parse(sources.get("package-lock.json"));
  assert.equal(lockfile.lockfileVersion, 3);
  assert.deepEqual(lockfile.packages[""].dependencies, EXPECTED_DEPENDENCIES);
  assert.deepEqual(lockfile.packages[""].devDependencies, EXPECTED_DEV_DEPENDENCIES);

  const prismaConfig = sources.get("prisma.config.ts");
  assert.doesNotMatch(prismaConfig, /dotenv/);
  assert.doesNotMatch(prismaConfig, /process\.env\.(?:DATABASE_URL|TEST_DATABASE_URL)/);
  assert.doesNotMatch(prismaConfig, /(?:\.\.\/){2,}/);

  for (const [relativePath, source] of sources) {
    for (const pattern of FORBIDDEN) {
      assert.doesNotMatch(source, pattern, `${relativePath} contains forbidden ${pattern}`);
    }
  }

  for (const relativePath of [
    "prisma.config.ts",
    "src/auth.ts",
    "src/proof-boundary.ts",
  ]) {
    assert.match(
      sources.get(relativePath),
      /readRunIdentity\(/,
      `${relativePath} must fail closed through readRunIdentity()`,
    );
  }
});

test("the disposable schema is the exact reviewed provider schema plus approved proof fields", async () => {
  const schema = await readHarness("prisma/schema.prisma");
  const generated = await readFile(GENERATED_PROVIDER_SCHEMA, "utf8");
  assert.equal(
    createHash("sha256").update(schema).digest("hex"),
    "ebf7514192aafc2b8208e6a8bc906f4c275271600ca9d60e159c2fdc72f10be3",
  );

  const expectedUser = modelBlock(generated, "AuthProviderUser").replace(
    "  authprovideraccounts AuthProviderAccount[]",
    "  authprovideraccounts AuthProviderAccount[]\n  credentialTokens     AuthCredentialToken[] @relation(\"AuthProviderUserCredentialTokens\")",
  );
  assert.equal(modelBlock(schema, "AuthProviderUser"), expectedUser);

  const expectedSession = modelBlock(generated, "AuthProviderSession")
    .replace(
      "  authenticatedAt        DateTime\n  selectedOrganizationId String?",
      "  authenticatedAt        DateTime\n  lastRefreshAt          DateTime\n  selectedOrganizationId String?",
    )
    .replace("  @@index([userId])", "  @@index([userId])\n  @@index([lastRefreshAt])");
  assert.equal(modelBlock(schema, "AuthProviderSession"), expectedSession);
  assert.equal(
    modelBlock(schema, "AuthProviderAccount"),
    modelBlock(generated, "AuthProviderAccount"),
  );
  assert.equal(
    modelBlock(schema, "AuthProviderVerification"),
    modelBlock(generated, "AuthProviderVerification"),
  );

  assert.deepEqual(
    [...schema.matchAll(/^model (\w+) /gm)].map((match) => match[1]),
    [
      "User", "AuthIdentity", "AccountActivation", "AuthCredentialToken",
      "AuthAbuseBucket", "ProofMarker", "AuthProviderUser", "AuthProviderSession",
      "AuthProviderAccount", "AuthProviderVerification",
    ],
  );
  assert.deepEqual(
    [...schema.matchAll(/^enum (\w+) /gm)].map((match) => match[1]),
    ["AuthCredentialTokenPurpose", "AuthAbuseDimension"],
  );
});

test("the Better Auth factory freezes the approved security and route surface", async () => {
  const source = await readHarness("src/auth.ts");
  for (const contract of [
    /baseURL: "https:\/\/auth-proof\.invalid\/internal-auth"/,
    /basePath: "\/internal-auth"/,
    /transaction: input\.adapterTransaction/,
    /disableSignUp: input\.disableSignUp/,
    /requireEmailVerification: true/,
    /autoSignIn: false/,
    /revokeSessionsOnPasswordReset: true/,
    /disableSessionRefresh: true/,
    /cookieCache: \{ enabled: false \}/,
    /enabled: false,\s*disableImplicitLinking: true/,
    /useSecureCookies: true/,
    /secure: true,\s*httpOnly: true,\s*sameSite: "lax"/,
    /authenticatedAt: \{ type: "date", required: true, input: false \}/,
    /lastRefreshAt: \{ type: "date", required: true, input: false \}/,
    /selectedOrganizationId: \{ type: "string", required: false, input: false \}/,
  ]) assert.match(source, contract);

  const list = source.match(/DISABLED_NATIVE_PATHS = \[([\s\S]*?)\] as const/)?.[1];
  assert.ok(list, "disabled native path list missing");
  assert.deepEqual([...list.matchAll(/"([^"]+)"/g)].map((match) => match[1]), EXPECTED_DISABLED_PATHS);
});

test("proof sources forbid direct provider writes, any, and premature cookie exposure", async () => {
  const sourceNames = ["src/auth.ts", "src/evidence.ts", "src/proof-boundary.ts", "src/run-root.ts"];
  const sources = await Promise.all(sourceNames.map(readHarness));
  for (const [index, source] of sources.entries()) {
    assert.doesNotMatch(source, /\bas\s+any\b|:\s*any\b|<any>/, `${sourceNames[index]} contains any`);
    assert.doesNotMatch(
      source,
      /\.authProvider(?:User|Account|Session|Verification)\.(?:create|update|delete|upsert)\b/,
      `${sourceNames[index]} contains a direct provider write`,
    );
  }

  const boundary = sources[2];
  assert.doesNotMatch(boundary, /auth\.handler/);
  assert.doesNotMatch(boundary, /rootPrisma\.(?!\$transaction)/);
  assert.match(boundary, /const pending = await input\.rootPrisma\.\$transaction/);
  assert.match(boundary, /prisma: tx,\s*adapterTransaction: false/);
  assert.match(boundary, /runWithTransaction\(adapter/);
  assert.match(boundary, /pending\.capturedHeaders\.splice\(0, pending\.capturedHeaders\.length\)/);
  const finalizeIndex = boundary.lastIndexOf("const finalized = finalizeAfterCommit(pending)");
  const afterCommitFailureIndex = boundary.lastIndexOf('injectFailure(input.failurePoint, "AFTER_COMMIT_CALLBACK")');
  const returnIndex = boundary.lastIndexOf("return finalized");
  assert.ok(finalizeIndex > 0 && finalizeIndex < afterCommitFailureIndex);
  assert.ok(afterCommitFailureIndex < returnIndex);
});

test("run-root and tool-environment gates encode filesystem ownership and containment", async () => {
  const runRoot = await readHarness("src/run-root.ts");
  const config = await readHarness("prisma.config.ts");
  for (const contract of [
    /status\.uid !== process\.getuid\(\)/,
    /status\.mode & 0o777\) !== 0o600/,
    /status\.mode & 0o777\) !== 0o700/,
    /isSymbolicLink\(\)/,
    /realpathSync\(candidate\)/,
    /XDG cache must equal the validated harness cache/,
    /npm cache must equal the validated harness cache/,
    /TMPDIR must equal the validated harness temp directory/,
    /socket directory must be directly inside run root/,
  ]) assert.match(runRoot, contract);
  assert.ok(config.indexOf("validateDisposableHarnessEnvironment();") < config.indexOf("readRunIdentity();"));
});
