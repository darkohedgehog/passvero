import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const HARNESS_ROOT = path.join(
  process.cwd(),
  "docs/superpowers/specs/assets/2026-08-20-better-auth-transaction-proof/harness",
);
const PROOF_ROOT = path.dirname(HARNESS_ROOT);

const REQUIRED_FILES = [
  "package.json",
  "package-lock.json",
  "prisma/schema.prisma",
  "prisma.config.ts",
  "src/run-root.ts",
  "src/auth.ts",
  "src/proof-boundary.ts",
  "src/evidence.ts",
  "src/publication.mjs",
  "test/harness-contract.test.ts",
  "test/cluster-identity.test.ts",
  "test/direct-boundary.test.ts",
  "test/handler-boundary.test.ts",
  "test/controlled-activation.test.ts",
  "test/session-boundary.test.ts",
];

const TASK_5_ARTIFACT_HASHES = new Map([
  ["test/direct-boundary.test.ts", "82fa13b4acee46968f9ba5972241e73dcfb3e332e853576c75ab631c9f2b9e8d"],
  ["test/handler-boundary.test.ts", "e6ce226521e12111be4e2934e7c33bc1ab77fdef9883c463a3e4dd7dca5b4801"],
]);

const TASK_6_ARTIFACT_HASHES = new Map([
  ["src/auth.ts", "2414b3d7672b47aef1bb69cc863b3934f1c4b5580c21566b83e4f10ff2bd6080"],
  ["test/controlled-activation.test.ts", "08a2313e55174550a728cd87c03355e7baa9d6e7679f94afd658705570ae3dac"],
]);

const TASK_7_ARTIFACT_HASHES = new Map([
  ["src/proof-boundary.ts", "065de849a757aa5b5e78e3d50b178ebeee4f9295c8dd9dda8227ea100311a600"],
  ["test/session-boundary.test.ts", "cd9e5542fbcb24739fbf78d9a32983059ad2517f322a88f110bc99c7bde98d05"],
]);

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

  for (const [relativePath, expectedHash] of TASK_5_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 5 proof`,
    );
  }
  for (const [relativePath, expectedHash] of TASK_6_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 6 proof`,
    );
  }
  for (const [relativePath, expectedHash] of TASK_7_ARTIFACT_HASHES) {
    assert.equal(
      createHash("sha256").update(sources.get(relativePath)).digest("hex"),
      expectedHash,
      `${relativePath} drifted from the reviewed Task 7 proof`,
    );
  }

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
  const sourceNames = [
    "src/auth.ts", "src/evidence.ts", "src/proof-boundary.ts", "src/run-root.ts",
    "test/session-boundary.test.ts",
  ];
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

  const directBoundary = await readHarness("test/direct-boundary.test.ts");
  assert.match(directBoundary, /AssertNever<Extract<"handler", keyof DirectAuthApi>>/);
  assert.match(
    directBoundary,
    /return providerUserId;\s*}\s*const canonicalId = await createCanonicalAndAbuse[\s\S]*?failAt\(failurePoint, "AFTER_CANONICAL_WRITE"\);[\s\S]*?const providerUserId = await createProviderCredential[\s\S]*?failAt\(failurePoint, "AFTER_PROVIDER_WRITE"\);[\s\S]*?await linkAndConsumeCredential/,
  );
  assert.match(boundary, /api: DirectAuthApi/);

  const handlerBoundary = await readHarness("test/handler-boundary.test.ts");
  assert.doesNotMatch(handlerBoundary, /providerTransactionIds|instrumentProviderWrites|STOP_H3_TRANSACTION_ID_INVALID/);
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
    /randomBytes\(/,
    /mode: 0o600, flag: "wx"/,
  ]) assert.match(runRoot, contract);
  assert.ok(config.indexOf("validateDisposableHarnessEnvironment();") < config.indexOf("readRunIdentity();"));
});

test("the proof runner encodes a static-only mode and fail-closed PostgreSQL lifecycle", async () => {
  const source = await readFile(path.join(PROOF_ROOT, "run-proof.sh"), "utf8");
  for (const contract of [
    /set -euo pipefail/,
    /umask 077/,
    /\[\[ \$# -eq 1 \]\]/,
    /--static\|--all/,
    /PROOF_PORT=55432/,
    /PG_BIN=\/opt\/homebrew\/opt\/postgresql@16\/bin/,
    /mktemp -d \/private\/tmp\/passvero-stage13a-pg\.XXXXXX/,
    /PASSVERO_STAGE13A_PG_V1/,
    /\/usr\/sbin\/lsof -nP -iTCP:\$\{PROOF_PORT\} -sTCP:LISTEN/,
    /pg_isready" -h 127\.0\.0\.1 -p "\$PROOF_PORT"/,
    /validate_cleanup_target/,
    /trap cleanup EXIT/,
    /CLEANUP=FAIL_RETAINED:/,
    /rm -rf -- "\$RUN_ROOT_REAL"/,
    /prepare-cleanup-evidence/,
    /\.cleanup-evidence-prepared/,
    /fs\.lstatSync\(candidate\)/,
    /validate_delete_target/,
  ]) assert.match(source, contract);

  const staticBody = source.match(/run_static\(\) \{([\s\S]*?)^\}/m)?.[1];
  assert.ok(staticBody, "run_static must be a separately reviewable function");
  assert.doesNotMatch(staticBody, /\b(?:initdb|pg_ctl|createdb|psql)\b|generated\/prisma/);
  assert.match(staticBody, /node_modules\/typescript\/bin\/tsc --noEmit --strict/);
  for (const task5TypeInput of [
    "src/proof-boundary.ts",
    "test/direct-boundary.test.ts",
    "test/handler-boundary.test.ts",
    "test/controlled-activation.test.ts",
    "test/session-boundary.test.ts",
  ]) {
    assert.match(staticBody, new RegExp(task5TypeInput.replaceAll("/", "\\/\\s*")));
  }

  for (const forbidden of [
    /docker/i,
    /source\s+\.env/,
    /DATABASE_URL/,
    /TEST_DATABASE_URL/,
    /rm -rf \/(?:\s|$)/,
    /rm -rf[^\n]*[*?\[]/,
    /PROOF_PORT\s*=\s*\$\(\(|PROOF_PORT\+\+|55433/,
  ]) assert.doesNotMatch(source, forbidden);

  assert.doesNotMatch(source, /RUN_ROOT_REAL\/prepared-evidence|publish_candidate[^\n]*\|\| true/);
  const publication = await readHarness("src/publication.mjs");
  const markdownPublication = publication.indexOf("await renamePublication(stageMarkdown, finalMarkdown)");
  const jsonPublication = publication.indexOf("await renamePublication(stageJson, finalJson)");
  assert.ok(markdownPublication > 0 && jsonPublication > markdownPublication, "authoritative JSON must publish last");
  assert.match(source, /"\$proof_status" -eq 0 && "\$mandatory_verdict" == PASS && "\$suffix" == 1111/);
  assert.match(source, /mandatory-verdict/);
  assert.match(source, /"\$candidate" != "pass-1111"/);
  assert.match(source, /CLEANUP=FAIL_PROOF_WITH_COMPLETE_CLEANUP/);
  assert.ok(publication.indexOf("await stage(input.candidate)") < publication.indexOf("await input.retirePending(pendingPath)"));
  assert.ok(publication.indexOf("await input.retirePending(pendingPath)") < publication.indexOf("await input.inspectPending(pendingPath)"));
  assert.ok(publication.indexOf("await input.inspectPending(pendingPath)") < publication.indexOf("pendingRetired = true"));
  assert.ok(publication.indexOf("pendingRetired = true") < publication.indexOf("await commit()"));
  assert.match(source, /publish_checked_failure "\$candidate" "\$failure_status"/);
  assert.match(publication, /FAIL_PENDING_RETAINED/);
  assert.match(source, /CLEANUP=FAIL_PUBLICATION_RECOVERED/);
  assert.match(source, /CLEANUP=FAIL_PUBLICATION_STAGED/);

  const runRoot = await readHarness("src/run-root.ts");
  assert.match(runRoot, /renderEvidenceJson\(\{ \.\.\.pending, cleanup: \{\} \}\)/);
  assert.match(runRoot, /validateGeneratedSql/);
  assert.match(runRoot, /generated SQL must contain the exact table count/);
  assert.match(runRoot, /exact quoted unqualified identifiers/);
});
