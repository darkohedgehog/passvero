import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const schemaPath = new URL("../prisma/schema.prisma", import.meta.url);
const migrationsPath = new URL("../prisma/migrations/", import.meta.url);

function block(source, kind, name) {
  const match = source.match(new RegExp(`${kind} ${name} \\{([\\s\\S]*?)\\n\\}`));

  assert.ok(match, `Missing ${kind} ${name}`);
  return match[1];
}

function fieldNames(model) {
  return model
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("///") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/, 1)[0]);
}

async function readPhaseMigration() {
  const entries = await readdir(migrationsPath, { withFileTypes: true });
  const directories = entries
    .filter((entry) => entry.isDirectory() && entry.name.endsWith("_add_product_material"))
    .map((entry) => entry.name);

  assert.equal(directories.length, 1, "Expected one add_product_material migration");
  return readFile(new URL(`${directories[0]}/migration.sql`, migrationsPath), "utf8");
}

test("Phase 2B.3 adds only ProductMaterial and no enum", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const modelNames = [...schema.matchAll(/^model (\w+) \{/gm)].map((match) => match[1]);
  const enumNames = [...schema.matchAll(/^enum (\w+) \{/gm)].map((match) => match[1]);

  assert.deepEqual(modelNames, [
    "User",
    "Organization",
    "Membership",
    "Invitation",
    "Product",
    "ProductVersion",
    "ProductTranslation",
    "ProductIdentifier",
    "ProductMaterial",
    "Passport",
  ]);
  assert.deepEqual(enumNames, [
    "OrganizationStatus",
    "MembershipRole",
    "MembershipStatus",
    "InvitationStatus",
    "ProductLifecycleStatus",
    "ProductVersionStatus",
    "ProductIdentifierType",
    "PassportStatus",
  ]);
  assert.doesNotMatch(schema, /^enum ProductMaterial\w* \{/m);
});

test("ProductMaterial contains exactly the approved fields and nullability", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const material = block(schema, "model", "ProductMaterial");

  assert.deepEqual(fieldNames(material), [
    "id",
    "productVersionId",
    "materialName",
    "category",
    "percentage",
    "isRecycled",
    "recycledPercentage",
    "supplier",
    "notes",
    "createdAt",
    "updatedAt",
    "productVersion",
  ]);
  assert.match(material, /id\s+String\s+@id\s+@default\(uuid\(\)\)\s+@db\.Uuid/);
  assert.match(material, /productVersionId\s+String\s+@db\.Uuid/);
  assert.match(material, /materialName\s+String(?:\s|$)/);
  assert.match(material, /category\s+String\?\s*$/m);
  assert.match(material, /percentage\s+Decimal\?\s+@db\.Decimal\(5, 2\)/);
  assert.match(material, /isRecycled\s+Boolean\s+@default\(false\)/);
  assert.match(material, /recycledPercentage\s+Decimal\?\s+@db\.Decimal\(5, 2\)/);
  assert.match(material, /supplier\s+String\?\s*$/m);
  assert.match(material, /notes\s+String\?\s*$/m);
  assert.match(material, /createdAt\s+DateTime\s+@default\(now\(\)\)/);
  assert.match(material, /updatedAt\s+DateTime\s+@updatedAt/);
});

test("ProductMaterial belongs only to ProductVersion with explicit cascade relation", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const version = block(schema, "model", "ProductVersion");
  const material = block(schema, "model", "ProductMaterial");

  assert.match(
    version,
    /materials\s+ProductMaterial\[\]\s+@relation\("ProductVersionMaterials"\)/,
  );
  assert.match(
    material,
    /productVersion\s+ProductVersion\s+@relation\("ProductVersionMaterials", fields: \[productVersionId\], references: \[id\], onDelete: Cascade, onUpdate: Cascade\)/,
  );
  assert.deepEqual(
    fieldNames(material).filter((field) => ![
      "id",
      "productVersionId",
      "materialName",
      "category",
      "percentage",
      "isRecycled",
      "recycledPercentage",
      "supplier",
      "notes",
      "createdAt",
      "updatedAt",
    ].includes(field)),
    ["productVersion"],
  );
});

test("ProductMaterial has only the approved foreign-key index and no uniqueness", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const material = block(schema, "model", "ProductMaterial");

  assert.match(material, /@@index\(\[productVersionId\]\)/);
  assert.doesNotMatch(material, /@unique|@@unique/);
  assert.equal([...material.matchAll(/@@index\(/g)].length, 1);
});

test("ProductMaterial excludes forbidden Phase 2B.3 fields", async () => {
  const schema = await readFile(schemaPath, "utf8");
  const material = block(schema, "model", "ProductMaterial");
  const forbiddenFields = [
    "organizationId",
    "productId",
    "materialId",
    "supplierId",
    "manufacturerId",
    "locale",
    "status",
    "sortOrder",
    "unit",
    "quantity",
    "mass",
    "weight",
    "volume",
    "density",
    "originCountry",
    "countryCode",
    "substanceCode",
    "casNumber",
    "ecNumber",
    "recycledSource",
    "renewablePercentage",
    "recyclable",
    "hazardous",
    "certification",
    "metadata",
    "archivedAt",
    "deletedAt",
  ];

  for (const field of forbiddenFields) {
    assert.doesNotMatch(material, new RegExp(`^\\s*${field}\\b`, "m"));
  }
});

test("ProductMaterial migration is additive, isolated, and contains all checks", async () => {
  const migrationSql = await readPhaseMigration();
  const migrationLock = await readFile(new URL("migration_lock.toml", migrationsPath), "utf8");

  assert.match(migrationLock, /provider = "postgresql"/);
  assert.deepEqual(
    [...migrationSql.matchAll(/CREATE TABLE "(\w+)"/g)].map((match) => match[1]),
    ["ProductMaterial"],
  );
  assert.deepEqual([...migrationSql.matchAll(/CREATE TYPE "(\w+)"/g)], []);
  assert.match(
    migrationSql,
    /CREATE INDEX "ProductMaterial_productVersionId_idx" ON "ProductMaterial"\("productVersionId"\)/,
  );
  assert.match(
    migrationSql,
    /ALTER TABLE "ProductMaterial" ADD CONSTRAINT "ProductMaterial_productVersionId_fkey" FOREIGN KEY \("productVersionId"\) REFERENCES "ProductVersion"\("id"\) ON DELETE CASCADE ON UPDATE CASCADE/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_material_percentage_range"\s+CHECK \("percentage" IS NULL OR \("percentage" >= 0 AND "percentage" <= 100\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_material_recycled_percentage_range"\s+CHECK \("recycledPercentage" IS NULL OR \("recycledPercentage" >= 0 AND "recycledPercentage" <= 100\)\)/,
  );
  assert.match(
    migrationSql,
    /CONSTRAINT "ck_product_material_recycled_consistency"\s+CHECK \("isRecycled" = true OR "recycledPercentage" IS NULL\)/,
  );

  assert.equal([...migrationSql.matchAll(/\bCONSTRAINT "ck_product_material_/g)].length, 3);
  assert.doesNotMatch(
    migrationSql,
    /\b(DROP|TRUNCATE|INSERT INTO|UPDATE .+ SET|DELETE FROM|CREATE POLICY|CREATE FUNCTION|CREATE TRIGGER)\b/,
  );
  assert.doesNotMatch(
    migrationSql,
    /ALTER TABLE "(User|Organization|Membership|Invitation|Product|ProductVersion|ProductTranslation|ProductIdentifier|Passport)"/,
  );
});
