-- Additive receipt-only migration. No existing Product data is changed.
CREATE TABLE "CatalogImportBatch" (
 "id" UUID NOT NULL, "organizationId" UUID NOT NULL, "userId" UUID NOT NULL,
 "contentHash" VARCHAR(64) NOT NULL, "selectionHash" VARCHAR(64) NOT NULL,
 "acceptGtinMatches" BOOLEAN NOT NULL, "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
 "totalRows" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "CatalogImportBatch_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "CatalogImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CatalogImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CatalogImportBatch_bounds" CHECK ("totalRows" BETWEEN 1 AND 10000 AND "status" IN ('ACTIVE','COMPLETE','CANCELLED') AND "contentHash" ~ '^[0-9a-f]{64}$' AND "selectionHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "CatalogImportBatch_organizationId_userId_contentHash_key" ON "CatalogImportBatch"("organizationId","userId","contentHash");
CREATE TABLE "CatalogImportRow" (
 "batchId" UUID NOT NULL, "rowNumber" INTEGER NOT NULL, "rowHash" VARCHAR(64) NOT NULL,
 "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING', "productId" UUID, "error" VARCHAR(64),
 CONSTRAINT "CatalogImportRow_pkey" PRIMARY KEY ("batchId","rowNumber"),
 CONSTRAINT "CatalogImportRow_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "CatalogImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "CatalogImportRow_state" CHECK ("rowNumber" BETWEEN 1 AND 10000 AND "rowHash" ~ '^[0-9a-f]{64}$' AND (
  ("status"='PENDING' AND "productId" IS NULL AND "error" IS NULL) OR
  ("status"='SUCCEEDED' AND "productId" IS NOT NULL AND "error" IS NULL) OR
  ("status"='FAILED' AND "productId" IS NULL AND "error" IS NOT NULL)))
);
CREATE INDEX "CatalogImportRow_batchId_status_idx" ON "CatalogImportRow"("batchId","status");
