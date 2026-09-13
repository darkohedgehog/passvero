import "server-only";
import { createAttachmentService } from "@/src/application/products/document-attachments/service";
import { createAttachmentHttpHandler } from "@/src/application/products/document-attachments/http";
import { createPrismaAttachmentDependencies } from "@/src/infrastructure/persistence/prisma/prisma-document-attachments";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export function getAttachmentHandler() {
  return createAttachmentHttpHandler({ canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy,
    resolveContext: resolveAuthenticatedUserContext,
    mutate: createAttachmentService(createPrismaAttachmentDependencies(getProductionPrismaClient())) });
}
