import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../src/generated/prisma/client";

export interface SafeTestDatabaseConfig {
  readonly url: string;
  readonly databaseName: string;
}

export interface CreateProductFixtureIds {
  readonly userId: string;
  readonly organizationId: string;
  readonly membershipId: string;
  readonly productIds: readonly string[];
}

export function requireSafeTestDatabaseConfig(
  environment: NodeJS.ProcessEnv,
): SafeTestDatabaseConfig {
  const testDatabaseUrl = environment.TEST_DATABASE_URL;

  if (typeof testDatabaseUrl !== "string" || testDatabaseUrl.trim().length === 0) {
    throw new Error("TEST_DATABASE_URL is required.");
  }

  if (
    typeof environment.DATABASE_URL === "string" &&
    testDatabaseUrl === environment.DATABASE_URL
  ) {
    throw new Error("TEST_DATABASE_URL must not equal DATABASE_URL.");
  }

  return validateSafeTestDatabaseUrl(testDatabaseUrl);
}

export function createTestPrismaClient(
  config: SafeTestDatabaseConfig,
): PrismaClient {
  const validatedConfig = validateSafeTestDatabaseUrl(config.url);

  if (config.databaseName !== validatedConfig.databaseName) {
    throw new Error("TEST_DATABASE_URL database name is inconsistent.");
  }

  const adapter = new PrismaPg({ connectionString: validatedConfig.url });

  return new PrismaClient({ adapter });
}

export async function cleanupCreateProductFixture(
  prisma: PrismaClient,
  fixture: CreateProductFixtureIds,
): Promise<void> {
  assertNonBlankFixtureId("user ID", fixture.userId);
  assertNonBlankFixtureId("organization ID", fixture.organizationId);
  assertNonBlankFixtureId("membership ID", fixture.membershipId);

  if (!Array.isArray(fixture.productIds)) {
    throw new Error("Product IDs must be an array.");
  }

  const productIds = [...fixture.productIds];

  for (const productId of productIds) {
    assertNonBlankFixtureId("product ID", productId);
  }

  await prisma.$transaction(async (transaction) => {
    if (productIds.length > 0) {
      await transaction.auditLog.deleteMany({
        where: {
          organizationId: fixture.organizationId,
          entityType: "PRODUCT",
          entityId: { in: productIds },
        },
      });

      await transaction.product.updateMany({
        where: {
          id: { in: productIds },
          organizationId: fixture.organizationId,
        },
        data: {
          currentDraftVersionId: null,
          currentPublishedVersionId: null,
        },
      });

      const productVersions = await transaction.productVersion.findMany({
        where: {
          productId: { in: productIds },
          organizationId: fixture.organizationId,
        },
        select: { id: true },
      });
      const productVersionIds = productVersions.map((productVersion) => productVersion.id);

      if (productVersionIds.length > 0) {
        await transaction.productTranslation.deleteMany({
          where: { productVersionId: { in: productVersionIds } },
        });

        await transaction.productVersion.deleteMany({
          where: {
            id: { in: productVersionIds },
            organizationId: fixture.organizationId,
          },
        });
      }

      await transaction.product.deleteMany({
        where: {
          id: { in: productIds },
          organizationId: fixture.organizationId,
        },
      });
    }

    await transaction.membership.deleteMany({
      where: {
        id: fixture.membershipId,
        userId: fixture.userId,
        organizationId: fixture.organizationId,
      },
    });
    await transaction.organization.deleteMany({
      where: { id: fixture.organizationId },
    });
    await transaction.user.deleteMany({
      where: { id: fixture.userId },
    });
  });
}

function validateSafeTestDatabaseUrl(url: string): SafeTestDatabaseConfig {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("TEST_DATABASE_URL must be a valid PostgreSQL URL.");
  }

  if (parsedUrl.protocol !== "postgresql:" && parsedUrl.protocol !== "postgres:") {
    throw new Error("TEST_DATABASE_URL must use the PostgreSQL protocol.");
  }

  if (parsedUrl.username.length === 0 || parsedUrl.password.length === 0) {
    throw new Error("TEST_DATABASE_URL must include credentials.");
  }

  if (parsedUrl.hostname.length === 0) {
    throw new Error("TEST_DATABASE_URL must include a host.");
  }

  const encodedDatabaseName = parsedUrl.pathname.slice(1);

  if (encodedDatabaseName.length === 0) {
    throw new Error("TEST_DATABASE_URL must include a database name.");
  }

  let databaseName: string;

  try {
    databaseName = decodeURIComponent(encodedDatabaseName);
  } catch {
    throw new Error("TEST_DATABASE_URL database name must be decodable.");
  }

  if (databaseName.trim().length === 0) {
    throw new Error("TEST_DATABASE_URL must include a database name.");
  }

  if (!databaseName.toLowerCase().includes("test")) {
    throw new Error("TEST_DATABASE_URL database name must identify a test database.");
  }

  return { url, databaseName };
}

function assertNonBlankFixtureId(label: string, value: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Create Product fixture ${label} is required.`);
  }
}
