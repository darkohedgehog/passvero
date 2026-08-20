import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const reviewPath =
  "docs/superpowers/reviews/2026-08-20-better-auth-foundation-review.md";
const proposalPath =
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-prisma-fragment.prisma";
const migrationContractPath =
  "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/proposed-migration-contract.md";

function modelBlock(schema, modelName) {
  return schema.match(new RegExp(`model ${modelName}\\s*\\{[\\s\\S]*?^\\}`, "m"))?.[0];
}

function contractSection(contract, heading, nextHeading) {
  return contract.match(
    new RegExp("### `" + heading + "`[\\s\\S]*?(?=### `" + nextHeading + "`)"),
  )?.[0];
}

const resetEvidenceCitations = [
  "better-auth/dist/api/routes/password.mjs:74-87",
  "@better-auth/core/dist/types/init-options.d.mts:1173-1182",
  "better-auth/dist/db/verification-token-storage.mjs:4-12",
  "better-auth/dist/api/routes/password.mjs:157-174",
  "better-auth/dist/db/internal-adapter.mjs:818-845",
  "@better-auth/prisma-adapter/dist/index.mjs:319-332",
];

function assertResetEvidenceChain(review) {
  const section = review.match(
    /### Token-storage reconciliation[\s\S]*?(?=\*\*Required before Stage 13E:\*\*)/,
  )?.[0];
  assert.ok(section, "missing reset token-storage reconciliation section");

  let previousIndex = -1;
  for (const citation of resetEvidenceCitations) {
    const citationIndex = section.indexOf(citation);
    assert.ok(
      citationIndex > previousIndex,
      `missing or out-of-order reset evidence citation: ${citation}`,
    );
    previousIndex = citationIndex;
  }

  assert.match(section, /generates a token and persists\s+`reset-password:<raw token>`/s);
  assert.match(section, /defaults verification identifier storage to `plain`/s);
  assert.match(section, /passes an absent\/`plain` identifier through unchanged/s);
  assert.match(section, /calls `consumeVerificationValue` before password mutation/s);
  assert.match(section, /latest identifier row inside the internal consume lock\/transaction[\s\S]*?`consumeOne` by unique id/);
  assert.match(section, /atomically deletes and returns null to a losing\s+concurrent caller/s);
}

test("authentication review records the exact candidate versions and exclusions", async () => {
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /better-auth: 1\.7\.1/);
  assert.match(review, /@better-auth\/prisma-adapter: 1\.7\.1/);
  assert.match(review, /Prisma: 7\.8\.0/);
  assert.match(review, /Organization plugin: EXCLUDED/);
  assert.match(review, /Admin plugin: EXCLUDED/);
  assert.match(review, /OAuth plugin: EXCLUDED/);
  assert.match(review, /Magic-link plugin: EXCLUDED/);
  assert.match(review, /2FA plugin: EXCLUDED/);
  assert.match(review, /Passkey plugin: EXCLUDED/);
  assert.match(review, /Redis: EXCLUDED/);
  assert.match(review, /Public signup: EXCLUDED/);
  assert.match(review, /Automatic linking: EXCLUDED/);
  assert.match(review, /Database connection performed: NO/);
});

test("raw candidate contains the four isolated provider models", async () => {
  const schema = await readFile(
    "docs/superpowers/specs/assets/2026-08-20-better-auth-foundation/generated-prisma-schema.prisma",
    "utf8",
  );
  for (const model of [
    "AuthProviderUser",
    "AuthProviderSession",
    "AuthProviderAccount",
    "AuthProviderVerification",
  ]) {
    assert.match(schema, new RegExp(`model ${model} \\{`));
  }
  assert.doesNotMatch(schema, /model Organization\s*\{/);
  assert.doesNotMatch(schema, /model Membership\s*\{/);
});

test("proposal keeps provider identity separate and binds by stable subject", async () => {
  const schema = await readFile(proposalPath, "utf8");
  const identity = modelBlock(schema, "AuthIdentity");
  assert.ok(identity);
  assert.match(identity, /provider\s+String/);
  assert.match(identity, /providerSubject\s+String/);
  assert.match(identity, /userId\s+String\s+@db\.Uuid/);
  assert.match(identity, /@@unique\(\[provider, providerSubject\]\)/);
  assert.match(identity, /user\s+User\s+@relation/);
  assert.doesNotMatch(identity, /email/);
});

test("proposal covers server session, activation, and progressive abuse state", async () => {
  const schema = await readFile(proposalPath, "utf8");
  assert.match(schema, /authenticatedAt\s+DateTime/);
  assert.match(schema, /lastRefreshAt\s+DateTime/);
  assert.match(schema, /selectedOrganizationId\s+String\?\s+@db\.Uuid/);
  const session = modelBlock(schema, "AuthProviderSession");
  assert.ok(session);
  assert.match(session, /@@index\(\[lastRefreshAt\]\)/);
  assert.doesNotMatch(session, /\b(role|roles|permission|permissions)\b/i);
  assert.match(schema, /model AccountActivation\s*\{/);
  assert.match(schema, /tokenDigest\s+String\s+@unique/);
  assert.match(schema, /model AuthCredentialToken\s*\{/);
  const activation = modelBlock(schema, "AccountActivation");
  assert.ok(activation);
  assert.match(activation, /id\s+String\s+@id @default\(uuid\(\)\) @db\.Uuid/);
  assert.match(activation, /userId\s+String\s+@db\.Uuid/);
  assert.match(activation, /intendedEmailDigest\s+String\s+@db\.VarChar\(43\)/);
  assert.match(activation, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.doesNotMatch(activation, /^\s*(?:email|intendedEmail)\s+/m);
  const abuse = modelBlock(schema, "AuthAbuseBucket");
  assert.ok(abuse);
  assert.match(abuse, /keyDigest\s+String\s+@unique/);
  assert.match(abuse, /attemptCount\s+Int\s+@default\(0\)/);
  assert.match(abuse, /failureCount\s+Int\s+@default\(0\)/);
  assert.match(abuse, /backoffLevel\s+Int\s+@default\(0\)/);
  assert.match(abuse, /windowStartedAt\s+DateTime/);
  assert.match(abuse, /lastFailureAt\s+DateTime\?/);
  assert.match(abuse, /backoffUpdatedAt\s+DateTime/);
  assert.doesNotMatch(abuse, /email\s+String/);
  assert.doesNotMatch(abuse, /ipAddress\s+String/);
});

test("session extensions are server-owned and absolute lifetime is enforced", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  const session = contractSection(contract, "AuthProviderSession", "AuthProviderAccount");
  assert.ok(session);
  assert.match(session, /\| `authenticatedAt` \| `TIMESTAMP\(3\)` \| no \| none \|/);
  assert.match(session, /\| `lastRefreshAt` \| `TIMESTAMP\(3\)` \| no \| none \|/);
  assert.match(session, /\| `selectedOrganizationId` \| `UUID` \| yes \| none \|/);
  assert.match(session, /ck_auth_provider_session_absolute_expiry/);
  assert.match(session, /expiresAt.*<=.*authenticatedAt.*INTERVAL '30 days'/s);
  assert.match(session, /ck_auth_provider_session_inactivity_expiry.*expiresAt.*<=.*lastRefreshAt.*INTERVAL '7 days'/s);
  assert.match(session, /ck_auth_provider_session_refresh_order.*authenticatedAt <=\s+lastRefreshAt.*lastRefreshAt <= updatedAt/s);
  assert.match(session, /ck_auth_provider_session_authenticated_origin.*authenticatedAt <=\s+createdAt/s);
  assert.match(session, /AuthProviderSession_lastRefreshAt_idx/);
  assert.match(session, /AuthProviderSession_userId_fkey.*ON DELETE CASCADE ON UPDATE CASCADE/s);
  assert.match(session, /AuthProviderSession_selectedOrganizationId_fkey.*ON DELETE SET NULL ON UPDATE CASCADE/s);
  assert.match(contract, /authenticatedAt:\s*\{\s*type: "date",\s*required: true,\s*input: false,\s*defaultValue: \(\) => new Date\(\)/s);
  assert.match(contract, /lastRefreshAt:\s*\{\s*type: "date",\s*required: true,\s*input: false,\s*defaultValue: \(\) => new Date\(\)/s);
  assert.match(contract, /selectedOrganizationId:\s*\{\s*type: "string",\s*required: false,\s*input: false,?\s*\}/s);
  assert.match(contract, /disableSessionRefresh: true/);
  assert.match(contract, /reviewed Passvero session service\/adapter boundary is REQUIRED before Stage\s+13E and is the only session create\/read\/refresh\/rotate\/revoke\/password-change\s+entry point/is);
  assert.match(contract, /dedicated CSRF-protected organization-selection mutation/i);
  assert.match(contract, /organization-selection mutation.*updates `updatedAt`.*MUST NOT (?:modify|advance) `lastRefreshAt`/is);
  assert.match(contract, /24-hour refresh.*lastRefreshAt/is);
  assert.match(contract, /native `\/get-session` route.*(?:not exposed|unreachable)/is);
  assert.match(contract, /request middleware and\s+application endpoints call only the reviewed Passvero session boundary for\s+authoritative reads and refresh/is);
  assert.match(contract, /no native route may be an alternate session-read path/is);
  assert.match(contract, /7-day inactivity expiry/i);
  assert.match(contract, /24-hour refresh/i);
  assert.match(contract, /30-day absolute/i);
  assert.match(contract, /atomic opaque-token rotation/i);
  assert.match(contract, /authenticated password change/i);
  assert.match(contract, /delete every session row/i);
  assert.match(contract, /bounded\s+batches at least hourly/i);
});

test("credential token tables have exact digest, lifetime, single-use, and FK contracts", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  const credential = contractSection(contract, "AuthCredentialToken", "AccountActivation");
  assert.ok(credential);
  assert.match(credential, /\| `tokenDigest` \| `VARCHAR\(43\)` \| no \| none \|/);
  assert.match(credential, /AuthCredentialToken_providerUserId_fkey.*ON DELETE CASCADE ON UPDATE CASCADE/s);
  assert.match(credential, /ux_auth_credential_token_one_active_per_provider_user_purpose/);
  assert.match(credential, /where `consumedAt IS NULL AND invalidatedAt IS NULL`/);
  assert.match(credential, /ck_auth_credential_token_digest.*\^\[A-Za-z0-9_-\]\{43\}\$/s);
  assert.match(contract, /24 hours for `EMAIL_VERIFICATION`, 30 minutes for\s+`PASSWORD_RESET`, and 24 hours for `AccountActivation`/s);
  assert.match(contract, /one atomic conditional update,\s+never read-then-update/i);
});

test("activation binds the capability to the current canonical intended email", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  const activation = contractSection(contract, "AccountActivation", "AuthAbuseBucket");
  assert.ok(activation);
  assert.match(activation, /\| `intendedEmailDigest` \| `VARCHAR\(43\)` \| no \| none \|/);
  assert.match(activation, /ck_account_activation_intended_email_digest/);
  assert.match(activation, /ux_account_activation_one_active_per_user/);
  assert.match(activation, /consumedAt IS NULL AND invalidatedAt IS NULL/);
  assert.match(contract, /lock.*canonical `User`.*normalize.*current canonical email.*intendedEmailDigest/is);
  assert.match(contract, /constant-time equality/i);
  assert.match(contract, /email mutation.*invalidates every active activation/is);
});

test("abuse contract fixes endpoint applicability, normalization, and schedule", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  const abuse = contract.match(/### `AuthAbuseBucket`[\s\S]*?(?=## Digest and allowed-dimension contract)/)?.[0];
  assert.ok(abuse);
  assert.match(abuse, /\| `windowStartedAt` \| `TIMESTAMP\(3\)` \| no \| none \|/);
  assert.match(abuse, /\| `lastFailureAt` \| `TIMESTAMP\(3\)` \| yes \| none \|/);
  assert.match(abuse, /\| `backoffUpdatedAt` \| `TIMESTAMP\(3\)` \| no \| none \|/);
  assert.match(abuse, /\| `attemptCount` \| `INTEGER` \| no \| `0` \|/);
  assert.match(abuse, /ck_auth_abuse_bucket_digest.*\^\[A-Za-z0-9_-\]\{43\}\$/s);
  assert.match(abuse, /ck_auth_abuse_bucket_attempt_count.*attemptCount >= 0/s);
  assert.match(abuse, /ck_auth_abuse_bucket_backoff_level.*BETWEEN 0 AND 12/s);
  assert.match(abuse, /ck_auth_abuse_bucket_backoff_time.*backoffUpdatedAt <= updatedAt/s);
  assert.match(abuse, /ck_auth_abuse_bucket_failure_decay_order.*lastFailureAt IS NULL OR\s+lastFailureAt <= backoffUpdatedAt/s);
  assert.match(abuse, /ck_auth_abuse_bucket_retention.*INTERVAL '30 days'/s);
  for (const endpoint of [
    "SIGN_IN_PASSWORD",
    "SEND_EMAIL_VERIFICATION",
    "REQUEST_PASSWORD_RESET",
    "ISSUE_ACCOUNT_ACTIVATION",
    "CHANGE_PASSWORD",
  ]) {
    assert.match(
      contract,
      new RegExp(
        "\\| `" + endpoint + "` \\| YES \\| YES \\| YES \\| YES \\|",
      ),
    );
  }
  for (const endpoint of [
    "CONSUME_EMAIL_VERIFICATION",
    "CONSUME_PASSWORD_RESET",
    "CONSUME_ACCOUNT_ACTIVATION",
  ]) {
    assert.match(
      contract,
      new RegExp(
        "\\| `" + endpoint + "` \\| YES \\| POST-LOOKUP \\| POST-LOOKUP \\| YES \\|",
      ),
    );
  }
  assert.match(contract, /token-only invalid or unknown.*TRUSTED_NETWORK.*GLOBAL_ENDPOINT/is);
  assert.match(contract, /rightmost untrusted address/i);
  assert.match(contract, /Missing mode, missing\/invalid CIDRs.*fails closed/is);
  assert.match(contract, /IPv4-mapped IPv6/i);
  assert.match(contract, /203\.0\.113\.197.*203\.0\.113\.0\/24/s);
  assert.match(contract, /2001:0db8:abcd:1234.*2001:db8:abcd:1200::\/56/s);
  assert.match(contract, /User@Example\.COM.*user@example\.com/s);
  assert.match(contract, /SERIALIZABLE transaction/i);
  assert.match(contract, /Stage A.*`GLOBAL_ENDPOINT`.*`TRUSTED_NETWORK`.*admission/is);
  assert.match(contract, /token digest lookup.*after Stage A.*before Stage B/is);
  assert.match(contract, /Stage B.*`ACCOUNT_IDENTIFIER`.*`ACCOUNT_AND_TRUSTED_NETWORK`/is);
  assert.match(contract, /unknown token.*network\/global.*commit/is);
  assert.match(contract, /`CONSUME_ACCOUNT_ACTIVATION`.*current canonical `User\.email`.*not `intendedEmailDigest`/is);
  for (const row of [
    "| `TRUSTED_NETWORK` | 30 | 15 minutes | failed protected action |",
    "| `ACCOUNT_IDENTIFIER` | 5 | 15 minutes | failed protected action |",
    "| `ACCOUNT_AND_TRUSTED_NETWORK` | 5 | 15 minutes | failed protected action |",
    "| `GLOBAL_ENDPOINT` | 100 | 1 minute | every admitted request |",
  ]) {
    assert.match(contract, new RegExp(row.replace(/[|]/g, "\\|")));
  }
  for (const [level, duration] of [
    [0, "0 minutes"],
    [1, "1 minute"],
    [2, "2 minutes"],
    [3, "4 minutes"],
    [4, "8 minutes"],
    [5, "15 minutes"],
    [6, "30 minutes"],
    [7, "60 minutes"],
    [8, "120 minutes"],
    [9, "240 minutes"],
    [10, "480 minutes"],
    [11, "720 minutes"],
    [12, "1,440 minutes"],
  ]) {
    assert.match(
      contract,
      new RegExp("\\| " + level + " \\| " + duration + " \\|"),
    );
  }
  assert.match(contract, /one level per\s+complete 24 hours/i);
  assert.match(contract, /elapsedPeriods = floor\(\(now - backoffUpdatedAt\) \/ 24 hours\)/);
  assert.match(contract, /decaySteps = min\(backoffLevel, elapsedPeriods\)/);
  assert.match(contract, /backoffUpdatedAt = backoffUpdatedAt \+ decaySteps \* 24 hours/);
  assert.match(contract, /every protected-action failure.*backoffUpdatedAt = now/is);
  assert.match(contract, /GLOBAL_ENDPOINT.*raises.*backoffUpdatedAt = now/is);
});

test("review records the Better Auth hard gates with precise source lines", async () => {
  const review = await readFile(reviewPath, "utf8");
  assert.match(review, /@better-auth\/core\/dist\/db\/type\.d\.mts:31-53/);
  assert.match(review, /better-auth\/dist\/db\/schema\.mjs:59-108/);
  assert.match(review, /better-auth\/dist\/api\/routes\/update-session\.mjs:31-54/);
  assert.match(review, /better-auth\/dist\/db\/internal-adapter\.mjs:248-320/);
  assert.match(review, /@better-auth\/core\/dist\/types\/init-options\.d\.mts:905-918/);
  assert.match(review, /better-auth\/dist\/api\/routes\/session\.mjs:171-207/);
  assert.match(review, /better-auth\/dist\/api\/routes\/session\.mjs:411-441/);
  assert.match(review, /better-auth\/dist\/api\/routes\/update-user\.mjs:180-189/);
  assert.match(review, /better-auth\/dist\/api\/routes\/email-verification\.mjs:23-35/);
  assert.match(review, /better-auth\/dist\/api\/routes\/email-verification\.mjs:13-18/);
  assert.match(review, /better-auth\/dist\/api\/routes\/email-verification\.mjs:173-186/);
  assert.match(review, /better-auth\/dist\/db\/internal-adapter\.mjs:818-845/);
  assert.match(review, /@better-auth\/prisma-adapter\/dist\/index\.mjs:319-332/);
  assert.match(review, /reviewed Passvero session service\/adapter boundary/i);
  assert.match(review, /Required before Stage 13E/);
});

test("review preserves the complete Better Auth reset evidence chain", async () => {
  const review = await readFile(reviewPath, "utf8");
  assertResetEvidenceChain(review);

  for (const citation of resetEvidenceCitations) {
    const missingCitation = review.replace(citation, "[removed reset evidence citation]");
    assert.throws(
      () => assertResetEvidenceChain(missingCitation),
      new RegExp(`missing or out-of-order reset evidence citation: ${citation.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
    );
  }
});

test("migration contract fixes token lifecycle, abuse retention, and deployment gates", async () => {
  const contract = await readFile(migrationContractPath, "utf8");
  for (const dimension of [
    "TRUSTED_NETWORK",
    "ACCOUNT_IDENTIFIER",
    "ACCOUNT_AND_TRUSTED_NETWORK",
    "GLOBAL_ENDPOINT",
  ]) {
    assert.match(contract, new RegExp(`\\b${dimension}\\b`));
  }
  assert.match(contract, /predecessor invalidation/i);
  assert.match(contract, /atomic conditional update/i);
  assert.match(contract, /partial unique index/i);
  assert.match(contract, /30 days/);
  assert.match(contract, /Plaintext email, IP address, network, user agent, password, and token columns: FORBIDDEN/);
  for (const rule of [
    "Better Auth CLI migration execution: FORBIDDEN",
    "Prisma db push: FORBIDDEN",
    "Direct SQL execution during review: FORBIDDEN",
    "Canonical migration directory mutation during review: FORBIDDEN",
    "Future migration requires schema tests before deployment: YES",
    "Future migration deployment requires separate operator authorization: YES",
    "Existing 16 migration sources must retain approved hashes: YES",
  ]) {
    assert.match(contract, new RegExp(rule));
  }
});

test("password contract preserves NFC equivalence and rejects the Better Auth default", async () => {
  const review = await readFile(reviewPath, "utf8");
  const password = review.match(
    /### Mandatory NFC password boundary[\s\S]*?(?=## Rejected native and alternative behaviors)/,
  )?.[0];
  assert.ok(password);
  assert.match(password, /@better-auth\/utils\/dist\/password\.node\.mjs:3-41/);
  assert.match(password, /@better-auth\/core\/dist\/types\/init-options\.d\.mts:720-733/);
  assert.match(password, /NFKC.*broader equivalence class/is);
  assert.match(password, /NFC exactly once before every\s+length, common, contextual, compromised, hash, and comparison operation/is);
  assert.match(password, /no\s+trimming, truncation, or second normalization/is);
  assert.match(password, /emailAndPassword\.password\.hash/);
  assert.match(password, /emailAndPassword\.password\.verify/);
  assert.match(password, /N = 16384/);
  assert.match(password, /r = 16/);
  assert.match(password, /p = 1/);
  assert.match(password, /dkLen = 64/);
  assert.match(password, /maxmem = 128 \* N \* r \* 2 = 67,108,864 bytes/);
  assert.match(password, /cryptographically random 16-byte salt/);
  assert.match(password, /UTF-8 bytes/);
  assert.match(password, /\$passvero\$scrypt\$v=1\$N=16384\$r=16\$p=1\$dkLen=64\$/);
  assert.match(password, /22-character unpadded base64url salt/);
  assert.match(password, /86-character unpadded base64url derived key/);
  assert.match(password, /strict full-string parser/i);
  assert.match(password, /timingSafeEqual/);
  assert.match(password, /generic authentication\s+failure/i);
  assert.match(password, /Better Auth default `<hex-salt>:<hex-key>`.*MUST NOT be accepted/is);
  assert.match(password, /hard gate before Stage 13E/i);
  assert.match(password, /no\s+existing Passvero authentication credentials require legacy migration/i);
  assert.match(password, /rehash.*successful authentication.*same transaction/is);
  assert.match(
    review,
    /\| Better Auth default password hash\/verify \| \*\*REJECT\*\* \|[^\n]*NFKC/,
  );
});

test("review stage leaves implementation paths unchanged", async () => {
  const review = await readFile(reviewPath, "utf8");
  for (const row of [
    "| Next.js 16 and React 19 compatibility | **PASS** |",
    "| Prisma 7 and PostgreSQL adapter compatibility | **PASS** |",
    "| Provider-table isolation from canonical `User` | **PASS** |",
    "| Stable provider-subject binding and multi-identity support | **PASS** |",
    "| Database-authoritative session and lifetime policy | **PASS** |",
    "| Rotation preserves `authenticatedAt` | **PASS** |",
    "| Organization selection without authorization snapshots | **PASS** |",
    "| Verification, reset, and activation token lifecycle | **PASS** |",
    "| Password hashing ownership | **PASS** |",
    "| Progressive PostgreSQL abuse control | **PASS** |",
    "| Excluded secondary/native capabilities | **PASS** |",
    "| Migration and exit cost | **OPERATOR DECISION REQUIRED** |",
    "| Rollback and forward compatibility | **PASS** |",
  ]) {
    assert.ok(review.includes(row), `missing final matrix row: ${row}`);
  }

  const packageJson = await readFile("package.json", "utf8");
  assert.doesNotMatch(packageJson, /"better-auth"/);
  const canonicalSchema = await readFile("prisma/schema.prisma", "utf8");
  assert.doesNotMatch(canonicalSchema, /model AuthProviderUser\s*\{/);
  assert.doesNotMatch(canonicalSchema, /model AuthIdentity\s*\{/);
});
