import { constants } from "node:fs";
import { lstat, open } from "node:fs/promises";
import { z } from "zod";
import { accessRequestSchema } from "@/src/application/auth/access-request";

export const onboardingNotificationPolicyPath = "/var/lib/passvero-onboarding-notifications/policy.json";
const instant = z.iso.datetime({ precision: 3 });
const common = { activatedAt: instant, recipient: z.email().max(254) };
export const onboardingNotificationPolicySchema = z.discriminatedUnion("mode", [
  z.object({ ...common, mode: z.literal("ACCEPTANCE"), expiresAt: instant, request: accessRequestSchema }).strict(),
  z.object({ ...common, mode: z.literal("NEW_REQUESTS") }).strict(),
]).refine(policy => policy.mode !== "ACCEPTANCE" || Date.parse(policy.expiresAt) - Date.parse(policy.activatedAt) === 30 * 60000,
  "Acceptance must be exactly thirty minutes");
export type OnboardingNotificationPolicy = z.infer<typeof onboardingNotificationPolicySchema>;
export type OnboardingNotificationPolicyReader = () => Promise<OnboardingNotificationPolicy | null>;

/** Operator-owned policy; absent/invalid policy fails closed without exposing file contents. */
export async function readOnboardingNotificationPolicy(): Promise<OnboardingNotificationPolicy | null> {
  let file;
  try {
    const directory = await lstat("/var/lib/passvero-onboarding-notifications");
    if (!directory.isDirectory() || directory.isSymbolicLink() || directory.uid !== 0 || (directory.mode & 0o022) !== 0) return null;
    file = await open(onboardingNotificationPolicyPath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const info = await file.stat();
    if (!info.isFile() || info.uid !== 0 || (info.mode & 0o022) !== 0 || info.size > 8192) return null;
    return onboardingNotificationPolicySchema.parse(JSON.parse(await file.readFile("utf8")));
  } catch { return null; }
  finally { await file?.close(); }
}

export function allowsAutomaticAdminNotification(policy: OnboardingNotificationPolicy | null, request: {
  createdAt: Date; email: string; contactName: string; organizationDisplayName: string; locale: string;
}, recipient: string, attempts: number, now: Date): boolean {
  if (!policy || policy.recipient !== recipient || attempts !== 0) return false;
  const start = Date.parse(policy.activatedAt);
  if (now.getTime() < start || request.createdAt.getTime() < start || request.createdAt > now) return false;
  if (policy.mode === "NEW_REQUESTS") return true;
  if (now.getTime() >= Date.parse(policy.expiresAt)) return false;
  // AccessRequest.email is unique. Matching all approved fields binds the one new
  // request; its locked retained notification row reserves the sole attempt.
  return request.email === policy.request.email && request.contactName === policy.request.contactName
    && request.organizationDisplayName === policy.request.organizationDisplayName && request.locale === policy.request.locale;
}
