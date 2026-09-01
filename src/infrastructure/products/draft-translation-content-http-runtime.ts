import "server-only";
import { createDraftTranslationContentHttpHandler } from "@/src/application/products/draft-translation-content/draft-translation-content-http";
import { createUpdateDraftTranslationContentService } from "@/src/application/products/draft-translation-content/update-draft-translation-content";
import { validateBetterAuthServerConfig } from "@/src/infrastructure/auth/better-auth-server-config";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionDraftTranslationContentDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createDraftTranslationContentHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroDraftTranslationContentHandler?: Handler };
export function getDraftTranslationContentHttpHandler(): Handler {
  state.__passveroDraftTranslationContentHandler ??= (() => { const config = validateBetterAuthServerConfig({ secret: process.env.BETTER_AUTH_SECRET, baseURL: process.env.BETTER_AUTH_URL }); return createDraftTranslationContentHttpHandler({ canonicalOrigin: config.baseURL, resolveContext: resolveAuthenticatedUserContext, update: createUpdateDraftTranslationContentService(getProductionDraftTranslationContentDependencies()) }); })();
  return state.__passveroDraftTranslationContentHandler;
}
