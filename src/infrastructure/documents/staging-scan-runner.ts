import "server-only";
import { resolveReadOnlyAuthenticatedUserContext } from "../context/organization-context-runtime";
import { getRuntimeDatabaseConfig } from "../config/runtime-database-config";
import { DocumentError } from "../../application/documents/contracts";

/** Every invocation resolves the real provider session again. Never accept context
 * from stdin, JSON, a user ID, or a saved acceptance report. */
export async function resolveStagingRunnerContext(cookie: string) {
  if (process.env.PASSVERO_RUNTIME_ENV !== "staging"
    || process.env.BETTER_AUTH_URL !== "https://staging.passvero.eu"
    || !cookie || Buffer.byteLength(cookie) > 8192 || /[\r\n\0]/.test(cookie)) {
    throw new DocumentError("FORBIDDEN");
  }
  // Validate both independent credentials against the fixed staging endpoint
  // before importing/constructing any lazy runtime database connection.
  getRuntimeDatabaseConfig("business");
  getRuntimeDatabaseConfig("auth");
  const resolved = await resolveReadOnlyAuthenticatedUserContext(new Headers({ cookie }));
  if (resolved.status !== "RESOLVED" || !resolved.context.permissions.includes("PRODUCT_EDIT")) {
    throw new DocumentError("FORBIDDEN");
  }
  return resolved.context;
}

import { createDocumentScanRuntimeCore } from "./document-scan-runtime-core";
import { createQpdfBrokerPort } from "./qpdf-broker-client";
import { PrismaDocumentScanPersistence } from "../persistence/prisma/prisma-document-scan";
import { getProductionPrismaClient } from "../persistence/prisma/production-prisma-runtime";
import { SupabaseDocumentStorage, parseDocumentStorageConfig } from "../storage/supabase-document-storage";
import { ClamavUnixScanner } from "./clamav-unix-scanner";
import { createSignatureHealthProvider } from "./signature-health-reader";
import { createDocumentScanRecovery } from "../../application/documents/recover-document-scan";
import { createAcceptanceCleanup } from "../../application/documents/acceptance-cleanup";
import { PrismaAcceptanceCleanup } from "../persistence/prisma/prisma-acceptance-cleanup";

/** Inert factory for the separately authorized future integration series.
 * No CLI in this slice calls these mutation methods. */
export function createStagingScanRunner(config: unknown, storageInput: unknown, manifestKey: Uint8Array) {
  const storageConfig = parseDocumentStorageConfig(storageInput);
  if (storageConfig.environment !== "staging") throw new DocumentError("FORBIDDEN");
  const storage = new SupabaseDocumentStorage(storageConfig);
  const runtime = createDocumentScanRuntimeCore(config, {
    persistence: () => new PrismaDocumentScanPersistence(getProductionPrismaClient()),
    storage: () => storage,
    pdf: () => createQpdfBrokerPort(),
    scanner: (path, signatures) => new ClamavUnixScanner(path, signatures),
    health: createSignatureHealthProvider,
  });
  return {
    async scan(cookie: string, documentId: string, signal: AbortSignal) {
      const context = await resolveStagingRunnerContext(cookie);
      return runtime.scan(documentId, context, { signal });
    },
    async recover(cookie: string, documentId: string, attemptId: string) {
      const context = await resolveStagingRunnerContext(cookie);
      return createDocumentScanRecovery(new PrismaDocumentScanPersistence(getProductionPrismaClient()))(documentId, attemptId, context);
    },
    async cleanup(cookie: string, manifest: unknown, authentication: string) {
      const context = await resolveStagingRunnerContext(cookie);
      return createAcceptanceCleanup({ key: manifestKey, persistence: new PrismaAcceptanceCleanup(getProductionPrismaClient()), remove: key => storage.removeAcceptanceObject(key) })(manifest, authentication, context);
    },
  };
}

import { randomUUID } from "node:crypto";
import { createDocumentServices } from "../../application/documents/services";
import { sealAcceptanceManifest, type AcceptanceManifest } from "../../application/documents/acceptance-cleanup";
import { PrismaDocumentPersistence } from "../persistence/prisma/prisma-document-assets";

/** Future acceptance creation only. Persist the sealed exact receipt BEFORE any
 * storage upload; a receipt failure stops creation before object bytes are sent.
 * The journal owner must durably retain receipts even when upload throws. */
export function createStagingAcceptanceUpload(storageInput: unknown, key: Uint8Array,
  retain: (manifest: AcceptanceManifest, authentication: string) => Promise<void>) {
  const config = parseDocumentStorageConfig(storageInput);
  if (config.environment !== "staging" || key.length !== 32) throw new DocumentError("FORBIDDEN");
  const secret = new Uint8Array(key);
  const runId = randomUUID();
  return async (cookie: string, bytes: Uint8Array) => {
    const context = await resolveStagingRunnerContext(cookie);
    const persistence = new PrismaDocumentPersistence(getProductionPrismaClient());
    const services = createDocumentServices({ storage: new SupabaseDocumentStorage(config), persistence: {
      authorize: (...args) => persistence.authorize(...args),
      read: (...args) => persistence.read(...args),
      finalize: (...args) => persistence.finalize(...args),
      fail: (...args) => persistence.fail(...args),
      async createPending(actor, data) {
        const row = await persistence.createPending(actor, data);
        const manifest: AcceptanceManifest = { version: 1, environment: "staging", runId,
          actorId: actor.userId, organizationId: actor.organizationId,
          entries: [{ documentId: row.id, storageKey: row.storage.key, checksumSha256: row.checksumSha256, sizeBytes: row.sizeBytes }] };
        try { await retain(manifest, sealAcceptanceManifest(manifest, secret)); }
        catch {
          // No storage put has happened. Retain a non-AVAILABLE tombstone if
          // receipt persistence fails; failure to archive is operational failure.
          await new PrismaAcceptanceCleanup(getProductionPrismaClient()).archive(actor, manifest, manifest.entries[0]);
          throw new DocumentError("OPERATIONAL_FAILURE");
        }
        return row;
      },
    } });
    return services.upload({ filename: "acceptance.pdf", mimeType: "application/pdf", displayName: `acceptance:${runId}`, bytes }, context);
  };
}
