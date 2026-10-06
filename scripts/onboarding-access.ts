// Privileged staging-only process. Configuration is inherited, never loaded from env files.
import { userInfo } from "node:os";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getAuthPrismaClient, disconnectBetterAuthServer } from "../src/infrastructure/auth/better-auth-server";
import { createLazyAuthEmailSender } from "../src/infrastructure/auth/auth-email-runtime";
import { runOnboardingOperator } from "../src/infrastructure/platform/onboarding-operator";
let db: PrismaClient | undefined;
async function main() {
  if (userInfo().username !== "postgres" || process.env.PASSVERO_RUNTIME_ENV !== "staging" || process.env.BETTER_AUTH_URL !== "https://staging.passvero.eu" || process.argv.length !== 3)
    throw Error();
  db = new PrismaClient({ adapter: new PrismaPg({ host: "/var/run/postgresql", port: 5433, database: "passvero_acceptance", user: "postgres", options: "-c role=passvero_migrator" }) });
  const result = await runOnboardingOperator(db, getAuthPrismaClient(), JSON.parse(process.argv[2]), process.env.BETTER_AUTH_URL, createLazyAuthEmailSender(process.env.BETTER_AUTH_URL));
  process.stdout.write(JSON.stringify(result) + "\n");
}
void main().catch(() => { process.stderr.write("ONBOARDING_OPERATION_FAILED: inspect state before retry.\n"); process.exitCode = 1; }).finally(async () => { await Promise.all([db?.$disconnect(), disconnectBetterAuthServer()]); });
