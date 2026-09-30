// Bundled staging entrypoint. Uses existing runtime credentials in memory; never logs them.
import { z } from "zod";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { validateProductionDatabaseUrl } from "../src/infrastructure/persistence/prisma/production-prisma-config";
import { validateAuthDatabaseUrl } from "../src/infrastructure/auth/auth-database-config";
import { validateSmtpConfig } from "../src/infrastructure/auth/smtp-config";
import { createReminderTransport } from "../src/infrastructure/subscriptions/reminder-transport";
import { ReminderWorker } from "../src/infrastructure/subscriptions/reminder-worker";

async function main() {
  if (process.env.PASSVERO_RUNTIME_ENV !== "staging" || process.env.BETTER_AUTH_URL !== "https://staging.passvero.eu") throw new Error("STAGING_REQUIRED");
  const business = validateProductionDatabaseUrl(process.env.DATABASE_URL, "staging"), authConfig = validateAuthDatabaseUrl(process.env.AUTH_DATABASE_URL, "staging");
  const args = z.tuple([z.enum(["scheduled", "run", "enqueue"]), z.uuid().optional()]).parse([process.argv[2], process.argv[3]]);
  if ((args[0] === "scheduled") !== (args[1] === undefined) || process.argv.length > 4) throw new Error("INVALID_ARGUMENTS");
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: business.connectionString }) });
  const auth = new PrismaClient({ adapter: new PrismaPg({ connectionString: authConfig.connectionString }) });
  try {
    const worker = new ReminderWorker(db, auth, createReminderTransport(validateSmtpConfig(process.env)), { canonicalOrigin: process.env.BETTER_AUTH_URL, runtimeEnvironment: "staging" });
    const now = new Date();
    const campaignId = args[1] ?? (await db.reminderCampaign.findFirst({ where: { OR: [{ enabled: true, expiresAt: { gt: now } }, { reminders: { some: { status: { in: ["CLAIMED", "SENDING"] }, leaseUntil: { lte: now } } } }] }, orderBy: [{ lastStartedAt: { sort: "asc", nulls: "first" } }, { id: "asc" }], select: { id: true } }))?.id;
    if (!campaignId) { console.log(JSON.stringify({ worker: "IDLE", sending: "NO_APPROVED_CAMPAIGN" })); return; }
    if (args[0] === "enqueue") { await worker.enqueue(campaignId); console.log(JSON.stringify({ worker: "ENQUEUED", campaignId, transportCalls: 0 })); }
    else console.log(JSON.stringify({ worker: (await worker.run(campaignId)).status, campaignId, inboxReceipt: "NOT_PROVEN" }));
  } finally { await db.$disconnect(); await auth.$disconnect(); }
}
void main().catch(() => { console.error(JSON.stringify({ worker: "FAILED", reason: "REMINDER_WORKER_FAILED" })); process.exitCode = 1; });
