import type { MembershipRole } from "@/src/application/context/authenticated-user-context";
import { isPassveroLocale, type PassveroLocale } from "@/src/domain/values/passvero-locale";

export type ProvisioningFailure = "INVALID_INPUT" | "EXISTING_BUSINESS_EMAIL" | "PROVISIONING_CONFLICT" | "OPERATIONAL_FAILURE";
export class ProvisioningError extends Error {
  constructor(readonly code: ProvisioningFailure) {
    super("Controlled customer provisioning did not complete.");
  }
}
export interface ProvisioningRecord {
  readonly email: string;
  readonly organizationDisplayName: string;
  readonly role: MembershipRole;
  readonly issuedAt: Date;
  readonly expiresAt: Date;
  readonly tokenDigest: string;
  readonly intendedEmailDigest: string;
}
export interface ProvisioningResult {
  readonly organization: { readonly displayName: string };
  readonly user: { readonly email: string };
  readonly membership: { readonly role: MembershipRole };
  readonly activation: { readonly expiresAt: string; readonly activationUrl: string };
}
interface Dependencies {
  readonly canonicalOrigin: string;
  normalizeEmail(value: string): string;
  now(): Date;
  generateCapability(): string;
  readonly digesters: {
    readonly capabilityDigester: { digest(value: string): Promise<string | null> };
    readonly intendedEmailDigester: { digest(value: string): Promise<string> };
  };
  readonly persistence: { create(record: ProvisioningRecord): Promise<void> };
}
const TTL_MS = 72 * 60 * 60 * 1000;

export function createOperatorProvisioningService(dependencies: Dependencies) {
  return async (value: unknown): Promise<ProvisioningResult> => {
    try {
      const input = normalizeInput(value, dependencies.normalizeEmail);
      const origin = new URL(dependencies.canonicalOrigin);
      if (origin.protocol !== "https:" || origin.origin !== dependencies.canonicalOrigin || origin.port || origin.username || origin.password) throw new Error("Invalid configuration");
      const issuedAt = new Date(dependencies.now().getTime());
      const expiresAt = new Date(issuedAt.getTime() + TTL_MS);
      if (!Number.isFinite(issuedAt.getTime()) || !Number.isFinite(expiresAt.getTime())) throw new Error("Invalid clock");
      const capability = dependencies.generateCapability();
      const tokenDigest = await dependencies.digesters.capabilityDigester.digest(capability);
      if (tokenDigest === null) throw new Error("Invalid capability");
      const intendedEmailDigest = await dependencies.digesters.intendedEmailDigester.digest(input.email);
      const path = input.locale === "hr" ? "/activate-account" : `/${input.locale}/activate-account`;
      const url = new URL(path, origin);
      url.hash = new URLSearchParams({ capability }).toString();
      // Prepare the only plaintext result before committing; never put it in persistence.
      const result: ProvisioningResult = {
        organization: { displayName: input.organizationDisplayName }, user: { email: input.email },
        membership: { role: input.role }, activation: { expiresAt: expiresAt.toISOString(), activationUrl: url.toString() },
      };
      await dependencies.persistence.create({ email: input.email, organizationDisplayName: input.organizationDisplayName, role: input.role, issuedAt, expiresAt, tokenDigest, intendedEmailDigest });
      return result;
    } catch (error) {
      if (error instanceof ProvisioningError) throw error;
      throw new ProvisioningError("OPERATIONAL_FAILURE");
    }
  };
}

function normalizeInput(value: unknown, normalizeEmail: Dependencies["normalizeEmail"]): {
  email: string; organizationDisplayName: string; role: MembershipRole; locale: PassveroLocale;
} {
  const invalid = (): never => { throw new ProvisioningError("INVALID_INPUT"); };
  if (typeof value !== "object" || value === null || Array.isArray(value)) return invalid();
  const allowed = ["email", "organizationDisplayName", "role", "locale"];
  if (Object.keys(value).length !== allowed.length || Object.keys(value).some(key => !allowed.includes(key))) return invalid();
  const input = value as Record<string, unknown>;
  if (typeof input.email !== "string" || input.email.length > 254 || typeof input.organizationDisplayName !== "string" || input.organizationDisplayName.length > 200) return invalid();
  let email: string;
  try { email = normalizeEmail(input.email); } catch { return invalid(); }
  // Match the bounded address shape accepted by the existing credential flow.
  const emailPattern = /^(?!\.)(?!.*\.\.)[a-z0-9_'+.\-]*[a-z0-9_+\-]@(?:[a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/;
  if (email.length > 254 || !emailPattern.test(email)) return invalid();
  const organizationDisplayName = input.organizationDisplayName.trim().normalize("NFC");
  if (!organizationDisplayName || /[\u0000-\u001f\u007f]/.test(organizationDisplayName)) return invalid();
  if (input.role !== "VIEWER" && input.role !== "EDITOR" && input.role !== "ADMIN" && input.role !== "OWNER") return invalid();
  if (typeof input.locale !== "string" || !isPassveroLocale(input.locale)) return invalid();
  return { email, organizationDisplayName, role: input.role, locale: input.locale };
}
