import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("wires only the narrow CN route runtime and current-draft Product Detail section", () => {
  const route = "app/api/products/[productId]/cn-classification/route.ts";
  assert.equal(existsSync(new URL(route, root)), true);
  assert.equal(existsSync(new URL("app/api/products/[productId]/identifiers/route.ts", root)), false);
  assert.match(read(route), /getCnClassificationHttpHandler/);
  const page = read("app/[locale]/dashboard/products/[productId]/page.tsx");
  assert.match(page, /createCnClassificationCurrentDraftServices/);
  assert.match(page, /getProductionCnClassificationCurrentDraftDependencies/);
  assert.match(page, /<CnClassificationSection/);
  assert.match(page, /namespace:\s*"CnClassification"/);
});

test("keeps Prisma in infrastructure and introduces no generic or customs lookup surface", () => {
  const application = [
    "src/application/products/cn-classification-current-draft/contracts.ts",
    "src/application/products/cn-classification-current-draft/normalize-command.ts",
    "src/application/products/cn-classification-current-draft/services.ts",
    "src/application/products/cn-classification-current-draft/http.ts",
    "src/application/products/cn-classification-current-draft/ui-client.ts",
    "src/components/application/products/cn-classification-section.tsx",
    "app/[locale]/dashboard/products/[productId]/page.tsx",
    "app/api/products/[productId]/cn-classification/route.ts",
  ].map(read).join("\n");
  assert.doesNotMatch(application, /generated\/prisma|@prisma\/|\.productIdentifier\./);
  assert.doesNotMatch(application, /TARIC|customs\.api|fetch\(["']https?:/i);
  assert.equal(existsSync(new URL("src/application/products/product-identifiers", root)), false);
});

test("does not alter schema migration dependency or environment surfaces", () => {
  const statusFiles = ["prisma/schema.prisma", "package.json", "package-lock.json"];
  for (const path of statusFiles) assert.equal(existsSync(new URL(path, root)), true);
  const runtime = read("src/infrastructure/persistence/prisma/production-prisma-runtime.ts");
  assert.match(runtime, /getProductionCnClassificationCurrentDraftDependencies/);
});
