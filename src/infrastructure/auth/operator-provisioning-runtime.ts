import { randomBytes } from "node:crypto";
import { createOperatorProvisioningService, type ProvisioningRecord } from "@/src/application/auth/operator-provisioning";
import { createActivationDigesters } from "./activation-digests";
import { canonicalizeAuthAccountIdentifier } from "./auth-abuse-identifiers";
import { validateBetterAuthServerConfig } from "./better-auth-server-config";

export function createConfiguredOperatorProvisioning(
  env: Readonly<Record<string, string | undefined>>,
  persistence: { create(input: ProvisioningRecord): Promise<void> },
) {
  const config = validateBetterAuthServerConfig({ secret: env.BETTER_AUTH_SECRET, baseURL: env.BETTER_AUTH_URL });
  const capabilityKey = readKey(env.AUTH_ACTIVATION_CAPABILITY_HMAC_SECRET);
  const emailKey = readKey(env.AUTH_ACTIVATION_EMAIL_HMAC_SECRET);
  try {
    const digesters = createActivationDigesters({ capabilityKey, emailKey });
    return createOperatorProvisioningService({
      canonicalOrigin: config.baseURL, normalizeEmail: canonicalizeAuthAccountIdentifier,
      digesters, persistence, now: () => new Date(),
      generateCapability() {
        const bytes = randomBytes(32);
        try { return bytes.toString("base64url"); } finally { bytes.fill(0); }
      },
    });
  } finally {
    capabilityKey.fill(0);
    emailKey.fill(0);
  }
}

function readKey(value: unknown): Buffer {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(value)) throw new Error("Invalid provisioning configuration.");
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== value) {
    bytes.fill(0);
    throw new Error("Invalid provisioning configuration.");
  }
  return bytes;
}

// CLI-only composition. Lazy business persistence; no provider runtime or env-file loading.
export function createOperatorProvisioningRuntime(env: Readonly<Record<string, string | undefined>>) {
  let disconnect: (() => Promise<void>) | undefined;
  const provision = createConfiguredOperatorProvisioning(env, {
    async create(record) {
      const runtime = await import("../persistence/prisma/production-prisma-runtime");
      const { PrismaOperatorProvisioningPersistence } = await import("../persistence/prisma/prisma-operator-provisioning");
      disconnect = runtime.disconnectProductionPrisma;
      await new PrismaOperatorProvisioningPersistence(runtime.getProductionPrismaClient()).create(record);
    },
  });
  return { provision, close: async () => { await disconnect?.(); } };
}
