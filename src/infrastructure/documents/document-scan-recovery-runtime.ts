import "server-only";
import type { PrismaClient } from "@/src/generated/prisma/client";
import { createDocumentScanRecovery } from "@/src/application/documents/recover-document-scan";
import { PrismaDocumentScanPersistence } from "@/src/infrastructure/persistence/prisma/prisma-document-scan";

/** Independent of scanner configuration; no I/O or Prisma construction until explicit use. */
export function createDocumentScanRecoveryRuntime(getPrisma: () => PrismaClient) {
  let recover: ReturnType<typeof createDocumentScanRecovery> | undefined;
  return {
    recover: (...args: Parameters<ReturnType<typeof createDocumentScanRecovery>>) => {
      recover ??= createDocumentScanRecovery({
        recover: (context, id, attemptId) => new PrismaDocumentScanPersistence(getPrisma()).recover(context, id, attemptId),
      });
      return recover(...args);
    },
  };
}
