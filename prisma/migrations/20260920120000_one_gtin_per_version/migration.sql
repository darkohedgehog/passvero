BEGIN;

-- Excludes writes between the duplicate check and index creation.
LOCK TABLE "ProductIdentifier" IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ProductIdentifier" WHERE "type" = 'GTIN'
    GROUP BY "productVersionId" HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'GTIN_DUPLICATE_VERSIONS: resolve existing multiple GTIN records explicitly before migration';
  END IF;
END $$;

CREATE UNIQUE INDEX "ux_product_identifier_one_gtin_per_version"
ON "ProductIdentifier"("productVersionId")
WHERE "type" = 'GTIN'::"ProductIdentifierType";

COMMIT;
