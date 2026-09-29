import { getAuthPrismaClient, disconnectBetterAuthServer } from "../src/infrastructure/auth/better-auth-server";
// Privileged staging process only. Inherit service configuration; never load env files.
import { changePlatformGrant, PlatformGrantError } from "../src/infrastructure/platform/platform-grant";
import { userInfo } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
let operatorClient: PrismaClient | undefined;
async function main() {
  if (process.env.PASSVERO_RUNTIME_ENV !== "staging" || process.env.BETTER_AUTH_URL !== "https://staging.passvero.eu") throw new PlatformGrantError("STAGING_TARGET_REQUIRED");
  if (userInfo().username !== "postgres") throw new PlatformGrantError("PRIVILEGED_OPERATOR_REQUIRED");
  const [action,email,operator,...extra] = process.argv.slice(2);
  if (extra.length || !action || !email || !operator) throw new PlatformGrantError("USAGE: platform-access.ts grant|revoke email operator-reference");
  // OS peer authentication on the staging socket; runtime never receives grant writes.
  operatorClient = new PrismaClient({adapter:new PrismaPg({host:"/var/run/postgresql",port:5433,database:"passvero_acceptance",user:"postgres",options:"-c role=passvero_migrator"})});
  process.stdout.write(JSON.stringify(await changePlatformGrant(operatorClient,getAuthPrismaClient(),{action,email,operator}))+"\n");
}
void main().catch(error=>{
  process.stderr.write((error instanceof PlatformGrantError ? error.code : "OPERATIONAL_FAILURE")+"\n");
  process.exitCode=1;
}).finally(async () => { await Promise.all([operatorClient?.$disconnect(), disconnectBetterAuthServer()]); });
