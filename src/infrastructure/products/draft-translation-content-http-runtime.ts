import "server-only";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
import { createDraftTranslationContentHttpHandler } from "@/src/application/products/draft-translation-content/draft-translation-content-http";
import { createUpdateDraftTranslationContentService } from "@/src/application/products/draft-translation-content/update-draft-translation-content";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getProductionDraftTranslationContentDependencies } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";

type Handler = ReturnType<typeof createDraftTranslationContentHttpHandler>;
const state = globalThis as typeof globalThis & { __passveroDraftTranslationContentHandler?: Handler };
export function getDraftTranslationContentHttpHandler(): Handler {
  state.__passveroDraftTranslationContentHandler ??= (() => { const config = { baseURL: getCanonicalAppOrigin() }; return createDraftTranslationContentHttpHandler({ verifyProxy: verifyRuntimeProxy, canonicalOrigin: config.baseURL, resolveContext: resolveAuthenticatedUserContext, update: createUpdateDraftTranslationContentService(getProductionDraftTranslationContentDependencies()) }); })();
  return state.__passveroDraftTranslationContentHandler;
}
