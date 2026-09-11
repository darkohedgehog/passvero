import "server-only";
import { createTranslationManagementServices } from "@/src/application/products/translation-management/service";
import { createTranslationHttpHandler } from "@/src/application/products/translation-management/http";
import { createPrismaTranslationManagementDependencies } from "@/src/infrastructure/persistence/prisma/prisma-translation-management";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export function getTranslationManagementServices() { return createTranslationManagementServices(createPrismaTranslationManagementDependencies(getProductionPrismaClient())); }
export function getTranslationManagementHandler() { return createTranslationHttpHandler({ canonicalOrigin:getCanonicalAppOrigin(),verifyProxy:verifyRuntimeProxy,resolveContext:resolveAuthenticatedUserContext,mutate:getTranslationManagementServices().mutate }); }
