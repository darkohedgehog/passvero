import { verifyJWT } from "better-auth/crypto";
import type { VerifiedActivationResult } from "@/src/application/auth/complete-verified-activation";
import { canonicalizeAuthAccountIdentifier } from "./auth-abuse-identifiers";

export class VerificationRecoveryError extends Error {
  constructor(readonly code: "VERIFICATION_DENIED" | "CONFLICT" | "OPERATIONAL_FAILURE") {
    super("Email verification did not complete.");
  }
}

// Only the existing verification-consume path supplies this adapter's token.
// Provider token validation and provider reads remain outside the business transaction.
export function createVerificationBindingRecovery(dependencies: {
  readonly secret: string;
  verifyEmail(token: string): Promise<unknown>;
  findUserByEmail(email: string): Promise<{ id: string; email: string; emailVerified: boolean } | null>;
  complete(identity: { providerSubject: string; email: string }): Promise<VerifiedActivationResult>;
}) {
  return async (input: { token: string }): Promise<"VERIFIED" | "NO_CHANGE"> => {
    try {
      const claims = await verifyJWT<Record<string, unknown>>(input.token, dependencies.secret);
      if (!claims || Object.keys(claims).some(key => !["email", "iat", "exp"].includes(key))
        || typeof claims.email !== "string" || !claims.email || claims.email.length > 254
        || typeof claims.iat !== "number" || !Number.isFinite(claims.iat)
        || typeof claims.exp !== "number" || !Number.isFinite(claims.exp)
        || claims.exp <= claims.iat || claims.exp * 1000 <= Date.now()) {
        throw new VerificationRecoveryError("VERIFICATION_DENIED");
      }
      let canonicalEmail: string;
      try { canonicalEmail = canonicalizeAuthAccountIdentifier(claims.email); }
      catch { throw new VerificationRecoveryError("VERIFICATION_DENIED"); }
      if (canonicalEmail !== claims.email) throw new VerificationRecoveryError("VERIFICATION_DENIED");
      const result = await dependencies.verifyEmail(input.token);
      if (typeof result !== "object" || result === null || !("status" in result) || result.status !== true) {
        throw new VerificationRecoveryError("VERIFICATION_DENIED");
      }
      const user = await dependencies.findUserByEmail(canonicalEmail);
      if (!user || !user.id || user.emailVerified !== true || user.email !== canonicalEmail
        || claims.exp * 1000 <= Date.now()) throw new VerificationRecoveryError("VERIFICATION_DENIED");
      const completed = await dependencies.complete({ providerSubject: user.id, email: user.email });
      if (completed.status === "BOUND") return "VERIFIED";
      if (completed.status === "ALREADY_BOUND") return "NO_CHANGE";
      throw new VerificationRecoveryError(completed.status === "CONFLICT" ? "CONFLICT" : "VERIFICATION_DENIED");
    } catch (error) {
      if (error instanceof VerificationRecoveryError) throw error;
      throw new VerificationRecoveryError("OPERATIONAL_FAILURE");
    }
  };
}
