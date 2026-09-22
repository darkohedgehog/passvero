// Privileged operator process only; inherit staging service configuration. Never load env files here.
import { parseAccessRequestCommand } from "../src/application/auth/access-request-cli";
import { PrismaAccessRequests, AccessRequestError } from "../src/infrastructure/persistence/prisma/prisma-access-requests";
import { getProductionPrismaClient, disconnectProductionPrisma } from "../src/infrastructure/persistence/prisma/production-prisma-runtime";
import { createLazyAuthEmailSender } from "../src/infrastructure/auth/auth-email-runtime";
import { getBetterAuthServer, disconnectBetterAuthServer } from "../src/infrastructure/auth/better-auth-server";
import { ProvisioningError } from "../src/application/auth/operator-provisioning";

async function main() {
  const command = parseAccessRequestCommand(process.argv.slice(2));
  // OS/service credentials are the operator authority. Tenant roles cannot invoke this process.
  if (process.env.PASSVERO_RUNTIME_ENV !== "staging" || process.env.BETTER_AUTH_URL !== "https://staging.passvero.eu") throw new AccessRequestError("STAGING_TARGET_REQUIRED");
  const requests = new PrismaAccessRequests(getProductionPrismaClient(), async email => {
    const context = await getBetterAuthServer().$context;
    return Boolean(await context.internalAdapter.findUserByEmail(email, { includeAccounts: false }));
  });
  const result = command.command === "list" ? await requests.pending()
    : command.command === "show" ? await requests.review(command.id)
    : command.command === "reject" ? await requests.reject(command.id, command.operator)
    : command.command === "retry-delivery" ? await requests.retryDelivery(command.id, command.operator, process.env, createLazyAuthEmailSender(process.env.BETTER_AUTH_URL))
    : await requests.approve(command.id, command.operator, process.env, createLazyAuthEmailSender(process.env.BETTER_AUTH_URL));
  // Selected review PII is operator-only. Never emit capabilities, provider errors or raw DB records.
  process.stdout.write(`${JSON.stringify(result)}\n`);
}
void main().catch(error => {
  process.stderr.write(`${error instanceof AccessRequestError || error instanceof ProvisioningError ? error.code : "OPERATIONAL_FAILURE"}\n`);
  process.exitCode = 1;
}).finally(async () => { try { await Promise.all([disconnectProductionPrisma(), disconnectBetterAuthServer()]); } catch { process.stderr.write("RESOURCE_CLEANUP_FAILED: review status before any retry.\n"); } });
