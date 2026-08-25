import type { TurnstileVerifier } from "../../application/auth/turnstile";
import { createTurnstileVerifierAdapter } from "./turnstile-verifier";

const providerEndpoint =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

type ProviderRequest = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Readonly<{
  ok: boolean;
  json(): Promise<unknown>;
}>>;

export function createLazyCloudflareTurnstileVerifier(input: Readonly<{
  readSecretKey(): unknown;
  request: ProviderRequest;
}>): TurnstileVerifier {
  let verifier: TurnstileVerifier | undefined;

  return {
    async verify(request) {
      verifier ??= createProviderVerifier(input);
      return verifier.verify(request);
    },
  };
}

function createProviderVerifier(input: Readonly<{
  readSecretKey(): unknown;
  request: ProviderRequest;
}>): TurnstileVerifier {
  const secretKey = validateSecretKey(input.readSecretKey());

  return createTurnstileVerifierAdapter({
    async verifyProvider(request) {
      const body = new URLSearchParams({
        secret: secretKey,
        response: request.token,
      });
      if (request.trustedClientAddress !== undefined) {
        body.set("remoteip", request.trustedClientAddress);
      }
      const response = await input.request(providerEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) {
        throw new Error("Turnstile provider request failed.");
      }
      return response.json();
    },
  });
}

function validateSecretKey(value: unknown): string {
  if (
    typeof value !== "string"
    || !/^[A-Za-z0-9_-]{20,128}$/.test(value)
  ) {
    throw new Error("Turnstile verification is unavailable.");
  }
  return value;
}
