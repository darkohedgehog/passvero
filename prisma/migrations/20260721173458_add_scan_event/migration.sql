-- CreateEnum
CREATE TYPE "ScanDeviceType" AS ENUM ('UNKNOWN', 'DESKTOP', 'MOBILE', 'TABLET', 'BOT');

-- CreateEnum
CREATE TYPE "ScanReferrerType" AS ENUM ('DIRECT', 'SEARCH', 'SOCIAL', 'EMAIL', 'MESSAGING', 'OTHER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" UUID NOT NULL,
    "qrCodeId" UUID NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deviceType" "ScanDeviceType" NOT NULL DEFAULT 'UNKNOWN',
    "referrerType" "ScanReferrerType" NOT NULL DEFAULT 'UNKNOWN',
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "countryCode" TEXT,
    "region" TEXT,
    "browser" TEXT,
    "operatingSystem" TEXT,
    "language" TEXT,
    "referrerHost" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ck_scan_event_country_code_format"
        CHECK ("countryCode" IS NULL OR "countryCode" ~ '^[A-Z]{2}$'),
    CONSTRAINT "ck_scan_event_language_format"
        CHECK ("language" IS NULL OR "language" ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
    CONSTRAINT "ck_scan_event_referrer_host_format"
        CHECK ("referrerHost" IS NULL OR (char_length("referrerHost") BETWEEN 1 AND 253 AND "referrerHost" !~ '[[:space:]/?#@]')),
    CONSTRAINT "ck_scan_event_bot_consistency"
        CHECK (("deviceType" = 'BOT'::"ScanDeviceType" AND "isBot" = true) OR ("deviceType" <> 'BOT'::"ScanDeviceType" AND "isBot" = false)),
    CONSTRAINT "ck_scan_event_created_at_not_before_scanned_at"
        CHECK ("createdAt" >= "scannedAt"),
    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScanEvent_qrCodeId_scannedAt_idx" ON "ScanEvent"("qrCodeId", "scannedAt");

-- CreateIndex
CREATE INDEX "ScanEvent_scannedAt_idx" ON "ScanEvent"("scannedAt");

-- CreateIndex
CREATE INDEX "ScanEvent_qrCodeId_isBot_scannedAt_idx" ON "ScanEvent"("qrCodeId", "isBot", "scannedAt");

-- CreateIndex
CREATE INDEX "ScanEvent_qrCodeId_countryCode_scannedAt_idx" ON "ScanEvent"("qrCodeId", "countryCode", "scannedAt");

-- CreateIndex
CREATE INDEX "ScanEvent_qrCodeId_deviceType_scannedAt_idx" ON "ScanEvent"("qrCodeId", "deviceType", "scannedAt");

-- CreateIndex
CREATE INDEX "ScanEvent_qrCodeId_referrerType_scannedAt_idx" ON "ScanEvent"("qrCodeId", "referrerType", "scannedAt");

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_qrCodeId_fkey" FOREIGN KEY ("qrCodeId") REFERENCES "QRCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
