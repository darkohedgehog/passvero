import assert from "node:assert/strict";
import { constants, type Stats } from "node:fs";
import fs, { type FileHandle } from "node:fs/promises";
import test, { type TestContext } from "node:test";
import type { PrismaClient } from "../../src/generated/prisma/client";
import { readOnboardingNotificationPolicy } from "../../src/infrastructure/persistence/prisma/onboarding-notification-policy";
import { PrismaAccessRequestNotifications } from "../../src/infrastructure/persistence/prisma/prisma-access-request-notifications";

const staging = "/var/lib/passvero-onboarding-notifications/policy.json";
const production = "/var/lib/passvero-production-onboarding-notifications/policy.json";
const payload = (recipient: string) => JSON.stringify({ mode: "NEW_REQUESTS", recipient, activatedAt: "2026-11-01T22:00:00.000Z" });

function files(t: TestContext, contents: Record<string, string>) {
  const directories: string[] = [];
  const opened: string[] = [];
  const posture = { directoryUid: 0, directoryMode: 0o750, fileUid: 0, fileMode: 0o640, symlink: false };
  t.mock.method(fs, "lstat", async (path: string) => {
    directories.push(path);
    return { isDirectory: () => true, isSymbolicLink: () => posture.symlink, uid: posture.directoryUid, mode: posture.directoryMode } as Stats;
  });
  t.mock.method(fs, "open", async (path: string, flags: number) => {
    opened.push(path);
    assert.ok(flags & constants.O_NOFOLLOW);
    if (!(path in contents)) throw Error("ENOENT");
    return {
      stat: async () => ({ isFile: () => true, uid: posture.fileUid, mode: posture.fileMode, size: contents[path].length }),
      readFile: async () => contents[path],
      close: async () => {},
    } as unknown as FileHandle;
  });
  return { directories, opened, posture };
}

for (const [origin, path, recipient] of [
  ["https://staging.passvero.eu", staging, "staging@example.invalid"],
  ["https://passvero.eu", production, "production@example.invalid"],
] as const) {
  test(`${origin} reads only its own policy and recipient`, async t => {
    const f = files(t, { [staging]: payload("staging@example.invalid"), [production]: payload("production@example.invalid") });
    assert.equal((await readOnboardingNotificationPolicy(origin))?.recipient, recipient);
    assert.deepEqual(f.opened, [path]);
    assert.deepEqual(f.directories, [path.slice(0, path.lastIndexOf("/"))]);
  });
}

test("missing production policy never falls back to an existing staging policy", async t => {
  const f = files(t, { [staging]: payload("staging@example.invalid") });
  assert.equal(await readOnboardingNotificationPolicy("https://passvero.eu"), null);
  assert.deepEqual(f.opened, [production]);
});

test("unapproved, noncanonical and missing origins perform no policy filesystem reads", async t => {
  const f = files(t, { [staging]: payload("staging@example.invalid") });
  for (const origin of [undefined, "https://other.example.invalid", "https://passvero.eu/", "http://passvero.eu", "https://passvero.eu.evil.invalid"]) {
    assert.equal(await readOnboardingNotificationPolicy(origin), null);
  }
  assert.deepEqual(f.directories, []);
  assert.deepEqual(f.opened, []);
});

test("production policy retains root ownership, nonwritable and symlink directory guards", async t => {
  const f = files(t, { [production]: payload("production@example.invalid") });
  for (const change of [{ directoryUid: 1000 }, { directoryMode: 0o770 }, { fileUid: 1000 }, { fileMode: 0o660 }, { symlink: true }]) {
    Object.assign(f.posture, { directoryUid: 0, directoryMode: 0o750, fileUid: 0, fileMode: 0o640, symlink: false }, change);
    assert.equal(await readOnboardingNotificationPolicy("https://passvero.eu"), null);
  }
});

test("delivery default reader passes canonical origin and cannot consume staging policy for production", async t => {
  const f = files(t, {});
  const tx = {
    $queryRaw: async () => [],
    accessRequestAdminNotification: { findUnique: async () => ({ recipientEmail: "admin@example.invalid", attempts: 0, status: "PENDING" }) },
    onboardingNotificationSettings: { findUnique: async () => ({ recipientEmail: "admin@example.invalid", enabled: true }) },
    accessRequest: { findUnique: async () => ({ createdAt: new Date(), email: "applicant@example.invalid", contactName: "Applicant", organizationDisplayName: "Company", locale: "hr" }) },
  };
  // Persistence is doubled only to reach the real default policy composition; no DB or SMTP.
  const db = { $transaction: async <T>(execute: (client: typeof tx) => Promise<T>) => execute(tx) } as unknown as PrismaClient;
  for (const origin of ["https://staging.passvero.eu", "https://passvero.eu", "https://other.example.invalid"]) {
    await new PrismaAccessRequestNotifications(db, origin).deliver("00000000-0000-4000-8000-000000000001", {
      async send() { throw Error("Unexpected SMTP attempt"); },
    });
  }
  assert.deepEqual(f.opened, [staging, production]);
});
