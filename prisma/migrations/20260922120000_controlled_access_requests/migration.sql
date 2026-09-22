ALTER TYPE "AuthAbuseEndpoint" ADD VALUE 'REQUEST_ACCESS';
CREATE TABLE "AccessRequest" (
  "id" UUID NOT NULL PRIMARY KEY,
  "email" VARCHAR(254) NOT NULL,
  "contactName" VARCHAR(120) NOT NULL,
  "organizationDisplayName" VARCHAR(200) NOT NULL,
  "locale" VARCHAR(2) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "deliveryStatus" VARCHAR(24) NOT NULL DEFAULT 'NOT_STARTED',
  "decidedAt" TIMESTAMP(3), "decidedBy" VARCHAR(80),
  "organizationId" UUID REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" UUID REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "activationId" UUID REFERENCES "AccountActivationIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "deliveryAttempts" INTEGER NOT NULL DEFAULT 0 CHECK ("deliveryAttempts" BETWEEN 0 AND 3),
  "deliveryAttemptId" UUID, "deliveryStartedAt" TIMESTAMP(3), "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AccessRequest_values" CHECK (
    "locale" IN ('hr','en','de','sr','sl','pl') AND
    "status" IN ('PENDING','APPROVED','REJECTED') AND
    "deliveryStatus" IN ('NOT_STARTED','DELIVERY_IN_PROGRESS','SENT','DELIVERY_UNKNOWN') AND
    length(trim("contactName")) > 0 AND length(trim("organizationDisplayName")) > 0 AND
    "email" = lower(trim("email"))
  ),
  CONSTRAINT "AccessRequest_decision" CHECK (
    ("status" = 'PENDING' AND "decidedAt" IS NULL AND "decidedBy" IS NULL) OR
    ("status" <> 'PENDING' AND "decidedAt" IS NOT NULL AND "decidedBy" IS NOT NULL)
  ),
  CONSTRAINT "AccessRequest_outcome" CHECK (
    ("status" = 'APPROVED' AND "organizationId" IS NOT NULL AND "userId" IS NOT NULL AND "activationId" IS NOT NULL AND "deliveryStatus" <> 'NOT_STARTED' AND "deliveryAttemptId" IS NOT NULL AND "deliveryStartedAt" IS NOT NULL) OR
    ("status" <> 'APPROVED' AND "organizationId" IS NULL AND "userId" IS NULL AND "activationId" IS NULL AND "deliveryStatus" = 'NOT_STARTED' AND "deliveryAttemptId" IS NULL AND "deliveryStartedAt" IS NULL)
  ),
  CONSTRAINT "AccessRequest_delivery" CHECK (("deliveryStatus" = 'SENT') = ("deliveredAt" IS NOT NULL))
);
CREATE UNIQUE INDEX "AccessRequest_email_key" ON "AccessRequest"("email");
CREATE UNIQUE INDEX "AccessRequest_organizationId_key" ON "AccessRequest"("organizationId");
CREATE UNIQUE INDEX "AccessRequest_userId_key" ON "AccessRequest"("userId");
CREATE UNIQUE INDEX "AccessRequest_activationId_key" ON "AccessRequest"("activationId");
CREATE INDEX "AccessRequest_status_createdAt_id_idx" ON "AccessRequest"("status", "createdAt", "id");
