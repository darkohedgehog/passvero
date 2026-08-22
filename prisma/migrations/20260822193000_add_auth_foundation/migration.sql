-- CreateEnum
CREATE TYPE "AuthIdentityProvider" AS ENUM ('BETTER_AUTH');

-- CreateEnum
CREATE TYPE "AccountActivationStatus" AS ENUM ('ISSUED', 'IN_PROGRESS', 'AUTH_ACCOUNT_CREATED', 'EMAIL_VERIFIED', 'BOUND', 'EXPIRED', 'REVOKED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "AuthAbuseDimension" AS ENUM ('TRUSTED_NETWORK', 'ACCOUNT_IDENTIFIER', 'ACCOUNT_AND_TRUSTED_NETWORK', 'GLOBAL_ENDPOINT');

-- CreateEnum
CREATE TYPE "AuthAbuseEndpoint" AS ENUM ('SIGN_IN', 'ACTIVATE_ACCOUNT', 'EMAIL_VERIFICATION_REQUEST', 'EMAIL_VERIFICATION_CONSUME', 'PASSWORD_RESET_REQUEST', 'PASSWORD_RESET_CONSUME', 'PASSWORD_CHANGE');

-- CreateTable
CREATE TABLE "AuthProviderUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProviderUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProviderSession" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "AuthProviderSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProviderAccount" (
    "id" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProviderAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthProviderVerification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthProviderVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthIdentity" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL,
    "providerSubject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountActivationIntent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL DEFAULT 'BETTER_AUTH',
    "status" "AccountActivationStatus" NOT NULL DEFAULT 'ISSUED',
    "tokenDigest" VARCHAR(43) NOT NULL,
    "intendedEmailDigest" VARCHAR(43) NOT NULL,
    "providerSubject" TEXT,
    "claimId" UUID,
    "claimedAt" TIMESTAMP(3),
    "claimExpiresAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "authAccountCreatedAt" TIMESTAMP(3),
    "emailVerifiedAt" TIMESTAMP(3),
    "boundAt" TIMESTAMP(3),
    "expiredAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "conflictAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountActivationIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAuditEvent" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "authIdentityId" UUID,
    "action" TEXT NOT NULL,
    "summary" TEXT,
    "metadata" JSONB,
    "correlationId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthSessionSelection" (
    "id" UUID NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL,
    "providerSessionId" TEXT NOT NULL,
    "selectedOrganizationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthSessionSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuthAbuseBucket" (
    "id" UUID NOT NULL,
    "dimension" "AuthAbuseDimension" NOT NULL,
    "endpoint" "AuthAbuseEndpoint" NOT NULL,
    "keyDigest" VARCHAR(43) NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "backoffLevel" INTEGER NOT NULL DEFAULT 0,
    "windowStartedAt" TIMESTAMP(3) NOT NULL,
    "lastAttemptAt" TIMESTAMP(3) NOT NULL,
    "lastFailureAt" TIMESTAMP(3),
    "blockedUntil" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthAbuseBucket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthProviderUser_email_key" ON "AuthProviderUser"("email");

-- CreateIndex
CREATE INDEX "AuthProviderSession_userId_idx" ON "AuthProviderSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProviderSession_token_key" ON "AuthProviderSession"("token");

-- CreateIndex
CREATE INDEX "AuthProviderAccount_userId_idx" ON "AuthProviderAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthProviderAccount_issuer_accountId_uidx" ON "AuthProviderAccount"("issuer", "accountId");

-- CreateIndex
CREATE INDEX "AuthProviderVerification_identifier_idx" ON "AuthProviderVerification"("identifier");

-- CreateIndex
CREATE INDEX "AuthIdentity_userId_idx" ON "AuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthIdentity_provider_providerSubject_key" ON "AuthIdentity"("provider", "providerSubject");

-- CreateIndex
CREATE UNIQUE INDEX "AccountActivationIntent_tokenDigest_key" ON "AccountActivationIntent"("tokenDigest");

-- CreateIndex
CREATE INDEX "AccountActivationIntent_userId_idx" ON "AccountActivationIntent"("userId");

-- CreateIndex
CREATE INDEX "AccountActivationIntent_status_expiresAt_idx" ON "AccountActivationIntent"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "AccountActivationIntent_claimExpiresAt_idx" ON "AccountActivationIntent"("claimExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountActivationIntent_provider_providerSubject_key" ON "AccountActivationIntent"("provider", "providerSubject");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_userId_occurredAt_idx" ON "AuthAuditEvent"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_authIdentityId_occurredAt_idx" ON "AuthAuditEvent"("authIdentityId", "occurredAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_action_occurredAt_idx" ON "AuthAuditEvent"("action", "occurredAt");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_correlationId_idx" ON "AuthAuditEvent"("correlationId");

-- CreateIndex
CREATE INDEX "AuthAuditEvent_occurredAt_idx" ON "AuthAuditEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "AuthSessionSelection_selectedOrganizationId_idx" ON "AuthSessionSelection"("selectedOrganizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuthSessionSelection_provider_providerSessionId_key" ON "AuthSessionSelection"("provider", "providerSessionId");

-- CreateIndex
CREATE INDEX "AuthAbuseBucket_endpoint_dimension_blockedUntil_idx" ON "AuthAbuseBucket"("endpoint", "dimension", "blockedUntil");

-- CreateIndex
CREATE INDEX "AuthAbuseBucket_expiresAt_idx" ON "AuthAbuseBucket"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AuthAbuseBucket_dimension_endpoint_keyDigest_key" ON "AuthAbuseBucket"("dimension", "endpoint", "keyDigest");

-- AddForeignKey
ALTER TABLE "AuthProviderSession" ADD CONSTRAINT "AuthProviderSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthProviderUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthProviderAccount" ADD CONSTRAINT "AuthProviderAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AuthProviderUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthIdentity" ADD CONSTRAINT "AuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountActivationIntent" ADD CONSTRAINT "AccountActivationIntent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthAuditEvent" ADD CONSTRAINT "AuthAuditEvent_authIdentityId_fkey" FOREIGN KEY ("authIdentityId") REFERENCES "AuthIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthSessionSelection" ADD CONSTRAINT "AuthSessionSelection_selectedOrganizationId_fkey" FOREIGN KEY ("selectedOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Manual constraints not expressible in Prisma schema syntax.
ALTER TABLE "AuthIdentity"
ADD CONSTRAINT "ck_auth_identity_revocation_order"
CHECK ("revokedAt" IS NULL OR "revokedAt" >= "createdAt");

ALTER TABLE "AccountActivationIntent"
ADD CONSTRAINT "ck_account_activation_intent_digests"
CHECK (
  char_length("tokenDigest") = 43
  AND "tokenDigest" ~ '^[A-Za-z0-9_-]{43}$'
  AND char_length("intendedEmailDigest") = 43
  AND "intendedEmailDigest" ~ '^[A-Za-z0-9_-]{43}$'
),
ADD CONSTRAINT "ck_account_activation_intent_expiry"
CHECK ("expiresAt" > "createdAt"),
ADD CONSTRAINT "ck_account_activation_intent_claim"
CHECK (
  (
    "status" = 'IN_PROGRESS'::"AccountActivationStatus"
    AND "claimId" IS NOT NULL
    AND "claimedAt" IS NOT NULL
    AND "claimExpiresAt" IS NOT NULL
    AND "claimExpiresAt" > "claimedAt"
  )
  OR (
    "status" <> 'IN_PROGRESS'::"AccountActivationStatus"
    AND "claimId" IS NULL
    AND "claimedAt" IS NULL
    AND "claimExpiresAt" IS NULL
  )
),
ADD CONSTRAINT "ck_account_activation_intent_milestones"
CHECK (
  (("providerSubject" IS NULL AND "authAccountCreatedAt" IS NULL)
    OR ("providerSubject" IS NOT NULL AND "authAccountCreatedAt" IS NOT NULL))
  AND ("emailVerifiedAt" IS NULL OR "authAccountCreatedAt" IS NOT NULL)
  AND ("boundAt" IS NULL OR "emailVerifiedAt" IS NOT NULL)
),
ADD CONSTRAINT "ck_account_activation_intent_state"
CHECK (
  (
    "status" IN ('ISSUED', 'IN_PROGRESS')
    AND "providerSubject" IS NULL
    AND "emailVerifiedAt" IS NULL
  )
  OR (
    "status" = 'AUTH_ACCOUNT_CREATED'
    AND "providerSubject" IS NOT NULL
    AND "authAccountCreatedAt" IS NOT NULL
    AND "emailVerifiedAt" IS NULL
  )
  OR (
    "status" IN ('EMAIL_VERIFIED', 'BOUND')
    AND "providerSubject" IS NOT NULL
    AND "authAccountCreatedAt" IS NOT NULL
    AND "emailVerifiedAt" IS NOT NULL
  )
  OR "status" IN ('EXPIRED', 'REVOKED', 'CONFLICT')
),
ADD CONSTRAINT "ck_account_activation_intent_terminal_state"
CHECK (
  (("status" = 'BOUND') = ("boundAt" IS NOT NULL))
  AND (("status" = 'EXPIRED') = ("expiredAt" IS NOT NULL))
  AND (("status" = 'REVOKED') = ("revokedAt" IS NOT NULL))
  AND (("status" = 'CONFLICT') = ("conflictAt" IS NOT NULL))
),
ADD CONSTRAINT "ck_account_activation_intent_timestamp_order"
CHECK (
  ("claimedAt" IS NULL OR "claimedAt" >= "createdAt")
  AND ("authAccountCreatedAt" IS NULL OR "authAccountCreatedAt" >= "createdAt")
  AND ("emailVerifiedAt" IS NULL OR "emailVerifiedAt" >= "authAccountCreatedAt")
  AND ("boundAt" IS NULL OR "boundAt" >= "emailVerifiedAt")
  AND ("expiredAt" IS NULL OR "expiredAt" >= "createdAt")
  AND ("revokedAt" IS NULL OR "revokedAt" >= "createdAt")
  AND ("conflictAt" IS NULL OR "conflictAt" >= "createdAt")
);

CREATE UNIQUE INDEX "ux_account_activation_intent_one_active_per_user"
ON "AccountActivationIntent" ("userId")
WHERE "status" IN ('ISSUED', 'IN_PROGRESS', 'AUTH_ACCOUNT_CREATED', 'EMAIL_VERIFIED');

ALTER TABLE "AuthAbuseBucket"
ADD CONSTRAINT "ck_auth_abuse_bucket_digest"
CHECK (char_length("keyDigest") = 43 AND "keyDigest" ~ '^[A-Za-z0-9_-]{43}$'),
ADD CONSTRAINT "ck_auth_abuse_bucket_counts"
CHECK (
  "attemptCount" >= 0
  AND "failureCount" >= 0
  AND "failureCount" <= "attemptCount"
  AND "backoffLevel" >= 0
),
ADD CONSTRAINT "ck_auth_abuse_bucket_timestamp_order"
CHECK (
  "lastAttemptAt" >= "windowStartedAt"
  AND ("lastFailureAt" IS NULL OR (
    "lastFailureAt" >= "windowStartedAt"
    AND "lastFailureAt" <= "lastAttemptAt"
  ))
  AND ("blockedUntil" IS NULL OR "blockedUntil" >= "lastAttemptAt")
  AND "expiresAt" > "lastAttemptAt"
);

ALTER TABLE "AuthAuditEvent"
ADD CONSTRAINT "ck_auth_audit_event_action"
CHECK ("action" = btrim("action") AND "action" ~ '^[A-Z][A-Z0-9_]*$'),
ADD CONSTRAINT "ck_auth_audit_event_summary"
CHECK (
  "summary" IS NULL
  OR ("summary" = btrim("summary") AND char_length("summary") BETWEEN 1 AND 500)
),
ADD CONSTRAINT "ck_auth_audit_event_correlation"
CHECK (
  "correlationId" = btrim("correlationId")
  AND char_length("correlationId") BETWEEN 1 AND 128
);
