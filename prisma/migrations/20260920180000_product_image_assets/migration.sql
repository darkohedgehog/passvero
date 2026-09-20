BEGIN;
LOCK TABLE "ProductImage" IN ACCESS EXCLUSIVE MODE;
-- Preserve every legacy row, its identity, bytes metadata and original unique index.
ALTER TABLE "ProductImage" RENAME TO "ProductImageAsset";
ALTER TABLE "ProductImageAsset" RENAME CONSTRAINT "ProductImage_pkey" TO "ProductImageAsset_pkey";
ALTER TABLE "ProductImageAsset" ADD COLUMN "organizationId" UUID;
ALTER TABLE "ProductImageAsset" ADD COLUMN "state" TEXT NOT NULL DEFAULT 'PENDING';
ALTER TABLE "ProductImageAsset" ADD COLUMN "policyVersion" INTEGER NOT NULL DEFAULT 0;
UPDATE "ProductImageAsset" a SET "organizationId"=v."organizationId", "state"='LEGACY'
FROM "ProductVersion" v WHERE v.id=a."productVersionId";
ALTER TABLE "ProductImageAsset" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ProductImageAsset" ADD CONSTRAINT "ProductImageAsset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE TABLE "ProductImage" (
 "id" UUID PRIMARY KEY, "productVersionId" UUID NOT NULL, "assetId" UUID NOT NULL,
 "altText" TEXT, "caption" TEXT, "isPublic" BOOLEAN NOT NULL DEFAULT true,
 "isPrimary" BOOLEAN NOT NULL DEFAULT false, "sortOrder" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "ck_product_image_sort_order_non_negative" CHECK ("sortOrder">=0),
 CONSTRAINT "ProductImage_productVersionId_fkey" FOREIGN KEY ("productVersionId") REFERENCES "ProductVersion"(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "ProductImage_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "ProductImageAsset"(id) ON DELETE RESTRICT ON UPDATE CASCADE
);
-- The replacement association table inherits precisely the old table's role grants.
DO $$
DECLARE grant_row record; role_sql text;
BEGIN
 FOR grant_row IN SELECT DISTINCT grantee FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='"ProductImage"'::regclass AND a.grantee<>c.relowner LOOP
  role_sql := CASE WHEN grant_row.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grant_row.grantee)) END;
  EXECUTE 'REVOKE ALL ON "ProductImage" FROM ' || role_sql;
 END LOOP;
 FOR grant_row IN SELECT a.* FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl,acldefault('r',c.relowner))) a WHERE c.oid='"ProductImageAsset"'::regclass AND a.grantee<>c.relowner LOOP
  role_sql := CASE WHEN grant_row.grantee=0 THEN 'PUBLIC' ELSE quote_ident(pg_get_userbyid(grant_row.grantee)) END;
  EXECUTE 'GRANT ' || grant_row.privilege_type || ' ON "ProductImage" TO ' || role_sql || CASE WHEN grant_row.is_grantable THEN ' WITH GRANT OPTION' ELSE '' END;
 END LOOP;
END $$;
INSERT INTO "ProductImage" SELECT id,"productVersionId",id,"altText",caption,"isPublic","isPrimary","sortOrder","createdAt","updatedAt" FROM "ProductImageAsset";
ALTER TABLE "ProductImageAsset" DROP COLUMN "productVersionId", DROP COLUMN "altText", DROP COLUMN caption, DROP COLUMN "isPublic", DROP COLUMN "isPrimary", DROP COLUMN "sortOrder";
CREATE INDEX "ProductImage_productVersionId_idx" ON "ProductImage"("productVersionId");
CREATE INDEX "ProductImage_productVersionId_isPublic_sortOrder_idx" ON "ProductImage"("productVersionId","isPublic","sortOrder");
CREATE INDEX "ProductImage_productVersionId_isPrimary_idx" ON "ProductImage"("productVersionId","isPrimary");
CREATE INDEX "ProductImage_assetId_idx" ON "ProductImage"("assetId");
CREATE INDEX "ProductImageAsset_organizationId_state_createdAt_idx" ON "ProductImageAsset"("organizationId",state,"createdAt");
ALTER TABLE "ProductImageAsset" ADD CONSTRAINT "ck_image_asset_state" CHECK (state IN ('LEGACY','PENDING','READY','ABANDONED'));
ALTER TABLE "ProductImageAsset" ADD CONSTRAINT "ck_image_asset_normalized" CHECK (state='LEGACY' OR (
 "policyVersion"=1 AND "mimeType" IN ('image/jpeg','image/png') AND "sizeBytes"<=8388608 AND width<=2048 AND height<=2048));
-- Asset bytes identity is never edited, including after the final reference disappears.
CREATE FUNCTION guard_product_image_asset() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW."organizationId",NEW."originalFilename",NEW."fileExtension",NEW."storageProvider",NEW."storageBucket",NEW."storageKey",NEW."mimeType",NEW."sizeBytes",NEW."checksumSha256",NEW.width,NEW.height,NEW."policyVersion")
 IS DISTINCT FROM ROW(OLD."organizationId",OLD."originalFilename",OLD."fileExtension",OLD."storageProvider",OLD."storageBucket",OLD."storageKey",OLD."mimeType",OLD."sizeBytes",OLD."checksumSha256",OLD.width,OLD.height,OLD."policyVersion")
 OR (OLD.state <> 'PENDING' AND (NEW.state IS DISTINCT FROM OLD.state OR NEW."uploadedAt" IS DISTINCT FROM OLD."uploadedAt"))
 OR (OLD.state='PENDING' AND NEW.state NOT IN ('PENDING','READY','ABANDONED')) THEN
 RAISE EXCEPTION 'IMAGE_ASSET_IMMUTABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_product_image_asset BEFORE UPDATE ON "ProductImageAsset" FOR EACH ROW EXECUTE FUNCTION guard_product_image_asset();
CREATE FUNCTION guard_product_image_reference() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE asset_org uuid; asset_state text; version_org uuid;
BEGIN
 SELECT "organizationId",state INTO asset_org,asset_state FROM "ProductImageAsset" WHERE id=NEW."assetId" FOR SHARE;
 SELECT "organizationId" INTO version_org FROM "ProductVersion" WHERE id=NEW."productVersionId";
 IF asset_org IS DISTINCT FROM version_org OR asset_state NOT IN ('READY','LEGACY') THEN RAISE EXCEPTION 'IMAGE_ASSET_REFERENCE_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_product_image_reference BEFORE INSERT OR UPDATE ON "ProductImage" FOR EACH ROW EXECUTE FUNCTION guard_product_image_reference();
COMMIT;
