import type { TurnstileVerifier } from "../../application/auth/turnstile";

type TurnstileProviderTransport = Readonly<{
  verifyProvider(input: {
    readonly token: string;
    readonly expectedAction: string;
    readonly trustedClientAddress?: string;
  }): Promise<unknown>;
}>;

export function createTurnstileVerifierAdapter(
  transport: TurnstileProviderTransport,
): TurnstileVerifier {
  return {
    async verify(input) {
      let response: unknown;
      try {
        response = await transport.verifyProvider(input);
      } catch {
        throw new Error("Turnstile verification is unavailable.");
      }
      if (!isProviderResponse(response)) {
        return { valid: false };
      }
      return response.success
        ? { valid: true, action: response.action }
        : { valid: false };
    },
  };
}

function isProviderResponse(
  value: unknown,
): value is Readonly<{ success: boolean; action: string }> {
  return typeof value === "object"
    && value !== null
    && "success" in value
    && typeof value.success === "boolean"
    && (!value.success || (
      "action" in value
      && typeof value.action === "string"
      && value.action.length > 0
    ));
}
