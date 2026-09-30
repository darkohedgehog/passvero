import "server-only";
import { createCommercialServices, commercialError } from "@/src/application/subscriptions/service";
import { getAuthPrismaClient } from "@/src/infrastructure/auth/better-auth-server";
import { resolveCurrentUserFromProviderSession } from "@/src/infrastructure/auth/provider-neutral-session-resolution";
import { resolveAuthenticatedUserContext } from "@/src/infrastructure/context/organization-context-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { PrismaCommercial } from "./prisma-commercial";
export function getCommercialServices(){return createCommercialServices({
 persistence:new PrismaCommercial(getProductionPrismaClient(),getAuthPrismaClient(),{canonicalOrigin:getCanonicalAppOrigin(),runtimeEnvironment:process.env.PASSVERO_RUNTIME_ENV??""}),
 async resolveActor(headers){const actor=await resolveCurrentUserFromProviderSession(headers);if(actor.status!=="AUTHENTICATED")throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return actor;},
 async resolveOrganization(headers){const result=await resolveAuthenticatedUserContext(headers);if(result.status!=="RESOLVED")throw commercialError("COMMERCIAL_FORBIDDEN","FORBIDDEN");return result.context.organizationId;},
});}
