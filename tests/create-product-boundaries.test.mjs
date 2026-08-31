import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const applicationFiles = [
  "src/application/context/authenticated-user-context.ts",
  "src/application/errors/application-error.ts",
  "src/application/permissions/product-permissions.ts",
  "src/application/products/create-product/contracts.ts",
  "src/application/products/create-product/create-product.ts",
  "src/application/products/create-product/normalize-command.ts",
  "src/application/products/create-product/ports.ts",
  "src/application/products/create-product/public-code.ts",
];
const persistenceFiles = [
  "src/infrastructure/persistence/prisma/prisma-create-product-errors.ts",
  "src/infrastructure/persistence/prisma/prisma-create-product.ts",
];
const productionFiles = [
  ...applicationFiles,
  "src/domain/values/passvero-locale.ts",
  "src/i18n/routing.ts",
  "src/infrastructure/crypto/node-product-public-code-generator.ts",
  ...persistenceFiles,
];

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const joinSources = (paths) => paths.map(read).join("\n");
const listTypeScriptFiles = (directory) => readdirSync(
  new URL(`../${directory}`, import.meta.url),
  { recursive: true },
).filter((path) => path.endsWith(".ts")).map((path) => `${directory}/${path}`);

const applicationSource = joinSources(applicationFiles);
const persistenceSource = joinSources(persistenceFiles);
const allCreateProductSource = joinSources(productionFiles);
const serviceSource = read(
  "src/application/products/create-product/create-product.ts",
);
const contractsSource = read(
  "src/application/products/create-product/contracts.ts",
);

test("keeps CreateProduct independent from transport and generic persistence", () => {
  assert.doesNotMatch(
    applicationSource,
    /next\/|next-intl|cookies\(|headers\(|PrismaClient/,
  );
  assert.doesNotMatch(
    persistenceSource,
    /\b(upsert|deleteMany\(\{\}|update\([^]*data:\s*command)/,
  );
  assert.doesNotMatch(
    allCreateProductSource,
    /\b(passport|qrCode|productIdentifier|productMaterial|document|productDocument|productImage|notification|integrationMapping|backgroundJob|subscription)\.(create|update|upsert)/i,
  );
  assert.match(serviceSource, /PRODUCT_CREATE/);
  assert.match(persistenceSource, /PRODUCT_CREATED/);
});

test("keeps generated Prisma access inside approved infrastructure adapters", () => {
  const sourceFiles = [
    ...listTypeScriptFiles("src/application"),
    ...listTypeScriptFiles("src/domain"),
    ...listTypeScriptFiles("src/infrastructure"),
  ];
  const generatedClientImporters = sourceFiles.filter((path) =>
    /generated\/prisma\/client/.test(read(path)),
  ).sort();

  assert.deepEqual(generatedClientImporters, [
    "src/infrastructure/auth/better-auth-server.ts",
    "src/infrastructure/auth/prisma-auth-abuse-repository.ts",
    "src/infrastructure/auth/prisma-controlled-activation.ts",
    "src/infrastructure/persistence/prisma/prisma-create-product-composition.ts",
    "src/infrastructure/persistence/prisma/prisma-create-product.ts",
    "src/infrastructure/persistence/prisma/prisma-get-product-detail-composition.ts",
    "src/infrastructure/persistence/prisma/prisma-get-product-detail.ts",
    "src/infrastructure/persistence/prisma/prisma-list-products-composition.ts",
    "src/infrastructure/persistence/prisma/prisma-list-products.ts",
    "src/infrastructure/persistence/prisma/production-prisma-runtime.ts",
  ]);
});

test("keeps the CreateProduct result explicit and collision attempts bounded at three", () => {
  const resultBody = /export interface CreateProductResult\s*{([^}]*)}/.exec(
    contractsSource,
  )?.[1];

  assert.ok(resultBody !== undefined);
  assert.deepEqual(
    resultBody.split(";").map((field) => field.trim()).filter(Boolean),
    [
      "readonly productId: string",
      "readonly initialProductVersionId: string",
      "readonly publicCode: string",
      'readonly productStatus: "ACTIVE"',
      'readonly draftStatus: "DRAFT"',
      "readonly organizationSku: string | null",
      "readonly createdAt: Date",
    ],
  );

  assert.match(
    serviceSource,
    /for\s*\(const attempt of \[1, 2, 3\] as const\)/,
  );
  assert.match(serviceSource, /if \(attempt === 3\)/);
});
