BEGIN;
LOCK TABLE "ProductImage", "ProductImageAsset" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM "ProductImageAsset" a LEFT JOIN "ProductImage" i ON i."assetId"=a.id WHERE a.state<>'LEGACY' OR i.id IS DISTINCT FROM a.id)
 OR EXISTS (SELECT 1 FROM "ProductImage" GROUP BY "assetId" HAVING count(*)<>1) THEN RAISE EXCEPTION 'ROLLBACK_REQUIRES_EXPLICIT_IMAGE_RECONCILIATION'; END IF;
END $$;
CREATE TEMP TABLE image_rollback_rows ON COMMIT DROP AS
SELECT i.id,i."productVersionId",a."originalFilename",a."fileExtension",a."storageProvider",a."storageBucket",a."storageKey",a."mimeType",a."sizeBytes",a."checksumSha256",a.width,a.height,i."altText",i.caption,i."isPublic",i."isPrimary",i."sortOrder",a."uploadedAt",i."createdAt",i."updatedAt" FROM "ProductImage" i JOIN "ProductImageAsset" a ON a.id=i."assetId";
CREATE TEMP TABLE image_rollback_grants ON COMMIT DROP AS SELECT a.* FROM pg_class c,LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='"ProductImage"'::regclass AND a.grantee<>c.relowner;
DROP TABLE "ProductImage";
DROP TABLE "ProductImageAsset";
DROP FUNCTION guard_product_image_reference();
DROP FUNCTION guard_product_image_asset();
-- CreateTable
CREATE TABLE "ProductImage" (
    "id" UUID NOT NULL,
    "productVersionId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "fileExtension" TEXT,
    "storageProvider" TEXT NOT NULL,
    "storageBucket" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "altText" TEXT,
    "caption" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ck_product_image_checksum_sha256_format"
        CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$'),
    CONSTRAINT "ck_product_image_size_bytes_positive"
        CHECK ("sizeBytes" > 0),
    CONSTRAINT "ck_product_image_width_positive"
        CHECK ("width" > 0),
    CONSTRAINT "ck_product_image_height_positive"
        CHECK ("height" > 0),
    CONSTRAINT "ck_product_image_mime_type"
        CHECK ("mimeType" IN ('image/jpeg', 'image/png', 'image/webp', 'image/avif')),
    CONSTRAINT "ck_product_image_sort_order_non_negative"
        CHECK ("sortOrder" >= 0),
    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_idx" ON "ProductImage"("productVersionId");

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_isPublic_sortOrder_idx" ON "ProductImage"("productVersionId", "isPublic", "sortOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productVersionId_isPrimary_idx" ON "ProductImage"("productVersionId", "isPrimary");

-- CreateIndex
CREATE INDEX "ProductImage_checksumSha256_idx" ON "ProductImage"("checksumSha256");

-- CreateIndex
CREATE UNIQUE INDEX "ProductImage_storageProvider_storageBucket_storageKey_key" ON "ProductImage"("storageProvider", "storageBucket", "storageKey");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProductImage" SELECT * FROM image_rollback_rows;
DO $$ DECLARE r record; recipient text; BEGIN
 FOR r IN SELECT DISTINCT grantee FROM pg_class c,LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='"ProductImage"'::regclass AND a.grantee<>c.relowner LOOP
 recipient:=CASE WHEN r.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(r.grantee)) END;EXECUTE 'REVOKE ALL ON "ProductImage" FROM '||recipient; END LOOP;
 FOR r IN SELECT * FROM image_rollback_grants LOOP
 recipient:=CASE WHEN r.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(r.grantee)) END;EXECUTE 'GRANT '||r.privilege_type||' ON "ProductImage" TO '||recipient||CASE WHEN r.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END; END LOOP;
END $$;
DELETE FROM "_prisma_migrations" WHERE migration_name='20260920180000_product_image_assets' AND finished_at IS NOT NULL AND rolled_back_at IS NULL;
COMMIT;
