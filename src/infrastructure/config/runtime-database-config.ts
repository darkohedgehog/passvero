import "server-only";

import { validateAuthDatabaseUrl } from "@/src/infrastructure/auth/auth-database-config";
import { validateProductionDatabaseUrl } from "@/src/infrastructure/persistence/prisma/production-prisma-config";
import { parseRuntimeEnvironment } from "./runtime-environment";

// Invoked lazily before pool construction. Static builds need no DB configuration.
export function getRuntimeDatabaseConfig(role: "business" | "auth") {
  const environment = parseRuntimeEnvironment(process.env.PASSVERO_RUNTIME_ENV);
  if (environment === "staging") {
    // Each validator requires the same fixed endpoint. Validate BOTH before
    // returning either URL, so partial/mixed staging configuration cannot connect.
    const business = validateProductionDatabaseUrl(process.env.DATABASE_URL, environment);
    const auth = validateAuthDatabaseUrl(process.env.AUTH_DATABASE_URL, environment);
    return role === "business" ? business : auth;
  }
  // Preserve independent production provider/business lifecycle configuration.
  return role === "business"
    ? validateProductionDatabaseUrl(process.env.DATABASE_URL, environment)
    : validateAuthDatabaseUrl(process.env.AUTH_DATABASE_URL, environment);
}
