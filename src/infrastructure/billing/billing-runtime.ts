import "server-only";
import { createBillingServices } from "@/src/application/billing/service";
import { createBillingHttpHandler } from "@/src/application/billing/http";
import { PrismaBillingPersistence } from "@/src/infrastructure/persistence/prisma/prisma-billing-profile";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { verifyRuntimeProxy } from "@/src/infrastructure/http/trusted-proxy-runtime";
export function getBillingServices(){return createBillingServices(new PrismaBillingPersistence(getProductionPrismaClient()));}
export function getBillingHandler(){return createBillingHttpHandler({canonicalOrigin:getCanonicalAppOrigin(),verifyProxy:verifyRuntimeProxy,resolveContext:resolveAuthenticatedUserContext,services:getBillingServices()});}
