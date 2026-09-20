import "server-only";
import { createImageServices } from "@/src/application/products/images/service";
import { createImageHttpHandlers } from "@/src/application/products/images/http";
import { PrismaProductImagePersistence } from "@/src/infrastructure/persistence/prisma/prisma-product-images";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { SupabaseImageStorage } from "@/src/infrastructure/storage/supabase-image-storage";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
import { normalizeProductImage } from "./normalize";
let services: ReturnType<typeof createImageServices> | undefined;
let handlers: ReturnType<typeof createImageHttpHandlers> | undefined;
export function getImageServices() {
  services ??= createImageServices({ persistence: new PrismaProductImagePersistence(getProductionPrismaClient()), normalize: normalizeProductImage,
    storage: new SupabaseImageStorage({ url: process.env.DOCUMENT_STORAGE_SUPABASE_URL, key: process.env.DOCUMENT_STORAGE_SUPABASE_KEY, bucket: process.env.DOCUMENT_STORAGE_BUCKET, environment: process.env.PASSVERO_RUNTIME_ENV }) });
  return services;
}
export function getImageHandlers() {
  handlers ??= createImageHttpHandlers({ services: getImageServices(), canonicalOrigin: getCanonicalAppOrigin(), verifyProxy: verifyRuntimeProxy, resolveContext: resolveAuthenticatedUserContext });
  return handlers;
}
