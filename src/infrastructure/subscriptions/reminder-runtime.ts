import "server-only";
import { ReminderOperations } from "./reminder-operations";
import { PrismaCommercial } from "./prisma-commercial";
import { getProductionPrismaClient } from "@/src/infrastructure/persistence/prisma/production-prisma-runtime";
import { getAuthPrismaClient } from "@/src/infrastructure/auth/better-auth-server";
import { getCommercialServices } from "./commercial-runtime";
import { getCanonicalAppOrigin } from "@/src/infrastructure/config/canonical-app-origin";

export function getReminderServices() {
  const db = getProductionPrismaClient();
  const commercial = new PrismaCommercial(db, getAuthPrismaClient(), { canonicalOrigin: getCanonicalAppOrigin(), runtimeEnvironment: process.env.PASSVERO_RUNTIME_ENV ?? "" });
  const operations = new ReminderOperations(db, (tx, actor) => commercial.authorize(actor, tx));
  const actor = (headers: Headers) => getCommercialServices().requireBillingAccess(headers);
  return {
    async overview(headers: Headers) { return operations.overview(await actor(headers)); },
    async confirmBillingEmail(headers: Headers, input: unknown) { return operations.confirmBillingEmail(await actor(headers), input); },
    async resolve(headers: Headers, input: unknown) { return operations.resolve(await actor(headers), input); },
  };
}
