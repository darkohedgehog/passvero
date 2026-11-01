import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../../src/generated/prisma/client";
import type { AuthEmailMessage, AuthEmailSender } from "../../src/application/auth/auth-email";
import type { OnboardingNotificationPolicy } from "../../src/infrastructure/persistence/prisma/onboarding-notification-policy";
import { PrismaAccessRequestNotifications } from "../../src/infrastructure/persistence/prisma/prisma-access-request-notifications";

function fixture(origin = "https://passvero.eu") {
  const requestId = randomUUID();
  const recipient = "admin@example.invalid";
  const now = Date.now();
  const notice = { status: "PENDING", attempts: 0, recipientEmail: recipient, startedAt: null as Date | null };
  const settings = { enabled: true, recipientEmail: recipient };
  const request = { createdAt: new Date(now - 1000), email: "applicant@example.invalid", contactName: "Applicant", organizationDisplayName: "Company", locale: "hr" };
  let policy: OnboardingNotificationPolicy | null = { mode: "NEW_REQUESTS", activatedAt: new Date(now - 60000).toISOString(), recipient };
  const sent: AuthEmailMessage[] = [];
  const audit: string[] = [];
  const tx = {
    $queryRaw: async () => [],
    accessRequestAdminNotification: {
      findUnique: async () => notice,
      update: async ({ data }: { data: { status: string; startedAt: Date } }) => {
        notice.status = data.status;
        notice.startedAt = data.startedAt;
        notice.attempts++;
      },
      updateMany: async ({ data }: { data: { status: string } }) => {
        notice.status = data.status;
        return { count: 1 };
      },
    },
    onboardingNotificationSettings: { findUnique: async () => settings },
    accessRequest: { findUnique: async () => request },
    authAuditEvent: { create: async ({ data }: { data: { action: string } }) => { audit.push(data.action); } },
  };
  // Only the persistence boundary is doubled; execute the real delivery/policy logic.
  // This does not establish PostgreSQL locking or SMTP/provider delivery behavior.
  const db = { $transaction: async <T>(execute: (client: typeof tx) => Promise<T>) => execute(tx) } as unknown as PrismaClient;
  const notifications = new PrismaAccessRequestNotifications(db, origin, async () => policy);
  const sender: AuthEmailSender = { async send(message) { sent.push(message); return { status: "SENT" }; } };
  return { requestId, notice, settings, request, sent, audit, notifications, sender, setPolicy(value: OnboardingNotificationPolicy | null) { policy = value; } };
}

for (const origin of ["https://passvero.eu", "https://staging.passvero.eu"]) {
  test(`${origin}: one new request sends one admin notice; replay never resends`, async () => {
    const f = fixture(origin);
    assert.deepEqual(await f.notifications.deliver(f.requestId, f.sender), { status: "SENT" });
    await f.notifications.deliver(f.requestId, f.sender);
    assert.equal(f.sent.length, 1);
    assert.equal(f.notice.attempts, 1);
    assert.equal(f.sent[0].type, "ACCESS_REQUEST_ADMIN");
    assert.equal(f.sent[0].recipient, "admin@example.invalid");
    assert.equal(f.sent[0].type === "ACCESS_REQUEST_ADMIN" && f.sent[0].reviewUrl, `${origin}/platform/access-requests`);
    assert.deepEqual(f.audit, ["ACCESS_ADMIN_NOTIFICATION_STARTED", "ACCESS_ADMIN_NOTIFICATION_SENT"]);
  });
}

test("production unknown delivery is retained and never automatically retried", async () => {
  const f = fixture();
  let attempts = 0;
  const failing: AuthEmailSender = { async send() { attempts++; throw Error("Synthetic transport failure"); } };
  assert.deepEqual(await f.notifications.deliver(f.requestId, failing), { status: "DELIVERY_UNKNOWN" });
  await f.notifications.deliver(f.requestId, failing);
  await f.notifications.deliver(f.requestId, failing, true);
  assert.equal(attempts, 1);
  assert.equal(f.notice.attempts, 1);
  assert.equal(f.notice.status, "DELIVERY_UNKNOWN");
});

test("production requires enabled settings and matching policy; old requests never backfill", async () => {
  const cases: Array<(f: ReturnType<typeof fixture>) => void> = [
    f => { f.settings.enabled = false; },
    f => { f.setPolicy(null); },
    f => { f.settings.recipientEmail = "different@example.invalid"; },
    f => { f.setPolicy({ mode: "NEW_REQUESTS", activatedAt: new Date(Date.now() - 60000).toISOString(), recipient: "different@example.invalid" }); },
    f => { f.request.createdAt = new Date(0); },
    f => { f.notice.attempts = 1; },
  ];
  for (const change of cases) {
    const f = fixture();
    change(f);
    assert.deepEqual(await f.notifications.deliver(f.requestId, f.sender), { status: "PENDING" });
    assert.equal(f.sent.length, 0);
    assert.equal(f.audit.length, 0);
  }
});

test("unrecognized origin cannot enable automatic admin mail", async () => {
  const f = fixture("https://unreviewed.example.invalid");
  await f.notifications.deliver(f.requestId, f.sender);
  assert.equal(f.sent.length, 0);
  assert.equal(f.notice.attempts, 0);
});
