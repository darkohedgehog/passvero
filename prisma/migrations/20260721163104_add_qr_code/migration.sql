-- CreateEnum
CREATE TYPE "QRCodeStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');

-- CreateTable
CREATE TABLE "QRCode" (
    "id" UUID NOT NULL,
    "passportId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "status" "QRCodeStatus" NOT NULL DEFAULT 'PENDING',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_qr_code_code_format"
        CHECK ("code" = btrim("code") AND char_length("code") BETWEEN 8 AND 128 AND "code" ~ '^[A-Z0-9_-]+$'),
    CONSTRAINT "ck_qr_code_target_url_https"
        CHECK ("targetUrl" LIKE 'https://%'),
    CONSTRAINT "ck_qr_code_lifecycle_timestamps"
        CHECK (
            (
                "status" = 'PENDING'::"QRCodeStatus"
                AND "activatedAt" IS NULL
                AND "revokedAt" IS NULL
            )
            OR
            (
                "status" = 'ACTIVE'::"QRCodeStatus"
                AND "activatedAt" IS NOT NULL
                AND "revokedAt" IS NULL
                AND "activatedAt" >= "generatedAt"
            )
            OR
            (
                "status" = 'REVOKED'::"QRCodeStatus"
                AND "activatedAt" IS NOT NULL
                AND "revokedAt" IS NOT NULL
                AND "activatedAt" >= "generatedAt"
                AND "revokedAt" >= "activatedAt"
            )
        ),
    CONSTRAINT "QRCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_passportId_key" ON "QRCode"("passportId");

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_code_key" ON "QRCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "QRCode_targetUrl_key" ON "QRCode"("targetUrl");

-- CreateIndex
CREATE INDEX "QRCode_status_idx" ON "QRCode"("status");

-- CreateIndex
CREATE INDEX "QRCode_generatedAt_idx" ON "QRCode"("generatedAt");

-- CreateIndex
CREATE INDEX "QRCode_activatedAt_idx" ON "QRCode"("activatedAt");

-- CreateIndex
CREATE INDEX "QRCode_revokedAt_idx" ON "QRCode"("revokedAt");

-- AddForeignKey
ALTER TABLE "QRCode" ADD CONSTRAINT "QRCode_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "Passport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
